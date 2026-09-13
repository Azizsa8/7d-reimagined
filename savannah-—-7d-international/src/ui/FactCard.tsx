import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  MapPin,
  Mail,
  ExternalLink,
  ShieldCheck,
  Building2,
  Users,
  Compass,
  TrendingUp,
  Sparkles,
  Layers,
  ChevronRight,
  Globe2,
} from 'lucide-react';
import { SupportedLang } from '../config';

export interface FactCardProps {
  card: {
    type: 'project' | 'hubs' | 'timeline' | 'person' | 'discipline' | 'figure' | 'contact';
    data: any;
    lang?: SupportedLang;
  } | null;
  onClose: () => void;
  onAskQuestion?: (q: string) => void;
  lang: SupportedLang;
}

export const FactCard: React.FC<FactCardProps> = ({
  card,
  onClose,
  onAskQuestion,
  lang,
}) => {
  const [imgError, setImgError] = useState(false);
  const [focusedHub, setFocusedHub] = useState<string>('riyadh');

  if (!card) return null;

  const isAr = lang === 'ar';
  const { type, data } = card;

  const getMonogram = (name: string) => {
    if (!name) return '7D';
    const parts = name.replace(/^(Dr\.|Eng\.|Doctor|Engineer)\s+/i, '').trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <AnimatePresence>
      <motion.div
        id="fact-card-backdrop"
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.96 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg mx-auto pointer-events-auto"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div
          id="fact-card-container"
          className="relative overflow-hidden rounded-2xl bg-[#0e1117]/90 backdrop-blur-xl border border-white/12 shadow-[0_20px_50px_rgba(0,0,0,0.6)] text-white p-6 sm:p-7"
        >
          {/* Subtle gold decorative glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#c5a059]/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

          {/* Header Bar */}
          <div className="flex items-center justify-between gap-3 mb-5 border-b border-white/8 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/6 border border-white/10 text-[#d4af37]">
                {type === 'project' && <Building2 className="w-4 h-4" />}
                {type === 'hubs' && <Globe2 className="w-4 h-4" />}
                {type === 'timeline' && <Compass className="w-4 h-4" />}
                {type === 'person' && <Users className="w-4 h-4" />}
                {type === 'discipline' && <Layers className="w-4 h-4" />}
                {type === 'figure' && <TrendingUp className="w-4 h-4" />}
                {type === 'contact' && <Mail className="w-4 h-4" />}
              </span>
              <div>
                <span className="text-[11px] font-medium tracking-wider uppercase text-[#c5a059]">
                  {isAr ? 'سفن دي إنترناشونال' : '7D International'}
                </span>
                <div className="flex items-center gap-1.5 text-xs text-white/50">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>{isAr ? 'سجل موثق رسمي' : 'Verified Record'}</span>
                </div>
              </div>
            </div>

            <button
              id="fact-card-close-btn"
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close card"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* PROJECT VARIANT */}
          {type === 'project' && (
            <div className="space-y-4">
              {data.images && data.images.length > 0 && !imgError && (
                <div className="relative w-full h-44 rounded-xl overflow-hidden bg-black/40 border border-white/8">
                  <img
                    src={data.images[0]}
                    alt={data.name}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0e1117] via-transparent to-transparent opacity-80" />
                  <span className="absolute bottom-3 left-3 text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-white/90">
                    {data.kind?.replace('_', ' ')}
                  </span>
                </div>
              )}

              <div>
                <h3 className="text-xl font-semibold text-white tracking-tight">
                  {isAr ? data.name_ar || data.name : data.name}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-white/60 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-[#c5a059] shrink-0" />
                  <span>{isAr ? data.location_ar || data.location : data.location}</span>
                </div>
              </div>

              {/* Verified Role as Stated */}
              <div className="p-3.5 rounded-xl bg-[#c5a059]/10 border border-[#c5a059]/20">
                <span className="block text-[11px] font-semibold text-[#d4af37] uppercase tracking-wider mb-1">
                  {isAr ? 'دور سفن دي المعتمد' : "7D's Verified Role"}
                </span>
                <p className="text-xs text-white/90 leading-relaxed font-medium">
                  {isAr
                    ? data.role_as_stated_ar || data.role_as_stated
                    : data.role_as_stated}
                </p>
              </div>

              <p className="text-sm text-white/80 leading-relaxed">
                {isAr ? data.summary_ar || data.summary_en : data.summary_en}
              </p>

              {data.context_facts && data.context_facts.length > 0 && (
                <ul className="space-y-1.5 pt-1">
                  {data.context_facts.slice(0, 3).map((f: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-white/70">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#c5a059] mt-1.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* HUBS VARIANT */}
          {type === 'hubs' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  {isAr ? 'المراكز الاستراتيجية العالمية' : 'Global Strategic Hubs'}
                </h3>
                <p className="text-xs text-white/60 mt-0.5">
                  {isAr
                    ? 'خمسة مراكز تربط الشرق والغرب بحضور استراتيجي'
                    : 'Five strategic hubs connecting East and West'}
                </p>
              </div>

              {/* Hub Tabs */}
              <div className="grid grid-cols-5 gap-1.5 p-1 rounded-xl bg-white/5 border border-white/8">
                {(data.hubs || []).map((h: any) => {
                  const isActive = (focusedHub || data.focus || 'riyadh') === h.id;
                  return (
                    <button
                      key={h.id}
                      onClick={() => setFocusedHub(h.id)}
                      className={`py-2 px-1 text-center rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-[#c5a059] text-black shadow-md'
                          : 'text-white/70 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {isAr ? h.city_ar : h.city}
                    </button>
                  );
                })}
              </div>

              {/* Active Hub Card */}
              {(() => {
                const activeId = focusedHub || data.focus || 'riyadh';
                const hub = (data.hubs || []).find((h: any) => h.id === activeId) || data.hubs?.[0];
                if (!hub) return null;
                return (
                  <div className="p-4 rounded-xl bg-white/4 border border-white/8 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-semibold text-white">
                        {isAr ? hub.name_ar : hub.name}
                      </h4>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/8 text-white/70 border border-white/8 font-mono">
                        {hub.coordinates ? `${hub.coordinates[0].toFixed(2)}°, ${hub.coordinates[1].toFixed(2)}°` : ''}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-[#c5a059]">
                      {isAr ? hub.role_ar : hub.role}
                    </div>
                    <p className="text-xs text-white/80 leading-relaxed">
                      {isAr ? hub.summary_ar : hub.summary_en}
                    </p>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TIMELINE VARIANT */}
          {type === 'timeline' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  {isAr ? 'محطات المسيرة والإنجاز' : 'Chronological Milestones'}
                </h3>
                <p className="text-xs text-white/60 mt-0.5">
                  {isAr ? 'من وسط أوروبا ١٩٩٣ إلى الرياض اليوم' : 'From Central Europe in 1993 to Riyadh today'}
                </p>
              </div>

              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {(data.timeline || []).map((m: any) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-xl bg-white/4 border border-white/8 hover:border-white/20 transition-all"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-[#c5a059]/20 text-[#d4af37] border border-[#c5a059]/30">
                        {m.year}
                      </span>
                      <h4 className="text-xs font-semibold text-white">
                        {isAr ? m.title_ar : m.title_en}
                      </h4>
                    </div>
                    <p className="text-xs text-white/70 leading-relaxed">
                      {isAr ? m.summary_ar : m.summary_en}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PERSON VARIANT */}
          {type === 'person' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-[#c5a059]/15 border border-[#c5a059]/30 flex items-center justify-center shrink-0">
                  {data.portrait && !imgError ? (
                    <img
                      src={data.portrait}
                      alt={data.name}
                      onError={() => setImgError(true)}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-lg font-bold text-[#d4af37]">
                      {getMonogram(data.name)}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {isAr ? data.name_ar || data.name : data.name}
                  </h3>
                  <div className="text-xs text-[#c5a059] font-medium mt-0.5">
                    {isAr ? data.title_ar || data.title : data.title}
                  </div>
                  {data.email && (
                    <a
                      href={`mailto:${data.email}`}
                      className="inline-flex items-center gap-1 text-[11px] text-white/50 hover:text-white mt-1 transition-colors"
                    >
                      <Mail className="w-3 h-3" />
                      <span>{data.email}</span>
                    </a>
                  )}
                </div>
              </div>

              <p className="text-xs text-white/80 leading-relaxed p-3.5 rounded-xl bg-white/4 border border-white/8">
                {isAr ? data.bio_ar || data.bio_en : data.bio_en}
              </p>
            </div>
          )}

          {/* DISCIPLINE VARIANT */}
          {type === 'discipline' && (
            <div className="space-y-4">
              <div>
                <span className="text-[11px] font-semibold text-[#c5a059] uppercase tracking-wider">
                  {isAr ? 'التخصصات الأساسية' : 'Core Discipline'}
                </span>
                <h3 className="text-xl font-semibold text-white mt-0.5">
                  {isAr ? data.name_ar || data.name : data.name}
                </h3>
              </div>

              <p className="text-sm text-white/80 leading-relaxed p-3.5 rounded-xl bg-white/4 border border-white/8">
                {isAr ? data.summary_ar || data.summary_en : data.summary_en}
              </p>

              {data.related_projects && data.related_projects.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium text-white/50 uppercase tracking-wider">
                    {isAr ? 'مشاريع وتطبيقات مرتبطة:' : 'Related Projects:'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {data.related_projects.map((p: string, idx: number) => (
                      <span
                        key={idx}
                        className="text-xs px-2.5 py-1 rounded-lg bg-white/6 border border-white/10 text-white/80"
                      >
                        {p.replace(/-/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FIGURE VARIANT */}
          {type === 'figure' && (
            <div className="space-y-4 text-center py-2">
              <div className="inline-block p-4 rounded-2xl bg-gradient-to-br from-[#c5a059]/20 to-transparent border border-[#c5a059]/30">
                <span className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight font-mono">
                  {data.value}
                </span>
              </div>
              <div>
                <h4 className="text-base font-semibold text-white">
                  {isAr ? data.label_ar || data.label_en : data.label_en}
                </h4>
                <div className="text-xs text-[#c5a059] mt-1 font-medium">
                  {isAr ? `تُنطق: "${data.spoken_ar}"` : `Spoken: "${data.spoken_en}"`}
                </div>
              </div>
              <p className="text-xs text-white/80 max-w-sm mx-auto leading-relaxed">
                {isAr ? data.detail_ar || data.detail_en : data.detail_en}
              </p>
            </div>
          )}

          {/* CONTACT VARIANT */}
          {type === 'contact' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  {isAr ? 'قنوات التواصل الرسمية' : 'Official 7D Inquiries'}
                </h3>
                <p className="text-xs text-white/60 mt-0.5">
                  {isAr ? 'المكاتب الإقليمية ورئاسة مجلس الإدارة' : 'Middle East & Global Executive Offices'}
                </p>
              </div>

              <div className="space-y-2.5">
                <a
                  href={`mailto:${data.general_email}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/4 border border-white/8 hover:border-[#c5a059]/40 hover:bg-[#c5a059]/10 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-[#c5a059]" />
                    <div className="text-left">
                      <div className="text-[11px] text-white/50 uppercase tracking-wider">
                        {isAr ? 'الاستفسارات العامة' : 'General Inquiries'}
                      </div>
                      <div className="text-xs font-semibold text-white font-mono">
                        {data.general_email}
                      </div>
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-white/40 group-hover:text-white transition-colors" />
                </a>

                <a
                  href={`mailto:${data.chairman_email}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/4 border border-white/8 hover:border-[#c5a059]/40 hover:bg-[#c5a059]/10 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 text-[#c5a059]" />
                    <div className="text-left">
                      <div className="text-[11px] text-white/50 uppercase tracking-wider">
                        {isAr ? 'مكتب رئيس مجلس الإدارة' : "Chairman's Office"}
                      </div>
                      <div className="text-xs font-semibold text-white font-mono">
                        {data.chairman_email}
                      </div>
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-white/40 group-hover:text-white transition-colors" />
                </a>

                <div className="p-3 rounded-xl bg-white/4 border border-white/8 text-xs text-white/70 space-y-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-[#c5a059] shrink-0" />
                    <span>{isAr ? data.riyadh_office_ar : data.riyadh_office}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-white/40 shrink-0" />
                    <span>{isAr ? data.florida_office_ar : data.florida_office}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick ask footer */}
          <div className="mt-5 pt-3.5 border-t border-white/8 flex items-center justify-between text-xs text-white/50">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#c5a059]" />
              <span>{isAr ? 'اسأل سافانا لمزيد من التفاصيل' : 'Ask Savannah to dive deeper'}</span>
            </span>
            <button
              onClick={onClose}
              className="text-xs font-medium text-white/70 hover:text-white transition-colors"
            >
              {isAr ? 'إغلاق' : 'Dismiss'}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
