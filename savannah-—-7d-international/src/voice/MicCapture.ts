import { bus } from '../state/bus';
import { AUDIO_SAMPLE_RATE_INPUT } from '../config';

export class MicCapture {
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private analyser: AnalyserNode | null = null;

  private isMuted = false;
  private isCapturing = false;
  private onChunkCallback?: (base64Chunk: string) => void;

  private micTimeData: Uint8Array = new Uint8Array(512);
  private animFrameId = 0;
  public isAvailable = false;

  constructor() {}

  public async start(onChunk: (base64Chunk: string) => void): Promise<boolean> {
    this.onChunkCallback = onChunk;

    if (!navigator?.mediaDevices?.getUserMedia) {
      console.warn('MicCapture: navigator.mediaDevices.getUserMedia not available.');
      return this.handleMicFailure({ name: 'NotFoundError', message: 'Media devices API not available' });
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this.isAvailable = true;
      bus.emit('micAvailable', true);
    } catch (err: any) {
      const isConstraintErr = err.name === 'OverconstrainedError' || err.name === 'TypeError';
      if (isConstraintErr) {
        try {
          this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          this.isAvailable = true;
          bus.emit('micAvailable', true);
        } catch (fallbackErr: any) {
          return this.handleMicFailure(fallbackErr);
        }
      } else {
        return this.handleMicFailure(err);
      }
    }

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      this.sourceNode = this.audioCtx.createMediaStreamSource(this.stream);

      // Setup AnalyserNode for mic amplitude visualization
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.3;
      this.sourceNode.connect(this.analyser);

    // Setup processing node to resample to 16 kHz PCM16
    const bufferSize = 2048;
    this.scriptNode = this.audioCtx.createScriptProcessor(bufferSize, 1, 1);

    const inputSampleRate = this.audioCtx.sampleRate;
    const targetSampleRate = AUDIO_SAMPLE_RATE_INPUT; // 16000

    this.scriptNode.onaudioprocess = (e) => {
      if (!this.isCapturing || this.isMuted) return;

      const inputData = e.inputBuffer.getChannelData(0);

      // Resample down to 16 kHz
      const downsampled = this.downsampleBuffer(inputData, inputSampleRate, targetSampleRate);
      if (downsampled.length === 0) return;

      // Convert Float32 [-1, 1] to Int16 PCM
      const pcm16 = new Int16Array(downsampled.length);
      for (let i = 0; i < downsampled.length; i++) {
        const s = Math.max(-1, Math.min(1, downsampled[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      // Base64 encode
      const uint8 = new Uint8Array(pcm16.buffer);
      let binary = '';
      const len = uint8.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const base64Chunk = btoa(binary);

      if (this.onChunkCallback) {
        this.onChunkCallback(base64Chunk);
      }
    };

    this.sourceNode.connect(this.scriptNode);
    // Note: Chrome requires scriptNode to connect to destination to run
    this.scriptNode.connect(this.audioCtx.destination);

    this.isCapturing = true;
    this.startMicLevelLoop();
    return true;
  } catch (audioCtxErr: any) {
    console.warn('MicCapture: AudioContext setup failed', audioCtxErr);
    return this.handleMicFailure(audioCtxErr);
  }
}

  private handleMicFailure(err: any): boolean {
    this.isAvailable = false;
    bus.emit('micAvailable', false);

    const isNotFound =
      err?.name === 'NotFoundError' ||
      err?.name === 'DevicesNotFoundError' ||
      (typeof err?.message === 'string' && err.message.toLowerCase().includes('device not found'));

    const isDenied =
      err?.name === 'NotAllowedError' ||
      err?.name === 'PermissionDeniedError' ||
      (typeof err?.message === 'string' && err.message.toLowerCase().includes('denied'));

    if (isNotFound) {
      console.info('MicCapture: No microphone detected on this device. Savannah will run in interactive text/prompts mode.');
      bus.emit('error', 'MIC_NOT_FOUND');
    } else if (isDenied) {
      console.warn('MicCapture: Microphone permission was denied.');
      bus.emit('error', 'MIC_PERMISSION_DENIED');
    } else {
      console.warn('MicCapture: Microphone initialization note:', err?.message || err);
      bus.emit('error', 'MIC_UNAVAILABLE');
    }

    return false;
  }

  private downsampleBuffer(
    buffer: Float32Array,
    inputSampleRate: number,
    outputSampleRate: number
  ): Float32Array {
    if (outputSampleRate === inputSampleRate) {
      return buffer;
    }
    const sampleRateRatio = inputSampleRate / outputSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;

    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  }

  private startMicLevelLoop() {
    const loop = () => {
      if (!this.isCapturing) return;
      this.animFrameId = requestAnimationFrame(loop);

      if (!this.analyser || this.isMuted) {
        bus.emit('micLevel', 0);
        return;
      }

      this.analyser.getByteTimeDomainData(this.micTimeData);
      let sumSq = 0;
      for (let i = 0; i < this.micTimeData.length; i++) {
        const val = (this.micTimeData[i] - 128) / 128;
        sumSq += val * val;
      }
      const rms = Math.min(1.0, Math.sqrt(sumSq / this.micTimeData.length) * 4.0);
      bus.emit('micLevel', rms);
    };
    loop();
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.stream) {
      this.stream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
    bus.emit('muted', muted);
    if (muted) {
      bus.emit('micLevel', 0);
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public stop() {
    this.isCapturing = false;
    cancelAnimationFrame(this.animFrameId);

    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.scriptNode) {
      this.scriptNode.disconnect();
      this.scriptNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    bus.emit('micLevel', 0);
  }
}
