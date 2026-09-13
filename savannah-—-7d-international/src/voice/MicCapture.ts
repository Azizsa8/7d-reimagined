import { bus } from '../state/bus';
import { audioEngine } from '../audio/AudioEngine';
import { AUDIO_SAMPLE_RATE_INPUT } from '../config';

export type MicFailure = 'MIC_PERMISSION_DENIED' | 'MIC_NOT_FOUND' | 'MIC_UNAVAILABLE';

/**
 * Microphone → 16 kHz PCM16 mono, 30 ms frames, base64 for the Live API.
 * AudioWorklet where available; ScriptProcessor fallback (older WebViews).
 * Also drives the mic AnalyserNode that shapes the listening visuals.
 */
export class MicCapture {
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private worklet: AudioWorkletNode | null = null;
  private script: ScriptProcessorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private timeData = new Uint8Array(512);
  private rafId = 0;
  private capturing = false;
  private muted = false;
  /** push-to-talk gate: when false no audio leaves the device (mute without UI change) */
  private gateOpen = true;
  private onChunk?: (base64: string) => void;
  public available = false;
  public lastFailure: MicFailure | null = null;

  async start(onChunk: (base64: string) => void): Promise<boolean> {
    this.onChunk = onChunk;
    if (!navigator?.mediaDevices?.getUserMedia) return this.fail({ name: 'NotFoundError' });

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
    } catch (err: any) {
      if (err?.name === 'OverconstrainedError' || err?.name === 'TypeError') {
        try {
          this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e2) {
          return this.fail(e2);
        }
      } else {
        return this.fail(err);
      }
    }

    const ctx = audioEngine.context;
    await audioEngine.unlock();
    this.source = ctx.createMediaStreamSource(this.stream!);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.3;
    this.source.connect(this.analyser);

    const hasWorklet = await audioEngine.loadMicWorklet();
    if (hasWorklet) {
      this.worklet = new AudioWorkletNode(ctx, 'savannah-mic', { numberOfInputs: 1, numberOfOutputs: 0, channelCount: 1 });
      this.worklet.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        if (!this.capturing || this.muted || !this.gateOpen) return;
        this.onChunk?.(toBase64(new Uint8Array(e.data)));
      };
      this.source.connect(this.worklet);
    } else {
      this.startScriptProcessor(ctx);
    }

    this.capturing = true;
    this.available = true;
    this.lastFailure = null;
    bus.emit('micAvailable', true);
    this.levelLoop();
    return true;
  }

  private startScriptProcessor(ctx: AudioContext) {
    const inRate = ctx.sampleRate;
    const ratio = inRate / AUDIO_SAMPLE_RATE_INPUT;
    this.script = ctx.createScriptProcessor(2048, 1, 1);
    let pending: number[] = [];
    this.script.onaudioprocess = (e) => {
      if (!this.capturing || this.muted || !this.gateOpen) return;
      const input = e.inputBuffer.getChannelData(0);
      const outLen = Math.floor(input.length / ratio);
      for (let i = 0; i < outLen; i++) {
        const start = Math.floor(i * ratio);
        const end = Math.min(input.length, Math.floor((i + 1) * ratio));
        let acc = 0;
        for (let j = start; j < end; j++) acc += input[j];
        pending.push(acc / Math.max(1, end - start));
      }
      while (pending.length >= 480) {
        const frame = pending.splice(0, 480);
        const pcm = new Int16Array(480);
        for (let i = 0; i < 480; i++) {
          const s = Math.max(-1, Math.min(1, frame[i]));
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        this.onChunk?.(toBase64(new Uint8Array(pcm.buffer)));
      }
    };
    // Chrome needs the node reachable from the destination to tick. Silent gain keeps it inaudible.
    const silent = ctx.createGain();
    silent.gain.value = 0;
    this.source!.connect(this.script);
    this.script.connect(silent);
    silent.connect(ctx.destination);
  }

  private fail(err: any): boolean {
    this.available = false;
    const name = String(err?.name || '');
    const msg = String(err?.message || '').toLowerCase();
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || msg.includes('not found')) this.lastFailure = 'MIC_NOT_FOUND';
    else if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || msg.includes('denied') || name === 'SecurityError')
      this.lastFailure = 'MIC_PERMISSION_DENIED';
    else this.lastFailure = 'MIC_UNAVAILABLE';
    bus.emit('micAvailable', false);
    bus.emit('error', this.lastFailure);
    return false;
  }

  private levelLoop = () => {
    if (!this.capturing) return;
    this.rafId = requestAnimationFrame(this.levelLoop);
    if (!this.analyser || this.muted) {
      bus.emit('micLevel', 0);
      return;
    }
    this.analyser.getByteTimeDomainData(this.timeData);
    let sum = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const v = (this.timeData[i] - 128) / 128;
      sum += v * v;
    }
    bus.emit('micLevel', Math.min(1, Math.sqrt(sum / this.timeData.length) * 4));
  };

  setMuted(muted: boolean) {
    this.muted = muted;
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    this.worklet?.port.postMessage({ muted });
    bus.emit('muted', muted);
    if (muted) bus.emit('micLevel', 0);
  }

  get isMuted() {
    return this.muted;
  }

  /** Push-to-talk gate. Does not touch the track so the analyser keeps working. */
  setGate(open: boolean) {
    this.gateOpen = open;
  }

  stop() {
    this.capturing = false;
    cancelAnimationFrame(this.rafId);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    try {
      this.worklet?.disconnect();
      this.script?.disconnect();
      this.source?.disconnect();
      this.analyser?.disconnect();
    } catch {
      /* already gone */
    }
    this.worklet = null;
    this.script = null;
    this.source = null;
    this.analyser = null;
    bus.emit('micLevel', 0);
  }
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(s);
}
