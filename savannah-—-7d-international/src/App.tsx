import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Stage } from './stage/Stage';
import { LiveSession } from './voice/LiveSession';
import { bus } from './state/bus';
import { SupportedLang, PresenceState, getVoiceFromUrl } from './config';
import { Arrival } from './ui/Arrival';
import { LanguagePick } from './ui/LanguagePick';
import { PermissionCard } from './ui/PermissionCard';
import { Captions } from './ui/Captions';
import { Chips } from './ui/Chips';
import { ControlBar } from './ui/ControlBar';
import { EndedModal } from './ui/EndedModal';
import { FactCard } from './ui/FactCard';
import { StoryBar, StoryStateData } from './ui/StoryBar';
import { WorldOverlay } from './ui/WorldOverlay';

type AppPhase = 'arrival' | 'pick_language' | 'active' | 'permission_error' | 'ended';

export default function App() {
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const sessionRef = useRef<LiveSession | null>(null);

  const [stageInstance, setStageInstance] = useState<Stage | null>(null);
  const [phase, setPhase] = useState<AppPhase>('arrival');
  const [lang, setLang] = useState<SupportedLang>('en');
  const [presenceState, setPresenceState] = useState<PresenceState>('idle');
  const [captionText, setCaptionText] = useState('');
  const [userCaptionText, setUserCaptionText] = useState('');
  const [captionsVisible, setCaptionsVisible] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showChips, setShowChips] = useState(false);
  const [dynamicChips, setDynamicChips] = useState<string[]>([]);
  const [factCard, setFactCard] = useState<any | null>(null);
  const [storyState, setStoryState] = useState<StoryStateData | null>(null);
  const [micAvailable, setMicAvailable] = useState(true);
  const [micErrorType, setMicErrorType] = useState<string | null>(null);

  // Initialize Three.js Stage
  useEffect(() => {
    if (!stageContainerRef.current) return;

    const stage = new Stage(stageContainerRef.current);
    stageRef.current = stage;
    setStageInstance(stage);

    // Bus event listeners
    const unsubState = bus.on('state', (st) => setPresenceState(st));
    const unsubCaption = bus.on('caption', (text) => {
      setCaptionText(text);
      stage.cueDirector?.feedTranscript(text);
    });
    const unsubUserCaption = bus.on('userCaption', (text) => setUserCaptionText(text));
    const unsubMuted = bus.on('muted', (m) => setIsMuted(m));
    const unsubLang = bus.on('lang', (l) => setLang(l));
    const unsubReconnecting = bus.on('reconnecting', (r) => setIsReconnecting(r));
    const unsubMicAvail = bus.on('micAvailable', (avail) => {
      setMicAvailable(avail);
      if (!avail) setShowChips(true);
    });
    const unsubFactCard = bus.on('show_fact_card', (card) => {
      setFactCard(card);
    });
    const unsubChips = bus.on('suggest_questions', (chips) => {
      if (chips && chips.length > 0) {
        setDynamicChips(chips);
        setShowChips(true);
      }
    });
    const unsubStory = bus.on('story_state', (st) => {
      setStoryState(st);
    });
    const unsubError = bus.on('error', (err) => {
      if (err === 'MIC_PERMISSION_DENIED') {
        setMicErrorType('MIC_PERMISSION_DENIED');
        setPhase((prev) => (prev === 'active' ? prev : 'permission_error'));
      } else if (err === 'MIC_NOT_FOUND') {
        setMicErrorType('MIC_NOT_FOUND');
        setMicAvailable(false);
        setShowChips(true);
      }
    });
    const unsubEnded = bus.on('sessionEnded', () => {
      setPhase('ended');
      setFactCard(null);
      setStoryState(null);
      if (stageRef.current) {
        // Fold presence back to point of light
        stageRef.current.presence.setDisplayScale(0.08);
      }
    });

    return () => {
      unsubState();
      unsubCaption();
      unsubUserCaption();
      unsubMuted();
      unsubLang();
      unsubReconnecting();
      unsubMicAvail();
      unsubFactCard();
      unsubChips();
      unsubStory();
      unsubError();
      unsubEnded();

      if (sessionRef.current) {
        sessionRef.current.dispose();
      }
      stage.dispose();
    };
  }, []);

  // Update HTML dir attribute when language changes
  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  // Adjust presence scale depending on app phase
  useEffect(() => {
    if (!stageRef.current) return;
    if (phase === 'arrival') {
      stageRef.current.presence.setDisplayScale(0.85);
    } else if (phase === 'active') {
      stageRef.current.presence.setDisplayScale(1.0);
    } else if (phase === 'ended') {
      stageRef.current.presence.setDisplayScale(0.08);
    }
  }, [phase]);

  // Start live session with chosen language
  const startConversation = useCallback(
    async (selectedLang: SupportedLang) => {
      setLang(selectedLang);
      const voice = getVoiceFromUrl();

      if (sessionRef.current) {
        sessionRef.current.dispose();
      }

      const session = new LiveSession(selectedLang, voice);
      sessionRef.current = session;

      session.setOnSilenceStateChange((visible) => {
        setShowChips(visible);
      });

      setPhase('active');
      setCaptionText('');
      setUserCaptionText('');
      setIsMuted(false);
      setShowChips(false);

      try {
        await session.start();
      } catch (err) {
        console.error('Failed to start LiveSession:', err);
      }
    },
    []
  );

  const handleTapToMeet = () => {
    setPhase('pick_language');
  };

  const handleCancelPick = () => {
    setPhase('arrival');
  };

  const handleToggleMute = () => {
    if (sessionRef.current) {
      const nextMuted = !isMuted;
      sessionRef.current.mic.setMuted(nextMuted);
      setIsMuted(nextMuted);
    }
  };

  const handleSwitchLanguage = async () => {
    const nextLang: SupportedLang = lang === 'en' ? 'ar' : 'en';
    setLang(nextLang);
    setShowChips(false);
    if (sessionRef.current) {
      await sessionRef.current.switchLanguage(nextLang);
    }
  };

  const handleToggleCaptions = () => {
    setCaptionsVisible((prev) => !prev);
  };

  const handleSelectChip = (chipText: string) => {
    if (sessionRef.current) {
      setShowChips(false);
      sessionRef.current.sendTextInput(chipText);
    }
  };

  const handleEndConversation = () => {
    if (sessionRef.current) {
      sessionRef.current.endSession('USER_DISMISSED');
    }
    setPhase('ended');
  };

  const handleTalkAgain = () => {
    setPhase('pick_language');
    if (stageRef.current) {
      stageRef.current.presence.setDisplayScale(0.85);
      stageRef.current.presence.setState('idle');
    }
  };

  const handleRetryMic = () => {
    startConversation(lang);
  };

  return (
    <main
      id="savannah-app"
      className="relative w-screen h-screen overflow-hidden select-none bg-[#050608]"
    >
      {/* Three.js canvas & 2D Film Grain container */}
      <div
        ref={stageContainerRef}
        id="stage-canvas-container"
        className="absolute inset-0 w-full h-full"
      />

      {/* Persistent subtle top brand mark during active conversation */}
      {phase === 'active' && (
        <header
          id="active-header"
          className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center px-6 py-5 pointer-events-none"
        >
          <div className="flex items-center gap-2.5">
            <img
              src="/brand/7d-logo.svg"
              alt="7D International"
              className="h-5 w-auto object-contain opacity-70"
            />
          </div>

          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/5 backdrop-blur-sm">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                presenceState === 'speaking'
                  ? 'bg-[#E0A94A] shadow-[0_0_6px_#E0A94A]'
                  : presenceState === 'listening'
                  ? 'bg-[#2FA98B] shadow-[0_0_6px_#2FA98B]'
                  : 'bg-white/40'
              }`}
            />
            <span className="font-['Michroma',sans-serif] text-[9px] tracking-[0.2em] text-[#A7A39A]">
              SAVANNAH
            </span>
          </div>
        </header>
      )}

      {/* Phase 1: Arrival Screen */}
      {phase === 'arrival' && <Arrival onTapToMeet={handleTapToMeet} />}

      {/* Phase 2: Language Selection Modal */}
      {phase === 'pick_language' && (
        <LanguagePick
          onSelectLanguage={startConversation}
          onCancel={handleCancelPick}
        />
      )}

      {/* Phase 3: Active Conversation Elements */}
      {phase === 'active' && (
        <>
          {/* Story mode floating progress bar */}
          <StoryBar
            storyState={storyState}
            lang={lang}
            onSendAction={(action) => {
              if (action === 'next') sessionRef.current?.sendTextInput(lang === 'ar' ? 'الفصل التالي' : 'Next chapter');
              if (action === 'previous') sessionRef.current?.sendTextInput(lang === 'ar' ? 'الفصل السابق' : 'Previous chapter');
              if (action === 'resume') sessionRef.current?.sendTextInput(lang === 'ar' ? 'استمر في القصة' : 'Continue the story');
              if (action === 'stop') sessionRef.current?.sendTextInput(lang === 'ar' ? 'توقف عن القصة' : 'Stop the story');
            }}
          />

          {/* 3D Cinematic World Overlay */}
          <WorldOverlay
            stage={stageInstance}
            lang={lang}
            onAskQuestion={(q) => sessionRef.current?.sendTextInput(q)}
          />

          {/* Interactive Fact Card overlay */}
          {factCard && (
            <div className="absolute inset-0 z-20 flex items-center justify-center p-4 pointer-events-none">
              <FactCard
                card={factCard}
                onClose={() => setFactCard(null)}
                onAskQuestion={(q) => sessionRef.current?.sendTextInput(q)}
                lang={lang}
              />
            </div>
          )}

          {/* Suggestion chips after 6s silence, after tool triggers, or persistent when mic not detected */}
          <Chips
            lang={lang}
            customChips={dynamicChips}
            visible={
              !factCard &&
              (showChips || !micAvailable) &&
              (presenceState === 'listening' || presenceState === 'idle')
            }
            onSelectChip={handleSelectChip}
          />

          {/* Subtitle Captions */}
          <Captions
            text={captionText}
            userText={userCaptionText}
            lang={lang}
            visible={captionsVisible}
          />

          {/* Bottom Glass Control Bar */}
          <ControlBar
            lang={lang}
            state={presenceState}
            isMuted={isMuted}
            captionsVisible={captionsVisible}
            isReconnecting={isReconnecting}
            micAvailable={micAvailable}
            onToggleMute={handleToggleMute}
            onSwitchLanguage={handleSwitchLanguage}
            onToggleCaptions={handleToggleCaptions}
            onEndConversation={handleEndConversation}
            onSendText={(text) => sessionRef.current?.sendTextInput(text)}
          />
        </>
      )}

      {/* Permission Denied or No Mic Detected Card */}
      {phase === 'permission_error' && (
        <PermissionCard
          lang={lang}
          isNoDevice={micErrorType === 'MIC_NOT_FOUND'}
          onRetry={handleRetryMic}
          onContinueWithoutMic={() => {
            setPhase('active');
            setShowChips(true);
          }}
          onCancel={() => setPhase('arrival')}
        />
      )}

      {/* Session Ended Screen */}
      {phase === 'ended' && (
        <EndedModal lang={lang} onTalkAgain={handleTalkAgain} />
      )}
    </main>
  );
}
