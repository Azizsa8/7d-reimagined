import { bus } from '../state/bus';

interface QueuedPhrase {
  text: string;
  revealTime: number;
}

export class CaptionManager {
  private currentFullText = '';
  private currentPhrase = '';
  private phraseQueue: QueuedPhrase[] = [];
  private checkInterval: number | null = null;
  private getCurrentClockTime: () => number;

  constructor(getClock: () => number) {
    this.getCurrentClockTime = getClock;
    this.startClockCheck();
  }

  private startClockCheck() {
    this.checkInterval = window.setInterval(() => {
      const now = this.getCurrentClockTime();
      while (this.phraseQueue.length > 0 && this.phraseQueue[0].revealTime <= now) {
        const next = this.phraseQueue.shift();
        if (next) {
          this.currentPhrase = next.text;
          bus.emit('caption', this.currentPhrase);
        }
      }
    }, 50);
  }

  /**
   * Called when server streams model turn transcription text
   */
  public onModelTextChunk(chunk: string, audioEstimatedStartTime?: number) {
    this.currentFullText += chunk;

    // Split on Latin or Arabic punctuation boundaries
    // Arabic: ، ؛ ؟ .  Latin: , ; ? ! . \n
    const delimiterRegex = /([.!?,;\n،؛؟])/g;
    const parts = this.currentFullText.split(delimiterRegex);

    if (parts.length > 1) {
      // We have at least one complete phrase
      let completedPhrase = '';
      for (let i = 0; i < parts.length - 1; i += 2) {
        const sentence = (parts[i] + (parts[i + 1] || '')).trim();
        if (sentence) {
          completedPhrase += (completedPhrase ? ' ' : '') + sentence;
        }
      }

      this.currentFullText = parts[parts.length - 1] || '';

      if (completedPhrase) {
        const reveal = audioEstimatedStartTime || this.getCurrentClockTime();
        this.phraseQueue.push({
          text: completedPhrase,
          revealTime: reveal,
        });

        // If queue was empty, show immediately
        if (this.phraseQueue.length === 1 && this.phraseQueue[0].revealTime <= this.getCurrentClockTime() + 0.1) {
          this.currentPhrase = this.phraseQueue.shift()!.text;
          bus.emit('caption', this.currentPhrase);
        }
      }
    } else {
      // For immediate responsiveness if no punctuation arrived yet
      if (!this.currentPhrase && this.currentFullText.trim().length > 0) {
        bus.emit('caption', this.currentFullText.trim());
      }
    }
  }

  /**
   * Called when user speech transcription arrives
   */
  public onUserTextChunk(text: string) {
    bus.emit('userCaption', text);
  }

  /**
   * Barge-in interruption: immediately wipe pending phrases and hide captions
   */
  public interrupt() {
    this.phraseQueue = [];
    this.currentFullText = '';
    this.currentPhrase = '';
    bus.emit('caption', '');
  }

  public clear() {
    this.interrupt();
    bus.emit('userCaption', '');
  }

  public dispose() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}
