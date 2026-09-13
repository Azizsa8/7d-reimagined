import * as THREE from 'three';
import { presenceVertexShader } from '../shaders/presence.vert.glsl';
import { presenceFragmentShader } from '../shaders/presence.frag.glsl';
import { AudioLevels } from '../../state/bus';
import { PresenceState, PARTICLE_COUNT_DESKTOP, PARTICLE_COUNT_MOBILE } from '../../config';

export class Presence {
  public group: THREE.Group;
  private points: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  private rings: THREE.LineLoop[] = [];

  // State & animation targets
  private currentState: PresenceState = 'idle';
  private targetRadius = 0.85;
  private currentRadius = 0.85;

  private targetNoiseSpeed = 0.15;
  private currentNoiseSpeed = 0.15;

  private targetFlatten = 0.0;
  private currentFlatten = 0.0;

  private targetTealTint = 0.0;
  private currentTealTint = 0.0;

  public targetBloom = 0.5;
  public currentBloom = 0.5;

  private hushTimer = 0;
  private time = 0;
  private scaleMultiplier = 1.0;
  private targetScaleMultiplier = 1.0;

  // Ember mode (when in non-presence world)
  private isEmber = false;
  private emberProgress = 0.0;
  private targetEmber = 0.0;
  private emberLang: 'en' | 'ar' = 'en';

  // Morph targets
  private targetPositionsAttr!: THREE.BufferAttribute;
  private targetColorsAttr!: THREE.BufferAttribute;
  private delaysAttr!: THREE.BufferAttribute;
  private arcHeightsAttr!: THREE.BufferAttribute;
  public morphProgress = 0.0;
  private targetMorph = 0.0;

  // Audio envelope filters (attack 30ms, release 180ms)
  private envLevel = 0;
  private envLow = 0;
  private envMid = 0;
  private envHigh = 0;
  private envMic = 0;

  constructor(isMobile: boolean = false) {
    this.group = new THREE.Group();

    const particleCount = isMobile ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP;
    const positions = new Float32Array(particleCount * 3);
    const sparks = new Float32Array(particleCount);
    const randoms = new Float32Array(particleCount);

    const targetPositions = new Float32Array(particleCount * 3);
    const targetColors = new Float32Array(particleCount * 3);
    const delays = new Float32Array(particleCount);
    const arcHeights = new Float32Array(particleCount);

    // Fibonacci sphere distribution
    const phi = Math.PI * (3 - Math.sqrt(5)); // golden angle in radians

    for (let i = 0; i < particleCount; i++) {
      const y = 1 - (i / (particleCount - 1)) * 2; // y goes from 1 to -1
      const radiusAtY = Math.sqrt(1 - y * y); // radius at y
      const theta = phi * i; // golden angle increment

      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      targetPositions[i * 3] = x;
      targetPositions[i * 3 + 1] = y;
      targetPositions[i * 3 + 2] = z;

      targetColors[i * 3] = 0.878;
      targetColors[i * 3 + 1] = 0.663;
      targetColors[i * 3 + 2] = 0.290;

      // Random delay (0 to 0.35s) so particles don't move as a block
      delays[i] = Math.random() * 0.35;
      arcHeights[i] = (Math.random() - 0.5) * 0.8;

      // 2% rare teal sparks
      sparks[i] = Math.random() < 0.02 ? 1.0 : 0.0;
      randoms[i] = Math.random();
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('aSpark', new THREE.BufferAttribute(sparks, 1));
    this.geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

    this.targetPositionsAttr = new THREE.BufferAttribute(targetPositions, 3);
    this.targetColorsAttr = new THREE.BufferAttribute(targetColors, 3);
    this.delaysAttr = new THREE.BufferAttribute(delays, 1);
    this.arcHeightsAttr = new THREE.BufferAttribute(arcHeights, 1);

    this.geometry.setAttribute('aTargetPos', this.targetPositionsAttr);
    this.geometry.setAttribute('aTargetColor', this.targetColorsAttr);
    this.geometry.setAttribute('aDelay', this.delaysAttr);
    this.geometry.setAttribute('aArcHeight', this.arcHeightsAttr);

    this.material = new THREE.ShaderMaterial({
      vertexShader: presenceVertexShader,
      fragmentShader: presenceFragmentShader,
      transparent: true,
      depthWrite: false,
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
        uSweepPos: { value: 0 },
        uPointSize: { value: isMobile ? 18.0 : 24.0 },
        uTealTint: { value: 0 },
        uMorph: { value: 0 },
      },
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.group.add(this.points);

    // Three thin orbit rings (line loops, 256 segments, 8% opacity)
    this.createOrbitRings();
  }

  private createOrbitRings() {
    const ringRadii = [1.35, 1.55, 1.75];
    const ringTilts = [
      { x: 0.35, y: 0.2, z: 0.1 },
      { x: -0.4, y: 0.5, z: -0.3 },
      { x: 0.15, y: -0.6, z: 0.4 },
    ];

    ringRadii.forEach((radius, i) => {
      const segments = 256;
      const pts: THREE.Vector3[] = [];
      for (let s = 0; s <= segments; s++) {
        const theta = (s / segments) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius));
      }
      const ringGeom = new THREE.BufferGeometry().setFromPoints(pts);
      const ringMat = new THREE.LineBasicMaterial({
        color: 0xC8AA7C, // sand accent
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const ring = new THREE.LineLoop(ringGeom, ringMat);
      ring.rotation.set(ringTilts[i].x, ringTilts[i].y, ringTilts[i].z);
      this.rings.push(ring);
      this.group.add(ring);
    });
  }

  public setEmberMode(ember: boolean, lang: 'en' | 'ar' = 'en') {
    this.isEmber = ember;
    this.targetEmber = ember ? 1.0 : 0.0;
    this.emberLang = lang;
  }

  public setMorphTarget(positions: Float32Array, colors?: Float32Array) {
    const count = this.targetPositionsAttr.count;
    const posArr = this.targetPositionsAttr.array as Float32Array;
    const colArr = this.targetColorsAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const srcIdx = (i % (positions.length / 3)) * 3;
      posArr[i * 3] = positions[srcIdx];
      posArr[i * 3 + 1] = positions[srcIdx + 1];
      posArr[i * 3 + 2] = positions[srcIdx + 2];

      if (colors && colors.length > 0) {
        colArr[i * 3] = colors[srcIdx];
        colArr[i * 3 + 1] = colors[srcIdx + 1];
        colArr[i * 3 + 2] = colors[srcIdx + 2];
      }
    }
    this.targetPositionsAttr.needsUpdate = true;
    this.targetColorsAttr.needsUpdate = true;
  }

  public setMorphProgress(p: number) {
    this.targetMorph = Math.max(0.0, Math.min(1.0, p));
  }

  public setState(state: PresenceState) {
    this.currentState = state;
    switch (state) {
      case 'idle':
        this.targetRadius = 0.85;
        this.targetNoiseSpeed = 0.15;
        this.targetFlatten = 0.0;
        this.targetTealTint = 0.0;
        this.targetBloom = 0.5;
        break;
      case 'listening':
        this.targetRadius = 0.92;
        this.targetNoiseSpeed = 0.25;
        this.targetFlatten = 1.0;
        this.targetTealTint = 0.20; // 20% teal rim tint
        this.targetBloom = 0.7;
        break;
      case 'thinking':
        this.targetRadius = 0.90;
        this.targetNoiseSpeed = 0.60;
        this.targetFlatten = 0.2;
        this.targetTealTint = 0.05;
        this.targetBloom = 0.8;
        break;
      case 'speaking':
        this.targetRadius = 1.0;
        this.targetNoiseSpeed = 0.35;
        this.targetFlatten = 0.0;
        this.targetTealTint = 0.0;
        this.targetBloom = 0.9;
        break;
    }
  }

  public setDisplayScale(scale: number) {
    this.targetScaleMultiplier = scale;
  }

  public triggerHush() {
    this.hushTimer = 0.25; // 250 ms hush
  }

  public update(
    delta: number,
    audioLevels: AudioLevels,
    micLevel: number,
    prefersReducedMotion: boolean = false
  ) {
    this.time += delta;

    // Critically damped spring transition factor (~220ms responsiveness)
    const springFactor = Math.min(1.0, delta * 8.5);

    // Envelope followers for audio (attack 30ms, release 180ms)
    const attack = Math.min(1.0, delta / 0.03);
    const release = Math.min(1.0, delta / 0.18);

    const updateEnv = (current: number, target: number) => {
      return target > current
        ? current + (target - current) * attack
        : current + (target - current) * release;
    };

    this.envLevel = updateEnv(this.envLevel, audioLevels.rms);
    this.envLow = updateEnv(this.envLow, audioLevels.low);
    this.envMid = updateEnv(this.envMid, audioLevels.mid);
    this.envHigh = updateEnv(this.envHigh, audioLevels.high);
    this.envMic = updateEnv(this.envMic, micLevel);

    // Spring transitions for state variables
    this.currentRadius += (this.targetRadius - this.currentRadius) * springFactor;
    this.currentNoiseSpeed += (this.targetNoiseSpeed - this.currentNoiseSpeed) * springFactor;
    this.currentFlatten += (this.targetFlatten - this.currentFlatten) * springFactor;
    this.currentTealTint += (this.targetTealTint - this.currentTealTint) * springFactor;
    this.scaleMultiplier += (this.targetScaleMultiplier - this.scaleMultiplier) * springFactor;
    this.morphProgress += (this.targetMorph - this.morphProgress) * springFactor;
    this.emberProgress += (this.targetEmber - this.emberProgress) * (delta * 4.0);

    // Ember position & scale interpolation (64px particle sphere in top corner)
    const emberTargetX = this.emberLang === 'ar' ? -1.45 : 1.45;
    const emberTargetY = 1.15;
    this.group.position.x = THREE.MathUtils.lerp(0, emberTargetX, this.emberProgress);
    this.group.position.y = THREE.MathUtils.lerp(0, emberTargetY, this.emberProgress);
    const effectiveScale = THREE.MathUtils.lerp(1.0, 0.12, this.emberProgress) * this.scaleMultiplier;

    // Orbit rings fade when in ember mode
    const ringOpacity = (1.0 - this.emberProgress) * 0.08;
    this.rings.forEach((ring) => {
      (ring.material as THREE.LineBasicMaterial).opacity = ringOpacity;
    });

    // Bloom modulation: in speaking state, bloom follows loudness (0.7 -> 1.3)
    if (this.currentState === 'speaking') {
      const loudnessBloom = 0.7 + this.envLevel * 0.6;
      this.currentBloom += (loudnessBloom - this.currentBloom) * springFactor;
    } else {
      this.currentBloom += (this.targetBloom - this.currentBloom) * springFactor;
    }

    // Hush decay
    let hushValue = 0;
    if (this.hushTimer > 0) {
      this.hushTimer -= delta;
      hushValue = Math.max(0, this.hushTimer / 0.25);
    }

    // Latitude sweep for thinking state (period 1.2s)
    let sweepPos = -999.0;
    if (this.currentState === 'thinking') {
      sweepPos = Math.sin((this.time / 1.2) * Math.PI * 2) * 0.9;
    }

    // Update uniforms
    const u = this.material.uniforms;
    u.uTime.value = this.time;
    u.uRadius.value = this.currentRadius * effectiveScale;
    u.uNoiseSpeed.value = prefersReducedMotion ? 0.05 : this.currentNoiseSpeed;
    u.uLevel.value = this.envLevel;
    u.uLow.value = this.envLow;
    u.uMid.value = this.envMid;
    u.uHigh.value = this.envHigh;
    u.uMicLevel.value = this.envMic;
    u.uFlatten.value = this.currentFlatten;
    u.uHush.value = hushValue;
    u.uSweepPos.value = sweepPos;
    u.uTealTint.value = this.currentTealTint;
    u.uMorph.value = this.morphProgress;

    // Slowly rotate orbit rings
    if (!prefersReducedMotion && this.emberProgress < 0.95) {
      this.rings.forEach((ring, i) => {
        const dir = i % 2 === 0 ? 1 : -1;
        ring.rotation.y += delta * 0.04 * dir * (i + 1) * 0.6;
        ring.rotation.x += delta * 0.02 * dir;
      });
    }
  }

  public dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.rings.forEach((r) => {
      r.geometry.dispose();
      (r.material as THREE.Material).dispose();
    });
  }
}
