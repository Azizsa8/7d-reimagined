import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createGradePass } from './shaders/GradePass';
import { SceneDirector } from './SceneDirector';
import { Presence } from './scenes/Presence';
import { FilmGrain } from './Grain';
import { PerformanceMonitor, type TierConfig } from './PerformanceTier';
import { bus, type AudioLevels } from '../state/bus';
import { REDUCED, type PresenceState } from '../config';

/**
 * One canvas, one requestAnimationFrame loop, outside React.
 * RenderPass → UnrealBloomPass → grade pass → OutputPass (ACES, sRGB); 2D grain on top.
 */
export class Stage {
  public readonly scene = new THREE.Scene();
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly director: SceneDirector;
  public readonly presence: Presence;
  public readonly perf: PerformanceMonitor;
  public tier: TierConfig;

  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private grade: ReturnType<typeof createGradePass>;
  private grain: FilmGrain;
  private canvas3d: HTMLCanvasElement;
  private canvas2d: HTMLCanvasElement;
  private clock = new THREE.Clock();
  private running = false;
  private paused = false;
  private raf = 0;
  private audio: AudioLevels = { rms: 0, low: 0, mid: 0, high: 0 };
  private mic = 0;
  private tilt = { x: 0, y: 0 };
  private tiltTarget = { x: 0, y: 0 };
  private unsubs: Array<() => void> = [];
  private baseDistance = 5;
  private viewportScale = 1;
  private exposureTarget = 1;

  constructor(private container: HTMLElement) {
    this.perf = new PerformanceMonitor((t) => this.applyTier(t));
    this.tier = this.perf.tier;

    this.canvas3d = document.createElement('canvas');
    this.canvas3d.className = 'stage-canvas';
    this.canvas3d.setAttribute('aria-hidden', 'true');
    this.canvas2d = document.createElement('canvas');
    this.canvas2d.className = 'stage-grain';
    this.canvas2d.setAttribute('aria-hidden', 'true');
    container.appendChild(this.canvas3d);
    container.appendChild(this.canvas2d);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas3d, antialias: false, powerPreference: 'high-performance', alpha: false });
    this.renderer.setClearColor(0x050608, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;

    const isMobile = window.innerWidth < 768;
    this.presence = new Presence(this.tier.presenceParticles, isMobile);
    // Fewer particles on lower tiers → slightly larger points so the body stays luminous.
    const density = Math.min(1.35, Math.sqrt(24000 / this.tier.presenceParticles));
    this.presence.setPointSize((isMobile ? 2.6 : 3.0) * density);
    this.scene.add(this.presence.group);
    this.scene.add(this.presence.dustHolder);
    this.director = new SceneDirector(this);

    const renderPass = new RenderPass(this.scene, this.camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.6, 0.22);
    this.grade = createGradePass();
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());

    this.grain = new FilmGrain(this.canvas2d);
    this.applyTier(this.tier);
    this.resize();

    window.addEventListener('resize', this.resize);
    window.addEventListener('pointermove', this.onPointer, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibility);
    this.unsubs.push(
      bus.on('state', (s: PresenceState) => this.presence.setState(s)),
      bus.on('level', (l) => (this.audio = l)),
      bus.on('micLevel', (m) => (this.mic = m)),
      bus.on('interrupted', () => this.presence.hushNow()),
      bus.on('quality', (q) => this.presence.setWarmth(q === 'good' ? 1 : q === 'degraded' ? 0.6 : 0.15)),
    );
    this.start();
  }

  /** Device tilt (−1..1) from the device manager. */
  setTilt(x: number, y: number) {
    this.tiltTarget.x = x;
    this.tiltTarget.y = y;
  }

  private onPointer = (e: PointerEvent) => {
    if (REDUCED || e.pointerType === 'touch') return;
    this.tiltTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.tiltTarget.y = -((e.clientY / window.innerHeight) * 2 - 1);
  };

  private applyTier(t: TierConfig) {
    this.tier = t;
    const dpr = Math.min(window.devicePixelRatio || 1, t.dprCap);
    this.renderer.setPixelRatio(dpr);
    this.presence.setDpr(dpr);
    (this.grade.uniforms as any).uChromaticAberration.value = t.chromaticAberration ? 0.0015 : 0;
    this.resize();
  }

  resize = () => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    const bloomScale = this.tier.bloomHalfRes ? 0.5 : 1;
    this.bloom.setSize(w * bloomScale, h * bloomScale);
    this.grain.resize(w, h);

    // Frame the presence: radius 1 should fill ~72 % of the narrower half-extent.
    const halfV = Math.tan((this.camera.fov * Math.PI) / 360);
    const halfH = halfV * this.camera.aspect;
    const narrow = Math.min(halfV, halfH);
    const portrait = h > w;
    this.baseDistance = 1 / ((portrait ? 0.72 : 0.52) * narrow);
    this.baseDistance = THREE.MathUtils.clamp(this.baseDistance, 3.2, 8.5);
    this.viewportScale = 1;
    // Where the ember sits: top corner inside the safe area.
    const edgeX = halfH * this.baseDistance;
    const edgeY = halfV * this.baseDistance;
    // Ember: 64 px diameter, tucked under the top bar in the corner.
    const pxPerUnit = h / 2 / (halfV * this.baseDistance);
    const emberScale = 18 / pxPerUnit; // radius 1 → 18 px (≈64 px with its glow)
    this.presence.setFraming(this.baseDistance, emberScale);
    const pad = 50 / pxPerUnit;
    this.presence.emberOffset.set(edgeX - pad - emberScale, edgeY - (74 + 44) / pxPerUnit, 0);
    this.director.onResize(w, h, this.baseDistance);
  };

  private onVisibility = () => {
    if (document.hidden) {
      this.paused = true;
      cancelAnimationFrame(this.raf);
    } else {
      this.paused = false;
      this.clock.getDelta();
      if (this.running) this.loop();
    }
  };

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.loop();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  setExposure(v: number) {
    this.exposureTarget = v;
  }

  private loop = () => {
    if (!this.running || this.paused) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    this.perf.record(now);
    const dt = Math.min(this.clock.getDelta(), 0.08);
    const t = this.clock.elapsedTime;

    // Camera: breathing dolly ±1.5 % over 8 s, tilt parallax ±3°, per-world offset.
    const breathe = REDUCED ? 0 : Math.sin((t / 8) * Math.PI * 2) * 0.015;
    const k = Math.min(1, dt * 4);
    if (!REDUCED) {
      this.tilt.x += (this.tiltTarget.x - this.tilt.x) * k;
      this.tilt.y += (this.tiltTarget.y - this.tilt.y) * k;
    }
    const cam = this.director.cameraState();
    const dist = this.baseDistance * (1 + breathe) * cam.dolly;
    this.camera.position.set(cam.target.x + Math.sin(this.tilt.x * 0.052) * dist, cam.target.y + Math.sin(this.tilt.y * 0.052) * dist, cam.target.z + dist);
    this.camera.lookAt(cam.target);

    this.director.update(dt, this.audio, this.mic);
    this.presence.update(dt, this.audio, this.mic, REDUCED, this.viewportScale);

    this.bloom.strength += ((this.director.bloomOverride ?? this.presence.bloom) - this.bloom.strength) * Math.min(1, dt * 6);
    this.renderer.toneMappingExposure += (this.exposureTarget * cam.exposure - this.renderer.toneMappingExposure) * Math.min(1, dt * 4);
    this.composer.render();
    this.grain.update(now);
  };

  dispose() {
    this.stop();
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('pointermove', this.onPointer);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.unsubs.forEach((u) => u());
    this.director.dispose();
    this.presence.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.canvas3d.remove();
    this.canvas2d.remove();
  }
}
