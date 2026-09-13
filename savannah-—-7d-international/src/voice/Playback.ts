import { bus, AudioLevels } from '../state/bus';
import { AUDIO_SAMPLE_RATE_OUTPUT } from '../config';

export class PlaybackManager {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;

  private nextStartTime = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private isAnalyzing = false;
  private animFrameId = 0;

  private freqData: Uint8Array = new Uint8Array(512);
  private timeData: Uint8Array = new Uint8Array(1024);

  // Callbacks for clock-based captions
  private onAudioScheduledCallback?: (startTime: number, duration: number) => void;

  constructor() {}

  public getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      this.setupNodes();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  private setupNodes() {
    if (!this.audioCtx) return;

    this.gainNode = this.audioCtx.createGain();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.6;

    this.gainNode.connect(this.analyser);
    this.analyser.connect(this.audioCtx.destination);

    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeData = new Uint8Array(this.analyser.fftSize);
  }

  public setOnAudioScheduled(cb: (startTime: number, duration: number) => void) {
    this.onAudioScheduledCallback = cb;
  }

  public async resume() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
  }

  public enqueuePcm16Base64(base64Data: string) {
    const ctx = this.getAudioContext();
    if (!ctx || !this.gainNode) return;

    // Convert base64 to Float32Array
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const int16Array = new Int16Array(bytes.buffer);
    const numSamples = int16Array.length;
    if (numSamples === 0) return;

    // Output sample rate from Gemini is 24 kHz
    const buffer = ctx.createBuffer(1, numSamples, AUDIO_SAMPLE_RATE_OUTPUT);
    const channelData = buffer.getChannelData(0);

    for (let i = 0; i < numSamples; i++) {
      channelData[i] = int16Array[i] / 32768.0;
    }

    const duration = buffer.duration;
    const now = ctx.currentTime;

    // Ensure gapless sequencing
    let startTime = this.nextStartTime;
    if (startTime < now) {
      startTime = now + 0.02; // Small 20ms lookahead to prevent glitch
    }
    this.nextStartTime = startTime + duration;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode);

    this.activeSources.add(source);
    source.onended = () => {
      this.activeSources.delete(source);
      if (this.activeSources.size === 0 && ctx.currentTime >= this.nextStartTime) {
        this.stopAnalysis();
        bus.emit('level', { rms: 0, low: 0, mid: 0, high: 0 });
      }
    };

    source.start(startTime);

    if (this.onAudioScheduledCallback) {
      this.onAudioScheduledCallback(startTime, duration);
    }

    this.startAnalysis();
  }

  private startAnalysis() {
    if (this.isAnalyzing) return;
    this.isAnalyzing = true;
    this.analyzeLoop();
  }

  private stopAnalysis() {
    this.isAnalyzing = false;
    cancelAnimationFrame(this.animFrameId);
  }

  private analyzeLoop = () => {
    if (!this.isAnalyzing) return;

    this.animFrameId = requestAnimationFrame(this.analyzeLoop);

    if (!this.analyser || !this.audioCtx) return;

    this.analyser.getByteTimeDomainData(this.timeData);
    this.analyser.getByteFrequencyData(this.freqData);

    // Compute RMS from time domain data
    let sumSq = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const normalized = (this.timeData[i] - 128) / 128;
      sumSq += normalized * normalized;
    }
    const rms = Math.min(1.0, Math.sqrt(sumSq / this.timeData.length) * 3.5);

    // Audio frequency bands calculation:
    // sampleRate / fftSize = bin size in Hz
    const binHz = this.audioCtx.sampleRate / this.analyser.fftSize;

    const getBandEnergy = (minHz: number, maxHz: number) => {
      const startBin = Math.max(0, Math.floor(minHz / binHz));
      const endBin = Math.min(this.freqData.length - 1, Math.ceil(maxHz / binHz));
      let sum = 0;
      let count = 0;
      for (let b = startBin; b <= endBin; b++) {
        sum += this.freqData[b];
        count++;
      }
      return count > 0 ? (sum / count) / 255.0 : 0;
    };

    // low: 80 - 300 Hz (swells body)
    // mid: 300 - 3000 Hz (ripples surface)
    // high: 3000 - 12000 Hz (sparkle)
    const low = getBandEnergy(80, 300);
    const mid = getBandEnergy(300, 3000);
    const high = getBandEnergy(3000, 12000);

    bus.emit('level', { rms, low, mid, high });
  };

  /**
   * Barge-in interruption: immediately stop all active and scheduled audio
   */
  public interrupt() {
    this.activeSources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch (_) {}
    });
    this.activeSources.clear();

    if (this.audioCtx) {
      this.nextStartTime = this.audioCtx.currentTime;
    } else {
      this.nextStartTime = 0;
    }

    this.stopAnalysis();
    bus.emit('level', { rms: 0, low: 0, mid: 0, high: 0 });
    bus.emit('interrupted', true);
  }

  public getCurrentTime(): number {
    return this.audioCtx ? this.audioCtx.currentTime : 0;
  }

  public isPlaying(): boolean {
    return this.activeSources.size > 0;
  }

  public dispose() {
    this.interrupt();
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
    }
  }
}
