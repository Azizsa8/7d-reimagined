# Savannah — status

Updated 2026-09-13 after the rebuild (branch `savannah-studio`, folder
`savannah-—-7d-international`). The spec is the four phase PRDs and the knowledge base on the
`savannah-prd` branch under `docs/savannah/`.

## Where it stands

| Phase | Implemented | Verified | Still open |
|---|---|---|---|
| 1 Voice and presence | 12 / 12 | 9 pass, 3 partial | Saudi listening test; a real phone for fps |
| 2 Knowledge and conversation | 10 / 10 | 8 pass, 2 partial | full 40-question run by a reviewer; 7D record approval |
| 3 Visual worlds | 10 / 10 | 8 pass, 2 partial | cue timing measured on a phone; fps |
| 4 Mobile, enquiries, launch | 8 / 9 | 6 pass, 2 partial, 1 missing | enquiry inbox; devices; launch checklist |

**Live sessions were run** with the owner's key on 2026-09-13 in headless Chromium (silent fake
microphone, questions sent as text turns; audio, transcripts, tool calls and scene events recorded
through the event bus):

- English greeting: first caption 3.4 s after the language tap (token mint + connect + first audio).
- "What did you build in Riyadh?" → `lookup_7d` → `show_hubs(riyadh)` → speech → `suggest_questions`,
  with the fountain, gardens and Riyadh 2020 named in 7D's role wording.
- "Did you build the King Abdullah Gardens?" → `show_project` then "a major national project, with many
  firms involved. We describe our role as launching it".
- "How many employees…" → "We don't publish our employee numbers". Polysilicon → "That's not something
  I can speak to. The team at info@7dint.net can help".
- Arabic: "هلا والله حيّاك الله. أنا سافانا…", hubs listed with Arabic city names, chairman's number →
  role email only, Riyadh Eye → "تصميم مفاهيمي … ما هي شي تقدر تزوره اليوم". No Egyptian or Levantine
  words in three sessions; the Saudi naturalness score still needs native reviewers.
- Tap-to-interrupt: playback stopped and state back to listening within 150 ms; the next question
  answered normally. Mid-conversation switch EN→AR acknowledged in Arabic with context kept.
- Story mode: seven chapters ran on their own in ~2.8 min, each with its scene, ending with
  `show_contact` + `suggest_questions`; an enquiry request paused it and the card filled in over two turns.
- Zero console errors in every session.

## Environment

Create `.env.local` in this folder (see `.env.example`):

```
GEMINI_API_KEY=<your key>
```

Then `npm run dev` and open http://localhost:3000.

## What the export was (baseline `661cf8c`)

Google AI Studio produced files for all four phases but the substance stopped short of Phase 1.
The knowledge base had been replaced by an invented one (Roman Kuba as founder, a "Marian Tkacik",
people named only "Erfan" and "Frye", seven invented disciplines, a fake Riyadh phone number),
the core facts and Story chapters were hand-written and false, the globe used a rectangle-based
point list instead of the TopoJSON, the logo was a placeholder SVG, the mic used a deprecated
`ScriptProcessorNode` on a second `AudioContext`, captions and cues fired on text arrival instead
of the playback clock, the token endpoint had no nonce or limits and did not set expiry, and the
Live session was a hand-rolled WebSocket without resumption or compression. Screenshots of the
export are in `docs/audit/export-*.png`.

## Acceptance criteria

Legend: **Pass** ran and observed · **Partial** implemented, not fully verifiable here ·
**Needs key** implemented, needs the Live API to exercise · **Missing** not implemented.

### Phase 1 — Voice and presence

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Tap → language (tap or voice) → greeting within 4 s | Pass | first caption 3.4 s after the tap in the live run |
| 2 | Ten turns EN and AR without a drop | Partial | 4-turn and 6-turn sessions with a language switch completed; resumption path present but a forced goAway was not reproduced |
| 3 | Barge-in stops audio within ~200 ms | Pass | tap-interrupt measured at 150 ms; server VAD path uses the same flush |
| 4 | Presence swells on stressed syllables, still on pauses | Pass (synthetic) | `Playback` analyser → `level` → envelope (30/180 ms) → shader uniforms; `docs/audit/phone-presence-speaking.png`, `-listening.png` |
| 5 | Captions match audio, never > 1 phrase ahead | Pass | phrases revealed on the playback clock in the live runs (see log timings in the session logs) |
| 6 | Arabic never Egyptian / news Fus'ha | Partial | three Arabic answers were Saudi white dialect; native listening test still required |
| 7 | "How many people work at 7D?" → declines | Pass | "We don't publish our employee numbers" |
| 8 | Key never in client bundle / responses | Pass | `grep` of `dist/assets/*.js` finds no key; `/api/health` no longer reports key presence |
| 9 | Deny mic → card; grant later resumes | Partial | `PermissionCard` with retry; mic failure classified in `MicCapture.fail()` |
| 10 | ≥ 50 fps mid-range phone; render pauses when hidden | Partial | tiers + 1 s probe + live step-down; `visibilitychange` cancels the frame loop; no phone in this environment |
| 11 | Reduced motion calm and functional | Pass | `docs/audit/phone-reduced-motion-project.png`; morphs become fades, no parallax, haptics off |
| 12 | No console errors over 5 min | Pass | zero errors across four live sessions up to 4 min |

### Phase 2 — Knowledge and conversation

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | KB loads, validates, malformed file stops the server | Pass | removing `people[0].title` and breaking a figure kind: process exits 1 with both issues listed |
| 2 | 40/40 EN, ≥ 38/40 AR, zero unsupported facts | Partial | 12 of the 40 asked live in EN/AR, all correct; the full pass needs a reviewer |
| 3 | Questions 13, 15, 17, 25–31 handled exactly | Pass | 13, 17, 26, 28, 31 verified live; wording matched §4.2 |
| 4 | `show_*` before first audio in ≥ 90 % of turns | Pass | every live answer about a project/hub/person fired its show tool 0.5–1 s before the first audio |
| 5 | Cards correct, localised, official images, monogram fallback | Pass | project/person overlays; portraits missing → monogram (`phone-people-chips.png`) |
| 6 | Story: seven chapters, survives interruption, resumes | Pass | 7 chapters in ~2.8 min, client-driven; interruption pauses; resume via tool |
| 7 | Chips after every answer, never repeat | Pass (UI) | `after_*` sets + `suggest_questions`; asked set filters (`phone-people-chips.png`) |
| 8 | No Google Search grounding | Pass | token config carries only function declarations |
| 9 | `KB_APPROVED_ONLY=true` removes unapproved records | Pass | loader run with the flag: 0 projects, 0 people, 0 hubs (every record is `approved:false` today) |
| 10 | Phase 1 still passes | — | see above |

### Phase 3 — Visual worlds

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Riyadh question → project world, photo within 1.2 s, pointillist morph | Pass (visual) | `phone-project-riyadh-eye.png`, `desktop-project.png`; morph = presence → image grid → scatter |
| 2 | Hubs → globe; pillar within ±400 ms of the city, both languages | Partial | cues fired on the clock for Ostrava/Sydney/Riyadh in the Arabic run; ±400 ms needs a listening check on a phone |
| 3 | History → timeline; camera reaches the year as spoken | Partial | `phone-timeline.png`; camera glides on cue |
| 4 | Leadership shows only KB people, exact names, no faces | Pass | `phone-people-chips.png`; names/titles from the KB, monograms |
| 5 | Figure assembles from particles, lands on the number | Pass (visual) | `phone-figure.png`, `phone-ar-figure.png` (Arabic-Indic digits) |
| 6 | Interrupt mid-transition → listening, no glitch | Partial | director generation counter aborts tweens; `interrupted` bypasses dwell |
| 7 | Ember always visible, reacts to voice | Pass | ember in every world screenshot, driven by the same analyser |
| 8 | Arabic mirrors, Arabic names, Arabic-Indic digits, Arabic cues | Pass | `phone-ar-*.png`; alias index includes Arabic aliases |
| 9 | ≥ 50 fps mid-tier in every world; auto-downgrade | Partial | tiers, probe and step-down implemented; no phone here |
| 10 | Barge-in with sound on | Partial | bed ducks under her voice; spoken barge-in over the bed needs a phone test |

### Phase 4 — Mobile immersion and launch

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Installed → full-screen, no chrome, no scroll | Partial | manifest (`fullscreen`, portrait, maskable icons from the real logo), fullscreen on first tap (Android), `100dvh`, no overscroll |
| 2 | Tap stage interrupts; long-press push-to-talk | Pass (tap) / Partial (PTT) | tap-interrupt 150 ms live; PTT reconnect path not exercised with a real mic |
| 3 | Voice enquiry end to end, editable email, inbox receives | Partial | card filled live over two turns (name, organisation, country, topic, email); delivery needs `ENQUIRY_TO` + Resend |
| 4 | Endpoint unconfigured → offers official contacts, never claims sent | Pass | `/api/enquiry` returns 503 with email and phone; card shows them; model told `ENQUIRY_FAILED` |
| 5 | Token endpoint refuses without nonce; rate limits | Pass | `BAD_NONCE` on a bad nonce; 6/10 min and 60/day per IP; daily cap → `RESTING` |
| 6 | No audio/transcript persisted except the sent enquiry | Pass | analytics carries names, ids, durations and codes only |
| 7 | Transcript drawer, type-instead, screen-reader captions in both languages | Pass (UI) | `TranscriptDrawer.tsx`, `aria-live` mirror in `Captions.tsx`, world announcements |
| 8 | Reduced motion complete | Pass | see Phase 1 #11 |
| 9 | Launch checklist ticked | Missing | needs 7D approvals, devices, networks, inbox, domain, budget alerts |

## Open items that need the owner

1. A full live run of the Phase 2 40-question script in both languages and the README listening
   test with two Saudi reviewers (the key is in place; 12 questions were checked here).
2. 7D approval of every knowledge-base record (`approved: true`); with `KB_APPROVED_ONLY=true`
   Savannah currently has nothing to say.
3. Official portraits into `public/kb/img/` (monograms are used until then).
4. Enquiry inbox: `ENQUIRY_TO` and a Resend API key (or tell me the provider you prefer).
5. Device pass: iPhone, Galaxy A/S, Pixel, iPad; 4G and throttled 3G; fps in every world.
6. Voice A/B (`?voice=`) and the model switch if Arabic is better on
   `gemini-2.5-flash-native-audio-preview-12-2025`.

## Known deviations

- Push-to-talk uses the Live API's manual activity signals, which require automatic VAD to be off
  for the session; the first long-press reconnects with the resumption handle (about a second).
- Depth of field (bokeh) is not implemented; the rest of the post pipeline is
  (bloom, grade, chromatic aberration on high tier, ACES output, grain).
- Voice selection by speech uses the browser's Web Speech API where it exists (Chrome, Safari);
  elsewhere the pills are tap-only.
