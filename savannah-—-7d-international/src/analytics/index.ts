/**
 * Privacy-preserving analytics: names, ids, durations and codes only.
 * Never audio, never transcript text.
 */
type EventName =
  | 'arrive' | 'tap_start' | 'lang_selected' | 'mic_granted' | 'mic_denied' | 'first_audio_ms' | 'turn' | 'interrupt'
  | 'world_shown' | 'chip_tapped' | 'enquiry_started' | 'enquiry_sent' | 'session_end' | 'error' | 'tool_call' | 'topic';

interface Payload {
  lang?: 'en' | 'ar';
  value?: number | string;
  world?: string;
  id?: string;
  duration?: number;
  turns?: number;
  code?: string;
}

const queue: Array<{ name: EventName } & Payload & { ts: number }> = [];
let flushTimer: number | null = null;

export function track(name: EventName, payload: Payload = {}) {
  queue.push({ name, ...payload, ts: Date.now() });
  if (flushTimer === null) flushTimer = window.setTimeout(flush, 1500);
}

function flush() {
  flushTimer = null;
  const batch = queue.splice(0, queue.length);
  for (const ev of batch) {
    try {
      const body = JSON.stringify(ev);
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/analytics', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/api/analytics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
      }
    } catch {
      /* analytics never breaks the experience */
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
}
