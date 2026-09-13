import fs from 'fs';
import path from 'path';
import { z } from 'zod';

const MetaSchema = z.object({
  version: z.string().optional(),
  updated: z.string().optional(),
  status_legend: z.record(z.string(), z.string()).optional(),
  approval_policy: z.string().optional(),
  global_voice_rules: z.array(z.string()),
});

const CompanySchema = z.object({
  id: z.string(),
  name: z.string(),
  name_ar: z.string(),
  tagline_en: z.string().optional(),
  tagline_ar: z.string().optional(),
  roots: z.object({
    year: z.number(),
    location: z.string(),
    location_ar: z.string(),
    heritage: z.string(),
    heritage_ar: z.string(),
  }),
  hqs: z.object({
    global: z.object({
      city: z.string(),
      country: z.string(),
      label: z.string(),
      label_ar: z.string(),
    }),
    middle_east: z.object({
      city: z.string(),
      country: z.string(),
      label: z.string(),
      label_ar: z.string(),
    }),
  }),
  vision: z.object({
    en: z.string(),
    ar: z.string(),
  }),
  mission: z.object({
    en: z.string(),
    ar: z.string(),
  }),
  operating_model: z.object({
    en: z.string(),
    ar: z.string(),
  }),
  legal_entities: z.array(z.string()),
  status: z.string().optional(),
  approved: z.boolean().default(true),
  aliases: z.array(z.string()).default([]),
  source: z.string().optional(),
});

const HubSchema = z.object({
  id: z.string(),
  name: z.string(),
  name_ar: z.string(),
  city: z.string(),
  city_ar: z.string(),
  country: z.string(),
  country_ar: z.string(),
  coordinates: z.tuple([z.number(), z.number()]),
  role: z.string(),
  role_ar: z.string(),
  summary_en: z.string(),
  summary_ar: z.string(),
  order: z.number(),
  aliases: z.array(z.string()).default([]),
  status: z.string().optional(),
  approved: z.boolean().default(true),
  source: z.string().optional(),
});

const PersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  name_ar: z.string(),
  title: z.string(),
  title_ar: z.string(),
  bio_en: z.string(),
  bio_ar: z.string(),
  email: z.string(),
  portrait: z.string(),
  aliases: z.array(z.string()).default([]),
  status: z.string().optional(),
  approved: z.boolean().default(true),
  source: z.string().optional(),
});

const MilestoneSchema = z.object({
  id: z.string(),
  year: z.union([z.string(), z.number()]),
  title_en: z.string(),
  title_ar: z.string(),
  summary_en: z.string(),
  summary_ar: z.string(),
  aliases: z.array(z.string()).default([]),
  status: z.string().optional(),
  approved: z.boolean().default(true),
  source: z.string().optional(),
});

const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  name_ar: z.string(),
  location: z.string(),
  location_ar: z.string(),
  kind: z.enum([
    'delivered_involvement',
    'consultancy',
    'concept',
    'studio_portfolio',
    'design_consultancy',
  ]),
  role_as_stated: z.string(),
  role_as_stated_ar: z.string(),
  summary_en: z.string(),
  summary_ar: z.string(),
  context_facts: z.array(z.string()),
  voice_rules: z.array(z.string()),
  images: z.array(z.string()),
  aliases: z.array(z.string()).default([]),
  related_ids: z.array(z.string()).optional(),
  status: z.string().optional(),
  approved: z.boolean().default(true),
  source: z.string().optional(),
});

const DisciplineSchema = z.object({
  id: z.string(),
  name: z.string(),
  name_ar: z.string(),
  summary_en: z.string(),
  summary_ar: z.string(),
  related_projects: z.array(z.string()).default([]),
  aliases: z.array(z.string()).default([]),
  status: z.string().optional(),
  approved: z.boolean().default(true),
  source: z.string().optional(),
});

const FigureSchema = z.object({
  id: z.string(),
  value: z.string(),
  spoken_en: z.string(),
  spoken_ar: z.string(),
  label_en: z.string(),
  label_ar: z.string(),
  detail_en: z.string(),
  detail_ar: z.string(),
  aliases: z.array(z.string()).default([]),
  status: z.string().optional(),
  approved: z.boolean().default(true),
  source: z.string().optional(),
});

const PartnerSchema = z.object({
  id: z.string(),
  name: z.string(),
  name_ar: z.string(),
  role_en: z.string(),
  role_ar: z.string(),
  aliases: z.array(z.string()).default([]),
  status: z.string().optional(),
  approved: z.boolean().default(true),
  source: z.string().optional(),
});

const ContactSchema = z.object({
  general_email: z.string(),
  general_email_spoken_en: z.string(),
  general_email_spoken_ar: z.string(),
  chairman_email: z.string(),
  chairman_email_spoken_en: z.string(),
  chairman_email_spoken_ar: z.string(),
  website: z.string(),
  website_spoken_en: z.string(),
  website_spoken_ar: z.string(),
  riyadh_office: z.string(),
  riyadh_office_ar: z.string(),
  florida_office: z.string(),
  florida_office_ar: z.string(),
  phone: z.string().optional(),
  status: z.string().optional(),
  approved: z.boolean().default(true),
  aliases: z.array(z.string()).default([]),
  source: z.string().optional(),
});

const FAQSchema = z.object({
  question: z.string(),
  question_ar: z.string(),
  use_records: z.array(z.string()),
});

const DoNotSaySchema = z.object({
  topic: z.string(),
  keywords: z.array(z.string()),
  reason: z.string(),
  response_en: z.string(),
  response_ar: z.string(),
});

export const KnowledgeBaseSchema = z.object({
  meta: MetaSchema,
  company: CompanySchema,
  hubs: z.array(HubSchema),
  people: z.array(PersonSchema),
  timeline: z.array(MilestoneSchema),
  projects: z.array(ProjectSchema),
  disciplines: z.array(DisciplineSchema),
  figures: z.array(FigureSchema),
  partners: z.array(PartnerSchema),
  contact: ContactSchema,
  faq: z.array(FAQSchema),
  do_not_say: z.array(DoNotSaySchema),
  suggested_questions: z.record(z.string(), z.any()),
  pronunciation: z.record(z.string(), z.any()),
});

export type KnowledgeBase = z.infer<typeof KnowledgeBaseSchema>;

let cachedKB: KnowledgeBase | null = null;

export function loadKnowledgeBase(approvedOnly = process.env.KB_APPROVED_ONLY === 'true'): KnowledgeBase {
  if (cachedKB) {
    return cachedKB;
  }

  const kbPath = path.join(process.cwd(), 'public', 'kb', 'savannah-knowledge-base.json');
  if (!fs.existsSync(kbPath)) {
    throw new Error(`Knowledge base file not found at ${kbPath}`);
  }

  const raw = fs.readFileSync(kbPath, 'utf-8');
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e: any) {
    throw new Error(`Knowledge base JSON parse error: ${e.message}`);
  }

  const result = KnowledgeBaseSchema.safeParse(json);
  if (!result.success) {
    console.error('KB Schema validation errors:', JSON.stringify(result.error.format(), null, 2));
    throw new Error(`Knowledge base schema validation failed: ${result.error.message}`);
  }

  let kb = result.data;

  if (approvedOnly) {
    kb = {
      ...kb,
      hubs: kb.hubs.filter((h) => h.approved),
      people: kb.people.filter((p) => p.approved),
      timeline: kb.timeline.filter((t) => t.approved),
      projects: kb.projects.filter((pr) => pr.approved),
      disciplines: kb.disciplines.filter((d) => d.approved),
      figures: kb.figures.filter((f) => f.approved),
      partners: kb.partners.filter((p) => p.approved),
    };
  }

  cachedKB = kb;
  console.log(
    `[KB Loader] Loaded and validated 7D Knowledge Base: ${kb.projects.length} projects, ${kb.hubs.length} hubs, ${kb.people.length} people.`
  );
  return kb;
}
