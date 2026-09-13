# Action plan for ASTRA — rescue and elevate the 7D International site

Owner: Aziz (AISERS Systems). Client: 7D International. Live: https://7d-reimagined.vercel.app
Repo: https://github.com/Azizsa8/7d-reimagined (branch `master` is production; PR #1 open).

**Situation.** The client is on the verge of pulling out. The main reason is the 3D:
the project scenes and the globe look amateur next to 7D's own renders. This document
is a complete, ordered plan. Read all of it before touching code.

---

## 0. Ground truth — why the current 3D fails

Do not repeat the approach that produced it. Every scene in `scene.js` is procedural
three.js: boxes, cylinders, tori and cones typed as code, flat-colour materials, no
textures, no baked lighting, no authored geometry. That method has a fidelity ceiling
far below what an architecture client accepts, and no amount of tuning lifts it.

Specific failures visible in the owner's screenshots (fix every one or remove the element):

| Scene | What is wrong |
|---|---|
| **Globe** | Atmosphere is a thick blue ring that fights the brass palette. Points bunch into a moiré band at the limb. A dotted artefact runs along the equator. Hub beams stick out of the sphere as bare lines and cross the heading. The globe is so large it crops under the heading and the stats panel. Warm brown cast on the lower hemisphere. Coastline double-draws. |
| **King Abdullah Park Fountain** | City is untextured brown boxes. Palms are cone fronds (toy-like). Lake is a flat grey disc. Jets read as vertical rain, not arcing water. The pergola is an orange plank. The ground is a bare tan slab. Harsh cast shadows with no ambient occlusion. Reads as a 2005 game. |
| **King Abdullah International Gardens** | Crescents read as a glossy inflatable donut; no ETFE quilting, no ribs, no stone base. Tower is a plastic lathe. Rocks are dodecahedra. Planting is sparse toy palms. Masterplan rings are flat colour bands. Background city is black boxes. |
| **Riyadh Eye, Riyadh 2020, DSS, HQ** | Same class of problem. The DSS and HQ buildings are not even real: 7D publishes no image of them. |

**Rule for this plan:** real-time procedural geometry is retired for buildings. Buildings
come from authored assets or offline renders. Real-time 3D survives only where it is
genuinely better than video (the globe).

---

## 1. Hard constraints (from `CLAUDE.md` — obey them)

- **Paid generation needs explicit owner approval first.** Before any paid image, video,
  3D model, texture, upscale or voice job: tell the owner in one message what, which
  model/service and settings, and the cost; wait for a yes. Simulating cost is free.
- The ElevenLabs key never goes in client code or the repo. `api/voice.js` and
  `tools/build-voice.mjs` read it from the environment only.
- Both languages always (English and Saudi Arabic, RTL, logical CSS properties).
- Respect `prefers-reduced-motion` on every animation path.
- Narration text and MP3s stay in sync; re-render or say so in the commit.
- **Decision the owner must make now:** the repo has "no build step, no npm". The asset
  pipeline in §3 needs offline tools (Blender, ffmpeg, gltf-transform, KTX2 encoding).
  Those run *offline* and commit only their outputs, so the site itself can stay
  build-free. Confirm this with the owner rather than assuming.

---

## 2. Decision gate (get answers before phase B)

Put these to the owner in one message:

1. **3D route** (§3). Recommended: **Route 1 — pre-rendered cinematic scroll**, with Route 2
   for any scene that must stay interactive.
2. **Budget and approval** for: Blender artist time or AI 3D generation credits, render
   compute, and the ElevenLabs paid tier (the free tier refuses the Saudi voice).
3. **Source material from 7D**: photographs of the Department of Social Services and the
   Riyadh HQ (or permission to drop those two scenes), the vector logo, project facts.
4. **Deadline** for the recovery demo to the client.

---

## 3. The 3D — routes, ranked

### Route 1 — Pre-rendered cinematic scroll (RECOMMENDED for the recovery demo)

The same technique premium product pages use: render the camera flight offline at
film quality, then scrub it with scroll.

- Model each project in **Blender** (or Unreal) from 7D's own renders and photos in `ref/`:
  `kapf-4.jpeg` (fountain, night photo), `kaig-main-photo.jpeg` (gardens render),
  `riyadh-eye-main-photo.jpeg` (wheel render), `riyadh2020-main-photo.jpeg` (Riyadh 2020 renders).
- Materials: real PBR sets (limestone ashlar, sand, granite paving, ETFE, brushed steel,
  water). Use Poly Haven / ambientCG CC0 materials first (free), generated tiles only with approval.
- Vegetation: proper date-palm assets (CC0 or purchased with approval), not generated cones.
- Water: Blender fluid or animated shader with real reflection; fountain jets as
  particle sims with motion blur, RGB-lit to match the photo.
- Lighting: Riyadh dusk HDRI + sun; render in **Cycles**, denoised, with AO, volumetric haze
  and depth of field.
- Output per scene: an image sequence (e.g. 1920×1080 and 1080×1920 portrait), encoded to
  AVIF/WebP frames or an H.264/VP9 video with a keyframe every frame for clean scrubbing.
- Web: replace the `#flight` canvas with a scroll-scrubbed `<canvas>` drawing frames (or a
  `<video>` whose `currentTime` follows scroll). Preload progressively; show a poster frame
  instantly. Keep scene cards and tour beats working against the same 0..1 progress.
- Budget: aim ≤ 25 MB per scene on desktop, ≤ 10 MB mobile, lazy-loaded per scene.

Why: guaranteed look, matches 7D's own render quality, works on weak phones, fastest route
to something the client respects.

### Route 2 — Authored real-time assets (for interactivity)

- Blender models → **glTF 2.0 (.glb)**, Draco or Meshopt geometry compression,
  **KTX2/Basis** textures, **baked lightmaps and AO** (the single biggest realism gain).
- Load with `GLTFLoader` + `DRACOLoader`/`MeshoptDecoder` + `KTX2Loader` from the same
  pinned three.js r165 via the import map.
- Post: keep `EffectComposer`; add SSAO/GTAO, tuned bloom (threshold ≥ 0.85), SMAA, subtle
  film grain and vignette. Physically correct exposure against the HDRI.
- Budget: ≤ 150k triangles per visible scene, ≤ 8 MB per scene download, 60 fps on a
  mid-range laptop, 30 fps on a 2022 mid-range Android.

### Route 3 — AI-generated base meshes (accelerator, not final)

Image-to-3D services can produce base meshes from 7D's renders quickly. Treat output as a
blockout: retopologise, UV, re-texture and bake in Blender before shipping. **Paid — owner
approval required per job.**

### Route 4 — Emergency fallback (within 24 h, zero cost)

If the client meeting is imminent: hide the procedural flight entirely and show 7D's real
renders and photos as full-bleed scenes with a slow parallax / depth-map "2.5D" push-in and
the same scene cards. Real images beat bad 3D every time. Ship this first if time is short,
then replace with Route 1.

### What to do with each scene

| Scene | Source | Action |
|---|---|---|
| Fountain | 7D night photo | Route 1. Match the photo: oval lake, nozzle rings + spiral, RGB plumes, corniche railing with flower pots, lit park, low city beyond. |
| Gardens | 7D render | Route 1. Quilted ETFE crescents, stone plinth, observation tower with flared base and disc head, planted wadi. |
| Riyadh Eye | 7D render | Route 1. Close hero framing of the lit rim, cable lattice, glazed capsules, city lights below. |
| Riyadh 2020 | 7D renders (organic shells, masterplan) | Route 1. Model the render's buildings, not a generic skyline. |
| Social Services | **None** | Remove, or wait for 7D photos. Do not invent a building. |
| Middle East HQ | **None** | Remove, or wait for 7D photos. Do not invent a building. |

---

## 4. The globe — keep real-time, rebuild properly

The globe is the one place real-time is right. Rebuild in `scene.js` `initGlobe`:

- **Earth read:** replace the scattered point cloud with a clean, even **hexagonal dot
  grid** on land (sample on an icosphere, not Fibonacci + equirectangular, to kill the limb
  moiré and the equator artefact). Uniform dot size in screen space.
- **Palette:** brass dots on a near-black sphere; atmosphere as a *thin* warm-neutral
  fresnel rim, not a thick blue ring. Remove the brown lower-hemisphere cast.
- **Hubs:** small glowing discs with a soft pulse; no protruding beams. Labels as HTML
  overlays projected from 3D positions (crisp text, both languages).
- **Routes:** smooth great-circle arcs with a travelling light pulse; draw in chronology order.
- **Composition:** globe sized so heading, stats and clocks never overlap it; offset it to one
  side on desktop; on mobile, place it below the heading.
- Optional: night-lights city texture (CC0 NASA Black Marble) blended faintly on land.

---

## 5. All other fronts

### 5.1 Merge and fix what already exists (do first, 1–2 h)

PR #1 (branch `claude/gracious-dirac-o13109`) contains a **real production bug fix**: the
per-frame loop in `index.html` read bare `flight`/`globe`, threw on frame one and died, so
scenes only animated on scroll. Merge it, but first fix in the branch:

- The ground-texture poll in `scene.js` (`big()`) retries every 400 ms forever when
  `assets/tex/` is empty. Stop after the load attempt resolves.
- Six 404 requests per visit for missing texture files. Only request sets that exist
  (a manifest), or remove until assets land.
- `.gitignore` change stops ignoring `.claude/`: re-add `.claude/skills/` and `.claude/launch.json`.
- `.claude/settings.json` enables nine third-party plugins for everyone who opens the
  repo. Owner decides; do not keep silently.
- `CLAUDE.md` brand section is stale (says mint/black; site is brass Riyadh-dusk).

### 5.2 Visual design system

- Commit a written design system (`DESIGN.md`): palette tokens, type scale, spacing,
  motion curves, component rules.
- Typography: keep one display face with character for headings, a high-quality text face,
  a dedicated Arabic face (not a fallback). Consistent scale; no clipped or overlapping headings
  (the globe heading currently collides with the render).
- Replace the placeholder diamond with 7D's real vector logo once supplied. Never present
  the diamond as their logo.
- Section transitions: keep the seams, but verify every section boundary on real devices.

### 5.3 Content and truth

- Every claim must come from 7D's published material or the client. No invented figures.
- Replace the stock villa image problem: 7D's own DSS page shows an unrelated Florida
  villa. Tell the owner; do not reuse it.
- Arabic copy needs review by a named person at 7D Riyadh before public launch.

### 5.4 Voice guide (Noorah)

- The ElevenLabs account is free tier; library voices (the Saudi female "Noorah",
  `ckaeRWMtCV0u0pUT3wX1`) return 402. Current Arabic narration uses an English premade voice
  and is a placeholder.
- With owner approval of the paid tier: `node tools/build-voice.mjs --force` regenerates
  all clips. No code change.
- Keep narration pre-rendered. Live answers only through `api/voice.js`.
- Tour must stay in sync with the new scroll-scrubbed scenes (§3 Route 1): beats in
  `data/tour.json` map to scene progress, not to the retired flight.

### 5.5 Discipline cards (`viz.js`)

The seven canvas scenes work, but review them against the new render quality. If they now
look cheap beside real renders, replace each with a short authored loop (Blender or
motion-design render, 4–6 s, seamless, ≤ 1.5 MB WebM/MP4 + poster) — with owner approval
for any paid tooling.

### 5.6 Performance

- Targets: LCP < 2.5 s on 4G mid-range Android; no main-thread task > 200 ms during scroll;
  total first load < 1.5 MB before any scene assets.
- Lazy-load every scene's assets by proximity. Poster frames first.
- Profile on a real low-end Android before calling anything done.

### 5.7 Accessibility and motion

- AA contrast everywhere; visible focus; keyboard-operable tour (space/escape already exist).
- Reduced motion: static poster frames instead of scrubbing; tour moves by cuts, not scrolls.
- Captions for all narration (already present) in both languages.

### 5.8 SEO, sharing, analytics

- Titles/descriptions per language, `hreflang`, sitemap, Organization + Project JSON-LD,
  Open Graph/Twitter cards with a real render as the share image.
- Privacy-respecting analytics (owner chooses the tool).

### 5.9 Enquiry path

- WhatsApp Business link and a contact form that actually delivers (owner supplies inbox and
  number). Nothing on the site may promise a response time the firm has not agreed.

---

## 6. Order of work

| Step | Work | Output | Gate |
|---|---|---|---|
| A | Merge PR #1 with the §5.1 fixes | Loop bug fixed on production | none |
| B | Decision gate §2 | Owner answers in writing | **owner** |
| C | If client meeting ≤ 48 h: Route 4 fallback | Real renders replace bad 3D | none (free) |
| D | Globe rebuild §4 | New globe live | visual QA |
| E | Route 1 for fountain, gardens, Riyadh Eye, Riyadh 2020 | 4 cinematic scenes | **owner approval of cost** |
| F | Remove or replace DSS and HQ | No invented buildings | 7D material |
| G | Tour resync + paid voice regeneration | Saudi voice, beats on new scenes | **owner approval of cost** |
| H | Design system, logo, typography, content pass | `DESIGN.md`, real logo | 7D assets |
| I | Performance, accessibility, SEO, enquiry path | Targets met | QA |
| J | Full QA and handover | Evidence pack | owner sign-off |

---

## 7. Definition of done — every item needs evidence

- Screenshots at 1440×900 and 390×844 of **every** section, in **both** languages, attached
  to the PR. Scenes compared side by side with 7D's reference image for that project.
- A screen recording of the full English and Arabic tour.
- Console clean: no errors, no 404s, no unhandled promise rejections.
- Lighthouse (mobile) and a real-device test on a mid-range Android, numbers recorded.
- No invented facts; every figure traceable to 7D's site or the client.
- Paid work: the owner's written approval quoted in the PR, with the cost.
- `CLAUDE.md` updated to describe the new architecture.

## 8. Do not

- Do not ship more procedural box-and-cylinder buildings, however tuned.
- Do not start any paid generation without the owner's explicit yes on what, which model,
  and cost.
- Do not put any API key in client code or commit it.
- Do not invent the DSS or HQ buildings, client names, figures or dates.
- Do not present unreviewed Arabic as final.
- Do not claim something works without the evidence in §7.
