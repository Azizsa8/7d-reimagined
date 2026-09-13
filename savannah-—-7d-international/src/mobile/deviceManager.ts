import { bus } from '../state/bus';
import { REDUCED } from '../config';
import { soundDesign } from '../stage/audio/SoundDesign';

/**
 * The body of the phone (Phase 4 §1): fullscreen, wake lock, tilt, haptics,
 * headphones, noisy-room helper, install prompt.
 */
class DeviceManager {
  private wakeLock: any = null;
  private tilt = { x: 0, y: 0 };
  private target = { x: 0, y: 0 };
  private tiltEnabled = false;
  private onTilt?: (x: number, y: number) => void;
  private headphones = false;
  private noiseStart = 0;
  private noiseHinted = false;
  private installEvent: any = null;
  private sessionActive = false;

  constructor() {
    if (typeof window === 'undefined') return;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.sessionActive) this.acquireWakeLock();
    });
    navigator.mediaDevices?.addEventListener?.('devicechange', () => this.checkHeadphones());
    window.addEventListener('beforeinstallprompt', (e: any) => {
      e.preventDefault();
      this.installEvent = e;
    });
    bus.on('micLevel', (l) => this.noise(l));
    bus.on('state', (s) => {
      if (s === 'speaking') this.vibrate(8);
    });
    bus.on('worldActive', (w) => {
      if (w !== 'presence') this.vibrate([12, 40, 12]);
    });
    bus.on('enquiryResult', (r) => {
      if (r === 'sent') this.vibrate(20);
    });
    const loop = () => {
      if (this.tiltEnabled && !REDUCED) {
        this.tilt.x += (this.target.x - this.tilt.x) * 0.08;
        this.tilt.y += (this.target.y - this.tilt.y) * 0.08;
        this.onTilt?.(this.tilt.x, this.tilt.y);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /** Call from the first tap: fullscreen + iOS orientation permission. */
  async onFirstGesture() {
    const el = document.documentElement as any;
    try {
      if (!document.fullscreenElement && el.requestFullscreen && /Android/i.test(navigator.userAgent)) await el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    } catch {
      /* not supported */
    }
    try {
      const DOE = (window as any).DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === 'function') {
        const p = await DOE.requestPermission();
        if (p === 'granted') this.listenOrientation();
      } else this.listenOrientation();
    } catch {
      /* ignore */
    }
  }

  private listenOrientation() {
    if (REDUCED) return;
    window.addEventListener(
      'deviceorientation',
      (e) => {
        if (e.gamma == null || e.beta == null) return;
        this.tiltEnabled = true;
        this.target.x = Math.max(-1, Math.min(1, e.gamma / 30));
        this.target.y = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
      },
      { passive: true },
    );
  }

  setTiltHandler(fn: (x: number, y: number) => void) {
    this.onTilt = fn;
  }

  vibrate(pattern: number | number[]) {
    if (REDUCED) return;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* ignore */
    }
  }

  async sessionStarted() {
    this.sessionActive = true;
    await this.acquireWakeLock();
    this.checkHeadphones();
  }

  sessionEnded() {
    this.sessionActive = false;
    this.releaseWakeLock();
  }

  private async acquireWakeLock() {
    if (!('wakeLock' in navigator) || this.wakeLock) return;
    try {
      this.wakeLock = await (navigator as any).wakeLock.request('screen');
      this.wakeLock.addEventListener('release', () => (this.wakeLock = null));
    } catch {
      /* low battery or hidden */
    }
  }

  private async releaseWakeLock() {
    try {
      await this.wakeLock?.release();
    } catch {
      /* ignore */
    }
    this.wakeLock = null;
  }

  private async checkHeadphones() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const has = devices.some((d) => d.kind === 'audiooutput' && /headphone|airpods|buds|bluetooth|headset/i.test(d.label));
      if (has !== this.headphones) {
        this.headphones = has;
        soundDesign.setBoost(has ? 1.41 : 1);
      }
    } catch {
      /* labels need permission */
    }
  }

  /** If the mic stays loud without recognised speech for 8 s, suggest holding to talk. */
  private noise(level: number) {
    const now = performance.now();
    if (level > 0.4) {
      if (!this.noiseStart) this.noiseStart = now;
      else if (now - this.noiseStart > 8000 && !this.noiseHinted) {
        this.noiseHinted = true;
        bus.emit('toast', { text: 'NOISY', kind: 'info' });
      }
    } else if (level < 0.15) this.noiseStart = 0;
  }

  get canInstall() {
    return !!this.installEvent;
  }

  async promptInstall(): Promise<boolean> {
    if (!this.installEvent) return false;
    const ev = this.installEvent;
    this.installEvent = null;
    ev.prompt();
    const r = await ev.userChoice;
    return r?.outcome === 'accepted';
  }
}

export const deviceManager = new DeviceManager();
