import type { KnowledgeBase } from './schema';

type Lang = 'en' | 'ar';

/**
 * CORE FACTS block for the system instruction (~1,500 tokens), generated from the
 * knowledge base at server start. Nothing here is hand-written: every line is a
 * field of the validated KB, so it can never contradict lookup_7d.
 */
export function buildCoreFacts(kb: KnowledgeBase, lang: Lang): string {
  const t = (l: { en: string; ar: string }) => l[lang];
  const c = kb.company;
  const hubs = [...kb.hubs].sort((a, b) => a.order - b.order);
  const people = [...kb.people].sort((a, b) => a.rank - b.rank);
  const disciplines = [...kb.disciplines].sort((a, b) => a.order - b.order);

  const kindWord: Record<string, { en: string; ar: string }> = {
    delivered_involvement: { en: 'delivered involvement', ar: 'مشاركة منفّذة' },
    consultancy: { en: 'consultancy', ar: 'استشارات' },
    concept: { en: 'concept design, not built', ar: 'تصميم مفاهيمي، غير منفّذ' },
    studio_portfolio: { en: 'Atelier Simona studio portfolio', ar: 'أعمال استوديو أتيليه سيمونا' },
    design_consultancy: { en: 'design consultancy', ar: 'استشارات تصميم' },
  };

  if (lang === 'ar') {
    return [
      'الحقائق الأساسية (CORE FACTS) — مصدرها قاعدة المعرفة المعتمدة فقط:',
      `- الشركة: ${t(c.name)}، ${t(c.descriptor)}.`,
      `- الجذور: ${t(c.roots)}`,
      `- المقر الرئيسي: ${t(c.headquarters)}. المقر الإقليمي للشرق الأوسط: ${t(c.middle_east_headquarters)}.`,
      `- الانتشار: ${t(c.reach)}`,
      `- المراكز الخمسة: ${hubs.map((h) => `${t(h.name)} (${t(h.country)})`).join('، ')}.`,
      `- القيادة: ${people.map((p) => `${t(p.name)} — ${t(p.title)}`).join('؛ ')}.`,
      `- التخصصات السبعة: ${disciplines.map((d) => t(d.name)).join('؛ ')}.`,
      `- الأرقام: ${kb.figures.map((f) => `${f.value} (${t(f.spoken)}) = ${t(f.label)}`).join('؛ ')}.`,
      `- المشاريع: ${kb.projects.map((p) => `${t(p.name)} — ${kindWord[p.kind]?.ar ?? p.kind}`).join('؛ ')}.`,
      `- الشركاء: ${kb.partners.map((p) => t(p.name)).join('، ')}.`,
      `- التواصل العام: ${kb.contact.email}. مكتب رئيس مجلس الإدارة: chairman@7dint.net، مكتب الرئيس التنفيذي: ceo@7dint.net.`,
      '',
      'قواعد الصوت العامة (يجب الالتزام بها حرفيًا):',
      ...kb.meta.global_voice_rules.map((r) => `- ${r}`),
      '',
      'مواضيع ممنوعة (DO NOT SAY) — لا تذكرينها أبدًا حتى لو سألك الزائر؛ قولي إنك ما تقدرين تتكلمين عنها واعرضي التواصل مع الفريق:',
      ...kb.do_not_say.map((d) => `- ${d.topic}`),
    ].join('\n');
  }

  return [
    'CORE FACTS — from the verified knowledge base only:',
    `- Company: ${t(c.name)}, ${t(c.descriptor)}.`,
    `- Roots: ${t(c.roots)}`,
    `- Headquarters: ${t(c.headquarters)}. Middle East headquarters: ${t(c.middle_east_headquarters)}.`,
    `- Reach: ${t(c.reach)}`,
    `- Five hubs: ${hubs.map((h) => `${t(h.name)} (${t(h.country)})`).join(', ')}.`,
    `- Leadership: ${people.map((p) => `${t(p.name)} — ${t(p.title)}`).join('; ')}.`,
    `- Seven disciplines: ${disciplines.map((d) => t(d.name)).join('; ')}.`,
    `- Figures: ${kb.figures.map((f) => `${f.value} ("${t(f.spoken)}") = ${t(f.label)}`).join('; ')}.`,
    `- Projects: ${kb.projects.map((p) => `${t(p.name)} — ${kindWord[p.kind]?.en ?? p.kind}`).join('; ')}.`,
    `- Partners: ${kb.partners.map((p) => t(p.name)).join(', ')}.`,
    `- General contact: ${kb.contact.email}. Chairman's office: chairman@7dint.net. CEO's office: ceo@7dint.net.`,
    '',
    'GLOBAL VOICE RULES (follow every line exactly):',
    ...kb.meta.global_voice_rules.map((r) => `- ${r}`),
    '',
    'DO NOT SAY — never state these, even if the visitor raises them; say it is not something you can speak to and offer the team\'s contact:',
    ...kb.do_not_say.map((d) => `- ${d.topic}`),
  ].join('\n');
}
