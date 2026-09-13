import React from 'react';
import { motion } from 'motion/react';
import { SupportedLang } from '../config';

interface LanguagePickProps {
  onSelectLanguage: (lang: SupportedLang) => void;
  onCancel: () => void;
}

export const LanguagePick: React.FC<LanguagePickProps> = ({
  onSelectLanguage,
  onCancel,
}) => {
  return (
    <div
      id="language-pick-overlay"
      className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-black/60 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0B0D12]/90 p-8 shadow-2xl flex flex-col items-center text-center"
      >
        <span className="text-[11px] tracking-[0.24em] text-[#C8AA7C] uppercase mb-2">
          VOICE & PRESENCE
        </span>
        <h2 className="text-xl font-normal text-[#F4F1EA] mb-1 font-['Michroma',sans-serif] tracking-wider">
          CHOOSE HER VOICE
        </h2>
        <p className="text-sm font-['IBM_Plex_Sans_Arabic',sans-serif] text-[#A7A39A] mb-6">
          اختر لغة الحديث
        </p>

        {/* Microphone explanation */}
        <div className="mb-6 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-[#A7A39A] leading-relaxed">
          <p className="mb-1">Savannah needs your microphone to hear you speak.</p>
          <p className="font-['IBM_Plex_Sans_Arabic',sans-serif] text-[11px]">
            سافانا تحتاج الميكروفون عشان تسمعك.
          </p>
        </div>

        {/* Language Options */}
        <div className="w-full grid grid-cols-2 gap-3 mb-5">
          <button
            id="btn-choose-en"
            onClick={() => onSelectLanguage('en')}
            className="group flex flex-col items-center justify-center p-4 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-[#E0A94A]/15 hover:border-[#E0A94A]/60 transition-all duration-200 active:scale-95"
          >
            <span className="text-base font-medium text-[#F4F1EA] group-hover:text-[#E0A94A] transition-colors">
              English
            </span>
            <span className="text-[10px] text-[#A7A39A] tracking-wider uppercase mt-1">
              International
            </span>
          </button>

          <button
            id="btn-choose-ar"
            onClick={() => onSelectLanguage('ar')}
            className="group flex flex-col items-center justify-center p-4 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-[#2FA98B]/15 hover:border-[#2FA98B]/60 transition-all duration-200 active:scale-95"
          >
            <span className="text-base font-medium text-[#F4F1EA] group-hover:text-[#2FA98B] transition-colors font-['IBM_Plex_Sans_Arabic',sans-serif]">
              العربية
            </span>
            <span className="text-[10px] text-[#A7A39A] tracking-wider mt-1 font-['IBM_Plex_Sans_Arabic',sans-serif]">
              سعودية بيضاء
            </span>
          </button>
        </div>

        <button
          id="btn-cancel-pick"
          onClick={onCancel}
          className="text-xs text-[#A7A39A] hover:text-[#F4F1EA] transition-colors tracking-wide py-1"
        >
          Cancel
        </button>
      </motion.div>
    </div>
  );
};
