import React, { useEffect, useState } from 'react';
import type { EnquiryDraft } from '../state/bus';
import type { SupportedLang } from '../config';
import { t } from '../i18n/strings';
import { CloseIcon } from './Icons';

interface Props {
  draft: EnquiryDraft;
  lang: SupportedLang;
  onSend: (final: EnquiryDraft) => Promise<{ ok: boolean; error?: string; contact?: { email: string; phone: string } }>;
  onDismiss: () => void;
}

/** Glass enquiry card that fills in live; email and phone are always editable; the visitor sends. */
export const EnquiryCard: React.FC<Props> = ({ draft, lang, onSend, onDismiss }) => {
  const s = t(lang);
  const [email, setEmail] = useState(draft.email || '');
  const [phone, setPhone] = useState(draft.phone || '');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; error?: string; contact?: { email: string; phone: string } } | null>(null);
  useEffect(() => {
    if (draft.email && !email) setEmail(draft.email);
    if (draft.phone && !phone) setPhone(draft.phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.email, draft.phone]);

  const canSend = !!draft.name && !!draft.topic && (email.trim() || phone.trim()) && !busy && !result?.ok;

  const send = async () => {
    setBusy(true);
    const r = await onSend({ ...draft, email: email.trim(), phone: phone.trim() });
    setResult(r);
    setBusy(false);
  };

  return (
    <div className="enquiry card" dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang} role="region" aria-label={s.enquiryTitle}>
      <h3>
        {s.enquiryTitle}
        <button className="ctl" onClick={onDismiss} aria-label={s.dismiss}><CloseIcon width={16} height={16} /></button>
      </h3>
      {(['name', 'organisation', 'country', 'topic'] as const).map((k) => (
        <div className="field" key={k}>
          <label>{s[k]}</label>
          <div className={`v ${!draft[k] ? 'typing' : ''}`}>{draft[k] || ''}</div>
        </div>
      ))}
      <div className="field">
        <label htmlFor="enq-email">{s.email}</label>
        <input id="enq-email" type="email" inputMode="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
      </div>
      <div className="field">
        <label htmlFor="enq-phone">{s.phone}</label>
        <input id="enq-phone" type="tel" inputMode="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+966 …" />
      </div>
      <p className="note">{s.enquiryCheck}</p>
      {!result?.ok && (
        <button className="btn btn-primary" disabled={!canSend} onClick={send}>{busy ? s.sending : s.sendTo7D}</button>
      )}
      {result && (
        <div className={`result ${result.ok ? '' : 'bad'}`}>
          {result.ok ? s.enquirySent : result.error === 'NOT_CONFIGURED' ? s.enquiryUnconfigured : s.enquiryFailed}
          {!result.ok && result.contact && (
            <>
              <a href={`mailto:${result.contact.email}`}>{result.contact.email}</a>
              <a href={`tel:${result.contact.phone.replace(/\s/g, '')}`} dir="ltr">{result.contact.phone}</a>
            </>
          )}
        </div>
      )}
    </div>
  );
};
