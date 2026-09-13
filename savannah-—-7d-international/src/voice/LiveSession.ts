import { GoogleGenAI, type LiveServerMessage, type Session, type LiveConnectConfig } from '@google/genai';
import { bus } from '../state/bus';
import { SESSION, pageNonce, type SupportedLang, type PrebuiltVoice } from '../config';
import { Playback } from './Playback';
import { MicCapture } from './MicCapture';
import { CaptionManager } from './captions';
import { executeTool, type ToolContext } from './tools';
import { CueDirector } from '../stage/cue/CueDirector';
import { story, chapterPayload } from '../story/story';
import { fetchKB } from '../kb/client';
import { executeTool as runTool, resetEnquiry } from './tools';
import { t } from '../i18n/strings';
import { track } from '../analytics';

export interface Turn {
  role: 'user' | 'model';
  text: string;
}

export type EndReason = 'USER' | 'IDLE' | 'CAP' | 'LOST' | 'RESTING' | 'NOT_CONFIGURED' | 'RATE_LIMITED' | 'ERROR';

/**
 * One Savannah conversation: ephemeral token → Live API session on @google/genai,
 * with session resumption, silent goAway reconnects, barge-in, tool round-trips,
 * clock-aligned captions and cues, idle and cap timers, and push-to-talk.
 */
export class LiveSession {
  public readonly playback = new Playback();
  public readonly mic = new MicCapture();
  public readonly captions: CaptionManager;
  public readonly cues: CueDirector;

  private session: Session | null = null;
  private lang: SupportedLang;
  private voice: PrebuiltVoice;
  private model = '';
  private handle: string | null = null;
  private closedByUs = false;
  private destroyed = false;
  private reconnectAttempt = 0;
  private reconnecting = false;
  private manualActivity = false;

  private history: Turn[] = [];
  private currentUser = '';
  private turnStartedAt = 0;
  private firstAudioReported = false;
  private turns = 0;
  private startedAt = 0;
  private lastActivity = Date.now();
  private idleAsked = false;
  private capWarned = false;
  private timers: number[] = [];
  private silenceTimer: number | null = null;
  private toolCtx: ToolContext;
  private hidden = false;
  private hiddenAt = 0;
  private lastUserHeardAt = 0;
  /** After a tap-interrupt the model may still stream the rest of its turn; drop it. */
  private suppressTurn = false;
  /** True while the current model turn is a Story chapter; the client advances when its audio ends. */
  private storyChapterTurn = false;
  private storyAdvanceWhenEnded = false;

  constructor(lang: SupportedLang, voice: PrebuiltVoice) {
    this.lang = lang;
    this.voice = voice;
    this.toolCtx = { lang, askedChips: new Set() };
    this.captions = new CaptionManager(() => this.playback.clock, () => this.playback.queuedUntil());
    this.cues = new CueDirector(() => this.playback.clock);

    this.playback.onFirstChunkOfTurn = () => {
      bus.emit('state', 'speaking');
      if (!this.firstAudioReported && this.turnStartedAt) {
        this.firstAudioReported = true;
        track('first_audio_ms', { value: Math.round(performance.now() - this.turnStartedAt), lang: this.lang });
      }
    };
    this.playback.onEnded = () => {
      if (this.destroyed) return;
      bus.emit('state', 'listening');
      if (this.storyAdvanceWhenEnded && story.state === 'playing') {
        this.storyAdvanceWhenEnded = false;
        window.setTimeout(() => this.advanceStory(), 700);
        return;
      }
      this.armSilenceChips();
    };

    document.addEventListener('visibilitychange', this.onVisibility);
  }

  get language() {
    return this.lang;
  }
  get transcript(): Turn[] {
    return this.history.slice();
  }
  get isConnected() {
    return !!this.session;
  }

  /* ---------------- lifecycle ---------------- */

  async start(): Promise<void> {
    resetEnquiry();
    this.startedAt = performance.now();
    this.lastActivity = Date.now();
    bus.emit('lang', this.lang);
    bus.emit('state', 'thinking');
    await this.connect({ fresh: true });
    const micOk = await this.mic.start((b64) => this.sendAudio(b64));
    track(micOk ? 'mic_granted' : 'mic_denied', { lang: this.lang });
    this.startTimers();
    this.sendGreeting();
  }

  private async mintToken(resuming: boolean) {
    const res = await fetch('/api/live-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: this.lang, voice: this.voice, nonce: pageNonce(), resuming }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const code = body?.error || `HTTP_${res.status}`;
      throw Object.assign(new Error(code), { code });
    }
    return res.json() as Promise<{ token: string; model: string }>;
  }

  private async connect(opts: { fresh: boolean; seed?: Turn[] }) {
    const { token, model } = await this.mintToken(!opts.fresh && !!this.handle);
    this.model = model;
    const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: 'v1alpha' } });
    const config: LiveConnectConfig = {
      sessionResumption: this.handle && !opts.fresh ? { handle: this.handle } : {},
      realtimeInputConfig: {
        automaticActivityDetection: this.manualActivity
          ? { disabled: true }
          : { silenceDurationMs: SESSION.vadSilenceMs },
      },
    };
    this.closedByUs = false;
    const session = await ai.live.connect({
      model,
      config,
      callbacks: {
        onopen: () => {
          this.reconnectAttempt = 0;
          this.reconnecting = false;
          bus.emit('connected', true);
          bus.emit('reconnecting', false);
          bus.emit('quality', 'good');
        },
        onmessage: (m) => this.onMessage(m),
        onerror: (e) => {
          console.error('[live] error', e);
          bus.emit('quality', 'degraded');
        },
        onclose: (e) => {
          const wasOurs = this.closedByUs;
          this.session = null;
          bus.emit('connected', false);
          if (!wasOurs && !this.destroyed) {
            console.warn('[live] closed', e?.code, e?.reason);
            this.reconnect();
          }
        },
      },
    });
    this.session = session;
    if (opts.seed?.length) {
      session.sendClientContent({
        turns: opts.seed.map((tn) => ({ role: tn.role, parts: [{ text: tn.text }] })),
        turnComplete: false,
      });
    }
  }

  private sendGreeting() {
    const prompt =
      this.lang === 'ar'
        ? 'ابدئي: رحبي بالزائر بلهجة سعودية بيضاء، عرّفي بنفسك سافانا، قولي بجملة وحدة وش أنتِ، واسألي سؤال مفتوح واحد. بدون أدوات.'
        : 'Begin: greet the visitor, say you are Savannah, say in one sentence what you are here for on behalf of 7D International, and ask one open question. No tools for this turn.';
    this.sendText(prompt, { silent: true });
  }

  private async reconnect() {
    if (this.destroyed || this.reconnecting) return;
    this.reconnecting = true;
    bus.emit('reconnecting', true);
    bus.emit('quality', 'lost');
    const delay = SESSION.reconnectDelays[Math.min(this.reconnectAttempt, SESSION.reconnectDelays.length - 1)];
    this.reconnectAttempt++;
    await new Promise((r) => setTimeout(r, delay));
    if (this.destroyed) return;
    try {
      await this.connect({ fresh: !this.handle });
      if (!this.handle) {
        // No resumable state: re-seed the conversation so she does not lose the thread.
        this.session?.sendClientContent({
          turns: this.history.slice(-6).map((tn) => ({ role: tn.role, parts: [{ text: tn.text }] })),
          turnComplete: false,
        });
      }
      this.reconnecting = false;
    } catch (e: any) {
      this.reconnecting = false;
      if (this.reconnectAttempt >= 5 || e?.code === 'RESTING' || e?.code === 'RATE_LIMITED') {
        this.end('LOST');
        return;
      }
      this.reconnect();
    }
  }

  /** goAway: open a new connection with the resumption handle, then let the old one close. */
  private async rotate() {
    if (this.destroyed) return;
    const old = this.session;
    this.closedByUs = true;
    try {
      await this.connect({ fresh: false });
      try {
        old?.close();
      } catch {
        /* ignore */
      }
    } catch (e) {
      console.warn('[live] rotate failed, falling back to reconnect', e);
      this.closedByUs = false;
      this.reconnect();
    }
  }

  async switchLanguage(next: SupportedLang) {
    if (next === this.lang) return;
    this.lang = next;
    this.toolCtx.lang = next;
    bus.emit('lang', next);
    this.playback.interrupt();
    this.captions.interrupt();
    this.cues.reset();
    this.closedByUs = true;
    try {
      this.session?.close();
    } catch {
      /* ignore */
    }
    this.session = null;
    this.handle = null; // different system instruction: new session
    bus.emit('state', 'thinking');
    const seed = this.history.slice(-6);
    await this.connect({ fresh: true, seed });
    const note =
      next === 'ar'
        ? 'تحوّلت المحادثة للعربي. أكّدي التحويل بجملة سعودية قصيرة وكمّلي من وين وقفنا.'
        : 'The conversation has switched to English. Acknowledge the switch in one short sentence and carry on from where we were.';
    this.sendText(note, { silent: true });
  }

  end(reason: EndReason = 'USER') {
    if (this.destroyed) return;
    this.destroyed = true;
    this.closedByUs = true;
    for (const t of this.timers) clearInterval(t);
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    try {
      this.session?.close();
    } catch {
      /* ignore */
    }
    this.session = null;
    this.mic.stop();
    this.playback.interrupt();
    this.captions.clear();
    this.cues.reset();
    story.stop();
    document.removeEventListener('visibilitychange', this.onVisibility);
    track('session_end', { duration: Math.round((performance.now() - this.startedAt) / 1000), turns: this.turns, code: reason });
    bus.emit('state', 'idle');
    bus.emit('sessionEnded', reason);
  }

  dispose() {
    this.end('USER');
    this.playback.dispose();
    this.captions.dispose();
  }

  /* ---------------- inbound ---------------- */

  private onMessage(m: LiveServerMessage) {
    if (m.sessionResumptionUpdate) {
      if (m.sessionResumptionUpdate.resumable && m.sessionResumptionUpdate.newHandle) this.handle = m.sessionResumptionUpdate.newHandle;
    }
    if (m.goAway) {
      this.rotate();
    }
    if (m.toolCall?.functionCalls?.length) {
      this.onToolCalls(m.toolCall.functionCalls as Array<{ id?: string; name?: string; args?: Record<string, any> }>);
    }
    if (m.toolCallCancellation) {
      /* side effects were only visual; nothing to undo */
    }
    const sc = m.serverContent;
    if (!sc) return;

    if (sc.interrupted) {
      this.storyChapterTurn = false;
      this.storyAdvanceWhenEnded = false;
      this.playback.interrupt();
      this.captions.interrupt();
      this.cues.reset();
      story.pause();
      track('interrupt');
      bus.emit('interrupted', true);
      bus.emit('state', 'listening');
      return;
    }

    if (sc.inputTranscription?.text) {
      this.suppressTurn = false;
      const text = sc.inputTranscription.text;
      this.currentUser += text;
      this.lastUserHeardAt = performance.now();
      this.touch();
      bus.emit('userCaption', this.currentUser.trim());
      if (!this.turnStartedAt) this.turnStartedAt = performance.now();
    }

    if (sc.outputTranscription?.text && !this.suppressTurn) {
      const text = sc.outputTranscription.text;
      const at = this.playback.queuedUntil();
      this.captions.onModelText(text);
      this.cues.feed(text, at);
    }

    if (sc.modelTurn?.parts && !this.suppressTurn) {
      for (const part of sc.modelTurn.parts) {
        if (part.inlineData?.data) this.playback.enqueueBase64(part.inlineData.data);
      }
    }

    if (sc.turnComplete) {
      this.suppressTurn = false;
      if (this.storyChapterTurn && story.state === 'playing') {
        this.storyChapterTurn = false;
        if (this.playback.isPlaying()) this.storyAdvanceWhenEnded = true;
        else window.setTimeout(() => this.advanceStory(), 700);
      }
      if (this.currentUser.trim()) {
        this.pushHistory('user', this.currentUser.trim());
        this.currentUser = '';
      }
      this.captions.flushTurn();
      this.turns++;
      track('turn', { lang: this.lang });
      this.turnStartedAt = 0;
      this.firstAudioReported = false;
      // If nothing was queued for playback (text-only or tool-only turn), listen again now.
      if (!this.playback.isPlaying()) {
        bus.emit('state', 'listening');
        this.armSilenceChips();
      }
    }
  }

  private pushHistory(role: 'user' | 'model', text: string) {
    this.history.push({ role, text });
    if (this.history.length > 40) this.history = this.history.slice(-40);
  }

  private async onToolCalls(calls: Array<{ id?: string; name?: string; args?: Record<string, any> }>) {
    bus.emit('state', 'thinking');
    const responses = [];
    for (const call of calls) {
      const name = call.name || '';
      bus.emit('tool', { name, args: call.args || {}, at: performance.now() });
      let response: Record<string, unknown>;
      try {
        response = await executeTool(name, call.args || {}, this.toolCtx);
      } catch (e: any) {
        response = { error: e?.message || 'tool failed' };
      }
      responses.push({ id: call.id, name, response });
      if (name === 'story' && ['start', 'resume'].includes(String(call.args?.action))) this.storyChapterTurn = (response as any).status === 'playing';
    }
    try {
      this.session?.sendToolResponse({ functionResponses: responses });
    } catch (e) {
      console.error('[live] tool response failed', e);
    }
  }

  /* ---------------- outbound ---------------- */

  private sendAudio(b64: string) {
    if (!this.session || this.hidden) return;
    try {
      this.session.sendRealtimeInput({ audio: { data: b64, mimeType: 'audio/pcm;rate=16000' } });
    } catch {
      /* socket closing */
    }
  }

  /** Text into the live session (chips, type-instead, system nudges). */
  sendText(text: string, opts: { silent?: boolean } = {}) {
    if (!this.session) return;
    if (!opts.silent) {
      bus.emit('userCaption', text);
      this.pushHistory('user', text);
      this.toolCtx.askedChips.add(text);
      this.turnStartedAt = performance.now();
      this.firstAudioReported = false;
    }
    this.touch();
    this.suppressTurn = false;
    bus.emit('state', 'thinking');
    try {
      this.session.sendClientContent({ turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true });
    } catch (e) {
      console.error('[live] sendText failed', e);
    }
  }

  /**
   * Story mode: the client turns the page. When a chapter's audio has finished and the
   * visitor has not interrupted, show the next chapter's scene and hand the model its
   * talking points as a silent turn, so the seven chapters run on their own (~20 s each).
   */
  private async advanceStory() {
    if (this.destroyed || story.state !== 'playing') return;
    const next = story.next();
    const kb = await fetchKB();
    if (!next) {
      bus.emit('scene', { world: 'presence', at: performance.now() });
      this.sendText(this.lang === 'ar' ? 'انتهت القصة. اختمي بجملة وحدة، واستدعي suggest_questions بثلاثة أسئلة، وارجعي للزائر.' : 'The story is finished. Close in one sentence, call suggest_questions with three follow-ups, and hand back to the visitor.', { silent: true });
      return;
    }
    await runTool(next.show.name, next.show.args, this.toolCtx);
    const p = chapterPayload(kb, next, this.lang);
    const text =
      this.lang === 'ar'
        ? `القصة، الفصل ${p.chapter} من ${p.of}: «${p.title}». تكلمي عن هذا الفصل الحين في حوالي عشرين ثانية، من هذه النقاط فقط وبصوتك: ${p.talking_points.join(' ')} ${p.voice_rules.length ? 'قواعد: ' + p.voice_rules.join(' ') : ''} لا تسألين إذا أكمل؛ الفصل الجاي يجي لحاله.`
        : `Story, chapter ${p.chapter} of ${p.of}: "${p.title}". Tell this chapter now, in about twenty seconds, from these points only and in your own voice: ${p.talking_points.join(' ')} ${p.voice_rules.length ? 'Rules: ' + p.voice_rules.join(' ') : ''} Do not ask whether to continue; the next chapter follows on its own.`;
    this.storyChapterTurn = true;
    this.sendText(text, { silent: true });
  }

  /** Tell the model the enquiry outcome (Phase 4 §2.1 step 6). */
  notifyEnquiry(result: 'sent' | 'failed') {
    this.sendText(result === 'sent' ? 'ENQUIRY_SENT' : 'ENQUIRY_FAILED', { silent: true });
  }

  /** Visitor tapped the stage while she speaks: interrupt locally and tell the model. */
  interruptNow() {
    if (!this.playback.isPlaying()) return;
    this.suppressTurn = true;
    this.playback.interrupt();
    this.captions.interrupt();
    this.cues.reset();
    story.pause();
    bus.emit('interrupted', true);
    bus.emit('state', 'listening');
    track('interrupt');
  }

  /* ---------------- push-to-talk ---------------- */

  get isManualActivity() {
    return this.manualActivity;
  }

  /** Switches VAD off/on by reconnecting with the resumption handle. */
  async setManualActivity(on: boolean) {
    if (on === this.manualActivity) return;
    this.manualActivity = on;
    this.mic.setGate(!on);
    bus.emit('ptt', on);
    await this.rotate();
  }

  pttDown() {
    if (!this.manualActivity || !this.session) return;
    this.interruptNow();
    this.mic.setGate(true);
    try {
      this.session.sendRealtimeInput({ activityStart: {} });
    } catch {
      /* ignore */
    }
  }

  pttUp() {
    if (!this.manualActivity || !this.session) return;
    this.mic.setGate(false);
    this.turnStartedAt = performance.now();
    try {
      this.session.sendRealtimeInput({ activityEnd: {} });
    } catch {
      /* ignore */
    }
  }

  /* ---------------- timers ---------------- */

  private touch() {
    this.lastActivity = Date.now();
    this.idleAsked = false;
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private armSilenceChips() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = window.setTimeout(() => {
      if (!this.destroyed && !this.playback.isPlaying()) bus.emit('chips', { items: [], source: 'system' });
    }, SESSION.silenceChipsMs);
  }

  private startTimers() {
    this.timers.push(
      window.setInterval(() => {
        if (this.destroyed) return;
        const idle = Date.now() - this.lastActivity;
        const elapsed = performance.now() - this.startedAt;
        if (elapsed >= SESSION.capMs) return this.end('CAP');
        if (elapsed >= SESSION.warnAtMs && !this.capWarned) {
          this.capWarned = true;
          this.sendText(t(this.lang).capWarning, { silent: true });
        }
        if (idle >= SESSION.idleCloseMs) return this.end('IDLE');
        if (idle >= SESSION.idleAskMs && !this.idleAsked && !this.playback.isPlaying()) {
          this.idleAsked = true;
          this.sendText(t(this.lang).idleQuestion, { silent: true });
        }
      }, 2000),
    );
  }

  private onVisibility = () => {
    if (document.hidden) {
      this.hidden = true;
      this.hiddenAt = Date.now();
      // Pause the mic stream but keep the socket for short app switches.
      this.mic.setGate(false);
    } else {
      this.hidden = false;
      const away = Date.now() - this.hiddenAt;
      this.mic.setGate(!this.manualActivity);
      if (away > SESSION.backgroundKeepMs && !this.session) this.reconnect();
    }
  };
}
