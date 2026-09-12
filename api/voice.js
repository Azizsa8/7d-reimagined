/* Server-side text-to-speech proxy.
 *
 * The scripted tour is pre-rendered to static MP3s and does not use this endpoint.
 * This exists for the conversational side of the assistant, where the sentence is
 * not known in advance.
 *
 * The ElevenLabs key lives in the ELEVENLABS_API_KEY environment variable on the
 * host and never reaches the browser. A key embedded in client JavaScript on a
 * public site can be read by any visitor and spent by anyone who finds it, so this
 * indirection is not optional.
 *
 * Set it once:  vercel env add ELEVENLABS_API_KEY
 */

const VOICES = {
  ar: process.env.VOICE_AR || 'ckaeRWMtCV0u0pUT3wX1',   // Noorah — Saudi female (needs a paid plan)
  en: process.env.VOICE_EN || 'EXAVITQu4vr4xnSDxMaL'    // Sarah — mature, reassuring
};
const MAX_CHARS = 400;                                   // one answer, not an audiobook
const WINDOW_MS = 60_000, MAX_PER_WINDOW = 20;
const hits = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({error: 'POST only'}); return; }
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) { res.status(503).json({error: 'voice_not_configured'}); return; }

  // a coarse per-IP throttle: this endpoint spends real money
  const ip = (req.headers['x-forwarded-for'] || 'local').split(',')[0].trim();
  const now = Date.now();
  const bucket = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (bucket.length >= MAX_PER_WINDOW) { res.status(429).json({error: 'rate_limited'}); return; }
  bucket.push(now); hits.set(ip, bucket);

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const text = String(body?.text || '').slice(0, MAX_CHARS).trim();
  const lang = body?.lang === 'ar' ? 'ar' : 'en';
  if (!text) { res.status(400).json({error: 'no_text'}); return; }

  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICES[lang]}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: {'xi-api-key': key, 'content-type': 'application/json'},
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {stability: .45, similarity_boost: .8, style: .15, use_speaker_boost: true}
      })
    });
    if (!r.ok) { res.status(502).json({error: 'tts_failed', status: r.status}); return; }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).send(buf);
  } catch {
    res.status(502).json({error: 'tts_unreachable'});
  }
}
