import React, { useEffect, useRef, useState } from 'react';
import type { SupportedLang } from '../config';
import { t } from '../i18n/strings';
import { CloseIcon, KeyboardIcon } from './Icons';

interface Turn {
  role: 'user' | 'model';
  text: string;
}

interface Props {
  lang: SupportedLang;
  turns: Turn[];
  captionScale: number;
  onCaptionScale: (s: number) => void;
  onSend: (text: string) => void;
  onClose: () => void;
}

/** Transcript drawer with Copy, caption size M/L/XL, and the type-instead fallback. */
export const TranscriptDrawer: React.FC<Props> = ({ lang, turns, captionScale, onCaptionScale, onSend, onClose }) => {
  const s = t(lang);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [turns.length]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(turns.map((x) => `${x.role === 'user' ? (lang === 'ar' ? 'أنت' : 'You') : 'Savannah'}: ${x.text}`).join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="drawer" dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang} role="dialog" aria-label={s.transcript}>
      <div className="grip" />
      <div className="drawer-head">
        <h3>{s.transcript}</h3>
        <div className="drawer-tools">
          {[1, 1.25, 1.5].map((sc, i) => (
            <button key={sc} className={captionScale === sc ? 'on' : ''} onClick={() => onCaptionScale(sc)} aria-label={`${s.captionSize} ${['M', 'L', 'XL'][i]}`}>{['M', 'L', 'XL'][i]}</button>
          ))}
          <button onClick={copy}>{copied ? s.copied : s.copy}</button>
          <button className={typing ? 'on' : ''} onClick={() => setTyping((v) => !v)} aria-label={s.typeInstead}><KeyboardIcon width={16} height={16} /></button>
          <button onClick={onClose} aria-label={s.dismiss}><CloseIcon width={16} height={16} /></button>
        </div>
      </div>
      <div className="transcript" ref={listRef}>
        {turns.map((x, i) => (
          <div key={i} className={x.role === 'user' ? 'u' : 'm'}>
            <b>{x.role === 'user' ? (lang === 'ar' ? 'أنت' : 'You') : 'Savannah'}</b>
            {x.text}
          </div>
        ))}
      </div>
      {typing && (
        <form
          className="typebar"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            onSend(text.trim());
            setText('');
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={s.typePlaceholder} autoFocus aria-label={s.typeInstead} />
          <button className="btn btn-primary" type="submit" disabled={!text.trim()}>{s.send}</button>
        </form>
      )}
    </div>
  );
};
