import * as THREE from 'three';
import type { World, WorldCtx, CameraWish } from './World';
import type { AudioLevels } from '../../state/bus';
import type { MorphTarget } from '../scenes/Presence';
import type { Figure } from '../../kb/types';
import { sampleText, ensureFonts } from '../util/TextSampler';
import { localizeDigits } from '../../i18n/strings';
import { soundDesign } from '../audio/SoundDesign';

/** "Numbers made of light" — one figure, huge, assembled from particles. */
export class FigureWorld implements World {
  readonly name = 'figure' as const;
  readonly group = new THREE.Group();
  private points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private figure: Figure | null = null;
  private ctx: WorldCtx | null = null;
  private target: MorphTarget | null = null;
  private opacity = 0;
  private opacityTarget = 1;
  private time = 0;
  private landed = false;
  private countFrom = 0;
  private countT = 1;
  private displayValue = '';

  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(3), 3));
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 }, uLevel: { value: 0 }, uDpr: { value: Math.min(window.devicePixelRatio || 1, 2) } },
      vertexShader: `attribute vec3 color; varying vec3 vC; uniform float uTime; uniform float uLevel; uniform float uDpr;
        void main(){ vC = color; vec3 p = position; p.y += sin(uTime*1.6 + p.x*3.0)*0.006 + uLevel*0.02*sin(p.x*20.0+uTime*9.0);
        vec4 mv = modelViewMatrix*vec4(p,1.0); gl_PointSize = 2.4*uDpr*(6.0/-mv.z); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform float uOpacity; varying vec3 vC; void main(){ vec2 c = gl_PointCoord-0.5; float d = length(c); if(d>0.5) discard; float i = smoothstep(0.5,0.08,d); gl_FragColor = vec4(vC*i*1.1, i*uOpacity*0.85); }`,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.group.add(this.points);
  }

  private async build(f: Figure, ctx: WorldCtx, value: string): Promise<MorphTarget> {
    await ensureFonts();
    const isAr = ctx.lang === 'ar';
    const width = Math.min(ctx.viewHalfW * 2 * 0.84, 4.2);
    const font = isAr ? '600 200px "IBM Plex Sans Arabic"' : '400 200px Michroma';
    const s = sampleText(value, { font, worldWidth: width, maxPoints: 14000, rtl: isAr, center: [0, ctx.viewHalfH * 0.12], z: 0 });
    // Fit height too (phones: keep under 30 % of the view)
    const maxH = ctx.viewHalfH * 0.6;
    if (s.height > maxH) {
      const k = maxH / s.height;
      for (let i = 0; i < s.positions.length; i += 3) {
        s.positions[i] *= k;
        s.positions[i + 1] = ctx.viewHalfH * 0.12 + (s.positions[i + 1] - ctx.viewHalfH * 0.12) * k;
      }
    }
    return { positions: s.positions, colors: s.colors, center: new THREE.Vector3(0, ctx.viewHalfH * 0.12, 0) };
  }

  private valueFor(f: Figure, lang: 'en' | 'ar'): string {
    return localizeDigits(f.value, lang);
  }

  async morphTarget(params: Record<string, any>, ctx: WorldCtx): Promise<MorphTarget | null> {
    this.ctx = ctx;
    this.figure = ctx.kb.figures.find((x) => x.id === params.id) || null;
    if (!this.figure) return null;
    this.displayValue = this.valueFor(this.figure, ctx.lang);
    this.target = await this.build(this.figure, ctx, this.displayValue);
    this.applyTarget(this.target);
    return this.target;
  }

  reverseTarget() {
    return this.target;
  }

  private applyTarget(t: MorphTarget) {
    const g = this.points.geometry;
    g.setAttribute('position', new THREE.BufferAttribute(t.positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(t.colors || new Float32Array(t.positions.length).fill(0.8), 3));
    g.computeBoundingSphere();
  }

  enter(params: Record<string, any>, ctx: WorldCtx) {
    this.ctx = ctx;
    if (!this.figure || this.figure.id !== params.id) {
      this.figure = ctx.kb.figures.find((x) => x.id === params.id) || null;
      if (this.figure) {
        this.displayValue = this.valueFor(this.figure, ctx.lang);
        this.build(this.figure, ctx, this.displayValue).then((t) => {
          this.target = t;
          this.applyTarget(t);
        });
      }
    }
    this.opacityTarget = 1;
    this.opacity = 1;
    this.landed = false;
    // Counts count up (2 s); years and money assemble as they are.
    if (this.figure?.kind === 'count') {
      this.countFrom = 0;
      this.countT = 0;
    } else this.countT = 1;
    this.notify();
    soundDesign.settle();
  }

  refocus(params: Record<string, any>, ctx: WorldCtx) {
    if (params.id !== this.figure?.id) this.enter(params, ctx);
  }

  private notify() {
    if (!this.ctx || !this.figure) return;
    const f = this.figure;
    const lang = this.ctx.lang;
    let shown = this.displayValue;
    if (f.kind === 'count' && this.countT < 1) {
      const n = parseInt(f.value.replace(/[^0-9]/g, ''), 10);
      const v = Math.round(n * this.countT);
      shown = localizeDigits(f.value.replace(/[0-9,]+/, v.toLocaleString('en-US')), lang);
    }
    this.ctx.notify({ id: f.id, value: shown, label: f.label[lang], spoken: f.spoken[lang], landed: this.landed });
  }

  cue(entityId: string, category: string) {
    if (category === 'figure' && entityId === this.figure?.id) {
      this.landed = true;
      soundDesign.settle();
      this.notify();
    }
  }

  exit() {
    this.opacityTarget = 0;
  }

  camera(): CameraWish {
    return { dolly: 0.92, target: new THREE.Vector3(0, 0, 0), exposure: 1 };
  }

  bloom() {
    return 0.5;
  }

  update(dt: number, audio: AudioLevels) {
    this.time += dt;
    this.opacity += (this.opacityTarget - this.opacity) * Math.min(1, dt * 5);
    const u = this.points.material.uniforms;
    u.uOpacity.value = this.opacity;
    u.uTime.value = this.time;
    u.uLevel.value = audio.rms;
    if (this.countT < 1) {
      this.countT = Math.min(1, this.countT + dt / 2);
      this.notify();
    }
  }

  dispose() {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}
