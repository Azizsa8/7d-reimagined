/* 7D International — the arrival and the guided tour.
 *
 * The site opens with a title sequence and a language choice. That choice is the
 * user gesture browsers require before audio may play, so the narration can begin
 * the moment it is made.
 *
 * The tour drives the page itself: Noorah speaks, the document scrolls under her,
 * and the visitor can interrupt by touching anywhere. Narration is pre-rendered to
 * static MP3s (see tools/build-voice.mjs), so no API key ships to the browser and a
 * live demo never waits on a network round trip. If an audio file is missing the
 * tour falls back to the browser's own speech synthesis, and if that is absent too
 * it still runs on timings with captions.
 */

const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

let TOUR = null, manifest = null;
const state = {
  lang: 'en', running: false, paused: false, i: 0,
  audio: null, raf: 0, beatRaf: 0, scrollFrom: 0, scrollTo: 0, scrollT0: 0, scrollDur: 0, waiting: null
};

/* ---------- markup ---------- */
function mount() {
  const gate = document.createElement('div');
  gate.className = 'gate'; gate.id = 'gate';
  gate.innerHTML = `
    <div class="gate-bg"></div>
    <div class="gate-in">
      <svg class="gate-mark" viewBox="0 0 120 120" aria-hidden="true">
        <path d="M60 8 L112 60 L60 112 L8 60 Z" fill="none" stroke="currentColor" stroke-width="3"/>
        <path d="M60 30 L90 60 L60 90 L30 60 Z" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".55"/>
      </svg>
      <p class="gate-kicker">Global Contracting &amp; Consulting · Riyadh</p>
      <h1 class="gate-title"><span>7D</span> <em>International</em></h1>
      <p class="gate-sub">Choose a language and Noorah will show you the firm.<br><span dir="rtl">اختر لغتك وتعرض لك نورة الشركة.</span></p>
      <div class="gate-choice">
        <button class="gate-btn" data-lang="ar" dir="rtl"><b>العربية</b><small>بصوت نورة</small></button>
        <button class="gate-btn" data-lang="en"><b>English</b><small>narrated by Noorah</small></button>
      </div>
      <button class="gate-skip" data-lang="skip">Skip the introduction</button>
    </div>`;
  document.body.appendChild(gate);

  const hud = document.createElement('div');
  hud.className = 'tour'; hud.id = 'tourHud';
  hud.innerHTML = `
    <div class="tour-bar"><i id="tourFill"></i></div>
    <div class="tour-body">
      <div class="tour-who"><span class="tour-orb" id="tourOrb"></span><b id="tourName">Noorah</b><em id="tourStep"></em></div>
      <p class="tour-cap" id="tourCap"></p>
    </div>
    <div class="tour-ctl">
      <button id="tourToggle" class="tour-btn" aria-label="Pause"><svg viewBox="0 0 24 24"><rect x="7" y="5" width="3.5" height="14" rx="1"/><rect x="13.5" y="5" width="3.5" height="14" rx="1"/></svg><span>Pause</span></button>
      <button id="tourEnd" class="tour-btn ghost">End tour</button>
    </div>`;
  document.body.appendChild(hud);

  const veil = document.createElement('div');
  veil.className = 'tour-veil'; veil.id = 'tourVeil';
  veil.innerHTML = `<button class="tour-resume" id="tourResume"><svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg><span></span></button>`;
  document.body.appendChild(veil);
}

/* ---------- speech ---------- */
/* Resolves when the line has finished. `ready` resolves earlier, with the clip length
   in ms once the browser knows it (0 when it never will: synthesis or a missing file). */
function speak(id, text) {
  let readyResolve; const ready = new Promise(r => { readyResolve = r; });
  const done = new Promise(resolve => {
    const src = manifest?.lines?.[state.lang]?.[id];
    const finish = () => { state.audio = null; resolve(); };
    const fallback = () => { state.audio = null; readyResolve(0); synth(text).then(resolve); };
    if (src) {
      const a = new Audio(src);
      a.preload = 'auto';
      state.audio = a;
      const report = () => readyResolve(isFinite(a.duration) && a.duration ? a.duration * 1000 : 0);
      a.addEventListener('loadedmetadata', report, {once: true});
      a.addEventListener('ended', finish, {once: true});
      a.addEventListener('error', fallback, {once: true});
      a.play().catch(fallback);
      setTimeout(report, 1500);                      // never wait forever on metadata
      return;
    }
    fallback();
  });
  return {done, ready};
}
function synth(text) {
  return new Promise(resolve => {
    if (!('speechSynthesis' in window)) { setTimeout(resolve, Math.max(2500, text.length * 55)); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = state.lang === 'ar' ? 'ar-SA' : 'en-GB';
    u.rate = state.lang === 'ar' ? .95 : 1;
    const vs = speechSynthesis.getVoices();
    const pick = vs.find(v => v.lang === u.lang && /female|woman|noura|salma|zariyah|hoda/i.test(v.name))
              || vs.find(v => v.lang === u.lang)
              || vs.find(v => v.lang.startsWith(state.lang));
    if (pick) u.voice = pick;
    u.onend = resolve; u.onerror = resolve;
    speechSynthesis.speak(u);
    state.audio = {pause: () => speechSynthesis.pause(), play: () => speechSynthesis.resume(), _synth: true};
  });
}
/* ---------- scrolling the document as if it were footage ---------- */
function targetY(ch) {
  if (ch.project != null) {
    const f = $('#flight'); if (!f) return scrollY;
    const n = (window.PROJECTS || []).length || 6;
    const top = f.getBoundingClientRect().top + scrollY;
    return top + (f.offsetHeight - innerHeight) * clamp(ch.project / (n - 1), 0, 1) + 2;
  }
  const el = $(ch.target); if (!el) return scrollY;
  const top = el.getBoundingClientRect().top + scrollY;
  const range = el.offsetHeight - innerHeight;
  if (range > 40 && ch.scroll != null) return top + range * ch.scroll;
  return Math.max(0, top - 70);
}
function driveScroll(to, dur) {
  state.scrollFrom = scrollY; state.scrollTo = to;
  state.scrollDur = Math.max(600, dur); state.scrollT0 = performance.now();
  cancelAnimationFrame(state.raf);
  const step = () => {
    if (state.paused || !state.running) return;
    const t = clamp((performance.now() - state.scrollT0) / state.scrollDur, 0, 1);
    scrollTo(0, state.scrollFrom + (state.scrollTo - state.scrollFrom) * easeInOut(t));
    if (t < 1) state.raf = requestAnimationFrame(step);
  };
  state.raf = requestAnimationFrame(step);
}

/* ---------- the tour itself ---------- */
function setCaption(ch) {
  $('#tourCap').textContent = ch[state.lang];
  $('#tourStep').textContent = `${state.i + 1} / ${TOUR.chapters.length}`;
  $('#tourFill').style.width = ((state.i) / TOUR.chapters.length * 100) + '%';
}
/* A chapter may name several things in one breath. Its `beats` say where the page
   should be when each one is said: a `cue` is a phrase from the narration, and its
   position in the text, as a fraction of the clip length, is when it is spoken.
   `"end"` fires as the line finishes, so the hold can carry the visitor further. */
const BEAT_LEAD = 550, BEAT_MOVE = 1100;
function planBeats(ch, dur) {
  const text = ch[state.lang] || '';
  return ch.beats.map(b => {
    let at;
    if (b.cue === 'end') at = dur;
    else {
      const cue = typeof b.cue === 'string' ? b.cue : b.cue?.[state.lang];
      const i = cue ? text.indexOf(cue) : -1;
      at = i < 0 ? 0 : (i / text.length) * dur;
    }
    return {at: Math.max(0, at - BEAT_LEAD), y: targetY(b)};
  }).sort((a, b) => a.at - b.at);
}
function runBeats(plan, dur) {
  const started = performance.now();
  let next = 0;
  cancelAnimationFrame(state.beatRaf);
  const elapsed = () => {
    const a = state.audio;
    return (a && !a._synth && isFinite(a.currentTime)) ? a.currentTime * 1000 : performance.now() - started;
  };
  const step = () => {
    if (!state.running) return;
    if (!state.paused) {
      const e = elapsed();
      while (next < plan.length && e >= plan[next].at) {
        if (REDUCED) scrollTo(0, plan[next].y); else driveScroll(plan[next].y, BEAT_MOVE);
        next++;
      }
    }
    if (next < plan.length) state.beatRaf = requestAnimationFrame(step);
  };
  state.beatRaf = requestAnimationFrame(step);
}
async function runChapter() {
  if (!state.running) return;
  const ch = TOUR.chapters[state.i];
  if (!ch) return endTour(true);
  setCaption(ch);
  $('#tourOrb').classList.add('talking');

  const {done, ready} = speak(ch.id, ch[state.lang]);
  const dur = await ready;
  if (!state.running) return;
  if (ch.beats?.length) runBeats(planBeats(ch, dur || 5200 * 2), dur);
  else if (!REDUCED) driveScroll(targetY(ch), (dur || 5200) * .92);
  else scrollTo(0, targetY(ch));

  await done;
  $('#tourOrb').classList.remove('talking');
  if (!state.running) return;
  await wait((ch.hold ?? .45) * 1000);
  if (!state.running) return;
  cancelAnimationFrame(state.beatRaf);
  state.i++;
  runChapter();
}
function wait(ms) {
  return new Promise(resolve => {
    if (state.paused) { state.waiting = () => wait(ms).then(resolve); return; }
    const t = setTimeout(resolve, ms);
    state.waiting = null;
    state._clearWait = () => clearTimeout(t);
  });
}
export function startTour() {
  if (state.running) return;
  state.running = true; state.paused = false; state.i = 0;
  document.body.classList.add('touring');
  $('#tourName').textContent = TOUR.persona.name[state.lang];
  $('#tourHud').classList.add('on');
  runChapter();
}
function pauseTour() {
  if (!state.running || state.paused) return;
  state.paused = true;
  cancelAnimationFrame(state.raf);
  state._clearWait?.();
  if (state.audio) { try { state.audio.pause(); } catch {} }
  $('#tourOrb').classList.remove('talking');
  document.body.classList.add('tour-paused');
  const r = $('#tourResume span');
  r.textContent = TOUR.ui.resume[state.lang];
  $('#tourToggle').querySelector('span').textContent = state.lang === 'ar' ? 'متابعة' : 'Resume';
}
function resumeTour() {
  if (!state.running || !state.paused) return;
  state.paused = false;
  document.body.classList.remove('tour-paused');
  $('#tourToggle').querySelector('span').textContent = state.lang === 'ar' ? 'إيقاف' : 'Pause';
  if (state.audio) { try { state.audio.play(); $('#tourOrb').classList.add('talking'); } catch {} }
  // resume the scroll from wherever the visitor left it
  const elapsed = clamp((performance.now() - state.scrollT0) / state.scrollDur, 0, 1);
  if (elapsed < 1) driveScroll(state.scrollTo, state.scrollDur * (1 - elapsed));
  if (state.waiting) { const w = state.waiting; state.waiting = null; w(); }
}
export function endTour(finished) {
  if (!state.running) return;
  state.running = false; state.paused = false;
  cancelAnimationFrame(state.raf); cancelAnimationFrame(state.beatRaf);
  state._clearWait?.();
  if (state.audio) { try { state.audio.pause(); } catch {} }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  document.body.classList.remove('touring', 'tour-paused');
  $('#tourHud').classList.remove('on');
  if (finished) {
    $('#fab')?.classList.add('nudge');
    setTimeout(() => $('#fab')?.classList.remove('nudge'), 6000);
  }
}

/* ---------- arrival ---------- */
function openGate() {
  const g = $('#gate');
  const seen = sessionStorage.getItem('7d_gate') === '1';
  if (seen) { g.remove(); return; }
  document.body.classList.add('gated');
  requestAnimationFrame(() => g.classList.add('on'));
  g.addEventListener('click', e => {
    const btn = e.target.closest('[data-lang]'); if (!btn) return;
    const choice = btn.dataset.lang;
    sessionStorage.setItem('7d_gate', '1');
    g.classList.add('out');
    document.body.classList.remove('gated');
    setTimeout(() => g.remove(), 900);
    if (choice === 'skip') return;
    state.lang = choice;
    window.setLang?.(choice);
    scrollTo(0, 0);
    setTimeout(() => offerTour(), 700);
  });
}
function offerTour() {
  const ar = state.lang === 'ar';
  const box = document.createElement('div');
  box.className = 'offer'; box.id = 'offer';
  box.innerHTML = `
    <span class="tour-orb talking"></span>
    <p>${ar ? 'هلا فيك. أقدر آخذك بجولة صوتية قصيرة في الموقع؟' : 'Welcome. May I take you through the firm in two minutes?'}</p>
    <div class="offer-row">
      <button class="btn solid" id="offerYes">${ar ? 'ابدئي الجولة' : 'Start the tour'}</button>
      <button class="btn" id="offerNo">${ar ? 'أتصفح بنفسي' : 'I will explore'}</button>
    </div>`;
  document.body.appendChild(box);
  requestAnimationFrame(() => box.classList.add('on'));
  speak('ui-greetShort', TOUR.ui.greetShort[state.lang]).done.catch(() => {});
  const close = () => { box.classList.remove('on'); setTimeout(() => box.remove(), 500); };
  $('#offerYes').addEventListener('click', () => { close(); startTour(); });
  $('#offerNo').addEventListener('click', () => { close(); if (state.audio) try { state.audio.pause(); } catch {} });
}

/* ---------- wiring ---------- */
function wire() {
  // a touch anywhere pauses; the visible control or a second touch continues
  addEventListener('pointerdown', e => {
    if (!state.running) return;
    if (e.target.closest('#tourHud, .asst, .modal, .sheet, .nav')) return;
    state.paused ? resumeTour() : pauseTour();
  }, {passive: true});
  addEventListener('keydown', e => {
    if (!state.running) return;
    if (e.code === 'Space') { e.preventDefault(); state.paused ? resumeTour() : pauseTour(); }
    if (e.code === 'Escape') endTour(false);
  });
  addEventListener('wheel', () => { if (state.running && !state.paused) pauseTour(); }, {passive: true});
  $('#tourToggle').addEventListener('click', e => { e.stopPropagation(); state.paused ? resumeTour() : pauseTour(); });
  $('#tourEnd').addEventListener('click', e => { e.stopPropagation(); endTour(false); });
  $('#tourResume').addEventListener('click', e => { e.stopPropagation(); resumeTour(); });
  addEventListener('7d-lang', e => { state.lang = e.detail; });
}

(async function boot() {
  try {
    [TOUR, manifest] = await Promise.all([
      fetch('data/tour.json').then(r => r.json()),
      fetch('audio/manifest.json').then(r => r.json()).catch(() => null)
    ]);
  } catch { return; }
  const stored = localStorage.getItem('7d_lang');
  state.lang = stored === 'ar' || stored === 'en' ? stored : ((navigator.language || 'en').slice(0, 2) === 'ar' ? 'ar' : 'en');
  mount(); wire(); openGate();
  Object.assign(window, {startTour, endTour, tourPersona: TOUR.persona});
  dispatchEvent(new Event('tour-ready'));
})();
