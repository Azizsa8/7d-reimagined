import * as THREE from 'three';
import { AudioLevels } from '../../state/bus';
import { soundDesign } from '../audio/SoundDesign';
import { ProjectRecord } from '../../kb/client';

export interface ProjectOverlayData {
  name: string;
  location: string;
  role: string;
  isConcept: boolean;
  opacity: number;
  pulseFact: boolean;
}

export class ProjectWorld {
  public group: THREE.Group;
  private screenMesh!: THREE.Mesh;
  private screenMat!: THREE.ShaderMaterial;
  private textureLoader = new THREE.TextureLoader();

  private currentTexture: THREE.Texture | null = null;
  private currentProject: ProjectRecord | null = null;
  private activeLang: 'en' | 'ar' = 'en';

  // Ken Burns push-in & Parallax
  private kenBurnsTime = 0;
  private pointerTilt = new THREE.Vector2(0, 0);
  private targetTilt = new THREE.Vector2(0, 0);

  // Overlay state
  public overlay: ProjectOverlayData = {
    name: '',
    location: '',
    role: '',
    isConcept: false,
    opacity: 0,
    pulseFact: false,
  };
  private pulseTimer = 0;

  // Particle grid sampling
  public sampledGridPositions: Float32Array | null = null;
  public sampledGridColors: Float32Array | null = null;

  constructor() {
    this.group = new THREE.Group();
    this.createCinemaScreen();
    this.initPointerListeners();
  }

  private initPointerListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('pointermove', (e) => {
        const x = (e.clientX / window.innerWidth) * 2 - 1;
        const y = -(e.clientY / window.innerHeight) * 2 + 1;
        this.targetTilt.set(x, y);
      });
    }
  }

  private createCinemaScreen() {
    // Slightly curved cinema screen plane (subdivided grid curved along cylinder)
    const width = 3.2;
    const height = 1.8;
    const segX = 40;
    const segY = 24;
    const geom = new THREE.PlaneGeometry(width, height, segX, segY);

    // Curve screen backward at the left and right edges
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const zCurve = -(x * x) * 0.08;
      pos.setZ(i, zCurve);
    }
    geom.computeVertexNormals();

    this.screenMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        tPhoto: { value: null },
        uHasPhoto: { value: 0.0 },
        uKenBurnsScale: { value: 1.06 },
        uTilt: { value: new THREE.Vector2(0, 0) },
        uOpacity: { value: 0.0 },
        uTime: { value: 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tPhoto;
        uniform float uHasPhoto;
        uniform float uKenBurnsScale;
        uniform vec2 uTilt;
        uniform float uOpacity;
        uniform float uTime;

        varying vec2 vUv;

        void main() {
          // Center-anchored Ken Burns scale
          vec2 centeredUv = (vUv - 0.5) / uKenBurnsScale + 0.5;

          // Parallax depth calculation:
          // Vertical gradient blended with inverted luminance for foreground pop
          float depth = (1.0 - centeredUv.y) * 0.7;
          vec2 parallaxOffset = depth * uTilt * 0.015;
          vec2 finalUv = clamp(centeredUv + parallaxOffset, 0.001, 0.999);

          vec4 color = vec4(0.04, 0.05, 0.07, 1.0);

          if (uHasPhoto > 0.5) {
            vec4 tex = texture2D(tPhoto, finalUv);
            // Vignette edge softening
            float distFromCenter = length(vUv - vec2(0.5));
            float edgeFade = 1.0 - smoothstep(0.45, 0.72, distFromCenter);
            color = vec4(tex.rgb, tex.a * edgeFade * uOpacity);
          } else {
            // Typographic volumetric light sweep fallback
            float sweep = sin(finalUv.x * 3.0 + finalUv.y * 2.0 - uTime * 1.5);
            vec3 brass = vec3(0.878, 0.663, 0.290);
            vec3 ambient = vec3(0.06, 0.07, 0.09) + brass * 0.15 * max(0.0, sweep);
            color = vec4(ambient, uOpacity * 0.85);
          }

          gl_FragColor = color;
        }
      `,
    });

    this.screenMesh = new THREE.Mesh(geom, this.screenMat);
    this.screenMesh.position.set(0, 0, -0.4);
    this.group.add(this.screenMesh);
  }

  public setProject(project: ProjectRecord, lang: 'en' | 'ar' = 'en') {
    this.currentProject = project;
    this.activeLang = lang;
    const isAr = lang === 'ar';

    this.overlay = {
      name: isAr ? project.name_ar : project.name,
      location: isAr ? (project.location_ar || project.location) : project.location,
      role: isAr ? project.role_as_stated_ar : project.role_as_stated,
      isConcept: !!project.is_concept,
      opacity: 0,
      pulseFact: false,
    };

    // Load project image
    const imagePath = project.hero_image;
    if (imagePath) {
      this.textureLoader.load(
        imagePath,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.minFilter = THREE.LinearFilter;
          tex.generateMipmaps = false;
          this.currentTexture = tex;
          this.screenMat.uniforms.tPhoto.value = tex;
          this.screenMat.uniforms.uHasPhoto.value = 1.0;
          this.sampleImageToGrid(tex);
        },
        undefined,
        () => {
          this.screenMat.uniforms.uHasPhoto.value = 0.0;
        }
      );
    } else {
      this.screenMat.uniforms.uHasPhoto.value = 0.0;
    }

    this.kenBurnsTime = 0;
  }

  private sampleImageToGrid(texture: THREE.Texture) {
    if (!texture.image) return;
    const img = texture.image;
    const canvas = document.createElement('canvas');
    const cols = 160;
    const rows = 90;
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img as CanvasImageSource, 0, 0, cols, rows);
    const imgData = ctx.getImageData(0, 0, cols, rows).data;

    const count = cols * rows;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const screenW = 3.0;
    const screenH = 1.7;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const pixelIdx = idx * 4;

        // Screen plane coordinates
        const x = (c / (cols - 1) - 0.5) * screenW;
        const y = -(r / (rows - 1) - 0.5) * screenH;
        const z = -0.35;

        positions[idx * 3] = x;
        positions[idx * 3 + 1] = y;
        positions[idx * 3 + 2] = z;

        colors[idx * 3] = imgData[pixelIdx] / 255;
        colors[idx * 3 + 1] = imgData[pixelIdx + 1] / 255;
        colors[idx * 3 + 2] = imgData[pixelIdx + 2] / 255;
      }
    }

    this.sampledGridPositions = positions;
    this.sampledGridColors = colors;
  }

  public cue(key: string) {
    // Pulse title block accent line on key facts
    this.overlay.pulseFact = true;
    this.pulseTimer = 0.6;
    soundDesign.playGlassTone();
  }

  public enter(params: any, lang: 'en' | 'ar') {
    this.group.visible = true;
    this.activeLang = lang;
    soundDesign.setWorldMotif('project');

    if (params?.record) {
      this.setProject(params.record, lang);
    }
  }

  public exit() {
    this.overlay.opacity = 0;
    this.screenMat.uniforms.uOpacity.value = 0;
  }

  public update(dt: number, _audio: AudioLevels) {
    this.kenBurnsTime += dt;

    // Slow push-in: 1.06 -> 1.0 over 9s
    const kbProgress = Math.min(1.0, this.kenBurnsTime / 9.0);
    const kbScale = THREE.MathUtils.lerp(1.06, 1.0, kbProgress);
    this.screenMat.uniforms.uKenBurnsScale.value = kbScale;
    this.screenMat.uniforms.uTime.value = this.kenBurnsTime;

    // Fade in cinema screen and overlay
    const targetOp = 1.0;
    const currOp = this.screenMat.uniforms.uOpacity.value;
    const newOp = currOp + (targetOp - currOp) * (dt * 3.0);
    this.screenMat.uniforms.uOpacity.value = newOp;
    this.overlay.opacity = newOp;

    // Tilt smoothing
    this.pointerTilt.lerp(this.targetTilt, dt * 4.0);
    this.screenMat.uniforms.uTilt.value.copy(this.pointerTilt);

    // Pulse timer
    if (this.pulseTimer > 0) {
      this.pulseTimer -= dt;
      if (this.pulseTimer <= 0) {
        this.overlay.pulseFact = false;
      }
    }
  }

  public dispose() {
    this.screenMesh.geometry.dispose();
    (this.screenMesh.material as THREE.Material).dispose();
  }
}
