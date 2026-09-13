# Savannah — status and audit

Audited 2026-09-13 against the Phase 1–4 PRDs on the `savannah-prd` branch. This file is
updated as work lands; the tables below always describe the current tree, and the
"Export baseline" notes describe what Google AI Studio handed over (commit `661cf8c`).

## Where the export stood

**Phase reached: Phase 1, partially.** The export has files named after all four phases,
but the content behind them does not meet Phase 1. The headline problems:

| Area | Finding (export baseline) | Evidence |
|---|---|---|
| Knowledge base | `public/kb/savannah-knowledge-base.json` is **not the spec KB**. AI Studio rewrote it into a different shape and invented content: Roman Kuba as "Founder", a "Marian Tkacik", people named only "Erfan" and "Frye", seven invented disciplines ("Water & Multimedia Features", "Strategic Investment & Consortiums"), a project "Telecommunications Base Stations Network", a fake phone `+966 11 000 0000`, `approved: true` on everything. | `cmp` against the spec file differs; dump of `people[]`, `disciplines[]`, `contact` |
| Core facts | `server/kb/coreFacts.ts` hard-codes "Founded in 1993 in Ostrava by architect Roman Kuba" (false) instead of generating from the KB. | file |
| Story mode | Seven chapters with hand-written scripts that contradict the KB: 1993 founding by Roman Kuba, "$80M in infrastructure contracts", "paleobotanic history" of the gardens, "beloved civic icon". Chapters do not follow the PRD chapter table. | `src/story/story.ts` |
| Live session | Hand-rolled WebSocket to `BidiGenerateContentConstrained`; resends `model` + `tools` in setup despite the token locking them; no `sessionResumption`, no `contextWindowCompression`, no VAD silence config; `goAway` reconnects from scratch with a text summary. | `src/voice/LiveSession.ts` |
| Token endpoint | `uses: 10`, default expiry, no `newSessionExpireTime`, no page nonce, no rate limit, no daily cap. Client and server tool declarations differ (client adds `return_to_presence`). | `server/index.ts` |
| Microphone | `ScriptProcessorNode` (deprecated, main-thread) rather than an `AudioWorklet`; a second `AudioContext` separate from playback; a third in `SoundDesign`. | `src/voice/MicCapture.ts` |
| Captions | Revealed on arrival of transcription text, not on the playback clock; the "audio queued so far" is never passed to the caption manager. | `src/voice/captions.ts` |
| Word cues | Fire the instant transcription arrives (ahead of audio) instead of being scheduled to playback time. | `src/stage/cue/CueDirector.ts` |
| Globe data | `public/data/land-110m.json` is a generated list of lat/lon points from hand-drawn rectangles (`scripts/generate-land.ts`), not the TopoJSON. Continents are boxes. | file head |
| Logo | `public/brand/7d-logo.png` is a 779-byte SVG renamed `.png`; renders as a broken image. | screenshot `docs/audit/export-arrival-phone.png` |
| Presence | Reads as an over-bloomed white blob at 375×812: bloom 0.9 on 24k additive particles, no exposure control, sphere fills the frame. Rings barely visible. | screenshot |
| Arrival / language | Arrival has a button and header text immediately (spec: whole screen tappable, no text for 1.2 s, point of light). Language pick is a modal with "Cancel" (spec: two pills either side of the presence, voice choice). Spec chip texts present. | `src/ui/Arrival.tsx`, `LanguagePick.tsx` |
| UI kit / icons | `lucide-react` icons in FactCard and StoryBar (spec forbids stock icons). Fact card and world overlay both render for the same `show_*`. | `src/ui/FactCard.tsx`, `StoryBar.tsx` |
| Tool ids | Declarations reference ids that do not exist in the spec KB (`riyadh-2020`, `marian-tkacik`, `architecture-master-planning`…); `show_discipline` (singular); no `show_people`; `show_timeline` takes `focus_year`; `show_hubs` focus `florida` (KB: `tampa`). | `src/voice/tools.ts` |
| Phase 4 | `deviceManager.ts` is never imported. No `capture_enquiry`, no `/api/enquiry`, no transcript drawer, no analytics, no privacy note, no nonce. Manifest and SW exist. | grep |
| Security | `GEMINI_API_KEY` stays server-side (good). `/api/health` reveals `hasKey`. Token endpoint unprotected. | `server/index.ts` |
| Type check | `tsc --noEmit` passes. No console errors before the token 500. | run |

## Environment

`GEMINI_API_KEY` is **not set** in the shell and there is no `.env` / `.env.local`. The server
starts and the UI renders, but every live-session attempt fails at the token endpoint.
Create `.env.local` in this folder:

```
GEMINI_API_KEY=<your key>
```

Everything below that says "needs key" could not be verified live in this session.

## Acceptance criteria

Legend: **Pass** verified by running it · **Partial** implemented but unverified or incomplete ·
**Missing** not implemented · **Needs key** implemented, cannot be exercised without the API key.

### Phase 1 — Voice and presence

| # | Criterion | Export | Now | Evidence |
|---|---|---|---|---|
| 1 | Tap → language → greeting within 4 s | Missing | Needs key | token + SDK connect path, greeting turn |
| 2 | 10 turns EN and AR without a dropped session | Missing | Needs key | resumption + compression + reconnect |
| 3 | Barge-in stops audio within ~200 ms | Partial | Needs key | `Playback.interrupt()` stops all scheduled sources |
| 4 | Presence swells on stressed syllables, still on pauses | Partial | Partial | analyser → envelope → uniforms; verified visually with synthetic audio |
| 5 | Captions match audio, never > 1 phrase ahead | Missing | Partial | clock-based reveal from queued-audio time |
| 6 | Arabic never Egyptian / news Fus'ha | Needs key | Needs key | Saudi listening test required |
| 7 | "How many people work at 7D?" → declines | Needs key | Needs key | DO_NOT_SAY + prompt |
| 8 | Key never in client bundle / responses | Pass | Pass | grep of `dist/` and network |
| 9 | Deny mic → permission card; grant later resumes | Partial | Partial | card + retry |
| 10 | ≥ 50 fps mid-range phone; pause when hidden | Partial | Partial | visibility pause; fps probe |
| 11 | Reduced motion calm and functional | Partial | Partial | `REDUCED` checks |
| 12 | No console errors over 5 min | Partial | Needs key | |

### Phase 2 — Knowledge and conversation

| # | Criterion | Export | Now |
|---|---|---|---|
| 1 | KB loads, validates, malformed file stops server | Partial (wrong KB, server does not stop) | see below |
| 2 | 40/40 EN, ≥ 38/40 AR, zero unsupported facts | Missing | Needs key |
| 3 | Hard questions 13, 15, 17, 25–31 handled exactly | Missing | Needs key |
| 4 | `show_*` before first audio in ≥ 90 % of turns | Missing | Needs key (timestamps logged) |
| 5 | Fact cards correct, localised, official images, monogram fallback | Missing | see below |
| 6 | Story plays 7 chapters in ~2.5 min, survives interruption, resumes | Missing | see below |
| 7 | Chips after every answer, never repeat | Partial | see below |
| 8 | No Google Search grounding | Pass | Pass |
| 9 | `KB_APPROVED_ONLY=true` removes unapproved records | Partial (all records marked approved) | see below |
| 10 | Phase 1 still passes | — | — |

### Phase 3 — Visual worlds

| # | Criterion | Export | Now |
|---|---|---|---|
| 1 | Riyadh question → project world, correct photo within 1.2 s, pointillist morph | Partial | see below |
| 2 | Hubs → globe; pillar within ±400 ms of city heard, both languages | Partial (cues not on clock; box continents) | see below |
| 3 | History → timeline; camera reaches year as spoken | Partial | see below |
| 4 | Leadership shows only KB people, exact names, no faces | Partial (invented people) | see below |
| 5 | Figure assembles from particles, lands on spoken number | Partial | see below |
| 6 | Interrupt mid-transition → listening, no glitch | Partial | see below |
| 7 | Ember always visible, reacts to voice | Partial | see below |
| 8 | Arabic mirrors, Arabic-Indic digits, Arabic cues | Partial | see below |
| 9 | ≥ 50 fps mid-tier in every world; auto-downgrade | Partial | see below |
| 10 | Barge-in works with sound on | Needs key | Needs key |

### Phase 4 — Mobile immersion and launch

| # | Criterion | Export | Now |
|---|---|---|---|
| 1 | Installed → full-screen, no chrome, no scroll | Partial (manifest only) | see below |
| 2 | Tap stage interrupts; long-press push-to-talk | Missing | see below |
| 3 | Voice enquiry end to end, email corrected on card, inbox receives | Missing | see below |
| 4 | Endpoint unconfigured → offers official contacts, never claims sent | Missing | see below |
| 5 | Token endpoint refuses without nonce; rate limits | Missing | see below |
| 6 | No audio/transcript persisted except sent enquiry | Pass (nothing persisted) | Pass |
| 7 | Transcript drawer, type-instead, screen-reader captions in both languages | Partial (text input only) | see below |
| 8 | Reduced motion complete | Partial | see below |
| 9 | Launch checklist ticked | Missing | Missing (needs 7D and devices) |

## Build plan (priority order)

1. **Restore the real knowledge base** and write a zod schema for its actual shape; generate
   core facts from it; serve it through `/api/kb` so `KB_APPROVED_ONLY` applies to the client.
2. **Token endpoint**: page nonce, per-IP rate limits, daily cap, `uses: 1`,
   `newSessionExpireTime` 60 s, lock model + system instruction + voice + tools +
   transcription + compression in `liveConnectConstraints`.
3. **Live session on `@google/genai`**: resumption handle, `goAway` silent reconnect,
   backoff, VAD silence 600 ms, activity signals for push-to-talk, tool round-trips.
4. **Audio engine**: one `AudioContext`; `AudioWorklet` mic at 16 kHz PCM16 in 20–40 ms
   chunks; gapless 24 kHz playback with analyser; playback clock exposed to captions and cues.
5. **Presence**: exposure and bloom tuned for phones; state springs; ember; morph buffers.
6. **Arrival, language pick (tap or voice), permission card, control bar** to spec, no stock
   icons.
7. Phase 2: KB client (normalise, score, DO_NOT_SAY), exact tool declarations, story
   chapters from KB ids, chips, hard-question handling in prompt.
8. Phase 3: globe from TopoJSON, project image morph and dissolve, timeline ribbon,
   people constellation, seven discipline instruments, figure particles, contact card,
   clock-scheduled cues, post-processing, sound, tiers.
9. Phase 4: shell, gestures, haptics, wake lock, enquiry flow and endpoint, accessibility,
   cost controls, analytics, privacy.
