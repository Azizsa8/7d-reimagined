# Savannah · PRD Phase 3 — Visual Worlds in Sync with Her Voice

> **Paste this into Google AI Studio → Build only after Phases 1 and 2 pass their acceptance
> criteria.** Keep everything that already works. This phase turns every answer Savannah gives
> into something the visitor *sees* at the moment she says it.

---

## 0. Brief for the builder

In Phases 1–2, Savannah talks and knows 7D International in depth, and her tools already fire
scene events (`show_project`, `show_hubs`, `show_timeline`, `show_person`, `show_disciplines`,
`show_figure`, `show_contact`, `return_to_presence`). Until now those events only showed a
simple card. **Phase 3 replaces the cards with seven cinematic, real-time 3D worlds** rendered
on the same three.js stage, choreographed to her speech. When she says "the Riyadh Eye", the
particles of her presence fly apart and re-form as the Riyadh Eye. When she says "Seoul", a
pillar of light rises in Seoul. When she says "nineteen ninety-three", the year assembles out
of light. The visitor should feel they are inside the story, not watching slides.

The bar: award-level interactive work (think Awwwards Site of the Day, Apple product reveals).
Every world is designed, lit and animated deliberately. No stock imagery, no generic icons, no
templates.

---

## 1. Principles

1. **Voice leads, visuals land on the word.** A world begins its entrance when the tool call
   arrives (which is before the sentence is spoken) and reaches its "hero frame" when the first
   audio of that answer plays. Sub-highlights fire when their name is heard (§3).
2. **Savannah never disappears.** While a world is on screen, her presence shrinks to an
   **ember** — a 64 px particle sphere in the upper corner (upper-right in EN, upper-left in
   AR) — still driven by her voice and state. The visitor always knows who is talking.
3. **One continuous space.** Worlds do not cut. They are places in one scene graph; the camera
   travels between them, and particles carry over from one to the next.
4. **Truth on screen.** Everything shown comes from the knowledge base (Phase 2). Images are
   only the official images listed in it. Names, titles, numbers and dates are rendered exactly
   as stored, in the active language.
5. **Phone first.** Every world is composed for a 9:19.5 portrait frame first, then widened.
   Type sizes, camera distances and particle counts have phone and desktop values.
6. **Calm, not busy.** At most one hero element and one supporting element moving at a time.

---

## 2. The Scene Director

Extend `SceneDirector` from Phase 1.

```ts
type WorldName = 'presence' | 'globe' | 'project' | 'timeline' | 'people'
               | 'disciplines' | 'figure' | 'contact';

interface World {
  name: WorldName;
  enter(params: unknown, from: WorldName, t: TransitionCtx): Promise<void>;
  update(dt: number, audio: AudioBands, voiceState: VoiceState): void;
  cue(key: string): void;          // sub-highlight when an alias is heard
  exit(to: WorldName, t: TransitionCtx): Promise<void>;
  dispose(): void;
}
```

- **Queue, don't stack.** If a new `show_*` arrives while a transition runs, finish the current
  transition fast (×2 speed) and go to the newest target. Drop intermediate targets.
- **Dwell.** A world stays at least 2.5 s even if another call arrives, unless the visitor
  interrupts (barge-in): then transition immediately.
- **Return home.** After Savannah finishes speaking and 8 s of listening pass without a new
  scene, ease back to `presence` (the camera pulls back, the ember grows into the full body).
- **Lazy assets.** Each world's textures and geometry load on first use, with the next likely
  world preloaded (e.g. `project` images for projects mentioned in the last answer).
- **Budget.** Only the active world and the one transitioning out are rendered.

---

## 3. Word-level cueing (the sync layer)

Tools tell us *what* world to show; the **output transcription** tells us *when* each name is
said.

1. The knowledge base gives every entity an `aliases` array in both languages (e.g. Riyadh Eye:
   `["Riyadh Eye", "the Eye", "عين الرياض"]`; Seoul: `["Seoul", "سيول"]`; years as digits and
   as words: `["1993", "nineteen ninety-three", "ألف وتسعمية وثلاثة وتسعين", "١٩٩٣"]`).
2. Build a normalised alias index at load (lowercase, strip Arabic diacritics and tatweel, unify
   `أ إ آ → ا`, `ة → ه`, `ى → ي`, Arabic-Indic digits → ASCII).
3. As output transcription text arrives, append to a rolling buffer and scan the tail for alias
   matches. Map each match to its estimated **playback time** using the Phase 1 playback clock
   (text arrives slightly ahead of audio; schedule the cue for when the audio queued at that
   point starts playing).
4. On cue time, call `director.current().cue(entityId)`.
5. Never cue the same entity twice within 3 s.

---

## 4. The worlds

Each world lists its **hero frame** (what the screen looks like at the moment Savannah starts
talking about it), **build**, **motion**, **cues** and **exit**.

### 4.1 `presence` (from Phase 1, refined)
- Add the **dispersal / gathering** ability: the presence's particle buffer can be re-targeted
  to any point set (image pixels, globe land points, digit outlines). A `uMorph` uniform (0→1)
  blends positions and colours from "sphere" to "target" along curved paths
  (per-particle random arc height and delay 0–350 ms so they don't move as a block).
- This is the signature transition used by `project`, `globe` and `figure`.

### 4.2 `globe` — "Five hubs, five continents"
- **Hero frame:** a dark planet made of ~30,000 land particles (sampled from
  `land-110m` TopoJSON, supplied in `/public/data/land-110m.json`), slow rotation, a thin
  atmospheric rim (fresnel shader, teal at 25 %). Five hubs glow as warm brass points.
- **Build:** presence particles morph into the land points (1.2 s). Ocean is not drawn —
  continents float in black, which reads as premium and keeps the frame clean.
- **Cues:** when a hub is named, the globe rotates (slerp, 1.1 s) to face it; a **pillar of
  light** (additive cylinder, height 0.35, soft top fade) rises from the city; its label types in
  (city in the active language, country below, small). Previous hub dims to 40 %.
- **Routes:** when Savannah talks about the firm's history of expansion, great-circle arcs draw
  between hubs in the order stored in the knowledge base (`hubs[].order`), each arc a tube with a
  travelling light head (0.9 s per arc).
- **Params:** `show_hubs({ focus?: hubId })`.
- **Exit:** land particles lift off the surface and return to the presence sphere.

### 4.3 `project` — "The particles become the place"
- **Hero frame:** the project's official photograph fills the frame as a slightly curved plane
  (like a cinema screen) with a slow push-in (Ken Burns, 1.06 → 1.0 over 9 s), gently lit edges,
  and a title block: project name (large), location, 7D's role (`role_as_stated`), and a
  "Concept design" / "تصميم مفاهيمي" badge when `kind` is `concept`. No project years.
- **Build (signature):** sample the image to a grid (160×90 on phones, 240×135 desktop). The
  presence particles fly to those grid positions and take the pixel colours, forming a pointillist
  version of the photo (0.9 s). Then the real photograph fades in beneath while the particles
  scatter outward as golden dust and fade (0.6 s).
- **Depth:** give the photo parallax on device tilt/pointer using a **fake depth map** computed at
  load: vertical gradient (lower = nearer) blended 30 % with inverted blurred luminance. Displace
  UVs by `depth * tilt * 0.015` in the fragment shader. Subtle — the image must never warp
  visibly.
- **Multiple images:** if the project has several official images, cross-dissolve every 4.5 s
  while she talks, using a noise-threshold dissolve shader (brass edge glow on the dissolve front).
- **Cues:** aliases for facts inside the project (e.g. "fountain", "gardens") pulse the title
  block's accent line; a figure alias (e.g. a height or area stored as a figure) raises a
  small figure chip on the image.
- **No image?** Render a typographic hero instead: the project name set huge in outline type
  behind a slow volumetric light sweep, with city, role and year. Never use a placeholder photo.
- **Params:** `show_project({ id })`.
- **Exit:** the photo dissolves back into particles that return to the presence.

### 4.4 `timeline` — "A river of years"
- **Hero frame:** a luminous ribbon receding into depth from bottom-centre to the horizon
  (a `TubeGeometry` on a gentle S-curve spline, with a flowing shader: bands of light moving away
  from the viewer). Year markers float above the ribbon as glowing rings with the year in Michroma.
- **Build:** the ribbon draws itself from near to far (1.4 s), markers pop in sequentially.
- **Cues:** when a year or milestone is named, the camera glides along the spline to that marker
  (1.2 s, eased), the ring blooms, and a milestone card rises beside it: year, title, one line.
- **Params:** `show_timeline({ year? })`.
- **Exit:** the ribbon rewinds toward the viewer and collapses into the ember.

### 4.5 `people` — "The people behind the work"
- **Hero frame:** a slow constellation of named stars, one per person in the knowledge base
  (leadership and board only — never anyone not published by 7D). Faint lines connect people who
  share a function (board, executive, regional). Each star has a name label and title beneath.
- **Portraits:** only if the person's `portrait_url` file exists in `/kb/img/` (official 7D headshots) for that
  person. Show it as a circular duotone (ivory/brass) inside the star when focused. Otherwise use
  a monogram (initials in Michroma inside a thin brass ring). Never generate or fetch faces.
- **Cues:** when a person is named, camera eases to their star, it brightens, and a card opens:
  name (EN and AR), title, and the one-line bio from the knowledge base.
- **Params:** `show_person({ id })` or `show_people({ group? })`.
- **Exit:** stars drift back into the ember as sparks.

### 4.6 `disciplines` — "Seven instruments"
- **Hero frame:** seven small generative "instruments" orbit the centre on the presence's orbit
  rings. Each is a live shader or particle system that *shows what the discipline is*, not an
  icon. Build these seven, names taken from the knowledge base:
  | Discipline id (knowledge base) | Instrument |
  |---|---|
  | `architecture` — Architecture, Landscape & Waterscape Design | A wireframe massing that assembles floor by floor while a particle fountain rises in front of it, caustic light rippling on the ground plane |
  | `defense` — Defense, Aerospace & Aviation | A radar sweep over a low-poly terrain with a thin flight path arcing overhead, contacts blinking |
  | `finance` — Finance & Banking | Streams of fine particles flowing between nodes of a ledger lattice, settling into balanced columns |
  | `technology` — Technology | A lattice telecom tower emitting concentric signal rings that light up a mesh of base stations |
  | `private-equity` — Private Equity (programme management) | A Gantt-like set of glowing bars in depth that extend, align and lock together |
  | `energy` — Utilities & Alternative Energy | A field of sun-tracking panels rotating toward a moving light, with pulses running along a transmission line |
  | `environment` — Environment, Sorting, Recycling & Bulk Handling | Mixed particles on a conveyor separating by colour into streams, then a fractal branch growing in teal |
  Names and one-line descriptions always come from the knowledge base.
- **Cues:** naming a discipline brings its instrument to centre, scales it ×3, and shows its
  name and one-line description; related projects appear as small chips around it (tap = ask
  Savannah about that project, sent as text into the session).
- **Params:** `show_disciplines({ id? })`.

### 4.7 `figure` — "Numbers made of light"
- **Hero frame:** one number, huge, centre (e.g. `1993`, `$80M`, `1,500+`), built from particles
  that settle into the digit outlines, with a thin label under it ("Founded", "Operations and
  maintenance contract in Saudi Arabia"). Arabic uses Arabic-Indic digits when the language is AR.
- **Build:** presence particles morph into points sampled from the text rendered to an offscreen
  canvas (Michroma for Latin digits, IBM Plex Sans Arabic for Arabic). Counters count up only when
  the number is a count; years assemble, they don't count.
- **Cue:** lands on the spoken number alias.
- **Params:** `show_figure({ id })`.

### 4.8 `contact` — "Talk to the team"
- **Hero frame:** a clean glass card rises in front of a dimmed presence: 7D logo, the official
  contact channels from the knowledge base (email, phone, website, Riyadh office), each as a large
  tappable row (`mailto:`, `tel:`, link). Phase 4 adds the voice-captured enquiry.
- **Params:** `show_contact()`.

---

## 5. Transitions catalogue

| From → To | Transition |
|---|---|
| presence → globe / project / figure | Particle morph (§4.1), camera dolly-in 8 % |
| any world → presence | Reverse morph, camera pull-back, ember grows to body |
| project → project | Noise dissolve between photos, title block slides (logical direction) |
| globe → project | Camera dives toward the project's hub (Riyadh) while land particles morph into the image |
| timeline → figure | The focused year ring expands and its digits become the figure |
| any → people / disciplines / contact | Presence shrinks to ember first (350 ms), then the world fades up with depth-of-field pulling focus |

All transitions: 0.9–1.6 s, `cubic-bezier(.22,1,.36,1)`, interruptible at any frame.

---

## 6. Post-processing and look

- Pipeline: `RenderPass` → `UnrealBloomPass` (per-world strength) → custom **grade pass**
  (lift shadows toward `#0B0D12`, warm highlights toward brass, subtle vignette 0.25, chromatic
  aberration 0.0015 at frame edges only) → `OutputPass` (ACES filmic, sRGB).
- Film grain from Phase 1 stays on top at 4 %.
- Depth of field (bokeh pass) **desktop only**, and only during `people` and `disciplines` focus.
- Per-world exposure is animated during transitions so brightness never jumps.

---

## 7. Sound design (Web Audio, synthesised, no files required)

- **Ambient bed:** two detuned sine pads (root and fifth, ~110 Hz and ~165 Hz) through a slow
  low-pass sweep, at −32 dB. Ducks by 10 dB whenever Savannah's output level rises above a small
  threshold (sidechain from the Phase 1 analyser).
- **World motifs:** each world adds one quiet texture (globe: airy noise band; project: soft
  shimmer; timeline: slow ticking of filtered clicks; figure: a single low "settle" tone as digits
  land).
- **UI:** tap = short filtered click; chip appear = soft glass tone.
- Sound is **off by default** until the first tap, then on at the levels above; a speaker toggle in
  the control bar mutes the bed but never Savannah.
- Keep total non-voice output quiet enough that echo cancellation and voice detection are not
  affected; verify barge-in still works with the bed on.

---

## 8. Performance tiers

Detect once at startup (renderer capabilities, `navigator.hardwareConcurrency`, a 1-second frame
time probe) and pick a tier. Allow override with `?tier=`.

| Setting | Low (older phones) | Mid (most phones) | High (desktop, flagship) |
|---|---|---|---|
| Device pixel ratio cap | 1.25 | 1.75 | 2 |
| Presence particles | 12k | 24k | 40k |
| Globe land particles | 12k | 20k | 30k |
| Image particle grid | 120×68 | 160×90 | 240×135 |
| Bloom | half-res | half-res | full-res |
| DOF, chromatic aberration | off | off | on |

- If the rolling average frame time exceeds 22 ms for 3 s, step down one tier live.
- Render loop pauses on `visibilitychange` hidden; the voice session keeps running.

---

## 9. Acceptance criteria

1. Asking "What did 7D build in Riyadh?" shows the `project` world with the correct official
   photo within 1.2 s of the answer starting, and the pointillist morph plays.
2. Asking about the hubs shows the globe; each named city's pillar rises within ±400 ms of the
   city being heard, in both languages.
3. Asking about the history shows the timeline and the camera reaches the named year as it is
   spoken.
4. Asking about leadership shows only people present in the knowledge base, with names and titles
   exactly as stored; no generated faces.
5. A named figure assembles out of particles and lands on the spoken number.
6. Interrupting Savannah mid-transition returns control to listening immediately without visual
   glitches.
7. The ember is always visible while any world is shown and reacts to her voice.
8. Arabic mode mirrors layouts, uses Arabic names and Arabic-Indic digits, and cues on Arabic
   aliases.
9. Mid-tier phone holds ≥ 50 fps in every world; auto-downgrade works.
10. With sound on, barge-in still works reliably.
