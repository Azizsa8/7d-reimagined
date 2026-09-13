import * as THREE from 'three';
import type { World, WorldCtx, CameraWish } from './World';
import { BRASS, IVORY } from './World';
import type { AudioLevels } from '../../state/bus';
import type { Milestone } from '../../kb/types';
import { soundDesign } from '../audio/SoundDesign';
import { localizeDigits } from '../../i18n/strings';

interface Marker {
  m: Milestone;
  ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  core: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  pos: THREE.Vector3;
  t: number;
  scale: number;
}

/** "A river of years" — a luminous ribbon receding into depth with glowing year rings. */
export class TimelineWorld implements World {
  readonly name = 'timeline' as const;
  readonly group = new THREE.Group();
  private ribbon: THREE.Mesh<THREE.TubeGeometry, THREE.ShaderMaterial>;
  private curve: THREE.CatmullRomCurve3;
  private markers: Marker[] = [];
  private markersGroup = new THREE.Group();
  private active = 0;
  private ctx: WorldCtx | null = null;
  private time = 0;
  private draw = 0;
  private opacity = 0;
  private opacityTarget = 1;
  private camTarget = new THREE.Vector3();
  private camDolly = 1;
  private proj = new THREE.Vector3();
  private frame = 0;

  constructor() {
    this.curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.0, -1.1, 1.4),
      new THREE.Vector3(0.45, -0.75, 0.5),
      new THREE.Vector3(-0.4, -0.4, -0.6),
      new THREE.Vector3(0.35, -0.05, -1.9),
      new THREE.Vector3(-0.25, 0.25, -3.2),
      new THREE.Vector3(0.05, 0.5, -4.8),
    ]);
    const geom = new THREE.TubeGeometry(this.curve, 160, 0.03, 10, false);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uDraw: { value: 0 }, uOpacity: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform float uTime; uniform float uDraw; uniform float uOpacity; varying vec2 vUv;
        void main(){ if (vUv.x > uDraw) discard; float band = smoothstep(0.55, 0.95, sin(vUv.x*30.0 - uTime*3.2));
        vec3 sand = vec3(0.784,0.667,0.486); vec3 brass = vec3(0.878,0.663,0.290);
        vec3 c = mix(sand*0.35, brass*1.6, band); float far = 1.0 - smoothstep(0.75, 1.0, vUv.x);
        gl_FragColor = vec4(c, (0.28 + band*0.6)*far*uOpacity); }`,
    });
    this.ribbon = new THREE.Mesh(geom, mat);
    this.group.add(this.ribbon, this.markersGroup);
  }

  private build(ctx: WorldCtx) {
    if (this.markers.length) return;
    const list = ctx.kb.timeline;
    list.forEach((m, i) => {
      const t = 0.07 + (i / Math.max(1, list.length - 1)) * 0.8;
      const p = this.curve.getPoint(t).add(new THREE.Vector3(0, 0.14, 0));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.01, 12, 40), new THREE.MeshBasicMaterial({ color: BRASS, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.position.copy(p);
      ring.rotation.x = Math.PI * 0.35;
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 10), new THREE.MeshBasicMaterial({ color: IVORY, transparent: true, opacity: 0.9 }));
      core.position.copy(p);
      this.markersGroup.add(ring, core);
      this.markers.push({ m, ring, core, pos: p, t, scale: 0 });
    });
  }

  enter(params: Record<string, any>, ctx: WorldCtx) {
    this.ctx = ctx;
    this.build(ctx);
    this.draw = 0;
    this.opacityTarget = 1;
    this.markers.forEach((mk) => (mk.scale = 0));
    const idx = params.id ? this.markers.findIndex((mk) => mk.m.id === params.id) : 0;
    this.focus(Math.max(0, idx), false);
    soundDesign.glass();
  }

  refocus(params: Record<string, any>) {
    if (params.id) {
      const idx = this.markers.findIndex((mk) => mk.m.id === params.id);
      if (idx >= 0) this.focus(idx, true);
    }
  }

  private focus(i: number, sound: boolean) {
    this.active = i;
    const mk = this.markers[i];
    if (!mk) return;
    // Camera glides along the spline to the marker: target the point, dolly in a little.
    this.camTarget.copy(mk.pos).add(new THREE.Vector3(0, 0.05, 0));
    this.camDolly = 0.9 - mk.t * 0.35;
    if (sound) soundDesign.glass();
    this.notify();
  }

  private notify() {
    if (!this.ctx) return;
    const lang = this.ctx.lang;
    const mk = this.markers[this.active];
    this.ctx.notify({
      years: this.markers.map((x, i) => ({ id: x.m.id, year: localizeDigits(x.m.year, lang), active: i === this.active })),
      focus: mk ? { id: mk.m.id, year: localizeDigits(mk.m.year, lang), title: mk.m.title[lang], detail: mk.m.detail[lang] } : null,
      anchor: this.anchor(),
    });
  }

  private anchor() {
    const mk = this.markers[this.active];
    if (!mk || !this.ctx) return null;
    mk.ring.getWorldPosition(this.proj);
    return { x: this.proj.x / this.ctx.viewHalfW, y: this.proj.y / this.ctx.viewHalfH, z: this.proj.z };
  }

  cue(entityId: string, category: string) {
    if (category !== 'timeline' && category !== 'figure') return;
    let idx = this.markers.findIndex((mk) => mk.m.id === entityId);
    if (idx < 0 && category === 'figure' && entityId === 'fig-1993') idx = this.markers.findIndex((mk) => mk.m.id === 't-1993');
    if (idx >= 0 && idx !== this.active) this.focus(idx, true);
  }

  exit() {
    this.opacityTarget = 0;
  }

  camera(): CameraWish {
    return { dolly: this.camDolly, target: this.camTarget.clone(), exposure: 1 };
  }

  update(dt: number, _audio: AudioLevels) {
    this.time += dt;
    this.opacity += (this.opacityTarget - this.opacity) * Math.min(1, dt * 4);
    this.draw = Math.min(1, this.draw + dt / 1.4);
    const u = this.ribbon.material.uniforms;
    u.uTime.value = this.time;
    u.uDraw.value = this.draw;
    u.uOpacity.value = this.opacity;
    this.markers.forEach((mk, i) => {
      const appear = mk.t < this.draw ? 1 : 0;
      mk.scale += (appear - mk.scale) * Math.min(1, dt * 6);
      const isA = i === this.active;
      const bloom = isA ? 1.15 + 0.15 * Math.sin(this.time * 4) : 0.8;
      mk.ring.scale.setScalar(mk.scale * bloom);
      mk.core.scale.setScalar(mk.scale);
      mk.ring.material.opacity = (isA ? 0.95 : 0.4) * this.opacity;
      mk.core.material.opacity = (isA ? 1 : 0.6) * this.opacity;
      mk.ring.material.color.copy(isA ? BRASS : new THREE.Color(0x7a7466));
    });
    if (++this.frame % 3 === 0) this.notify();
  }

  dispose() {
    this.ribbon.geometry.dispose();
    this.ribbon.material.dispose();
    this.markers.forEach((mk) => {
      mk.ring.geometry.dispose();
      mk.ring.material.dispose();
      mk.core.geometry.dispose();
      mk.core.material.dispose();
    });
  }
}
