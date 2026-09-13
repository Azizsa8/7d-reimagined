import { bus } from '../state/bus';

interface Queued {
  text: string;
  at: number; // playback clock time at which to reveal
}

const SPLIT = /([.!?؟،؛]+["»”)]?\s|\n)/;

/**
 * Phrase-level captions revealed on the playback clock. Output transcription
 * arrives a little ahead of its audio; each phrase is stamped with the time at
 * which all audio queued before it will have played, and shown then. Arabic
 * punctuation splits phrases as well as Latin.
 */
export class CaptionManager {
  private pending = '';
  private queue: Queued[] = [];
  private timer: number | null = null;
  private shownText = '';
  /** Full text of the model turn so far (for the transcript drawer). */
  public turnText = '';

  constructor(private clock: () => number, private queuedUntil: () => number) {
    this.timer = window.setInterval(() => this.tick(), 40);
  }

  onModelText(chunk: string) {
    this.pending += chunk;
    this.turnText += chunk;
    const stamp = this.queuedUntil();
    let m: RegExpMatchArray | null;
    // Emit every complete phrase; keep the tail.
    while ((m = this.pending.match(SPLIT)) && m.index !== undefined) {
      const end = m.index + m[0].length;
      const phrase = this.pending.slice(0, end).trim();
      this.pending = this.pending.slice(end);
      if (phrase) this.queue.push({ text: phrase, at: stamp });
    }
    // Very long unpunctuated runs: reveal by length so the visitor is never left blank.
    if (this.pending.length > 90) {
      const cut = this.pending.lastIndexOf(' ', 90);
      if (cut > 20) {
        this.queue.push({ text: this.pending.slice(0, cut).trim(), at: stamp });
        this.pending = this.pending.slice(cut + 1);
      }
    }
  }

  /** Called on turnComplete: flush whatever is left, aligned to the end of audio. */
  flushTurn() {
    const tail = this.pending.trim();
    if (tail) this.queue.push({ text: tail, at: this.queuedUntil() - 0.3 });
    this.pending = '';
    const finalText = this.turnText.trim();
    this.turnText = '';
    if (finalText) bus.emit('transcriptTurn', { role: 'model', text: finalText });
  }

  private tick() {
    const now = this.clock();
    let next: Queued | null = null;
    while (this.queue.length && this.queue[0].at <= now + 0.05) next = this.queue.shift()!;
    if (next && next.text !== this.shownText) {
      this.shownText = next.text;
      bus.emit('caption', { text: next.text });
    }
  }

  /** Barge-in: drop what has not been heard. */
  interrupt() {
    this.queue = [];
    this.pending = '';
    const partial = this.turnText.trim();
    this.turnText = '';
    if (partial) bus.emit('transcriptTurn', { role: 'model', text: partial + ' —' });
    this.shownText = '';
    bus.emit('caption', { text: '' });
  }

  clear() {
    this.interrupt();
    bus.emit('userCaption', '');
  }

  dispose() {
    if (this.timer) clearInterval(this.timer);
  }
}
