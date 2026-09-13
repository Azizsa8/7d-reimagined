import * as THREE from 'three';
import type { AudioLevels, WorldName } from '../../state/bus';
import type { KnowledgeBase } from '../../kb/types';
import type { TierConfig } from '../PerformanceTier';
import type { MorphTarget } from '../scenes/Presence';
import type { PresenceState } from '../../config';

export interface WorldCtx {
  kb: KnowledgeBase;
  lang: 'en' | 'ar';
  tier: TierConfig;
  reduced: boolean;
  /** half extents of the viewport in world units at z = 0 */
  viewHalfW: number;
  viewHalfH: number;
  distance: number;
  notify: (data: unknown) => void;
}

export interface CameraWish {
  dolly: number; // 1 = base distance, 0.92 = 8 % dolly-in
  target: THREE.Vector3;
  exposure: number;
}

export interface World {
  readonly name: WorldName;
  readonly group: THREE.Group;
  /** Point set the presence flies into before this world takes over (globe, project, figure). */
  morphTarget?(params: Record<string, any>, ctx: WorldCtx): Promise<MorphTarget | null>;
  /** Point set for the reverse morph when leaving to presence. */
  reverseTarget?(): MorphTarget | null;
  /** Make the world visible; called once the morph has landed (or immediately). */
  enter(params: Record<string, any>, ctx: WorldCtx): void;
  /** Re-focus while already active (new params). */
  refocus?(params: Record<string, any>, ctx: WorldCtx): void;
  update(dt: number, audio: AudioLevels, state: PresenceState): void;
  cue(entityId: string, category: string): void;
  exit(): void;
  camera(): CameraWish;
  /** Bloom strength the world wants, or undefined for the presence's own. */
  bloom?(): number | undefined;
  dispose(): void;
}

export const BRASS = new THREE.Color(0xe0a94a);
export const IVORY = new THREE.Color(0xf4f1ea);
export const TEAL = new THREE.Color(0x2fa98b);
export const SAND = new THREE.Color(0xc8aa7c);
export const NIGHT = new THREE.Color(0x050608);

export const easeOutQuint = (p: number) => 1 - Math.pow(1 - p, 5);
export const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

/** cubic-bezier(.22,1,.36,1) approximation used for all transitions */
export const easeSignature = (p: number) => 1 - Math.pow(1 - p, 3.4);
