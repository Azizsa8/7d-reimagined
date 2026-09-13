import { bus } from '../../state/bus';

export class SoundDesign {
  private ctx: AudioContext | null = null;
  public isEnabled = false;
  public isMuted = false;

  // Master Gain for ambient bed & motifs (-32 dB = ~0.025)
  private masterGain: GainNode | null = null;
  private duckGain: GainNode | null = null;
  private currentDuckTarget = 1.0;
  private bedBoostFactor = 1.0;

  // Ambient bed nodes
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private bedFilter: BiquadFilterNode | null = null;
  private bedLfo: OscillatorNode | null = null;
  private bedLfoGain: GainNode | null = null;

  // World motifs
  private activeMotifName: string | null = null;
  private motifGain: GainNode | null = null;
  private motifNoiseNode: AudioNode | null = null;
  private timelineTickInterval: any = null;

  constructor() {
    // Listen to voice audio levels for ducking
    bus.on('level', (levels) => {
      this.handleVoiceDuck(levels.rms);
    });

    // Listen to speaker mute toggle
    bus.on('sound_mute_toggle', (muted: boolean) => {
      this.setMuted(muted);
    });
  }

  public initOnUserGesture() {
    if (this.ctx && this.ctx.state === 'running') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.setupGraph();
      this.isEnabled = true;
    } catch (e) {
      console.warn('Web Audio SoundDesign init failed:', e);
    }
  }

  private setupGraph() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Master gain: -32dB (~0.0251)
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.025, now);

    // Ducking gain node (ducks by -10dB = x0.316)
    this.duckGain = this.ctx.createGain();
    this.duckGain.gain.setValueAtTime(1.0, now);

    this.duckGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // Bed Filter: low-pass sweeping ~250Hz - 600Hz
    this.bedFilter = this.ctx.createBiquadFilter();
    this.bedFilter.type = 'lowpass';
    this.bedFilter.frequency.setValueAtTime(380, now);
    this.bedFilter.Q.setValueAtTime(1.5, now);

    // LFO for filter sweep
    this.bedLfo = this.ctx.createOscillator();
    this.bedLfo.frequency.setValueAtTime(0.06, now); // ~16s cycle
    this.bedLfoGain = this.ctx.createGain();
    this.bedLfoGain.gain.setValueAtTime(160, now);
    this.bedLfo.connect(this.bedLfoGain);
    this.bedLfoGain.connect(this.bedFilter.frequency);
    this.bedLfo.start();

    // Two detuned sine pads: root (~110Hz A2) and fifth (~164.8Hz E3)
    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = 'sine';
    this.osc1.frequency.setValueAtTime(110.0, now);

    this.osc2 = this.ctx.createOscillator();
    this.osc2.type = 'sine';
    this.osc2.frequency.setValueAtTime(164.8, now);

    const bedMix = this.ctx.createGain();
    bedMix.gain.setValueAtTime(0.65, now);
    this.osc1.connect(bedMix);
    this.osc2.connect(bedMix);

    bedMix.connect(this.bedFilter);
    this.bedFilter.connect(this.duckGain);

    this.osc1.start();
    this.osc2.start();

    // Motif bus
    this.motifGain = this.ctx.createGain();
    this.motifGain.gain.setValueAtTime(0.4, now);
    this.motifGain.connect(this.duckGain);
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(muted ? 0.0 : 0.025 * this.bedBoostFactor, now, 0.05);
    }
  }

  public boostBed(factor: number) {
    this.bedBoostFactor = factor;
    if (!this.ctx || !this.masterGain) return;
    const base = this.isMuted ? 0 : 0.025;
    this.masterGain.gain.setTargetAtTime(base * factor, this.ctx.currentTime, 0.2);
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  private handleVoiceDuck(voiceRms: number) {
    if (!this.duckGain || !this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    // If Savannah speaks (RMS > 0.04), duck by 10dB (~0.316)
    const target = voiceRms > 0.04 ? 0.316 : 1.0;
    if (target !== this.currentDuckTarget) {
      this.currentDuckTarget = target;
      // Fast attack (100ms), relaxed release (400ms)
      const timeConstant = target < 1.0 ? 0.08 : 0.35;
      this.duckGain.gain.setTargetAtTime(target, now, timeConstant);
    }
  }

  // Switch world motif texture
  public setWorldMotif(world: string) {
    if (!this.ctx || !this.isEnabled) return;
    this.stopCurrentMotif();
    this.activeMotifName = world;

    const now = this.ctx.currentTime;

    switch (world) {
      case 'globe': {
        // Airy filtered noise band
        this.playAiryNoise();
        break;
      }
      case 'project': {
        // Soft harmonic shimmer
        this.playShimmer();
        break;
      }
      case 'timeline': {
        // Slow subtle clock ticks
        this.startTimelineTicks();
        break;
      }
      case 'figure': {
        // Low settle tone on digits landing
        this.playSettleTone();
        break;
      }
      default:
        break;
    }
  }

  private stopCurrentMotif() {
    if (this.motifNoiseNode) {
      try {
        (this.motifNoiseNode as any).stop?.();
        this.motifNoiseNode.disconnect();
      } catch (_) {}
      this.motifNoiseNode = null;
    }
    if (this.timelineTickInterval) {
      clearInterval(this.timelineTickInterval);
      this.timelineTickInterval = null;
    }
  }

  private playAiryNoise() {
    if (!this.ctx || !this.motifGain) return;
    // 2-second looped filtered noise buffer
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02; // soft pink-ish noise
      lastOut = data[i];
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(850, this.ctx.currentTime);
    bandpass.Q.setValueAtTime(3.0, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);

    noise.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(this.motifGain);
    noise.start();

    this.motifNoiseNode = noise;
  }

  private playShimmer() {
    if (!this.ctx || !this.motifGain) return;
    // High gentle sine tone with tremolo
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);

    const tremolo = this.ctx.createOscillator();
    tremolo.frequency.setValueAtTime(4.0, this.ctx.currentTime);
    const tremoloGain = this.ctx.createGain();
    tremoloGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.06, this.ctx.currentTime);

    tremolo.connect(osc.frequency);
    osc.connect(gain);
    gain.connect(this.motifGain);

    osc.start();
    tremolo.start();
    this.motifNoiseNode = osc;
  }

  private startTimelineTicks() {
    if (!this.ctx) return;
    const tick = () => {
      if (!this.ctx || !this.motifGain || this.isMuted) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.025);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

      osc.connect(gain);
      gain.connect(this.motifGain);
      osc.start(now);
      osc.stop(now + 0.025);
    };

    tick();
    this.timelineTickInterval = setInterval(tick, 1800);
  }

  public playSettleTone() {
    if (!this.ctx || !this.motifGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.4);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.motifGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  // UI Sounds: Tap click (2ms filtered click)
  public playClick() {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.008);

      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.008);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.008);
    } catch (_) {}
  }

  // UI Sounds: Chip appear / glass tone
  public playGlassTone() {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, now); // C6
      osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.18);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    } catch (_) {}
  }
}

export const soundDesign = new SoundDesign();
