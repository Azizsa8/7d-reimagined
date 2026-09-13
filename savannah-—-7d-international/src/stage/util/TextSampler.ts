/**
 * Renders text to an offscreen canvas and samples its pixels to 3D points.
 * Used by the figure world (digits) and the project world's typographic hero.
 */
export interface SampledText {
  positions: Float32Array;
  colors: Float32Array;
  width: number;
  height: number;
}

export async function ensureFonts(): Promise<void> {
  if (!('fonts' in document)) return;
  try {
    await Promise.race([new Promise((r) => setTimeout(r, 1500)), Promise.all([
      document.fonts.load('400 120px Michroma'),
      document.fonts.load('600 120px "IBM Plex Sans Arabic"'),
      document.fonts.load('500 120px "IBM Plex Sans"'),
    ])]);
  } catch {
    /* fall back to system fonts */
  }
}

export function sampleText(
  text: string,
  opts: { font: string; worldWidth: number; maxPoints: number; color?: [number, number, number]; step?: number; rtl?: boolean; z?: number; center?: [number, number] },
): SampledText {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.font = opts.font;
  const metrics = ctx.measureText(text);
  const fontPx = parseInt(opts.font.match(/(\d+)px/)?.[1] || '120', 10);
  const w = Math.ceil(metrics.width + fontPx * 0.4);
  const h = Math.ceil(fontPx * 1.4);
  canvas.width = w;
  canvas.height = h;
  ctx.font = opts.font;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.direction = opts.rtl ? 'rtl' : 'ltr';
  ctx.fillText(text, w / 2, h / 2);
  const data = ctx.getImageData(0, 0, w, h).data;

  const step = opts.step ?? Math.max(1, Math.round(fontPx / 60));
  const hits: number[] = [];
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (data[(y * w + x) * 4] > 110) hits.push(x, y);
    }
  }
  // Downsample to maxPoints if needed
  let count = hits.length / 2;
  const keepEvery = count > opts.maxPoints ? count / opts.maxPoints : 1;
  const scale = opts.worldWidth / w;
  const cx = opts.center?.[0] ?? 0;
  const cy = opts.center?.[1] ?? 0;
  const out: number[] = [];
  const col = opts.color ?? [0.878, 0.663, 0.29];
  const cols: number[] = [];
  for (let i = 0; i < count; i += keepEvery) {
    const k = Math.floor(i) * 2;
    const px = hits[k];
    const py = hits[k + 1];
    out.push(cx + (px - w / 2) * scale + (Math.random() - 0.5) * scale * 0.6, cy - (py - h / 2) * scale + (Math.random() - 0.5) * scale * 0.6, (opts.z ?? 0) + (Math.random() - 0.5) * 0.04);
    const v = 0.9 + Math.random() * 0.2;
    cols.push(col[0] * v, col[1] * v, col[2] * v);
  }
  return { positions: new Float32Array(out), colors: new Float32Array(cols), width: w * scale, height: h * scale };
}
