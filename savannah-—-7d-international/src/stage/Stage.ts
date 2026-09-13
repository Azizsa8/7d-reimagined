import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createGradePass } from './shaders/GradePass';
import { SceneDirector, WorldName } from './SceneDirector';
import { Presence } from './scenes/Presence';
import { FilmGrain } from './Grain';
import { PerformanceMonitor, TierConfig } from './PerformanceTier';
import { CueDirector } from './cue/CueDirector';
import { soundDesign } from './audio/SoundDesign';
import { bus, AudioLevels } from '../state/bus';
import { PresenceState } from '../config';

export class Stage {
  private container: HTMLElement;
  private canvas3d: HTMLCanvasElement;
  private canvas2d: HTMLCanvasElement;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private gradePass: any;

  public director: SceneDirector;
  public presence: Presence;
  public cueDirector: CueDirector;
  public perfMonitor: PerformanceMonitor;
  private grain: FilmGrain;

  private isRunning = false;
  private isPaused = false;
  private animationFrameId = 0;
  private clock = new THREE.Clock();

  private audioLevels: AudioLevels = { rms: 0, low: 0, mid: 0, high: 0 };
  private micLevel = 0;
  private prefersReducedMotion = false;

  // Parallax
  private mouseX = 0;
  private mouseY = 0;
  private targetRotX = 0;
  private targetRotY = 0;
  private currentRotX = 0;
  private currentRotY = 0;

  // Camera breathing
  private cameraBaseZ = 3.2;

  // Subscriptions
  private unsubscribes: Array<() => void> = [];

  constructor(container: HTMLElement) {
    this.container = container;

    // Performance monitor
    this.perfMonitor = new PerformanceMonitor((newTier: TierConfig) => {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, newTier.dprCap));
    });

    // Create 3D canvas
    this.canvas3d = document.createElement('canvas');
    this.canvas3d.className = 'absolute inset-0 w-full h-full pointer-events-none z-0';
    container.appendChild(this.canvas3d);

    // Create 2D grain canvas
    this.canvas2d = document.createElement('canvas');
    this.canvas2d.className = 'absolute inset-0 w-full h-full pointer-events-none z-10';
    container.appendChild(this.canvas2d);

    this.checkReducedMotion();

    // Three scene & camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 50);
    this.camera.position.z = this.cameraBaseZ;

    // WebGL Renderer
    const isMobile = window.innerWidth < 768;
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas3d,
      antialias: false,
      powerPreference: 'high-performance',
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.perfMonitor.currentTier.dprCap));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Post-processing Composer
    // Pipeline: RenderPass -> UnrealBloomPass -> GradePass -> OutputPass
    const renderPass = new RenderPass(this.scene, this.camera);
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.9,
      0.6,
      0.1
    );
    this.gradePass = createGradePass();
    const outputPass = new OutputPass();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.gradePass);
    this.composer.addPass(outputPass);

    // Film grain (4% overlay)
    this.grain = new FilmGrain(this.canvas2d);
    this.grain.resize(window.innerWidth, window.innerHeight);

    // Presence & Scene Director
    this.presence = new Presence(isMobile);
    this.scene.add(this.presence.group);
    this.director = new SceneDirector(this.scene, this.presence);

    // Cue Director (word-level sync)
    this.cueDirector = new CueDirector((match) => {
      this.director.cue(match.entityId);
    });

    this.initEvents();
    this.start();
  }

  private checkReducedMotion() {
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private initEvents() {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('deviceorientation', this.onDeviceOrientation);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    // Initialize sound on first user gesture anywhere
    const onUserInteraction = () => {
      soundDesign.initOnUserGesture();
      window.removeEventListener('pointerdown', onUserInteraction);
      window.removeEventListener('keydown', onUserInteraction);
    };
    window.addEventListener('pointerdown', onUserInteraction);
    window.addEventListener('keydown', onUserInteraction);

    // Subscribe to event bus
    this.unsubscribes.push(
      bus.on('state', (state: PresenceState) => {
        this.presence.setState(state);
      }),
      bus.on('level', (levels: AudioLevels) => {
        this.audioLevels = levels;
      }),
      bus.on('micLevel', (level: number) => {
        this.micLevel = level;
      }),
      bus.on('interrupted', (interrupted: boolean) => {
        if (interrupted) {
          this.presence.triggerHush();
        }
      }),
      bus.on('show_world', (payload: { world: WorldName; params?: any }) => {
        this.director.go(payload.world, payload.params);
      })
    );
  }

  private onResize = () => {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
    this.bloomPass.setSize(width, height);
    this.grain.resize(width, height);
  };

  private onMouseMove = (e: MouseEvent) => {
    if (this.prefersReducedMotion) return;
    this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    // Parallax +/- 3 deg
    this.targetRotY = this.mouseX * 0.052;
    this.targetRotX = -this.mouseY * 0.052;
  };

  private onDeviceOrientation = (e: DeviceOrientationEvent) => {
    if (this.prefersReducedMotion) return;
    if (e.gamma !== null && e.beta !== null) {
      const clampedGamma = Math.max(-30, Math.min(30, e.gamma));
      const clampedBeta = Math.max(-30, Math.min(30, e.beta - 45));
      this.targetRotY = (clampedGamma / 30) * 0.052;
      this.targetRotX = (clampedBeta / 30) * 0.052;
    }
  };

  private onVisibilityChange = () => {
    if (document.hidden) {
      this.isPaused = true;
    } else {
      this.isPaused = false;
      this.clock.getDelta(); // reset delta
      if (this.isRunning) {
        this.loop();
      }
    }
  };

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();
    this.loop();
  }

  public stop() {
    this.isRunning = false;
    cancelAnimationFrame(this.animationFrameId);
  }

  private loop = () => {
    if (!this.isRunning || this.isPaused) return;

    this.animationFrameId = requestAnimationFrame(this.loop);

    const now = performance.now();
    this.perfMonitor.recordFrame(now);

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    // Camera sinusoidal breathing (+/- 1.5% over 8s)
    if (!this.prefersReducedMotion) {
      const breathing = Math.sin((elapsedTime / 8) * Math.PI * 2) * 0.048;
      const timelineZOffset = this.director.timelineWorld ? this.director.timelineWorld.cameraOffsetZ * 0.25 : 0;
      this.camera.position.z = this.cameraBaseZ + breathing + timelineZOffset;

      // Smooth camera parallax
      this.currentRotX += (this.targetRotX - this.currentRotX) * (delta * 4.0);
      this.currentRotY += (this.targetRotY - this.currentRotY) * (delta * 4.0);
      this.camera.rotation.x = this.currentRotX;
      this.camera.rotation.y = this.currentRotY;
    }

    // Update SceneDirector
    this.director.update(delta, this.audioLevels, this.micLevel, this.prefersReducedMotion);

    // Dynamic bloom pass modulation
    this.bloomPass.strength = this.presence.currentBloom;

    // Render post-processed scene
    this.composer.render();

    // Update film grain
    this.grain.update(now);
  };

  public dispose() {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('deviceorientation', this.onDeviceOrientation);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.unsubscribes.forEach((unsub) => unsub());

    this.director.dispose();
    this.presence.dispose();
    this.renderer.dispose();
    if (this.canvas3d.parentElement) {
      this.canvas3d.parentElement.removeChild(this.canvas3d);
    }
    if (this.canvas2d.parentElement) {
      this.canvas2d.parentElement.removeChild(this.canvas2d);
    }
  }
}
