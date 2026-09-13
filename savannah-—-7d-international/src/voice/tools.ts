import { bus } from '../state/bus';
import {
  fetchKnowledgeBase,
  getRecordById,
  searchKB,
  localize,
  KnowledgeBaseData,
} from '../kb/client';
import { storyController, StoryChapter } from '../story/story';

export const TOOL_DECLARATIONS = [
  {
    name: 'lookup_7d',
    description:
      'Query the verified 7D International knowledge base by keyword, name, project, milestone, or topic. ALWAYS call this tool before speaking about any facts beyond the CORE FACTS.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description:
            'Keyword, project name, person, milestone, figure, or question topic to look up in the verified KB.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'show_project',
    description:
      'Show an official fact card for a 7D project on the visual stage. Call this FIRST before answering when speaking about a project.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: {
          type: 'STRING',
          description:
            'Project ID: king-abdullah-park-fountain, king-abdullah-international-gardens, riyadh-eye, riyadh-2020, 7d-world, telecom-infrastructure-network, or atelier-simona-portfolio',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'show_hubs',
    description:
      "Display 7D International's 5 global strategic hubs (Riyadh, Florida, Ostrava, Seoul, Sydney). Call this when discussing global reach, headquarters, or locations.",
    parameters: {
      type: 'OBJECT',
      properties: {
        focus: {
          type: 'STRING',
          description:
            'Hub ID to highlight: riyadh, florida, ostrava, seoul, or sydney',
        },
      },
    },
  },
  {
    name: 'show_timeline',
    description:
      "Display the chronological milestones timeline of 7D International from 1993 to present. Call when discussing 7D's history or growth.",
    parameters: {
      type: 'OBJECT',
      properties: {
        focus_year: {
          type: 'STRING',
          description: 'Year or milestone ID to highlight (e.g. 1993, 2009, 2025)',
        },
      },
    },
  },
  {
    name: 'show_person',
    description:
      'Display a leadership fact card for a key person at 7D (Roman Kuba, Dr. Wael El-Mougy, Reza Rezaie, Evan Shim, Marian Tkacik, Erfan, Frye).',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: {
          type: 'STRING',
          description:
            'Person ID: roman-kuba, wael-el-mougy, reza-rezaie, evan-shim, marian-tkacik, erfan, or frye',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'show_discipline',
    description:
      "Display one of 7D International's 7 core multidisciplinary capabilities.",
    parameters: {
      type: 'OBJECT',
      properties: {
        id: {
          type: 'STRING',
          description:
            'Discipline ID: architecture-master-planning, engineering-structural-design, water-multimedia-features, telecom-digital-infrastructure, environmental-botanical-landmarks, project-construction-management, or strategic-investment-consortiums',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'show_figure',
    description:
      'Highlight a verified scale metric or milestone figure on the visual stage (1993, $80M, 1,500+ base stations, 5 hubs, 7 disciplines).',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: {
          type: 'STRING',
          description:
            'Figure ID: fig-1993, fig-80m, fig-1500-base-stations, fig-5-hubs, or fig-7-disciplines',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'show_contact',
    description:
      'Display the official 7D contact card with email addresses and headquarters info.',
    parameters: {
      type: 'OBJECT',
      properties: {
        channel: {
          type: 'STRING',
          description: 'Optional channel: general, chairman, or all',
        },
      },
    },
  },
  {
    name: 'suggest_questions',
    description:
      'Display 2 to 3 contextual follow-up question chips on the visual stage for the visitor to click or ask next. Each under 6 words in session language.',
    parameters: {
      type: 'OBJECT',
      properties: {
        questions: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description:
            'Array of 2-3 short questions (under 6 words each) in the session language',
        },
      },
      required: ['questions'],
    },
  },
  {
    name: 'return_to_presence',
    description:
      "Return the visual stage to Savannah's full core presence sphere when finished presenting a specific project or world.",
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'story',
    description:
      'Control the guided 7-chapter Story mode journey of 7D International.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: {
          type: 'STRING',
          description:
            'Action to execute: start, next, previous, pause, resume, stop, or jump',
        },
        chapter: {
          type: 'INTEGER',
          description:
            'Target chapter number (1 through 7) when action is jump',
        },
      },
      required: ['action'],
    },
  },
];

export async function executeToolCall(
  name: string,
  args: Record<string, any>,
  lang: 'en' | 'ar'
): Promise<any> {
  const kb = await fetchKnowledgeBase();
  const isAr = lang === 'ar';

  switch (name) {
    case 'lookup_7d': {
      const query = args.query || '';
      const result = searchKB(kb, query);

      if (result.status === 'DO_NOT_SAY') {
        return {
          status: 'DO_NOT_SAY',
          topic: result.topic,
          reason: result.reason,
          instruction: isAr ? result.response_ar : result.response_en,
        };
      }

      if (result.status === 'NOT_IN_KB') {
        return {
          status: 'NOT_IN_KB',
          message:
            'Detail not found in verified 7D Knowledge Base. State that you do not have that detail with you right now, and offer official contact via info@7dint.net.',
        };
      }

      const rec = result.record;
      const localized = localize(rec, lang);
      return {
        status: 'FOUND',
        id: rec.id,
        kind: result.kind,
        name: localized.displayName,
        summary: localized.displaySummary,
        role_as_stated: localized.displayRoleAsStated || localized.displayRole,
        voice_rules: rec.voice_rules || [],
        facts: rec.context_facts || [],
      };
    }

    case 'show_project': {
      const id = args.id;
      const found = getRecordById(kb, id);
      const project = found?.record || kb.projects[0];
      const localized = localize(project, lang);

      // Trigger 3D Project World
      bus.emit('show_world', {
        world: 'project',
        params: { record: project },
      });

      bus.emit('show_fact_card', {
        type: 'project',
        data: project,
        lang,
      });

      // Update contextual chips
      const chips = kb.suggested_questions?.after_project?.[lang] || [
        isAr ? 'احكي لي عن الحدائق' : 'Tell me about the gardens',
        isAr ? 'مين كان شريككم؟' : 'Who was your partner?',
      ];
      bus.emit('suggest_questions', chips);

      return {
        success: true,
        project: localized.displayName,
        role_as_stated: localized.displayRoleAsStated,
        voice_rules: project.voice_rules || [],
        context_facts: project.context_facts || [],
      };
    }

    case 'show_hubs': {
      const focus = (args.focus || 'riyadh').toLowerCase();

      // Trigger 3D Globe World
      bus.emit('show_world', {
        world: 'globe',
        params: { focus },
      });

      bus.emit('show_fact_card', {
        type: 'hubs',
        data: { hubs: kb.hubs, focus },
        lang,
      });

      const chips = kb.suggested_questions?.after_hubs?.[lang] || [
        isAr ? 'ليش الرياض؟' : 'Why Riyadh?',
        isAr ? 'احكي لي عن المؤسسين' : 'Tell me about the founders',
      ];
      bus.emit('suggest_questions', chips);

      return {
        success: true,
        hubs_count: kb.hubs.length,
        focus,
        hubs: kb.hubs.map((h) => ({
          id: h.id,
          city: isAr ? h.city_ar : h.city,
          country: isAr ? h.country_ar : h.country,
          role: isAr ? h.role_ar : h.role,
        })),
      };
    }

    case 'show_timeline': {
      const focusYear = args.focus_year;

      // Trigger 3D Timeline World
      bus.emit('show_world', {
        world: 'timeline',
        params: { records: kb.timeline, focus_year: focusYear },
      });

      bus.emit('show_fact_card', {
        type: 'timeline',
        data: { timeline: kb.timeline, focus_year: focusYear },
        lang,
      });

      return {
        success: true,
        milestones: kb.timeline.map((t) => ({
          year: t.year,
          title: isAr ? t.title_ar : t.title_en,
          summary: isAr ? t.summary_ar : t.summary_en,
        })),
      };
    }

    case 'show_person': {
      const id = args.id;
      const found = getRecordById(kb, id);
      const person = found?.record || kb.people[0];
      const localized = localize(person, lang);

      // Trigger 3D People World
      bus.emit('show_world', {
        world: 'people',
        params: { people: kb.people, id: person.id },
      });

      bus.emit('show_fact_card', {
        type: 'person',
        data: person,
        lang,
      });

      const chips = kb.suggested_questions?.after_person?.[lang] || [
        isAr ? 'مين غيره يقود سفن دي؟' : 'Who else leads 7D?',
        isAr ? 'وش هو أتيليه سيمونا؟' : "What's Atelier Simona?",
      ];
      bus.emit('suggest_questions', chips);

      return {
        success: true,
        name: localized.displayName,
        title: localized.displayTitle,
        bio: localized.displayBio,
        email: person.email,
      };
    }

    case 'show_discipline': {
      const id = args.id;
      const found = getRecordById(kb, id);
      const disc = found?.record || kb.disciplines[0];
      const localized = localize(disc, lang);

      // Trigger 3D Disciplines World
      bus.emit('show_world', {
        world: 'disciplines',
        params: { disciplines: kb.disciplines, id: disc.id },
      });

      bus.emit('show_fact_card', {
        type: 'discipline',
        data: disc,
        lang,
      });

      const chips = kb.suggested_questions?.after_disciplines?.[lang] || [
        isAr ? 'وريني مشروع مائي' : 'Show me a water project',
        isAr ? 'كيف تبنون شراكاتكم؟' : 'How do you partner?',
      ];
      bus.emit('suggest_questions', chips);

      return {
        success: true,
        name: localized.displayName,
        summary: localized.displaySummary,
        related_projects: disc.related_projects,
      };
    }

    case 'show_figure': {
      const id = args.id;
      const found = getRecordById(kb, id);
      const fig = found?.record || kb.figures[0];
      const localized = localize(fig, lang);

      // Trigger 3D Figure World
      bus.emit('show_world', {
        world: 'figure',
        params: { fig },
      });

      bus.emit('show_fact_card', {
        type: 'figure',
        data: fig,
        lang,
      });

      const chips = kb.suggested_questions?.after_figure?.[lang] || [
        isAr ? 'احكي لي عن مشروع الـ 80 مليون' : 'Tell me about the $80M project',
        isAr ? 'وش مراكزكم حول العالم؟' : 'What hubs do you have?',
      ];
      bus.emit('suggest_questions', chips);

      return {
        success: true,
        value: fig.value,
        spoken: isAr ? fig.spoken_ar : fig.spoken_en,
        label: localized.displayLabel,
        detail: localized.displayDetail,
      };
    }

    case 'show_contact': {
      // Trigger 3D Contact World
      bus.emit('show_world', {
        world: 'contact',
        params: { contact: kb.contact },
      });

      bus.emit('show_fact_card', {
        type: 'contact',
        data: kb.contact,
        lang,
      });

      const chips = kb.suggested_questions?.after_contact?.[lang] || [
        isAr ? 'احكي لي عن رومان كوبا' : 'Tell me about Roman Kuba',
        isAr ? 'وش مشاريعكم بالرياض؟' : 'What projects are in Riyadh?',
      ];
      bus.emit('suggest_questions', chips);

      return {
        success: true,
        general_email: kb.contact.general_email,
        chairman_email: kb.contact.chairman_email,
        website: kb.contact.website,
        riyadh_office: isAr ? kb.contact.riyadh_office_ar : kb.contact.riyadh_office,
        florida_office: isAr ? kb.contact.florida_office_ar : kb.contact.florida_office,
      };
    }

    case 'return_to_presence': {
      bus.emit('show_world', { world: 'presence' });
      bus.emit('show_fact_card', null);
      return { success: true, world: 'presence' };
    }

    case 'suggest_questions': {
      const questions = Array.isArray(args.questions) ? args.questions.slice(0, 3) : [];
      if (questions.length > 0) {
        bus.emit('suggest_questions', questions);
      }
      return { success: true, count: questions.length };
    }

    case 'story': {
      const action = (args.action || 'start').toLowerCase();
      let chapter: StoryChapter | null = null;

      if (action === 'start') {
        chapter = storyController.start();
      } else if (action === 'next') {
        chapter = storyController.next();
      } else if (action === 'previous') {
        chapter = storyController.previous();
      } else if (action === 'pause') {
        storyController.pause();
        return { status: 'paused' };
      } else if (action === 'resume') {
        chapter = storyController.resume();
      } else if (action === 'stop') {
        storyController.stop();
        return { status: 'stopped' };
      } else if (action === 'jump') {
        chapter = storyController.jump(args.chapter || 1);
      }

      if (!chapter) {
        return {
          status: 'completed',
          message: isAr
            ? 'اكتملت القصة! يمكنك الآن طرح أي أسئلة عن مشاريعنا أو مراكزنا.'
            : "That concludes 7D's guided story! Feel free to ask about any project or hub in detail.",
        };
      }

      // Automatically trigger the corresponding visual show tool for this chapter!
      await executeToolCall(chapter.toolToCall.name, chapter.toolToCall.args, lang);

      // Suggest next questions for the chapter
      const nextChips = isAr ? chapter.suggestedNext.ar : chapter.suggestedNext.en;
      bus.emit('suggest_questions', nextChips);

      return {
        status: 'playing',
        chapterNumber: chapter.number,
        totalChapters: 7,
        title: isAr ? chapter.title_ar : chapter.title_en,
        subtitle: isAr ? chapter.subtitle_ar : chapter.subtitle_en,
        narration: isAr ? chapter.script_ar : chapter.script_en,
        instruction:
          'Speak the narration text provided in a warm, unhurried rhythm. When finished, you may ask if the visitor would like to continue to the next chapter.',
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
