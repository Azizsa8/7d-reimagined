import React, { useEffect, useRef, useState } from 'react';
import { strings } from '../i18n/strings';
import type { SupportedLang } from '../config';

/**
 * "Choose her voice": two pills either side of the presence. The visitor can tap,
 * or say "English" / "عربي" — the mic opens for this choice only (Web Speech API
 * where the browser has it; otherwise tap only).
 */
export const LanguagePick: React.FC<{ onPick: (l: SupportedLang) => void; onBack: () => void; deviceLang: 'en' | 'ar' }> = ({ onPick, onBack, deviceLang }) => {
  const [listening, setListening] = useState(false);
  const [hot, setHot] = useState<SupportedLang | null>(null);
  const recRef = useRef<any>(null);
  const picked = useRef(false);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    let rec: any;
    try {
      rec = new SR();
      rec.lang = deviceLang === 'ar' ? 'ar-SA' : 'en-US';
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e: any) => {
        let text = '';
        for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript + ' ';
        const t = text.toLowerCase();
        if (/عرب|arab/.test(t)) choose('ar');
        else if (/english|انجليزي|إنجليزي|انقليزي/.test(t)) choose('en');
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => setListening(false);
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch {
      setListening(false);
    }
    return () => {
      try {
        rec?.stop();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (l: SupportedLang) => {
    if (picked.current) return;
    picked.current = true;
    setHot(l);
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    window.setTimeout(() => onPick(l), 180);
  };

  const s = deviceLang === 'ar' ? strings.ar : strings.en;
  return (
    <div className="langpick">
      <button className="langpick-back" onClick={onBack} aria-label={s.back}>‹ {s.back}</button>
      <div className="langpick-pills">
        <button className={`pill en ${hot === 'en' ? 'hot' : ''}`} onClick={() => choose('en')} aria-label="English">
          {strings.en.english}
        </button>
        <button className={`pill ar ${hot === 'ar' ? 'hot' : ''}`} onClick={() => choose('ar')} aria-label="العربية" lang="ar" dir="rtl">
          {strings.ar.arabic}
        </button>
      </div>
      <div className="langpick-hint">
        <span>{strings.en.micExplain}</span>
        <span lang="ar" dir="rtl" style={{ fontFamily: 'var(--font-arabic)' }}>{strings.ar.micExplain}</span>
        <span className={listening ? 'listening' : ''}>{listening ? (deviceLang === 'ar' ? strings.ar.sayLanguage : strings.en.sayLanguage) : ''}</span>
      </div>
    </div>
  );
};
