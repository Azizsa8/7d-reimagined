You are taking over development of **Savannah**, a real-time bilingual voice AI host for 7D International. The app was generated in Google AI Studio (Build mode) and exported to:

`/home/ais04/7d-reimagined/savannah-—-7d-international`

That folder is the current state of the product. Your job is to audit it, then resume development at full strength until it meets the spec. Work autonomously. Do not stop to ask me questions unless you are truly blocked.

## 1. Load the spec first

The product spec is a pack of phase PRDs plus a knowledge base, on the `savannah-prd` branch of `https://github.com/Azizsa8/7d-reimagined`. Get it before touching code:

```bash
cd /home/ais04/7d-reimagined && git fetch origin savannah-prd && git show origin/savannah-prd:docs/savannah/00-README-start-here.md | head -5
mkdir -p /home/ais04/savannah-spec && for f in 00-README-start-here.md 01-PRD-phase-1-voice-and-presence.md 02-PRD-phase-2-knowledge-and-conversation.md 03-PRD-phase-3-visual-worlds.md 04-PRD-phase-4-mobile-immersion-and-launch.md savannah-knowledge-base.json; do curl -fsSL "https://raw.githubusercontent.com/Azizsa8/7d-reimagined/savannah-prd/docs/savannah/$f" -o "/home/ais04/savannah-spec/$f"; done; ls -la /home/ais04/savannah-spec
```

Read all six files completely. They are the source of truth for behaviour, persona, Saudi Arabic dialect, tools, visuals, performance and acceptance criteria. Also useful from the main repo: `assets/brand/logo.png` (7D logo) and `data/land-110m.json` (globe land outlines).

## 2. Audit the export (before writing code)

1. Map the project: framework, entry points, server, how the Gemini key is used, `metadata.json`, dependencies, file tree.
2. Install and run it locally. The key is read from the environment as `GEMINI_API_KEY`. If it's not set, check for an `.env`/`.env.local`; if none exists, stop and tell me exactly what to set. Never print the key.
3. Check it in a browser at a phone viewport (375×812) and at desktop. Use Playwright/Chromium for screenshots.
4. Write `SAVANNAH_STATUS.md` in the project root:
   - Which phase the export has reached.
   - A table of **every acceptance criterion from Phases 1–4**, each marked Pass / Partial / Missing, with evidence (file, screenshot, or observed behaviour).
   - Security and correctness issues: API key reaching the browser, missing ephemeral tokens, missing microphone permission, broken audio pipeline, interrupt handling, caption sync, memory leaks, console errors.
   - A prioritised build plan.

## 3. Resume development

Work in this order and don't skip ahead while an earlier phase still fails:

1. **Fix Phase 1 until every criterion passes.** Especially: ephemeral tokens (the key never in client code), 16 kHz mic in / 24 kHz playback with a gapless queue, barge-in flushes audio in ~200 ms, captions revealed on the playback clock, and the particle presence driven by the real output audio through an `AnalyserNode`. It also needs session resumption and compression, and both system instructions from the PRD word for word, including the Saudi dialect rules.
2. **Phase 2:** knowledge base loader with zod validation, `lookup_7d` and all `show_*` tools, the tool protocol, the hard-question handling table, Story mode, fact cards, contextual chips. No Google Search grounding.
3. **Phase 3:** scene director, the seven worlds, particle morphs, word-level alias cueing, post-processing, synthesised sound, performance tiers.
4. **Phase 4:** phone immersion, voice enquiries, accessibility, cost and abuse controls, launch checklist.

## 4. Quality bar and rules

- This is for a client who must be blown away. Treat the visual and voice experience as award-level work. No placeholder visuals, no generic UI kits, no stock icons, no lorem.
- Phone first. Verify every change at 375×812 with screenshots before calling it done. Target ≥ 50 fps on a mid-range phone.
- Both languages always. Arabic mirrors the layout, uses logical CSS properties, and must sound natural Saudi (white dialect), never Egyptian, Levantine or stiff formal Arabic.
- Savannah speaks **only** from the knowledge base. Respect every `voice_rules` and `do_not_say` entry: no project years, no overstating 7D's role, Riyadh Eye and 7D World are concepts, and no polysilicon, employee counts, revenue or personal phone numbers.
- Keep the live model id in one config constant. Default `gemini-3.1-flash-live-preview`, with a switch to `gemini-2.5-flash-native-audio-preview-12-2025`.
- Respect `prefers-reduced-motion`.
- **Never start any paid generation** (images, video, 3D, voices, upscales) without first telling me exactly what, which model, and the cost, and waiting for my yes. Live API conversation testing is fine.
- Never commit secrets. Never put `GEMINI_API_KEY` in client code.
- Commit in small, meaningful steps. If the folder isn't a git repo, `git init` it. Push to a new `savannah-studio` branch of `Azizsa8/7d-reimagined` only when I say so, or keep it local.
- Don't claim something works unless you ran it and saw it work. If a check fails, say so with the output.

## 5. Report back

When you stop, give me:
- where it stands per phase, pass/fail count against the acceptance criteria,
- what you changed,
- anything that needs me: env vars, keys, approvals, a Saudi listening test, or 7D content,
- the exact command to run it locally.
