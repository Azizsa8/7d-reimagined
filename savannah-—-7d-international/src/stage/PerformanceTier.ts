import { bus } from '../state/bus';

export type TierName = 'low' | 'mid' | 'high';

export interface TierConfig {
  name: TierName;
  dprCap: number;
  presenceParticles: number;
  globeParticles: number;
  imageGrid: [number, number];
  bloomHalfRes: boolean;
  dof: boolean;
  chromaticAberration: boolean;
}

export const TIERS: Record<TierName, TierConfig> = {
  low: { name: 'low', dprCap: 1.25, presenceParticles: 12000, globeParticles: 12000, imageGrid: [120, 68], bloomHalfRes: true, dof: false, chromaticAberration: false },
  mid: { name: 'mid', dprCap: 1.75, presenceParticles: 24000, globeParticles: 20000, imageGrid: [160, 90], bloomHalfRes: true, dof: false, chromaticAberration: false },
  high: { name: 'high', dprCap: 2, presenceParticles: 40000, globeParticles: 30000, imageGrid: [240, 135], bloomHalfRes: false, dof: true, chromaticAberration: true },
};

/**
 * Picks a tier once (URL override, hardware hints, then a one-second frame-time
 * probe) and steps down live when the rolling average exceeds 22 ms for 3 s.
 */
export class PerformanceMonitor {
  public tier: TierConfig;
  private frames: number[] = [];
  private last = performance.now();
  private slowMs = 0;
  private probing = true;
  private probeStart = performance.now();
  private probeFrames = 0;
  private locked = false;

  constructor(private onChange: (t: TierConfig) => void) {
    this.tier = this.initial();
  }

  private initial(): TierConfig {
    const params = new URLSearchParams(window.location.search);
    const forced = params.get('tier') as TierName | null;
    if (forced && TIERS[forced]) {
      this.locked = true;
      this.probing = false;
      return TIERS[forced];
    }
    const cores = navigator.hardwareConcurrency || 4;
    const mem = (navigator as any).deviceMemory as number | undefined;
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;
    if (cores <= 2 || (mem && mem <= 2)) return TIERS.low;
    if (!mobile && cores >= 8) return TIERS.high;
    if (mobile && cores <= 4) return TIERS.low;
    return TIERS.mid;
  }

  record(now: number) {
    const dt = now - this.last;
    this.last = now;
    if (dt <= 0 || dt > 250) return;

    if (this.probing) {
      this.probeFrames++;
      if (now - this.probeStart > 1000) {
        this.probing = false;
        const fps = (this.probeFrames * 1000) / (now - this.probeStart);
        if (fps < 40 && this.tier.name !== 'low') this.step();
      }
      return;
    }

    this.frames.push(dt);
    if (this.frames.length > 90) this.frames.shift();
    const avg = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
    if (avg > 22) {
      this.slowMs += dt;
      if (this.slowMs > 3000) {
        this.slowMs = 0;
        this.frames = [];
        this.step();
      }
    } else {
      this.slowMs = Math.max(0, this.slowMs - dt * 0.5);
    }
  }

  private step() {
    if (this.locked) return;
    const next = this.tier.name === 'high' ? TIERS.mid : this.tier.name === 'mid' ? TIERS.low : null;
    if (!next) return;
    this.tier = next;
    console.info(`[perf] stepped down to ${next.name}`);
    bus.emit('tier', next.name);
    this.onChange(next);
  }
}
