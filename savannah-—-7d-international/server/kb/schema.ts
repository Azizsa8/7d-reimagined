import { z } from 'zod';

/**
 * Zod schema for docs/savannah/savannah-knowledge-base.json (spec shape).
 * Records keep unknown keys (looseObject) so future fields survive validation,
 * but every field Savannah relies on is typed and required here.
 */
export const L = z.object({ en: z.string(), ar: z.string() });
export type Localized = z.infer<typeof L>;

const status = z.enum(['official', 'official_archive', 'registry', 'concept']);

const base = {
  id: z.string().min(1),
  status,
  approved: z.boolean(),
  aliases: z.array(z.string()).default([]),
};

export const CompanySchema = z.looseObject({
  ...base,
  name: L,
  descriptor: L,
  headline_as_published: z.string().optional(),
  roots: L,
  headquarters: L,
  middle_east_headquarters: L,
  reach: L,
  vision_as_published: z.string().optional(),
  vision_ar: z.string().optional(),
  mission_as_published: z.string().optional(),
  mission_ar: z.string().optional(),
  chairman_message_as_published: z.string().optional(),
  operating_model: z
    .object({
      contracting: z.object({ en: z.array(z.string()), ar: z.array(z.string()) }),
      consulting: z.object({ en: z.array(z.string()), ar: z.array(z.string()) }),
    })
    .optional(),
  legal_entities: z
    .array(z.looseObject({ name: z.string(), jurisdiction: z.string(), detail: z.string(), status: z.string() }))
    .default([]),
  sources: z.array(z.string()).default([]),
});

export const HubSchema = z.looseObject({
  ...base,
  order: z.number().int(),
  name: L,
  country: L,
  lat: z.number(),
  lng: z.number(),
  role: L,
  source: z.string().optional(),
});

export const PersonSchema = z.looseObject({
  ...base,
  group: z.string(),
  rank: z.number().int(),
  name: L,
  title: L,
  bio: L,
  office_contact: z.string().email().optional(),
  portrait_url: z.string().optional(),
  source: z.string().optional(),
});

export const TimelineSchema = z.looseObject({
  ...base,
  year: z.string(),
  title: L,
  detail: L,
  source: z.string().optional(),
});

export const ContextFactSchema = z.looseObject({
  en: z.string(),
  ar: z.string(),
  status: z.string().optional(),
  voice_rule: z.string().optional(),
});

export const ImageSchema = z.looseObject({
  url: z.string().optional(),
  local: z.string(),
  alt: L.optional(),
});

export const ProjectKind = z.enum([
  'delivered_involvement',
  'consultancy',
  'concept',
  'studio_portfolio',
  'design_consultancy',
]);

export const ProjectSchema = z.looseObject({
  ...base,
  kind: ProjectKind,
  name: L,
  location: L,
  client_as_stated: z.string().optional(),
  services_as_stated: z.array(z.string()).optional(),
  role_as_stated: L,
  summary: L,
  context_facts: z.array(ContextFactSchema).default([]),
  voice_rules: z.array(z.string()).default([]),
  images: z.array(ImageSchema).default([]),
  disciplines: z.array(z.string()).default([]),
  hub: z.string().optional(),
  source: z.string().optional(),
});

export const DisciplineSchema = z.looseObject({
  ...base,
  order: z.number().int(),
  name: L,
  summary: L,
  voice_rules: z.array(z.string()).optional(),
  source: z.string().optional(),
});

export const FigureSchema = z.looseObject({
  ...base,
  value: z.string(),
  kind: z.enum(['year', 'count', 'money']),
  label: L,
  spoken: L,
  voice_rule: z.string().optional(),
  source: z.string().optional(),
});

export const PartnerSchema = z.looseObject({
  ...base,
  name: L,
  relationship: L,
  voice_rule: z.string().optional(),
  source: z.string().optional(),
});

export const ContactSchema = z.looseObject({
  status,
  approved: z.boolean(),
  email: z.string().email(),
  phone: z.string(),
  phone_spoken: L,
  website: z.string().url(),
  website_spoken: L,
  offices: z.object({ en: z.array(z.string()), ar: z.array(z.string()) }),
  voice_rule: z.string().optional(),
  source: z.string().optional(),
});

export const FaqSchema = z.looseObject({
  id: z.string(),
  q: L,
  use_records: z.array(z.string()),
});

export const DoNotSaySchema = z.looseObject({
  topic: z.string(),
  reason: z.string(),
});

export const SuggestedQuestionSchema = z.looseObject({
  en: z.string(),
  ar: z.string(),
  faq: z.string().optional(),
  record: z.string().optional(),
  action: z.string().optional(),
});

export const KnowledgeBaseSchema = z.looseObject({
  meta: z.looseObject({
    name: z.string(),
    version: z.string(),
    compiled: z.string(),
    status_legend: z.record(z.string(), z.string()),
    approval: z.string(),
    global_voice_rules: z.array(z.string()).min(1),
  }),
  company: CompanySchema,
  hubs: z.array(HubSchema).min(1),
  people: z.array(PersonSchema).min(1),
  timeline: z.array(TimelineSchema).min(1),
  projects: z.array(ProjectSchema).min(1),
  disciplines: z.array(DisciplineSchema).min(1),
  figures: z.array(FigureSchema).min(1),
  partners: z.array(PartnerSchema).default([]),
  contact: ContactSchema,
  faq: z.array(FaqSchema).default([]),
  do_not_say: z.array(DoNotSaySchema).default([]),
  suggested_questions: z.object({
    opening: z.array(SuggestedQuestionSchema),
    after_project: z.array(SuggestedQuestionSchema),
    after_hubs: z.array(SuggestedQuestionSchema),
    after_people: z.array(SuggestedQuestionSchema),
    after_timeline: z.array(SuggestedQuestionSchema),
  }),
  pronunciation: z.object({
    en: z.record(z.string(), z.string()),
    ar: z.record(z.string(), z.string()),
  }),
});

export type KnowledgeBase = z.infer<typeof KnowledgeBaseSchema>;
export type Hub = z.infer<typeof HubSchema>;
export type Person = z.infer<typeof PersonSchema>;
export type Milestone = z.infer<typeof TimelineSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Discipline = z.infer<typeof DisciplineSchema>;
export type Figure = z.infer<typeof FigureSchema>;
export type Partner = z.infer<typeof PartnerSchema>;
export type Contact = z.infer<typeof ContactSchema>;
