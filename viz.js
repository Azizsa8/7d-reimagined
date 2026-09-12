/* 7D International — discipline illustrations.
 *
 * One canvas per discipline, each a small running simulation rather than a looping
 * graphic: a masterplan that surveys and builds itself, a phosphor radar with real
 * persistence, a market walk, a force-directed network, a programme board on its
 * critical path, a tracking solar array, and a sorting line with physics. Everything
 * is drawn from the site's own palette, so nothing is licensed, nothing is stock, and
 * no two viewings are identical.
 *
 * Only the cards on screen tick; the rest are frozen, and prefers-reduced-motion
 * gets a single composed frame.
 */

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const C = {
  brass: '#E0A94A', brassDim: 'rgba(224,169,74,.42)', brassFaint: 'rgba(224,169,74,.14)',
  sand: '#C8AA7C', horizon: '#E9B27A', teal: '#2FA98B', tealDim: 'rgba(47,169,139,.45)',
  ink: '#F4F1EA', dim: '#AFA898', faint: 'rgba(244,241,234,.28)', hair: 'rgba(244,241,234,.09)',
  ground: '#0D1116', deep: '#080A0E'
};
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => 1 - Math.pow(1 - t, 3);

/* a deterministic wobble, so scenes breathe without jitter */
function noise1(x) { return Math.sin(x) * .5 + Math.sin(x * 2.13 + 1.7) * .3 + Math.sin(x * 4.7 + .4) * .2; }

function mono(ctx, size, weight = 400) { ctx.font = `${weight} ${size}px "IBM Plex Mono", ui-monospace, monospace`; }
function label(ctx, text, x, y, size = 9, color = C.faint, align = 'left') {
  mono(ctx, size); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.save(); ctx.letterSpacing = '1.4px'; ctx.fillText(text, x, y); ctx.restore();
}
function hairGrid(ctx, W, H, step = 26) {
  ctx.strokeStyle = C.hair; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = step; x < W; x += step) { ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, H); }
  for (let y = step; y < H; y += step) { ctx.moveTo(0, y + .5); ctx.lineTo(W, y + .5); }
  ctx.stroke();
}
function glowDot(ctx, x, y, r, color, alpha = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
  g.addColorStop(0, color); g.addColorStop(.35, color); g.addColorStop(1, 'transparent');
  ctx.globalAlpha = alpha * .5; ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r * 4, 0, TAU); ctx.fill();
  ctx.globalAlpha = alpha; ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
}

/* ===================================================================
   01 · Architecture, Landscape & Waterscape
   An axonometric plot that surveys, then builds: contour field, plot
   footprints extruding, a basin with propagating ripples, planting.
   =================================================================== */
function masterplan(W, H) {
  const cx = W * .5, cy = H * .58, s = Math.min(W, H) / 300;
  const iso = (x, y, z = 0) => [cx + (x - y) * .86 * s, cy + (x + y) * .5 * s - z * s];
  const plots = [
    {x: -74, y: -40, w: 52, d: 34, h: 30}, {x: -14, y: -52, w: 34, d: 30, h: 54},
    {x: 26, y: -34, w: 40, d: 28, h: 22}, {x: -80, y: 12, w: 36, d: 30, h: 16},
    {x: 34, y: 16, w: 44, d: 34, h: 38}, {x: -28, y: 34, w: 30, d: 26, h: 12}
  ].map((p, i) => ({...p, t: 0, delay: .9 + i * .42}));
  // a small spring grid for the water, so ripples actually travel
  const GW = 22, GD = 14, cur = new Float32Array(GW * GD), prev = new Float32Array(GW * GD);
  const basin = {x: -10, y: -6, w: 74, d: 46};
  const trees = Array.from({length: 26}, (_, i) => ({
    x: rand(-105, 95), y: rand(-70, 62), r: rand(2.2, 4), delay: 3 + i * .1
  })).filter(t => !(t.x > basin.x - 12 && t.x < basin.x + basin.w + 12 && t.y > basin.y - 12 && t.y < basin.y + basin.d + 12));
  let drop = 0;

  return {
    draw(ctx, t) {
      ctx.clearRect(0, 0, W, H);
      hairGrid(ctx, W, H, 24);

      // contour field, drawn in as the survey lands
      const cp = clamp(t / 1.1, 0, 1);
      ctx.lineWidth = 1;
      for (let k = 0; k < 7; k++) {
        ctx.strokeStyle = k % 2 ? 'rgba(200,170,124,.16)' : 'rgba(200,170,124,.09)';
        ctx.beginPath();
        const steps = 60, upto = Math.floor(steps * cp);
        for (let i = 0; i <= upto; i++) {
          const u = i / steps, gx = lerp(-120, 110, u);
          const gy = -80 + k * 26 + noise1(u * 4 + k * .8) * 11;
          const [px, py] = iso(gx, gy);
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
      }

      // basin
      if (t > .6) {
        const a = clamp((t - .6) / .8, 0, 1);
        ctx.globalAlpha = a;
        ctx.beginPath();
        const c1 = iso(basin.x, basin.y), c2 = iso(basin.x + basin.w, basin.y),
              c3 = iso(basin.x + basin.w, basin.y + basin.d), c4 = iso(basin.x, basin.y + basin.d);
        ctx.moveTo(...c1); ctx.lineTo(...c2); ctx.lineTo(...c3); ctx.lineTo(...c4); ctx.closePath();
        ctx.fillStyle = 'rgba(10,22,28,.92)'; ctx.fill();
        ctx.strokeStyle = 'rgba(200,170,124,.5)'; ctx.lineWidth = 1.2; ctx.stroke();

        // ripples: one spring step per frame, a new drop every couple of seconds
        if (t - drop > 2.1) { drop = t; const i = (2 + (Math.random() * (GD - 4) | 0)) * GW + (2 + (Math.random() * (GW - 4) | 0)); cur[i] = 1; }
        for (let y = 1; y < GD - 1; y++) for (let x = 1; x < GW - 1; x++) {
          const i = y * GW + x;
          const v = (cur[i - 1] + cur[i + 1] + cur[i - GW] + cur[i + GW]) * .5 - prev[i];
          prev[i] = v * .976;
        }
        cur.set(prev); prev.set(cur);
        ctx.globalAlpha = a * .85;
        for (let y = 1; y < GD - 1; y++) for (let x = 1; x < GW - 1; x++) {
          const v = cur[y * GW + x]; if (Math.abs(v) < .012) continue;
          const gx = basin.x + (x / (GW - 1)) * basin.w, gy = basin.y + (y / (GD - 1)) * basin.d;
          const [px, py] = iso(gx, gy, v * 5);
          ctx.fillStyle = v > 0 ? 'rgba(180,232,214,.85)' : 'rgba(47,169,139,.5)';
          ctx.fillRect(px - 1, py - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      // plots extruding
      for (const p of plots) {
        p.t = clamp((t - p.delay) / 1.1, 0, 1);
        if (p.t <= 0) continue;
        const e = ease(p.t), z = p.h * e;
        const a = iso(p.x, p.y), b = iso(p.x + p.w, p.y), c = iso(p.x + p.w, p.y + p.d), d = iso(p.x, p.y + p.d);
        const at = iso(p.x, p.y, z), bt = iso(p.x + p.w, p.y, z), ct = iso(p.x + p.w, p.y + p.d, z), dt = iso(p.x, p.y + p.d, z);
        ctx.beginPath(); ctx.moveTo(...d); ctx.lineTo(...c); ctx.lineTo(...ct); ctx.lineTo(...dt); ctx.closePath();
        ctx.fillStyle = 'rgba(122,106,80,.82)'; ctx.fill();
        ctx.beginPath(); ctx.moveTo(...c); ctx.lineTo(...b); ctx.lineTo(...bt); ctx.lineTo(...ct); ctx.closePath();
        ctx.fillStyle = 'rgba(88,78,60,.85)'; ctx.fill();
        ctx.beginPath(); ctx.moveTo(...at); ctx.lineTo(...bt); ctx.lineTo(...ct); ctx.lineTo(...dt); ctx.closePath();
        ctx.fillStyle = p.h > 30 ? 'rgba(224,169,74,.5)' : 'rgba(200,182,148,.72)'; ctx.fill();
        ctx.strokeStyle = 'rgba(244,241,234,.35)'; ctx.lineWidth = 1; ctx.stroke();
        if (p.t > .9 && p.h > 30) { const [lx, ly] = iso(p.x + p.w / 2, p.y + p.d / 2, z); glowDot(ctx, lx, ly, 1.6, C.brass, .9); }
      }

      // planting
      for (const tr of trees) {
        const a = clamp((t - tr.delay) / .6, 0, 1); if (a <= 0) continue;
        const [px, py] = iso(tr.x, tr.y);
        ctx.globalAlpha = a; ctx.fillStyle = 'rgba(46,107,69,.9)';
        ctx.beginPath(); ctx.arc(px, py - tr.r, tr.r * a, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }

      // survey crosshair sweeping the site
      const sx = (t * .22) % 1, [hx, hy] = iso(lerp(-120, 110, sx), lerp(-80, 70, (noise1(t * .5) + 1) / 2));
      ctx.strokeStyle = C.brassDim; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hx - 9, hy); ctx.lineTo(hx + 9, hy); ctx.moveTo(hx, hy - 9); ctx.lineTo(hx, hy + 9); ctx.stroke();
      ctx.strokeStyle = C.brass; ctx.beginPath(); ctx.arc(hx, hy, 4, 0, TAU); ctx.stroke();

      label(ctx, 'MASTERPLAN', 14, 20, 9, C.brassDim);
      label(ctx, `PLOTS ${plots.filter(p => p.t > .99).length}/${plots.length}`, W - 14, 20, 9, C.faint, 'right');
      label(ctx, 'SCALE 1:2000', 14, H - 12, 8.5, C.faint);
    }
  };
}

/* ===================================================================
   02 · Defense, Aerospace & Aviation
   A phosphor radar: the frame is faded rather than cleared, so the
   sweep leaves a real decaying trail and contacts bloom and die.
   =================================================================== */
function radar(W, H) {
  const cx = W * .5, cy = H * .52, R = Math.min(W, H) * .42;
  const contacts = Array.from({length: 7}, () => ({
    a: rand(0, TAU), r: rand(.25, .95), seen: -9, drift: rand(-.12, .12), id: (1000 + Math.random() * 8999) | 0
  }));
  const track = {t: 0, trail: []};
  let last = 0;
  return {
    persist: true,
    draw(ctx, t, dt) {
      // phosphor decay
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,.055)';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';

      // static furniture, redrawn each frame so it never fades away
      ctx.strokeStyle = 'rgba(47,169,139,.22)'; ctx.lineWidth = 1;
      for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(cx, cy, R * k / 3, 0, TAU); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(47,169,139,.12)';
      ctx.beginPath();
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI; ctx.moveTo(cx - Math.cos(a) * R, cy - Math.sin(a) * R); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); }
      ctx.stroke();
      for (let k = 1; k <= 3; k++) label(ctx, `${k * 24}`, cx + 4, cy - R * k / 3 - 3, 8, 'rgba(47,169,139,.45)');

      // the sweep
      const sweep = (t * .55) % 1, a0 = sweep * TAU;
      const g = ctx.createConicGradient ? ctx.createConicGradient(a0 - .9, cx, cy) : null;
      if (g) {
        g.addColorStop(0, 'rgba(47,169,139,0)'); g.addColorStop(.22, 'rgba(47,169,139,.30)');
        g.addColorStop(.25, 'rgba(120,230,200,.5)'); g.addColorStop(.2501, 'rgba(47,169,139,0)');
        g.addColorStop(1, 'rgba(47,169,139,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(150,240,212,.85)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R); ctx.stroke();

      // contacts paint when the beam crosses them, then decay with the phosphor
      for (const c of contacts) {
        c.a += c.drift * dt;
        const ca = ((c.a % TAU) + TAU) % TAU, sa = ((a0 % TAU) + TAU) % TAU;
        if (Math.abs(ca - sa) < .05 || Math.abs(ca - sa) > TAU - .05) c.seen = t;
        if (t - c.seen < 2.6) {
          const x = cx + Math.cos(c.a) * R * c.r, y = cy + Math.sin(c.a) * R * c.r;
          const k = 1 - (t - c.seen) / 2.6;
          glowDot(ctx, x, y, 2.3, '#8FF0D0', k);
          if (k > .55) { label(ctx, `TRK ${c.id}`, x + 8, y + 3, 7.5, `rgba(143,240,208,${k})`); }
        }
      }

      // one aircraft flying a real vector, with a trail
      track.t = (track.t + dt * .08) % 1;
      const p = track.t, ax = lerp(W * .06, W * .96, p), ay = cy + Math.sin(p * 3.1) * R * .62;
      track.trail.push([ax, ay]); if (track.trail.length > 46) track.trail.shift();
      ctx.strokeStyle = 'rgba(224,169,74,.5)'; ctx.lineWidth = 1.2; ctx.beginPath();
      track.trail.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      const ang = Math.atan2(ay - (track.trail[Math.max(0, track.trail.length - 6)]?.[1] ?? ay), ax - (track.trail[Math.max(0, track.trail.length - 6)]?.[0] ?? ax - 1));
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang);
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, 4); ctx.lineTo(-2, 0); ctx.lineTo(-5, -4); ctx.closePath(); ctx.fill();
      ctx.restore();
      glowDot(ctx, ax, ay, 1.2, C.brass, .8);

      // readout strip
      if (t - last > .5) last = t;
      ctx.fillStyle = 'rgba(10,12,16,.55)'; ctx.fillRect(0, H - 22, W, 22);
      label(ctx, 'SURVEILLANCE · LOGISTICS · IT', 14, H - 8, 8.5, 'rgba(47,169,139,.65)');
      label(ctx, `BRG ${((a0 / TAU * 360) | 0).toString().padStart(3, '0')}°`, W - 14, H - 8, 8.5, C.faint, 'right');
    }
  };
}

/* ===================================================================
   03 · Finance & Banking
   A market walk: candles, a moving average, volume, a rescaling axis.
   =================================================================== */
function market(W, H) {
  const pad = {l: 16, r: 46, t: 26, b: 34};
  const N = 34; let price = 100, bars = [];
  const step = () => {
    price = Math.max(40, price * (1 + rand(-.035, .042)));
    const o = price, c = Math.max(40, o * (1 + rand(-.03, .034))), hi = Math.max(o, c) * (1 + rand(0, .018)), lo = Math.min(o, c) * (1 - rand(0, .018));
    price = c;
    bars.push({o, c, hi, lo, v: rand(.25, 1), born: 0});
    if (bars.length > N) bars.shift();
  };
  for (let i = 0; i < N; i++) step();
  let acc = 0, shown = 0;
  return {
    draw(ctx, t, dt) {
      ctx.clearRect(0, 0, W, H);
      acc += dt; if (acc > .62) { acc = 0; step(); }
      const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
      let lo = Infinity, hi = -Infinity;
      bars.forEach(b => { lo = Math.min(lo, b.lo); hi = Math.max(hi, b.hi); });
      const pad2 = (hi - lo) * .12; lo -= pad2; hi += pad2;
      const Y = v => pad.t + ih - ((v - lo) / (hi - lo)) * ih;

      ctx.strokeStyle = C.hair; ctx.lineWidth = 1;
      for (let k = 0; k <= 4; k++) {
        const y = pad.t + ih * k / 4;
        ctx.beginPath(); ctx.moveTo(pad.l, y + .5); ctx.lineTo(pad.l + iw, y + .5); ctx.stroke();
        label(ctx, (lo + (hi - lo) * (1 - k / 4)).toFixed(0), pad.l + iw + 8, y + 3, 8.5, C.faint);
      }

      const bw = iw / N;
      bars.forEach((b, i) => {
        const x = pad.l + i * bw + bw * .5, up = b.c >= b.o;
        ctx.fillStyle = up ? 'rgba(47,169,139,.2)' : 'rgba(224,169,74,.14)';
        ctx.fillRect(pad.l + i * bw + 1, pad.t + ih + 4, bw - 2, (pad.b - 10) * b.v);
        ctx.strokeStyle = up ? C.teal : C.brass; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, Y(b.hi)); ctx.lineTo(x, Y(b.lo)); ctx.stroke();
        const y0 = Y(Math.max(b.o, b.c)), y1 = Y(Math.min(b.o, b.c));
        ctx.fillStyle = up ? 'rgba(47,169,139,.75)' : 'rgba(10,12,16,1)';
        ctx.fillRect(x - bw * .3, y0, bw * .6, Math.max(1.5, y1 - y0));
        ctx.strokeRect(x - bw * .3 + .5, y0 + .5, bw * .6 - 1, Math.max(1, y1 - y0) - 1);
      });

      // moving average
      ctx.strokeStyle = C.horizon; ctx.lineWidth = 1.8; ctx.beginPath();
      for (let i = 4; i < bars.length; i++) {
        const m = (bars[i].c + bars[i - 1].c + bars[i - 2].c + bars[i - 3].c + bars[i - 4].c) / 5;
        const x = pad.l + i * bw + bw * .5;
        i === 4 ? ctx.moveTo(x, Y(m)) : ctx.lineTo(x, Y(m));
      }
      ctx.stroke();
      const lastBar = bars[bars.length - 1];
      glowDot(ctx, pad.l + (bars.length - 1) * bw + bw * .5, Y(lastBar.c), 2.4, C.brass, 1);

      // headline number, eased towards the live price
      shown = lerp(shown || lastBar.c, lastBar.c, .08);
      const first = bars[0].o, pct = ((lastBar.c / first - 1) * 100);
      label(ctx, 'PORTFOLIO INDEX', 14, 18, 9, C.brassDim);
      ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
      mono(ctx, 15, 500); ctx.fillStyle = pct >= 0 ? C.teal : C.brass;
      ctx.fillText(`${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, W - 14, 20);
      label(ctx, `${shown.toFixed(2)}`, W - 14, H - 10, 9, C.dim, 'right');
      label(ctx, 'VOLUME', 14, H - 10, 8.5, C.faint);
    }
  };
}

/* ===================================================================
   04 · Technology
   A force-directed graph that genuinely settles, with packets in
   flight and new nodes joining so the layout keeps rearranging.
   =================================================================== */
function network(W, H) {
  const nodes = [], edges = [], packets = [];
  const add = (hub = false) => {
    const n = {x: rand(W * .2, W * .8), y: rand(H * .2, H * .8), vx: 0, vy: 0, hub, born: 0, r: hub ? 10 : rand(4.4, 6.6)};
    nodes.push(n);
    if (nodes.length > 1) {
      const pool = [...nodes].slice(0, -1).sort(() => Math.random() - .5).slice(0, hub ? 3 : 1 + (Math.random() * 2 | 0));
      pool.forEach(o => edges.push({a: n, b: o, len: rand(64, 104)}));
    }
    return n;
  };
  add(true); for (let i = 0; i < 9; i++) add();
  let acc = 0, pacc = 0;
  return {
    draw(ctx, t, dt) {
      ctx.clearRect(0, 0, W, H);
      hairGrid(ctx, W, H, 30);

      // physics, integrated against real time so the layout settles instead of collapsing
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || .01;
        const f = 62000 / (d * d + 220); dx /= d; dy /= d;
        a.vx -= dx * f * dt; a.vy -= dy * f * dt; b.vx += dx * f * dt; b.vy += dy * f * dt;
      }
      for (const e of edges) {
        let dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, d = Math.hypot(dx, dy) || .01;
        const f = (d - e.len) * 5.5; dx /= d; dy /= d;
        e.a.vx += dx * f * dt; e.a.vy += dy * f * dt; e.b.vx -= dx * f * dt; e.b.vy -= dy * f * dt;
      }
      const cx = W / 2, cy = H / 2;
      const damp = Math.pow(.02, dt);
      for (const n of nodes) {
        n.vx += (cx - n.x) * (n.hub ? 7 : 1.1) * dt; n.vy += (cy - n.y) * (n.hub ? 7 : 1.1) * dt;
        n.vx *= damp; n.vy *= damp;
        n.x = clamp(n.x + n.vx * dt, 22, W - 22); n.y = clamp(n.y + n.vy * dt, 26, H - 30);
        n.born = Math.min(1, n.born + dt * 1.8);
      }

      // churn: a node joins, the oldest non-hub leaves
      acc += dt;
      if (acc > 3.4) {
        acc = 0;
        if (nodes.length > 13) {
          const victim = nodes.find(n => !n.hub);
          if (victim) {
            for (let i = edges.length - 1; i >= 0; i--) if (edges[i].a === victim || edges[i].b === victim) edges.splice(i, 1);
            nodes.splice(nodes.indexOf(victim), 1);
          }
        }
        add();
      }

      // edges
      for (const e of edges) {
        ctx.strokeStyle = 'rgba(224,169,74,.42)'; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(e.a.x, e.a.y); ctx.lineTo(e.b.x, e.b.y); ctx.stroke();
      }

      // packets
      pacc += dt;
      if (pacc > .42 && edges.length) { pacc = 0; const e = edges[Math.random() * edges.length | 0]; packets.push({e, p: 0, s: rand(.5, 1.1), dir: Math.random() < .5 ? 1 : -1}); }
      for (let i = packets.length - 1; i >= 0; i--) {
        const k = packets[i]; k.p += dt * k.s;
        if (k.p >= 1) { packets.splice(i, 1); continue; }
        const u = k.dir > 0 ? k.p : 1 - k.p;
        const x = lerp(k.e.a.x, k.e.b.x, u), y = lerp(k.e.a.y, k.e.b.y, u);
        glowDot(ctx, x, y, 1.9, '#F4F1EA', 1 - Math.abs(.5 - k.p) * .5);
      }

      // nodes
      for (const n of nodes) {
        const s = ease(n.born);
        if (n.hub) {
          ctx.strokeStyle = C.brass; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r * s + 5 + Math.sin(t * 2) * 1.6, 0, TAU); ctx.stroke();
          ctx.fillStyle = 'rgba(224,169,74,.14)'; ctx.beginPath(); ctx.arc(n.x, n.y, n.r * s, 0, TAU); ctx.fill();
          glowDot(ctx, n.x, n.y, 3.4 * s, C.brass, 1);
        } else {
          ctx.fillStyle = C.ground; ctx.strokeStyle = 'rgba(47,169,139,.8)'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r * s, 0, TAU); ctx.fill(); ctx.stroke();
        }
      }

      label(ctx, 'BUSINESS SYSTEMS', 14, 18, 9, C.brassDim);
      label(ctx, `${nodes.length} NODES · ${edges.length} LINKS`, W - 14, 18, 9, C.faint, 'right');
      label(ctx, 'ONLINE', 14, H - 10, 8.5, C.teal);
      glowDot(ctx, W - 18, H - 13, 2.2, C.teal, .6 + Math.sin(t * 3) * .4);
    }
  };
}

/* ===================================================================
   05 · Private Equity
   A programme board: dependency chain drawing along the critical
   path, a today-line sweeping, milestones lighting, spend S-curve.
   =================================================================== */
function programme(W, H) {
  const pad = {l: 62, r: 18, t: 46, b: 48};
  const tasks = [
    {n: 'FEAS', s: .00, e: .22}, {n: 'DESIGN', s: .18, e: .46},
    {n: 'PROCURE', s: .40, e: .62}, {n: 'BUILD', s: .56, e: .88}, {n: 'COMMISSION', s: .84, e: 1}
  ];
  return {
    draw(ctx, t) {
      ctx.clearRect(0, 0, W, H);
      const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b, rowH = ih / tasks.length;
      const now = (t * .105) % 1.18;

      ctx.strokeStyle = C.hair;
      for (let k = 0; k <= 4; k++) { const x = pad.l + iw * k / 4; ctx.beginPath(); ctx.moveTo(x + .5, pad.t - 6); ctx.lineTo(x + .5, pad.t + ih); ctx.stroke();
        label(ctx, `Q${k + 1}`, x + 4, pad.t - 10, 8, C.faint); }

      tasks.forEach((k, i) => {
        const y = pad.t + i * rowH + rowH * .5;
        const x0 = pad.l + iw * k.s, x1 = pad.l + iw * k.e;
        const prog = clamp((now - k.s) / (k.e - k.s), 0, 1);
        label(ctx, k.n, 10, y + 3, 8, prog > 0 ? C.ink : C.faint);
        ctx.fillStyle = 'rgba(244,241,234,.09)';
        ctx.beginPath(); ctx.roundRect(x0, y - 6, x1 - x0, 12, 6); ctx.fill();
        ctx.strokeStyle = 'rgba(244,241,234,.16)'; ctx.lineWidth = 1; ctx.stroke();
        if (prog > 0) {
          const g = ctx.createLinearGradient(x0, 0, x1, 0);
          g.addColorStop(0, 'rgba(168,117,42,.95)'); g.addColorStop(1, 'rgba(224,169,74,.95)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.roundRect(x0, y - 6, (x1 - x0) * prog, 12, 6); ctx.fill();
        }
        // dependency arrow to the next task
        if (i < tasks.length - 1) {
          const ny = pad.t + (i + 1) * rowH + rowH * .5, nx = pad.l + iw * tasks[i + 1].s;
          ctx.strokeStyle = prog > .6 ? C.brassDim : 'rgba(244,241,234,.12)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x1 + 8, y); ctx.lineTo(x1 + 8, ny); ctx.lineTo(nx, ny); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(nx - 4, ny - 3); ctx.lineTo(nx - 4, ny + 3); ctx.closePath();
          ctx.fillStyle = prog > .6 ? C.brass : 'rgba(244,241,234,.2)'; ctx.fill();
        }
        // milestone at completion
        const done = now >= k.e;
        ctx.save(); ctx.translate(x1, y); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = done ? C.ink : 'transparent'; ctx.strokeStyle = done ? C.ink : 'rgba(244,241,234,.3)'; ctx.lineWidth = 1;
        ctx.fillRect(-3.4, -3.4, 6.8, 6.8); ctx.strokeRect(-3.4, -3.4, 6.8, 6.8); ctx.restore();
        if (done) glowDot(ctx, x1, y, 1.4, C.ink, .5);
      });

      // spend S-curve
      const cy0 = pad.t + ih + 12, ch = pad.b - 22;
      ctx.strokeStyle = 'rgba(47,169,139,.75)'; ctx.lineWidth = 1.6; ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const u = i / 60; if (u > clamp(now, 0, 1)) break;
        const s = 1 / (1 + Math.exp(-(u - .5) * 9));
        const x = pad.l + iw * u, y = cy0 + ch - s * ch;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();

      // today
      if (now > 0 && now < 1.02) {
        const x = pad.l + iw * clamp(now, 0, 1);
        ctx.strokeStyle = C.brass; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(x, pad.t - 8); ctx.lineTo(x, cy0 + ch); ctx.stroke(); ctx.setLineDash([]);
        glowDot(ctx, x, pad.t - 10, 2, C.brass, 1);
      }
      label(ctx, 'PROGRAMME', 10, 18, 9, C.brassDim);
      ctx.textAlign = 'right'; mono(ctx, 13, 500); ctx.fillStyle = C.brass;
      ctx.fillText(`${(clamp(now, 0, 1) * 100) | 0}%`, W - 14, 20);
      label(ctx, 'CUMULATIVE SPEND', 10, H - 8, 8.5, 'rgba(47,169,139,.6)');
    }
  };
}

/* ===================================================================
   06 · Utilities & Alternative Energy
   A day: the sun crosses, the array tracks it, irradiance shades the
   panels, current runs the bus, the battery fills, output is plotted.
   =================================================================== */
function solar(W, H) {
  const groundY = H * .72;
  const panels = Array.from({length: 5}, (_, i) => ({x: W * (.18 + i * .16)}));
  const hist = [];
  const flow = Array.from({length: 26}, (_, i) => ({p: i / 26}));
  let batt = 0;
  return {
    draw(ctx, t, dt) {
      const day = (t * .06) % 1;                       // one loop is one day
      const sunA = Math.PI * day;
      const sx = W * .5 - Math.cos(sunA) * W * .42, sy = groundY - 44 - Math.sin(sunA) * (H * .44);
      const alt = Math.max(0, Math.sin(sunA));          // irradiance proxy

      // sky
      const g = ctx.createLinearGradient(0, 0, 0, groundY);
      g.addColorStop(0, `rgba(12,19,32,${1 - alt * .25})`);
      g.addColorStop(.7, `rgba(${30 + alt * 90 | 0},${36 + alt * 60 | 0},${54 + alt * 40 | 0},1)`);
      g.addColorStop(1, `rgba(${90 + alt * 130 | 0},${62 + alt * 70 | 0},${46 + alt * 30 | 0},1)`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, groundY);
      ctx.fillStyle = C.deep; ctx.fillRect(0, groundY, W, H - groundY);

      // sun and rays
      if (alt > 0) {
        glowDot(ctx, sx, sy, 7, '#FFD9A0', .35 + alt * .65);
        ctx.strokeStyle = `rgba(233,178,122,${.06 + alt * .16})`; ctx.lineWidth = 1;
        panels.forEach(p => { ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(p.x, groundY - 16); ctx.stroke(); });
      }

      // array: each panel rotates to face the sun
      panels.forEach(p => {
        const ang = clamp(Math.atan2(sy - (groundY - 18), sx - p.x) + Math.PI / 2, -1.15, 1.15);
        ctx.save(); ctx.translate(p.x, groundY - 16); ctx.rotate(ang);
        ctx.fillStyle = `rgba(${20 + alt * 60 | 0},${40 + alt * 90 | 0},${58 + alt * 80 | 0},.95)`;
        ctx.strokeStyle = 'rgba(244,241,234,.5)'; ctx.lineWidth = 1;
        ctx.fillRect(-19, -3, 38, 6); ctx.strokeRect(-19.5, -3.5, 39, 7);
        for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * 7.6, -3); ctx.lineTo(k * 7.6, 3); ctx.stroke(); }
        if (alt > .15) { ctx.fillStyle = `rgba(255,240,214,${alt * .22})`; ctx.fillRect(-19, -3, 38, 2); }
        ctx.restore();
        ctx.strokeStyle = 'rgba(200,182,148,.7)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(p.x, groundY - 16); ctx.lineTo(p.x, groundY); ctx.stroke();
      });

      // bus bar and current
      const busY = groundY + 16;
      ctx.strokeStyle = 'rgba(224,169,74,.35)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(W * .14, busY); ctx.lineTo(W * .8, busY); ctx.lineTo(W * .8, busY + 14); ctx.stroke();
      panels.forEach(p => { ctx.beginPath(); ctx.moveTo(p.x, groundY); ctx.lineTo(p.x, busY); ctx.stroke(); });
      flow.forEach(f => {
        f.p = (f.p + dt * (.06 + alt * .3)) % 1;
        if (alt < .04) return;
        const x = lerp(W * .14, W * .8, f.p);
        glowDot(ctx, x, busY, 1.4, '#FFE2AC', .3 + alt * .6);
      });

      // battery
      const bx = W * .8, by = busY + 14, bw = 26, bh = H - by - 18;
      batt = clamp(batt + (alt > .05 ? dt * alt * .06 : -dt * .014), 0, 1);
      ctx.strokeStyle = 'rgba(244,241,234,.55)'; ctx.lineWidth = 1.2;
      ctx.strokeRect(bx - bw / 2, by, bw, bh);
      ctx.fillStyle = 'rgba(47,169,139,.8)';
      ctx.fillRect(bx - bw / 2 + 2, by + bh - (bh - 4) * batt - 2, bw - 4, (bh - 4) * batt);
      label(ctx, `${(batt * 100) | 0}%`, bx, by - 5, 8, C.teal, 'center');

      // output plot
      hist.push(alt); if (hist.length > 120) hist.shift();
      ctx.strokeStyle = 'rgba(233,178,122,.8)'; ctx.lineWidth = 1.4; ctx.beginPath();
      hist.forEach((v, i) => { const x = 14 + (i / 120) * (W * .6), y = 34 - v * 18; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
      label(ctx, 'PV OUTPUT', 14, 50, 9, C.brassDim);
      ctx.textAlign = 'right'; mono(ctx, 14, 500); ctx.fillStyle = C.horizon;
      ctx.fillText(`${(alt * 420) | 0} kW`, W - 14, 24);
      label(ctx, day < .5 ? 'MORNING' : 'AFTERNOON', W - 14, 40, 8.5, C.faint, 'right');
    }
  };
}

/* ===================================================================
   07 · Environment, Sorting, Recycling & Bulk Handling
   A sorting line: parcels ride the belt, the sensor bar classifies
   them, a diverter kicks them into a chute, bins fill, counters tick.
   =================================================================== */
function sorting(W, H) {
  const beltY = H * .42, sensorX = W * .52, divX = W * .62;
  const chutes = [
    {x: W * .74, col: C.teal, n: 0, label: 'ORG'},
    {x: W * .85, col: C.brass, n: 0, label: 'MET'},
    {x: W * .96, col: '#8FA6BE', n: 0, label: 'PLA'}
  ];
  const items = []; let acc = 0, beltPhase = 0;
  const spawn = () => {
    const k = Math.random() * 3 | 0;
    items.push({x: -14, y: beltY - 7, vx: 46, vy: 0, k, s: rand(7, 11), rot: 0, spin: 0, state: 'belt', scanned: 0});
  };
  return {
    draw(ctx, t, dt) {
      ctx.clearRect(0, 0, W, H);
      hairGrid(ctx, W, H, 30);
      acc += dt; if (acc > 1.05) { acc = 0; spawn(); }
      beltPhase = (beltPhase + dt * 46) % 14;

      // belt
      ctx.fillStyle = 'rgba(244,241,234,.05)'; ctx.fillRect(0, beltY, divX + 8, 8);
      ctx.strokeStyle = 'rgba(244,241,234,.3)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, beltY + .5); ctx.lineTo(divX + 8, beltY + .5); ctx.moveTo(0, beltY + 8.5); ctx.lineTo(divX + 8, beltY + 8.5); ctx.stroke();
      ctx.strokeStyle = 'rgba(244,241,234,.16)';
      ctx.beginPath();
      for (let x = -14 + beltPhase; x < divX; x += 14) { ctx.moveTo(x, beltY + 1); ctx.lineTo(x + 5, beltY + 7); }
      ctx.stroke();
      [16, divX - 6].forEach(x => { ctx.strokeStyle = 'rgba(244,241,234,.4)'; ctx.beginPath(); ctx.arc(x, beltY + 4, 6, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, beltY + 4); ctx.lineTo(x + Math.cos(-beltPhase * .45) * 6, beltY + 4 + Math.sin(-beltPhase * .45) * 6); ctx.stroke(); });

      // sensor gantry
      ctx.strokeStyle = 'rgba(47,169,139,.55)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(sensorX, beltY - 44); ctx.lineTo(sensorX, beltY - 12); ctx.stroke();
      ctx.fillStyle = 'rgba(47,169,139,.14)';
      ctx.beginPath(); ctx.moveTo(sensorX - 9, beltY - 12); ctx.lineTo(sensorX + 9, beltY - 12); ctx.lineTo(sensorX + 2, beltY); ctx.lineTo(sensorX - 2, beltY); ctx.closePath(); ctx.fill();
      label(ctx, 'NIR', sensorX, beltY - 48, 7.5, 'rgba(47,169,139,.8)', 'center');

      // diverter arm
      const kicking = items.some(i => i.state === 'kick' && i.x < divX + 22);
      ctx.save(); ctx.translate(divX, beltY - 2); ctx.rotate(kicking ? -.5 : 0);
      ctx.strokeStyle = C.brass; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -20); ctx.stroke(); ctx.restore();

      // chutes and bins
      chutes.forEach(c => {
        ctx.strokeStyle = 'rgba(244,241,234,.22)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(divX + 6, beltY + 10); ctx.lineTo(c.x - 12, H * .66); ctx.stroke();
        const bx = c.x - 13, by = H * .66, bw = 26, bh = H * .26;
        ctx.strokeStyle = 'rgba(244,241,234,.4)'; ctx.strokeRect(bx, by, bw, bh);
        const fill = clamp(c.n / 8, 0, 1);
        ctx.fillStyle = c.col; ctx.globalAlpha = .55;
        ctx.fillRect(bx + 2, by + bh - (bh - 4) * fill - 2, bw - 4, (bh - 4) * fill);
        ctx.globalAlpha = 1;
        label(ctx, c.label, c.x, by - 6, 7.5, c.col, 'center');
        label(ctx, String(c.n).padStart(2, '0'), c.x, H - 8, 8.5, C.dim, 'center');
      });

      // items
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (it.state === 'belt') {
          it.x += it.vx * dt;
          if (it.x > sensorX - 2 && !it.scanned) { it.scanned = t; }
          if (it.x > divX) { it.state = 'kick'; const c = chutes[it.k]; it.vx = (c.x - it.x) * .9; it.vy = -46; it.spin = rand(-5, 5); }
        } else {
          it.x += it.vx * dt; it.vy += 300 * dt; it.y += it.vy * dt; it.rot += it.spin * dt;
          if (it.y > H * .66 + 6) { chutes[it.k].n = (chutes[it.k].n + 1) % 100; items.splice(i, 1); continue; }
        }
        if (it.scanned && t - it.scanned < .35) {
          ctx.strokeStyle = `rgba(47,169,139,${1 - (t - it.scanned) / .35})`; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(it.x, it.y + 4, 10 + (t - it.scanned) * 40, 0, TAU); ctx.stroke();
        }
        ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot);
        const col = chutes[it.k].col;
        ctx.fillStyle = it.scanned ? col : 'rgba(175,168,152,.85)';
        ctx.globalAlpha = it.scanned ? .85 : .6;
        ctx.fillRect(-it.s / 2, -it.s / 2, it.s, it.s);
        ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(244,241,234,.5)'; ctx.lineWidth = 1;
        ctx.strokeRect(-it.s / 2, -it.s / 2, it.s, it.s);
        ctx.restore();
      }

      // recycling loop mark
      const lx = 42, ly = H * .78, lr = 16;
      ctx.strokeStyle = C.teal; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(lx, ly, lr, t * .8, t * .8 + TAU * .78); ctx.stroke();
      const a2 = t * .8 + TAU * .78;
      ctx.beginPath(); ctx.moveTo(lx + Math.cos(a2) * lr, ly + Math.sin(a2) * lr);
      ctx.lineTo(lx + Math.cos(a2 - .3) * (lr - 6), ly + Math.sin(a2 - .3) * (lr - 6));
      ctx.lineTo(lx + Math.cos(a2 + .25) * (lr - 5), ly + Math.sin(a2 + .25) * (lr - 5));
      ctx.closePath(); ctx.fillStyle = C.teal; ctx.fill();

      const total = chutes.reduce((s, c) => s + c.n, 0);
      label(ctx, 'SORTING LINE', 14, 18, 9, C.brassDim);
      ctx.textAlign = 'right'; mono(ctx, 14, 500); ctx.fillStyle = C.teal;
      ctx.fillText(`${(total * 1.4).toFixed(0)} t/h`, W - 14, 20);
      label(ctx, 'RECOVERY', 14, H * .78 + 30, 8.5, C.faint);
    }
  };
}

const PAINTERS = {'01': masterplan, '02': radar, '03': market, '04': network, '05': programme, '06': solar, '07': sorting};

/* ---------- one ticker for every visible card ---------- */
const live = new Set();
let raf = 0, last = 0;
function tick(now) {
  // dt drives the physics, but the scene clock is wall time: a throttled or
  // backgrounded tab then resumes where the narrative actually is, instead of
  // replaying the opening in slow motion.
  const dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
  for (const v of live) {
    if (!v.t0) v.t0 = now - v.t * 1000;
    v.t = (now - v.t0) / 1000;
    try { v.scene.draw(v.ctx, v.t, dt); } catch {}
  }
  raf = live.size ? requestAnimationFrame(tick) : 0;
}
function start() { if (!raf && live.size) { last = performance.now(); raf = requestAnimationFrame(tick); } }

export function mountViz(host, key) {
  const make = PAINTERS[key]; if (!make) return null;
  const canvas = document.createElement('canvas');
  canvas.className = 'viz-canvas';
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const inst = {ctx, canvas, t: 0, t0: 0, scene: null, key};

  let lastW = 0, lastH = 0;
  const size = () => {
    const r = host.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const W = Math.max(120, Math.round(r.width)), H = Math.max(90, Math.round(r.height));
    if (W === lastW && H === lastH) return;
    lastW = W; lastH = H;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    inst.scene = make(W, H);
    inst.t = REDUCED ? 9 : 0; inst.t0 = 0;
    inst.scene.draw(ctx, inst.t, .016);
  };
  size();
  new ResizeObserver(() => size()).observe(host);

  mounted.add(inst);
  inst.host = host;
  sweep();
  return inst;
}

/* Which cards are on screen.
   IntersectionObserver is the cheap path, but it does not deliver in every embedded
   or backgrounded context, and a card that never receives a callback would sit frozen
   on its first frame. A rect check on scroll, on resize and on a slow interval is the
   guarantee; the observer just makes it prompt. */
const mounted = new Set();
function sweep() {
  if (REDUCED) return;
  for (const v of mounted) {
    const r = v.host.getBoundingClientRect();
    const on = r.bottom > -40 && r.top < innerHeight + 40 && r.width > 0;
    if (on) live.add(v); else live.delete(v);
  }
  start();
}
let sweepQueued = false;
const queueSweep = () => { if (sweepQueued) return; sweepQueued = true; requestAnimationFrame(() => { sweepQueued = false; sweep(); }); };
addEventListener('scroll', queueSweep, {passive: true});
addEventListener('resize', queueSweep);
addEventListener('visibilitychange', () => { if (!document.hidden) sweep(); });
setInterval(sweep, 900);
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(() => sweep(), {threshold: [0, .12, .5]});
  const attach = () => mounted.forEach(v => { if (!v._io) { v._io = 1; io.observe(v.host); } });
  setInterval(attach, 1200); attach();
}
Object.assign(window, {mountViz, vizLive: live});
/* the cards are rendered by the page script before this module evaluates, so pick up
   anything already in the DOM as well as anything rendered later */
document.querySelectorAll(".viz[data-viz]").forEach(v => { if (!v.querySelector("canvas")) mountViz(v, v.dataset.viz); });
dispatchEvent(new Event('viz-ready'));
