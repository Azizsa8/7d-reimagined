/**
 * Savannah — client configuration. Every tunable lives here.
 */
export const LIVE_MODEL = 'gemini-3.1-flash-live-preview';
// Switch to 'gemini-2.5-flash-native-audio-preview-12-2025' by changing this constant
// (and LIVE_MODEL on the server, which is the one that is actually locked into the token).

export const ALLOWED_VOICES = ['Aoede', 'Kore', 'Leda', 'Sulafat', 'Despina'] as const;
export type PrebuiltVoice = (typeof ALLOWED_VOICES)[number];
export const DEFAULT_VOICE: PrebuiltVoice = 'Aoede';

export type SupportedLang = 'en' | 'ar';
export type PresenceState = 'idle' | 'listening' | 'thinking' | 'speaking';

export const AUDIO_SAMPLE_RATE_INPUT = 16000;
export const AUDIO_SAMPLE_RATE_OUTPUT = 24000;

export const SESSION = {
  capMs: 12 * 60 * 1000, // Phase 4: 12 min hard cap
  warnAtMs: 11 * 60 * 1000, // Savannah warns at 11 min
  idleAskMs: 90 * 1000, // ask if still there
  idleCloseMs: 120 * 1000, // +30 s then close
  silenceChipsMs: 6000, // chips float after 6 s of silence while listening
  vadSilenceMs: 600,
  reconnectDelays: [500, 1000, 2000, 4000],
  backgroundKeepMs: 30 * 1000, // keep socket through short app switches
};

export const STAGE = {
  returnHomeAfterMs: 8000,
  minDwellMs: 2500,
  transitionSec: 1.2,
  cueDebounceMs: 3000,
};

export const REDUCED = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function getVoiceFromUrl(): PrebuiltVoice {
  if (typeof window === 'undefined') return DEFAULT_VOICE;
  const v = new URLSearchParams(window.location.search).get('voice');
  return v && (ALLOWED_VOICES as readonly string[]).includes(v) ? (v as PrebuiltVoice) : DEFAULT_VOICE;
}

export function pageNonce(): string {
  if (typeof document === 'undefined') return '';
  return document.querySelector('meta[name="savannah-nonce"]')?.getAttribute('content') || '';
}

export const PALETTE = {
  night: '#050608',
  panel: 'rgba(18,23,29,.55)',
  ivory: '#F4F1EA',
  dim: '#A7A39A',
  brass: '#E0A94A',
  sand: '#C8AA7C',
  teal: '#2FA98B',
  danger: '#E26D5A',
};
