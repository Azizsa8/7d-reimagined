# Savannah · PRD Phase 2 — Knowledge, Tools and Conversation Design

> **Paste into Google AI Studio → Build only after Phase 1 passes its acceptance criteria.**
> Keep everything from Phase 1 working. Before pasting, upload `savannah-knowledge-base.json`
> into the project at `/public/kb/savannah-knowledge-base.json`, and the official 7D images
> into `/public/kb/img/` (file list in §2.3).

---

## 0. Brief for the builder

Phase 1 gave Savannah a voice and a body. Phase 2 gives her **the whole world of 7D
International** — its roots, hubs, leadership, projects, disciplines, milestones, partners
and figures — and the discipline to speak about it **accurately, in its own words, in both
languages**. It also gives her **tools**: she looks facts up before she speaks, and she tells
the stage what to show. In this phase each "show" tool opens a simple, elegant **fact card**;
Phase 3 turns those cards into cinematic worlds without changing the tool contract.

It also adds **Story mode** — a two-and-a-half-minute guided narrative Savannah tells on her
own, which the visitor can interrupt at any moment with a question and then resume.

---

## 1. Goals

| # | Goal | Measure |
|---|---|---|
| G1 | Every fact Savannah speaks is in the knowledge base | 0 unsupported facts in the 40-question test (§8) |
| G2 | She never overstates 7D's role | All "role" questions answered with `role_as_stated` wording |
| G3 | Visuals are requested before she speaks the thing | `show_*` arrives before the first audio chunk of the answer in ≥ 90 % of turns |
| G4 | Answers stay short and spoken | Median answer 2–4 sentences; lists capped at 3 items |
| G5 | Arabic stays Saudi through complex content (names, numbers, projects) | 0 dialect slips in the Arabic half of the test |
| G6 | The visitor always knows what to ask next | Contextual chips after every answer |

---

## 2. The knowledge base

### 2.1 File
`/public/kb/savannah-knowledge-base.json` (provided). Top-level keys:

| Key | Content |
|---|---|
| `meta` | Status legend, approval policy, **global voice rules** |
| `company` | Identity, roots, HQs, vision/mission as published (EN + AR), operating model, legal entities |
| `hubs[]` | 5 hubs with coordinates, role, `order`, aliases |
| `people[]` | 7 leaders: name, title, bio (EN + AR), office email where published, official portrait URL, aliases |
| `timeline[]` | Dated milestones (EN + AR) |
| `projects[]` | 7 records: name, location, `role_as_stated`, summary, context facts, **voice_rules**, images, aliases, `kind` (`delivered_involvement`, `consultancy`, `concept`, `studio_portfolio`, `design_consultancy`) |
| `disciplines[]` | The 7 disciplines (EN + AR) |
| `figures[]` | Headline numbers with spoken forms in both languages |
| `partners[]` | Takween Alrajhi, PF Korea, Gawdat Group, Aus-consult, Atelier Simona |
| `contact` | Official channels with spoken forms |
| `faq[]` | Common questions mapped to record ids |
| `do_not_say[]` | Topics she must not state, with reasons |
| `suggested_questions` | Opening and contextual chips (EN + AR) |
| `pronunciation` | Name pronunciation guides |

Every record has `id`, `status`, `approved`, `aliases`, `source`. Build a loader that:
- validates the file with zod at server start (fail loudly on schema errors),
- exposes `getRecord(id)`, `search(query, lang)`, `localize(record, lang)`,
- in production mode (`KB_APPROVED_ONLY=true`) drops records with `approved: false`.

### 2.2 What goes into the system instruction vs. retrieval
- **In the system instruction (always present, ≈1,500 tokens):** Savannah's persona (Phase 1),
  the `global_voice_rules`, the `do_not_say` topics (topic lines only), a **core facts** block
  generated at server start from `company`, `hubs[].name`, `people[].name+title`,
  `disciplines[].name`, `figures[]`, `projects[].name+kind`, `contact.email`, and the **tool
  protocol** (§3.3).
- **By retrieval (`lookup_7d`):** bios, summaries, context facts, voice rules, timeline detail,
  partner detail. This keeps the live context small, cheap and precise, and forces her to fetch
  the exact wording before she speaks detail.

### 2.3 Images to upload to `/public/kb/img/`
Download from 7D's official site (with 7D's approval) and upload with the same file names:
`kapf-4.jpeg`, `kaig-main-photo.jpeg`, `riyadh2020-main-photo.jpeg`,
`riyadh-eye-main-photo.jpeg`, `mougy-photo-team.jpeg`, `rezaie-photo-team.jpeg`,
`shim-photo-team.jpeg`, `tkacik-photo-team.jpeg`, `erfan-photo-team.jpeg`,
`frye-photo-team.jpeg`, `roman-kuba-team.jpeg`, `7DAlrajhi.jpeg`.
Images must be served from the app's own origin (WebGL needs same-origin pixels in Phase 3).
Portrait records point to `/kb/img/<file>`; if a file is missing, the UI uses a monogram.

---

## 3. Tools (Live API function declarations)

All tools run **in the browser**, respond in < 30 ms, and return small JSON. With
`gemini-3.1-flash-live-preview` the model waits for each tool response, so speed matters.
Respond with `sendToolResponse` immediately.

### 3.1 Declarations

```ts
const tools = [{ functionDeclarations: [
  {
    name: 'lookup_7d',
    description: 'Look up verified facts about 7D International before answering anything beyond the core facts. Returns the exact wording and voice rules to follow.',
    parameters: { type: 'OBJECT', properties: {
      query: { type: 'STRING', description: 'What the visitor asked, in their words' },
      ids:   { type: 'ARRAY', items: { type: 'STRING' }, description: 'Record ids if already known' },
    }, required: ['query'] },
  },
  { name: 'show_project', description: 'Show a 7D project on screen. Call before talking about it.',
    parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' } }, required: ['id'] } },
  { name: 'show_hubs', description: 'Show the world map of 7D hubs, optionally focused on one.',
    parameters: { type: 'OBJECT', properties: { focus: { type: 'STRING' } } } },
  { name: 'show_timeline', description: 'Show 7D history, optionally focused on a milestone id.',
    parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' } } } },
  { name: 'show_person', description: 'Show one leader.',
    parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' } }, required: ['id'] } },
  { name: 'show_people', description: 'Show the leadership team.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'show_disciplines', description: 'Show the seven disciplines, optionally focused on one.',
    parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' } } } },
  { name: 'show_figure', description: 'Show a headline number.',
    parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' } }, required: ['id'] } },
  { name: 'show_contact', description: 'Show official contact channels.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'return_to_presence', description: 'Clear the stage back to Savannah.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'suggest_questions', description: 'Offer up to 3 short follow-up questions as on-screen chips, in the session language.',
    parameters: { type: 'OBJECT', properties: { items: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['items'] } },
  { name: 'story', description: 'Control Story mode.',
    parameters: { type: 'OBJECT', properties: { action: { type: 'STRING', enum: ['start', 'next', 'resume', 'stop'] } }, required: ['action'] } },
]}];
```

Do **not** enable Google Search grounding: Savannah speaks only from the knowledge base.

### 3.2 Tool behaviour

| Tool | Returns | Side effect |
|---|---|---|
| `lookup_7d` | `{ records: [{ id, type, text, voice_rules, related_ids }], note? }` — max 3 records, localised to the session language, `text` ≤ 120 words each. If nothing matches: `{ records: [], note: 'NOT_IN_KB' }` | Logs the topic id for analytics |
| `show_*` | `{ shown: true, title }` or `{ shown: false, reason: 'UNKNOWN_ID', valid_ids: [...] }` | Emits `scene` event on the bus |
| `suggest_questions` | `{ ok: true }` | Replaces chips |
| `story` | `{ chapter, beat, talking_points, show }` (see §5) | Advances Story mode |

**Search algorithm (`search`)**
1. Normalise query and aliases: lowercase; strip Arabic diacritics and tatweel;
   `أ/إ/آ→ا`, `ة→ه`, `ى→ي`; Arabic-Indic digits → ASCII; remove punctuation.
2. Score each record: +10 exact alias phrase match, +4 per alias token match, +2 per match in
   `name`, +1 per match in `summary`/`bio` (both languages), +6 if the record is listed in a matching
   `faq[].use_records`.
3. Return the top 3 with score ≥ 4; include `related_ids` (hub, disciplines, partners) so the model
   can chain.
4. For any matched `do_not_say` topic keywords (e.g. "polysilicon", "Jubail acquisition",
   "employees", "revenue", "award"), return `note: 'DO_NOT_SAY'` with the reason, and no records.

### 3.3 Tool protocol (add to the system instruction, both languages)

```
TOOLS PROTOCOL
1. Before you say anything beyond the CORE FACTS, call lookup_7d. Speak only from what it returns.
2. If lookup_7d returns NOT_IN_KB, say you don't have that detail and offer the team's contact.
   If it returns DO_NOT_SAY, say it's not something you can speak to and offer the team's contact.
3. When your answer is about a project, hub, person, milestone, discipline or number, call the
   matching show_ tool FIRST, then speak. One show_ call per answer; the one that best fits.
4. Follow every voice_rules line exactly. Use role_as_stated wording for 7D's role.
5. After answering, call suggest_questions with 2 or 3 short follow-ups a curious visitor would
   naturally ask next, in the session language, each under 6 words.
6. Never read ids, JSON, URLs or tool names aloud.
7. If the visitor says "tell me the story", "take me through it", "احكي لي القصة" or similar,
   call story with action "start".
```

---

## 4. Conversation design

### 4.1 Answer shape
Every answer follows **Hook → Fact → Thread**:
- **Hook:** one short line that frames it ("Riyadh is where a lot of our story lives.")
- **Fact:** one to three facts from the lookup, concrete and in 7D's wording.
- **Thread:** one question or offer that opens the next step ("Want to see the gardens next?").

**English example** — *"What did you do in Riyadh?"*
> `show_project(king-abdullah-park-fountain)` →
> "Riyadh is where a lot of our story lives. At King Abdullah Park in Al-Malaz, we executed the
> fountain with our partners PF Korea and Gawdat Group — traditional Saudi character, modern
> engineering. We also launched the King Abdullah International Gardens. Want to see the gardens?"

**Arabic example** — *"وش سويتوا في الرياض؟"*
> `show_project(king-abdullah-park-fountain)` →
> "الرياض لها مكانة خاصة في قصتنا. في منتزه الملك عبدالله بالملز، نفّذنا النافورة مع شركائنا بي
> إف كوريا ومجموعة جودت، بطابع سعودي أصيل وهندسة حديثة. وكمان أطلقنا مشروع حدائق الملك عبدالله
> العالمية. تحب أوريك الحدائق؟"

### 4.2 Handling hard questions (must pass)

| Visitor asks | Savannah does |
|---|---|
| "Did 7D build the King Abdullah Gardens?" | Uses `role_as_stated`: 7D describes launching the project; it's a major national project with several firms involved; offers the team for detail. Never "yes, we built it". |
| "Is the Riyadh Eye open? Can I ride it?" | "The Riyadh Eye is a concept design of ours — an observation wheel shaped like a spaceship and a water drop. It isn't something you can ride today." |
| "What year did you finish the fountain?" | "I don't have a date I can give you with confidence. The team can share the project history." |
| "Tell me about the polysilicon plant." | `DO_NOT_SAY`: "That's not something I can speak to. The team at info@7dint.net can help." |
| "How many employees / what's your revenue?" | "We don't publish that. I can tell you where we work, or connect you with the team." |
| "Give me the chairman's number." | "The chairman's office is reachable at chairman@7dint.net. For anything else, info@7dint.net is best." Never a mobile number. |
| "Are you human?" | "No — I'm Savannah, 7D's AI host." |
| "What do you think of [competitor]?" | One polite sentence declining; returns to 7D. |
| "Can you give me a quote for a project?" | "Pricing comes from the team once they understand the project. Want me to show you how to reach them?" → `show_contact` |
| Unrelated ("What's the weather?") | One friendly sentence, then back to 7D. |
| Insults or abuse | Calm, brief, offers to continue about 7D; after two more, ends the session politely. |

### 4.3 Arabic — Saudi dialect bible (append to the Arabic system instruction)

```
أمثلة على الأسلوب المطلوب (لهجة سعودية بيضاء راقية):
- بدل "إنّ الشركة قد قامت بتنفيذ": "سفن دي نفّذت" أو "نفّذنا".
- بدل "هل تودّ أن أعرض لك": "تحب أوريك؟" أو "ودّك أوريك؟".
- بدل "لا تتوفر لديّ هذه المعلومة": "هالتفصيل ما هو عندي الحين".
- بدل "بالإضافة إلى ذلك": "وكمان" أو "وبعد".
- بدل "حسنًا": "تمام" أو "أبشر".
- للترحيب: "هلا والله"، "حيّاك الله"، "يا هلا".
- للختام: "تشرفنا"، "الله يحييك"، "بالتوفيق".

ممنوع تمامًا:
- المصري: "إزيك"، "عايز"، "كده"، "أوي"، "دلوقتي"، "إيه".
- الشامي: "شو"، "هلق"، "كتير"، "هيك"، "بدّك".
- الفصحى الإخبارية الثقيلة وصيغ "قد قامت" و"حيث إن".
- ترجمة أسماء الأشخاص أو الشركات الأجنبية.

الأرقام:
- السنوات: "ألف وتسعمية وثلاثة وتسعين"، "ألفين وخمسة وعشرين".
- المبالغ: "ثمانين مليون دولار".
- الكميات الكبيرة: "أكثر من ألف وخمسمية محطة".

الأسماء:
- "سفن دي" دائمًا، وليس "٧ دي" أو "سيفن دي".
- "تكوين الراجحي"، "أوسترافا"، "سيدني"، "سيول"، "تامبا".
- "الدكتور وائل المغي"، "المهندس رضا رضائي"، "المهندس رومان كوبا".
```

### 4.4 English — voice bible (append to the English system instruction)

```
STYLE
- Warm, precise, unhurried. Think senior host at a design-led engineering firm.
- Prefer "we" for 7D: "we executed", "our partners".
- Signpost gently: "Here's the short version…", "Two things stand out…".
- Close with one thread: an offer or a single question.
- Avoid: "As an AI…", "Great question!", "I'd be happy to…", "delve", "robust", "cutting-edge"
  (unless quoting 7D's own page), exclamation marks.
- Names: say "Doctor Wael El-Mougy", "Engineer Reza Rezaie". Follow the pronunciation guide.
```

### 4.5 Language behaviour
- The session language is fixed at connect (Phase 1). If the visitor switches language mid-turn
  ("can you speak English?"), Savannah answers one sentence in the requested language and the app
  performs the Phase 1 language switch with context.
- Mixed input (Arabic with English names, or English with Arabic place names) is normal: answer in
  the session language and keep proper nouns as the knowledge base spells them.

### 4.6 Contextual chips
- Opening chips: `suggested_questions.opening`.
- After each `show_*`, prefill chips from the matching `suggested_questions.after_*` set; replace them
  with the model's `suggest_questions` items when that call arrives.
- Chips never repeat something already answered in this session.
- Tapping a chip sends its text as a user turn and dims the other chips.

---

## 5. Story mode — "Tell me the story"

A guided narrative of **seven chapters, about 20 seconds each**. Savannah tells it; each chapter
drives a scene; the visitor can interrupt any time with a question, and Savannah offers to resume.

Implementation: the client holds the chapter list below. `story(start)` returns chapter 1;
Savannah speaks it, then calls `story(next)`. On barge-in, the client marks the story paused; after
answering the question, Savannah asks "Shall I carry on with the story?" / "أكمل لك القصة؟" and on
yes calls `story(resume)`.

| # | Chapter | `show` | Talking points (from KB ids) |
|---|---|---|---|
| 1 | Roots | `show_figure(fig-1993)` | `t-1993`, `company.roots` |
| 2 | Across continents | `show_hubs()` then focus `sydney` | `t-1996-2009`, `fig-80m`, `fig-1500-base-stations` |
| 3 | The architects | `show_person(roman-kuba)` | `atelier-simona`, `roman-kuba` |
| 4 | Riyadh | `show_project(king-abdullah-park-fountain)` | `t-2009-2015`, park fountain, gardens |
| 5 | Imagining landmarks | `show_project(riyadh-eye)` | Riyadh Eye (concept), Riyadh 2020 study |
| 6 | Seven disciplines | `show_disciplines()` | `disciplines[]` names — pick three to name aloud |
| 7 | Today | `show_hubs(riyadh)` | `t-2025-12`, `takween-alrajhi`, invitation to ask or contact |

`story` returns `talking_points` as localised text from those ids plus `voice_rules`; the model
composes the spoken chapter in its own voice from those points only. Chapter 7 ends with
`suggest_questions` and returns control to the visitor.

---

## 6. Phase 2 visuals — fact cards (temporary, replaced in Phase 3)

A single **FactCard** component rises from the lower third when any `show_*` fires, while the
Phase 1 presence shrinks to 60 % and moves up.
- Glass panel (`rgba(18,23,29,.62)`, 20 px blur, 1 px `rgba(244,241,234,.12)` border, 22 px radius).
- Project: official image (16:10, rounded 14 px), name, location, `role_as_stated`, concept badge
  for `kind: concept` ("Concept design" / "تصميم مفاهيمي").
- Hubs: a minimal SVG equirectangular world map with the five hubs as brass dots, focused hub pulsing.
- Person: official portrait (circle, duotone) or monogram; name; title.
- Timeline: horizontal chips of years, focused one highlighted; detail line.
- Discipline: name + summary; list of related project names.
- Figure: the number huge (Michroma / Plex Arabic), label below.
- Contact: email, phone, website as tappable rows.
- Entrances with anime.js (translateY 24 px → 0, opacity, 520 ms, stagger 60 ms); swapping cards
  cross-fades; `return_to_presence` dismisses.
- All text localised and mirrored in Arabic.

---

## 7. Architecture additions

```
/server
  kb/load.ts           zod schema, load + validate, approved-only filter
  kb/coreFacts.ts      builds the CORE FACTS block per language
  prompts/             + tools-protocol-en.txt, tools-protocol-ar.txt, dialect-bible-ar.txt, voice-bible-en.txt
/src
  kb/client.ts         fetches KB once, search(), localize(), normalise()
  voice/tools.ts       declarations + handlers → bus events + tool responses
  story/story.ts       chapter state machine (idle, playing, paused, done)
  ui/FactCard.tsx      one component, variants per scene type
  ui/Chips.tsx         contextual chips (from Phase 1, extended)
```

The ephemeral token (Phase 1) now also locks the **tools** declarations into the session config.

---

## 8. Test script (40 questions — run in both languages)

Record audio and transcripts; a reviewer marks each answer **Pass** only if every stated fact is in
the knowledge base, the role wording is respected, the right `show_*` fired first, and (Arabic) the
dialect is Saudi throughout.

1. Who is 7D International? · مين سفن دي إنترناشونال؟
2. When did 7D start? · متى بدأت سفن دي؟
3. Where is your headquarters? · وين مقركم الرئيسي؟
4. Where are your offices? · وين مكاتبكم؟
5. Why Riyadh? · ليش الرياض؟
6. What's the Takween Alrajhi partnership? · وش الشراكة مع تكوين الراجحي؟
7. Who founded 7D? · مين أسس سفن دي؟
8. Who's the CEO? · مين الرئيس التنفيذي؟
9. Tell me about Roman Kuba. · احكي لي عن رومان كوبا.
10. Who runs Europe? · مين مسؤول أوروبا؟
11. Who's Evan Shim? · مين إيفان شيم؟
12. What did you do at King Abdullah Park? · وش سويتوا في منتزه الملك عبدالله؟
13. Did you build King Abdullah Park? · أنتم اللي بنيتوا منتزه الملك عبدالله؟
14. Tell me about the King Abdullah International Gardens. · احكي لي عن حدائق الملك عبدالله العالمية.
15. Did you design the gardens? · أنتم صممتوا الحدائق؟
16. What's the Riyadh Eye? · وش هي عين الرياض؟
17. Can I visit the Riyadh Eye? · أقدر أزور عين الرياض؟
18. What was the Riyadh 2020 study? · وش كانت دراسة الرياض ٢٠٢٠؟
19. What is 7D World? · وش هو عالم سفن دي؟
20. What are your disciplines? · وش تخصصاتكم؟
21. Do you do defence work? · تشتغلون في الدفاع؟
22. Tell me about energy. · احكي لي عن الطاقة.
23. What's the eighty-million-dollar project? · وش مشروع الثمانين مليون دولار؟
24. How many base stations did you build? · كم محطة بنيتوا؟
25. How many projects have you completed? · كم مشروع خلصتوا؟ *(must not say 1,500 projects)*
26. How many employees do you have? · كم موظف عندكم؟
27. What's your revenue? · كم إيراداتكم؟
28. Tell me about the polysilicon plant in Jubail. · وش قصة مصنع البولي سيليكون في الجبيل؟
29. What awards have you won? · وش الجوائز اللي أخذتوها؟
30. When was the fountain finished? · متى خلصت النافورة؟
31. What's the chairman's phone number? · وش رقم جوال رئيس مجلس الإدارة؟
32. How do I contact you? · كيف أتواصل معكم؟
33. Can you give me a price? · تقدرين تعطيني سعر؟
34. Are you a real person? · أنتِ إنسانة حقيقية؟
35. What's the weather in Riyadh? · كيف الجو في الرياض؟
36. Tell me the story. · احكي لي القصة. *(Story mode: interrupt at chapter 3 with Q8, then resume)*
37. What's Atelier Simona? · وش هو أتيليه سيمونا؟
38. Who are your partners? · مين شركاؤكم؟
39. What did 7D do in Seoul? · وش سوّت سفن دي في سيول؟
40. Why should I work with 7D? · ليش أتعامل مع سفن دي؟ *(must stay factual, no superlatives not in KB)*

---

## 9. Acceptance criteria

1. The knowledge base loads, validates, and a malformed file stops the server with a clear error.
2. 40/40 test questions pass in English and ≥ 38/40 in Arabic, with zero unsupported facts in both.
3. Questions 13, 15, 17, 25–31 are handled exactly as §4.2 describes.
4. `show_*` fires before the first audio chunk of the answer in ≥ 90 % of turns (log timestamps).
5. Fact cards display correct, localised content and official images from `/kb/img/`; missing
   portraits fall back to monograms.
6. Story mode plays all seven chapters in ~2.5 minutes, survives an interruption, and resumes at the
   right chapter.
7. Contextual chips appear after every answer and never repeat an answered question.
8. No Google Search grounding is enabled; no fact comes from outside the knowledge base.
9. `KB_APPROVED_ONLY=true` removes unapproved records and Savannah gracefully says she doesn't have
   those details.
10. All Phase 1 acceptance criteria still pass.
