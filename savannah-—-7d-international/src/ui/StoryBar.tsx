import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, SkipForward, SkipBack, Square, BookOpen } from 'lucide-react';
import { SupportedLang } from '../config';
import { storyController } from '../story/story';

export interface StoryStateData {
  status: 'idle' | 'playing' | 'paused' | 'done';
  currentChapter: number;
  totalChapters: number;
  chapter?: any;
  progress?: { current: number; total: number; percent: number };
}

interface StoryBarProps {
  storyState: StoryStateData | null;
  lang: SupportedLang;
  onSendAction?: (action: string) => void;
}

export const StoryBar: React.FC<StoryBarProps> = ({
  storyState,
  lang,
  onSendAction,
}) => {
  if (!storyState || storyState.status === 'idle' || storyState.status === 'done') {
    return null;
  }

  const isAr = lang === 'ar';
  const { currentChapter, totalChapters, status, chapter } = storyState;
  const isPlaying = status === 'playing';

  const handleAction = (action: string) => {
    if (action === 'pause') storyController.pause();
    if (action === 'resume') storyController.resume();
    if (action === 'next') storyController.next();
    if (action === 'previous') storyController.previous();
    if (action === 'stop') storyController.stop();

    if (onSendAction) {
      onSendAction(action);
    }
  };

  const title = isAr ? chapter?.title_ar : chapter?.title_en;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-20 left-0 right-0 z-30 flex justify-center px-4 pointer-events-none"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#0e1117]/90 backdrop-blur-xl border border-[#c5a059]/30 shadow-2xl text-white pointer-events-auto max-w-lg w-full">
          <span className="w-8 h-8 rounded-xl bg-[#c5a059]/20 border border-[#c5a059]/30 flex items-center justify-center text-[#d4af37] shrink-0">
            <BookOpen className="w-4 h-4" />
          </span>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-[11px] text-white/60 mb-1 font-medium">
              <span className="text-[#d4af37] font-semibold">
                {isAr
                  ? `الفصل ${currentChapter} من ${totalChapters}`
                  : `Chapter ${currentChapter} of ${totalChapters}`}
              </span>
              <span>{Math.round((currentChapter / totalChapters) * 100)}%</span>
            </div>

            {/* Progress segment bar */}
            <div className="flex gap-1 h-1.5 w-full">
              {Array.from({ length: totalChapters }).map((_, idx) => (
                <div
                  key={idx}
                  className={`flex-1 rounded-full transition-all duration-300 ${
                    idx + 1 < currentChapter
                      ? 'bg-[#c5a059]'
                      : idx + 1 === currentChapter
                      ? 'bg-[#d4af37] shadow-[0_0_8px_#d4af37]'
                      : 'bg-white/15'
                  }`}
                />
              ))}
            </div>

            <div className="text-xs font-medium text-white/90 truncate mt-1">
              {title || (isAr ? 'قصة سفن دي' : '7D Story')}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => handleAction('previous')}
              disabled={currentChapter <= 1}
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title={isAr ? 'السابق' : 'Previous'}
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => handleAction(isPlaying ? 'pause' : 'resume')}
              className="p-2 rounded-xl bg-[#c5a059] text-black hover:bg-[#d4af37] transition-all shadow-md active:scale-95"
              title={isPlaying ? (isAr ? 'إيقاف مؤقت' : 'Pause') : isAr ? 'استئناف' : 'Resume'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => handleAction('next')}
              disabled={currentChapter >= totalChapters}
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title={isAr ? 'التالي' : 'Next'}
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => handleAction('stop')}
              className="p-1.5 rounded-lg text-white/40 hover:text-rose-400 hover:bg-white/10 transition-colors"
              title={isAr ? 'إنهاء القصة' : 'Stop story'}
            >
              <Square className="w-3 h-3" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
