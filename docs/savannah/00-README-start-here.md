# Savannah — the voice of 7D International

**Start here.** This folder holds everything needed to build Savannah's proof of concept in
Google AI Studio, one phase at a time.

Savannah is a real-time, voice-only AI host for 7D International. A visitor taps once, picks
English or Arabic, and talks with her. She answers out loud, in polished English or natural
Saudi Arabic, drawing only on a verified knowledge base of 7D's world. Everything she says
shows up on screen as she says it: a living sculpture of light that is her presence, and
cinematic 3D worlds for the projects, hubs, people, history and numbers she talks about.

---

## Files

| File | What it is | When to use it |
|---|---|---|
| `01-PRD-phase-1-voice-and-presence.md` | Real-time bilingual voice loop, Savannah's persona and dialect, the particle presence synced to her voice | First prompt |
| `02-PRD-phase-2-knowledge-and-conversation.md` | Knowledge base, tools, answer design, hard-question handling, Story mode, fact cards, 40-question test | After Phase 1 passes |
| `03-PRD-phase-3-visual-worlds.md` | Seven cinematic worlds, particle morphs, word-level sync, post-processing, sound design, performance tiers | After Phase 2 passes |
| `04-PRD-phase-4-mobile-immersion-and-launch.md` | App-like phone experience, gestures and haptics, voice enquiries, accessibility, cost and privacy controls, launch checklist | After Phase 3 passes |
| `savannah-knowledge-base.json` | The sourced 7D knowledge base, in English and Arabic, with voice rules | Upload before Phase 2 |

---

## How to run this in Google AI Studio

1. **Create the app.** Go to AI Studio → **Build**, start a new app, and paste the whole of
   Phase 1 as the first prompt. Let the first generation finish (a few minutes).
2. **Add microphone permission.** Make sure `metadata.json` has
   `"requestFramePermissions": ["microphone"]`. Phase 1 asks for it, but check.
3. **Upload assets** into the project's `public` folder:
   - `public/brand/7d-logo.png` → from this repo, `assets/brand/logo.png`.
   - `public/data/land-110m.json` → from this repo, `data/land-110m.json` (needed in Phase 3).
   - `public/kb/savannah-knowledge-base.json` → this folder (needed in Phase 2).
   - `public/kb/img/*` → the official images listed in Phase 2, §2.3 (needed in Phase 2).
4. **Test Phase 1 against its acceptance criteria** on a real phone. Fix issues using the chat panel
   or Annotation mode, one issue per message. Don't move on until every item passes.
5. **Connect GitHub** (two-way sync) once Phase 1 works, so every later phase is a reviewable commit.
6. **Paste Phase 2**, starting your message with: *"Phase 1 is complete and working. Implement the
   following Phase 2 PRD without breaking anything from Phase 1."* Repeat for Phases 3 and 4.
7. **Publish** to Cloud Run from AI Studio for the pilot link. Phase 4 covers the custom domain.

**Prompting tips for Build mode**
- One phase per prompt. If a phase is too big for one generation, split it at the numbered sections
  and paste them in order, saying "continue Phase N with section X".
- When something is wrong, describe what you see and what you expected ("the presence doesn't
  react when she speaks; it should swell with her voice level as in Phase 1 §5.3"). Point to the
  section number.
- Never let the agent replace the Live API with text chat plus text-to-speech. Savannah is a live
  voice session.
- Never let the agent put `GEMINI_API_KEY` in browser code. Ephemeral tokens only.

---

## Key technical decisions

| Decision | Choice | Why |
|---|---|---|
| Voice engine | Gemini Live API, native audio | Real-time speech in and out, natural interruption, one model for listening and speaking |
| Default model | `gemini-3.1-flash-live-preview` | Google's current recommended Live model. It is in **preview**. Switch in one constant to `gemini-2.5-flash-native-audio-preview-12-2025` if Arabic quality is better there |
| Browser auth | Ephemeral tokens minted by the Node server | The Live API is a WebSocket from the browser; the real key stays server-side |
| Arabic dialect | Steered by system instruction, not a language code | The Gemini API rejects language codes for native audio, and Vertex only offers Egyptian Arabic |
| Voice | Female prebuilt voice, A/B via `?voice=` (Aoede, Kore, Leda, Sulafat, Despina) | Choose by listening test in both languages |
| Visual sync | Web Audio `AnalyserNode` on her output + output transcription for word cues | The API gives no visemes or word timings |
| Facts | Knowledge base + `lookup_7d` tool; no web search | She must never repeat unverified claims |
| 3D | three.js with custom GLSL, bloom, particle morphs | Same family as the 7D site concepts, pushed much further |

---

## Risks to watch

1. **Saudi accent quality.** Google doesn't document how well a Gulf dialect can be steered. This is
   the biggest product risk. Run the listening test below after Phase 1, before building more.
2. **Preview models.** The Live models are in preview and can change. Keep the model id in config
   and re-run the Phase 2 test after any model change.
3. **Echo on phones.** Speaker audio leaking into the mic can trigger false interruptions. Phase 1
   keeps echo cancellation on, and Phase 4 adds push-to-talk.
4. **Cost grows with conversation length.** Each turn re-bills the conversation so far. Phase 1 and
   Phase 4 cap session length, turn on context compression and rate-limit tokens. Set billing
   alerts before sharing the link widely.
5. **The published deployment uses your API key for every visitor.** Keep the pilot link private
   until Phase 4 controls are in.

---

## Arabic listening test (run after Phase 1, and again at launch)

Two native Saudi listeners, ideally one from Riyadh. Ten turns each, same script, each voice option.

| # | Say to Savannah | Listen for |
|---|---|---|
| 1 | هلا، مين أنتِ؟ | Natural Saudi greeting, not formal |
| 2 | وش تسوي سفن دي؟ | Dialect holds through a descriptive answer |
| 3 | متى بدأت الشركة؟ | Years pronounced naturally ("ألف وتسعمية وثلاثة وتسعين") |
| 4 | وين مكاتبكم؟ | Foreign city names pronounced correctly |
| 5 | مين الرئيس التنفيذي؟ | Foreign names not translated, titles in Arabic |
| 6 | احكي لي عن الرياض | Warmth, rhythm, no Egyptian or Levantine words |
| 7 | *(interrupt her mid-sentence)* طيب وعين الرياض؟ | Recovers naturally after interruption |
| 8 | كم موظف عندكم؟ | Declines gracefully in dialect |
| 9 | Can you speak English? | Clean switch, then back if asked |
| 10 | يعطيك العافية | Natural closing ("الله يعافيك", "تشرفنا") |

Score each turn 1–5 on **naturalness**, **Saudi-ness** and **clarity**. Launch bar: average ≥ 4,
and no turn in a clearly non-Saudi dialect.

---

## What we still need from 7D International

These gaps are in the knowledge base on purpose. Savannah says she doesn't have these details
until 7D supplies them.

1. **Approval of every record** in the knowledge base for public voice use (set `approved: true`).
2. **Official Arabic names** for projects, people and titles. 7D publishes no Arabic content today.
3. **Project years and 7D's exact scope** for each project. 7D's own pages give conflicting years,
   and outside sources credit other firms with the design and construction of the King Abdullah
   Gardens and the park.
4. **Confirmation of which projects are delivered and which are concepts.** Today the Riyadh Eye and
   7D World are treated as concepts.
5. **The founding story in one approved paragraph.** Company registers show the 1993 Czech company and
   today's 7D International a.s. as separate entities.
6. **Confirmation of the "$80M" and "1,500+ base stations" wording** and whether they may be voiced.
7. **Permission to use leadership portraits** and confirmation of current titles.
8. **Anything on the 7D Polysilicon Valley announcement,** which has been removed from 7D's site.
   Until then it is on the do-not-say list.
9. **More projects, with images,** especially recent Saudi work since the Takween Alrajhi partnership.
10. **The enquiry inbox** for Phase 4 and who answers it.
11. **A named Arabic reviewer** at 7D Riyadh for the listening test and final copy.

---

## Where the facts come from

The knowledge base was compiled on 2026-09-13 from:
- 7D's current official website, 7dint.net: home, about, industries and each discipline page,
  leadership pages, project pages, news and contact.
- 7D's own earlier publications: archived 7dint.com pages from 2015–2016 and the company profile PDF
  from about 2015.
- Public company registers in the Czech Republic and Florida, for legal entity names only.
- Third-party sources (Wikipedia, Omrania, Arab News) were used **only to check** 7D's claims. They
  are the reason for the careful role wording and the do-not-say list.

Each record in the JSON carries its source URL and a status: official, official archive, registry or
concept. 7dint.net's robots file allows use as reference but not for AI training. The knowledge base
is reference material for retrieval, which fits that signal; don't use it to fine-tune a model.
