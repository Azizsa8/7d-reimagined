/* Pre-render the guided tour narration to static MP3s.
 *
 * Why pre-render instead of calling ElevenLabs from the browser:
 *   - the API key never reaches the client, so it cannot be scraped off a public site
 *   - narration is scripted, so it costs characters once at build time, not once per visitor
 *   - no network round trip mid-sentence, which matters when the site is being demoed live
 *
 * Usage (PowerShell):
 *   $env:ELEVENLABS_API_KEY="..."; node tools/build-voice.mjs
 * Optional: --lang ar   --force   --voice-ar <id>   --voice-en <id>
 */
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) { console.error('Set ELEVENLABS_API_KEY in the environment. It is never read from a file in this repo.'); process.exit(1); }

const args = process.argv.slice(2);
const flag = n => { const i = args.indexOf(n); return i === -1 ? null : (args[i+1] ?? true); };
const only  = flag('--lang');
const force = args.includes('--force');

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const tour = JSON.parse(await readFile(path.join(root, 'data/tour.json'), 'utf8'));
const langs = (only ? [only] : ['en', 'ar']);

const voiceFor = l => flag(`--voice-${l}`) || tour.persona.voice[l].id;

async function tts(text, voiceId) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: {'xi-api-key': KEY, 'content-type': 'application/json'},
    body: JSON.stringify({
      text,
      model_id: tour.persona.model,
      voice_settings: {stability: 0.45, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true}
    })
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(()=> '')}`.slice(0, 300));
  return Buffer.from(await res.arrayBuffer());
}

const manifest = {generated: new Date().toISOString(), voices: {}, lines: {}};
let chars = 0, wrote = 0, skipped = 0;

for (const lang of langs) {
  let voiceId = voiceFor(lang);
  const dir = path.join(root, 'audio', lang);
  await mkdir(dir, {recursive: true});
  const lines = [
    ...tour.chapters.map(c => ({id: c.id, text: c[lang]})),
    ...Object.entries(tour.ui).map(([k, v]) => ({id: `ui-${k}`, text: v[lang]}))
  ];
  manifest.voices[lang] = voiceId;
  manifest.lines[lang] = {};
  for (const {id, text} of lines) {
    const file = path.join(dir, `${id}.mp3`);
    const rel = `audio/${lang}/${id}.mp3`;
    manifest.lines[lang][id] = rel;
    if (existsSync(file) && !force) { skipped++; continue; }
    try {
      const buf = await tts(text, voiceId);
      await writeFile(file, buf);
      chars += text.length; wrote++;
      console.log(`  ${rel}  ${(buf.length/1024).toFixed(0)}KB  ${text.length} chars`);
    } catch (e) {
      const fb = tour.persona.voice[lang].fallback;
      if (fb && fb !== voiceId) {
        console.warn(`  ! ${id}: ${e.message}\n    falling back to ${fb}`);
        voiceId = fb; manifest.voices[lang] = `${fb} (fallback)`;
        const buf = await tts(text, voiceId);
        await writeFile(file, buf);
        chars += text.length; wrote++;
      } else { console.error(`  x ${id}: ${e.message}`); }
    }
  }
}
await writeFile(path.join(root, 'audio/manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\n${wrote} written, ${skipped} already present, ${chars} characters billed.`);
console.log('Voices used:', manifest.voices);
