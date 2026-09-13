import * as THREE from 'three';
import { AudioLevels, bus } from '../state/bus';
import { PresenceState } from '../config';
import { Presence } from './scenes/Presence';
import { GlobeWorld } from './worlds/GlobeWorld';
import { ProjectWorld } from './worlds/ProjectWorld';
import { TimelineWorld } from './worlds/TimelineWorld';
import { PeopleWorld } from './worlds/PeopleWorld';
import { DisciplinesWorld } from './worlds/DisciplinesWorld';
import { FigureWorld } from './worlds/FigureWorld';
import { ContactWorld } from './worlds/ContactWorld';
import { soundDesign } from './audio/SoundDesign';

export type WorldName =
  | 'presence'
  | 'globe'
  | 'project'
  | 'timeline'
  | 'people'
  | 'disciplines'
  | 'figure'
  | 'contact';

export interface TransitionCtx {
  speed: number;
  duration: number;
  interrupted: boolean;
}

export interface World {
  name: WorldName;
  group: THREE.Group;
  enter(params: any, lang: 'en' | 'ar', t?: TransitionCtx): void;
  update(dt: number, audio: AudioLevels, voiceState?: PresenceState): void;
  cue(key: string): void;
  exit(to: WorldName, t?: TransitionCtx): void;
  dispose(): void;
}

export class SceneDirector {
  public scene: THREE.Scene;
  public presence: Presence;

  // Registered worlds
  public globeWorld: GlobeWorld;
  public projectWorld: ProjectWorld;
  public timelineWorld: TimelineWorld;
  public peopleWorld: PeopleWorld;
  public disciplinesWorld: DisciplinesWorld;
  public figureWorld: FigureWorld;
  public contactWorld: ContactWorld;

  private worlds: Map<WorldName, any> = new Map();
  private activeWorldName: WorldName = 'presence';
  private transitioningTo: WorldName | null = null;

  // Queue & dwell engine
  private transitionQueue: Array<{ name: WorldName; params?: any }> = [];
  private isTransitioning = false;
  private transitionTimer = 0;
  private transitionDuration = 1.2;
  private currentSpeed = 1.0;
  private worldEnteredTime = performance.now();
  private minDwellMs = 2500; // 2.5s dwell

  // Return home timer (8s after speech ends in listening)
  private returnHomeTimer = 0;
  private currentVoiceState: PresenceState = 'idle';
  private activeLang: 'en' | 'ar' = 'en';

  constructor(scene: THREE.Scene, presence: Presence) {
    this.scene = scene;
    this.presence = presence;

    // Instantiate worlds
    this.globeWorld = new GlobeWorld();
    this.projectWorld = new ProjectWorld();
    this.timelineWorld = new TimelineWorld();
    this.peopleWorld = new PeopleWorld();
    this.disciplinesWorld = new DisciplinesWorld();
    this.figureWorld = new FigureWorld();
    this.contactWorld = new ContactWorld();

    this.register('globe', this.globeWorld);
    this.register('project', this.projectWorld);
    this.register('timeline', this.timelineWorld);
    this.register('people', this.peopleWorld);
    this.register('disciplines', this.disciplinesWorld);
    this.register('figure', this.figureWorld);
    this.register('contact', this.contactWorld);

    // Subscribe to state & interruption
    bus.on('state', (state: PresenceState) => {
      this.currentVoiceState = state;
      if (state === 'speaking') {
        this.returnHomeTimer = 0;
      }
    });

    bus.on('interrupted', (interrupted: boolean) => {
      if (interrupted) {
        // Visitor barge-in: bypass dwell, transition immediately
        this.worldEnteredTime = 0;
        if (this.isTransitioning) {
          this.currentSpeed = 2.0; // 2x fast-forward
        }
      }
    });

    bus.on('lang', (lang: 'en' | 'ar') => {
      this.activeLang = lang;
      this.presence.setEmberMode(this.activeWorldName !== 'presence', lang);
    });
  }

  public register(name: WorldName, world: any) {
    this.worlds.set(name, world);
    world.group.visible = false;
    this.scene.add(world.group);
  }

  public get(name: WorldName) {
    return this.worlds.get(name);
  }

  public current(): { name: WorldName; world: any } {
    return {
      name: this.activeWorldName,
      world: this.worlds.get(this.activeWorldName) || this.presence,
    };
  }

  public cue(key: string) {
    const curr = this.worlds.get(this.activeWorldName);
    if (curr && typeof curr.cue === 'function') {
      curr.cue(key);
    }
  }

  public go(name: WorldName, params?: any) {
    if (name === this.activeWorldName && !this.isTransitioning) {
      // Already on this world, just pass params or cue
      const world = this.worlds.get(name);
      if (world && typeof world.enter === 'function') {
        world.enter(params, this.activeLang);
      }
      return;
    }

    // Queue, don't stack
    if (this.isTransitioning) {
      this.currentSpeed = 2.0; // accelerate current transition
      this.transitionQueue = [{ name, params }]; // keep only newest
      return;
    }

    // Check dwell constraint: must stay at least 2.5s unless interrupted
    const timeSinceEnter = performance.now() - this.worldEnteredTime;
    if (this.activeWorldName !== 'presence' && timeSinceEnter < this.minDwellMs) {
      const waitTime = this.minDwellMs - timeSinceEnter;
      setTimeout(() => {
        this.go(name, params);
      }, waitTime);
      return;
    }

    this.startTransition(name, params);
  }

  private startTransition(targetName: WorldName, params?: any) {
    this.isTransitioning = true;
    this.transitioningTo = targetName;
    this.transitionTimer = 0;
    this.currentSpeed = 1.0;

    const fromWorld = this.worlds.get(this.activeWorldName);
    const toWorld = this.worlds.get(targetName);

    // Signature particle morph for Project, Globe, Figure:
    if (targetName === 'project' && this.projectWorld.sampledGridPositions) {
      this.presence.setMorphTarget(
        this.projectWorld.sampledGridPositions,
        this.projectWorld.sampledGridColors || undefined
      );
      this.presence.setMorphProgress(0);
    } else if (targetName === 'figure' && this.figureWorld.sampledDigitPositions) {
      this.presence.setMorphTarget(
        this.figureWorld.sampledDigitPositions,
        this.figureWorld.sampledDigitColors || undefined
      );
      this.presence.setMorphProgress(0);
    }

    if (fromWorld && typeof fromWorld.exit === 'function') {
      fromWorld.exit(targetName);
    }

    if (toWorld) {
      toWorld.group.visible = true;
      if (typeof toWorld.enter === 'function') {
        toWorld.enter(params, this.activeLang);
      }
    }

    // Savannah Ember control:
    // If target is NOT presence, presence smoothly shrinks to ember in corner
    // If target IS presence, presence returns to full body in center
    const isEmber = targetName !== 'presence';
    this.presence.setEmberMode(isEmber, this.activeLang);
  }

  private finishTransition() {
    this.isTransitioning = false;
    const oldWorld = this.worlds.get(this.activeWorldName);
    if (oldWorld && this.activeWorldName !== this.transitioningTo) {
      oldWorld.group.visible = false;
    }

    if (this.transitioningTo) {
      this.activeWorldName = this.transitioningTo;
      this.transitioningTo = null;
    }
    this.worldEnteredTime = performance.now();

    // Check if there is a queued request
    if (this.transitionQueue.length > 0) {
      const next = this.transitionQueue.shift()!;
      this.go(next.name, next.params);
    }
  }

  public update(dt: number, audio: AudioLevels, micLevel: number, prefersReducedMotion: boolean) {
    // Update presence (always active, whether full or ember)
    this.presence.update(dt, audio, micLevel, prefersReducedMotion);

    // Transition progress
    if (this.isTransitioning) {
      this.transitionTimer += dt * this.currentSpeed;
      const progress = Math.min(1.0, this.transitionTimer / this.transitionDuration);

      // Morph progress on presence
      if (this.transitioningTo === 'project' || this.transitioningTo === 'figure') {
        this.presence.setMorphProgress(progress);
      }

      if (progress >= 1.0) {
        this.finishTransition();
      }
    }

    // Update active world
    const activeObj = this.worlds.get(this.activeWorldName);
    if (activeObj && typeof activeObj.update === 'function') {
      activeObj.update(dt, audio, this.currentVoiceState);
    }

    // Return Home logic:
    // If Savannah has finished speaking and 8s of listening pass without a new scene, return to presence
    if (this.activeWorldName !== 'presence' && !this.isTransitioning) {
      if (this.currentVoiceState === 'listening' || this.currentVoiceState === 'idle') {
        this.returnHomeTimer += dt;
        if (this.returnHomeTimer > 8.0) {
          this.returnHomeTimer = 0;
          this.go('presence');
        }
      } else {
        this.returnHomeTimer = 0;
      }
    }
  }

  public dispose() {
    this.worlds.forEach((w) => {
      if (typeof w.dispose === 'function') {
        w.dispose();
      }
    });
  }
}
