import * as THREE from 'three';
import { presenceVertexShader } from '../shaders/presence.vert.glsl';
import { presenceFragmentShader } from '../shaders/presence.frag.glsl';
import type { AudioLevels } from '../../state/bus';
import type { PresenceState } from '../../config';

export interface MorphTarget {
  positions: Float32Array; // xyz triplets, world units, centred where the world wants them
  colors?: Float32Array; // rgb triplets 0..1
  center?: THREE.Vector3;
}

/**
 * Savannah's body: a fibonacci sphere of GPU particles, breathing with noise,
 * driven by her voice, able to fly apart into any point set and back.
 */
export class Presence {
  public group = new THREE.Group();
  public readonly count: number;
  private points: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  private rings: THREE.LineLoop[] = [];
  private targetPos: THREE.BufferAttribute;
  private targetCol: THREE.BufferAttribute;

  private state: PresenceState = 'idle';
  private cur = { radius: 0.85, noise: 0.15, flatten: 0, teal: 0, bloom: 0.55, scale: 1, alpha: 1, warmth: 1 };
  private tgt = { radius: 0.85, noise: 0.15, flatten: 0, teal: 0, bloom: 0.55, scale: 1, alpha: 1, warmth: 1 };
  public morph = 0;
  public scatter = 0;
  private emberT = 0;
  private emberTarget = 0;
  private emberSide: 1 | -1 = 1;
  private hush = 0;
  private time = 0;
  private env = { level: 0, low: 0, mid: 0, high: 0, mic: 0 };
  private sweep = -999;
  public bloom = 0.55;
  public emberOffset = new THREE.Vector3(1.35, 1.25, 0);

  constructor(count: number, private mobile: boolean) {
    this.count = count;
    const positions = new Float32Array(count * 3);
    const sparks = new Float32Array(count);
    const randoms = new Float32Array(count);
    const tPos = new Float32Array(count * 3);
    const tCol = new Float32Array(count * 3);
    const delays = new Float32Array(count);
    const arcs = new Float32Array(count);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      const x = Math.cos(th) * r;
      const z = Math.sin(th) * r;
      positions.set([x, y, z], i * 3);
      tPos.set([x, y, z], i * 3);
      tCol.set([0.878, 0.663, 0.29], i * 3);
      delays[i] = Math.random();
      arcs[i] = (Math.random() - 0.5) * 0.9;
      sparks[i] = Math.random() < 0.02 ? 1 : 0;
      randoms[i] = Math.random();
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('aSpark', new THREE.BufferAttribute(sparks, 1));
    this.geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
    this.targetPos = new THREE.BufferAttribute(tPos, 3);
    this.targetCol = new THREE.BufferAttribute(tCol, 3);
    this.geometry.setAttribute('aTargetPos', this.targetPos);
    this.geometry.setAttribute('aTargetColor', this.targetCol);
    this.geometry.setAttribute('aDelay', new THREE.BufferAttribute(delays, 1));
    this.geometry.setAttribute('aArcHeight', new THREE.BufferAttribute(arcs, 1));
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);

    this.material = new THREE.ShaderMaterial({
      vertexShader: presenceVertexShader,
      fragmentShader: presenceFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uRadius: { value: 0.85 },
        uNoiseSpeed: { value: 0.15 },
        uLevel: { value: 0 },
        uLow: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uMicLevel: { value: 0 },
        uFlatten: { value: 0 },
        uHush: { value: 0 },
        uSweepPos: { value: -999 },
        uPointSize: { value: mobile ? 2.6 : 2.4 },
        uDpr: { value: 1 },
        uDistance: { value: 5 },
        uEmber: { value: 0 },
        uBodyScale: { value: 1 },
        uTealTint: { value: 0 },
        uMorph: { value: 0 },
        uScatter: { value: 0 },
        uAlpha: { value: 1 },
        uWarmth: { value: 1 },
        uCenter: { value: new THREE.Vector3() },
      },
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.group.add(this.points);
    this.createRings();
    this.createDust();
  }

  private dust!: THREE.Points;
  private createDust() {
    const n = 420;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * 7, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 4 - 0.5], i * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: 0xc8aa7c, size: 0.012, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    this.dust = new THREE.Points(g, m);
    this.dust.frustumCulled = false;
    this.group.parent?.add(this.dust);
    this.dustHolder.add(this.dust);
  }
  public readonly dustHolder = new THREE.Group();

  private createRings() {
    const radii = [1.42, 1.62, 1.86];
    const tilts = [
      [0.42, 0.2, 0.1],
      [-0.5, 0.55, -0.3],
      [0.18, -0.7, 0.45],
    ];
    radii.forEach((r, i) => {
      const pts: THREE.Vector3[] = [];
      for (let s = 0; s <= 256; s++) {
        const a = (s / 256) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const m = new THREE.LineBasicMaterial({ color: 0xc8aa7c, transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending });
      const ring = new THREE.LineLoop(g, m);
      ring.rotation.set(tilts[i][0], tilts[i][1], tilts[i][2]);
      this.rings.push(ring);
      this.group.add(ring);
    });
  }

  setDpr(dpr: number) {
    this.material.uniforms.uDpr.value = dpr;
  }

  /** Camera distance so point size stays constant on screen; ember diameter in world units. */
  setFraming(distance: number, emberScale: number) {
    this.material.uniforms.uDistance.value = distance;
    this.emberScale = emberScale;
  }
  private emberScale = 0.13;

  setPointSize(px: number) {
    this.material.uniforms.uPointSize.value = px;
  }

  setState(s: PresenceState) {
    this.state = s;
    const t = this.tgt;
    switch (s) {
      case 'idle': Object.assign(t, { radius: 0.85, noise: 0.15, flatten: 0, teal: 0, bloom: 0.5 }); break;
      case 'listening': Object.assign(t, { radius: 0.9, noise: 0.22, flatten: 1, teal: 0.2, bloom: 0.62 }); break;
      case 'thinking': Object.assign(t, { radius: 0.9, noise: 0.6, flatten: 0.2, teal: 0.05, bloom: 0.7 }); break;
      case 'speaking': Object.assign(t, { radius: 1.0, noise: 0.32, flatten: 0, teal: 0, bloom: 0.75 }); break;
    }
  }

  /** Overall size multiplier (arrival point of light 0.06, half 0.5, full 1). */
  setScale(s: number) {
    this.tgt.scale = s;
  }
  setAlpha(a: number) {
    this.tgt.alpha = a;
  }
  snapAlpha(a: number) {
    this.tgt.alpha = a;
    this.cur.alpha = a;
  }
  setWarmth(w: number) {
    this.tgt.warmth = w;
  }
  hushNow() {
    this.hush = 0.25;
  }

  setEmber(on: boolean, lang: 'en' | 'ar') {
    this.emberTarget = on ? 1 : 0;
    this.emberSide = lang === 'ar' ? -1 : 1;
  }
  get emberProgress() {
    return this.emberT;
  }
  snapEmber(on: boolean) {
    this.emberT = on ? 1 : 0;
    this.emberTarget = this.emberT;
  }

  /** Aim every particle at a point set (repeats with jitter when the set is smaller). */
  setMorphTarget(t: MorphTarget) {
    const n = t.positions.length / 3;
    const pos = this.targetPos.array as Float32Array;
    const col = this.targetCol.array as Float32Array;
    for (let i = 0; i < this.count; i++) {
      const j = (i % n) * 3;
      const jitter = i >= n ? 0.012 : 0;
      pos[i * 3] = t.positions[j] + (Math.random() - 0.5) * jitter;
      pos[i * 3 + 1] = t.positions[j + 1] + (Math.random() - 0.5) * jitter;
      pos[i * 3 + 2] = t.positions[j + 2] + (Math.random() - 0.5) * jitter;
      if (t.colors) {
        col[i * 3] = t.colors[j];
        col[i * 3 + 1] = t.colors[j + 1];
        col[i * 3 + 2] = t.colors[j + 2];
      } else {
        col[i * 3] = 0.878;
        col[i * 3 + 1] = 0.663;
        col[i * 3 + 2] = 0.29;
      }
    }
    this.targetPos.needsUpdate = true;
    this.targetCol.needsUpdate = true;
    (this.material.uniforms.uCenter.value as THREE.Vector3).copy(t.center || new THREE.Vector3());
  }

  update(dt: number, audio: AudioLevels, mic: number, reduced: boolean, viewportScale: number) {
    this.time += dt;
    const k = Math.min(1, dt * 8.5);
    const attack = Math.min(1, dt / 0.03);
    const release = Math.min(1, dt / 0.18);
    const env = (c: number, t: number) => (t > c ? c + (t - c) * attack : c + (t - c) * release);
    this.env.level = env(this.env.level, audio.rms);
    this.env.low = env(this.env.low, audio.low);
    this.env.mid = env(this.env.mid, audio.mid);
    this.env.high = env(this.env.high, audio.high);
    this.env.mic = env(this.env.mic, mic);

    const c = this.cur;
    const t = this.tgt;
    for (const key of Object.keys(t) as Array<keyof typeof t>) c[key] += (t[key] - c[key]) * k;

    this.emberT += (this.emberTarget - this.emberT) * Math.min(1, dt * 3.2);
    const emberX = this.emberOffset.x * this.emberSide;
    this.group.position.set(THREE.MathUtils.lerp(0, emberX, this.emberT), THREE.MathUtils.lerp(0, this.emberOffset.y, this.emberT), 0);
    const scale = THREE.MathUtils.lerp(1, this.emberScale, this.emberT) * c.scale * viewportScale;

    const ringOpacity = (1 - this.emberT) * 0.08 * Math.min(1, c.scale * 1.5) * c.alpha;
    this.rings.forEach((r, i) => {
      (r.material as THREE.LineBasicMaterial).opacity = ringOpacity;
      if (!reduced) {
        const dir = i % 2 === 0 ? 1 : -1;
        r.rotation.y += dt * 0.03 * dir * (i + 1);
        r.rotation.x += dt * 0.015 * dir;
      }
    });

    const bloomScale = THREE.MathUtils.lerp(0.45, 1, Math.min(1, c.scale)) * (1 - this.emberT * 0.35);
    if (this.state === 'speaking') this.bloom += ((0.62 + this.env.level * 0.55) * bloomScale - this.bloom) * k;
    else this.bloom += (c.bloom * bloomScale - this.bloom) * k;

    let hushV = 0;
    if (this.hush > 0) {
      this.hush -= dt;
      hushV = Math.max(0, this.hush / 0.25);
    }
    this.sweep = this.state === 'thinking' ? Math.sin((this.time / 1.2) * Math.PI * 2) * 0.9 : -999;

    const u = this.material.uniforms;
    u.uTime.value = this.time;
    u.uRadius.value = c.radius * scale;
    u.uNoiseSpeed.value = reduced ? 0.05 : c.noise;
    u.uLevel.value = this.env.level;
    u.uLow.value = this.env.low;
    u.uMid.value = this.env.mid;
    u.uHigh.value = this.env.high;
    u.uMicLevel.value = this.env.mic;
    u.uFlatten.value = c.flatten;
    u.uHush.value = hushV;
    u.uSweepPos.value = this.sweep;
    u.uTealTint.value = c.teal;
    u.uMorph.value = this.morph;
    u.uScatter.value = this.scatter;
    u.uAlpha.value = c.alpha;
    u.uWarmth.value = c.warmth;
    u.uEmber.value = this.emberT;
    u.uBodyScale.value = c.scale;
    if (this.dust && !reduced) {
      this.dust.rotation.y += dt * 0.012;
      this.dust.position.y = Math.sin(this.time * 0.07) * 0.15;
    }
  }

  dispose() {
    this.dust?.geometry.dispose();
    (this.dust?.material as THREE.Material | undefined)?.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.rings.forEach((r) => {
      r.geometry.dispose();
      (r.material as THREE.Material).dispose();
    });
  }
}
