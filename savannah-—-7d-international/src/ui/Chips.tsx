import React, { useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';
import type { SupportedLang } from '../config';
import { soundDesign } from '../stage/audio/SoundDesign';

export const Chips: React.FC<{ items: string[]; lang: SupportedLang; visible: boolean; asked: Set<string>; onPick: (s: string) => void }> = ({ items, lang, visible, asked, onPick }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!visible || !ref.current) return;
    const els = ref.current.querySelectorAll('.chip');
    els.forEach((el) => el.classList.remove('in'));
    animate(els, { opacity: [0, 1], translateY: [10, 0], duration: 520, delay: stagger(60), ease: 'outQuint' });
    els.forEach((el) => el.classList.add('in'));
    soundDesign.glass();
  }, [visible, items]);

  if (!visible || items.length === 0) return null;
  return (
    <div className="chips" ref={ref} dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang}>
      {items.map((c) => (
        <button key={c} className={`chip ${asked.has(c) ? 'dim' : ''}`} onClick={() => onPick(c)}>
          {c}
        </button>
      ))}
    </div>
  );
};
