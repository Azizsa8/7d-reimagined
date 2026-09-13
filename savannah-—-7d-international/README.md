# Savannah — the voice of 7D International

A real-time, voice-only AI host. Tap once, choose English or Saudi Arabic, and talk with her.
She answers out loud from a verified knowledge base of 7D International and shows what she is
talking about as cinematic worlds on a three.js stage. Built on the Gemini Live API with
ephemeral tokens; the API key never leaves the server.

The product spec is the four phase PRDs and the knowledge base on the `savannah-prd` branch
under `docs/savannah/`. Status against every acceptance criterion: `SAVANNAH_STATUS.md`.

## Run it locally

```bash
npm install
cp .env.example .env.local    # then set GEMINI_API_KEY
npm run dev                   # http://localhost:3000
```

`GEMINI_API_KEY` is required for the voice session. Without it the arrival screen, the
language pick and every world still render (use `window.__savannah` in dev to drive them),
but the conversation cannot start and the end screen says so.

Production:

```bash
npm run build && NODE_ENV=production npm start
```

Type-check: `npm run lint`. There is no automated UI test; see `SAVANNAH_STATUS.md` for the
manual script and the screenshots in `docs/audit/`.

## Environment

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Server-side only. Mints ephemeral Live API tokens. |
| `LIVE_MODEL` | Optional override. Default `gemini-3.1-flash-live-preview`; alternative `gemini-2.5-flash-native-audio-preview-12-2025`. |
| `KB_APPROVED_ONLY` | `true` in production: drops knowledge-base records 7D has not approved. |
| `ENQUIRY_TO`, `RESEND_API_KEY`, `ENQUIRY_FROM` | Voice enquiries by email. Unset → the endpoint returns 503 and the card offers the official email and phone. |
| `ADMIN_KEY` | Protects `/api/admin/summary` (aggregate analytics). |
| `DAILY_SESSION_CAP` | Sessions per day before "Savannah is resting" (default 500). |
| `NONCE_SECRET` | Stable secret for the page nonce; random per boot if unset. |

## Layout

```
server.ts              Express + Vite (dev) or dist (prod); injects the signed page nonce into the HTML
server/index.ts        /api/live-token (nonce, rate limits, daily cap, locked token config),
                       /api/kb, /api/enquiry, /api/analytics, /api/admin/summary, /privacy
server/kb/             zod schema for the spec knowledge base, loader, CORE FACTS generator
server/tools.ts        Live API function declarations (locked into the token)
server/prompts/        system instructions (EN/AR), briefs, tools protocol, hard questions, voice bibles
src/voice/             LiveSession (SDK, resumption, goAway, barge-in, PTT), MicCapture (AudioWorklet),
                       Playback (24 kHz gapless queue + analyser + clock), captions, tools
src/kb/                KB client: normalise, score, DO_NOT_SAY screen, localise
src/story/             Story mode chapters (KB ids only) and state machine
src/stage/             Stage, SceneDirector, Presence, seven worlds, cue director, sound, tiers
src/ui/                Arrival, LanguagePick, Captions, Chips, ControlBar, WorldOverlay, StoryBar,
                       EnquiryCard, TranscriptDrawer, icons (hand-drawn strokes)
src/mobile/            fullscreen, wake lock, tilt, haptics, headphones, install prompt
public/kb/             the knowledge base and official project images
public/data/           TopoJSON land outlines for the globe
public/worklets/       mic worklet (16 kHz PCM16 frames)
```

## Voice A/B

Add `?voice=Kore` (Aoede, Kore, Leda, Sulafat, Despina) to audition voices. `?tier=low|mid|high`
forces a performance tier.
