import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Stage } from './stage/Stage';
import { LiveSession, type Turn } from './voice/LiveSession';
import { bus, type StoryState, type EnquiryDraft, type WorldName } from './state/bus';
import { getVoiceFromUrl, pageNonce, type PresenceState, type SupportedLang } from './config';
import { audioEngine } from './audio/AudioEngine';
import { soundDesign } from './stage/audio/SoundDesign';
import { deviceManager } from './mobile/deviceManager';
import { fetchKB } from './kb/client';
import { track } from './analytics';
import { t } from './i18n/strings';
import { Arrival } from './ui/Arrival';
import { LanguagePick } from './ui/LanguagePick';
import { PermissionCard } from './ui/PermissionCard';
import { Captions } from './ui/Captions';
import { Chips } from './ui/Chips';
import { ControlBar } from './ui/ControlBar';
import { EndedScreen } from './ui/EndedScreen';
import { WorldOverlay } from './ui/WorldOverlay';
import { StoryBar } from './ui/StoryBar';
import { EnquiryCard } from './ui/EnquiryCard';
import { TranscriptDrawer } from './ui/TranscriptDrawer';

type Phase = 'arrival' | 'pick' | 'active' | 'permission' | 'ended';

const deviceLang: SupportedLang = /^ar/i.test(navigator.language) ? 'ar' : 'en';

export default function App() {
  const stageEl = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const sessionRef = useRef<LiveSession | null>(null);

  const [phase, setPhase] = useState<Phase>('arrival');
  const [lang, setLang] = useState<SupportedLang>(deviceLang);
  const [state, setState] = useState<PresenceState>('idle');
  const [caption, setCaption] = useState('');
  const [userCaption, setUserCaption] = useState('');
  const [captionsOn, setCaptionsOn] = useState(true);
  const [captionScale, setCaptionScale] = useState(1);
  const [muted, setMuted] = useState(false);
  const [ptt, setPtt] = useState(false);
  const [sound, setSound] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [quality, setQuality] = useState<'good' | 'degraded' | 'lost'>('good');
  const [chips, setChips] = useState<string[]>([]);
  const [chipsVisible, setChipsVisible] = useState(false);
  const [asked, setAsked] = useState<Set<string>>(new Set());
  const [story, setStory] = useState<StoryState>({ status: 'idle', chapter: 0, total: 7 });
  const [enquiry, setEnquiry] = useState<EnquiryDraft | null>(null);
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [drawer, setDrawer] = useState(false);
  const [micFail, setMicFail] = useState<string | null>(null);
  const [endReason, setEndReason] = useState('USER');
  const [toast, setToast] = useState<string | null>(null);
  const [install, setInstall] = useState(false);
  const [world, setWorld] = useState<WorldName>('presence');
  const conversations = useRef(0);
  const openingChips = useRef<string[]>([]);

  // Stage (once)
  useEffect(() => {
    if (!stageEl.current) return;
    const stage = new Stage(stageEl.current);
    stageRef.current = stage;
    stage.presence.setScale(0.06);
    deviceManager.setTiltHandler((x, y) => stage.setTilt(x, y));
    stage.director.preloadAll();
    track('arrive', { lang: deviceLang });
    // Dev-only driver: window.__savannah.scene('globe', { focus: 'riyadh' }) etc. Never shipped.
    if (import.meta.env.DEV) {
      (window as any).__savannah = {
        stage,
        bus,
        session: () => sessionRef.current,
        scene: (world: WorldName, params: Record<string, unknown> = {}) => bus.emit('scene', { world, params, at: performance.now() }),
        cue: (entityId: string, category: string) => bus.emit('cue', { entityId, category }),
        state: (st: PresenceState) => bus.emit('state', st),
        level: (rms: number) => bus.emit('level', { rms, low: rms * 0.8, mid: rms * 0.6, high: rms * 0.3 }),
        caption: (text: string) => bus.emit('caption', { text }),
        chips: (items: string[]) => bus.emit('chips', { items, source: 'model' }),
        lang: (l: SupportedLang) => bus.emit('lang', l),
        story: (st: StoryState) => bus.emit('story', st),
        enquiry: (d: EnquiryDraft | null) => bus.emit('enquiry', d),
        activate: () => setPhase('active'),
      };
    }
    fetchKB().then((kb) => (openingChips.current = kb.suggested_questions.opening.map((q) => q[lang]))).catch(() => {});

    const subs = [
      bus.on('state', setState),
      bus.on('caption', (c) => setCaption(c.text)),
      bus.on('userCaption', setUserCaption),
      bus.on('muted', setMuted),
      bus.on('ptt', setPtt),
      bus.on('lang', (l) => {
        setLang(l);
        fetchKB().then((kb) => (openingChips.current = kb.suggested_questions.opening.map((q) => q[l]))).catch(() => {});
      }),
      bus.on('reconnecting', setReconnecting),
      bus.on('quality', setQuality),
      bus.on('chips', ({ items, source }) => {
        const list = items.length ? items : openingChips.current;
        setChips(list.filter((c) => !askedRef.current.has(c)).slice(0, 3));
        setChipsVisible(source === 'system' || items.length > 0);
      }),
      bus.on('story', setStory),
      bus.on('enquiry', (d) => {
        if (d) track('enquiry_started');
        setEnquiry(d);
      }),
      bus.on('transcriptTurn', (turn) => setTranscript((x) => [...x, turn])),
      bus.on('worldActive', setWorld),
      bus.on('error', (e) => {
        if (e === 'MIC_PERMISSION_DENIED' || e === 'MIC_NOT_FOUND') {
          setMicFail(e);
          setPhase((p) => (p === 'active' ? 'permission' : p));
        }
      }),
      bus.on('sessionEnded', (reason) => {
        setEndReason(reason);
        setPhase('ended');
        setEnquiry(null);
        setChipsVisible(false);
        setDrawer(false);
        stage.presence.setScale(0.06);
        stage.director.go('presence');
        deviceManager.sessionEnded();
        conversations.current++;
        if (conversations.current === 1 && deviceManager.canInstall && reason === 'USER') setInstall(true);
      }),
      bus.on('toast', ({ text }) => {
        setToast(text);
        setTimeout(() => setToast(null), 4000);
      }),
    ];
    return () => {
      subs.forEach((u) => u());
      sessionRef.current?.dispose();
      stage.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const askedRef = useRef(asked);
  askedRef.current = asked;

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    document.documentElement.style.setProperty('--caption-scale', String(captionScale));
  }, [captionScale]);

  useEffect(() => {
    const st = stageRef.current;
    if (!st) return;
    if (phase === 'arrival') st.presence.setScale(0.06);
    else if (phase === 'pick') st.presence.setScale(0.5);
    else if (phase === 'active') st.presence.setScale(1);
    else if (phase === 'ended') st.presence.setScale(0.06);
  }, [phase]);

  /* ---------- flow ---------- */

  const onTap = useCallback(async () => {
    await audioEngine.unlock();
    soundDesign.init();
    setSound(!soundDesign.muted);
    deviceManager.onFirstGesture();
    track('tap_start');
    setPhase('pick');
  }, []);

  const startConversation = useCallback(async (chosen: SupportedLang) => {
    setLang(chosen);
    setTranscript([]);
    setAsked(new Set());
    setCaption('');
    setUserCaption('');
    setEnquiry(null);
    setChipsVisible(false);
    sessionRef.current?.dispose();
    const session = new LiveSession(chosen, getVoiceFromUrl());
    sessionRef.current = session;
    setPhase('active');
    deviceManager.sessionStarted();
    try {
      await session.start();
    } catch (e: any) {
      const code = e?.code || 'ERROR';
      console.error('[app] session failed', code);
      session.end(code === 'RESTING' || code === 'NOT_CONFIGURED' || code === 'RATE_LIMITED' ? code : 'LOST');
    }
  }, []);

  const send = useCallback((text: string) => {
    sessionRef.current?.sendText(text);
    setAsked((a) => new Set(a).add(text));
    setChipsVisible(false);
  }, []);

  const onChip = useCallback((c: string) => {
    track('chip_tapped', { id: c.slice(0, 40) });
    send(c);
  }, [send]);

  const onEnd = useCallback(() => sessionRef.current?.end('USER'), []);
  const onLang = useCallback(() => sessionRef.current?.switchLanguage(lang === 'en' ? 'ar' : 'en'), [lang]);
  const onMute = useCallback(() => {
    const s = sessionRef.current;
    if (s) s.mic.setMuted(!s.mic.isMuted);
  }, []);
  const onSound = useCallback(() => setSound(!soundDesign.toggle()), []);
  const onHome = useCallback(() => bus.emit('scene', { world: 'presence', at: performance.now() }), []);
  const onFocus = useCallback((w: WorldName, params: Record<string, unknown>) => {
    soundDesign.click();
    stageRef.current?.director.go(w, params);
  }, []);

  const onSendEnquiry = useCallback(async (final: EnquiryDraft) => {
    const s = sessionRef.current;
    const excerpt = (s?.transcript || []).slice(-6);
    try {
      const res = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...final, transcript: excerpt, nonce: pageNonce() }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        track('enquiry_sent');
        bus.emit('enquiryResult', 'sent');
        s?.notifyEnquiry('sent');
        return { ok: true };
      }
      bus.emit('enquiryResult', body.error === 'NOT_CONFIGURED' ? 'unconfigured' : 'failed');
      s?.notifyEnquiry('failed');
      return { ok: false, error: body.error || 'FAILED', contact: body.contact };
    } catch {
      s?.notifyEnquiry('failed');
      return { ok: false, error: 'FAILED' };
    }
  }, []);

  /* ---------- gestures on the stage ---------- */
  const press = useRef<{ x: number; y: number; t: number; timer: number | null; long: boolean }>({ x: 0, y: 0, t: 0, timer: null, long: false });
  const onStageDown = (e: React.PointerEvent) => {
    if (phase !== 'active') return;
    press.current = { x: e.clientX, y: e.clientY, t: performance.now(), timer: null, long: false };
    press.current.timer = window.setTimeout(() => {
      press.current.long = true;
      const s = sessionRef.current;
      if (!s) return;
      if (!s.isManualActivity) {
        s.setManualActivity(true);
        setToast(t(lang).pttHint);
        setTimeout(() => setToast(null), 3500);
      }
      s.pttDown();
      deviceManager.vibrate(12);
    }, 550);
  };
  const onStageUp = (e: React.PointerEvent) => {
    if (phase !== 'active') return;
    const p = press.current;
    if (p.timer) clearTimeout(p.timer);
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    const dt = performance.now() - p.t;
    const s = sessionRef.current;
    if (p.long) {
      s?.pttUp();
      return;
    }
    if (Math.abs(dy) > 70 && Math.abs(dy) > Math.abs(dx) && dy > 0 && world !== 'presence') {
      onHome();
      return;
    }
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) && world === 'project') {
      const dir = (dx < 0) !== (lang === 'ar') ? 1 : -1;
      send(lang === 'ar' ? (dir > 0 ? 'وريني المشروع اللي بعده' : 'وريني المشروع اللي قبله') : dir > 0 ? 'Show me the next project' : 'Show me the previous project');
      return;
    }
    if (dt < 400 && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      // Tap anywhere on the stage while she speaks = interrupt and listen.
      if (state === 'speaking') s?.interruptNow();
      else if (s?.isManualActivity) {
        s.setManualActivity(false);
        setToast(null);
      }
    }
  };

  /* ---------- keyboard (desktop) ---------- */
  useEffect(() => {
    if (phase !== 'active') return;
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const s = sessionRef.current;
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        if (s && !s.isManualActivity) s.setManualActivity(true);
        s?.pttDown();
      } else if (e.key === 'Escape') {
        if (state === 'speaking') s?.interruptNow();
        else onHome();
      } else if (e.key.toLowerCase() === 'l') onLang();
      else if (e.key.toLowerCase() === 'm') onMute();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') sessionRef.current?.pttUp();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [phase, state, onLang, onMute, onHome]);

  const s = t(lang);
  const statusClass = quality !== 'good' ? 'lost' : state;
  const statusLabel = reconnecting ? s.reconnecting : state === 'listening' ? s.listening : state === 'thinking' ? s.thinking : state === 'speaking' ? s.speaking : s.idle;

  return (
    <main className={`app ${chipsVisible && chips.length && phase === 'active' && !enquiry && (state === 'listening' || state === 'idle') ? 'chips-on' : ''}`} id="savannah">
      <div className="stage" ref={stageEl} onPointerDown={onStageDown} onPointerUp={onStageUp} onPointerCancel={onStageUp} />
      <div className="vignette" />

      {phase === 'arrival' && <Arrival onTap={onTap} deviceLang={deviceLang} />}
      {phase === 'pick' && <LanguagePick onPick={startConversation} onBack={() => setPhase('arrival')} deviceLang={deviceLang} />}

      {phase === 'active' && (
        <>
          <header className="topbar">
            <img src="/brand/7d-logo.png" alt="7D International" />
            <div className={`status-pill ${statusClass}`} aria-live="polite"><i />{statusLabel}</div>
          </header>
          <StoryBar
            story={story}
            lang={lang}
            onPause={() => sessionRef.current?.interruptNow()}
            onResume={() => send(lang === 'ar' ? 'كمّل القصة' : 'Carry on with the story')}
            onStop={() => send(lang === 'ar' ? 'وقف القصة' : 'Stop the story')}
          />
          <WorldOverlay lang={lang} onAsk={send} onFocus={onFocus} onHome={onHome} />
          {enquiry && <EnquiryCard draft={enquiry} lang={lang} onSend={onSendEnquiry} onDismiss={() => setEnquiry(null)} />}
          <Chips items={chips} lang={lang} visible={chipsVisible && !enquiry && (state === 'listening' || state === 'idle')} asked={asked} onPick={onChip} />
          <Captions text={caption} userText={userCaption} lang={lang} visible={captionsOn && !enquiry} />
          {reconnecting && <div className="reconnect-pill"><span>{s.reconnecting}</span></div>}
          <ControlBar
            lang={lang}
            state={state}
            muted={muted}
            ptt={ptt}
            captions={captionsOn}
            sound={sound}
            onMute={onMute}
            onLang={onLang}
            onEnd={onEnd}
            onCaptions={() => setCaptionsOn((v) => !v)}
            onSound={onSound}
            onTranscript={() => setDrawer((v) => !v)}
            onPttDown={() => sessionRef.current?.pttDown()}
            onPttUp={() => sessionRef.current?.pttUp()}
          />
          {drawer && (
            <TranscriptDrawer lang={lang} turns={transcript} captionScale={captionScale} onCaptionScale={setCaptionScale} onSend={send} onClose={() => setDrawer(false)} />
          )}
        </>
      )}

      {phase === 'permission' && (
        <PermissionCard lang={lang} noDevice={micFail === 'MIC_NOT_FOUND'} onRetry={() => startConversation(lang)} onBack={() => { sessionRef.current?.end('USER'); setPhase('arrival'); }} />
      )}

      {phase === 'ended' && (
        <>
          <EndedScreen lang={lang} reason={endReason} onAgain={() => setPhase('pick')} />
          {install && (
            <div className="install card" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
              <span style={{ flex: 1 }}>{s.addToHome}</span>
              <button className="btn btn-primary" onClick={async () => { setInstall(false); await deviceManager.promptInstall(); }}>{s.addToHomeAction}</button>
              <button className="btn btn-ghost" onClick={() => setInstall(false)}>{s.notNow}</button>
            </div>
          )}
        </>
      )}

      {toast && <div className="toast"><span>{toast === 'NOISY' ? s.noisyHint : toast}</span></div>}
    </main>
  );
}
