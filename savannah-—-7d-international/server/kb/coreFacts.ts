import { loadKnowledgeBase } from './load';

export function getCoreFacts(lang: 'en' | 'ar'): string {
  const kb = loadKnowledgeBase();

  if (lang === 'ar') {
    return `
الحقائق الأساسية (CORE FACTS - يجب معرفتها دائمًا):
- الجذور: جمهورية التشيك عام ١٩٩٣، تأسست على يد المعماري رومان كوبا (أتيليه سيمونا سابقاً).
- المقران الرئيسيان: المقر العالمي في فلوريدا (الولايات المتحدة)، ومقر الشرق الأوسط في الرياض (المملكة العربية السعودية).
- أبرز معالم الرياض: النافورة الراقصة في منتزه الملك عبدالله بالملز، نفّذناها بالشراكة مع بي إف كوريا ومجموعة جودت (نفّذنا النافورة ولم نبنِ المنتزه بأكمله).
- شاركنا في إطلاق مشروع حدائق الملك عبدالله العالمية بالرياض.
- الشريك الاستراتيجي في المملكة العربية السعودية: تكوين الراجحي.
- قنوات التواصل الرسمية: info@7dint.net و chairman@7dint.net.
- قواعد التحدث: من جملتين إلى ٤ جمل كحد أقصى، دون مبالغات أو ادعاءات غير موثقة، والالتزام الحرفي بصياغة دور 7D المعلن.
- مواضيع ممنوع ذكر تفاصيلها إطلاقاً (DO NOT SAY): مصنع البولي سيليكون بالجبيل، عدد الموظفين، الإيرادات أو الأرقام المالية، الجوائز التسويقية، وأرقام الهواتف أو الجوالات الشخصية. يُحال الزائر دائماً إلى البريد الرسمي.
`.trim();
  }

  return `
CORE FACTS (always in prompt, never contradict):
- 7D's roots: Founded in 1993 in Ostrava, Czech Republic by architect Roman Kuba (originating with Atelier Simona).
- Two HQs: Global Headquarters in Florida, USA; Middle East Headquarters in Riyadh, Saudi Arabia.
- Landmark in Riyadh: The dancing fountain at King Abdullah Park in Al-Malaz, executed with partners PF Korea and Gawdat Group. (7D executed the dancing fountain; 7D did NOT build the entire park).
- 7D describes launching the King Abdullah International Gardens project alongside national consortia.
- Concept study: Riyadh Eye is a concept design study shaped like a spaceship and water drop, not an open attraction visitors can ride today.
- Scale figure: 1,500 refers to cellular base stations rolled out across Europe and Australasia ($80M contracts), NOT 1,500 projects.
- Strategic partner in Saudi Arabia: Takween Alrajhi.
- Contact: Official inquiries to info@7dint.net; Chairman's office to chairman@7dint.net.
- Spoken rules: Keep answers to 2-4 spoken sentences, natural conversational tone, no unverified superlatives, strict role wording.
- Confidential DO NOT SAY topics: Polysilicon/Jubail plant, employee counts, revenue/financial figures, marketing awards, personal mobile numbers. Always redirect to info@7dint.net.
`.trim();
}
