/**
 * Savannah Phase 1 - Global Configuration
 */

export const LIVE_MODEL = 'gemini-3.1-flash-live-preview';
// Can be switched to 'gemini-2.5-flash-native-audio-preview-12-2025' without touching other code

export const ALLOWED_VOICES = ['Aoede', 'Kore', 'Leda', 'Sulafat', 'Despina'] as const;
export type PrebuiltVoice = typeof ALLOWED_VOICES[number];

export const DEFAULT_VOICE: PrebuiltVoice = 'Aoede';

export function getVoiceFromUrl(): PrebuiltVoice {
  if (typeof window === 'undefined') return DEFAULT_VOICE;
  const params = new URLSearchParams(window.location.search);
  const v = params.get('voice');
  if (v && (ALLOWED_VOICES as readonly string[]).includes(v)) {
    return v as PrebuiltVoice;
  }
  return DEFAULT_VOICE;
}

export const SESSION_CAP_MS = 10 * 60 * 1000; // 10 minutes hard cap
export const IDLE_WARNING_MS = 90 * 1000; // 90 seconds idle
export const IDLE_TIMEOUT_MS = 120 * 1000; // 120 seconds total before graceful end
export const SILENCE_CHIP_TRIGGER_MS = 6000; // 6 seconds silence before suggestion chips float

export const AUDIO_SAMPLE_RATE_INPUT = 16000; // Gemini Live requires 16 kHz PCM16 mono input
export const AUDIO_SAMPLE_RATE_OUTPUT = 24000; // Gemini Live outputs 24 kHz PCM16

export const PARTICLE_COUNT_DESKTOP = 40000;
export const PARTICLE_COUNT_MOBILE = 24000;

export const VAD_SETTINGS = {
  silenceDurationMs: 600,
};

export type PresenceState = 'idle' | 'listening' | 'thinking' | 'speaking';
export type SupportedLang = 'en' | 'ar';
