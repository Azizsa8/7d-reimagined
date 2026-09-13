import { bus } from '../../state/bus';
import { fetchKB, normalize } from '../../kb/client';
import type { KnowledgeBase } from '../../kb/types';
import { STAGE } from '../../config';

export interface Alias {
  norm: string;
  entityId: string;
  category: 'hub' | 'project' | 'timeline' | 'person' | 'discipline' | 'figure' | 'partner';
}

/**
 * Word-level cueing (Phase 3 §3). Output transcription text is appended to a rolling
 * buffer; each new alias match is scheduled for the playback-clock time at which the
 * audio queued at arrival begins to play, so the highlight lands as the word is heard.
 */
export class CueDirector {
  private aliases: Alias[] = [];
  private buffer = '';
  private scanned = 0; // characters of `buffer` already scanned for matches
  private lastCue = new Map<string, number>();
  private timers = new Set<number>();

  constructor(private clock: () => number) {
    fetchKB().then((kb) => this.build(kb)).catch((e) => console.warn('[cue] no KB', e));
  }

  private build(kb: KnowledgeBase) {
    const add = (list: string[], entityId: string, category: Alias['category']) => {
      for (const a of list) {
        const norm = normalize(a);
        if (norm.length >= 3) this.aliases.push({ norm, entityId, category });
      }
    };
    kb.hubs.forEach((h) => add([h.name.en, h.name.ar, ...h.aliases], h.id, 'hub'));
    kb.projects.forEach((p) => add([p.name.en, p.name.ar, ...p.aliases], p.id, 'project'));
    kb.timeline.forEach((t) => add([t.year, t.title.en, t.title.ar, ...t.aliases], t.id, 'timeline'));
    kb.people.forEach((p) => add([p.name.en, p.name.ar, ...p.aliases], p.id, 'person'));
    kb.disciplines.forEach((d) => add([d.name.en, d.name.ar, ...d.aliases], d.id, 'discipline'));
    kb.figures.forEach((f) => add([f.value, f.spoken.en, f.spoken.ar, ...f.aliases], f.id, 'figure'));
    kb.partners.forEach((p) => add([p.name.en, p.name.ar, ...p.aliases], p.id, 'partner'));
    // Longest first so "King Abdullah International Gardens" beats "gardens".
    this.aliases.sort((a, b) => b.norm.length - a.norm.length);
  }

  /** @param text transcription chunk; @param at playback time when its audio will start */
  feed(text: string, at: number) {
    if (!text) return;
    this.buffer += text;
    if (this.buffer.length > 400) {
      const cut = this.buffer.length - 400;
      this.buffer = this.buffer.slice(cut);
      this.scanned = Math.max(0, this.scanned - cut);
    }
    const norm = normalize(this.buffer);
    // Only look at the tail that includes the new text (with a little overlap for split words).
    const tailStart = Math.max(0, Math.floor(this.scanned * (norm.length / Math.max(1, this.buffer.length))) - 40);
    const tail = norm.slice(tailStart);
    this.scanned = this.buffer.length;

    const now = performance.now();
    const fired = new Set<string>();
    for (const a of this.aliases) {
      if (fired.has(a.entityId)) continue;
      const idx = tail.indexOf(a.norm);
      if (idx < 0) continue;
      // whole-word check
      const before = tail[idx - 1];
      const after = tail[idx + a.norm.length];
      if ((before && /[\p{L}\p{N}]/u.test(before)) || (after && /[\p{L}\p{N}]/u.test(after))) continue;
      const last = this.lastCue.get(a.entityId) || 0;
      if (now - last < STAGE.cueDebounceMs) continue;
      this.lastCue.set(a.entityId, now);
      fired.add(a.entityId);
      // Estimate where in the chunk the word sits and delay proportionally (spoken ~14 chars/s).
      const offsetSec = Math.max(0, (idx - (tail.length - normalize(text).length)) / 14);
      const delayMs = Math.max(0, (at - this.clock() + offsetSec) * 1000);
      const t = window.setTimeout(() => {
        this.timers.delete(t);
        bus.emit('cue', { entityId: a.entityId, category: a.category });
      }, delayMs);
      this.timers.add(t);
    }
  }

  reset() {
    this.buffer = '';
    this.scanned = 0;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }
}
