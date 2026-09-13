import * as THREE from 'three';
import { AudioLevels } from '../../state/bus';
import { soundDesign } from '../audio/SoundDesign';
import { TimelineRecord } from '../../kb/client';

export interface MilestoneOverlayData {
  year: string;
  title: string;
  detail: string;
  opacity: number;
}

export class TimelineWorld {
  public group: THREE.Group;
  private ribbonMesh!: THREE.Mesh;
  private ribbonMat!: THREE.ShaderMaterial;
  private markersGroup: THREE.Group;
  private markerObjects: Array<{
    id: string;
    year: string;
    record: TimelineRecord;
    mesh: THREE.Mesh;
    ring: THREE.Mesh;
    pos: THREE.Vector3;
    splineT: number;
  }> = [];

  private splineCurve!: THREE.CatmullRomCurve3;
  private activeMilestoneIndex = 0;
  private targetCameraZ = 2.4;
  public cameraOffsetZ = 0;

  public overlay: MilestoneOverlayData = {
    year: '1993',
    title: 'Founded in Tampa, Florida',
    detail: '7D begins in the United States with architectural engineering.',
    opacity: 0,
  };
  private activeLang: 'en' | 'ar' = 'en';
  private time = 0;

  constructor() {
    this.group = new THREE.Group();
    this.markersGroup = new THREE.Group();
    this.group.add(this.markersGroup);

    this.createRibbon();
  }

  private createRibbon() {
    // S-curve spline receding into depth
    const points: THREE.Vector3[] = [
      new THREE.Vector3(0, -0.9, 1.2),
      new THREE.Vector3(0.4, -0.6, 0.4),
      new THREE.Vector3(-0.35, -0.3, -0.6),
      new THREE.Vector3(0.3, 0.0, -1.8),
      new THREE.Vector3(-0.2, 0.2, -3.0),
      new THREE.Vector3(0, 0.4, -4.5),
    ];

    this.splineCurve = new THREE.CatmullRomCurve3(points);
    const tubeGeom = new THREE.TubeGeometry(this.splineCurve, 120, 0.035, 12, false);

    // Flowing ribbon shader: light bands moving along length
    this.ribbonMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 }, // draw-on progress 0 -> 1
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uProgress;
        varying vec2 vUv;

        void main() {
          if (vUv.x > uProgress) discard;

          // Travelling light pulses
          float pulse = sin(vUv.x * 24.0 - uTime * 4.0);
          float band = smoothstep(0.4, 0.95, pulse);

          vec3 brass = vec3(0.878, 0.663, 0.290);
          vec3 sand = vec3(0.784, 0.667, 0.486);
          vec3 col = mix(sand * 0.4, brass * 1.5, band);

          float edgeFade = 1.0 - smoothstep(0.8, 1.0, vUv.x);
          gl_FragColor = vec4(col, (0.3 + band * 0.6) * edgeFade);
        }
      `,
    });

    this.ribbonMesh = new THREE.Mesh(tubeGeom, this.ribbonMat);
    this.group.add(this.ribbonMesh);
  }

  public setTimelineData(records: TimelineRecord[], lang: 'en' | 'ar' = 'en') {
    this.activeLang = lang;
    // Clear old markers
    while (this.markersGroup.children.length > 0) {
      const c = this.markersGroup.children[0] as THREE.Mesh;
      this.markersGroup.remove(c);
      if (c.geometry) c.geometry.dispose();
      if (c.material) (c.material as THREE.Material).dispose();
    }
    this.markerObjects = [];

    const numRecords = records.length;
    records.forEach((rec, i) => {
      const t = 0.08 + (i / (numRecords - 1)) * 0.84;
      const pt = this.splineCurve.getPoint(t);

      // Marker ring hovering slightly above ribbon
      const ringGeom = new THREE.TorusGeometry(0.085, 0.012, 16, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xE0A94A,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.copy(pt).add(new THREE.Vector3(0, 0.12, 0));
      ring.rotation.x = Math.PI / 4;

      // Inner glowing core
      const coreGeom = new THREE.SphereGeometry(0.025, 16, 16);
      const coreMat = new THREE.MeshBasicMaterial({ color: 0xF4F1EA });
      const core = new THREE.Mesh(coreGeom, coreMat);
      core.position.copy(ring.position);

      this.markersGroup.add(ring);
      this.markersGroup.add(core);

      this.markerObjects.push({
        id: String(rec.id || rec.year),
        year: String(rec.year),
        record: rec,
        mesh: core,
        ring: ring,
        pos: ring.position,
        splineT: t,
      });
    });

    this.focusIndex(0);
  }

  public focusYear(yearQuery: string) {
    const idx = this.markerObjects.findIndex((m) => m.year.includes(yearQuery) || m.id.includes(yearQuery));
    if (idx !== -1) {
      this.focusIndex(idx);
    }
  }

  public focusIndex(index: number) {
    if (index < 0 || index >= this.markerObjects.length) return;
    this.activeMilestoneIndex = index;
    const target = this.markerObjects[index];
    const rec = target.record;
    const isAr = this.activeLang === 'ar';

    this.overlay = {
      year: String(rec.year),
      title: isAr ? rec.title_ar : rec.title_en,
      detail: isAr ? rec.summary_ar : rec.summary_en,
      opacity: 1.0,
    };

    // Camera targets point on ribbon
    this.targetCameraZ = target.pos.z + 1.2;
    soundDesign.playGlassTone();
  }

  public cue(key: string) {
    // Match year or milestone
    const idx = this.markerObjects.findIndex((m) =>
      m.year.includes(key) ||
      m.id.toLowerCase().includes(key.toLowerCase()) ||
      (m.record.aliases || []).some((a) => a.toLowerCase().includes(key.toLowerCase()))
    );
    if (idx !== -1) {
      this.focusIndex(idx);
    }
  }

  public enter(params: any, lang: 'en' | 'ar') {
    this.group.visible = true;
    this.activeLang = lang;
    soundDesign.setWorldMotif('timeline');

    if (params?.records) {
      this.setTimelineData(params.records, lang);
    }
    if (params?.focus_year) {
      this.focusYear(params.focus_year);
    }
    this.ribbonMat.uniforms.uProgress.value = 0;
  }

  public exit() {
    this.overlay.opacity = 0;
  }

  public update(dt: number, _audio: AudioLevels) {
    this.time += dt;

    // Ribbon draw-on animation (0 -> 1 over 1.4s)
    const currProg = this.ribbonMat.uniforms.uProgress.value;
    if (currProg < 1.0) {
      this.ribbonMat.uniforms.uProgress.value = Math.min(1.0, currProg + dt * 0.75);
    }
    this.ribbonMat.uniforms.uTime.value = this.time;

    // Glide camera z-offset
    this.cameraOffsetZ += (this.targetCameraZ - this.cameraOffsetZ) * (dt * 2.5);

    // Animate active marker pulse & others
    this.markerObjects.forEach((m, i) => {
      const isFocused = i === this.activeMilestoneIndex;
      const s = isFocused ? 1.0 + 0.25 * Math.sin(this.time * 5.0) : 0.8;
      m.ring.scale.set(s, s, s);
      (m.ring.material as THREE.MeshBasicMaterial).color.setHex(isFocused ? 0xE0A94A : 0x7A7466);
    });
  }

  public dispose() {
    this.ribbonMesh.geometry.dispose();
    (this.ribbonMesh.material as THREE.Material).dispose();
    this.markersGroup.children.forEach((c) => {
      if ((c as any).geometry) (c as any).geometry.dispose();
      if ((c as any).material) (c as any).material.dispose();
    });
  }
}
