import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { GoogleGenAI, Modality } from '@google/genai';
import { z } from 'zod';
import { loadKnowledgeBase, kbSummary, type KnowledgeBase } from './kb/load';
import { buildCoreFacts } from './kb/coreFacts';
import { TOOL_DECLARATIONS } from './tools';

/* ------------------------------------------------------------------ */
/* Configuration — every knob in one place                             */
/* ------------------------------------------------------------------ */

export const LIVE_MODEL = process.env.LIVE_MODEL || 'gemini-3.1-flash-live-preview';
// Alternative: 'gemini-2.5-flash-native-audio-preview-12-2025'
export const ALLOWED_VOICES = ['Aoede', 'Kore', 'Leda', 'Sulafat', 'Despina'] as const;
export type VoiceName = (typeof ALLOWED_VOICES)[number];
export const DEFAULT_VOICE: VoiceName = 'Aoede';

export const COST = {
  tokenNewSessionSeconds: 60, // "1 min to start"
  tokenExpireMinutes: 15, // covers a 12 min session plus reconnects
  mintPerIpPer10Min: 6,
  mintPerIpPerDay: 60,
  dailySessionCap: Number(process.env.DAILY_SESSION_CAP || 500),
  enquiryPerIpPerHour: 3,
  nonceTtlMs: 10 * 60 * 1000,
  contextTriggerTokens: '24000',
  contextTargetTokens: '12000',
};

type Lang = 'en' | 'ar';

/* ------------------------------------------------------------------ */
/* Knowledge base + prompts (fail loudly at boot)                      */
/* ------------------------------------------------------------------ */

const kb: KnowledgeBase = loadKnowledgeBase();
console.log(`[kb] validated: ${kbSummary(kb)}${process.env.KB_APPROVED_ONLY === 'true' ? ' (approved only)' : ''}`);

const promptDir = path.join(process.cwd(), 'server', 'prompts');
const readPrompt = (f: string) => fs.readFileSync(path.join(promptDir, f), 'utf8').trim();

function buildSystemInstruction(lang: Lang): string {
  const sys = readPrompt(lang === 'ar' ? 'system-instruction-ar.txt' : 'system-instruction-en.txt');
  const brief = readPrompt(lang === 'ar' ? 'brief-ar.txt' : 'brief-en.txt');
  const tools = readPrompt(lang === 'ar' ? 'tools-protocol-ar.txt' : 'tools-protocol-en.txt');
  const hard = readPrompt(lang === 'ar' ? 'hard-questions-ar.txt' : 'hard-questions-en.txt');
  const bible = readPrompt(lang === 'ar' ? 'dialect-bible-ar.txt' : 'voice-bible-en.txt');
  const core = buildCoreFacts(kb, lang);
  const pron = kb.pronunciation[lang];
  const pronBlock =
    (lang === 'ar' ? 'دليل النطق:\n' : 'PRONUNCIATION GUIDE:\n') +
    Object.entries(pron)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join('\n');
  return [
    sys.replace(lang === 'ar' ? '{{COMPANY_BRIEF_AR}}' : '{{COMPANY_BRIEF_EN}}', brief),
    core,
    tools,
    hard,
    bible,
    pronBlock,
  ].join('\n\n');
}

const SYSTEM_INSTRUCTIONS: Record<Lang, string> = {
  en: buildSystemInstruction('en'),
  ar: buildSystemInstruction('ar'),
};

/* ------------------------------------------------------------------ */
/* Page nonce (signed, short-lived, issued with the HTML)              */
/* ------------------------------------------------------------------ */

const NONCE_SECRET = process.env.NONCE_SECRET || crypto.randomBytes(32).toString('hex');

export function mintNonce(): string {
  const ts = Date.now().toString(36);
  const rnd = crypto.randomBytes(8).toString('hex');
  const body = `${ts}.${rnd}`;
  const sig = crypto.createHmac('sha256', NONCE_SECRET).update(body).digest('base64url').slice(0, 24);
  return `${body}.${sig}`;
}

export function verifyNonce(nonce: unknown): boolean {
  if (typeof nonce !== 'string') return false;
  const parts = nonce.split('.');
  if (parts.length !== 3) return false;
  const [ts, rnd, sig] = parts;
  const expect = crypto.createHmac('sha256', NONCE_SECRET).update(`${ts}.${rnd}`).digest('base64url').slice(0, 24);
  if (expect.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(sig))) return false;
  const age = Date.now() - parseInt(ts, 36);
  return age >= 0 && age < COST.nonceTtlMs;
}

export function injectNonce(html: string): string {
  const tag = `<meta name="savannah-nonce" content="${mintNonce()}">`;
  return html.includes('</head>') ? html.replace('</head>', `${tag}\n</head>`) : tag + html;
}

/* ------------------------------------------------------------------ */
/* Rate limiting and spend guard (in memory; one instance)             */
/* ------------------------------------------------------------------ */

class Window {
  private hits = new Map<string, number[]>();
  constructor(private limit: number, private ms: number) {}
  take(key: string): boolean {
    const now = Date.now();
    const arr = (this.hits.get(key) || []).filter((t) => now - t < this.ms);
    if (arr.length >= this.limit) {
      this.hits.set(key, arr);
      return false;
    }
    arr.push(now);
    this.hits.set(key, arr);
    return true;
  }
}
const mint10 = new Window(COST.mintPerIpPer10Min, 10 * 60 * 1000);
const mintDay = new Window(COST.mintPerIpPerDay, 24 * 60 * 60 * 1000);
const enquiryHour = new Window(COST.enquiryPerIpPerHour, 60 * 60 * 1000);

let dailyKey = new Date().toISOString().slice(0, 10);
let dailyMinted = 0;
function countSession(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dailyKey) {
    dailyKey = today;
    dailyMinted = 0;
  }
  if (dailyMinted >= COST.dailySessionCap) return false;
  dailyMinted++;
  return true;
}

function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = Array.isArray(fwd) ? fwd[0] : (fwd || '').split(',')[0];
  return (first || req.socket.remoteAddress || 'unknown').trim();
}

/* ------------------------------------------------------------------ */
/* Analytics (privacy-preserving: no audio, no transcripts, no PII)    */
/* ------------------------------------------------------------------ */

const AnalyticsEvent = z.object({
  name: z.enum([
    'arrive', 'tap_start', 'lang_selected', 'mic_granted', 'mic_denied', 'first_audio_ms', 'turn',
    'interrupt', 'world_shown', 'chip_tapped', 'enquiry_started', 'enquiry_sent', 'session_end', 'error',
    'tool_call', 'topic',
  ]),
  lang: z.enum(['en', 'ar']).optional(),
  value: z.union([z.number(), z.string()]).optional(),
  world: z.string().optional(),
  id: z.string().optional(),
  duration: z.number().optional(),
  turns: z.number().optional(),
  code: z.string().optional(),
  ts: z.number().optional(),
});
type AnalyticsEvent = z.infer<typeof AnalyticsEvent>;

const analytics = {
  days: new Map<string, {
    sessions: number; lang: Record<string, number>; firstAudio: number[]; topics: Record<string, number>;
    worlds: Record<string, number>; enquiriesStarted: number; enquiriesSent: number; turns: number; errors: Record<string, number>;
  }>(),
};
function dayBucket() {
  const k = new Date().toISOString().slice(0, 10);
  let b = analytics.days.get(k);
  if (!b) {
    b = { sessions: 0, lang: {}, firstAudio: [], topics: {}, worlds: {}, enquiriesStarted: 0, enquiriesSent: 0, turns: 0, errors: {} };
    analytics.days.set(k, b);
  }
  return b;
}
function record(ev: AnalyticsEvent) {
  const b = dayBucket();
  switch (ev.name) {
    case 'lang_selected': b.lang[ev.lang || 'en'] = (b.lang[ev.lang || 'en'] || 0) + 1; break;
    case 'first_audio_ms': if (typeof ev.value === 'number') b.firstAudio.push(ev.value); break;
    case 'turn': b.turns++; break;
    case 'topic': if (ev.id) b.topics[ev.id] = (b.topics[ev.id] || 0) + 1; break;
    case 'world_shown': if (ev.world) b.worlds[ev.world] = (b.worlds[ev.world] || 0) + 1; break;
    case 'enquiry_started': b.enquiriesStarted++; break;
    case 'enquiry_sent': b.enquiriesSent++; break;
    case 'error': if (ev.code) b.errors[ev.code] = (b.errors[ev.code] || 0) + 1; break;
    default: break;
  }
}
const median = (a: number[]) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

/* ------------------------------------------------------------------ */
/* Enquiry delivery                                                    */
/* ------------------------------------------------------------------ */

const EnquirySchema = z.object({
  name: z.string().trim().min(1).max(120),
  organisation: z.string().trim().max(160).optional().default(''),
  country: z.string().trim().max(80).optional().default(''),
  topic: z.string().trim().min(1).max(1200),
  email: z.string().trim().email().max(200).optional().or(z.literal('')),
  phone: z.string().trim().max(40).regex(/^[+\d\s()-]*$/).optional().or(z.literal('')),
  language: z.enum(['en', 'ar']),
  transcript: z.array(z.object({ role: z.enum(['user', 'model']), text: z.string().max(1500) })).max(6).default([]),
  nonce: z.string(),
}).refine((e) => (e.email && e.email.length > 0) || (e.phone && e.phone.length > 0), {
  message: 'email or phone required',
});

async function deliverEnquiry(e: z.infer<typeof EnquirySchema>): Promise<{ ok: boolean; reason?: string }> {
  const to = process.env.ENQUIRY_TO;
  const resend = process.env.RESEND_API_KEY;
  if (!to || !resend) return { ok: false, reason: 'NOT_CONFIGURED' };
  const from = process.env.ENQUIRY_FROM || 'Savannah <savannah@7dint.net>';
  const lines = [
    `Collected by Savannah (voice enquiry), ${new Date().toISOString()}`,
    `Language: ${e.language}`,
    '',
    `Name: ${e.name}`,
    `Organisation: ${e.organisation || '—'}`,
    `Country: ${e.country || '—'}`,
    `Email: ${e.email || '—'}`,
    `Phone: ${e.phone || '—'}`,
    '',
    'About:',
    e.topic,
    '',
    'Transcript excerpt (enquiry part only):',
    ...e.transcript.map((t) => `${t.role === 'user' ? 'Visitor' : 'Savannah'}: ${t.text}`),
  ];
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resend}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: e.email || undefined,
      subject: `Savannah enquiry: ${e.name}${e.organisation ? ` (${e.organisation})` : ''}`,
      text: lines.join('\n'),
    }),
  });
  if (!res.ok) return { ok: false, reason: `PROVIDER_${res.status}` };
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

export async function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) console.warn('[live] GEMINI_API_KEY is not set: sessions cannot start.');
  const ai = apiKey ? new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } }) : null;

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', model: LIVE_MODEL, kb: kbSummary(kb) });
  });

  // Knowledge base for the browser — already validated and approval-filtered.
  app.get('/api/kb', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(kb);
  });

  // Ephemeral token: model, instruction, voice, tools locked in.
  app.post('/api/live-token', async (req: Request, res: Response) => {
    const ip = clientIp(req);
    if (!verifyNonce(req.body?.nonce)) return res.status(403).json({ error: 'BAD_NONCE' });
    if (!mint10.take(ip) || !mintDay.take(ip)) return res.status(429).json({ error: 'RATE_LIMITED' });
    if (!ai) return res.status(500).json({ error: 'NOT_CONFIGURED' });

    const lang: Lang = req.body?.lang === 'ar' ? 'ar' : 'en';
    const voice: VoiceName = ALLOWED_VOICES.includes(req.body?.voice) ? req.body.voice : DEFAULT_VOICE;
    const resuming = req.body?.resuming === true;
    if (!resuming && !countSession()) return res.status(503).json({ error: 'RESTING' });

    try {
      const now = Date.now();
      const token = await ai.authTokens.create({
        config: {
          uses: 1,
          expireTime: new Date(now + COST.tokenExpireMinutes * 60 * 1000).toISOString(),
          newSessionExpireTime: new Date(now + COST.tokenNewSessionSeconds * 1000).toISOString(),
          liveConnectConstraints: {
            model: LIVE_MODEL,
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
              systemInstruction: SYSTEM_INSTRUCTIONS[lang],
              tools: [{ functionDeclarations: TOOL_DECLARATIONS as any }],
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              contextWindowCompression: {
                triggerTokens: COST.contextTriggerTokens,
                slidingWindow: { targetTokens: COST.contextTargetTokens },
              },
            },
          },
          lockAdditionalFields: ['temperature', 'topP', 'topK', 'maxOutputTokens'],
        },
      });
      if (!token?.name) throw new Error('empty token');
      if (!resuming) record({ name: 'lang_selected', lang });
      dayBucket().sessions += resuming ? 0 : 1;
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ token: token.name, model: LIVE_MODEL, voice, lang, expireTime: token.expireTime });
    } catch (err: any) {
      console.error('[live] token mint failed:', err?.message || err);
      return res.status(502).json({ error: 'MINT_FAILED' });
    }
  });

  app.post('/api/analytics', (req, res) => {
    const parsed = AnalyticsEvent.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false });
    record(parsed.data);
    res.json({ ok: true });
  });

  app.get('/api/admin/summary', (req, res) => {
    const key = process.env.ADMIN_KEY;
    if (!key || req.query.key !== key) return res.status(401).json({ error: 'UNAUTHORIZED' });
    const out: Record<string, unknown> = {};
    for (const [day, b] of analytics.days) {
      out[day] = {
        sessions: b.sessions,
        languageSplit: b.lang,
        medianFirstAudioMs: median(b.firstAudio),
        turns: b.turns,
        topTopics: Object.entries(b.topics).sort((a, c) => c[1] - a[1]).slice(0, 15),
        topWorlds: Object.entries(b.worlds).sort((a, c) => c[1] - a[1]),
        enquiryConversion: b.sessions ? b.enquiriesSent / b.sessions : 0,
        enquiriesStarted: b.enquiriesStarted,
        enquiriesSent: b.enquiriesSent,
        errors: b.errors,
      };
    }
    res.json({ dailySessionCap: COST.dailySessionCap, days: out });
  });

  app.post('/api/enquiry', async (req, res) => {
    const ip = clientIp(req);
    const parsed = EnquirySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: 'INVALID', issues: parsed.error.issues.map((i) => i.path.join('.')) });
    if (!verifyNonce(parsed.data.nonce)) return res.status(403).json({ ok: false, error: 'BAD_NONCE' });
    if (!enquiryHour.take(ip)) return res.status(429).json({ ok: false, error: 'RATE_LIMITED' });
    if (!process.env.ENQUIRY_TO || !process.env.RESEND_API_KEY) {
      return res.status(503).json({ ok: false, error: 'NOT_CONFIGURED', contact: { email: kb.contact.email, phone: kb.contact.phone } });
    }
    try {
      const r = await deliverEnquiry(parsed.data);
      if (!r.ok) return res.status(502).json({ ok: false, error: r.reason, contact: { email: kb.contact.email, phone: kb.contact.phone } });
      record({ name: 'enquiry_sent' });
      return res.json({ ok: true });
    } catch (e: any) {
      console.error('[enquiry] delivery failed:', e?.message || e);
      return res.status(502).json({ ok: false, error: 'DELIVERY_FAILED', contact: { email: kb.contact.email, phone: kb.contact.phone } });
    }
  });

  app.get('/privacy', (_req, res) => {
    res.type('html').send(PRIVACY_HTML);
  });

  app.use('/api', (_req: Request, res: Response) => res.status(404).json({ error: 'NOT_FOUND' }));
  app.use('/api', (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[api]', err.message);
    res.status(500).json({ error: 'SERVER_ERROR' });
  });

  return app;
}

const PRIVACY_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Savannah · Privacy</title>
<style>body{margin:0;background:#050608;color:#F4F1EA;font:16px/1.7 'IBM Plex Sans',system-ui,sans-serif;padding:48px 24px;max-width:680px;margin-inline:auto}h1{font:400 20px 'Michroma',sans-serif;letter-spacing:.2em;color:#E0A94A}h2{font-size:16px;margin-top:32px;color:#C8AA7C}p{color:#D9D5CC}a{color:#E0A94A}[dir=rtl]{font-family:'IBM Plex Sans Arabic',system-ui,sans-serif}</style></head>
<body><h1>SAVANNAH</h1><h2>Privacy</h2>
<p>Savannah is 7D International's voice host. When you talk with her, your voice is streamed live to Google's Gemini API to understand you and to answer. 7D International does not record your voice and does not store your conversation.</p>
<p>The only thing kept is an enquiry you choose to send by tapping "Send to 7D": the details on the card and a short excerpt of that part of the conversation, delivered to 7D's team by email.</p>
<p>We keep aggregate counts only: sessions per day, language, response latency, which topics and screens were shown, and error codes. No audio, no transcripts, no names.</p>
<p>Questions: <a href="mailto:info@7dint.net">info@7dint.net</a>.</p>
<div dir="rtl"><h2>الخصوصية</h2>
<p>سافانا هي المضيفة الصوتية لسفن دي إنترناشونال. لما تتكلم معها، صوتك يُرسل مباشرة لخدمة Gemini من Google عشان تفهمك وترد عليك. سفن دي إنترناشونال ما تسجل صوتك ولا تحتفظ بالمحادثة.</p>
<p>الشي الوحيد اللي ينحفظ هو الاستفسار اللي تختار ترسله بالضغط على "أرسل لسفن دي": تفاصيل البطاقة ومقتطف قصير من ذاك الجزء من المحادثة، ويوصل لفريق سفن دي بالإيميل.</p>
<p>نحتفظ بأرقام إجمالية فقط: عدد الجلسات في اليوم، اللغة، سرعة الرد، المواضيع والشاشات اللي انعرضت، ورموز الأخطاء. بدون صوت ولا نصوص ولا أسماء.</p></div>
</body></html>`;
