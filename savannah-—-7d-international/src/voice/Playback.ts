import { bus } from '../state/bus';
import { audioEngine } from '../audio/AudioEngine';
import { AUDIO_SAMPLE_RATE_OUTPUT } from '../config';

/**
 * Savannah's voice: base64 PCM16 @ 24 kHz → gapless AudioBufferSource queue on the
 * shared context. GainNode → AnalyserNode → master. Exposes the playback clock so
 * captions and word cues can be scheduled to when audio is actually heard.
 */
export class Playback {
  private gain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private freq = new Uint8Array(512);
  private time = new Uint8Array(1024);
  private analysing = false;
  private rafId = 0;
  private generation = 0; // bumps on interrupt so late chunks of an old turn are dropped
  public onEnded?: () => void;
  public onFirstChunkOfTurn?: () => void;
  private turnHasAudio = false;

  private ensure() {
    if (this.gain) return;
    const ctx = audioEngine.context;
    this.gain = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.6;
    this.gain.connect(this.analyser);
    this.analyser.connect(audioEngine.masterGain);
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);
    this.time = new Uint8Array(this.analyser.fftSize);
  }

  /** AudioContext time. */
  get clock(): number {
    return audioEngine.now;
  }

  /** Time at which everything queued so far will have finished playing. */
  queuedUntil(): number {
    const now = this.clock;
    return Math.max(now, this.nextStartTime);
  }

  isPlaying(): boolean {
    return this.sources.size > 0;
  }

  enqueueBase64(b64: string): void {
    this.ensure();
    const ctx = audioEngine.context;
    const gen = this.generation;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const pcm = new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
    if (pcm.length === 0) return;

    const buffer = ctx.createBuffer(1, pcm.length, AUDIO_SAMPLE_RATE_OUTPUT);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) data[i] = pcm[i] / 32768;

    const now = ctx.currentTime;
    // 40 ms of lookahead on a cold start absorbs main-thread jitter; otherwise butt-join.
    let start = this.nextStartTime;
    if (start < now + 0.005) start = now + 0.04;
    this.nextStartTime = start + buffer.duration;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.gain!);
    this.sources.add(src);
    src.onended = () => {
      this.sources.delete(src);
      if (gen !== this.generation) return;
      if (this.sources.size === 0 && ctx.currentTime >= this.nextStartTime - 0.01) {
        this.stopAnalysis();
        this.turnHasAudio = false;
        this.onEnded?.();
      }
    };
    src.start(start);

    if (!this.turnHasAudio) {
      this.turnHasAudio = true;
      this.onFirstChunkOfTurn?.();
    }
    this.startAnalysis();
  }

  /** Barge-in: stop everything now, drop the queue, reset the clock. */
  interrupt(): void {
    this.generation++;
    for (const s of this.sources) {
      try {
        s.onended = null;
        s.stop();
        s.disconnect();
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear();
    this.nextStartTime = this.clock;
    this.turnHasAudio = false;
    this.stopAnalysis();
    bus.emit('level', { rms: 0, low: 0, mid: 0, high: 0 });
  }

  private startAnalysis() {
    if (this.analysing) return;
    this.analysing = true;
    this.loop();
  }

  private stopAnalysis() {
    this.analysing = false;
    cancelAnimationFrame(this.rafId);
    bus.emit('level', { rms: 0, low: 0, mid: 0, high: 0 });
  }

  private loop = () => {
    if (!this.analysing || !this.analyser) return;
    this.rafId = requestAnimationFrame(this.loop);
    this.analyser.getByteTimeDomainData(this.time);
    this.analyser.getByteFrequencyData(this.freq);
    let sum = 0;
    for (let i = 0; i < this.time.length; i++) {
      const v = (this.time[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.min(1, Math.sqrt(sum / this.time.length) * 3.2);
    const binHz = audioEngine.sampleRate / this.analyser.fftSize;
    const band = (lo: number, hi: number) => {
      const a = Math.max(0, Math.floor(lo / binHz));
      const b = Math.min(this.freq.length - 1, Math.ceil(hi / binHz));
      let s = 0;
      for (let i = a; i <= b; i++) s += this.freq[i];
      return b >= a ? s / ((b - a + 1) * 255) : 0;
    };
    bus.emit('level', { rms, low: band(80, 300), mid: band(300, 3000), high: band(3000, 11000) });
  };

  dispose() {
    this.interrupt();
    this.gain?.disconnect();
    this.analyser?.disconnect();
    this.gain = null;
    this.analyser = null;
  }
}
