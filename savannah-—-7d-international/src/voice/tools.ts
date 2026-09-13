import { bus, type WorldName } from '../state/bus';
import { fetchKB, getRecord, search, screenDoNotSay, localizeRecord } from '../kb/client';
import { story, chapterPayload, CHAPTERS } from '../story/story';
import { track } from '../analytics';

type Lang = 'en' | 'ar';

export interface ToolContext {
  lang: Lang;
  /** ids of questions already answered (chip de-duplication) */
  askedChips: Set<string>;
}

const VALID: Record<string, WorldName> = {
  show_project: 'project',
  show_hubs: 'globe',
  show_timeline: 'timeline',
  show_person: 'people',
  show_people: 'people',
  show_disciplines: 'disciplines',
  show_figure: 'figure',
  show_contact: 'contact',
};

function unknown(validIds: string[]) {
  return { shown: false, reason: 'UNKNOWN_ID', valid_ids: validIds };
}

function emitScene(world: WorldName, params: Record<string, unknown>) {
  bus.emit('scene', { world, params, at: performance.now() });
  track('world_shown', { world, id: (params.id as string) || (params.focus as string) || undefined });
}

function chipsFor(kb: Awaited<ReturnType<typeof fetchKB>>, key: 'after_project' | 'after_hubs' | 'after_people' | 'after_timeline', ctx: ToolContext) {
  const items = kb.suggested_questions[key]
    .map((q) => q[ctx.lang])
    .filter((q) => !ctx.askedChips.has(q))
    .slice(0, 3);
  if (items.length) bus.emit('chips', { items, source: 'kb' });
}

/**
 * Executes a Live API tool call in the browser. All handlers return within a few
 * milliseconds; the KB is already in memory after the first call.
 */
export async function executeTool(name: string, args: Record<string, any>, ctx: ToolContext): Promise<Record<string, unknown>> {
  const kb = await fetchKB();
  const lang = ctx.lang;
  track('tool_call', { id: name });

  switch (name) {
    case 'lookup_7d': {
      const query: string = String(args.query || '');
      const dns = screenDoNotSay(kb, query);
      if (dns) {
        track('topic', { id: 'do_not_say' });
        return { records: [], note: 'DO_NOT_SAY', reason: dns.reason };
      }
      const ids: string[] = Array.isArray(args.ids) ? args.ids : [];
      const picked = ids.map((id) => getRecord(kb, id)).filter(Boolean) as ReturnType<typeof getRecord>[];
      const hits = picked.length ? picked : search(kb, query).map((h) => h.rec);
      if (!hits.length) {
        track('topic', { id: 'not_in_kb' });
        return { records: [], note: 'NOT_IN_KB' };
      }
      hits.slice(0, 3).forEach((h) => track('topic', { id: h!.id }));
      return { records: hits.slice(0, 3).map((h) => localizeRecord(h!, lang)) };
    }

    case 'show_project': {
      const rec = getRecord(kb, String(args.id || ''));
      if (!rec || rec.type !== 'project') return unknown(kb.projects.map((p) => p.id));
      emitScene('project', { id: rec.id });
      chipsFor(kb, 'after_project', ctx);
      return { shown: true, title: rec.name[lang] };
    }

    case 'show_hubs': {
      const focus = args.focus ? getRecord(kb, String(args.focus)) : null;
      if (args.focus && (!focus || focus.type !== 'hub')) return unknown(kb.hubs.map((h) => h.id));
      emitScene('globe', { focus: focus?.id });
      chipsFor(kb, 'after_hubs', ctx);
      return { shown: true, title: focus ? focus.name[lang] : lang === 'ar' ? 'المراكز الخمسة' : 'Five hubs' };
    }

    case 'show_timeline': {
      const m = args.id ? getRecord(kb, String(args.id)) : null;
      if (args.id && (!m || m.type !== 'timeline')) return unknown(kb.timeline.map((t) => t.id));
      emitScene('timeline', { id: m?.id });
      chipsFor(kb, 'after_timeline', ctx);
      return { shown: true, title: m ? `${m.record.year} — ${m.name[lang]}` : lang === 'ar' ? 'قصتنا' : 'Our story' };
    }

    case 'show_person': {
      const p = getRecord(kb, String(args.id || ''));
      if (!p || p.type !== 'person') return unknown(kb.people.map((x) => x.id));
      emitScene('people', { id: p.id });
      chipsFor(kb, 'after_people', ctx);
      return { shown: true, title: p.name[lang] };
    }

    case 'show_people': {
      emitScene('people', {});
      chipsFor(kb, 'after_people', ctx);
      return { shown: true, title: lang === 'ar' ? 'القيادة' : 'Leadership' };
    }

    case 'show_disciplines': {
      const d = args.id ? getRecord(kb, String(args.id)) : null;
      if (args.id && (!d || d.type !== 'discipline')) return unknown(kb.disciplines.map((x) => x.id));
      emitScene('disciplines', { id: d?.id });
      return { shown: true, title: d ? d.name[lang] : lang === 'ar' ? 'سبعة تخصصات' : 'Seven disciplines' };
    }

    case 'show_figure': {
      const f = getRecord(kb, String(args.id || ''));
      if (!f || f.type !== 'figure') return unknown(kb.figures.map((x) => x.id));
      emitScene('figure', { id: f.id });
      return { shown: true, title: `${f.record.value} — ${f.name[lang]}` };
    }

    case 'show_contact': {
      emitScene('contact', {});
      return { shown: true, title: lang === 'ar' ? 'التواصل' : 'Contact' };
    }

    case 'return_to_presence': {
      bus.emit('scene', { world: 'presence', at: performance.now() });
      return { shown: true, title: 'Savannah' };
    }

    case 'suggest_questions': {
      const items = (Array.isArray(args.items) ? args.items : [])
        .map((s: unknown) => String(s).trim())
        .filter((s: string) => s && !ctx.askedChips.has(s))
        .slice(0, 3);
      if (items.length) bus.emit('chips', { items, source: 'model' });
      return { ok: true };
    }

    case 'story': {
      const action = String(args.action || 'start');
      const protocol =
        lang === 'ar'
          ? 'تكلمي عن هذا الفصل في حوالي عشرين ثانية من نقاط الحديث فقط، بصوتك أنتِ. لما تخلصين، استدعي story بالإجراء next. إذا قاطعك الزائر بسؤال، جاوبي عليه ثم اسألي "أكمل لك القصة؟" وإذا وافق استدعي story بالإجراء resume.'
          : 'Tell this chapter in about twenty seconds from the talking points only, in your own voice. When you finish, call story with action next. If the visitor interrupts with a question, answer it, then ask "Shall I carry on with the story?" and on yes call story with action resume.';
      let ch = null;
      if (action === 'start') ch = story.start();
      else if (action === 'next') ch = story.next();
      else if (action === 'resume') ch = story.resume();
      else if (action === 'stop') {
        story.stop();
        return { status: 'stopped' };
      }
      if (!ch) {
        bus.emit('scene', { world: 'presence', at: performance.now() });
        return { status: 'done', note: lang === 'ar' ? 'انتهت القصة. استدعي suggest_questions وارجعي للزائر.' : 'The story is finished. Call suggest_questions and hand back to the visitor.' };
      }
      // Drive the scene for this chapter ourselves so the picture lands before she speaks.
      await executeTool(ch.show.name, ch.show.args, ctx);
      return { status: story.state, ...chapterPayload(kb, ch, lang), instruction: protocol, chapters_total: CHAPTERS.length };
    }

    case 'capture_enquiry': {
      const draft = {
        name: str(args.name),
        organisation: str(args.organisation),
        country: str(args.country),
        topic: str(args.topic),
        email: str(args.email),
        phone: str(args.phone),
        language: (args.language === 'ar' ? 'ar' : lang) as Lang,
      };
      bus.emit('enquiry', draft);
      const missing = ['name', 'topic'].filter((k) => !(draft as any)[k]);
      if (!draft.email && !draft.phone) missing.push('email_or_phone');
      return { card_state: 'updated', missing };
    }

    default:
      return { error: `Unknown tool ${name}` };
  }
}

function str(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

export const SHOW_TOOL_WORLDS = VALID;
