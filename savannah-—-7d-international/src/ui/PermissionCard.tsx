import React from 'react';
import { motion } from 'motion/react';
import { SupportedLang } from '../config';
import { t } from '../i18n/strings';

interface PermissionCardProps {
  lang: SupportedLang;
  isNoDevice?: boolean;
  onRetry: () => void;
  onContinueWithoutMic: () => void;
  onCancel: () => void;
}

export const PermissionCard: React.FC<PermissionCardProps> = ({
  lang,
  isNoDevice = false,
  onRetry,
  onContinueWithoutMic,
  onCancel,
}) => {
  const str = t(lang);
  const isAr = lang === 'ar';

  return (
    <div
      id="permission-card-overlay"
      className="absolute inset-0 z-40 flex items-center justify-center p-6 bg-black/75 backdrop-blur-lg"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`w-full max-w-sm rounded-2xl border border-rose-500/20 bg-[#0E1015] p-7 shadow-2xl flex flex-col items-center text-center ${
          isAr ? "font-['IBM_Plex_Sans_Arabic',sans-serif]" : "font-['IBM_Plex_Sans',sans-serif]"
        }`}
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div className="w-12 h-12 rounded-full bg-[#E0A94A]/10 border border-[#E0A94A]/30 flex items-center justify-center mb-4 text-[#E0A94A]">
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
            <line
              x1="3"
              y1="3"
              x2="21"
              y2="21"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          </svg>
        </div>

        <h3 className="text-lg font-medium text-[#F4F1EA] mb-2">
          {isNoDevice ? str.noMicTitle : str.micPermissionTitle}
        </h3>
        <p className="text-xs text-[#A7A39A] mb-6 leading-relaxed">
          {isNoDevice ? str.noMicHelp : str.micPermissionHelp}
        </p>

        <div className="w-full flex flex-col gap-2.5">
          <button
            id="btn-continue-without-mic"
            onClick={onContinueWithoutMic}
            className="w-full py-3 rounded-xl bg-[#E0A94A] text-black text-xs font-semibold uppercase tracking-wider hover:bg-[#E0A94A]/90 transition-all active:scale-95 shadow-md"
          >
            {str.continueWithoutMic}
          </button>

          <div className="flex gap-2 w-full">
            <button
              id="btn-retry-mic"
              onClick={onRetry}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-xs text-[#F4F1EA] hover:bg-white/[0.06] transition-colors"
            >
              {str.tryAgain}
            </button>
            <button
              id="btn-cancel-mic"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-xl border border-white/10 text-xs text-[#A7A39A] hover:text-[#F4F1EA] transition-colors"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
