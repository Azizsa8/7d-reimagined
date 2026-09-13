import React from 'react';

const P: React.FC<React.SVGProps<SVGSVGElement>> = ({ children, ...rest }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
    {children}
  </svg>
);

/** Custom stroke icons, 1.5 px, rounded. No icon library. */
export const MicIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <P {...p}>
    <rect x="9" y="3.5" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
    <path d="M12 18v2.5" />
  </P>
);
export const MicOffIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <P {...p}>
    <rect x="9" y="3.5" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
    <path d="M12 18v2.5" />
    <path d="M4.5 4.5l15 15" />
  </P>
);
export const CloseIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <P {...p}>
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </P>
);
export const CaptionsIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <P {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="3" />
    <path d="M7.5 12h5M7.5 15h9" />
  </P>
);
export const SoundIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <P {...p}>
    <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" />
    <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5" />
    <path d="M18 7a7 7 0 0 1 0 10" />
  </P>
);
export const SoundOffIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <P {...p}>
    <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" />
    <path d="M16 10l4 4M20 10l-4 4" />
  </P>
);
export const TranscriptIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <P {...p}>
    <path d="M5 6.5h14M5 10.5h14M5 14.5h9" />
    <path d="M5 18.5h6" />
  </P>
);
export const MailIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <P {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
    <path d="M4 7l8 6 8-6" />
  </P>
);
export const PhoneIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <P {...p}>
    <path d="M6.5 3.5h3l1.5 4-2 1.5a10 10 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 4.5 5.5a2 2 0 0 1 2-2z" />
  </P>
);
export const GlobeIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <P {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17" />
  </P>
);
export const PinIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <P {...p}>
    <path d="M12 21s6-5.5 6-11a6 6 0 0 0-12 0c0 5.5 6 11 6 11z" />
    <circle cx="12" cy="10" r="2" />
  </P>
);
export const PlayIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <P {...p}>
    <path d="M8 5.5v13l10-6.5z" />
  </P>
);
export const PauseIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <P {...p}>
    <path d="M8.5 5.5v13M15.5 5.5v13" />
  </P>
);
export const StopIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <P {...p}>
    <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" />
  </P>
);
export const KeyboardIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <P {...p}>
    <rect x="3.5" y="7" width="17" height="10" rx="2" />
    <path d="M7 10.5h.01M10.5 10.5h.01M14 10.5h.01M17 10.5h.01M8 14h8" />
  </P>
);
export const ArrowIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <P {...p}>
    <path d="M6 12h12M13 7l5 5-5 5" />
  </P>
);
