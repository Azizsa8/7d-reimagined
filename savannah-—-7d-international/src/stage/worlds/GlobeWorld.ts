import * as THREE from 'three';
import { AudioLevels } from '../../state/bus';
import { soundDesign } from '../audio/SoundDesign';

export interface HubData {
  id: string;
  cityEn: string;
  cityAr: string;
  countryEn: string;
  countryAr: string;
  lat: number;
  lon: number;
  isHq?: boolean;
}

export const HUBS: HubData[] = [
  { id: 'riyadh', cityEn: 'Riyadh', cityAr: 'الرياض', countryEn: 'Saudi Arabia', countryAr: 'المملكة العربية السعودية', lat: 24.7136, lon: 46.6753, isHq: true },
  { id: 'florida', cityEn: 'Florida', cityAr: 'فلوريدا', countryEn: 'United States', countryAr: 'الولايات المتحدة', lat: 27.9506, lon: -82.4572 },
  { id: 'ostrava', cityEn: 'Ostrava', cityAr: 'أوسترافا', countryEn: 'Czech Republic', countryAr: 'جمهورية التشيك', lat: 49.8209, lon: 18.2625 },
  { id: 'seoul', cityEn: 'Seoul', cityAr: 'سيول', countryEn: 'South Korea', countryAr: 'كوريا الجنوبية', lat: 37.5665, lon: 126.9780 },
  { id: 'sydney', cityEn: 'Sydney', cityAr: 'سيدني', countryEn: 'Australia', countryAr: 'أستراليا', lat: -33.8688, lon: 151.2093 },
];

function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

export class GlobeWorld {
  public group: THREE.Group;
  private globeRadius = 1.35;
  private landPointsMesh!: THREE.Points;
  private atmosphereMesh!: THREE.Mesh;

  // Hub visual elements
  private hubGroups: Map<string, THREE.Group> = new Map();
  private hubPillars: Map<string, THREE.Mesh> = new Map();
  private routeArcsGroup: THREE.Group;

  // Rotation & orientation targets
  private globeRotGroup: THREE.Group;
  private targetQuaternion = new THREE.Quaternion();
  private currentQuaternion = new THREE.Quaternion();
  private isAutoRotating = true;
  private activeHubId: string = 'riyadh';

  // Label 2D overlay tracking
  public activeHubLabel: { city: string; country: string; opacity: number } = {
    city: 'Riyadh',
    country: 'Headquarters · Saudi Arabia',
    opacity: 0,
  };
  private labelTargetOpacity = 0;
  private activeLang: 'en' | 'ar' = 'en';

  private time = 0;

  constructor() {
    this.group = new THREE.Group();
    this.globeRotGroup = new THREE.Group();
    this.group.add(this.globeRotGroup);
    this.routeArcsGroup = new THREE.Group();
    this.globeRotGroup.add(this.routeArcsGroup);

    this.createAtmosphere();
    this.createHubs();
    this.createRouteArcs();
    this.loadLandPoints();
  }

  private createAtmosphere() {
    // Thin atmospheric rim fresnel shader
    const geom = new THREE.SphereGeometry(this.globeRadius * 1.05, 48, 48);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vec3 viewDir = normalize(vViewPosition);
          float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 2.8);
          vec3 teal = vec3(0.184, 0.663, 0.545);
          gl_FragColor = vec4(teal * 1.5, fresnel * 0.28);
        }
      `,
    });
    this.atmosphereMesh = new THREE.Mesh(geom, mat);
    this.group.add(this.atmosphereMesh);
  }

  private async loadLandPoints() {
    let rawPoints: [number, number][] = [];
    try {
      const res = await fetch('/data/land-110m.json');
      if (res.ok) {
        rawPoints = await res.json();
      }
    } catch (_) {}

    if (!rawPoints || rawPoints.length === 0) {
      // Fallback procedural points if file fetch fails
      for (let i = 0; i < 15000; i++) {
        const lat = (Math.random() - 0.5) * 160;
        const lon = (Math.random() - 0.5) * 360;
        rawPoints.push([lat, lon]);
      }
    }

    const count = rawPoints.length;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const ivory = new THREE.Color(0xF4F1EA);
    const dimIvory = new THREE.Color(0x606670);

    for (let i = 0; i < count; i++) {
      const [lat, lon] = rawPoints[i];
      const pt = latLonToVector3(lat, lon, this.globeRadius);
      positions[i * 3] = pt.x;
      positions[i * 3 + 1] = pt.y;
      positions[i * 3 + 2] = pt.z;

      // Color variation across continents
      const col = Math.random() < 0.2 ? ivory : dimIvory;
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.016,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.landPointsMesh = new THREE.Points(geom, mat);
    this.globeRotGroup.add(this.landPointsMesh);
  }

  private createHubs() {
    const brass = 0xE0A94A;

    HUBS.forEach((hub) => {
      const hubGroup = new THREE.Group();
      const pos = latLonToVector3(hub.lat, hub.lon, this.globeRadius);
      hubGroup.position.copy(pos);

      // Orient outward
      hubGroup.lookAt(pos.clone().multiplyScalar(2));

      // Brass beacon core point
      const coreGeom = new THREE.SphereGeometry(hub.isHq ? 0.038 : 0.026, 16, 16);
      const coreMat = new THREE.MeshBasicMaterial({ color: brass });
      const coreMesh = new THREE.Mesh(coreGeom, coreMat);
      hubGroup.add(coreMesh);

      // Pulsating ring
      const ringGeom = new THREE.RingGeometry(0.04, 0.052, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: brass,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      hubGroup.add(ringMesh);

      // Additive Pillar of light (height 0.35, soft top fade)
      const pillarGeom = new THREE.CylinderGeometry(0.012, 0.024, 0.35, 16, 1, true);
      // Center cylinder base at the hub surface
      pillarGeom.translate(0, 0.175, 0);
      pillarGeom.rotateX(Math.PI / 2);

      const pillarMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uHeight: { value: 0.0 }, // animated 0 -> 1 on cue
          uColor: { value: new THREE.Color(brass) },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uHeight;
          uniform vec3 uColor;
          varying vec2 vUv;
          void main() {
            float fade = (1.0 - vUv.y) * step(vUv.y, uHeight);
            gl_FragColor = vec4(uColor * 1.5, fade * 0.7);
          }
        `,
      });

      const pillarMesh = new THREE.Mesh(pillarGeom, pillarMat);
      hubGroup.add(pillarMesh);

      this.hubPillars.set(hub.id, pillarMesh);
      this.hubGroups.set(hub.id, hubGroup);
      this.globeRotGroup.add(hubGroup);
    });
  }

  private createRouteArcs() {
    // Great-circle routes connecting: Ostrava -> Sydney -> Florida -> Riyadh -> Seoul
    const routePairs = [
      ['ostrava', 'sydney'],
      ['sydney', 'florida'],
      ['florida', 'riyadh'],
      ['riyadh', 'seoul'],
    ];

    routePairs.forEach(([fromId, toId]) => {
      const from = HUBS.find((h) => h.id === fromId)!;
      const to = HUBS.find((h) => h.id === toId)!;
      const vFrom = latLonToVector3(from.lat, from.lon, this.globeRadius);
      const vTo = latLonToVector3(to.lat, to.lon, this.globeRadius);

      // Sample great-circle arc
      const numPoints = 64;
      const curvePts: THREE.Vector3[] = [];
      for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        // Spherical linear interpolation
        const pt = new THREE.Vector3().copy(vFrom).lerp(vTo, t).normalize();
        // Lift arc slightly above sphere
        const lift = Math.sin(t * Math.PI) * 0.28;
        pt.multiplyScalar(this.globeRadius + lift);
        curvePts.push(pt);
      }

      const spline = new THREE.CatmullRomCurve3(curvePts);
      const tubeGeom = new THREE.TubeGeometry(spline, 64, 0.006, 8, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: 0xC8AA7C,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
      });
      const tube = new THREE.Mesh(tubeGeom, tubeMat);
      this.routeArcsGroup.add(tube);
    });
  }

  public focusHub(hubId: string, lang: 'en' | 'ar' = 'en') {
    const hub = HUBS.find((h) => h.id === hubId) || HUBS[0];
    this.activeHubId = hub.id;
    this.activeLang = lang;
    this.isAutoRotating = false;

    // Slerp globe rotation to bring the hub towards camera (facing (0, 0, 1))
    const targetPos = latLonToVector3(hub.lat, hub.lon, this.globeRadius);
    const targetDir = targetPos.clone().normalize();
    const cameraDir = new THREE.Vector3(0, 0, 1);

    // Compute quaternion that rotates targetDir to cameraDir
    this.targetQuaternion.setFromUnitVectors(targetDir, cameraDir);

    // Rise pillar of light on focused hub and dim others
    this.hubPillars.forEach((pillar, id) => {
      const mat = pillar.material as THREE.ShaderMaterial;
      if (id === hub.id) {
        mat.uniforms.uHeight.value = 1.0;
      } else {
        mat.uniforms.uHeight.value = 0.2;
      }
    });

    // Update label
    const isAr = lang === 'ar';
    this.activeHubLabel = {
      city: isAr ? hub.cityAr : hub.cityEn,
      country: isAr
        ? `${hub.isHq ? 'المقر الرئيسي · ' : ''}${hub.countryAr}`
        : `${hub.isHq ? 'Global Headquarters · ' : ''}${hub.countryEn}`,
      opacity: 1.0,
    };
    this.labelTargetOpacity = 1.0;
  }

  public cue(key: string) {
    // Cue matched a hub alias
    const found = HUBS.find((h) => h.id === key);
    if (found) {
      this.focusHub(found.id, this.activeLang);
      soundDesign.playGlassTone();
    }
  }

  public enter(params: any, lang: 'en' | 'ar') {
    this.group.visible = true;
    this.activeLang = lang;
    soundDesign.setWorldMotif('globe');

    const focusId = params?.focus || params?.id || 'riyadh';
    this.focusHub(focusId, lang);
  }

  public exit() {
    this.labelTargetOpacity = 0;
  }

  public update(dt: number, _audio: AudioLevels) {
    this.time += dt;

    // Slerp rotation
    if (this.isAutoRotating) {
      this.globeRotGroup.rotation.y += dt * 0.12;
    } else {
      this.currentQuaternion.slerp(this.targetQuaternion, dt * 2.8);
      this.globeRotGroup.setRotationFromQuaternion(this.currentQuaternion);
    }

    // Pulsate hub rings
    this.hubGroups.forEach((group, id) => {
      const isFocused = id === this.activeHubId;
      const ring = group.children[1] as THREE.Mesh;
      if (ring) {
        const pulse = 1.0 + 0.3 * Math.sin(this.time * 4.0 + (isFocused ? 2 : 0));
        ring.scale.set(pulse, pulse, 1);
        (ring.material as THREE.MeshBasicMaterial).opacity = isFocused ? 0.9 : 0.4;
      }
    });

    // Label opacity smoothing
    this.activeHubLabel.opacity += (this.labelTargetOpacity - this.activeHubLabel.opacity) * (dt * 5.0);
  }

  public dispose() {
    this.atmosphereMesh.geometry.dispose();
    (this.atmosphereMesh.material as THREE.Material).dispose();
    if (this.landPointsMesh) {
      this.landPointsMesh.geometry.dispose();
      (this.landPointsMesh.material as THREE.Material).dispose();
    }
    this.hubGroups.forEach((g) => {
      g.children.forEach((c) => {
        if ((c as any).geometry) (c as any).geometry.dispose();
        if ((c as any).material) (c as any).material.dispose();
      });
    });
  }
}
