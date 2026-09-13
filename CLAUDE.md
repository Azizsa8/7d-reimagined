# 7D International — reimagined site

A single-page marketing site for 7D International (contracting and consulting, HQ Florida,
Middle East HQ Riyadh). Deployed on Vercel as static files plus one serverless function.
No bundler, no package.json, no test suite. Everything is hand-written ES modules loaded
directly by the browser.

## What the visitor experiences

1. A gate: title card, choose Arabic or English. That click is the audio user gesture.
2. Noorah, the guide, offers a two-minute voice tour. If accepted, the tour scrolls the page
   itself while pre-rendered MP3 narration plays. Touch or wheel pauses it.
3. Sections in order: hero, footprint (3D globe with five hubs), projects (a 480vh
   scroll-driven photographic presentation of four published Riyadh projects), solutions deck, history, news,
   quote, contact.
4. A text/voice assistant (FAB, bottom right) answers scripted questions and can jump to
   sections or projects.

## Files

| File | Role |
|---|---|
| `index.html` | All markup, all CSS, and the page script: i18n strings `I`, content arrays `PROJECTS`, `SOLUTIONS`, `TIMELINE`, `NEWS`, `HUBS`, render functions, scroll driving, the assistant. |
| `tour.js` | Gate, tour HUD, narration playback, scroll driving during the tour. Reads `data/tour.json` and `audio/manifest.json`. |
| `scene.js` | Lazy-loaded three.js r165 globe. Icosphere land grid, surface hubs, HTML labels, great-circle routes. |
| `projects.js` | Published project JPEGs, proximity loading, scroll progress and accessible scene controls. |
| `viz.js` | 2D canvas illustrations for the seven discipline cards. |
| `data/tour.json` | The narration script per chapter, both languages, plus per-chapter scroll targets. |
| `data/land-110m.json` | TopoJSON land outlines for the globe. Ships with the site, never fetched from a CDN. |
| `assets/tex/manifest.js` | Explicit list of shipped optional texture maps. Empty until assets are committed; no speculative image requests or retry polling. |
| `tools/build-voice.mjs` | Pre-renders `tour.json` to `audio/{en,ar}/*.mp3` via ElevenLabs. Needs `ELEVENLABS_API_KEY` in the environment. Writes `audio/manifest.json`. |
| `api/voice.js` | Vercel function. TTS proxy for the conversational assistant only, rate-limited. The tour never calls it. |
| `sw.js` | Minimal offline shell. Bump the cache name `C` when shipping changes to cached files. |
| `icon.svg`, `manifest.json` | PWA icon and manifest. |

## How the pieces talk to each other

- `index.html` owns `LANG` and `window.setLang`. Changing language dispatches a `7d-lang`
  event; `tour.js` listens for it.
- `projects.js` boots independently of WebGL and publishes `initFlight`/`updateFlight`.
  `scene.js` is dynamically imported only near the footprint; failures leave the hub clocks
  and statistics readable. Buildings are no longer rendered in WebGL.
- Both interfaces use normalized 0–1 scroll progress. Project index is
  `round(p * (n-1))`; numbered controls and narration beats use the same mapping.
- The tour computes its scroll target from a chapter's `target` selector and `scroll`
  fraction in `tour.json`, so "scroll: 0.55 of #projects" means 55% through the flight.
  Chapter audio ids match `tour.json` chapter ids and the MP3 filenames.
- A chapter that names several things in one clip carries `beats`: each beat has a `cue`
  (a phrase from the narration, per language) and a destination (`project` index into the
  flight, or `target` + `scroll`). `tour.js` turns the cue's character position into a time
  within the clip, so the page moves as the words are spoken. `"end"` fires when the clip
  ends. If you edit narration text, keep the cue phrases verbatim inside it.

## Rules for changing this repo

- Narration text and MP3s must stay in sync. If you change any `en`/`ar` string in
  `tour.json`, the matching MP3 is stale: either rerun `node tools/build-voice.mjs --force`
  with a key, or say clearly in the commit that the audio needs regenerating. Never
  ship changed captions over old audio silently. Without an MP3 the tour falls back to
  browser speech synthesis, which sounds worse but stays correct.
- Anything the voice names on screen must be on screen while it is named. Check timing
  against the real MP3 durations (about 10 s English, 13.5 s Arabic for the projects
  chapter), not against guesses.
- Both languages, always. Every visible string lives in `I` or in the content arrays with
  `en` and `ar` keys. Arabic layout is RTL; use logical CSS properties
  (`inset-inline-start`, not `left`).
- The ElevenLabs key never goes in client code or in this repo. Only `api/voice.js` and
  `tools/build-voice.mjs` read it from the environment.
- No build step and no npm dependencies. three.js comes from the import map in
  `index.html`. Keep it that way unless the user asks to introduce tooling.
- Respect `prefers-reduced-motion`: every animation path already checks `REDUCED`.
  New animation must too.
- Vercel serves this from the repo root. `vercel.json` only sets headers.

## Testing a change

There is no automated test. Verify in a browser:

```
python3 -m http.server 8080
```

Then open http://localhost:8080, pick a language, accept the tour, and watch the whole
run. The service worker only registers over HTTPS, so local testing skips it.
Playwright with the pre-installed Chromium can drive this for screenshots.

## Brand

Company site: https://7dint.net. Current design is Riyadh at dusk: near-black `#0A0C10`,
panels `#12171D`, warm ivory `#F4F1EA`, brass `#E0A94A`, sand `#C8AA7C`, and horizon
`#E9B27A`. Teal `#2FA98B` is a secondary accent, not a verified corporate logo colour.
Legacy `--mint` tokens currently alias brass. The published PNG in `assets/brand/logo.png` replaces the placeholder diamond.
The vector logo is still pending; do not trace or invent one.

## Recovery status

The free photo fallback is implemented; the procedural buildings have been deleted.
`DESIGN.md` defines the visual system; `SOURCES.md` records content and asset provenance.
Only four projects with published imagery appear. The globe is the only real-time 3D.
The runtime remains build-free; offline asset tools are allowed per the owner's instruction
to follow the recovery plan. No paid production budget has been approved.
Repository-wide third-party plugin activation is removed. The real published raster logo
is used while the vector awaits delivery. Arabic requires a named client reviewer.
The closing narration text has changed; stale English and Arabic closing clips are excluded
from the audio manifest and must be regenerated after cost approval. Remaining Arabic clips
still use a placeholder voice. See `RECOVERY_STATUS.md` for acceptance gates and evidence.

## Paid generation (Magnific, ElevenLabs, any credit-billed service)

Never start a paid generation without first telling the owner, in one message, exactly
what will be generated, with which model and settings, and the credit or money cost, and
then waiting for an explicit yes. This applies to every image, video, 3D model, texture,
PBR map, upscale, and voice line. Simulating cost is free and always allowed. The owner's
Magnific unlimited tier covers Kling 2.5 at 720p for 5 s only; everything else bills credits.
