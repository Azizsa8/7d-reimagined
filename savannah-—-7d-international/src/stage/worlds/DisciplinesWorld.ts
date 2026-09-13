import * as THREE from 'three';
import { AudioLevels } from '../../state/bus';
import { soundDesign } from '../audio/SoundDesign';
import { DisciplineRecord } from '../../kb/client';

export interface DisciplineOverlayData {
  id: string;
  name: string;
  summary: string;
  relatedProjects: string[];
  opacity: number;
}

export class DisciplinesWorld {
  public group: THREE.Group;
  private orbitGroup: THREE.Group;
  private instruments: Map<
    string,
    {
      group: THREE.Group;
      baseAngle: number;
      discipline: DisciplineRecord;
      customUpdate?: (dt: number, time: number) => void;
    }
  > = new Map();

  private activeDisciplineId: string = 'architecture';
  private targetScale = 1.0;
  private currentCenterGroup: THREE.Group | null = null;

  public overlay: DisciplineOverlayData = {
    id: 'architecture',
    name: 'Architecture & Master Planning',
    summary: 'Iconic civic master plans and cultural landmarks.',
    relatedProjects: ['King Abdullah Park', 'Riyadh Eye'],
    opacity: 0,
  };
  private activeLang: 'en' | 'ar' = 'en';
  private time = 0;

  constructor() {
    this.group = new THREE.Group();
    this.orbitGroup = new THREE.Group();
    this.group.add(this.orbitGroup);
  }

  public setDisciplines(disciplines: DisciplineRecord[], lang: 'en' | 'ar' = 'en') {
    this.activeLang = lang;
    while (this.orbitGroup.children.length > 0) {
      const c = this.orbitGroup.children[0];
      this.orbitGroup.remove(c);
    }
    this.instruments.clear();

    const brass = 0xE0A94A;
    const teal = 0x2FA98B;
    const ivory = 0xF4F1EA;

    const count = disciplines.length;
    disciplines.forEach((d, i) => {
      const angle = (i / count) * Math.PI * 2;
      const instGroup = new THREE.Group();

      // Procedural procedural visual representation per discipline:
      let customUpdate: ((dt: number, time: number) => void) | undefined;

      if (d.id.includes('architecture')) {
        // 1. Architecture: wireframe massing assembling floors + caustic plane
        const bldg = new THREE.Group();
        for (let fl = 0; fl < 4; fl++) {
          const w = 0.28 - fl * 0.05;
          const boxGeom = new THREE.BoxGeometry(w, 0.08, w);
          const edges = new THREE.EdgesGeometry(boxGeom);
          const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: brass }));
          line.position.y = fl * 0.09 - 0.12;
          bldg.add(line);
        }
        instGroup.add(bldg);
        customUpdate = (dt, t) => {
          bldg.rotation.y += dt * 0.4;
        };
      } else if (d.id.includes('water') || d.id.includes('multimedia')) {
        // 3. Water & Multimedia: synchronized fountain jets
        const fountainGroup = new THREE.Group();
        const jetGeom = new THREE.CylinderGeometry(0.005, 0.012, 0.25, 8);
        for (let j = 0; j < 5; j++) {
          const jet = new THREE.Mesh(
            jetGeom,
            new THREE.MeshBasicMaterial({ color: teal, transparent: true, opacity: 0.8 })
          );
          const ang = (j / 5) * Math.PI * 2;
          jet.position.set(Math.cos(ang) * 0.08, 0.08, Math.sin(ang) * 0.08);
          fountainGroup.add(jet);
        }
        instGroup.add(fountainGroup);
        customUpdate = (dt, t) => {
          fountainGroup.children.forEach((c, idx) => {
            const h = 0.5 + 0.5 * Math.sin(t * 6.0 + idx);
            c.scale.set(1, h, 1);
          });
        };
      } else if (d.id.includes('telecom') || d.id.includes('digital')) {
        // 4. Telecom: antenna tower with concentric signal rings
        const telecomGroup = new THREE.Group();
        const towerGeom = new THREE.ConeGeometry(0.04, 0.32, 4);
        const tower = new THREE.Mesh(towerGeom, new THREE.MeshBasicMaterial({ color: ivory, wireframe: true }));
        telecomGroup.add(tower);

        const ringGeom = new THREE.RingGeometry(0.06, 0.08, 16);
        const ring = new THREE.Mesh(
          ringGeom,
          new THREE.MeshBasicMaterial({ color: brass, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
        );
        ring.rotation.x = Math.PI / 2;
        telecomGroup.add(ring);
        instGroup.add(telecomGroup);

        customUpdate = (dt, t) => {
          const scale = 0.8 + 0.6 * ((t * 2.0) % 1.0);
          ring.scale.set(scale, scale, 1);
        };
      } else {
        // Generic elegant procedural geometric instrument (icosahedron inside spinning rings)
        const coreGeom = new THREE.IcosahedronGeometry(0.12, 0);
        const core = new THREE.LineSegments(
          new THREE.EdgesGeometry(coreGeom),
          new THREE.LineBasicMaterial({ color: brass })
        );
        const ringGeom = new THREE.RingGeometry(0.16, 0.18, 24);
        const ring = new THREE.Mesh(
          ringGeom,
          new THREE.MeshBasicMaterial({ color: teal, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
        );
        instGroup.add(core);
        instGroup.add(ring);

        customUpdate = (dt, t) => {
          core.rotation.x += dt * 0.8;
          core.rotation.y += dt * 0.6;
          ring.rotation.z += dt * 0.5;
        };
      }

      this.orbitGroup.add(instGroup);
      this.instruments.set(d.id, {
        group: instGroup,
        baseAngle: angle,
        discipline: d,
        customUpdate,
      });
    });

    if (disciplines.length > 0) {
      this.focusDiscipline(disciplines[0].id);
    }
  }

  public focusDiscipline(id: string) {
    const item = this.instruments.get(id) || Array.from(this.instruments.values())[0];
    if (!item) return;
    this.activeDisciplineId = item.discipline.id;
    const d = item.discipline;
    const isAr = this.activeLang === 'ar';

    this.overlay = {
      id: d.id,
      name: isAr ? d.name_ar : d.name,
      summary: isAr ? d.summary_ar : d.summary,
      relatedProjects: d.related_projects || [],
      opacity: 1.0,
    };
    soundDesign.playGlassTone();
  }

  public cue(key: string) {
    for (const [id, item] of this.instruments) {
      if (
        id.toLowerCase().includes(key.toLowerCase()) ||
        item.discipline.name.toLowerCase().includes(key.toLowerCase()) ||
        (item.discipline.aliases || []).some((a) => a.toLowerCase().includes(key.toLowerCase()))
      ) {
        this.focusDiscipline(id);
        break;
      }
    }
  }

  public enter(params: any, lang: 'en' | 'ar') {
    this.group.visible = true;
    this.activeLang = lang;
    soundDesign.setWorldMotif('disciplines');

    if (params?.disciplines) {
      this.setDisciplines(params.disciplines, lang);
    }
    if (params?.id) {
      this.focusDiscipline(params.id);
    }
  }

  public exit() {
    this.overlay.opacity = 0;
  }

  public update(dt: number, _audio: AudioLevels) {
    this.time += dt;

    // Orbit rings radius = 1.3
    const orbitRadius = 1.25;

    this.instruments.forEach((inst, id) => {
      inst.customUpdate?.(dt, this.time);
      const isFocused = id === this.activeDisciplineId;

      if (isFocused) {
        // Bring to centre and scale x2.5
        inst.group.position.lerp(new THREE.Vector3(0, 0, 0.4), dt * 3.5);
        const currScale = inst.group.scale.x;
        const targetS = 2.4;
        const s = currScale + (targetS - currScale) * (dt * 3.5);
        inst.group.scale.set(s, s, s);
      } else {
        // Orbit on ring
        const ang = inst.baseAngle + this.time * 0.15;
        const targetPos = new THREE.Vector3(
          Math.cos(ang) * orbitRadius,
          Math.sin(ang) * orbitRadius * 0.65,
          Math.sin(ang) * 0.2
        );
        inst.group.position.lerp(targetPos, dt * 3.0);
        const currScale = inst.group.scale.x;
        const targetS = 0.7;
        const s = currScale + (targetS - currScale) * (dt * 3.0);
        inst.group.scale.set(s, s, s);
      }
    });
  }

  public dispose() {
    this.instruments.forEach((inst) => {
      inst.group.children.forEach((c) => {
        if ((c as any).geometry) (c as any).geometry.dispose();
        if ((c as any).material) (c as any).material.dispose();
      });
    });
  }
}
