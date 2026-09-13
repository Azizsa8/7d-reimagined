import type { PresenceState, SupportedLang } from '../config';

export interface AudioLevels {
  rms: number;
  low: number;
  mid: number;
  high: number;
}

export type WorldName = 'presence' | 'globe' | 'project' | 'timeline' | 'people' | 'disciplines' | 'figure' | 'contact';

export interface SceneEvent {
  world: WorldName;
  params?: Record<string, unknown>;
  /** performance.now() when the tool call arrived */
  at: number;
}

export interface CaptionEvent {
  text: string;
  /** true when this is the final phrase of the turn */
  final?: boolean;
}

export interface EnquiryDraft {
  name?: string;
  organisation?: string;
  country?: string;
  topic?: string;
  email?: string;
  phone?: string;
  language: SupportedLang;
}

export interface StoryState {
  status: 'idle' | 'playing' | 'paused' | 'done';
  chapter: number; // 1-based, 0 when idle
  total: number;
  title?: string;
}

export interface BusEvents {
  state: PresenceState;
  caption: CaptionEvent;
  userCaption: string;
  level: AudioLevels;
  micLevel: number;
  interrupted: boolean;
  lang: SupportedLang;
  error: string | null;
  scene: SceneEvent;
  cue: { entityId: string; category: string };
  connected: boolean;
  reconnecting: boolean;
  quality: 'good' | 'degraded' | 'lost';
  muted: boolean;
  sessionEnded: string;
  micAvailable: boolean;
  chips: { items: string[]; source: 'kb' | 'model' | 'system' };
  story: StoryState;
  enquiry: EnquiryDraft | null;
  enquiryResult: 'sent' | 'failed' | 'unconfigured';
  transcriptTurn: { role: 'user' | 'model'; text: string };
  toast: { text: string; kind?: 'info' | 'warn' };
  ptt: boolean;
  tool: { name: string; args: Record<string, unknown>; at: number };
  overlay: { world: WorldName; data: any };
  worldActive: WorldName;
  tier: string;
}

type EventKey = keyof BusEvents;
type Handler<T> = (data: T) => void;

class EventBus {
  private handlers = new Map<EventKey, Set<Handler<any>>>();

  on<K extends EventKey>(event: K, handler: Handler<BusEvents[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => this.off(event, handler);
  }

  off<K extends EventKey>(event: K, handler: Handler<BusEvents[K]>): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit<K extends EventKey>(event: K, data: BusEvents[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const h of Array.from(set)) {
      try {
        h(data);
      } catch (err) {
        console.error(`[bus] listener for ${event} threw`, err);
      }
    }
  }
}

export const bus = new EventBus();
