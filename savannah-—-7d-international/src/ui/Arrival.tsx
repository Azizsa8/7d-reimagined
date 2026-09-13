import React from 'react';
import { strings } from '../i18n/strings';

/** "The dark room": the whole screen is the button; no text for the first 1.2 s. */
export const Arrival: React.FC<{ onTap: () => void; deviceLang: 'en' | 'ar' }> = ({ onTap, deviceLang }) => {
  const first = deviceLang === 'ar' ? 'ar' : 'en';
  return (
    <div className="arrival" onPointerUp={onTap} role="button" aria-label={strings.en.tapToMeet} tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onTap()}>
      <div className="arrival-name">
        <span className="wordmark">Savannah</span>
        <img src="/brand/7d-logo.png" alt="7D International" />
      </div>
      <div className="arrival-cta">
        {first === 'ar' ? (
          <>
            <span className="ar">{strings.ar.tapToMeet}</span>
            <span className="en">{strings.en.tapToMeet}</span>
          </>
        ) : (
          <>
            <span className="en">{strings.en.tapToMeet}</span>
            <span className="ar">{strings.ar.tapToMeet}</span>
          </>
        )}
      </div>
      <p className="arrival-privacy" onPointerUp={(e) => e.stopPropagation()}>
        {first === 'ar' ? strings.ar.privacyNote : strings.en.privacyNote} · {first === 'ar' ? strings.ar.poweredBy : strings.en.poweredBy}
        <a href="/privacy" target="_blank" rel="noreferrer">{first === 'ar' ? strings.ar.privacyLink : strings.en.privacyLink}</a>
      </p>
    </div>
  );
};
