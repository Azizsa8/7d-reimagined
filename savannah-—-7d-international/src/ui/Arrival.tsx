import React from 'react';
import { motion } from 'motion/react';

interface ArrivalProps {
  onTapToMeet: () => void;
}

export const Arrival: React.FC<ArrivalProps> = ({ onTapToMeet }) => {
  return (
    <div
      id="arrival-screen"
      onClick={onTapToMeet}
      className="absolute inset-0 z-20 flex flex-col justify-between items-center py-10 px-6 cursor-pointer select-none"
    >
      {/* Top 7D Brand Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center gap-3 pt-4"
      >
        <img
          src="/brand/7d-logo.svg"
          alt="7D International"
          className="h-7 w-auto object-contain opacity-90"
        />
      </motion.header>

      {/* Center Spacer where Presence sphere breathes */}
      <div className="flex-1 w-full flex flex-col items-center justify-center pointer-events-none">
        {/* Luminous aura hint on hover/tap */}
        <div className="w-64 h-64 rounded-full bg-[#E0A94A]/5 blur-3xl" />
      </div>

      {/* Bottom Display Typography & CTA */}
      <motion.footer
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.0, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center text-center pb-8 max-w-sm pointer-events-auto"
      >
        <h1
          className="font-['Michroma',sans-serif] text-2xl tracking-[0.32em] text-[#F4F1EA] font-normal mb-1 drop-shadow-sm"
        >
          SAVANNAH
        </h1>
        <p className="text-[10px] tracking-[0.28em] text-[#A7A39A] uppercase mb-8">
          7D INTERNATIONAL · AI HOST
        </p>

        {/* Tap to meet button with soft pulse */}
        <button
          id="btn-tap-to-meet"
          onClick={onTapToMeet}
          className="group relative flex items-center justify-center px-8 py-3.5 rounded-full border border-[#E0A94A]/30 bg-[#0B0D12]/80 backdrop-blur-md text-sm text-[#F4F1EA] tracking-widest uppercase transition-all duration-300 hover:border-[#E0A94A]/70 hover:bg-[#E0A94A]/10 active:scale-95 shadow-lg shadow-black/40"
        >
          <span className="relative z-10 font-medium">Tap to meet her</span>
          <span className="absolute -inset-px rounded-full bg-gradient-to-r from-[#E0A94A]/0 via-[#E0A94A]/30 to-[#E0A94A]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </button>

        <span className="mt-3 text-xs text-[#A7A39A]/70 font-['IBM_Plex_Sans_Arabic',sans-serif] tracking-normal">
          المس الشاشة للقائها
        </span>
      </motion.footer>
    </div>
  );
};
