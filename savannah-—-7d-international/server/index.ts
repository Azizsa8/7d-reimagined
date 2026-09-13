import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI, Modality } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { loadKnowledgeBase } from './kb/load';
import { getCoreFacts } from './kb/coreFacts';

dotenv.config();

export const LIVE_MODEL = 'gemini-3.1-flash-live-preview';
export const ALLOWED_VOICES = ['Aoede', 'Kore', 'Leda', 'Sulafat', 'Despina'] as const;
export type VoiceName = typeof ALLOWED_VOICES[number];

// Validate 7D Knowledge Base on server boot (fails loudly on schema violations)
try {
  loadKnowledgeBase();
} catch (err: any) {
  console.error('CRITICAL: 7D Knowledge Base failed schema validation:', err);
}

// Tool declarations for 7D International
const SERVER_TOOL_DECLARATIONS = [
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
          description: 'Hub ID to highlight: riyadh, florida, ostrava, seoul, or sydney',
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
          description: 'Array of 2-3 short questions (under 6 words each) in the session language',
        },
      },
      required: ['questions'],
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
          description: 'Action to execute: start, next, previous, pause, resume, stop, or jump',
        },
        chapter: {
          type: 'INTEGER',
          description: 'Target chapter number (1 through 7) when action is jump',
        },
      },
      required: ['action'],
    },
  },
];

// Initialize GoogleGenAI SDK with server-side API key
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('⚠️ GEMINI_API_KEY is not set in environment.');
}

const ai = new GoogleGenAI({
  apiKey: apiKey || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
    apiVersion: 'v1alpha',
  },
});

// Load and compile system instructions
function loadPrompt(lang: 'en' | 'ar'): string {
  const promptDir = path.join(process.cwd(), 'server', 'prompts');

  const briefFile = lang === 'ar' ? 'brief-ar.txt' : 'brief-en.txt';
  const sysFile = lang === 'ar' ? 'system-instruction-ar.txt' : 'system-instruction-en.txt';
  const toolsFile = lang === 'ar' ? 'tools-protocol-ar.txt' : 'tools-protocol-en.txt';
  const bibleFile = lang === 'ar' ? 'dialect-bible-ar.txt' : 'voice-bible-en.txt';

  const brief = fs.readFileSync(path.join(promptDir, briefFile), 'utf-8').trim();
  const sysTemplate = fs.readFileSync(path.join(promptDir, sysFile), 'utf-8');
  const toolsProtocol = fs.readFileSync(path.join(promptDir, toolsFile), 'utf-8').trim();
  const voiceBible = fs.readFileSync(path.join(promptDir, bibleFile), 'utf-8').trim();
  const coreFacts = getCoreFacts(lang);

  let prompt =
    lang === 'ar'
      ? sysTemplate.replace('{{COMPANY_BRIEF_AR}}', brief)
      : sysTemplate.replace('{{COMPANY_BRIEF_EN}}', brief);

  prompt += `\n\n${coreFacts}\n\n${toolsProtocol}\n\n${voiceBible}`;
  return prompt;
}

export async function createApp() {
  const app = express();
  app.use(express.json());

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'Savannah Voice Host',
      hasKey: !!process.env.GEMINI_API_KEY,
      model: LIVE_MODEL,
    });
  });

  // Ephemeral token endpoint for Gemini Live API
  app.post('/api/live-token', async (req: Request, res: Response) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({
          error: 'GEMINI_API_KEY is not configured on the server.',
        });
      }

      const lang: 'en' | 'ar' = req.body.lang === 'ar' ? 'ar' : 'en';
      let voice: VoiceName = 'Aoede';
      if (req.body.voice && ALLOWED_VOICES.includes(req.body.voice)) {
        voice = req.body.voice;
      }

      const systemInstruction = loadPrompt(lang);

      // Create ephemeral auth token locking in model, voice, system prompt, and tools
      const tokenResponse = await ai.authTokens.create({
        config: {
          uses: 10,
          liveConnectConstraints: {
            model: LIVE_MODEL,
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: voice,
                  },
                },
              },
              systemInstruction: systemInstruction,
              outputAudioTranscription: {},
              inputAudioTranscription: {},
              tools: [
                {
                  functionDeclarations: SERVER_TOOL_DECLARATIONS as any,
                },
              ],
            },
          },
        },
      });

      if (!tokenResponse || !tokenResponse.name) {
        throw new Error('Failed to obtain ephemeral token from Gemini API.');
      }

      return res.json({
        token: tokenResponse.name,
        model: LIVE_MODEL,
        voice,
        lang,
        expireTime: tokenResponse.expireTime,
      });
    } catch (err: any) {
      console.error('Error minting Live ephemeral token:', err);
      return res.status(500).json({
        error: err.message || 'Failed to mint Live token',
      });
    }
  });

  return app;
}
