import * as THREE from 'three';
import type { World, WorldCtx, CameraWish } from './World';
import type { AudioLevels } from '../../state/bus';
import { soundDesign } from '../audio/SoundDesign';

/** "Talk to the team" — the stage dims; the glass card is HTML (tappable rows). */
export class ContactWorld implements World {
  readonly name = 'contact' as const;
  readonly group = new THREE.Group();
  private ctx: WorldCtx | null = null;
  private veil: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private opacity = 0;
  private opacityTarget = 1;

  constructor() {
    this.veil = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: 0x050608, transparent: true, opacity: 0, depthWrite: false }));
    this.veil.position.z = -0.5;
    this.group.add(this.veil);
  }

  enter(_params: Record<string, any>, ctx: WorldCtx) {
    this.ctx = ctx;
    this.opacityTarget = 1;
    const c = ctx.kb.contact;
    const lang = ctx.lang;
    ctx.notify({
      email: c.email,
      phone: c.phone,
      website: c.website,
      websiteLabel: c.website.replace(/^https?:\/\//, ''),
      offices: c.offices[lang],
      chairman: 'chairman@7dint.net',
    });
    soundDesign.glass();
  }

  cue() {}
  exit() {
    this.opacityTarget = 0;
  }
  camera(): CameraWish {
    return { dolly: 1, target: new THREE.Vector3(), exposure: 0.85 };
  }
  update(dt: number, _a: AudioLevels) {
    this.opacity += (this.opacityTarget - this.opacity) * Math.min(1, dt * 4);
    this.veil.material.opacity = this.opacity * 0.55;
  }
  dispose() {
    this.veil.geometry.dispose();
    this.veil.material.dispose();
  }
}
