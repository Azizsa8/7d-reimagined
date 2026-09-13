import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { bus } from '../state/bus';
import { Stage } from '../stage/Stage';
import { WorldName } from '../stage/SceneDirector';
import { HUBS } from '../stage/worlds/GlobeWorld';
import { SupportedLang } from '../config';
import { soundDesign } from '../stage/audio/SoundDesign';

interface WorldOverlayProps {
  stage: Stage | null;
  lang: SupportedLang;
  onAskQuestion?: (query: string) => void;
}

export const WorldOverlay: React.FC<WorldOverlayProps> = ({
  stage,
  lang,
  onAskQuestion,
}) => {
  const [activeWorld, setActiveWorld] = useState<WorldName>('presence');
  const [globeLabel, setGlobeLabel] = useState({ city: '', country: '', opacity: 0 });
  const [projectData, setProjectData] = useState<any>(null);
  const [timelineData, setTimelineData] = useState<any>(null);
  const [personData, setPersonData] = useState<any>(null);
  const [disciplineData, setDisciplineData] = useState<any>(null);
  const [figureData, setFigureData] = useState<any>(null);
  const [contactData, setContactData] = useState<any>(null);

  const isAr = lang === 'ar';

  useEffect(() => {
    const unsub = bus.on('show_world', (payload: { world: WorldName; params?: any }) => {
      setActiveWorld(payload.world);
      soundDesign.playClick();
    });

    // Poll current world state from Stage director
    const interval = setInterval(() => {
      if (!stage || !stage.director) return;
      const curr = stage.director.current();
      setActiveWorld(curr.name);

      if (curr.name === 'globe' && stage.director.globeWorld) {
        setGlobeLabel({ ...stage.director.globeWorld.activeHubLabel });
      } else if (curr.name === 'project' && stage.director.projectWorld) {
        setProjectData({ ...stage.director.projectWorld.overlay });
      } else if (curr.name === 'timeline' && stage.director.timelineWorld) {
        setTimelineData({ ...stage.director.timelineWorld.overlay });
      } else if (curr.name === 'people' && stage.director.peopleWorld) {
        setPersonData({ ...stage.director.peopleWorld.overlay });
      } else if (curr.name === 'disciplines' && stage.director.disciplinesWorld) {
        setDisciplineData({ ...stage.director.disciplinesWorld.overlay });
      } else if (curr.name === 'figure' && stage.director.figureWorld) {
        setFigureData({ ...stage.director.figureWorld.overlay });
      } else if (curr.name === 'contact' && stage.director.contactWorld) {
        setContactData({ ...stage.director.contactWorld.overlay });
      }
    }, 100);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [stage]);

  const handleReturnToPresence = () => {
    bus.emit('show_world', { world: 'presence' });
    soundDesign.playClick();
  };

  const handleHubClick = (hubId: string) => {
    if (stage?.director?.globeWorld) {
      stage.director.globeWorld.focusHub(hubId, lang);
      soundDesign.playClick();
    }
  };

  const handleProjectChipClick = (projectName: string) => {
    if (onAskQuestion) {
      const q = isAr ? `احكي لي عن ${projectName}` : `Tell me about ${projectName}`;
      onAskQuestion(q);
      soundDesign.playClick();
    }
  };

  if (activeWorld === 'presence') {
    return null;
  }

  return (
    <div
      id="world-overlay-container"
      className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-6 sm:p-10"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Top Bar: Return to Savannah presence button */}
      <div className="flex items-center justify-between w-full">
        <motion.button
          id="btn-return-presence"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={handleReturnToPresence}
          className="pointer-events-auto flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-xs text-[#F4F1EA] backdrop-blur-md transition-all active:scale-95 shadow-lg"
        >
          <span className="w-2 h-2 rounded-full bg-[#E0A94A] animate-pulse" />
          <span>{isAr ? 'العودة إلى سفانة' : 'Return to Savannah'}</span>
        </motion.button>

        {/* Ember indicator label */}
        <div className="text-[11px] font-mono tracking-widest text-[#E0A94A]/70 uppercase">
          7D · {activeWorld}
        </div>
      </div>

      {/* World-specific overlays */}
      <div className="w-full max-w-2xl mx-auto mb-20 pointer-events-auto">
        <AnimatePresence mode="wait">
          {/* 1. GLOBE WORLD OVERLAY */}
          {activeWorld === 'globe' && globeLabel.city && (
            <motion.div
              key="overlay-globe"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 rounded-2xl bg-[#0B0D12]/75 border border-[#E0A94A]/25 backdrop-blur-xl shadow-2xl"
            >
              <div className="flex flex-col gap-1">
                <div className="text-xs font-mono tracking-wider text-[#E0A94A] uppercase">
                  {isAr ? 'شبكة مراكز 7D العالمية' : '7D Global Hubs Network'}
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold font-['Michroma',sans-serif] text-[#F4F1EA]">
                  {globeLabel.city}
                </h2>
                <p className="text-sm text-[#A7A39A]">{globeLabel.country}</p>
              </div>

              {/* Quick Hub switcher pills */}
              <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-white/10">
                {HUBS.map((h) => (
                  <button
                    key={h.id}
                    id={`btn-hub-${h.id}`}
                    onClick={() => handleHubClick(h.id)}
                    className="px-3 py-1 rounded-full text-xs bg-white/[0.06] hover:bg-[#E0A94A]/20 hover:border-[#E0A94A]/40 border border-white/10 text-[#F4F1EA] transition-all"
                  >
                    {isAr ? h.cityAr : h.cityEn}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* 2. PROJECT WORLD OVERLAY */}
          {activeWorld === 'project' && projectData && (
            <motion.div
              key="overlay-project"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 rounded-2xl bg-[#0B0D12]/80 border border-[#E0A94A]/25 backdrop-blur-xl shadow-2xl"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-[#E0A94A] tracking-wider uppercase">
                  {projectData.location}
                </span>
                {projectData.isConcept && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {isAr ? 'تصميم مفاهيمي' : 'Concept Design'}
                  </span>
                )}
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold font-['Michroma',sans-serif] text-[#F4F1EA] tracking-wide">
                {projectData.name}
              </h2>
              <div
                className={`h-0.5 my-3 bg-gradient-to-r from-[#E0A94A] to-transparent transition-all duration-300 ${
                  projectData.pulseFact ? 'scale-y-150 brightness-150' : 'opacity-60'
                }`}
              />
              <p className="text-sm font-medium text-[#C8AA7C]">{projectData.role}</p>
            </motion.div>
          )}

          {/* 3. TIMELINE WORLD OVERLAY */}
          {activeWorld === 'timeline' && timelineData && (
            <motion.div
              key="overlay-timeline"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 rounded-2xl bg-[#0B0D12]/80 border border-[#E0A94A]/25 backdrop-blur-xl shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#E0A94A] text-black">
                  {timelineData.year}
                </span>
                <span className="text-xs font-mono text-[#A7A39A] uppercase tracking-wider">
                  {isAr ? 'محطة فارقة في تاريخ 7D' : '7D Milestone'}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-[#F4F1EA] mb-1">
                {timelineData.title}
              </h3>
              <p className="text-sm text-[#A7A39A] leading-relaxed">{timelineData.detail}</p>
            </motion.div>
          )}

          {/* 4. PEOPLE WORLD OVERLAY */}
          {activeWorld === 'people' && personData && (
            <motion.div
              key="overlay-people"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 rounded-2xl bg-[#0B0D12]/80 border border-[#E0A94A]/25 backdrop-blur-xl shadow-2xl flex items-start gap-4"
            >
              {/* Michroma Monogram in brass ring */}
              <div className="w-14 h-14 rounded-full border border-[#E0A94A] flex items-center justify-center bg-[#E0A94A]/10 shrink-0 shadow-[0_0_15px_rgba(224,169,74,0.3)]">
                <span className="font-['Michroma',sans-serif] text-base font-bold text-[#F4F1EA]">
                  {personData.initials}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex flex-col">
                  <h3 className="text-xl font-bold text-[#F4F1EA]">
                    {isAr ? personData.nameAr : personData.name}
                  </h3>
                  <span className="text-xs font-semibold text-[#E0A94A] mb-2">
                    {personData.title}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#A7A39A] leading-relaxed">
                  {personData.bio}
                </p>
              </div>
            </motion.div>
          )}

          {/* 5. DISCIPLINES WORLD OVERLAY */}
          {activeWorld === 'disciplines' && disciplineData && (
            <motion.div
              key="overlay-disciplines"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 rounded-2xl bg-[#0B0D12]/80 border border-[#2FA98B]/30 backdrop-blur-xl shadow-2xl"
            >
              <div className="text-xs font-mono text-[#2FA98B] tracking-wider uppercase mb-1">
                {isAr ? 'تخصصات سفن دي السبعة' : '7D Core Disciplines'}
              </div>
              <h3 className="text-2xl font-bold font-['Michroma',sans-serif] text-[#F4F1EA] mb-2">
                {disciplineData.name}
              </h3>
              <p className="text-sm text-[#A7A39A] leading-relaxed mb-4">
                {disciplineData.summary}
              </p>

              {/* Related project chips */}
              {disciplineData.relatedProjects && disciplineData.relatedProjects.length > 0 && (
                <div>
                  <div className="text-[11px] text-[#C8AA7C] font-semibold mb-2">
                    {isAr ? 'مشاريع مرتبطة (انقر للسؤال عنها):' : 'Related Projects (tap to explore):'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {disciplineData.relatedProjects.map((proj: string, idx: number) => (
                      <button
                        key={idx}
                        id={`btn-disc-proj-${idx}`}
                        onClick={() => handleProjectChipClick(proj)}
                        className="px-3 py-1 rounded-full text-xs bg-[#2FA98B]/15 hover:bg-[#2FA98B]/30 border border-[#2FA98B]/40 text-[#F4F1EA] transition-all"
                      >
                        {proj}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* 6. FIGURE WORLD OVERLAY */}
          {activeWorld === 'figure' && figureData && (
            <motion.div
              key="overlay-figure"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 rounded-2xl bg-[#0B0D12]/80 border border-[#E0A94A]/25 backdrop-blur-xl shadow-2xl text-center"
            >
              <div className="text-4xl sm:text-5xl font-bold font-['Michroma',sans-serif] text-[#E0A94A] mb-2">
                {figureData.value}
              </div>
              <h3 className="text-lg font-semibold text-[#F4F1EA] mb-1">
                {figureData.label}
              </h3>
              <p className="text-xs sm:text-sm text-[#A7A39A]">
                {figureData.detail}
              </p>
            </motion.div>
          )}

          {/* 7. CONTACT WORLD OVERLAY */}
          {activeWorld === 'contact' && contactData && (
            <motion.div
              key="overlay-contact"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 rounded-2xl bg-[#0B0D12]/85 border border-[#E0A94A]/30 backdrop-blur-xl shadow-2xl"
            >
              <div className="text-xs font-mono text-[#E0A94A] tracking-wider uppercase mb-1">
                {isAr ? 'قنوات التواصل الرسمية' : 'Official Channels'}
              </div>
              <h3 className="text-2xl font-bold font-['Michroma',sans-serif] text-[#F4F1EA] mb-4">
                7D International
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a
                  href={`mailto:${contactData.generalEmail}`}
                  className="p-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 transition-all flex flex-col"
                >
                  <span className="text-[11px] text-[#C8AA7C] font-mono">
                    {isAr ? 'البريد العام' : 'General Inquiries'}
                  </span>
                  <span className="text-sm font-semibold text-[#F4F1EA] truncate">
                    {contactData.generalEmail}
                  </span>
                </a>

                <a
                  href={`mailto:${contactData.chairmanEmail}`}
                  className="p-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 transition-all flex flex-col"
                >
                  <span className="text-[11px] text-[#C8AA7C] font-mono">
                    {isAr ? 'مكتب رئيس مجلس الإدارة' : "Chairman's Office"}
                  </span>
                  <span className="text-sm font-semibold text-[#F4F1EA] truncate">
                    {contactData.chairmanEmail}
                  </span>
                </a>

                <a
                  href={contactData.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 transition-all flex flex-col"
                >
                  <span className="text-[11px] text-[#C8AA7C] font-mono">
                    {isAr ? 'الموقع الرسمي' : 'Official Website'}
                  </span>
                  <span className="text-sm font-semibold text-[#F4F1EA]">
                    {contactData.website}
                  </span>
                </a>

                <div className="p-3 rounded-xl bg-white/[0.05] border border-white/10 flex flex-col">
                  <span className="text-[11px] text-[#C8AA7C] font-mono">
                    {isAr ? 'مقر الرياض' : 'Riyadh Headquarters'}
                  </span>
                  <span className="text-xs text-[#F4F1EA] leading-snug">
                    {contactData.riyadhOffice}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
