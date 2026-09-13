import * as THREE from 'three';
import { AudioLevels } from '../../state/bus';
import { soundDesign } from '../audio/SoundDesign';
import { ContactData } from '../../kb/client';

export interface ContactOverlayData {
  generalEmail: string;
  chairmanEmail: string;
  website: string;
  riyadhOffice: string;
  floridaOffice: string;
  opacity: number;
}

export class ContactWorld {
  public group: THREE.Group;
  private cardMesh!: THREE.Mesh;

  public overlay: ContactOverlayData = {
    generalEmail: 'info@7dint.net',
    chairmanEmail: 'chairman@7dint.net',
    website: 'https://7dint.net',
    riyadhOffice: 'Riyadh, Kingdom of Saudi Arabia',
    floridaOffice: 'Tampa, Florida, USA',
    opacity: 0,
  };
  private targetOpacity = 0;
  private activeLang: 'en' | 'ar' = 'en';
  private time = 0;

  constructor() {
    this.group = new THREE.Group();
    this.createGlassCard();
  }

  private createGlassCard() {
    // 3D Glass card backdrop
    const geom = new THREE.PlaneGeometry(2.4, 2.8, 16, 16);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uOpacity: { value: 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          // Glass edge border glow
          float borderDist = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
          float border = smoothstep(0.015, 0.0, borderDist);

          vec3 brass = vec3(0.878, 0.663, 0.290);
          vec3 glass = vec3(0.06, 0.08, 0.11);
          vec3 col = mix(glass, brass, border * 0.4);

          gl_FragColor = vec4(col, uOpacity * (0.85 + border * 0.15));
        }
      `,
    });

    this.cardMesh = new THREE.Mesh(geom, mat);
    this.cardMesh.position.set(0, 0, -0.2);
    this.group.add(this.cardMesh);
  }

  public setContact(contact: ContactData, lang: 'en' | 'ar' = 'en') {
    this.activeLang = lang;
    const isAr = lang === 'ar';

    this.overlay = {
      generalEmail: contact.general_email,
      chairmanEmail: contact.chairman_email,
      website: contact.website,
      riyadhOffice: isAr ? contact.riyadh_office_ar : contact.riyadh_office,
      floridaOffice: isAr ? contact.florida_office_ar : contact.florida_office,
      opacity: 1.0,
    };
    this.targetOpacity = 1.0;
  }

  public cue(_key: string) {
    soundDesign.playGlassTone();
  }

  public enter(params: any, lang: 'en' | 'ar') {
    this.group.visible = true;
    this.activeLang = lang;
    soundDesign.playGlassTone();

    if (params?.contact) {
      this.setContact(params.contact, lang);
    }
  }

  public exit() {
    this.targetOpacity = 0;
  }

  public update(dt: number, _audio: AudioLevels) {
    this.time += dt;

    // Card gentle floating
    this.cardMesh.position.y = Math.sin(this.time * 1.5) * 0.02;

    // Opacity interpolation
    this.overlay.opacity += (this.targetOpacity - this.overlay.opacity) * (dt * 4.0);
    (this.cardMesh.material as THREE.ShaderMaterial).uniforms.uOpacity.value = this.overlay.opacity;
  }

  public dispose() {
    this.cardMesh.geometry.dispose();
    (this.cardMesh.material as THREE.Material).dispose();
  }
}
