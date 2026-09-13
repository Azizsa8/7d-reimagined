import * as THREE from 'three';

/**
 * Decodes the TopoJSON land layer, rasterises it in an equirectangular canvas,
 * and samples points on the unit sphere with uniform surface density.
 * No CDN, no d3: ~40 lines of arc decoding is all TopoJSON needs.
 */
interface Topology {
  transform?: { scale: [number, number]; translate: [number, number] };
  arcs: number[][][];
  objects: Record<string, { type: string; geometries?: any[]; arcs?: any }>;
}

function decodeArc(topo: Topology, index: number): [number, number][] {
  const arc = topo.arcs[index];
  const out: [number, number][] = [];
  let x = 0;
  let y = 0;
  const t = topo.transform;
  for (const [dx, dy] of arc) {
    x += dx;
    y += dy;
    out.push(t ? [x * t.scale[0] + t.translate[0], y * t.scale[1] + t.translate[1]] : [x, y]);
  }
  return out;
}

function ring(topo: Topology, arcIndexes: number[]): [number, number][] {
  const pts: [number, number][] = [];
  for (const ai of arcIndexes) {
    const decoded = ai < 0 ? decodeArc(topo, ~ai).reverse() : decodeArc(topo, ai);
    if (pts.length) decoded.shift();
    pts.push(...decoded);
  }
  return pts;
}

export function latLngToVec3(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

let cache: Promise<Float32Array> | null = null;

/** Returns lat/lng pairs (flat array) for `count` land points. */
export function loadLandPoints(count: number): Promise<Float32Array> {
  if (cache) return cache.then((all) => (all.length / 2 > count ? all.slice(0, count * 2) : all));
  cache = (async () => {
    const res = await fetch('/data/land-110m.json');
    const topo = (await res.json()) as Topology;
    const land = topo.objects.land;
    const W = 2048;
    const H = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    const toPx = (lng: number, lat: number) => [((lng + 180) / 360) * W, ((90 - lat) / 180) * H] as const;
    const drawPoly = (rings: number[][]) => {
      ctx.beginPath();
      for (const r of rings) {
        const pts = ring(topo, r);
        pts.forEach(([lng, lat], i) => {
          const [x, y] = toPx(lng, lat);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
      }
      ctx.fill('evenodd');
    };
    for (const g of land.geometries || []) {
      if (g.type === 'Polygon') drawPoly(g.arcs);
      else if (g.type === 'MultiPolygon') g.arcs.forEach((p: number[][]) => drawPoly(p));
    }
    const img = ctx.getImageData(0, 0, W, H).data;
    // Sample with cos(lat) weighting so density is uniform on the sphere.
    const target = 40000;
    const out: number[] = [];
    let guard = 0;
    while (out.length / 2 < target && guard++ < target * 12) {
      const u = Math.random();
      const v = Math.random();
      const lat = (Math.asin(2 * v - 1) * 180) / Math.PI; // uniform on sphere
      const lng = u * 360 - 180;
      const x = Math.floor(((lng + 180) / 360) * W);
      const y = Math.floor(((90 - lat) / 180) * H);
      if (img[(y * W + x) * 4] > 128) out.push(lat, lng);
    }
    return new Float32Array(out);
  })();
  return cache.then((all) => (all.length / 2 > count ? all.slice(0, count * 2) : all));
}
