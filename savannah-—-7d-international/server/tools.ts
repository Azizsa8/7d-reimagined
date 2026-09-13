/**
 * Live API function declarations. Locked into the ephemeral token, so the browser
 * never has to (and cannot) change them. Names and shapes follow Phase 2 §3.1 and
 * Phase 4 §2.2 exactly; the client executes them by name in src/voice/tools.ts.
 */
export const TOOL_DECLARATIONS = [
  {
    name: 'lookup_7d',
    description:
      'Look up verified facts about 7D International before answering anything beyond the core facts. Returns the exact wording and voice rules to follow.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: "What the visitor asked, in their words" },
        ids: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Record ids if already known' },
      },
      required: ['query'],
    },
  },
  {
    name: 'show_project',
    description: 'Show a 7D project on screen. Call before talking about it.',
    parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' } }, required: ['id'] },
  },
  {
    name: 'show_hubs',
    description: 'Show the world map of 7D hubs, optionally focused on one.',
    parameters: { type: 'OBJECT', properties: { focus: { type: 'STRING' } } },
  },
  {
    name: 'show_timeline',
    description: 'Show 7D history, optionally focused on a milestone id.',
    parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' } } },
  },
  {
    name: 'show_person',
    description: 'Show one leader.',
    parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' } }, required: ['id'] },
  },
  { name: 'show_people', description: 'Show the leadership team.', parameters: { type: 'OBJECT', properties: {} } },
  {
    name: 'show_disciplines',
    description: 'Show the seven disciplines, optionally focused on one.',
    parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' } } },
  },
  {
    name: 'show_figure',
    description: 'Show a headline number.',
    parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' } }, required: ['id'] },
  },
  { name: 'show_contact', description: 'Show official contact channels.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'return_to_presence', description: 'Clear the stage back to Savannah.', parameters: { type: 'OBJECT', properties: {} } },
  {
    name: 'suggest_questions',
    description: 'Offer up to 3 short follow-up questions as on-screen chips, in the session language.',
    parameters: {
      type: 'OBJECT',
      properties: { items: { type: 'ARRAY', items: { type: 'STRING' } } },
      required: ['items'],
    },
  },
  {
    name: 'story',
    description: 'Control Story mode.',
    parameters: {
      type: 'OBJECT',
      properties: { action: { type: 'STRING', enum: ['start', 'next', 'resume', 'stop'] } },
      required: ['action'],
    },
  },
  {
    name: 'capture_enquiry',
    description:
      'Fill the on-screen enquiry card with what the visitor has said so far. Call after each answer while collecting an enquiry. The visitor sends it; you never do.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING' },
        organisation: { type: 'STRING' },
        country: { type: 'STRING' },
        topic: { type: 'STRING' },
        email: { type: 'STRING' },
        phone: { type: 'STRING' },
        language: { type: 'STRING', enum: ['en', 'ar'] },
      },
      required: ['language'],
    },
  },
] as const;

export type ToolName = (typeof TOOL_DECLARATIONS)[number]['name'];
