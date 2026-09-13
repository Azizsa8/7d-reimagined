export type TierName = 'low' | 'mid' | 'high';

export interface TierConfig {
  name: TierName;
  dprCap: number;
  presenceParticles: number;
  globeParticles: number;
  imageGridWidth: number;
  imageGridHeight: number;
  bloomHalfRes: boolean;
  enableDof: boolean;
  enableChromaticAberration: boolean;
}

export const TIERS: Record<TierName, TierConfig> = {
  low: {
    name: 'low',
    dprCap: 1.25,
    presenceParticles: 12000,
    globeParticles: 12000,
    imageGridWidth: 120,
    imageGridHeight: 68,
    bloomHalfRes: true,
    enableDof: false,
    enableChromaticAberration: false,
  },
  mid: {
    name: 'mid',
    dprCap: 1.75,
    presenceParticles: 24000,
    globeParticles: 20000,
    imageGridWidth: 160,
    imageGridHeight: 90,
    bloomHalfRes: true,
    enableDof: false,
    enableChromaticAberration: false,
  },
  high: {
    name: 'high',
    dprCap: 2.0,
    presenceParticles: 40000,
    globeParticles: 25605,
    imageGridWidth: 240,
    imageGridHeight: 135,
    bloomHalfRes: false,
    enableDof: true,
    enableChromaticAberration: true,
  },
};

export class PerformanceMonitor {
  public currentTier: TierConfig;
  private frameTimes: number[] = [];
  private lastTime = performance.now();
  private slowTimeAccumulator = 0;
  private onTierDowngradeCallback?: (newTier: TierConfig) => void;

  constructor(onTierDowngrade?: (newTier: TierConfig) => void) {
    this.onTierDowngradeCallback = onTierDowngrade;
    this.currentTier = this.detectInitialTier();
  }

  private detectInitialTier(): TierConfig {
    // Check URL query override (e.g. ?tier=low)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tierParam = params.get('tier')?.toLowerCase() as TierName;
      if (tierParam && TIERS[tierParam]) {
        return TIERS[tierParam];
      }

      // Detection based on hardware and screen
      const cores = navigator.hardwareConcurrency || 4;
      const isMobile = window.innerWidth < 768;

      if (cores <= 2 || (isMobile && cores <= 4)) {
        return TIERS.low;
      }
      if (cores >= 8 && !isMobile) {
        return TIERS.high;
      }
      return TIERS.mid;
    }
    return TIERS.mid;
  }

  public recordFrame(now: number) {
    const delta = now - this.lastTime;
    this.lastTime = now;

    if (delta > 0 && delta < 200) {
      this.frameTimes.push(delta);
      if (this.frameTimes.length > 60) {
        this.frameTimes.shift();
      }

      // Calculate rolling average
      const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;

      // If average frame time > 22ms (~45fps) for > 3 seconds, step down
      if (avg > 22) {
        this.slowTimeAccumulator += delta;
        if (this.slowTimeAccumulator > 3000) {
          this.downgradeTier();
          this.slowTimeAccumulator = 0;
          this.frameTimes = [];
        }
      } else {
        this.slowTimeAccumulator = Math.max(0, this.slowTimeAccumulator - delta);
      }
    }
  }

  private downgradeTier() {
    if (this.currentTier.name === 'high') {
      this.currentTier = TIERS.mid;
      console.warn('Performance monitor: Downgraded to mid tier (60fps protection)');
      this.onTierDowngradeCallback?.(this.currentTier);
    } else if (this.currentTier.name === 'mid') {
      this.currentTier = TIERS.low;
      console.warn('Performance monitor: Downgraded to low tier (60fps protection)');
      this.onTierDowngradeCallback?.(this.currentTier);
    }
  }
}
