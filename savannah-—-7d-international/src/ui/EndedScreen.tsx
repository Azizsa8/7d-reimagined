import React from 'react';
import { t } from '../i18n/strings';
import type { SupportedLang } from '../config';

export const EndedScreen: React.FC<{ lang: SupportedLang; reason: string; onAgain: () => void }> = ({ lang, reason, onAgain }) => {
  const s = t(lang);
  const body = reason === 'RESTING' ? s.resting : reason === 'NOT_CONFIGURED' ? s.notConfigured : reason === 'LOST' ? s.connectionLost : s.endedBody;
  return (
    <div className="ended" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <h2>{s.endedTitle}</h2>
      <p>{body}</p>
      {reason === 'RESTING' || reason === 'NOT_CONFIGURED' ? (
        <p>
          <a href="mailto:info@7dint.net" style={{ color: 'var(--brass)' }}>info@7dint.net</a>
        </p>
      ) : null}
      <button className="btn btn-primary" onClick={onAgain}>{s.talkAgain}</button>
    </div>
  );
};
