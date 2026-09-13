import React from 'react';
import { t } from '../i18n/strings';
import type { SupportedLang } from '../config';
import { MicOffIcon } from './Icons';

export const PermissionCard: React.FC<{ lang: SupportedLang; noDevice: boolean; onRetry: () => void; onBack: () => void }> = ({ lang, noDevice, onRetry, onBack }) => {
  const s = t(lang);
  return (
    <div className="center-card" role="dialog" aria-modal="true">
      <div className="card">
        <MicOffIcon width={28} height={28} style={{ color: 'var(--danger)' }} />
        <h2>{noDevice ? s.micMissingTitle : s.micDeniedTitle}</h2>
        <p>{noDevice ? s.micMissingBody : s.micDeniedBody}</p>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={onRetry}>{s.tryAgain}</button>
          <button className="btn btn-ghost" onClick={onBack}>{s.back}</button>
        </div>
      </div>
    </div>
  );
};
