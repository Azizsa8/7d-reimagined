/**
 * One shared AudioContext for the whole app: mic capture, Savannah's playback,
 * the analysers and the synthesised sound design all hang off it. Created and
 * resumed on the first user gesture (the arrival tap).
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private workletReady: Promise<boolean> | null = null;

  get context(): AudioContext {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  get masterGain(): GainNode {
    this.context;
    return this.master!;
  }

  /** Call from a user gesture. Safe to call repeatedly. */
  async unlock(): Promise<void> {
    const ctx = this.context;
    if (ctx.state !== 'running') {
      try {
        await ctx.resume();
      } catch {
        /* the next gesture will retry */
      }
    }
  }

  get now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  get sampleRate(): number {
    return this.context.sampleRate;
  }

  /** Loads the mic worklet once. Resolves false where AudioWorklet is unavailable. */
  loadMicWorklet(): Promise<boolean> {
    if (!this.workletReady) {
      this.workletReady = (async () => {
        const ctx = this.context;
        if (!ctx.audioWorklet) return false;
        try {
          await ctx.audioWorklet.addModule('/worklets/mic-processor.js');
          return true;
        } catch (e) {
          console.warn('[audio] worklet unavailable, falling back', e);
          return false;
        }
      })();
    }
    return this.workletReady;
  }
}

export const audioEngine = new AudioEngine();
