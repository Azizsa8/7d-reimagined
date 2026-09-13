import * as THREE from 'three';
import type { World, WorldCtx, CameraWish } from './World';
import { BRASS, TEAL, SAND } from './World';
import type { AudioLevels } from '../../state/bus';
import type { MorphTarget } from '../scenes/Presence';
import { loadLandPoints, latLngToVec3 } from '../util/landPoints';
import type { Hub } from '../../kb/types';
import { soundDesign } from '../audio/SoundDesign';

const R = 1.08;

interface HubNode {
  hub: Hub;
  group: THREE.Group;
  pillar: THREE.Mesh<THREE.CylinderGeometry, THREE.ShaderMaterial>;
  core: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  height: number;
  targetHeight: number;
  dim: number;
}

/** "Five hubs, five continents" — a dark planet of land particles, brass hubs, pillars of light, great-circle routes. */
export class GlobeWorld implements World {
  readonly name = 'globe' as const;
  readonly group = new THREE.Group();
  private rot = new THREE.Group();
  private land: THREE.Points | null = null;
  private landPositions: Float32Array | null = null;
  private atmosphere: THREE.Mesh;
  private hubs: HubNode[] = [];
  private routes: Array<{ mesh: THREE.Mesh<THREE.TubeGeometry, THREE.ShaderMaterial>; head: THREE.Mesh }> = [];
  private routeT = -1;
  private targetQ = new THREE.Quaternion();
  private autoRotate = true;
  private focused: string | null = null;
  private ctx: WorldCtx | null = null;
  private time = 0;
  private opacity = 0;
  private opacityTarget = 1;
  private labelFrame = 0;
  private proj = new THREE.Vector3();

  constructor() {
    this.group.add(this.rot);
    const geom = new THREE.SphereGeometry(R * 1.04, 48, 48);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uOpacity: { value: 0 } },
      vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = -mv.xyz; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform float uOpacity; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vV), vN)), 3.2); gl_FragColor = vec4(vec3(0.184,0.663,0.545)*1.2, f*0.16*uOpacity); }`,
    });
    this.atmosphere = new THREE.Mesh(geom, mat);
    this.group.add(this.atmosphere);
  }

  private async ensureLand(count: number) {
    if (this.land) return;
    const ll = await loadLandPoints(count);
    const n = ll.length / 2;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      v.copy(latLngToVec3(ll[i * 2], ll[i * 2 + 1], R));
      pos.set([v.x, v.y, v.z], i * 3);
      const bright = Math.random() < 0.12 ? 0.8 : 0.34;
      col.set([0.86 * bright, 0.84 * bright, 0.78 * bright], i * 3);
    }
    this.landPositions = pos;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uOpacity: { value: 0 }, uDpr: { value: Math.min(window.devicePixelRatio || 1, 2) }, uTime: { value: 0 }, uSize: { value: 1.5 * Math.min(1.8, Math.sqrt(30000 / count)) } },
      vertexShader: `attribute vec3 color; varying vec3 vC; varying float vA; uniform float uDpr; uniform float uSize; void main(){ vC = color; vec4 mv = modelViewMatrix*vec4(position,1.0); vec3 n = normalize(normalMatrix*normalize(position)); float facing = dot(normalize(-mv.xyz), n); vA = smoothstep(-0.15, 0.35, facing); gl_PointSize = uSize*uDpr*(6.0/-mv.z); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform float uOpacity; varying vec3 vC; varying float vA; void main(){ vec2 c = gl_PointCoord-0.5; float d = length(c); if(d>0.5) discard; float i = smoothstep(0.5,0.1,d); gl_FragColor = vec4(vC*i, i*vA*uOpacity*0.7); }`,
    });
    this.land = new THREE.Points(g, m);
    this.land.frustumCulled = false;
    this.rot.add(this.land);
  }

  private buildHubs(ctx: WorldCtx) {
    if (this.hubs.length) return;
    const hubs = [...ctx.kb.hubs].sort((a, b) => a.order - b.order);
    for (const hub of hubs) {
      const g = new THREE.Group();
      const p = latLngToVec3(hub.lat, hub.lng, R);
      g.position.copy(p);
      g.lookAt(p.clone().multiplyScalar(2));
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), new THREE.MeshBasicMaterial({ color: BRASS, transparent: true }));
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.034, 0.042, 32), new THREE.MeshBasicMaterial({ color: BRASS, transparent: true, opacity: 0.7, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      const pg = new THREE.CylinderGeometry(0.008, 0.02, 0.35, 12, 1, true);
      pg.translate(0, 0.175, 0);
      pg.rotateX(Math.PI / 2);
      const pm = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uH: { value: 0 }, uColor: { value: BRASS.clone() } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `uniform float uH; uniform vec3 uColor; varying vec2 vUv; void main(){ float h = vUv.y; float a = smoothstep(uH, uH-0.25, h) * (1.0-h) * 0.9; gl_FragColor = vec4(uColor*1.6, a); }`,
      });
      const pillar = new THREE.Mesh(pg, pm);
      g.add(core, ring, pillar);
      this.rot.add(g);
      this.hubs.push({ hub, group: g, pillar, core, ring, height: 0, targetHeight: 0, dim: 1 });
    }
    // Great-circle routes in KB order with a travelling light head.
    for (let i = 0; i < hubs.length - 1; i++) {
      const a = latLngToVec3(hubs[i].lat, hubs[i].lng, R);
      const b = latLngToVec3(hubs[i + 1].lat, hubs[i + 1].lng, R);
      const pts: THREE.Vector3[] = [];
      for (let s = 0; s <= 48; s++) {
        const t = s / 48;
        const v = a.clone().lerp(b, t).normalize();
        v.multiplyScalar(R + Math.sin(t * Math.PI) * 0.22);
        pts.push(v);
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.TubeGeometry(curve, 64, 0.004, 6, false);
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uProgress: { value: 0 }, uOpacity: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `uniform float uProgress; uniform float uOpacity; varying vec2 vUv; void main(){ float drawn = step(vUv.x, uProgress); float head = smoothstep(0.08, 0.0, abs(vUv.x-uProgress)); vec3 c = mix(vec3(0.784,0.667,0.486)*0.6, vec3(0.96,0.9,0.7)*2.0, head); gl_FragColor = vec4(c, (0.35 + head*0.9)*drawn*uOpacity); }`,
      });
      const mesh = new THREE.Mesh(tube, mat);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfff1d0, transparent: true, opacity: 0 }));
      this.rot.add(mesh, head);
      this.routes.push({ mesh, head });
      (mesh as any).curve = curve;
    }
  }

  async morphTarget(_params: Record<string, any>, ctx: WorldCtx): Promise<MorphTarget | null> {
    this.ctx = ctx;
    await this.ensureLand(ctx.tier.globeParticles);
    this.buildHubs(ctx);
    if (!this.landPositions) return null;
    // Rotate target into the current globe orientation so the hand-off is seamless.
    this.rot.updateMatrixWorld(true);
    const m = this.rot.matrixWorld;
    const out = new Float32Array(this.landPositions.length);
    const v = new THREE.Vector3();
    for (let i = 0; i < this.landPositions.length; i += 3) {
      v.set(this.landPositions[i], this.landPositions[i + 1], this.landPositions[i + 2]).applyMatrix4(m);
      out.set([v.x, v.y, v.z], i);
    }
    return { positions: out, center: new THREE.Vector3() };
  }

  reverseTarget(): MorphTarget | null {
    if (!this.landPositions) return null;
    this.rot.updateMatrixWorld(true);
    const m = this.rot.matrixWorld;
    const out = new Float32Array(this.landPositions.length);
    const v = new THREE.Vector3();
    for (let i = 0; i < this.landPositions.length; i += 3) {
      v.set(this.landPositions[i], this.landPositions[i + 1], this.landPositions[i + 2]).applyMatrix4(m);
      out.set([v.x, v.y, v.z], i);
    }
    return { positions: out, center: new THREE.Vector3() };
  }

  enter(params: Record<string, any>, ctx: WorldCtx) {
    this.ctx = ctx;
    this.buildHubs(ctx);
    this.ensureLand(ctx.tier.globeParticles).catch(() => {});
    this.opacityTarget = 1;
    this.opacity = 1; // the presence particles were already here; no fade needed
    if (params.focus) this.focus(String(params.focus));
    else {
      this.focused = null;
      this.autoRotate = true;
      this.hubs.forEach((h) => (h.targetHeight = 0.35));
      this.notify();
    }
    this.routeT = 0; // draw routes on entry
  }

  refocus(params: Record<string, any>, ctx: WorldCtx) {
    this.ctx = ctx;
    if (params.focus) this.focus(String(params.focus));
  }

  private focus(id: string) {
    const node = this.hubs.find((h) => h.hub.id === id);
    if (!node) return;
    this.focused = id;
    this.autoRotate = false;
    const dir = latLngToVec3(node.hub.lat, node.hub.lng, 1).normalize();
    // Face the camera, slightly north so the pillar reads against the rim.
    const target = new THREE.Vector3(0, 0.25, 1).normalize();
    this.targetQ.setFromUnitVectors(dir, target);
    this.hubs.forEach((h) => {
      h.targetHeight = h.hub.id === id ? 1 : 0.2;
    });
    soundDesign.glass();
    this.notify();
  }

  private notify() {
    if (!this.ctx) return;
    const node = this.focused ? this.hubs.find((h) => h.hub.id === this.focused) : null;
    const lang = this.ctx.lang;
    this.ctx.notify({
      focus: this.focused,
      city: node ? node.hub.name[lang] : null,
      country: node ? node.hub.country[lang] : null,
      role: node ? node.hub.role[lang] : null,
      hubs: this.hubs.map((h) => ({ id: h.hub.id, city: h.hub.name[lang], country: h.hub.country[lang] })),
      label: this.labelXY(),
    });
  }

  private labelXY(): { x: number; y: number } | null {
    const node = this.focused ? this.hubs.find((h) => h.hub.id === this.focused) : null;
    if (!node || !this.ctx) return null;
    node.group.getWorldPosition(this.proj);
    this.proj.y += 0.62;
    return { x: this.proj.x / this.ctx.viewHalfW, y: this.proj.y / this.ctx.viewHalfH };
  }

  cue(entityId: string, category: string) {
    if (category === 'hub') this.focus(entityId);
    if (category === 'timeline' && entityId === 't-1996-2009') this.routeT = 0;
    if (category === 'figure' && entityId === 'fig-5-continents') this.routeT = 0;
  }

  exit() {
    this.opacityTarget = 0;
  }

  camera(): CameraWish {
    return { dolly: 0.92, target: new THREE.Vector3(0, 0, 0), exposure: 0.95 };
  }

  bloom() {
    return 0.42;
  }

  update(dt: number, _audio: AudioLevels) {
    this.time += dt;
    this.opacity += (this.opacityTarget - this.opacity) * Math.min(1, dt * 4);
    const reduced = this.ctx?.reduced;
    if (this.autoRotate) this.rot.rotation.y += dt * (reduced ? 0.02 : 0.08);
    else this.rot.quaternion.slerp(this.targetQ, Math.min(1, dt * 2.6));

    if (this.land) (this.land.material as THREE.ShaderMaterial).uniforms.uOpacity.value = this.opacity;
    (this.atmosphere.material as THREE.ShaderMaterial).uniforms.uOpacity.value = this.opacity;

    for (const h of this.hubs) {
      h.height += (h.targetHeight - h.height) * Math.min(1, dt * 3.5);
      h.pillar.material.uniforms.uH.value = h.height;
      const isF = h.hub.id === this.focused;
      const pulse = 1 + 0.25 * Math.sin(this.time * 3.5 + (isF ? 1 : 0));
      h.ring.scale.set(pulse, pulse, 1);
      const dim = this.focused ? (isF ? 1 : 0.4) : 1;
      h.ring.material.opacity = 0.7 * dim * this.opacity;
      h.core.material.opacity = dim * this.opacity;
    }

    if (this.routeT >= 0) {
      this.routeT += dt / 0.9;
      const total = this.routes.length;
      this.routes.forEach((r, i) => {
        const local = THREE.MathUtils.clamp(this.routeT - i, 0, 1);
        r.mesh.material.uniforms.uProgress.value = local;
        r.mesh.material.uniforms.uOpacity.value = this.opacity;
        const curve = (r.mesh as any).curve as THREE.CatmullRomCurve3;
        if (local > 0 && local < 1) {
          r.head.position.copy(curve.getPoint(local));
          (r.head.material as THREE.MeshBasicMaterial).opacity = this.opacity;
        } else (r.head.material as THREE.MeshBasicMaterial).opacity = 0;
      });
      if (this.routeT > total + 1) this.routeT = -1;
    }

    if (this.focused && ++this.labelFrame % 3 === 0) this.notify();
  }

  dispose() {
    this.land?.geometry.dispose();
    (this.land?.material as THREE.Material | undefined)?.dispose();
    this.atmosphere.geometry.dispose();
    (this.atmosphere.material as THREE.Material).dispose();
    this.hubs.forEach((h) => {
      h.core.geometry.dispose();
      h.ring.geometry.dispose();
      h.pillar.geometry.dispose();
      h.pillar.material.dispose();
    });
    this.routes.forEach((r) => {
      r.mesh.geometry.dispose();
      r.mesh.material.dispose();
    });
  }
}
