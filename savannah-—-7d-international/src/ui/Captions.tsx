import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SupportedLang } from '../config';

interface CaptionsProps {
  text: string;
  userText?: string;
  lang: SupportedLang;
  visible: boolean;
}

export const Captions: React.FC<CaptionsProps> = ({
  text,
  userText,
  lang,
  visible,
}) => {
  if (!visible) return null;

  const isAr = lang === 'ar';
  const hasText = Boolean(text || userText);

  return (
    <div
      id="captions-container"
      className="absolute bottom-28 left-0 right-0 z-20 flex flex-col items-center px-6 pointer-events-none"
    >
      <AnimatePresence mode="wait">
        {hasText && (
          <motion.div
            key={text || userText}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={`max-w-lg w-full text-center px-6 py-3 rounded-2xl bg-[#050608]/75 backdrop-blur-md border border-white/10 shadow-xl ${
              isAr ? "font-['IBM_Plex_Sans_Arabic',sans-serif]" : "font-['IBM_Plex_Sans',sans-serif]"
            }`}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            {userText && !text && (
              <p className="text-xs text-[#E0A94A]/80 tracking-wide mb-1 font-medium">
                {isAr ? 'أنت:' : 'You:'} <span className="text-[#F4F1EA]/90">{userText}</span>
              </p>
            )}

            {text && (
              <p className="text-sm md:text-base leading-relaxed text-[#F4F1EA] font-normal tracking-wide line-clamp-2">
                {text}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
