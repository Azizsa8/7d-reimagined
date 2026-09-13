import React, { useEffect, useState } from 'react';
import type { SupportedLang } from '../config';

export const Captions: React.FC<{ text: string; userText: string; lang: SupportedLang; visible: boolean }> = ({ text, userText, lang, visible }) => {
  const [userShown, setUserShown] = useState('');
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!userText) return;
    setUserShown(userText);
    setGone(false);
    const t = window.setTimeout(() => setGone(true), 2500);
    return () => clearTimeout(t);
  }, [userText]);

  return (
    <>
      {/* Screen readers always get her words, even with captions hidden. */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">{text}</div>
      {visible && (
        <div className="captions" dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang}>
          {userShown && <div className={`caption-user ${gone ? 'gone' : ''}`}>{userShown}</div>}
          {text && (
            <div className="caption-model" key={text}>
              {text}
            </div>
          )}
        </div>
      )}
    </>
  );
};
