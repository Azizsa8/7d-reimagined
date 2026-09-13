import React, { useEffect, useState } from 'react';
import { bus, type WorldName } from '../state/bus';
import type { SupportedLang } from '../config';
import { t } from '../i18n/strings';
import { MailIcon, PhoneIcon, GlobeIcon, PinIcon } from './Icons';

interface Props {
  lang: SupportedLang;
  onAsk: (q: string) => void;
  onFocus: (world: WorldName, params: Record<string, unknown>) => void;
  onHome: () => void;
}

/** Title blocks and cards for the seven worlds. Everything shown comes from the KB via the world's overlay data. */
export const WorldOverlay: React.FC<Props> = ({ lang, onAsk, onFocus, onHome }) => {
  const [world, setWorld] = useState<WorldName>('presence');
  const [all, setAll] = useState<Partial<Record<WorldName, any>>>({});
  const data = all[world] || null;
  useEffect(() => {
    const a = bus.on('worldActive', (w) => {
      setWorld(w);
    });
    const b = bus.on('overlay', (o) => setAll((m) => ({ ...m, [o.world]: o.data })));
    return () => {
      a();
      b();
    };
  }, []);
  const s = t(lang);
  if (world === 'presence' || !data) return null;
  const isAr = lang === 'ar';
  const pct = (x: number) => `${Math.min(90, Math.max(10, ((x + 1) / 2) * 100))}%`;
  const pctY = (y: number) => `${((1 - y) / 2) * 100}%`;

  return (
    <div className="overlay" dir={isAr ? 'rtl' : 'ltr'} lang={lang}>
      <div className="sr-only" aria-live="polite">{s.showing}: {data.name || data.city || data.focus?.name || data.focus?.title || data.label || ''}</div>
      <div className="overlay-top">
        <button className="back-pill" onClick={onHome}><i />{s.returnToSavannah}</button>
      </div>

      {world === 'project' && (
        <>
          <div className="title-block">
            <span className="eyebrow">{data.location}</span>
            <h2>
              {data.name}
              {data.concept && <span className="badge">{s.conceptBadge}</span>}
            </h2>
            <div className={`accent ${data.pulse ? 'pulse' : ''}`} />
            <p className="role">{data.role}</p>
          </div>
          {data.chip && <div className="figure-chip">{data.chip}</div>}
        </>
      )}

      {world === 'globe' && (
        <>
          {data.label && data.city && (
            <div className="anchor-label" style={{ left: pct(data.label.x), top: pctY(data.label.y) }} key={data.focus}>
              <div className="city">{data.city}</div>
              <div className="country">{data.country}</div>
            </div>
          )}
          <div className="title-block">
            <span className="eyebrow">{s.hubs}</span>
            {data.city ? (
              <>
                <h2>{data.city}</h2>
                <div className="accent" />
                <p className="role">{data.role}</p>
              </>
            ) : (
              <h2>{isAr ? 'خمس قارات' : 'Five continents'}</h2>
            )}
          </div>
          <div className="hub-row">
            {data.hubs?.map((h: any) => (
              <button key={h.id} className={h.id === data.focus ? 'on' : ''} onClick={() => onFocus('globe', { focus: h.id })}>{h.city}</button>
            ))}
          </div>
        </>
      )}

      {world === 'timeline' && data.focus && (
        <>
          <div className="milestone-card" key={data.focus.id}>
            <span className="year">{data.focus.year}</span>
            <h3>{data.focus.title}</h3>
            <p>{data.focus.detail}</p>
          </div>
          <div className="year-row">
            {data.years?.map((y: any) => (
              <button key={y.id} className={y.active ? 'on' : ''} onClick={() => onFocus('timeline', { id: y.id })}>{y.year}</button>
            ))}
          </div>
        </>
      )}

      {world === 'people' && (
        <>
          {data.people?.map((p: any) => (
            <div key={p.id} className={`star-label ${p.active ? 'on' : ''}`} style={{ left: pct(p.x), top: pctY(p.y) }} onClick={() => onFocus('people', { id: p.id })}>
              <div className="n">{p.name}</div>
              <div className="t">{p.title}</div>
            </div>
          ))}
          {data.focus && (
            <div className="person-card" key={data.focus.id}>
              <Portrait url={data.focus.portrait} initials={data.focus.initials} alt={data.focus.name} />
              <div>
                <h3>{data.focus.name}</h3>
                <div className="alt" lang={isAr ? 'en' : 'ar'} dir={isAr ? 'ltr' : 'rtl'}>{data.focus.nameOther}</div>
                <div className="title">{data.focus.title}</div>
                <p>{data.focus.bio}</p>
              </div>
            </div>
          )}
        </>
      )}

      {world === 'disciplines' && (
        <>
          {data.items?.map((d: any) =>
            d.active ? null : (
              <div key={d.id} className="instrument-label" style={{ left: pct(d.x), top: pctY(d.y) }} onClick={() => onFocus('disciplines', { id: d.id })}>
                {d.name}
              </div>
            ),
          )}
          {data.focus ? (
            <div className="discipline-card" key={data.focus.id}>
              <span className="eyebrow">{s.disciplines}</span>
              <h3>{data.focus.name}</h3>
              <p>{data.focus.summary}</p>
              {data.focus.related?.length > 0 && (
                <div className="related">
                  {data.focus.related.map((r: any) => (
                    <button key={r.id} onClick={() => onAsk(isAr ? `احكي لي عن ${r.name}` : `Tell me about ${r.name}`)}>{r.name}</button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="title-block">
              <span className="eyebrow">{s.disciplines}</span>
              <h2>{isAr ? 'سبعة تخصصات' : 'Seven disciplines'}</h2>
            </div>
          )}
        </>
      )}

      {world === 'figure' && (
        <div className="figure-block">
          <div className="label">{data.label}</div>
        </div>
      )}

      {world === 'contact' && (
        <div className="contact-card card">
          <img src="/brand/7d-logo.png" alt="7D International" />
          <span className="eyebrow">{s.contact}</span>
          <a className="contact-row" href={`mailto:${data.email}`}>
            <span><small>{isAr ? 'الإيميل' : 'Email'}</small>{data.email}</span>
            <MailIcon />
          </a>
          <a className="contact-row" href={`tel:${String(data.phone).replace(/\s/g, '')}`}>
            <span><small>{isAr ? 'الهاتف' : 'Phone'}</small><span dir="ltr">{data.phone}</span></span>
            <PhoneIcon />
          </a>
          <a className="contact-row" href={data.website} target="_blank" rel="noreferrer">
            <span><small>{s.website}</small>{data.websiteLabel}</span>
            <GlobeIcon />
          </a>
          <div className="contact-row">
            <span><small>{s.offices}</small>{(data.offices || []).join(' · ')}</span>
            <PinIcon />
          </div>
        </div>
      )}
    </div>
  );
};

const Portrait: React.FC<{ url: string | null; initials: string; alt: string }> = ({ url, initials, alt }) => {
  const [ok, setOk] = useState(!!url);
  return <div className="portrait">{url && ok ? <img src={url} alt={alt} onError={() => setOk(false)} /> : <span>{initials}</span>}</div>;
};
