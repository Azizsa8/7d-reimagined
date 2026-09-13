import * as THREE from 'three';
import type { World, WorldCtx, CameraWish } from './World';
import { BRASS, TEAL, IVORY, SAND } from './World';
import type { AudioLevels } from '../../state/bus';
import type { Discipline } from '../../kb/types';
import { soundDesign } from '../audio/SoundDesign';

interface Instrument {
  d: Discipline;
  group: THREE.Group;
  angle: number;
  tick: (dt: number, t: number, focus: number) => void;
  dispose: () => void;
}

const lineMat = (c: THREE.Color, o = 0.9) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
const pointsMat = (c: THREE.Color, size: number) =>
  new THREE.PointsMaterial({ color: c, size, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });

/** "Seven instruments" — each discipline is a live generative object, not an icon. */
export class DisciplinesWorld implements World {
  readonly name = 'disciplines' as const;
  readonly group = new THREE.Group();
  private items: Instrument[] = [];
  private ctx: WorldCtx | null = null;
  private active: string | null = null;
  private time = 0;
  private opacity = 0;
  private opacityTarget = 1;
  private frame = 0;
  private proj = new THREE.Vector3();
  private orbit = new THREE.Group();

  constructor() {
    this.group.add(this.orbit);
  }

  private build(ctx: WorldCtx) {
    if (this.items.length) return;
    const list = [...ctx.kb.disciplines].sort((a, b) => a.order - b.order);
    list.forEach((d, i) => {
      const g = new THREE.Group();
      const inst = this.make(d.id, g);
      this.orbit.add(g);
      this.items.push({ d, group: g, angle: (i / list.length) * Math.PI * 2, ...inst });
    });
  }

  private make(id: string, g: THREE.Group): { tick: Instrument['tick']; dispose: () => void } {
    const disposables: Array<{ dispose: () => void }> = [];
    const keep = <T extends { dispose: () => void }>(x: T) => {
      disposables.push(x);
      return x;
    };
    const dispose = () => disposables.forEach((x) => x.dispose());

    switch (id) {
      case 'architecture': {
        // Wireframe massing assembling floor by floor; particle fountain in front; caustic ground.
        const floors: THREE.LineSegments[] = [];
        for (let f = 0; f < 6; f++) {
          const w = 0.34 - f * 0.035;
          const geo = keep(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 0.07, w)));
          const l = new THREE.LineSegments(geo, keep(lineMat(BRASS)));
          l.position.y = -0.2 + f * 0.075;
          g.add(l);
          floors.push(l);
        }
        const n = 260;
        const pos = new Float32Array(n * 3);
        const life = new Float32Array(n).map(() => Math.random());
        const geo = keep(new THREE.BufferGeometry());
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const pts = new THREE.Points(geo, keep(pointsMat(TEAL, 0.012)));
        pts.position.set(0, -0.2, 0.28);
        g.add(pts);
        const ground = new THREE.Mesh(keep(new THREE.CircleGeometry(0.42, 40)), keep(new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false })));
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.22;
        g.add(ground);
        return {
          dispose,
          tick: (dt, t, focus) => {
            floors.forEach((f, i) => {
              const target = Math.min(1, Math.max(0, (t * 0.9 - i * 0.35) % 6));
              f.scale.setScalar(THREE.MathUtils.lerp(f.scale.x, target > 0.2 ? 1 : 0.001, dt * 3));
              (f.material as THREE.LineBasicMaterial).opacity = 0.5 + focus * 0.5;
            });
            for (let i = 0; i < n; i++) {
              life[i] += dt * 0.8;
              if (life[i] > 1) life[i] = 0;
              const l = life[i];
              const a = i * 0.618 * Math.PI * 2;
              const r = l * 0.12;
              pos[i * 3] = Math.cos(a) * r;
              pos[i * 3 + 1] = l * 0.5 - l * l * 0.5;
              pos[i * 3 + 2] = Math.sin(a) * r;
            }
            geo.attributes.position.needsUpdate = true;
            ground.material.opacity = 0.06 + 0.05 * Math.sin(t * 2.2) + focus * 0.06;
          },
        };
      }
      case 'defense': {
        // Radar sweep over low-poly terrain with an arcing flight path and blinking contacts.
        const terrain = keep(new THREE.PlaneGeometry(0.7, 0.7, 10, 10));
        const p = terrain.attributes.position;
        for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 9) * Math.cos(p.getY(i) * 7) * 0.03);
        const mesh = new THREE.LineSegments(keep(new THREE.WireframeGeometry(terrain)), keep(lineMat(SAND, 0.25)));
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = -0.2;
        g.add(mesh);
        const sweep = new THREE.Mesh(keep(new THREE.RingGeometry(0.02, 0.34, 32, 1, 0, 0.5)), keep(new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.4, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })));
        sweep.rotation.x = -Math.PI / 2;
        sweep.position.y = -0.19;
        g.add(sweep);
        const arcPts: THREE.Vector3[] = [];
        for (let i = 0; i <= 40; i++) {
          const u = i / 40;
          arcPts.push(new THREE.Vector3(-0.32 + u * 0.64, -0.2 + Math.sin(u * Math.PI) * 0.32, -0.1 + u * 0.2));
        }
        const arc = new THREE.Line(keep(new THREE.BufferGeometry().setFromPoints(arcPts)), keep(lineMat(IVORY, 0.5)));
        g.add(arc);
        const contacts = [0.3, 0.8, 1.6].map((phase) => {
          const m = new THREE.Mesh(keep(new THREE.SphereGeometry(0.012, 8, 8)), keep(new THREE.MeshBasicMaterial({ color: BRASS, transparent: true })));
          m.position.set(Math.cos(phase * 4) * 0.2, -0.17, Math.sin(phase * 4) * 0.2);
          g.add(m);
          return { m, phase };
        });
        const plane = new THREE.Mesh(keep(new THREE.ConeGeometry(0.012, 0.04, 4)), keep(new THREE.MeshBasicMaterial({ color: IVORY })));
        plane.rotation.z = -Math.PI / 2;
        g.add(plane);
        return {
          dispose,
          tick: (dt, t) => {
            sweep.rotation.z = t * 1.4;
            contacts.forEach((c) => (c.m.material.opacity = 0.3 + 0.7 * Math.max(0, Math.sin(t * 3 + c.phase))));
            const u = (t * 0.12) % 1;
            plane.position.copy(arcPts[Math.floor(u * 40)]);
          },
        };
      }
      case 'finance': {
        // Streams of particles flowing between ledger nodes, settling into balanced columns.
        const nodes = [
          [-0.28, 0.18], [0.28, 0.18], [0, 0.3], [-0.28, -0.2], [0.28, -0.2], [0, -0.05],
        ].map(([x, y]) => new THREE.Vector3(x, y, 0));
        const lattice: THREE.Vector3[] = [];
        for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) if (nodes[i].distanceTo(nodes[j]) < 0.45) lattice.push(nodes[i], nodes[j]);
        g.add(new THREE.LineSegments(keep(new THREE.BufferGeometry().setFromPoints(lattice)), keep(lineMat(SAND, 0.3))));
        const n = 320;
        const pos = new Float32Array(n * 3);
        const seed = new Float32Array(n).map(() => Math.random());
        const geo = keep(new THREE.BufferGeometry());
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.add(new THREE.Points(geo, keep(pointsMat(BRASS, 0.01))));
        const cols = [-0.24, -0.12, 0, 0.12, 0.24].map((x) => {
          const m = new THREE.Mesh(keep(new THREE.BoxGeometry(0.06, 0.01, 0.06)), keep(new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.5 })));
          m.position.set(x, -0.3, 0.1);
          g.add(m);
          return m;
        });
        return {
          dispose,
          tick: (dt, t) => {
            for (let i = 0; i < n; i++) {
              const a = nodes[Math.floor(seed[i] * nodes.length)];
              const b = nodes[Math.floor((seed[i] * 7.3) % nodes.length)];
              const u = (t * (0.3 + seed[i] * 0.4) + seed[i]) % 1;
              pos[i * 3] = THREE.MathUtils.lerp(a.x, b.x, u);
              pos[i * 3 + 1] = THREE.MathUtils.lerp(a.y, b.y, u) + Math.sin(u * Math.PI) * 0.04;
              pos[i * 3 + 2] = 0.02 * Math.sin(t + seed[i] * 6);
            }
            geo.attributes.position.needsUpdate = true;
            cols.forEach((c, i) => {
              const h = 0.05 + 0.12 * (0.5 + 0.5 * Math.sin(t * 0.7 + i * 1.3));
              c.scale.y = h / 0.01;
              c.position.y = -0.3 + h / 2;
            });
          },
        };
      }
      case 'technology': {
        // Lattice tower emitting concentric rings that light up a mesh of base stations.
        const tower = new THREE.LineSegments(keep(new THREE.EdgesGeometry(new THREE.CylinderGeometry(0.02, 0.07, 0.5, 4, 5))), keep(lineMat(IVORY, 0.7)));
        tower.position.y = 0.02;
        g.add(tower);
        const rings = [0, 1, 2].map((i) => {
          const r = new THREE.Mesh(keep(new THREE.RingGeometry(0.05, 0.06, 40)), keep(new THREE.MeshBasicMaterial({ color: BRASS, transparent: true, opacity: 0.5, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })));
          r.rotation.x = -Math.PI / 2;
          r.position.y = -0.22;
          g.add(r);
          return { r, phase: i / 3 };
        });
        const stations = Array.from({ length: 9 }, (_, i) => {
          const a = (i / 9) * Math.PI * 2;
          const rad = 0.22 + (i % 3) * 0.07;
          const m = new THREE.Mesh(keep(new THREE.SphereGeometry(0.01, 6, 6)), keep(new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.3 })));
          m.position.set(Math.cos(a) * rad, -0.22, Math.sin(a) * rad);
          g.add(m);
          return { m, rad };
        });
        return {
          dispose,
          tick: (_dt, t) => {
            rings.forEach(({ r, phase }) => {
              const u = (t * 0.45 + phase) % 1;
              r.scale.setScalar(1 + u * 7);
              r.material.opacity = 0.5 * (1 - u);
              stations.forEach((s) => {
                if (Math.abs(s.rad - 0.06 * (1 + u * 7)) < 0.03) s.m.material.opacity = 1;
              });
            });
            stations.forEach((s) => (s.m.material.opacity = Math.max(0.25, s.m.material.opacity - 0.02)));
          },
        };
      }
      case 'private-equity': {
        // Gantt-like glowing bars in depth that extend, align and lock together.
        const bars = Array.from({ length: 6 }, (_, i) => {
          const m = new THREE.Mesh(keep(new THREE.BoxGeometry(1, 0.035, 0.035)), keep(new THREE.MeshBasicMaterial({ color: i % 2 ? BRASS : SAND, transparent: true, opacity: 0.85 })));
          m.position.set(-0.3, 0.22 - i * 0.085, -i * 0.06);
          g.add(m);
          return { m, len: 0.2 + ((i * 37) % 5) * 0.08, start: i * 0.35 };
        });
        const lock = new THREE.LineSegments(keep(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.66, 0.5, 0.36))), keep(lineMat(TEAL, 0.0)));
        lock.position.set(0, -0.0, -0.15);
        g.add(lock);
        return {
          dispose,
          tick: (dt, t) => {
            const cycle = (t * 0.25) % 1;
            bars.forEach((b) => {
              const u = THREE.MathUtils.clamp((cycle * 4 - b.start), 0, 1);
              const len = b.len * u + 0.01;
              b.m.scale.x = len;
              b.m.position.x = -0.3 + len / 2 + (b.start * 0.12);
            });
            lock.material.opacity = cycle > 0.8 ? 0.6 * Math.sin((cycle - 0.8) / 0.2 * Math.PI) : 0;
          },
        };
      }
      case 'energy': {
        // Sun-tracking panels rotating toward a moving light; pulses along a transmission line.
        const sun = new THREE.Mesh(keep(new THREE.SphereGeometry(0.03, 10, 10)), keep(new THREE.MeshBasicMaterial({ color: 0xfff0c0 })));
        g.add(sun);
        const panels = Array.from({ length: 9 }, (_, i) => {
          const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.11, 0.07)), keep(new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.55, side: THREE.DoubleSide })));
          m.position.set(-0.28 + (i % 3) * 0.28, -0.22, -0.14 + Math.floor(i / 3) * 0.14);
          g.add(m);
          return m;
        });
        const linePts = [new THREE.Vector3(-0.4, -0.05, 0.22), new THREE.Vector3(-0.1, 0.02, 0.22), new THREE.Vector3(0.15, -0.03, 0.22), new THREE.Vector3(0.42, 0.04, 0.22)];
        g.add(new THREE.Line(keep(new THREE.BufferGeometry().setFromPoints(linePts)), keep(lineMat(SAND, 0.5))));
        const curve = new THREE.CatmullRomCurve3(linePts);
        const pulses = [0, 0.5].map((p) => {
          const m = new THREE.Mesh(keep(new THREE.SphereGeometry(0.012, 8, 8)), keep(new THREE.MeshBasicMaterial({ color: BRASS })));
          g.add(m);
          return { m, p };
        });
        return {
          dispose,
          tick: (_dt, t) => {
            const a = t * 0.35;
            sun.position.set(Math.cos(a) * 0.42, 0.18 + Math.sin(a) * 0.14, Math.sin(a) * 0.2);
            panels.forEach((p) => p.lookAt(sun.position));
            pulses.forEach(({ m, p }) => m.position.copy(curve.getPoint((t * 0.4 + p) % 1)));
          },
        };
      }
      default: {
        // environment: mixed particles on a conveyor separating by colour, then a fractal branch growing in teal.
        const n = 240;
        const pos = new Float32Array(n * 3);
        const col = new Float32Array(n * 3);
        const kind = new Uint8Array(n).map(() => Math.floor(Math.random() * 3));
        const seed = new Float32Array(n).map(() => Math.random());
        const palette = [BRASS, IVORY, TEAL];
        for (let i = 0; i < n; i++) col.set([palette[kind[i]].r, palette[kind[i]].g, palette[kind[i]].b], i * 3);
        const geo = keep(new THREE.BufferGeometry());
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        g.add(new THREE.Points(geo, keep(new THREE.PointsMaterial({ size: 0.013, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }))));
        g.add(new THREE.Line(keep(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.4, -0.2, 0), new THREE.Vector3(0.1, -0.2, 0)])), keep(lineMat(SAND, 0.4))));
        // fractal branch
        const segs: THREE.Vector3[] = [];
        const grow = (p: THREE.Vector3, dir: THREE.Vector3, len: number, depth: number) => {
          if (depth === 0) return;
          const q = p.clone().add(dir.clone().multiplyScalar(len));
          segs.push(p, q);
          const l = dir.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), 0.55);
          const r = dir.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), -0.5);
          grow(q, l, len * 0.68, depth - 1);
          grow(q, r, len * 0.68, depth - 1);
        };
        grow(new THREE.Vector3(0.28, -0.25, 0), new THREE.Vector3(0, 1, 0), 0.16, 6);
        const branchGeo = keep(new THREE.BufferGeometry().setFromPoints(segs));
        branchGeo.setDrawRange(0, 0);
        g.add(new THREE.LineSegments(branchGeo, keep(lineMat(TEAL, 0.8))));
        return {
          dispose,
          tick: (_dt, t) => {
            for (let i = 0; i < n; i++) {
              const u = (t * 0.25 + seed[i]) % 1;
              const x = -0.4 + u * 0.5;
              const sorted = Math.max(0, (u - 0.6) / 0.4);
              const y = -0.2 + sorted * (kind[i] - 1) * 0.12 + Math.sin(u * 30 + seed[i]) * 0.006 * (1 - sorted);
              pos.set([x, y, (seed[i] - 0.5) * 0.06], i * 3);
            }
            geo.attributes.position.needsUpdate = true;
            branchGeo.setDrawRange(0, Math.floor(((t * 0.18) % 1) * segs.length));
          },
        };
      }
    }
  }

  enter(params: Record<string, any>, ctx: WorldCtx) {
    this.ctx = ctx;
    this.build(ctx);
    this.opacityTarget = 1;
    this.opacity = 0;
    this.focus(params.id ? String(params.id) : null, false);
  }

  refocus(params: Record<string, any>) {
    this.focus(params.id ? String(params.id) : null, true);
  }

  private focus(id: string | null, sound: boolean) {
    this.active = id;
    if (sound) soundDesign.glass();
    this.notify();
  }

  private notify() {
    if (!this.ctx) return;
    const lang = this.ctx.lang;
    const a = this.active ? this.items.find((i) => i.d.id === this.active) : null;
    const related = a ? this.ctx.kb.projects.filter((p) => p.disciplines.includes(a.d.id)).map((p) => ({ id: p.id, name: p.name[lang] })) : [];
    this.ctx.notify({
      items: this.items.map((i) => {
        i.group.getWorldPosition(this.proj);
        return { id: i.d.id, name: i.d.name[lang], x: this.proj.x / this.ctx!.viewHalfW, y: this.proj.y / this.ctx!.viewHalfH, active: i.d.id === this.active };
      }),
      focus: a ? { id: a.d.id, name: a.d.name[lang], summary: a.d.summary[lang], related } : null,
    });
  }

  cue(entityId: string, category: string) {
    if (category === 'discipline' && entityId !== this.active && this.items.some((i) => i.d.id === entityId)) this.focus(entityId, true);
  }

  exit() {
    this.opacityTarget = 0;
  }

  camera(): CameraWish {
    return { dolly: 0.96, target: new THREE.Vector3(0, 0, 0), exposure: 1 };
  }

  update(dt: number, _audio: AudioLevels) {
    this.time += dt;
    this.opacity += (this.opacityTarget - this.opacity) * Math.min(1, dt * 3);
    const hw = this.ctx?.viewHalfW || 1;
    const hh = this.ctx?.viewHalfH || 1;
    const portrait = hh > hw;
    const rx = Math.min(hw, 1.6) * (this.active ? 0.62 : 0.78);
    const ry = portrait ? hh * (this.active ? 0.16 : 0.3) : Math.min(hh, 1.2) * 0.6;
    const lift = portrait ? hh * (this.active ? 0.4 : 0.12) : hh * 0.08;
    const spin = this.ctx?.reduced ? 0 : this.time * 0.12;
    const others = this.items.filter((i) => i.d.id !== this.active);
    this.items.forEach((it) => {
      const isA = it.d.id === this.active;
      const focus = isA ? 1 : 0;
      let target: THREE.Vector3;
      let scale: number;
      if (isA) {
        target = new THREE.Vector3(portrait ? 0 : hw * 0.3, lift, 0.5);
        scale = portrait ? 2.2 : 2.6;
      } else if (this.active && portrait) {
        const k = others.indexOf(it);
        const u = others.length > 1 ? k / (others.length - 1) : 0.5;
        const x = (u - 0.5) * 2 * hw * 0.82;
        target = new THREE.Vector3(x, hh * 0.05 - Math.cos((u - 0.5) * Math.PI) * hh * 0.06, -0.4);
        scale = 0.42;
      } else {
        const a = it.angle + spin;
        target = new THREE.Vector3(Math.cos(a) * rx, Math.sin(a) * ry + lift, Math.sin(a) * 0.25 - 0.2);
        scale = this.active ? 0.45 : 0.85;
      }
      it.group.position.lerp(target, Math.min(1, dt * 3.5));
      const s = THREE.MathUtils.lerp(it.group.scale.x, scale, Math.min(1, dt * 3.5));
      it.group.scale.setScalar(s);
      it.group.rotation.y = this.ctx?.reduced ? 0 : this.time * 0.25;
      it.tick(dt, this.time, focus);
      it.group.traverse((o) => {
        const m = (o as any).material as THREE.Material | undefined;
        if (m && 'opacity' in m) (m as any).__base ??= (m as any).opacity;
      });
    });
    this.group.traverse((o) => {
      const m = (o as any).material as any;
      if (m && m.__base !== undefined) m.opacity = m.__base * this.opacity * (this.active && !this.isActiveChild(o) ? 0.55 : 1);
    });
    if (++this.frame % 3 === 0) this.notify();
  }

  private isActiveChild(o: THREE.Object3D): boolean {
    const a = this.items.find((i) => i.d.id === this.active);
    if (!a) return true;
    let p: THREE.Object3D | null = o;
    while (p) {
      if (p === a.group) return true;
      p = p.parent;
    }
    return false;
  }

  dispose() {
    this.items.forEach((i) => i.dispose());
  }
}
