import { bus, type WorldName } from '../state/bus';
import { fetchKB, getRecord, search, screenDoNotSay, localizeRecord } from '../kb/client';
import { story, chapterPayload, CHAPTERS } from '../story/story';
import { track } from '../analytics';

type Lang = 'en' | 'ar';

let enquiryDraft: Record<string, string | undefined> = {};
export function resetEnquiry() {
  enquiryDraft = {};
}

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

/** Exact id, else the best fuzzy match of the right type (the model sometimes says 'riyadh-fountain'). */
function resolve(kb: Awaited<ReturnType<typeof fetchKB>>, id: string, type: string) {
  const exact = getRecord(kb, id);
  if (exact && exact.type === type) return exact;
  const hit = search(kb, id.replace(/[-_]/g, ' '), 5).find((h) => h.rec.type === type);
  return hit ? hit.rec : undefined;
}

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
      const top = hits[0]!;
      const showFor: Partial<Record<string, string>> = { project: 'show_project', hub: 'show_hubs', person: 'show_person', timeline: 'show_timeline', discipline: 'show_disciplines', figure: 'show_figure', contact: 'show_contact', company: 'show_hubs' };
      const showTool = showFor[top.type];
      const showArgs = top.type === 'hub' ? { focus: top.id } : top.type === 'contact' || top.type === 'company' ? {} : { id: top.id };
      return {
        records: hits.slice(0, 3).map((h) => localizeRecord(h!, lang)),
        next_steps: [
          showTool ? `Call ${showTool}(${JSON.stringify(showArgs)}) NOW, before you speak.` : 'Speak from the records only.',
          'Then answer in 2-4 sentences from these records only, following every voice_rules line.',
          'Then call suggest_questions with 2 or 3 short follow-ups.',
        ],
      };
    }

    case 'show_project': {
      const rec = resolve(kb, String(args.id || ''), 'project');
      if (!rec) return unknown(kb.projects.map((p) => p.id));
      emitScene('project', { id: rec.id });
      chipsFor(kb, 'after_project', ctx);
      return { shown: true, title: rec.name[lang] };
    }

    case 'show_hubs': {
      const focus = args.focus ? resolve(kb, String(args.focus), 'hub') : null;
      if (args.focus && !focus) return unknown(kb.hubs.map((h) => h.id));
      emitScene('globe', { focus: focus?.id });
      chipsFor(kb, 'after_hubs', ctx);
      return { shown: true, title: focus ? focus.name[lang] : lang === 'ar' ? 'المراكز الخمسة' : 'Five hubs' };
    }

    case 'show_timeline': {
      const m = args.id ? resolve(kb, String(args.id), 'timeline') : null;
      if (args.id && !m) return unknown(kb.timeline.map((t) => t.id));
      emitScene('timeline', { id: m?.id });
      chipsFor(kb, 'after_timeline', ctx);
      return { shown: true, title: m ? `${m.record.year} — ${m.name[lang]}` : lang === 'ar' ? 'قصتنا' : 'Our story' };
    }

    case 'show_person': {
      const p = resolve(kb, String(args.id || ''), 'person');
      if (!p) return unknown(kb.people.map((x) => x.id));
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
      const d = args.id ? resolve(kb, String(args.id), 'discipline') : null;
      if (args.id && !d) return unknown(kb.disciplines.map((x) => x.id));
      emitScene('disciplines', { id: d?.id });
      return { shown: true, title: d ? d.name[lang] : lang === 'ar' ? 'سبعة تخصصات' : 'Seven disciplines' };
    }

    case 'show_figure': {
      const f = resolve(kb, String(args.id || ''), 'figure');
      if (!f) return unknown(kb.figures.map((x) => x.id));
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
          ? 'تكلمي عن هذا الفصل في حوالي عشرين ثانية من نقاط الحديث فقط، بصوتك أنتِ، وبعدين اسكتي: الفصل الجاي يجي لحاله بدون ما تسألين. إذا قاطعك الزائر بسؤال، جاوبي عليه ثم اسألي "أكمل لك القصة؟" وإذا وافق استدعي story بالإجراء resume.'
          : 'Tell this chapter in about twenty seconds from the talking points only, in your own voice, then stop: the next chapter follows on its own, do not ask whether to continue and do not call next. Only if the visitor interrupts with a question: answer it, then ask "Shall I carry on with the story?" and on yes call story with action resume.';
      let ch = null;
      if (action === 'start') ch = story.start();
      else if (action === 'next') {
        // The client turns the page when the chapter's audio has finished; the model only speaks.
        return { status: story.state, note: lang === 'ar' ? 'الفصول تنتقل لحالها بعد ما تخلصين الكلام. ما تحتاجين تستدعين next.' : 'Chapters advance on their own once you finish speaking. You do not need to call next.' };
      } else if (action === 'resume') ch = story.resume();
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
      // Merge with what earlier calls captured: the model often omits fields it already gave.
      for (const k of ['name', 'organisation', 'country', 'topic', 'email', 'phone']) {
        const v = str(args[k]);
        if (v) enquiryDraft[k] = v;
      }
      const draft = {
        name: enquiryDraft.name,
        organisation: enquiryDraft.organisation,
        country: enquiryDraft.country,
        topic: enquiryDraft.topic,
        email: enquiryDraft.email,
        phone: enquiryDraft.phone,
        language: (args.language === 'ar' ? 'ar' : lang) as Lang,
      };
      const substantive = !!(draft.name || draft.organisation || draft.email || draft.phone);
      if (!substantive) {
        return { card_state: 'not_started', note: lang === 'ar' ? 'ما تستخدمين هذه الأداة إلا إذا طلب الزائر صراحة يترك رسالة أو يتواصل معه الفريق. جاوبي على سؤاله عادي.' : 'Use this only after the visitor explicitly asks to leave a message or be contacted. Answer their question normally.' };
      }
      if (story.state !== 'idle') story.stop();
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
