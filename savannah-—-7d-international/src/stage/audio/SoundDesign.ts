import { bus } from '../../state/bus';
import { audioEngine } from '../../audio/AudioEngine';

/**
 * Synthesised sound design on the shared AudioContext (Phase 3 §7).
 * Off until the first tap; the bed ducks under Savannah's voice; a speaker toggle
 * mutes the bed but never her.
 */
export class SoundDesign {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private duck: GainNode | null = null;
  private motif: GainNode | null = null;
  private motifNode: AudioScheduledSourceNode | null = null;
  private tick: number | null = null;
  private duckTarget = 1;
  private boost = 1;
  public muted = false;
  public enabled = false;
  private bedLevel = 0.025; // −32 dB

  constructor() {
    bus.on('level', (l) => this.onVoice(l.rms));
  }

  init() {
    if (this.enabled) return;
    try {
      this.ctx = audioEngine.context;
      const now = this.ctx.currentTime;
      this.master = this.ctx.createGain();
      this.master.gain.setValueAtTime(this.muted ? 0 : this.bedLevel, now);
      this.duck = this.ctx.createGain();
      this.duck.connect(this.master);
      this.master.connect(audioEngine.masterGain);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(380, now);
      filter.Q.setValueAtTime(1.2, now);
      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.05, now);
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(150, now);
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      const mix = this.ctx.createGain();
      mix.gain.setValueAtTime(0.6, now);
      for (const [f, det] of [
        [110, -4],
        [110, 4],
        [165, -3],
        [165, 3],
      ]) {
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(f, now);
        o.detune.setValueAtTime(det, now);
        o.connect(mix);
        o.start();
      }
      mix.connect(filter);
      filter.connect(this.duck);

      this.motif = this.ctx.createGain();
      this.motif.gain.setValueAtTime(0.35, now);
      this.motif.connect(this.duck);
      this.enabled = true;
    } catch (e) {
      console.warn('[sound] init failed', e);
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : this.bedLevel * this.boost, this.ctx.currentTime, 0.05);
  }
  toggle(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }
  /** Headphones connected → +3 dB is safe (no echo). */
  setBoost(factor: number) {
    this.boost = factor;
    if (this.master && this.ctx && !this.muted) this.master.gain.setTargetAtTime(this.bedLevel * factor, this.ctx.currentTime, 0.2);
  }

  private onVoice(rms: number) {
    if (!this.duck || !this.ctx) return;
    const target = rms > 0.035 ? 0.316 : 1; // −10 dB
    if (target !== this.duckTarget) {
      this.duckTarget = target;
      this.duck.gain.setTargetAtTime(target, this.ctx.currentTime, target < 1 ? 0.06 : 0.35);
    }
  }

  setWorld(world: string) {
    if (!this.ctx || !this.motif) return;
    this.stopMotif();
    const now = this.ctx.currentTime;
    switch (world) {
      case 'globe': {
        const len = this.ctx.sampleRate * 2;
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) {
          const w = Math.random() * 2 - 1;
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3;
        }
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(800, now);
        bp.Q.setValueAtTime(2.5, now);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.12, now + 1.2);
        src.connect(bp).connect(g).connect(this.motif);
        src.start();
        this.motifNode = src;
        break;
      }
      case 'project': {
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(880, now);
        const trem = this.ctx.createOscillator();
        trem.frequency.setValueAtTime(3.5, now);
        const tg = this.ctx.createGain();
        tg.gain.setValueAtTime(6, now);
        trem.connect(tg).connect(o.frequency);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.05, now + 1.5);
        o.connect(g).connect(this.motif);
        o.start();
        trem.start();
        this.motifNode = o;
        break;
      }
      case 'timeline': {
        const tickFn = () => {
          if (!this.ctx || !this.motif || this.muted) return;
          const t0 = this.ctx.currentTime;
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.type = 'triangle';
          o.frequency.setValueAtTime(520, t0);
          o.frequency.exponentialRampToValueAtTime(180, t0 + 0.03);
          g.gain.setValueAtTime(0.05, t0);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03);
          o.connect(g).connect(this.motif);
          o.start(t0);
          o.stop(t0 + 0.04);
        };
        tickFn();
        this.tick = window.setInterval(tickFn, 1800);
        break;
      }
      case 'figure':
        this.settle();
        break;
    }
  }

  private stopMotif() {
    if (this.motifNode) {
      try {
        this.motifNode.stop();
        this.motifNode.disconnect();
      } catch {
        /* ignore */
      }
      this.motifNode = null;
    }
    if (this.tick) {
      clearInterval(this.tick);
      this.tick = null;
    }
  }

  settle() {
    if (!this.ctx || !this.motif || this.muted) return;
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, now);
    o.frequency.exponentialRampToValueAtTime(70, now + 0.5);
    g.gain.setValueAtTime(0.25, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    o.connect(g).connect(this.motif);
    o.start(now);
    o.stop(now + 0.5);
  }

  click() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(2200, now);
    o.type = 'square';
    o.frequency.setValueAtTime(900, now);
    o.frequency.exponentialRampToValueAtTime(200, now + 0.012);
    g.gain.setValueAtTime(0.03, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);
    o.connect(f).connect(g).connect(audioEngine.masterGain);
    o.start(now);
    o.stop(now + 0.015);
  }

  glass() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(1318.5, now);
    o.frequency.exponentialRampToValueAtTime(659.25, now + 0.22);
    g.gain.setValueAtTime(0.03, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    o.connect(g).connect(audioEngine.masterGain);
    o.start(now);
    o.stop(now + 0.25);
  }
}

export const soundDesign = new SoundDesign();
