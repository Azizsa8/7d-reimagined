import * as THREE from 'three';
import type { World, WorldCtx, CameraWish } from './World';
import { BRASS, IVORY, SAND } from './World';
import type { AudioLevels } from '../../state/bus';
import type { Person } from '../../kb/types';
import { soundDesign } from '../audio/SoundDesign';

interface Star {
  p: Person;
  pos: THREE.Vector3;
  star: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  halo: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  glow: THREE.Sprite;
}

/** "The people behind the work" — a slow constellation, one star per published leader. */
export class PeopleWorld implements World {
  readonly name = 'people' as const;
  readonly group = new THREE.Group();
  private stars: Star[] = [];
  private lines: THREE.LineSegments | null = null;
  private ctx: WorldCtx | null = null;
  private active: string | null = null;
  private time = 0;
  private opacity = 0;
  private opacityTarget = 1;
  private camTarget = new THREE.Vector3();
  private frame = 0;
  private proj = new THREE.Vector3();
  private spriteTex: THREE.Texture;

  constructor() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,240,210,1)');
    grd.addColorStop(0.35, 'rgba(224,169,74,0.55)');
    grd.addColorStop(1, 'rgba(224,169,74,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    this.spriteTex = new THREE.CanvasTexture(c);
  }

  private build(ctx: WorldCtx) {
    if (this.stars.length) return;
    const people = [...ctx.kb.people].sort((a, b) => a.rank - b.rank);
    const n = people.length;
    const portrait = ctx.viewHalfH > ctx.viewHalfW;
    const spreadX = Math.min(ctx.viewHalfW * 0.8, 1.7);
    const spreadY = portrait ? ctx.viewHalfH * 0.24 : Math.min(ctx.viewHalfH * 0.42, 1.2);
    const lift = portrait ? ctx.viewHalfH * 0.36 : ctx.viewHalfH * 0.1;
    people.forEach((p, i) => {
      // Golden-angle spiral so the constellation never looks like a grid.
      const a = i * 2.399 + 0.6;
      const r = 0.35 + 0.65 * Math.sqrt((i + 0.5) / n);
      const pos = new THREE.Vector3(Math.cos(a) * r * spreadX, Math.sin(a) * r * spreadY + lift, Math.sin(i * 1.7) * 0.35);
      const star = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 12), new THREE.MeshBasicMaterial({ color: IVORY, transparent: true }));
      star.position.copy(pos);
      const halo = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.068, 40), new THREE.MeshBasicMaterial({ color: BRASS, transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.position.copy(pos);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.spriteTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.position.copy(pos);
      glow.scale.setScalar(0.5);
      this.group.add(star, halo, glow);
      this.stars.push({ p, pos, star, halo, glow });
    });
    // Faint lines between people who share a function (board, executive, regional).
    const fn = (p: Person) => {
      const t = p.title.en.toLowerCase();
      if (/chairman|founder|chief executive/.test(t)) return 'exec';
      if (/regional|representative|coordinator|general manager/.test(t)) return 'regional';
      return 'studio';
    };
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < this.stars.length; i++)
      for (let j = i + 1; j < this.stars.length; j++)
        if (fn(this.stars[i].p) === fn(this.stars[j].p)) pts.push(this.stars[i].pos, this.stars[j].pos);
    const lg = new THREE.BufferGeometry().setFromPoints(pts);
    this.lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: SAND, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.group.add(this.lines);
  }

  enter(params: Record<string, any>, ctx: WorldCtx) {
    this.ctx = ctx;
    this.build(ctx);
    this.opacityTarget = 1;
    this.opacity = 0;
    this.focus(params.id ? String(params.id) : null, false);
    soundDesign.glass();
  }

  refocus(params: Record<string, any>) {
    this.focus(params.id ? String(params.id) : null, true);
  }

  private focus(id: string | null, sound: boolean) {
    this.active = id;
    const s = id ? this.stars.find((x) => x.p.id === id) : null;
    this.camTarget.copy(s ? new THREE.Vector3(s.pos.x * 0.25, 0, 0) : new THREE.Vector3(0, 0, 0));
    if (sound) soundDesign.glass();
    this.notify();
  }

  private notify() {
    if (!this.ctx) return;
    const lang = this.ctx.lang;
    const s = this.active ? this.stars.find((x) => x.p.id === this.active) : null;
    this.ctx.notify({
      people: this.stars.map((x) => {
        x.star.getWorldPosition(this.proj);
        return { id: x.p.id, name: x.p.name[lang], title: x.p.title[lang], x: this.proj.x / this.ctx!.viewHalfW, y: this.proj.y / this.ctx!.viewHalfH, active: x.p.id === this.active };
      }),
      focus: s ? { id: s.p.id, name: s.p.name[lang], nameOther: s.p.name[lang === 'ar' ? 'en' : 'ar'], title: s.p.title[lang], bio: s.p.bio[lang], portrait: s.p.portrait_url || null, initials: initials(s.p.name.en) } : null,
    });
  }

  cue(entityId: string, category: string) {
    if (category === 'person' && this.stars.some((s) => s.p.id === entityId) && entityId !== this.active) this.focus(entityId, true);
  }

  exit() {
    this.opacityTarget = 0;
  }

  camera(): CameraWish {
    return { dolly: 0.96, target: this.camTarget.clone(), exposure: 1 };
  }

  update(dt: number, _audio: AudioLevels) {
    this.time += dt;
    this.opacity += (this.opacityTarget - this.opacity) * Math.min(1, dt * 3);
    if (!this.ctx?.reduced) {
      this.group.rotation.z = Math.sin(this.time * 0.08) * 0.03;
      this.group.rotation.y = Math.cos(this.time * 0.06) * 0.05;
    }
    for (const s of this.stars) {
      const isA = s.p.id === this.active;
      const pulse = isA ? 1.2 + 0.2 * Math.sin(this.time * 3.5) : 0.9;
      s.halo.scale.setScalar(pulse);
      s.halo.material.opacity = (isA ? 0.95 : 0.35) * this.opacity;
      s.star.material.opacity = this.opacity;
      s.star.material.color.copy(isA ? BRASS : IVORY);
      (s.glow.material as THREE.SpriteMaterial).opacity = (isA ? 0.9 : 0.35) * this.opacity;
      s.glow.scale.setScalar(isA ? 0.9 : 0.45);
    }
    if (this.lines) (this.lines.material as THREE.LineBasicMaterial).opacity = 0.12 * this.opacity;
    if (++this.frame % 3 === 0) this.notify();
  }

  dispose() {
    this.stars.forEach((s) => {
      s.star.geometry.dispose();
      s.halo.geometry.dispose();
      s.star.material.dispose();
      s.halo.material.dispose();
    });
    this.lines?.geometry.dispose();
    this.spriteTex.dispose();
  }
}

function initials(name: string): string {
  const parts = name.replace(/^(Dr\.|Eng\.|Mr\.|Ms\.|Mrs\.)\s+/i, '').split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
}
