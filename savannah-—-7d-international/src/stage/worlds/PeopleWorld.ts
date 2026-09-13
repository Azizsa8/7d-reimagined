import * as THREE from 'three';
import { AudioLevels } from '../../state/bus';
import { soundDesign } from '../audio/SoundDesign';
import { PersonRecord } from '../../kb/client';

export interface PersonOverlayData {
  name: string;
  nameAr: string;
  title: string;
  bio: string;
  initials: string;
  opacity: number;
}

export class PeopleWorld {
  public group: THREE.Group;
  private starsGroup: THREE.Group;
  private linesMesh!: THREE.LineSegments;
  private personNodes: Array<{
    id: string;
    person: PersonRecord;
    pos: THREE.Vector3;
    starMesh: THREE.Mesh;
    haloMesh: THREE.Mesh;
  }> = [];

  private activePersonId: string = 'roman-kuba';
  public cameraTarget = new THREE.Vector3(0, 0, 0);

  public overlay: PersonOverlayData = {
    name: 'Roman Kuba',
    nameAr: 'رومان كوبا',
    title: 'Chairman & Founder',
    bio: 'Founder of 7D International; architectural visionary leading iconic global landmarks.',
    initials: 'RK',
    opacity: 0,
  };
  private activeLang: 'en' | 'ar' = 'en';
  private time = 0;

  constructor() {
    this.group = new THREE.Group();
    this.starsGroup = new THREE.Group();
    this.group.add(this.starsGroup);
  }

  public setPeople(people: PersonRecord[], lang: 'en' | 'ar' = 'en') {
    this.activeLang = lang;
    while (this.starsGroup.children.length > 0) {
      const c = this.starsGroup.children[0];
      this.starsGroup.remove(c);
      if ((c as any).geometry) (c as any).geometry.dispose();
      if ((c as any).material) (c as any).material.dispose();
    }
    this.personNodes = [];

    const num = people.length;
    // Distribute stars in 3D constellation layout
    people.forEach((p, i) => {
      const angle = (i / num) * Math.PI * 2;
      const radius = 1.0 + (i % 2) * 0.35;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * 0.65;
      const z = (Math.random() - 0.5) * 0.4;
      const pos = new THREE.Vector3(x, y, z);

      // Star point mesh
      const starGeom = new THREE.SphereGeometry(0.045, 16, 16);
      const starMat = new THREE.MeshBasicMaterial({
        color: 0xF4F1EA,
        transparent: true,
        opacity: 0.9,
      });
      const starMesh = new THREE.Mesh(starGeom, starMat);
      starMesh.position.copy(pos);

      // Outer brass halo ring
      const haloGeom = new THREE.RingGeometry(0.07, 0.085, 32);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0xE0A94A,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
      });
      const haloMesh = new THREE.Mesh(haloGeom, haloMat);
      haloMesh.position.copy(pos);

      this.starsGroup.add(starMesh);
      this.starsGroup.add(haloMesh);

      this.personNodes.push({
        id: p.id,
        person: p,
        pos,
        starMesh,
        haloMesh,
      });
    });

    // Constellation connection lines
    const linePts: THREE.Vector3[] = [];
    for (let i = 0; i < this.personNodes.length; i++) {
      for (let j = i + 1; j < this.personNodes.length; j++) {
        // Connect nearby nodes
        if (this.personNodes[i].pos.distanceTo(this.personNodes[j].pos) < 1.4) {
          linePts.push(this.personNodes[i].pos);
          linePts.push(this.personNodes[j].pos);
        }
      }
    }

    const lineGeom = new THREE.BufferGeometry().setFromPoints(linePts);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xC8AA7C,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
    });
    this.linesMesh = new THREE.LineSegments(lineGeom, lineMat);
    this.starsGroup.add(this.linesMesh);

    if (this.personNodes.length > 0) {
      this.focusPerson(this.personNodes[0].id);
    }
  }

  public focusPerson(personId: string) {
    const node = this.personNodes.find((n) => n.id === personId) || this.personNodes[0];
    if (!node) return;
    this.activePersonId = node.id;
    const p = node.person;
    const isAr = this.activeLang === 'ar';

    const words = p.name.split(' ');
    const initials = words.length >= 2 ? `${words[0][0]}${words[1][0]}` : p.name.slice(0, 2);

    this.overlay = {
      name: p.name,
      nameAr: p.name_ar,
      title: isAr ? p.title_ar : (p.title_en || p.title),
      bio: isAr ? p.bio_ar : p.bio_en,
      initials: initials.toUpperCase(),
      opacity: 1.0,
    };

    // Camera target glides towards node
    this.cameraTarget.copy(node.pos);
    soundDesign.playGlassTone();
  }

  public cue(key: string) {
    const node = this.personNodes.find(
      (n) =>
        n.id.toLowerCase().includes(key.toLowerCase()) ||
        n.person.name.toLowerCase().includes(key.toLowerCase()) ||
        (n.person.aliases || []).some((a) => a.toLowerCase().includes(key.toLowerCase()))
    );
    if (node) {
      this.focusPerson(node.id);
    }
  }

  public enter(params: any, lang: 'en' | 'ar') {
    this.group.visible = true;
    this.activeLang = lang;
    soundDesign.setWorldMotif('people');

    if (params?.people) {
      this.setPeople(params.people, lang);
    }
    const focusId = params?.id || 'roman-kuba';
    this.focusPerson(focusId);
  }

  public exit() {
    this.overlay.opacity = 0;
  }

  public update(dt: number, _audio: AudioLevels) {
    this.time += dt;

    // Slow organic drift
    this.starsGroup.rotation.z = Math.sin(this.time * 0.1) * 0.04;
    this.starsGroup.rotation.y = Math.cos(this.time * 0.08) * 0.06;

    // Pulse focused star
    this.personNodes.forEach((n) => {
      const isFocused = n.id === this.activePersonId;
      const pulse = isFocused ? 1.0 + 0.3 * Math.sin(this.time * 4.0) : 0.9;
      n.haloMesh.scale.set(pulse, pulse, 1);
      (n.haloMesh.material as THREE.MeshBasicMaterial).opacity = isFocused ? 0.95 : 0.35;
      (n.starMesh.material as THREE.MeshBasicMaterial).color.setHex(isFocused ? 0xE0A94A : 0xF4F1EA);
    });
  }

  public dispose() {
    if (this.linesMesh) {
      this.linesMesh.geometry.dispose();
      (this.linesMesh.material as THREE.Material).dispose();
    }
    this.starsGroup.children.forEach((c) => {
      if ((c as any).geometry) (c as any).geometry.dispose();
      if ((c as any).material) (c as any).material.dispose();
    });
  }
}
