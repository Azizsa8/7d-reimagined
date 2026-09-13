import { bus } from '../state/bus';
import type { KnowledgeBase } from '../kb/types';
import { getRecord, localizeRecord } from '../kb/client';

type Lang = 'en' | 'ar';
export type StoryStatus = 'idle' | 'playing' | 'paused' | 'done';

export interface Chapter {
  n: number;
  title: { en: string; ar: string };
  show: { name: string; args: Record<string, string> };
  points: string[]; // KB record ids
  extra?: { en: string; ar: string }; // one-line editorial framing, no facts
}

/** Phase 2 §5 — seven chapters, ~20 s each, all talking points from KB ids. */
export const CHAPTERS: Chapter[] = [
  { n: 1, title: { en: 'Roots', ar: 'الجذور' }, show: { name: 'show_figure', args: { id: 'fig-1993' } }, points: ['t-1993', 'company'] },
  { n: 2, title: { en: 'Across continents', ar: 'عبر القارات' }, show: { name: 'show_hubs', args: { focus: 'sydney' } }, points: ['t-1996-2009', 'fig-80m', 'fig-1500-base-stations'] },
  { n: 3, title: { en: 'The architects', ar: 'المعماريون' }, show: { name: 'show_person', args: { id: 'roman-kuba' } }, points: ['atelier-simona', 'roman-kuba'] },
  { n: 4, title: { en: 'Riyadh', ar: 'الرياض' }, show: { name: 'show_project', args: { id: 'king-abdullah-park-fountain' } }, points: ['t-2009-2015', 'king-abdullah-park-fountain', 'king-abdullah-international-gardens'] },
  { n: 5, title: { en: 'Imagining landmarks', ar: 'تخيّل المعالم' }, show: { name: 'show_project', args: { id: 'riyadh-eye' } }, points: ['riyadh-eye', 'riyadh-2020-urban-study'] },
  { n: 6, title: { en: 'Seven disciplines', ar: 'سبعة تخصصات' }, show: { name: 'show_disciplines', args: {} }, points: ['fig-7-disciplines', 'architecture', 'technology', 'energy'],
    extra: { en: 'Name three of the seven disciplines aloud; offer the rest.', ar: 'اذكري ثلاثة من التخصصات السبعة بصوتك واعرضي الباقي.' } },
  { n: 7, title: { en: 'Today', ar: 'اليوم' }, show: { name: 'show_hubs', args: { focus: 'riyadh' } }, points: ['t-2025-12', 'takween-alrajhi', 'contact'],
    extra: { en: 'Close by inviting the visitor to ask anything or to reach the team, then call suggest_questions.', ar: 'اختمي بدعوة الزائر يسأل أي شي أو يتواصل مع الفريق، ثم استدعي suggest_questions.' } },
];

export class StoryController {
  private status: StoryStatus = 'idle';
  private index = -1;

  get state(): StoryStatus {
    return this.status;
  }
  get current(): Chapter | null {
    return this.index >= 0 ? CHAPTERS[this.index] : null;
  }

  start(): Chapter {
    this.index = 0;
    this.status = 'playing';
    this.emit();
    return CHAPTERS[0];
  }

  next(): Chapter | null {
    if (this.index < CHAPTERS.length - 1) {
      this.index++;
      this.status = 'playing';
      this.emit();
      return CHAPTERS[this.index];
    }
    this.status = 'done';
    this.emit();
    return null;
  }

  pause() {
    if (this.status === 'playing') {
      this.status = 'paused';
      this.emit();
    }
  }

  resume(): Chapter | null {
    if (this.index < 0) return this.start();
    this.status = 'playing';
    this.emit();
    return CHAPTERS[this.index];
  }

  stop() {
    this.status = 'idle';
    this.index = -1;
    this.emit();
  }

  private emit() {
    bus.emit('story', {
      status: this.status,
      chapter: this.index + 1,
      total: CHAPTERS.length,
      title: this.current ? this.current.title.en : undefined,
    });
  }
}

export const story = new StoryController();

/** Tool payload for one chapter: localised talking points + voice rules from the KB. */
export function chapterPayload(kb: KnowledgeBase, ch: Chapter, lang: Lang) {
  const talking_points: string[] = [];
  const voice_rules = new Set<string>();
  for (const id of ch.points) {
    const rec = getRecord(kb, id);
    if (!rec) continue;
    const loc = localizeRecord(rec, lang);
    talking_points.push(loc.text);
    loc.voice_rules.forEach((r) => voice_rules.add(r));
  }
  if (ch.extra) talking_points.push(ch.extra[lang]);
  return {
    chapter: ch.n,
    of: CHAPTERS.length,
    title: ch.title[lang],
    beat: ch.n === CHAPTERS.length ? 'last' : 'middle',
    show: ch.show,
    talking_points,
    voice_rules: Array.from(voice_rules),
  };
}
