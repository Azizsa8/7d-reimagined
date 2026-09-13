import React from 'react';
import { motion } from 'motion/react';
import { SupportedLang } from '../config';
import { t } from '../i18n/strings';

interface EndedModalProps {
  lang: SupportedLang;
  onTalkAgain: () => void;
}

export const EndedModal: React.FC<EndedModalProps> = ({ lang, onTalkAgain }) => {
  const str = t(lang);
  const isAr = lang === 'ar';

  return (
    <div
      id="session-ended-modal"
      className="absolute inset-0 z-40 flex items-center justify-center p-6 bg-black/70 backdrop-blur-lg"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 10 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className={`w-full max-w-sm rounded-2xl border border-white/10 bg-[#0B0D12]/95 p-8 shadow-2xl flex flex-col items-center text-center ${
          isAr ? "font-['IBM_Plex_Sans_Arabic',sans-serif]" : "font-['IBM_Plex_Sans',sans-serif]"
        }`}
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div className="w-10 h-10 rounded-full bg-[#E0A94A]/10 border border-[#E0A94A]/30 flex items-center justify-center mb-4 text-[#E0A94A]">
          <span className="w-2 h-2 rounded-full bg-[#E0A94A] shadow-[0_0_8px_#E0A94A]" />
        </div>

        <h3 className="text-lg font-medium text-[#F4F1EA] mb-2 font-['Michroma',sans-serif] tracking-wider">
          {str.sessionEndedTitle}
        </h3>

        <p className="text-xs text-[#A7A39A] leading-relaxed mb-6">
          {str.sessionEndedMessage}
        </p>

        <button
          id="btn-talk-again"
          onClick={onTalkAgain}
          className="w-full py-3.5 rounded-full bg-[#E0A94A] text-black text-xs font-semibold uppercase tracking-widest hover:bg-[#E0A94A]/90 transition-all active:scale-95 shadow-lg shadow-[#E0A94A]/20"
        >
          {str.talkAgain}
        </button>
      </motion.div>
    </div>
  );
};
