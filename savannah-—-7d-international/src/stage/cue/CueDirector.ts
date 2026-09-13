import { bus } from '../../state/bus';
import { fetchKnowledgeBase, KnowledgeBaseData } from '../../kb/client';

export interface AliasMatch {
  entityId: string;
  category: 'hub' | 'project' | 'timeline' | 'person' | 'discipline' | 'figure' | 'partner';
  targetWorld: string;
  rawAlias: string;
}

/**
 * Normalises text for bilingual alias matching:
 * - lowercase
 * - remove Arabic diacritics (tashkeel) and tatweel (ـ)
 * - unify Arabic letter variants (أ إ آ → ا, ة → ه, ى → ي)
 * - convert Arabic-Indic digits (٠-٩) to ASCII (0-9)
 * - strip excessive punctuation
 */
export function normalizeText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    // Convert Arabic-Indic digits
    .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1632 + 48))
    // Remove Arabic diacritics (harakat)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Remove tatweel (kashida)
    .replace(/\u0640/g, '')
    // Unify Alef forms
    .replace(/[إأآٱ]/g, 'ا')
    // Unify Teh Marbuta
    .replace(/ة/g, 'ه')
    // Unify Alef Maksura
    .replace(/ى/g, 'ي')
    // Replace punctuation with spaces
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'«»]/g, ' ')
    // Collapse spaces
    .replace(/\s+/g, ' ')
    .trim();
}

export class CueDirector {
  private aliases: Array<{ normalized: string; match: AliasMatch }> = [];
  private rollingBuffer: string = '';
  private lastCueTimes: Map<string, number> = new Map();
  private cueCallback?: (match: AliasMatch) => void;

  constructor(onCue?: (match: AliasMatch) => void) {
    this.cueCallback = onCue;
    this.initAliasIndex();

    // Listen to output transcription words from LiveSession / bus
    bus.on('transcription', (text: string) => {
      this.feedTranscription(text);
    });
  }

  public setCueHandler(handler: (match: AliasMatch) => void) {
    this.cueCallback = handler;
  }

  public async initAliasIndex() {
    try {
      const kb = await fetchKnowledgeBase();
      this.buildIndex(kb);
    } catch (e) {
      console.warn('CueDirector: Failed to load KB for alias index:', e);
    }
  }

  private buildIndex(kb: KnowledgeBaseData) {
    this.aliases = [];

    const add = (
      rawAliases: string[],
      entityId: string,
      category: AliasMatch['category'],
      targetWorld: string
    ) => {
      rawAliases.forEach((alias) => {
        const norm = normalizeText(alias);
        if (norm && norm.length >= 2) {
          this.aliases.push({
            normalized: norm,
            match: { entityId, category, targetWorld, rawAlias: alias },
          });
        }
      });
    };

    // Hubs (world: 'globe')
    kb.hubs.forEach((h) => {
      const custom = [
        h.id,
        h.city,
        h.city_ar,
        h.name,
        h.name_ar,
        ...(h.aliases || []),
      ];
      if (h.id === 'riyadh') custom.push('الرياض', 'riyadh');
      if (h.id === 'florida') custom.push('فلوريدا', 'florida', 'tampa');
      if (h.id === 'ostrava') custom.push('اوسترافا', 'ostrava', 'czech');
      if (h.id === 'seoul') custom.push('سيول', 'سول', 'seoul', 'korea');
      if (h.id === 'sydney') custom.push('سيدني', 'sydney', 'australia');
      add(custom, h.id, 'hub', 'globe');
    });

    // Projects (world: 'project')
    kb.projects.forEach((p) => {
      const custom = [
        p.id,
        p.name,
        p.name_ar,
        ...(p.aliases || []),
      ];
      if (p.id === 'king-abdullah-park-fountain') custom.push('نافوره', 'fountain', 'malaz', 'الملز');
      if (p.id === 'king-abdullah-international-gardens') custom.push('حدائق', 'gardens', 'kaig');
      if (p.id === 'riyadh-eye') custom.push('عين الرياض', 'observation wheel', 'wheel', 'spaceship');
      if (p.id === 'riyadh-2020') custom.push('دراسه الرياض', 'riyadh 2020', 'urban study');
      if (p.id === '7d-world') custom.push('عالم سفن دي', '7d world');
      add(custom, p.id, 'project', 'project');
    });

    // Timeline years & milestones (world: 'timeline')
    kb.timeline.forEach((t) => {
      const custom = [
        t.year,
        t.title_en,
        t.title_ar,
        ...(t.aliases || []),
      ];
      if (t.year.includes('1993')) custom.push('1993', 'nineteen ninety-three', 'الف وتسعميه وثلاثه وتسعين');
      if (t.year.includes('2009')) custom.push('2009', 'two thousand nine');
      if (t.year.includes('2011')) custom.push('2011');
      if (t.year.includes('2013')) custom.push('2013');
      if (t.year.includes('2018')) custom.push('2018');
      if (t.year.includes('2020')) custom.push('2020');
      if (t.year.includes('2025')) custom.push('2025');
      add(custom, t.id || t.year, 'timeline', 'timeline');
    });

    // People (world: 'people')
    kb.people.forEach((person) => {
      const custom = [
        person.id,
        person.name,
        person.name_ar,
        ...(person.aliases || []),
      ];
      add(custom, person.id, 'person', 'people');
    });

    // Disciplines (world: 'disciplines')
    kb.disciplines.forEach((d) => {
      const custom = [
        d.id,
        d.name,
        d.name_ar,
        ...(d.aliases || []),
      ];
      add(custom, d.id, 'discipline', 'disciplines');
    });

    // Figures (world: 'figure')
    kb.figures.forEach((fig) => {
      const custom = [
        fig.id,
        fig.value,
        fig.spoken_en,
        fig.spoken_ar,
        ...(fig.aliases || []),
      ];
      if (fig.id === 'fig-1993') custom.push('1993', 'nineteen ninety-three', '١٩٩٣', 'الف وتسعميه وثلاثه وتسعين');
      if (fig.id === 'fig-80m') custom.push('80m', '$80m', 'ثمانين مليون', 'eighty million');
      if (fig.id === 'fig-1500-base-stations') custom.push('1500', '١٥٠٠', 'fifteen hundred', 'الف وخمسميه', 'محطه');
      if (fig.id === 'fig-5-hubs') custom.push('5 hubs', 'خمس مراكز', 'five hubs');
      if (fig.id === 'fig-7-disciplines') custom.push('7 disciplines', 'سبع تخصصات', 'seven disciplines');
      add(custom, fig.id, 'figure', 'figure');
    });

    // Sort aliases by length descending so longer compound phrases match first
    this.aliases.sort((a, b) => b.normalized.length - a.normalized.length);
  }

  public feedTranscription(chunk: string) {
    if (!chunk) return;
    this.rollingBuffer += ' ' + chunk;
    // Keep last 300 characters
    if (this.rollingBuffer.length > 300) {
      this.rollingBuffer = this.rollingBuffer.slice(-300);
    }

    const normTail = normalizeText(this.rollingBuffer);
    const now = performance.now();

    for (const item of this.aliases) {
      // Check if alias appears in the tail buffer
      if (normTail.includes(item.normalized)) {
        const lastTime = this.lastCueTimes.get(item.match.entityId) || 0;
        // Never cue the same entity twice within 3.0 seconds
        if (now - lastTime > 3000) {
          this.lastCueTimes.set(item.match.entityId, now);
          this.cueCallback?.(item.match);
          break; // trigger highest priority match
        }
      }
    }
  }

  public resetBuffer() {
    this.rollingBuffer = '';
  }

  public feedTranscript(chunk: string) {
    this.feedTranscription(chunk);
  }
}
