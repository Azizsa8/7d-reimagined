/**
 * 2D Film Grain Overlay re-seeded at 24 fps
 */
export class FilmGrain {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private width = 0;
  private height = 0;
  private patternCanvas: HTMLCanvasElement;
  private patternCtx: CanvasRenderingContext2D | null;
  private lastUpdate = 0;
  private frameInterval = 1000 / 24; // 24 fps reseed
  private isReducedMotion = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Create a smaller pattern canvas to generate noise efficiently
    this.patternCanvas = document.createElement('canvas');
    this.patternCanvas.width = 128;
    this.patternCanvas.height = 128;
    this.patternCtx = this.patternCanvas.getContext('2d');

    this.checkReducedMotion();
  }

  private checkReducedMotion() {
    if (typeof window !== 'undefined') {
      this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  }

  public resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.generateNoise();
  }

  private generateNoise() {
    if (!this.patternCtx || !this.ctx) return;

    const imgData = this.patternCtx.createImageData(128, 128);
    const data = imgData.data;
    const len = data.length;

    for (let i = 0; i < len; i += 4) {
      const val = (Math.random() * 255) | 0;
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
      data[i + 3] = 255;
    }

    this.patternCtx.putImageData(imgData, 0, 0);

    // Draw pattern onto full canvas with 4% opacity
    this.ctx.clearRect(0, 0, this.width, this.height);
    const pattern = this.ctx.createPattern(this.patternCanvas, 'repeat');
    if (pattern) {
      this.ctx.globalAlpha = 0.04;
      this.ctx.fillStyle = pattern;
      this.ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  public update(now: number) {
    if (this.isReducedMotion) return; // Keep static in reduced motion

    if (now - this.lastUpdate >= this.frameInterval) {
      this.lastUpdate = now;
      this.generateNoise();
    }
  }
}
