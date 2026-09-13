import React from 'react';
import { t } from '../i18n/strings';
import type { SupportedLang, PresenceState } from '../config';
import { MicIcon, MicOffIcon, CloseIcon, CaptionsIcon, SoundIcon, SoundOffIcon, TranscriptIcon } from './Icons';

interface Props {
  lang: SupportedLang;
  state: PresenceState;
  muted: boolean;
  ptt: boolean;
  captions: boolean;
  sound: boolean;
  onMute: () => void;
  onLang: () => void;
  onEnd: () => void;
  onCaptions: () => void;
  onSound: () => void;
  onTranscript: () => void;
  onPttDown: () => void;
  onPttUp: () => void;
}

export const ControlBar: React.FC<Props> = (p) => {
  const s = t(p.lang);
  const micClass = p.ptt ? 'mic ptt' : p.muted ? 'mic muted' : p.state === 'listening' ? 'mic listening' : p.state === 'speaking' ? 'mic speaking' : 'mic';
  return (
    <div className="controls">
      <div className="controls-bar">
        <div className="controls-left">
          <button className={`ctl lang ${p.lang === 'en' ? 'ar' : ''}`} onClick={p.onLang} aria-label={p.lang === 'en' ? 'التحويل إلى العربية' : 'Switch to English'} lang={p.lang === 'en' ? 'ar' : 'en'}>
            {s.switchLanguage}
          </button>
          <button className={`ctl ${p.captions ? 'on' : ''}`} onClick={p.onCaptions} aria-label={s.captions} aria-pressed={p.captions}>
            <CaptionsIcon />
          </button>
        </div>
        <button
          className={micClass}
          onClick={() => !p.ptt && p.onMute()}
          onPointerDown={(e) => {
            if (p.ptt) {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              p.onPttDown();
            }
          }}
          onPointerUp={() => p.ptt && p.onPttUp()}
          onPointerCancel={() => p.ptt && p.onPttUp()}
          aria-label={p.ptt ? s.holdToTalk : p.muted ? s.unmute : s.mute}
          aria-pressed={p.muted}
        >
          {p.muted ? <MicOffIcon width={22} height={22} /> : <MicIcon width={22} height={22} />}
        </button>
        <div className="controls-right">
          <button className={`ctl ${p.sound ? 'on' : ''}`} onClick={p.onSound} aria-label={s.sound} aria-pressed={p.sound}>
            {p.sound ? <SoundIcon /> : <SoundOffIcon />}
          </button>
          <button className="ctl" onClick={p.onTranscript} aria-label={s.transcript}>
            <TranscriptIcon />
          </button>
          <button className="ctl" onClick={p.onEnd} aria-label={s.endConversation}>
            <CloseIcon />
          </button>
        </div>
      </div>
    </div>
  );
};
