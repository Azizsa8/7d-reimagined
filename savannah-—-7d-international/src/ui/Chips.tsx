import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SupportedLang } from '../config';
import { strings } from '../i18n/strings';

interface ChipsProps {
  lang: SupportedLang;
  visible: boolean;
  onSelectChip: (chipText: string) => void;
  customChips?: string[];
}

export const Chips: React.FC<ChipsProps> = ({
  lang,
  visible,
  onSelectChip,
  customChips,
}) => {
  const isAr = lang === 'ar';
  const defaultChips = isAr
    ? ['وش سويتوا في الرياض؟', 'مين سفن دي إنترناشونال؟', 'احكي لي القصة']
    : ['What did you do in Riyadh?', 'Who is 7D International?', 'Tell me the story'];

  const chipList =
    customChips && customChips.length > 0
      ? customChips
      : strings[lang]?.chips || defaultChips;

  return (
    <div
      id="suggestion-chips"
      className="absolute bottom-24 left-0 right-0 z-20 flex justify-center items-center px-4 pointer-events-none"
    >
      <AnimatePresence mode="wait">
        {visible && (
          <motion.div
            key={chipList.join('|')}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className={`flex flex-wrap justify-center gap-2 max-w-lg pointer-events-auto ${
              isAr ? "font-['IBM_Plex_Sans_Arabic',sans-serif]" : "font-['IBM_Plex_Sans',sans-serif]"
            }`}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            {chipList.map((chip, index) => (
              <button
                key={`${chip}-${index}`}
                id={`btn-chip-${index}`}
                onClick={() => onSelectChip(chip)}
                className="px-4 py-2 rounded-full border border-white/12 bg-[#0B0D12]/85 backdrop-blur-md text-xs text-[#F4F1EA]/95 hover:text-[#E0A94A] hover:border-[#E0A94A]/40 hover:bg-[#E0A94A]/10 transition-all duration-200 active:scale-95 shadow-lg shadow-black/40 flex items-center gap-1.5"
              >
                <span>{chip}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
