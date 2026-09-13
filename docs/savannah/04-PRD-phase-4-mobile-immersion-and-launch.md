# Savannah · PRD Phase 4 — Mobile Immersion, Enquiries and Launch

> **Paste into Google AI Studio → Build only after Phases 1–3 pass.** Keep everything working.
> This phase makes Savannah feel native on a phone, lets a visitor leave an enquiry by voice,
> protects cost and privacy, and prepares the public launch.

---

## 0. Brief for the builder

Savannah now talks, knows 7D International and shows cinematic worlds in sync with her voice.
Phase 4 turns the prototype into something a 7D executive can hand to a client on their phone
and trust: it opens like an app, holds the screen, responds to the hand and the body of the
device, survives bad networks, captures a real enquiry, costs a predictable amount, respects
privacy, and is accessible.

---

## 1. Phone immersion

### 1.1 App-like shell
- **Installable web app:** `manifest.webmanifest` (name "Savannah · 7D International",
  short name "Savannah", `display: fullscreen`, `orientation: portrait`, background and theme
  `#050608`, icons from the 7D logo on night ground at 192/512 px, maskable).
- **Full screen on first tap** (Fullscreen API where supported; iOS falls back to standalone
  when installed). Offer "Add to Home Screen" once, after the first completed conversation,
  as a quiet card — never on arrival.
- **Screen Wake Lock** while a session is active; release on end or when hidden.
- **Safe areas:** every edge element uses `env(safe-area-inset-*)`. The control bar sits above the
  home indicator.
- **No scroll, no bounce, no zoom:** `overscroll-behavior: none`, `touch-action: manipulation`,
  viewport `100dvh`.
- **Theme colour** and status bar blend into the night ground.

### 1.2 The body of the phone
- **Tilt parallax** (DeviceOrientation, with the iOS permission request folded into the first tap):
  presence and worlds shift ±3° with smoothing; disabled under reduced motion.
- **Haptics** (`navigator.vibrate` where supported): 8 ms tick when Savannah starts speaking,
  12 ms double tick when a world lands, 20 ms when an enquiry is confirmed. Never during speech
  continuously. Off under reduced motion.
- **Gestures:**
  - **Tap anywhere on the stage** while she speaks = interrupt (same as barge-in) and listen.
  - **Long-press the presence** = push-to-talk mode for noisy places (mic streams only while held;
    uses manual activity signals `activityStart` / `activityEnd`).
  - **Swipe down** on a world = return to presence.
  - **Swipe left/right** on a project = next/previous project (sends a text turn so Savannah
    narrates it).
- **Earpiece/headphones:** detect `devicechange`; when headphones connect, raise voice detection
  sensitivity and enable the ambient bed at +3 dB (no echo risk).
- **Noisy environment helper:** if the mic level stays high without recognised speech for 8 s,
  Savannah suggests holding the presence to talk.

### 1.3 Resilience on mobile networks
- Show connection quality as the presence's colour temperature, never as a spinner.
- Keep the session through brief backgrounding (app switch < 30 s): pause mic, keep socket, resume.
  Longer: close gracefully and offer "Continue" which reconnects with session resumption.
- Preload the next likely world's assets only on Wi-Fi or when `navigator.connection.saveData` is
  false.

---

## 2. Voice enquiries — "Leave a message for the team"

### 2.1 Flow
1. Visitor says something like "I want to talk to someone about a project" /
   "أبغى أتواصل مع الفريق بخصوص مشروع".
2. Savannah asks, one question per turn, only what's needed: name, organisation, country, what
   it's about (one or two sentences), and the best way to reach them (email or phone).
3. She calls `capture_enquiry(draft)` after each answer; the screen shows a glass **enquiry card**
   filling in live as she hears each detail (fields type in as captions do).
4. She reads back a short summary and asks the visitor to confirm **on screen**. Email and phone
   must be **typed or corrected by the visitor** on the card — spoken emails are unreliable, so the
   card shows an editable field pre-filled with what was heard.
5. The visitor taps **Send to 7D**. Only then does the client call `POST /api/enquiry`.
6. Savannah confirms in one sentence that the message was sent to the team (only after the
   server returns success) and returns to the conversation.

### 2.2 Tool

```ts
capture_enquiry({
  name?: string; organisation?: string; country?: string;
  topic?: string; email?: string; phone?: string; language: 'en' | 'ar';
}) → { card_state: 'updated', missing: string[] }
```

- The model never sends the enquiry. Sending is a visitor tap.
- If the server fails, Savannah says the message could not be sent and offers the official
  email and phone from the knowledge base.

### 2.3 Server
- `POST /api/enquiry` validates (zod), rate-limits (3 per IP per hour), and delivers to the
  destination configured in environment variables (`ENQUIRY_TO`, plus provider credentials such as
  a transactional email API key). No destination configured = endpoint returns 503 and the UI
  offers the official email/phone instead.
- Include in the email: the fields, the language, a 6-turn transcript excerpt of the enquiry part
  only, timestamp, and a note that it was collected by Savannah.
- Store nothing else server-side.

---

## 3. Accessibility

- **Captions on by default**; size toggle (M/L/XL).
- **Transcript drawer** (swipe up on the control bar): full conversation text in the active language,
  selectable, with a "Copy" action.
- **Type instead** (accessibility fallback, keyboard icon in the drawer): a single input that sends
  text into the live session. Savannah still answers by voice and captions. Not promoted in the main
  UI — Savannah remains a voice experience.
- **Screen readers:** the stage canvas is `aria-hidden`; an `aria-live="polite"` region mirrors
  Savannah's captions; world changes announce a short label ("Showing: Riyadh Eye").
- **Keyboard (desktop):** Space = push-to-talk hold, Esc = interrupt / return to presence,
  L = language, M = mute.
- Contrast ≥ 4.5:1 for all text over imagery (darken image behind text with a gradient scrim).
- `prefers-reduced-motion`: no morphs (cross-fades instead), no parallax, no camera travel beyond
  cuts with 300 ms fades, no haptics.

---

## 4. Cost and abuse controls

| Control | Value (config) |
|---|---|
| Ephemeral token lifetime | 1 min to start, session locked to model + instruction + voice |
| Token minting rate limit | 6 per IP per 10 min, 60 per IP per day |
| Session audio cap | 12 min, with Savannah warning at 11 min |
| Idle timeout | 90 s ask, +30 s close |
| Context window compression | on, sliding window |
| Daily spend guard | server counts minted sessions; above `DAILY_SESSION_CAP` it returns a friendly "Savannah is resting" screen with official contacts |
| Bot protection | token endpoint requires a signed, short-lived page nonce issued with the HTML |

- Log only: session start/end time, language, duration, number of turns, worlds shown, tool calls
  (names only), errors. **Never store audio or full transcripts** except the enquiry excerpt the visitor
  chose to send.
- A one-line privacy note on the arrival screen: "Your voice is processed live to answer you and is
  not recorded by 7D." / "صوتك يُعالج مباشرة للرد عليك، وسفن دي ما تسجله." Link to a short privacy page.
  Mention that the service uses Google's Gemini API.

---

## 5. Analytics (privacy-preserving)

- Events: `arrive`, `tap_start`, `lang_selected`, `mic_granted|denied`, `first_audio_ms`,
  `turn`, `interrupt`, `world_shown{name,id}`, `chip_tapped{id}`, `enquiry_started`,
  `enquiry_sent`, `session_end{duration,turns}`, `error{code}`.
- Aggregate dashboard (simple server route, password-protected via env): sessions per day, language
  split, median first-audio latency, top questions **by topic id** (from `lookup_7d` topics, not raw
  text), top worlds, enquiry conversion.

---

## 6. Launch checklist

- [ ] Arabic listening test with at least two native Saudi reviewers (script in the README),
      average naturalness ≥ 4/5, zero dialect slips in 20 turns.
- [ ] English listening test, ≥ 4.5/5.
- [ ] 7D approves every fact in the knowledge base (`approved: true` on each record) — unapproved
      records are excluded at build time.
- [ ] Legal names, titles and any portraits confirmed by 7D for public display.
- [ ] Enquiry destination tested end-to-end with 7D's chosen inbox.
- [ ] Devices: iPhone (last 3 generations, Safari), Samsung Galaxy A-series and S-series
      (Chrome), a Pixel, iPad, desktop Chrome/Safari/Edge.
- [ ] Networks: Wi-Fi, 4G, throttled 3G profile, a 10-second drop mid-answer.
- [ ] Latency: median first audio ≤ 900 ms on 4G.
- [ ] Performance: ≥ 50 fps mid-tier in every world, no memory growth over a 12-minute session.
- [ ] Accessibility: VoiceOver and TalkBack pass on arrival, captions, controls, enquiry card.
- [ ] Custom address configured (e.g. `savannah.7dint.net` via Cloud Run domain mapping, or the
      AI Studio `*.ai.studio` address for the pilot).
- [ ] Open Graph image and title for link previews.
- [ ] Budget alerts set in Google Cloud billing.

---

## 7. Acceptance criteria

1. Installed to the home screen, Savannah opens full-screen with no browser chrome and no scroll.
2. Tapping the stage while she speaks interrupts her instantly; long-press push-to-talk works in a
   noisy room.
3. A visitor can leave a complete enquiry by voice, correct their email on the card, tap Send, and
   the configured inbox receives it; Savannah confirms only after success.
4. With the endpoint unconfigured, the UI offers the official contacts and never claims a message
   was sent.
5. Token endpoint refuses requests without a valid page nonce and enforces the rate limits.
6. No audio or transcript is persisted apart from the enquiry the visitor sent.
7. The transcript drawer, type-instead input and screen-reader captions work in both languages.
8. Reduced-motion mode is complete and calm.
9. All launch checklist items are ticked.
