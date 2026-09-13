import type { KnowledgeBase, Localized } from './types';

type Lang = 'en' | 'ar';

let kbCache: KnowledgeBase | null = null;
let kbPromise: Promise<KnowledgeBase> | null = null;

/** Fetches the validated, approval-filtered knowledge base from the server once. */
export function fetchKB(): Promise<KnowledgeBase> {
  if (kbCache) return Promise.resolve(kbCache);
  if (!kbPromise) {
    kbPromise = fetch('/api/kb', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`KB ${r.status}`);
        return r.json();
      })
      .then((kb: KnowledgeBase) => {
        kbCache = kb;
        return kb;
      })
      .catch((e) => {
        kbPromise = null;
        throw e;
      });
  }
  return kbPromise;
}

export function kbSync(): KnowledgeBase | null {
  return kbCache;
}

/* ---------------- normalisation (Phase 2 §3.2 / Phase 3 §3) ---------------- */

export function normalize(s: string): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
    .replace(/[ً-ٰٟۖ-ۭ]/g, '') // harakat
    .replace(/ـ/g, '') // tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s$+]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP = new Set([
  'the', 'a', 'an', 'of', 'in', 'to', 'is', 'are', 'was', 'were', 'what', 'who', 'where', 'when', 'why', 'how', 'do', 'does',
  'did', 'you', 'your', 'me', 'my', 'about', 'tell', 'us', 'we', 'it', 'and', 'or', 'for', 'on', 'at', 'with', 'this', 'that',
  'have', 'has', 'be', 'can', 'i', 'show', 'please',
  'وش', 'مين', 'وين', 'متى', 'ليش', 'كيف', 'هل', 'عن', 'في', 'من', 'الى', 'على', 'لي', 'احكي', 'ايش', 'انت', 'انتم', 'انتي',
  'هو', 'هي', 'كم', 'هذا', 'هذي', 'مع', 'او', 'و', 'اللي', 'ما', 'لا', 'تقدر', 'تقدرين', 'ابي', 'ابغى', 'وريني',
]);

export function tokens(s: string): string[] {
  return normalize(s)
    .split(' ')
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/* ---------------- record index ---------------- */

export type RecordType = 'company' | 'hub' | 'person' | 'timeline' | 'project' | 'discipline' | 'figure' | 'partner' | 'contact';

export interface IndexedRecord {
  id: string;
  type: RecordType;
  record: any;
  name: Localized;
  aliases: string[];
  /** long-form searchable text, both languages */
  body: string;
  related: string[];
}

let index: IndexedRecord[] | null = null;

export function buildIndex(kb: KnowledgeBase): IndexedRecord[] {
  if (index) return index;
  const out: IndexedRecord[] = [];
  const L = (l?: Localized) => (l ? `${l.en} ${l.ar}` : '');
  out.push({
    id: 'company', type: 'company', record: kb.company, name: kb.company.name, aliases: kb.company.aliases,
    body: [L(kb.company.roots), L(kb.company.reach), L(kb.company.descriptor), kb.company.vision_as_published, kb.company.mission_as_published].join(' '),
    related: ['fig-5-continents', 'fig-7-disciplines', 'fig-1993', ...kb.hubs.map((h) => h.id)],
  });
  for (const h of kb.hubs) {
    out.push({ id: h.id, type: 'hub', record: h, name: h.name, aliases: h.aliases, body: `${L(h.country)} ${L(h.role)}`,
      related: kb.projects.filter((p) => p.hub === h.id).map((p) => p.id) });
  }
  for (const p of kb.people) {
    out.push({ id: p.id, type: 'person', record: p, name: p.name, aliases: p.aliases, body: `${L(p.title)} ${L(p.bio)}`,
      related: p.id === 'roman-kuba' ? ['atelier-simona', 'atelier-simona-works', 'ostrava'] : [] });
  }
  for (const m of kb.timeline) {
    out.push({ id: m.id, type: 'timeline', record: m, name: m.title, aliases: [...m.aliases, m.year], body: `${m.year} ${L(m.detail)}`, related: [] });
  }
  for (const pr of kb.projects) {
    out.push({ id: pr.id, type: 'project', record: pr, name: pr.name, aliases: pr.aliases,
      body: `${L(pr.location)} ${L(pr.summary)} ${L(pr.role_as_stated)} ${pr.context_facts.map((c) => `${c.en} ${c.ar}`).join(' ')}`,
      related: [pr.hub || '', ...pr.disciplines].filter(Boolean) });
  }
  for (const d of kb.disciplines) {
    out.push({ id: d.id, type: 'discipline', record: d, name: d.name, aliases: d.aliases, body: L(d.summary),
      related: kb.projects.filter((p) => p.disciplines.includes(d.id)).map((p) => p.id) });
  }
  for (const f of kb.figures) {
    out.push({ id: f.id, type: 'figure', record: f, name: f.label, aliases: [...f.aliases, f.value], body: `${f.value} ${L(f.spoken)} ${L(f.label)}`, related: [] });
  }
  for (const pa of kb.partners) {
    out.push({ id: pa.id, type: 'partner', record: pa, name: pa.name, aliases: pa.aliases, body: L(pa.relationship), related: [] });
  }
  out.push({
    id: 'contact', type: 'contact', record: kb.contact, name: { en: 'Contact', ar: 'التواصل' },
    aliases: ['contact', 'email', 'phone', 'website', 'reach', 'get in touch', 'call', 'تواصل', 'ايميل', 'بريد', 'رقم', 'هاتف', 'موقع', 'اتصل'],
    body: `${kb.contact.email} ${kb.contact.website} ${kb.contact.offices.en.join(' ')} ${kb.contact.offices.ar.join(' ')}`, related: [],
  });
  index = out;
  return out;
}

export function getRecord(kb: KnowledgeBase, id: string): IndexedRecord | undefined {
  const target = normalize(id);
  return buildIndex(kb).find((r) => normalize(r.id) === target);
}

/* ---------------- DO_NOT_SAY keyword screen ---------------- */

const DNS_KEYWORDS: Array<{ match: RegExp; keys: string[] }> = [
  { match: /polysilicon/i, keys: ['polysilicon', 'poly silicon', 'jubail', 'silicon valley', 'بولي سيليكون', 'بوليسيليكون', 'الجبيل', 'سيليكون'] },
  { match: /employee numbers|revenue/i, keys: ['employee', 'employees', 'staff', 'headcount', 'how many people work', 'revenue', 'turnover', 'valuation', 'profit', 'موظف', 'موظفين', 'ايراد', 'ايرادات', 'ارباح', 'تقييم', 'كم واحد يشتغل'] },
  { match: /^awards/i, keys: ['award', 'awards', 'prize', 'prizes', 'جائزه', 'جوائز'] },
  { match: /personal phone/i, keys: ['mobile number', 'cell number', 'personal number', 'whatsapp', 'home address', 'birthday', 'family of', 'جوال', 'موبايل', 'واتساب', 'عنوان بيت', 'ميلاد', 'عائله'] },
  { match: /contract values/i, keys: ['contract value', 'how much did it cost', 'how much was the contract', 'budget of', 'قيمه العقد', 'كم تكلفه', 'كم كلف', 'ميزانيه'] },
  { match: /product ventures/i, keys: ['health drink', 'medical food', 'algae', 'مشروب صحي', 'طحالب'] },
  { match: /former company names/i, keys: ['former name', 'previous name', 'dissolved', 'registry history', 'اسم سابق', 'الاسم القديم'] },
];

export function screenDoNotSay(kb: KnowledgeBase, query: string): { topic: string; reason: string } | null {
  const q = normalize(query);
  for (const dns of kb.do_not_say) {
    const rule = DNS_KEYWORDS.find((k) => k.match.test(dns.topic));
    if (!rule) continue;
    if (rule.keys.some((k) => q.includes(normalize(k)))) return { topic: dns.topic, reason: dns.reason };
  }
  return null;
}

/* ---------------- search (Phase 2 §3.2) ---------------- */

export interface SearchHit {
  rec: IndexedRecord;
  score: number;
}

export function search(kb: KnowledgeBase, query: string, limit = 3): SearchHit[] {
  const idx = buildIndex(kb);
  const nq = normalize(query);
  const qTokens = tokens(query);
  if (!nq) return [];

  // FAQ boost: which faq questions share tokens with the query
  const faqBoost = new Set<string>();
  for (const f of kb.faq) {
    const ft = new Set([...tokens(f.q.en), ...tokens(f.q.ar)]);
    const overlap = qTokens.filter((t) => ft.has(t)).length;
    if (overlap >= Math.max(1, Math.ceil(qTokens.length * 0.5)) && overlap >= 1) f.use_records.forEach((id) => faqBoost.add(id));
  }

  const hits: SearchHit[] = [];
  for (const rec of idx) {
    let score = 0;
    const nameN = normalize(`${rec.name.en} ${rec.name.ar}`);
    for (const alias of rec.aliases) {
      const na = normalize(alias);
      if (!na) continue;
      if (nq === na || nq.includes(` ${na} `) || nq.startsWith(`${na} `) || nq.endsWith(` ${na}`) || nq === na) score += 10;
      else if (nq.includes(na) && na.length >= 4) score += 6;
      for (const at of na.split(' ')) if (at.length > 2 && qTokens.includes(at)) score += 4;
    }
    for (const t of qTokens) {
      if (nameN.includes(t)) score += 2;
    }
    const bodyN = normalize(rec.body);
    for (const t of qTokens) if (t.length > 2 && bodyN.includes(t)) score += 1;
    if (faqBoost.has(rec.id)) score += 6;
    if (score > 0) hits.push({ rec, score });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.filter((h) => h.score >= 4).slice(0, limit);
}

/* ---------------- localisation for the model ---------------- */

const KIND: Record<string, Localized> = {
  delivered_involvement: { en: 'delivered involvement', ar: 'مشاركة منفّذة' },
  consultancy: { en: 'consultancy', ar: 'استشارات' },
  concept: { en: 'concept design (not built)', ar: 'تصميم مفاهيمي (غير منفّذ)' },
  studio_portfolio: { en: 'studio portfolio', ar: 'أعمال استوديو' },
  design_consultancy: { en: 'design consultancy', ar: 'استشارات تصميم' },
};

function clampWords(s: string, max = 120): string {
  const w = s.split(/\s+/);
  return w.length <= max ? s : w.slice(0, max).join(' ') + '…';
}

/** Spoken-ready text for one record, ≤120 words, in the session language. */
export function localizeRecord(rec: IndexedRecord, lang: Lang): { id: string; type: RecordType; text: string; voice_rules: string[]; related_ids: string[] } {
  const r = rec.record;
  const L = (l?: Localized) => (l ? l[lang] : '');
  let text = '';
  const rules: string[] = [];
  switch (rec.type) {
    case 'company':
      text = `${L(r.name)} — ${L(r.descriptor)}. ${L(r.roots)} ${lang === 'ar' ? 'المقر الرئيسي' : 'Headquarters'}: ${L(r.headquarters)}. ${lang === 'ar' ? 'المقر الإقليمي' : 'Middle East HQ'}: ${L(r.middle_east_headquarters)}. ${L(r.reach)}`;
      break;
    case 'hub':
      text = `${L(r.name)}, ${L(r.country)}: ${L(r.role)}.`;
      break;
    case 'person':
      text = `${L(r.name)}, ${L(r.title)}. ${L(r.bio)}${r.office_contact ? ` ${lang === 'ar' ? 'بريد المكتب' : 'Office email'}: ${r.office_contact}.` : ''}`;
      break;
    case 'timeline':
      text = `${r.year} — ${L(r.title)}: ${L(r.detail)}`;
      break;
    case 'project':
      text = `${L(r.name)} (${L(KIND[r.kind])}), ${L(r.location)}. ${lang === 'ar' ? 'دور سفن دي' : "7D's role"}: ${L(r.role_as_stated)} ${L(r.summary)}`;
      for (const c of r.context_facts || []) {
        text += ` ${c[lang]}`;
        if (c.voice_rule) rules.push(c.voice_rule);
      }
      rules.push(...(r.voice_rules || []));
      break;
    case 'discipline':
      text = `${L(r.name)}: ${L(r.summary)}`;
      rules.push(...(r.voice_rules || []));
      break;
    case 'figure':
      text = `${r.value} (${lang === 'ar' ? 'تُقال' : 'say'}: "${L(r.spoken)}") — ${L(r.label)}.`;
      if (r.voice_rule) rules.push(r.voice_rule);
      break;
    case 'partner':
      text = `${L(r.name)}: ${L(r.relationship)}`;
      if (r.voice_rule) rules.push(r.voice_rule);
      break;
    case 'contact':
      text = lang === 'ar'
        ? `الإيميل العام ${r.email}. الهاتف ${r.phone} (يُقال: ${r.phone_spoken.ar}). الموقع ${r.website} (يُقال: ${r.website_spoken.ar}). المكاتب: ${r.offices.ar.join('، ')}.`
        : `General email ${r.email}. Phone ${r.phone} (say: ${r.phone_spoken.en}). Website ${r.website} (say: ${r.website_spoken.en}). Offices: ${r.offices.en.join(', ')}.`;
      if (r.voice_rule) rules.push(r.voice_rule);
      break;
  }
  return { id: rec.id, type: rec.type, text: clampWords(text), voice_rules: rules, related_ids: rec.related };
}

export function displayName(rec: IndexedRecord, lang: Lang): string {
  return rec.name[lang];
}
