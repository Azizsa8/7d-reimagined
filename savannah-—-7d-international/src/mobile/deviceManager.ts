import { bus } from '../state/bus';
import { soundDesign } from '../stage/audio/SoundDesign';

export interface TiltState {
  x: number; // smoothed -1 to +1 (corresponds to ±3°)
  y: number; // smoothed -1 to +1 (corresponds to ±3°)
  supported: boolean;
}

class DeviceManager {
  private wakeLock: any = null;
  private isReducedMotion = false;
  private tilt: TiltState = { x: 0, y: 0, supported: false };
  private targetTilt = { x: 0, y: 0 };
  private rafId: number | null = null;
  private headphonesConnected = false;

  // Noise detector
  private highNoiseStartTime = 0;
  private noisyHelperTriggered = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
        this.isReducedMotion = e.matches;
      });

      // Handle visibility changes for Wake Lock
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.reacquireWakeLock();
        } else {
          this.releaseWakeLock();
        }
      });

      // Monitor headphones via devicechange
      if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
        navigator.mediaDevices.addEventListener('devicechange', () => {
          this.checkAudioDevices();
        });
        this.checkAudioDevices();
      }

      // Smooth tilt loop
      this.startTiltLoop();

      // Listen to audio levels for noise helper
      bus.on('micLevel', (level) => {
        this.checkNoiseLevel(level);
      });

      // Listen to bus events for haptics
      bus.on('state', (st) => {
        if (st === 'speaking') {
          this.vibrate(8);
        }
      });

      bus.on('show_world', () => {
        this.vibrate([12, 40, 12]);
      });
    }
  }

  // Request fullscreen and device orientation permissions on first tap
  public async handleFirstUserGesture() {
    // 1. Fullscreen request (where supported)
    try {
      const docEl = document.documentElement as any;
      if (
        !document.fullscreenElement &&
        !(document as any).webkitFullscreenElement &&
        docEl.requestFullscreen
      ) {
        await docEl.requestFullscreen().catch(() => {});
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen().catch(() => {});
      }
    } catch {
      // Fullscreen not allowed or supported; safe fallback
    }

    // 2. iOS DeviceOrientation permission
    try {
      const DeviceOrientation = (window as any).DeviceOrientationEvent;
      if (DeviceOrientation && typeof DeviceOrientation.requestPermission === 'function') {
        const perm = await DeviceOrientation.requestPermission();
        if (perm === 'granted') {
          this.initOrientationListener();
        }
      } else {
        this.initOrientationListener();
      }
    } catch (e) {
      console.warn('DeviceOrientation error or not supported:', e);
    }
  }

  // Tilt listener
  private initOrientationListener() {
    if (typeof window === 'undefined' || this.isReducedMotion) return;

    window.addEventListener(
      'deviceorientation',
      (e) => {
        if (e.gamma === null || e.beta === null) return;
        this.tilt.supported = true;

        // gamma is left-to-right tilt (-90 to 90)
        // beta is front-to-back tilt (-180 to 180, typically ~30-60 when holding phone)
        const rawX = Math.max(-30, Math.min(30, e.gamma)) / 30; // normalized
        const neutralBeta = 45; // comfortable phone holding angle
        const rawY = Math.max(-30, Math.min(30, (e.beta - neutralBeta))) / 30;

        this.targetTilt.x = rawX;
        this.targetTilt.y = rawY;
      },
      { passive: true }
    );
  }

  private startTiltLoop() {
    const loop = () => {
      if (!this.isReducedMotion && this.tilt.supported) {
        // Smooth lerp (10% per frame)
        this.tilt.x += (this.targetTilt.x - this.tilt.x) * 0.08;
        this.tilt.y += (this.targetTilt.y - this.tilt.y) * 0.08;
      } else {
        this.tilt.x = 0;
        this.tilt.y = 0;
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  public getTilt(): { x: number; y: number } {
    return { x: this.tilt.x, y: this.tilt.y };
  }

  // Haptic feedback
  public vibrate(pattern: number | number[]) {
    if (this.isReducedMotion) return;
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch {
      // Ignored if device lacks vibration
    }
  }

  // Screen Wake Lock
  public async acquireWakeLock() {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    try {
      this.wakeLock = await (navigator as any).wakeLock.request('screen');
      this.wakeLock.addEventListener('release', () => {
        this.wakeLock = null;
      });
    } catch (err) {
      console.warn('Screen WakeLock error:', err);
    }
  }

  public async releaseWakeLock() {
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
      } catch {}
      this.wakeLock = null;
    }
  }

  private async reacquireWakeLock() {
    if (!this.wakeLock && typeof document !== 'undefined' && document.visibilityState === 'visible') {
      await this.acquireWakeLock();
    }
  }

  // Headphones check
  private async checkAudioDevices() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasHeadphones = devices.some(
        (d) =>
          d.kind === 'audiooutput' &&
          (d.label.toLowerCase().includes('headphone') ||
            d.label.toLowerCase().includes('airpods') ||
            d.label.toLowerCase().includes('buds') ||
            d.label.toLowerCase().includes('bluetooth'))
      );

      if (hasHeadphones !== this.headphonesConnected) {
        this.headphonesConnected = hasHeadphones;
        if (hasHeadphones) {
          // Headphones connected: enable bed boost +3 dB
          soundDesign.boostBed(1.41); // ~ +3 dB
        } else {
          soundDesign.boostBed(1.0);
        }
      }
    } catch {
      // Device labels require audio permissions or are restricted
    }
  }

  // Noisy environment helper
  private checkNoiseLevel(level: number) {
    const now = performance.now();
    if (level > 0.35) {
      if (!this.highNoiseStartTime) {
        this.highNoiseStartTime = now;
      } else if (now - this.highNoiseStartTime > 8000 && !this.noisyHelperTriggered) {
        this.noisyHelperTriggered = true;
        bus.emit('suggest_questions', [
          'Touch and hold Savannah to talk',
          'علّق يدك على سفانة وتكلم',
        ]);
      }
    } else if (level < 0.15) {
      this.highNoiseStartTime = 0;
    }
  }

  public resetNoiseHelper() {
    this.highNoiseStartTime = 0;
    this.noisyHelperTriggered = false;
  }
}

export const deviceManager = new DeviceManager();
