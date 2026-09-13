import * as THREE from 'three';
import type { World, WorldCtx, CameraWish } from './World';
import type { AudioLevels } from '../../state/bus';
import type { MorphTarget } from '../scenes/Presence';
import type { Project } from '../../kb/types';
import { sampleText, ensureFonts } from '../util/TextSampler';
import { soundDesign } from '../audio/SoundDesign';

const FRAG = /* glsl */ `
uniform sampler2D tA; uniform sampler2D tB; uniform sampler2D tDepthA; uniform sampler2D tDepthB;
uniform float uMix; uniform float uHasA; uniform float uHasB; uniform float uKen; uniform vec2 uTilt;
uniform float uOpacity; uniform float uTime; uniform vec2 uAspectFix; uniform float uTypo;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
vec4 sampleLayer(sampler2D t, sampler2D d, vec2 uv){
  vec2 c = (uv-0.5)/uKen*uAspectFix+0.5;
  float depth = texture2D(d, c).r;
  vec2 off = depth * uTilt * 0.015;
  return texture2D(t, clamp(c+off, 0.002, 0.998));
}
void main(){
  vec2 uv = vUv;
  float dist = length((uv-0.5)*vec2(1.0,0.72));
  float edge = 1.0 - smoothstep(0.5, 0.7, dist);
  vec3 col; float a;
  if (uTypo > 0.5) {
    float sweep = smoothstep(0.35, 0.0, abs(uv.x - fract(uTime*0.11)*1.6 + 0.3));
    vec3 ground = vec3(0.045,0.055,0.075);
    col = ground + vec3(0.878,0.663,0.290)*sweep*0.18*(1.0-uv.y*0.4);
    a = uOpacity*edge;
  } else {
    vec4 A = uHasA>0.5 ? sampleLayer(tA,tDepthA,uv) : vec4(0.04,0.05,0.07,1.0);
    vec4 B = uHasB>0.5 ? sampleLayer(tB,tDepthB,uv) : A;
    float n = noise(uv*9.0 + uTime*0.2)*0.6 + noise(uv*23.0)*0.4;
    float thr = smoothstep(uMix-0.12, uMix+0.12, n);
    float front = smoothstep(0.0, 0.08, abs(n-uMix)) ;
    col = mix(B.rgb, A.rgb, thr) * 1.12;
    col += vec3(0.878,0.663,0.290) * (1.0-front) * step(0.01,uMix) * step(uMix,0.99) * 0.9;
    a = uOpacity*edge;
  }
  // scrim so the title block always reaches 4.5:1
  col *= 1.0 - smoothstep(0.68, 1.0, 1.0-uv.y)*0.5;
  gl_FragColor = vec4(col, a);
}`;

const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;

interface Loaded {
  tex: THREE.Texture;
  depth: THREE.Texture;
  img: HTMLImageElement;
}

/** "The particles become the place" — official photograph as a curved cinema screen. */
export class ProjectWorld implements World {
  readonly name = 'project' as const;
  readonly group = new THREE.Group();
  private screen: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private loader = new THREE.TextureLoader();
  private cache = new Map<string, Promise<Loaded | null>>();
  private project: Project | null = null;
  private ctx: WorldCtx | null = null;
  private images: Loaded[] = [];
  private imgIndex = 0;
  private dissolve = 0; // 0 = showing A, 1 = fully B (then swap)
  private dissolving = false;
  private sinceSwap = 0;
  private ken = 0;
  private opacity = 0;
  private opacityTarget = 1;
  private tilt = new THREE.Vector2();
  private tiltTarget = new THREE.Vector2();
  private pulse = 0;
  private figureChip: string | null = null;
  private chipTimer = 0;
  private time = 0;
  private w = 3;
  private h = 1.7;
  private typographic = false;
  private lastGrid: MorphTarget | null = null;
  private loadedFor = new Set<string>();

  constructor() {
    const geom = new THREE.PlaneGeometry(1, 1, 48, 24);
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, -(pos.getX(i) * pos.getX(i)) * 0.32);
    geom.computeVertexNormals();
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        tA: { value: null }, tB: { value: null }, tDepthA: { value: null }, tDepthB: { value: null },
        uMix: { value: 0 }, uHasA: { value: 0 }, uHasB: { value: 0 }, uKen: { value: 1.06 }, uTilt: { value: new THREE.Vector2() },
        uOpacity: { value: 0 }, uTime: { value: 0 }, uAspectFix: { value: new THREE.Vector2(1, 1) }, uTypo: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    this.screen = new THREE.Mesh(geom, mat);
    this.screen.position.z = -0.25;
    this.group.add(this.screen);
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      this.tiltTarget.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    }, { passive: true });
  }

  setTilt(x: number, y: number) {
    this.tiltTarget.set(x, y);
  }

  private load(url: string): Promise<Loaded | null> {
    let p = this.cache.get(url);
    if (!p) {
      p = new Promise<Loaded | null>((resolve) => {
        this.loader.load(
          url,
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearFilter;
            tex.generateMipmaps = false;
            const img = tex.image as HTMLImageElement;
            resolve({ tex, depth: this.fakeDepth(img), img });
          },
          undefined,
          () => resolve(null),
        );
      });
      this.cache.set(url, p);
    }
    return p;
  }

  /** Vertical gradient (lower = nearer) blended 30 % with inverted blurred luminance. */
  private fakeDepth(img: HTMLImageElement): THREE.Texture {
    const w = 128;
    const h = 72;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.filter = 'blur(3px)';
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const lum = (0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2]) / 255;
        const grad = y / (h - 1);
        const v = Math.round(255 * (0.7 * grad + 0.3 * (1 - lum)));
        d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
        d.data[i + 3] = 255;
      }
    }
    ctx.putImageData(d, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter;
    return t;
  }

  private fit(ctx: WorldCtx) {
    // Phone-first: fill width, keep 16:10-ish; on wide screens fill height.
    const maxW = ctx.viewHalfW * 2 * 0.94;
    const maxH = ctx.viewHalfH * 2 * 0.62;
    let w = maxW;
    let h = w / 1.6;
    if (h > maxH) {
      h = maxH;
      w = h * 1.6;
    }
    this.w = w;
    this.h = h;
    this.screen.scale.set(w, h, 1);
    this.screen.position.y = ctx.viewHalfH * 0.08;
  }

  private gridTarget(loaded: Loaded, ctx: WorldCtx): MorphTarget {
    const [cols, rows] = ctx.tier.imageGrid;
    const c = document.createElement('canvas');
    c.width = cols;
    c.height = rows;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    // cover-fit
    const ir = loaded.img.width / loaded.img.height;
    const sr = cols / rows;
    let sw = loaded.img.width;
    let sh = loaded.img.height;
    if (ir > sr) sw = sh * sr;
    else sh = sw / sr;
    g.drawImage(loaded.img, (loaded.img.width - sw) / 2, (loaded.img.height - sh) / 2, sw, sh, 0, 0, cols, rows);
    const d = g.getImageData(0, 0, cols, rows).data;
    const positions = new Float32Array(cols * rows * 3);
    const colors = new Float32Array(cols * rows * 3);
    const y0 = this.screen.position.y;
    for (let r = 0; r < rows; r++) {
      for (let cc = 0; cc < cols; cc++) {
        const i = r * cols + cc;
        const x = (cc / (cols - 1) - 0.5) * this.w;
        const y = y0 - (r / (rows - 1) - 0.5) * this.h;
        const z = -0.25 - (x / this.w) * (x / this.w) * 0.32 * this.w;
        positions.set([x, y, z], i * 3);
        colors.set([d[i * 4] / 255, d[i * 4 + 1] / 255, d[i * 4 + 2] / 255], i * 3);
      }
    }
    return { positions, colors, center: new THREE.Vector3(0, y0, -0.25) };
  }

  async morphTarget(params: Record<string, any>, ctx: WorldCtx): Promise<MorphTarget | null> {
    this.ctx = ctx;
    this.fit(ctx);
    const project = ctx.kb.projects.find((p) => p.id === params.id) || null;
    this.project = project;
    if (!project) return null;
    const loads = await Promise.all(project.images.map((im) => this.load(im.local)));
    this.images = loads.filter(Boolean) as Loaded[];
    this.imgIndex = 0;
    this.loadedFor.add(project.id);
    if (this.images.length) {
      this.typographic = false;
      this.lastGrid = this.gridTarget(this.images[0], ctx);
      return this.lastGrid;
    }
    // Typographic hero: the name set huge in outline type.
    this.typographic = true;
    await ensureFonts();
    const name = project.name[ctx.lang];
    const font = ctx.lang === 'ar' ? '600 160px "IBM Plex Sans Arabic"' : '400 120px Michroma';
    const sampled = sampleText(name, { font, worldWidth: this.w * 0.9, maxPoints: 9000, rtl: ctx.lang === 'ar', center: [0, this.screen.position.y], z: -0.2 });
    this.lastGrid = { positions: sampled.positions, colors: sampled.colors, center: new THREE.Vector3(0, this.screen.position.y, -0.2) };
    return this.lastGrid;
  }

  reverseTarget(): MorphTarget | null {
    return this.lastGrid;
  }

  enter(params: Record<string, any>, ctx: WorldCtx) {
    this.ctx = ctx;
    this.fit(ctx);
    if (!this.project || this.project.id !== params.id) this.project = ctx.kb.projects.find((p) => p.id === params.id) || null;
    const u = this.screen.material.uniforms;
    const apply = () => {
      u.uTypo.value = this.typographic ? 1 : 0;
      if (this.images.length) {
        this.setLayer('A', this.images[0]);
        u.uHasB.value = 0;
        u.uMix.value = 0;
      } else {
        u.uHasA.value = 0;
        u.uHasB.value = 0;
      }
      this.notify();
    };
    if (this.project && !this.loadedFor.has(this.project.id)) {
      const pr = this.project;
      Promise.all(pr.images.map((im) => this.load(im.local))).then((loads) => {
        if (this.project?.id !== pr.id) return;
        this.images = loads.filter(Boolean) as Loaded[];
        this.imgIndex = 0;
        this.typographic = this.images.length === 0;
        this.loadedFor.add(pr.id);
        apply();
      });
    } else apply();
    this.ken = 0;
    this.sinceSwap = 0;
    this.opacityTarget = 1;
    this.opacity = 0;
    this.notify();
    soundDesign.glass();
  }

  refocus(params: Record<string, any>, ctx: WorldCtx) {
    // project → project: noise dissolve between photos, title block slides.
    const next = ctx.kb.projects.find((p) => p.id === params.id) || null;
    if (!next || next.id === this.project?.id) return;
    this.project = next;
    Promise.all(next.images.map((im) => this.load(im.local))).then((loads) => {
      const imgs = loads.filter(Boolean) as Loaded[];
      this.loadedFor.add(next.id);
      if (imgs.length) {
        this.typographic = false;
        this.screen.material.uniforms.uTypo.value = 0;
        this.images = imgs;
        this.imgIndex = 0;
        this.startDissolve(imgs[0]);
        this.lastGrid = this.gridTarget(imgs[0], ctx);
      } else {
        this.typographic = true;
        this.images = [];
        this.screen.material.uniforms.uTypo.value = 1;
      }
      this.notify();
    });
  }

  private setLayer(which: 'A' | 'B', l: Loaded) {
    const u = this.screen.material.uniforms;
    u[`t${which}`].value = l.tex;
    u[`tDepth${which}`].value = l.depth;
    u[`uHas${which}`].value = 1;
    const ir = l.img.width / l.img.height;
    const sr = this.w / this.h;
    (u.uAspectFix.value as THREE.Vector2).set(ir > sr ? sr / ir : 1, ir > sr ? 1 : ir / sr);
  }

  private startDissolve(next: Loaded) {
    this.setLayer('B', next);
    this.dissolve = 0;
    this.dissolving = true;
    this.sinceSwap = 0;
  }

  private notify() {
    if (!this.ctx || !this.project) return;
    const p = this.project;
    const lang = this.ctx.lang;
    this.ctx.notify({
      id: p.id,
      name: p.name[lang],
      location: p.location[lang],
      role: p.role_as_stated[lang],
      concept: p.kind === 'concept',
      pulse: this.pulse > 0,
      chip: this.figureChip,
      alt: p.images[0]?.alt?.[lang] || null,
    });
  }

  cue(entityId: string, category: string) {
    if (!this.project) return;
    if (category === 'project' && entityId === this.project.id) {
      this.pulse = 0.7;
      this.notify();
    } else if (category === 'project' && entityId !== this.project.id) {
      this.pulse = 0.5;
      this.notify();
    } else if (category === 'figure' && this.ctx) {
      const f = this.ctx.kb.figures.find((x) => x.id === entityId);
      if (f) {
        this.figureChip = `${f.value} · ${f.label[this.ctx.lang]}`;
        this.chipTimer = 5;
        this.notify();
      }
    }
  }

  exit() {
    this.opacityTarget = 0;
    this.figureChip = null;
  }

  camera(): CameraWish {
    return { dolly: 0.92, target: new THREE.Vector3(0, 0, 0), exposure: 1.05 };
  }

  bloom() {
    return 0.35;
  }

  update(dt: number, _audio: AudioLevels) {
    this.time += dt;
    const u = this.screen.material.uniforms;
    this.ken += dt;
    u.uKen.value = THREE.MathUtils.lerp(1.06, 1.0, Math.min(1, this.ken / 9));
    u.uTime.value = this.time;
    this.opacity += (this.opacityTarget - this.opacity) * Math.min(1, dt * (this.opacityTarget ? 2.2 : 5));
    u.uOpacity.value = this.opacity;
    this.tilt.lerp(this.tiltTarget, Math.min(1, dt * 4));
    (u.uTilt.value as THREE.Vector2).copy(this.tilt);

    if (this.images.length > 1 && !this.dissolving) {
      this.sinceSwap += dt;
      if (this.sinceSwap > 4.5) {
        this.imgIndex = (this.imgIndex + 1) % this.images.length;
        this.startDissolve(this.images[this.imgIndex]);
      }
    }
    if (this.dissolving) {
      this.dissolve = Math.min(1, this.dissolve + dt / 1.4);
      u.uMix.value = 1 - this.dissolve; // A visible where noise > mix; fades to B
      if (this.dissolve >= 1) {
        this.dissolving = false;
        const b = this.images[this.imgIndex] || this.images[0];
        this.setLayer('A', b);
        u.uHasB.value = 0;
        u.uMix.value = 0;
      }
    }
    if (this.pulse > 0) {
      this.pulse -= dt;
      if (this.pulse <= 0) this.notify();
    }
    if (this.chipTimer > 0) {
      this.chipTimer -= dt;
      if (this.chipTimer <= 0) {
        this.figureChip = null;
        this.notify();
      }
    }
  }

  dispose() {
    this.screen.geometry.dispose();
    this.screen.material.dispose();
    this.cache.forEach((p) => p.then((l) => { l?.tex.dispose(); l?.depth.dispose(); }));
  }
}
