import * as THREE from 'three';
import { bus, type AudioLevels, type WorldName } from '../state/bus';
import { STAGE, REDUCED, type PresenceState } from '../config';
import type { Stage } from './Stage';
import type { World, WorldCtx, CameraWish } from './worlds/World';
import { easeSignature } from './worlds/World';
import { fetchKB } from '../kb/client';
import type { KnowledgeBase } from '../kb/types';
import { soundDesign } from './audio/SoundDesign';
import { track } from '../analytics';

type Factory = () => Promise<World>;

const factories: Record<Exclude<WorldName, 'presence'>, Factory> = {
  globe: () => import('./worlds/GlobeWorld').then((m) => new m.GlobeWorld()),
  project: () => import('./worlds/ProjectWorld').then((m) => new m.ProjectWorld()),
  timeline: () => import('./worlds/TimelineWorld').then((m) => new m.TimelineWorld()),
  people: () => import('./worlds/PeopleWorld').then((m) => new m.PeopleWorld()),
  disciplines: () => import('./worlds/DisciplinesWorld').then((m) => new m.DisciplinesWorld()),
  figure: () => import('./worlds/FigureWorld').then((m) => new m.FigureWorld()),
  contact: () => import('./worlds/ContactWorld').then((m) => new m.ContactWorld()),
};

const MORPH_WORLDS = new Set<WorldName>(['globe', 'project', 'figure']);

/**
 * Owns the active world and every transition between worlds (Phase 3 §2, §5).
 * Queue, don't stack; dwell 2.5 s; barge-in transitions immediately; return home
 * after 8 s of listening; lazy world construction; only active + outgoing rendered.
 */
export class SceneDirector {
  private worlds = new Map<WorldName, World>();
  private loading = new Map<WorldName, Promise<World>>();
  private active: WorldName = 'presence';
  private outgoing: World | null = null;
  private kb: KnowledgeBase | null = null;
  private lang: 'en' | 'ar' = 'en';
  private state: PresenceState = 'idle';
  private transitioning = false;
  private gen = 0;
  private speed = 1;
  private pending: { world: WorldName; params: Record<string, any> } | null = null;
  private enteredAt = 0;
  private listenSince = 0;
  private tweens: Array<{ t: number; d: number; fn: (p: number) => void; done: () => void; gen: number }> = [];
  private cam: CameraWish = { dolly: 1, target: new THREE.Vector3(), exposure: 1 };
  private camWish: CameraWish = { dolly: 1, target: new THREE.Vector3(), exposure: 1 };
  private view = { halfW: 1, halfH: 1, distance: 5, w: 1, h: 1 };
  public bloomOverride: number | undefined;
  private lastSceneAt = 0;

  constructor(private stage: Stage) {
    fetchKB().then((kb) => (this.kb = kb)).catch(() => {});
    bus.on('lang', (l) => {
      this.lang = l;
      this.stage.presence.setEmber(this.active !== 'presence', l);
    });
    bus.on('state', (s) => {
      this.state = s;
      if (s === 'listening') this.listenSince = performance.now();
    });
    bus.on('scene', (e) => {
      this.lastSceneAt = e.at;
      this.go(e.world, e.params || {});
    });
    bus.on('cue', (c) => this.cue(c.entityId, c.category));
    bus.on('interrupted', () => {
      this.enteredAt = 0; // bypass dwell
      if (this.transitioning) this.speed = 2;
    });
  }

  onResize(w: number, h: number, distance: number) {
    const halfV = Math.tan((this.stage.camera.fov * Math.PI) / 360) * distance;
    this.view = { halfW: halfV * (w / h), halfH: halfV, distance, w, h };
  }

  get current(): WorldName {
    return this.active;
  }

  cameraState(): CameraWish {
    return this.cam;
  }

  private ctx(forWorld: WorldName = this.active): WorldCtx {
    return {
      kb: this.kb!,
      lang: this.lang,
      tier: this.stage.tier,
      reduced: REDUCED,
      viewHalfW: this.view.halfW,
      viewHalfH: this.view.halfH,
      distance: this.view.distance,
      notify: (data) => bus.emit('overlay', { world: forWorld, data }),
    };
  }

  private async load(name: Exclude<WorldName, 'presence'>): Promise<World> {
    const have = this.worlds.get(name);
    if (have) return have;
    let p = this.loading.get(name);
    if (!p) {
      p = factories[name]().then((w) => {
        w.group.visible = false;
        this.stage.scene.add(w.group);
        this.worlds.set(name, w);
        return w;
      });
      this.loading.set(name, p);
    }
    return p;
  }

  /** Preload a world's module (Phase 3: next likely world). */
  preload(name: WorldName) {
    if (name !== 'presence') this.load(name).catch(() => {});
  }

  /** Warm every world module when the browser is idle; textures and geometry stay lazy. */
  preloadAll() {
    const names = Object.keys(factories) as Array<Exclude<WorldName, 'presence'>>;
    const idle = (cb: () => void) => ((window as any).requestIdleCallback ? (window as any).requestIdleCallback(cb, { timeout: 4000 }) : setTimeout(cb, 800));
    names.forEach((n, i) => idle(() => setTimeout(() => this.preload(n), i * 250)));
  }

  cue(entityId: string, category: string) {
    const w = this.worlds.get(this.active);
    w?.cue(entityId, category);
  }

  go(name: WorldName, params: Record<string, any> = {}) {
    if (!this.kb) {
      fetchKB().then((kb) => {
        this.kb = kb;
        this.go(name, params);
      });
      return;
    }
    if (name === this.active && !this.transitioning) {
      const w = this.worlds.get(name);
      if (w) (w.refocus || w.enter).call(w, params, this.ctx(name));
      this.enteredAt = performance.now();
      return;
    }
    if (this.transitioning) {
      this.speed = 2;
      this.pending = { world: name, params };
      return;
    }
    const since = performance.now() - this.enteredAt;
    if (this.active !== 'presence' && name !== 'presence' && since < STAGE.minDwellMs && this.enteredAt) {
      this.pending = { world: name, params };
      window.setTimeout(() => {
        if (this.pending?.world === name && !this.transitioning) {
          this.pending = null;
          this.go(name, params);
        }
      }, STAGE.minDwellMs - since);
      return;
    }
    this.run(name, params).catch((e) => console.error('[director] transition failed', e));
  }

  private tween(d: number, fn: (p: number) => void): Promise<void> {
    if (REDUCED) d = Math.min(d, 0.3);
    return new Promise((done) => this.tweens.push({ t: 0, d, fn, done, gen: this.gen }));
  }

  private async run(name: WorldName, params: Record<string, any>) {
    const gen = ++this.gen;
    this.transitioning = true;
    this.speed = 1;
    const presence = this.stage.presence;
    const from = this.active;
    const fromWorld = this.worlds.get(from) || null;
    const ctx = this.ctx(name);
    const alive = () => gen === this.gen;

    try {
      if (name === 'presence') {
        soundDesign.setWorld('presence');
        this.camWish = { dolly: 1, target: new THREE.Vector3(), exposure: 1 };
        fromWorld?.exit();
        this.outgoing = fromWorld;
        const rev = fromWorld?.reverseTarget?.() || null;
        if (rev && !REDUCED) {
          presence.setMorphTarget(rev);
          presence.snapEmber(false);
          presence.morph = 1;
          presence.scatter = 0;
          presence.snapAlpha(1);
          await this.tween(1.2, (p) => (presence.morph = 1 - easeSignature(p)));
        } else {
          presence.setEmber(false, this.lang);
          presence.setAlpha(1);
          await this.tween(0.9, () => {});
        }
        if (!alive()) return;
        if (fromWorld) fromWorld.group.visible = false;
        this.outgoing = null;
        this.active = 'presence';
        bus.emit('worldActive', 'presence');
        return;
      }

      const world = await this.load(name);
      if (!alive()) return;
      soundDesign.setWorld(name);
      track('world_shown', { world: name });

      if (MORPH_WORLDS.has(name) && !REDUCED) {
        // 1. Outgoing world fades; the body comes home fast if it was an ember.
        fromWorld?.exit();
        this.outgoing = fromWorld;
        if (from !== 'presence') {
          presence.setEmber(false, this.lang);
          presence.setAlpha(1);
          await this.tween(0.35, () => {});
          if (!alive()) return;
        }
        // 2. Fly the particles into the target while the camera dollies in 8 %.
        const target = await world.morphTarget?.(params, ctx);
        if (!alive()) return;
        this.camWish = world.camera();
        if (target) {
          presence.setMorphTarget(target);
          presence.morph = 0;
          presence.scatter = 0;
          await this.tween(name === 'globe' ? 1.2 : 0.95, (p) => (presence.morph = easeSignature(p)));
          if (!alive()) return;
        }
        // 3. Hand off: the world shows its own geometry at the same points; the photo fades in
        //    beneath while the particles scatter as golden dust (project), or the particles simply
        //    become the world (globe, figure).
        world.group.visible = true;
        world.enter(params, ctx);
        if (fromWorld) fromWorld.group.visible = false;
        this.outgoing = null;
        if (name === 'project') {
          await this.tween(0.6, (p) => (presence.scatter = p));
        } else {
          await this.tween(0.25, (p) => presence.setAlpha(1 - p));
        }
        if (!alive()) return;
        // 4. Reset the body and bring it back as the ember.
        presence.morph = 0;
        presence.scatter = 0;
        presence.snapAlpha(0);
        presence.snapEmber(true);
        presence.setEmber(true, this.lang);
        presence.setAlpha(1);
      } else {
        // presence → ember first (350 ms), then the world fades up.
        fromWorld?.exit();
        this.outgoing = fromWorld;
        this.camWish = world.camera();
        presence.setEmber(true, this.lang);
        presence.setAlpha(1);
        await this.tween(0.35, () => {});
        if (!alive()) return;
        world.group.visible = true;
        world.enter(params, ctx);
        await this.tween(0.7, () => {});
        if (!alive()) return;
        if (fromWorld) fromWorld.group.visible = false;
        this.outgoing = null;
      }
      this.active = name;
      this.enteredAt = performance.now();
      bus.emit('worldActive', name);
      const shownAfter = this.lastSceneAt ? Math.round(performance.now() - this.lastSceneAt) : 0;
      if (shownAfter) console.debug(`[director] ${name} hero frame ${shownAfter} ms after tool call`);
    } finally {
      if (gen === this.gen) {
        this.transitioning = false;
        this.speed = 1;
        if (this.pending) {
          const p = this.pending;
          this.pending = null;
          this.go(p.world, p.params);
        }
      }
    }
  }

  update(dt: number, audio: AudioLevels, _mic: number) {
    const sdt = dt * this.speed;
    // tweens
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      if (tw.gen !== this.gen) {
        this.tweens.splice(i, 1);
        tw.done();
        continue;
      }
      tw.t += sdt;
      const p = Math.min(1, tw.t / tw.d);
      tw.fn(p);
      if (p >= 1) {
        this.tweens.splice(i, 1);
        tw.done();
      }
    }
    // camera follow
    const k = Math.min(1, dt * 2.2);
    this.cam.dolly += (this.camWish.dolly - this.cam.dolly) * k;
    this.cam.exposure += (this.camWish.exposure - this.cam.exposure) * k;
    this.cam.target.lerp(this.camWish.target, k);

    const w = this.worlds.get(this.active);
    if (w && w.group.visible) {
      w.update(dt, audio, this.state);
      if (!this.transitioning) this.camWish = w.camera();
    }
    if (this.outgoing && this.outgoing !== w) this.outgoing.update(dt, audio, this.state);
    this.bloomOverride = w?.bloom?.();

    // Return home
    if (this.active !== 'presence' && !this.transitioning && (this.state === 'listening' || this.state === 'idle')) {
      if (this.listenSince && performance.now() - this.listenSince > STAGE.returnHomeAfterMs && performance.now() - this.lastSceneAt > STAGE.returnHomeAfterMs) {
        this.listenSince = 0;
        this.go('presence');
      }
    }
  }

  dispose() {
    this.worlds.forEach((w) => w.dispose());
    this.worlds.clear();
  }
}
