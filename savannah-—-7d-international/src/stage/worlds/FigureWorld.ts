import * as THREE from 'three';
import { AudioLevels } from '../../state/bus';
import { soundDesign } from '../audio/SoundDesign';
import { FigureRecord } from '../../kb/client';

export interface FigureOverlayData {
  value: string;
  label: string;
  detail: string;
  opacity: number;
}

export class FigureWorld {
  public group: THREE.Group;
  private pointsMesh!: THREE.Points;
  private geometry!: THREE.BufferGeometry;
  private currentFigure: FigureRecord | null = null;
  private activeLang: 'en' | 'ar' = 'en';

  public overlay: FigureOverlayData = {
    value: '1993',
    label: 'Founded in Tampa, Florida',
    detail: 'Over three decades of architectural excellence.',
    opacity: 0,
  };

  public sampledDigitPositions: Float32Array | null = null;
  public sampledDigitColors: Float32Array | null = null;
  private time = 0;

  constructor() {
    this.group = new THREE.Group();
    this.createDigitPoints();
  }

  private createDigitPoints() {
    const count = 12000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 1.2;
      positions[i * 3 + 2] = 0;

      colors[i * 3] = 0.878;
      colors[i * 3 + 1] = 0.663;
      colors[i * 3 + 2] = 0.290;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.024,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.pointsMesh = new THREE.Points(this.geometry, mat);
    this.group.add(this.pointsMesh);
  }

  public setFigure(fig: FigureRecord, lang: 'en' | 'ar' = 'en') {
    this.currentFigure = fig;
    this.activeLang = lang;
    const isAr = lang === 'ar';

    // Format Arabic-Indic digits if Arabic
    let displayVal = fig.value;
    if (isAr) {
      if (fig.id === 'fig-1993') displayVal = '١٩٩٣';
      else if (fig.id === 'fig-80m') displayVal = '٨٠ مليون$';
      else if (fig.id === 'fig-1500-base-stations') displayVal = '+١,٥٠٠';
      else if (fig.id === 'fig-5-hubs') displayVal = '٥';
      else if (fig.id === 'fig-7-disciplines') displayVal = '٧';
    }

    this.overlay = {
      value: displayVal,
      label: isAr ? fig.label_ar : fig.label,
      detail: isAr ? fig.detail_ar : fig.detail,
      opacity: 1.0,
    };

    // Render offscreen canvas and sample target points
    this.sampleTextPoints(displayVal);
    soundDesign.playSettleTone();
  }

  private sampleTextPoints(text: string) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 220px Michroma, sans-serif';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const hitCoords: [number, number][] = [];

    // Step across pixels
    const step = 4;
    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < canvas.width; x += step) {
        const idx = (y * canvas.width + x) * 4;
        if (imgData[idx] > 128) {
          // Normalize to world space centered at (0, 0.1)
          const wx = (x / canvas.width - 0.5) * 2.8;
          const wy = -(y / canvas.height - 0.5) * 1.4 + 0.1;
          hitCoords.push([wx, wy]);
        }
      }
    }

    if (hitCoords.length === 0) return;

    const count = this.geometry.attributes.position.count;
    const posArr = this.geometry.attributes.position.array as Float32Array;
    const colArr = this.geometry.attributes.color.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const coord = hitCoords[i % hitCoords.length];
      // Slight jitter
      const jx = coord[0] + (Math.random() - 0.5) * 0.03;
      const jy = coord[1] + (Math.random() - 0.5) * 0.03;
      const jz = (Math.random() - 0.5) * 0.08;

      posArr[i * 3] = jx;
      posArr[i * 3 + 1] = jy;
      posArr[i * 3 + 2] = jz;

      // Brass gradient with ivory highlights
      colArr[i * 3] = 0.878 + Math.random() * 0.1;
      colArr[i * 3 + 1] = 0.663 + Math.random() * 0.1;
      colArr[i * 3 + 2] = 0.290 + Math.random() * 0.1;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;

    this.sampledDigitPositions = posArr;
    this.sampledDigitColors = colArr;
  }

  public cue(key: string) {
    // Cue matched figure alias
    soundDesign.playSettleTone();
  }

  public enter(params: any, lang: 'en' | 'ar') {
    this.group.visible = true;
    this.activeLang = lang;
    soundDesign.setWorldMotif('figure');

    if (params?.fig) {
      this.setFigure(params.fig, lang);
    }
  }

  public exit() {
    this.overlay.opacity = 0;
  }

  public update(dt: number, audio: AudioLevels) {
    this.time += dt;

    // Subtle vibration on audio swell
    const swell = audio.rms * 0.03;
    this.pointsMesh.position.y = Math.sin(this.time * 3.0) * 0.015 + (Math.random() - 0.5) * swell;
    this.pointsMesh.position.x = (Math.random() - 0.5) * swell;
  }

  public dispose() {
    this.geometry.dispose();
    (this.pointsMesh.material as THREE.Material).dispose();
  }
}
