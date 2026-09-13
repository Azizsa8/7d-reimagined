import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SupportedLang, PresenceState } from '../config';
import { t } from '../i18n/strings';
import { soundDesign } from '../stage/audio/SoundDesign';

interface ControlBarProps {
  lang: SupportedLang;
  state: PresenceState;
  isMuted: boolean;
  captionsVisible: boolean;
  isReconnecting: boolean;
  micAvailable?: boolean;
  onToggleMute: () => void;
  onSwitchLanguage: () => void;
  onToggleCaptions: () => void;
  onEndConversation: () => void;
  onSendText?: (text: string) => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  lang,
  state,
  isMuted,
  captionsVisible,
  isReconnecting,
  micAvailable = true,
  onToggleMute,
  onSwitchLanguage,
  onToggleCaptions,
  onEndConversation,
  onSendText,
}) => {
  const str = t(lang);
  const isAr = lang === 'ar';
  const [textInput, setTextInput] = useState('');
  const [showInputBar, setShowInputBar] = useState(!micAvailable);
  const [bedMuted, setBedMuted] = useState(soundDesign.isMuted);

  const handleToggleSoundBed = () => {
    const next = soundDesign.toggleMute();
    setBedMuted(next);
  };

  const handleSubmitText = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = textInput.trim();
    if (!trimmed || !onSendText) return;
    onSendText(trimmed);
    setTextInput('');
  };

  return (
    <div
      id="control-bar-container"
      className="absolute bottom-6 left-0 right-0 z-30 flex flex-col items-center px-4 pointer-events-none"
    >
      {/* Reconnecting or State Pill */}
      {isReconnecting ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs tracking-wide backdrop-blur-md flex items-center gap-2"
        >
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>{str.reconnecting}</span>
        </motion.div>
      ) : !micAvailable ? (
        <div className="mb-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-[11px] tracking-wide text-amber-300/90 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span>{str.noMicNotice}</span>
        </div>
      ) : (
        <div className="mb-2 px-3 py-0.5 rounded-full bg-white/[0.04] border border-white/5 text-[11px] tracking-wider text-[#A7A39A] uppercase">
          {state === 'listening' && (
            <span className="text-[#2FA98B] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2FA98B] animate-pulse" />
              {str.statusListening}
            </span>
          )}
          {state === 'thinking' && (
            <span className="text-[#E0A94A] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E0A94A] animate-pulse" />
              {str.statusThinking}
            </span>
          )}
          {state === 'speaking' && (
            <span className="text-[#F4F1EA] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F4F1EA] animate-pulse" />
              {str.statusSpeaking}
            </span>
          )}
          {state === 'idle' && <span>{str.statusIdle}</span>}
        </div>
      )}

      {/* Optional / No-mic Quick Text Input */}
      <AnimatePresence>
        {(showInputBar || !micAvailable) && (
          <motion.form
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onSubmit={handleSubmitText}
            className="mb-2.5 w-full max-w-sm flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#12171D]/85 backdrop-blur-xl border border-white/15 shadow-xl pointer-events-auto"
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <input
              id="input-text-message"
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={str.textPlaceholder}
              className={`flex-1 bg-transparent text-xs text-[#F4F1EA] placeholder-[#A7A39A]/60 outline-none px-2 py-1 ${
                isAr ? "font-['IBM_Plex_Sans_Arabic',sans-serif]" : "font-['IBM_Plex_Sans',sans-serif]"
              }`}
            />
            <button
              id="btn-send-message"
              type="submit"
              disabled={!textInput.trim()}
              className="px-3.5 py-1.5 rounded-full bg-[#E0A94A] text-black text-[11px] font-semibold tracking-wider hover:bg-[#E0A94A]/90 disabled:opacity-30 transition-all active:scale-95 shadow-sm"
            >
              {str.sendText}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Main Glass Bar (64px) */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="h-16 w-full max-w-sm rounded-full bg-[#12171D]/65 backdrop-blur-[18px] border border-white/10 shadow-2xl px-4 flex items-center justify-between pointer-events-auto"
      >
        {/* Language Switch (Left) */}
        <button
          id="btn-switch-language"
          onClick={onSwitchLanguage}
          title="Switch Language"
          className="px-3 py-1.5 rounded-full text-xs font-medium text-[#F4F1EA]/80 hover:text-[#F4F1EA] hover:bg-white/[0.06] transition-all active:scale-95 flex items-center gap-1"
        >
          <span className="font-['IBM_Plex_Sans_Arabic',sans-serif]">
            {str.switchLanguage}
          </span>
        </button>

        {/* Center: Mic Mute / Unmute / Text trigger */}
        <button
          id="btn-toggle-mute"
          onClick={() => {
            if (micAvailable) {
              onToggleMute();
            } else {
              setShowInputBar((prev) => !prev);
            }
          }}
          title={
            !micAvailable
              ? str.noMicNotice
              : isMuted
              ? str.unmute
              : str.mute
          }
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 shadow-md ${
            !micAvailable
              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
              : isMuted
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
              : state === 'listening'
              ? 'bg-[#2FA98B]/25 text-[#2FA98B] border border-[#2FA98B]/60 shadow-[0_0_15px_rgba(47,169,139,0.3)]'
              : 'bg-white/10 text-[#F4F1EA] border border-white/15 hover:bg-white/15'
          }`}
        >
          {!micAvailable ? (
            <svg
              className="w-5 h-5"
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
                x1="4"
                y1="4"
                x2="20"
                y2="20"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
              />
            </svg>
          ) : isMuted ? (
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          )}
        </button>

        {/* Right side: Keyboard toggle, CC toggle, and End conversation */}
        <div className="flex items-center gap-1.5">
          {/* Toggle text input */}
          <button
            id="btn-toggle-input"
            onClick={() => setShowInputBar((prev) => !prev)}
            title="Type a message"
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
              showInputBar
                ? 'bg-white/20 text-[#F4F1EA] border border-white/30'
                : 'text-[#A7A39A] hover:text-[#F4F1EA] hover:bg-white/[0.06]'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </button>

          <button
            id="btn-toggle-captions"
            onClick={onToggleCaptions}
            title={captionsVisible ? str.captionsOn : str.captionsOff}
            className={`w-8 h-8 rounded-full text-xs font-semibold flex items-center justify-center transition-all ${
              captionsVisible
                ? 'bg-white/20 text-[#F4F1EA] border border-white/30'
                : 'text-[#A7A39A] hover:text-[#F4F1EA] hover:bg-white/[0.06]'
            }`}
          >
            {str.captionsToggle}
          </button>

          {/* Sound bed mute toggle */}
          <button
            id="btn-toggle-sound-bed"
            onClick={handleToggleSoundBed}
            title={bedMuted ? 'Unmute ambient sound bed' : 'Mute ambient sound bed'}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
              !bedMuted
                ? 'text-[#E0A94A] hover:bg-white/[0.06]'
                : 'text-[#A7A39A]/60 hover:text-[#A7A39A] hover:bg-white/[0.06]'
            }`}
          >
            {!bedMuted ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M11 5L6 9H2v6h4l5 4V5z"
                />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                />
              </svg>
            )}
          </button>

          <button
            id="btn-end-conversation"
            onClick={onEndConversation}
            title={str.endConversation}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#A7A39A] hover:text-rose-400 hover:bg-rose-500/10 transition-all"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
