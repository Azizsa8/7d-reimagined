import fs from 'fs';
import path from 'path';
import { KnowledgeBaseSchema, type KnowledgeBase } from './schema';

export { KnowledgeBaseSchema };
export type { KnowledgeBase };

let cached: KnowledgeBase | null = null;

export function kbPath(): string {
  return path.join(process.cwd(), 'public', 'kb', 'savannah-knowledge-base.json');
}

/**
 * Loads and validates the knowledge base. Throws with a readable message on any
 * schema error; server/index.ts lets that throw stop the process at boot.
 * With KB_APPROVED_ONLY=true, records with approved:false are dropped.
 */
export function loadKnowledgeBase(opts?: { approvedOnly?: boolean; force?: boolean }): KnowledgeBase {
  const approvedOnly = opts?.approvedOnly ?? process.env.KB_APPROVED_ONLY === 'true';
  if (cached && !opts?.force) return cached;

  const file = kbPath();
  if (!fs.existsSync(file)) throw new Error(`Knowledge base not found at ${file}`);

  let json: unknown;
  try {
    json = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e: any) {
    throw new Error(`Knowledge base is not valid JSON: ${e.message}`);
  }

  const result = KnowledgeBaseSchema.safeParse(json);
  if (!result.success) {
    const lines = result.error.issues
      .slice(0, 12)
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Knowledge base failed schema validation:\n${lines}`);
  }

  let kb = result.data;
  if (approvedOnly) {
    const keep = <T extends { approved: boolean }>(a: T[]) => a.filter((r) => r.approved);
    kb = {
      ...kb,
      hubs: keep(kb.hubs),
      people: keep(kb.people),
      timeline: keep(kb.timeline),
      projects: keep(kb.projects),
      disciplines: keep(kb.disciplines),
      figures: keep(kb.figures),
      partners: keep(kb.partners),
    };
  }
  cached = kb;
  return kb;
}

export function kbSummary(kb: KnowledgeBase): string {
  return `${kb.projects.length} projects, ${kb.hubs.length} hubs, ${kb.people.length} people, ${kb.timeline.length} milestones, ${kb.disciplines.length} disciplines, ${kb.figures.length} figures`;
}
