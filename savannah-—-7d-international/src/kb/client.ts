// Client-side 7D International Knowledge Base access & search
export interface ProjectRecord {
  id: string;
  name: string;
  name_ar: string;
  location: string;
  location_ar?: string;
  hero_image: string;
  role_as_stated: string;
  role_as_stated_ar: string;
  role_en?: string;
  role_ar?: string;
  summary_en: string;
  summary_ar: string;
  is_concept?: boolean;
  aliases?: string[];
  facts?: string[];
  context_facts?: string[];
  voice_rules?: string[];
}

export interface PersonRecord {
  id: string;
  name: string;
  name_ar: string;
  title: string;
  title_en?: string;
  title_ar: string;
  bio_en: string;
  bio_ar: string;
  email?: string;
  aliases?: string[];
}

export interface TimelineRecord {
  id?: string;
  year: number;
  title_en: string;
  title_ar: string;
  summary_en: string;
  summary_ar: string;
  aliases?: string[];
}

export interface DisciplineRecord {
  id: string;
  name: string;
  name_ar: string;
  summary: string;
  summary_ar: string;
  related_projects?: string[];
  aliases?: string[];
}

export interface FigureRecord {
  id: string;
  value: string;
  label: string;
  label_ar: string;
  detail: string;
  detail_ar: string;
  spoken_en?: string;
  spoken_ar?: string;
  aliases?: string[];
}

export interface ContactData {
  general_email: string;
  chairman_email: string;
  website: string;
  riyadh_office: string;
  riyadh_office_ar: string;
  florida_office: string;
  florida_office_ar: string;
}

export interface KnowledgeBaseData {
  meta: any;
  company: any;
  hubs: any[];
  people: any[];
  timeline: any[];
  projects: any[];
  disciplines: any[];
  figures: any[];
  partners: any[];
  contact: any;
  faq: any[];
  do_not_say: any[];
  suggested_questions: Record<string, any>;
  pronunciation: Record<string, any>;
}

let cachedKB: KnowledgeBaseData | null = null;
let kbPromise: Promise<KnowledgeBaseData> | null = null;

export async function fetchKnowledgeBase(): Promise<KnowledgeBaseData> {
  if (cachedKB) return cachedKB;
  if (kbPromise) return kbPromise;

  kbPromise = (async () => {
    try {
      const res = await fetch('/kb/savannah-knowledge-base.json');
      if (!res.ok) {
        throw new Error(`Failed to load knowledge base: HTTP ${res.status}`);
      }
      const data = await res.json();
      cachedKB = data;
      return data;
    } catch (err) {
      console.error('Failed to fetch knowledge base:', err);
      throw err;
    } finally {
      kbPromise = null;
    }
  })();

  return kbPromise;
}

export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove latin diacritics
    .replace(/[\u064B-\u065F]/g, '') // remove arabic tashkeel
    .replace(/[^\w\s\u0600-\u06FF]/g, ' ') // keep alphanum and arabic
    .replace(/\s+/g, ' ')
    .trim();
}

export function searchKB(kb: KnowledgeBaseData, rawQuery: string): {
  status: 'FOUND' | 'NOT_IN_KB' | 'DO_NOT_SAY';
  record?: any;
  kind?: string;
  topic?: string;
  reason?: string;
  response_en?: string;
  response_ar?: string;
  summary?: string;
} {
  const query = normalizeText(rawQuery);
  if (!query) {
    return { status: 'NOT_IN_KB' };
  }

  // 1. Check DO_NOT_SAY rules first
  for (const dns of kb.do_not_say || []) {
    for (const kw of dns.keywords || []) {
      const normKw = normalizeText(kw);
      if (normKw && query.includes(normKw)) {
        return {
          status: 'DO_NOT_SAY',
          topic: dns.topic,
          reason: dns.reason,
          response_en: dns.response_en,
          response_ar: dns.response_ar,
        };
      }
    }
  }

  // 2. Direct match helpers
  const checkAliases = (item: any): boolean => {
    if (!item) return false;
    if (item.id && normalizeText(item.id).includes(query)) return true;
    if (item.name && normalizeText(item.name).includes(query)) return true;
    if (item.name_ar && normalizeText(item.name_ar).includes(query)) return true;
    if (Array.isArray(item.aliases)) {
      for (const a of item.aliases) {
        const normA = normalizeText(a);
        if (normA && (query.includes(normA) || normA.includes(query))) {
          return true;
        }
      }
    }
    return false;
  };

  // Check Projects
  for (const p of kb.projects || []) {
    if (checkAliases(p) || normalizeText(p.location || '').includes(query)) {
      return { status: 'FOUND', record: p, kind: 'project', summary: p.summary_en };
    }
  }

  // Check People
  for (const p of kb.people || []) {
    if (checkAliases(p) || normalizeText(p.title || '').includes(query)) {
      return { status: 'FOUND', record: p, kind: 'person', summary: p.bio_en };
    }
  }

  // Check Hubs
  for (const h of kb.hubs || []) {
    if (checkAliases(h) || normalizeText(h.city || '').includes(query) || normalizeText(h.country || '').includes(query)) {
      return { status: 'FOUND', record: h, kind: 'hub', summary: h.summary_en };
    }
  }

  // Check Figures
  for (const f of kb.figures || []) {
    if (checkAliases(f) || normalizeText(f.value || '').includes(query)) {
      return { status: 'FOUND', record: f, kind: 'figure', summary: f.detail_en };
    }
  }

  // Check Disciplines
  for (const d of kb.disciplines || []) {
    if (checkAliases(d)) {
      return { status: 'FOUND', record: d, kind: 'discipline', summary: d.summary_en };
    }
  }

  // Check Timeline
  for (const t of kb.timeline || []) {
    if (checkAliases(t) || String(t.year).includes(query)) {
      return { status: 'FOUND', record: t, kind: 'timeline', summary: t.summary_en };
    }
  }

  // Check Partners
  for (const pr of kb.partners || []) {
    if (checkAliases(pr)) {
      return { status: 'FOUND', record: pr, kind: 'partner', summary: pr.role_en };
    }
  }

  // Check Company
  if (checkAliases(kb.company) || query.includes('7d') || query.includes('roots') || query.includes('czech')) {
    return { status: 'FOUND', record: kb.company, kind: 'company', summary: kb.company.vision?.en };
  }

  // Check Contact
  if (
    query.includes('email') ||
    query.includes('contact') ||
    query.includes('phone') ||
    query.includes('reach') ||
    query.includes('تواصل') ||
    query.includes('ايميل')
  ) {
    return { status: 'FOUND', record: kb.contact, kind: 'contact', summary: 'Official 7D contact info' };
  }

  return { status: 'NOT_IN_KB' };
}

export function getRecordById(kb: KnowledgeBaseData, id: string): { record: any; kind: string } | null {
  if (!id) return null;
  const target = id.toLowerCase().trim();

  for (const p of kb.projects || []) {
    if (p.id.toLowerCase() === target) return { record: p, kind: 'project' };
  }
  for (const p of kb.people || []) {
    if (p.id.toLowerCase() === target) return { record: p, kind: 'person' };
  }
  for (const h of kb.hubs || []) {
    if (h.id.toLowerCase() === target) return { record: h, kind: 'hub' };
  }
  for (const d of kb.disciplines || []) {
    if (d.id.toLowerCase() === target) return { record: d, kind: 'discipline' };
  }
  for (const f of kb.figures || []) {
    if (f.id.toLowerCase() === target) return { record: f, kind: 'figure' };
  }
  for (const t of kb.timeline || []) {
    if (t.id.toLowerCase() === target) return { record: t, kind: 'timeline' };
  }
  for (const pr of kb.partners || []) {
    if (pr.id.toLowerCase() === target) return { record: pr, kind: 'partner' };
  }
  if (kb.company?.id?.toLowerCase() === target) {
    return { record: kb.company, kind: 'company' };
  }
  return null;
}

export function localize(item: any, lang: 'en' | 'ar'): Record<string, any> {
  if (!item) return {};
  const isAr = lang === 'ar';

  return {
    ...item,
    displayName: isAr ? item.name_ar || item.name : item.name || item.name_ar,
    displayTitle: isAr ? item.title_ar || item.title : item.title || item.title_ar,
    displaySummary: isAr ? item.summary_ar || item.summary_en : item.summary_en || item.summary_ar,
    displayRole: isAr ? item.role_ar || item.role : item.role || item.role_ar,
    displayBio: isAr ? item.bio_ar || item.bio_en : item.bio_en || item.bio_ar,
    displayCity: isAr ? item.city_ar || item.city : item.city || item.city_ar,
    displayCountry: isAr ? item.country_ar || item.country : item.country || item.country_ar,
    displayDetail: isAr ? item.detail_ar || item.detail_en : item.detail_en || item.detail_ar,
    displayLabel: isAr ? item.label_ar || item.label_en : item.label_en || item.label_ar,
    displayRoleAsStated: isAr ? item.role_as_stated_ar || item.role_as_stated : item.role_as_stated || item.role_as_stated_ar,
  };
}
