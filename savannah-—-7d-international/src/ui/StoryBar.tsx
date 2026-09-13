import React from 'react';
import type { StoryState } from '../state/bus';
import type { SupportedLang } from '../config';
import { t, localizeDigits } from '../i18n/strings';
import { PlayIcon, PauseIcon, StopIcon } from './Icons';
import { CHAPTERS } from '../story/story';

export const StoryBar: React.FC<{ story: StoryState; lang: SupportedLang; onResume: () => void; onPause: () => void; onStop: () => void }> = ({ story, lang, onResume, onPause, onStop }) => {
  if (story.status === 'idle' || story.status === 'done') return null;
  const s = t(lang);
  const ch = CHAPTERS[story.chapter - 1];
  return (
    <div className="storybar" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="card">
        <div className="meta">
          <b>{ch ? ch.title[lang] : s.story}</b>
          <span>
            {s.chapter} {localizeDigits(String(story.chapter), lang)} {s.of} {localizeDigits(String(story.total), lang)}
          </span>
          <div className="seg">
            {Array.from({ length: story.total }).map((_, i) => (
              <i key={i} className={i + 1 < story.chapter ? 'done' : i + 1 === story.chapter ? 'now' : ''} />
            ))}
          </div>
        </div>
        {story.status === 'playing' ? (
          <button className="ctl" onClick={onPause} aria-label={s.pause}><PauseIcon /></button>
        ) : (
          <button className="ctl on" onClick={onResume} aria-label={s.resume}><PlayIcon /></button>
        )}
        <button className="ctl" onClick={onStop} aria-label={s.stop}><StopIcon width={16} height={16} /></button>
      </div>
    </div>
  );
};
