import { PresenceState, SupportedLang } from '../config';

export interface AudioLevels {
  rms: number;
  low: number;
  mid: number;
  high: number;
}

export interface BusEvents {
  state: PresenceState;
  caption: string;
  userCaption: string;
  level: AudioLevels;
  micLevel: number;
  interrupted: boolean;
  lang: SupportedLang;
  error: string | null;
  scene: { name: string; params?: any };
  connected: boolean;
  reconnecting: boolean;
  muted: boolean;
  sessionEnded: boolean;
  micAvailable: boolean;
  show_fact_card: {
    type: 'project' | 'hubs' | 'timeline' | 'person' | 'discipline' | 'figure' | 'contact';
    data: any;
    lang?: SupportedLang;
  } | null;
  suggest_questions: string[];
  show_world: {
    world: any;
    params?: any;
  };
  transcription: string;
  sound_mute_toggle: boolean;
  story_state: {
    status: 'idle' | 'playing' | 'paused' | 'done';
    currentChapter: number;
    totalChapters: number;
    chapter?: any;
    progress?: { current: number; total: number; percent: number };
  };
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
    const set = this.handlers.get(event);
    if (set) {
      set.delete(handler);
    }
  }

  emit<K extends EventKey>(event: K, data: BusEvents[K]): void {
    const set = this.handlers.get(event);
    if (set) {
      set.forEach((h) => {
        try {
          h(data);
        } catch (err) {
          console.error(`Error in event bus listener for ${event}:`, err);
        }
      });
    }
  }
}

export const bus = new EventBus();
