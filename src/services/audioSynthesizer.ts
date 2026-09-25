/**
 * Web Audio API synthesizer for metal detector tone & geiger feedback
 */
class DetectorAudioService {
  private ctx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isMuted: boolean = false;
  private currentFrequency: number = 300;
  private lastGeigerClick: number = 0;
  private isInitialized: boolean = false;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public unlockAudio() {
    this.initContext();
    if (this.ctx && !this.isInitialized) {
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.01);
        this.isInitialized = true;
      } catch {
        // audio unlock fallback
      }
    }
  }

  public updateTone(netStrength: number, mode: 'tone' | 'geiger' = 'tone', enabled: boolean = true, volume: number = 0.5) {
    if (!enabled || volume <= 0) {
      this.stopContinuousTone();
      return;
    }

    this.initContext();
    if (!this.ctx) return;

    if (netStrength <= 2) {
      this.stopContinuousTone();
      return;
    }

    if (mode === 'geiger') {
      this.stopContinuousTone();
      const now = performance.now();
      // interval decreases as signal increases (from 800ms down to 40ms)
      const interval = Math.max(35, 700 - Math.min(650, netStrength * 7));
      if (now - this.lastGeigerClick > interval) {
        this.lastGeigerClick = now;
        this.playGeigerClick(volume, netStrength);
      }
      return;
    }

    // Continuous tone mode: frequency scales between 250Hz and 1800Hz
    const targetFreq = Math.min(1800, 260 + netStrength * 12);
    const targetGain = Math.min(0.7, (volume * 0.4) * (0.3 + Math.min(0.7, netStrength / 50)));

    if (!this.oscillator) {
      try {
        this.oscillator = this.ctx.createOscillator();
        this.oscillator.type = 'sawtooth';
        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.setValueAtTime(0.001, this.ctx.currentTime);
        this.gainNode.gain.linearRampToValueAtTime(targetGain, this.ctx.currentTime + 0.05);

        this.oscillator.frequency.setValueAtTime(targetFreq, this.ctx.currentTime);
        this.oscillator.connect(this.gainNode);
        this.gainNode.connect(this.ctx.destination);
        this.oscillator.start();
      } catch {
        this.oscillator = null;
        this.gainNode = null;
      }
    } else if (this.gainNode && this.ctx) {
      try {
        this.oscillator.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.04);
        this.gainNode.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.04);
      } catch {
        // ignore audio param timing error
      }
    }
  }

  private playGeigerClick(volume: number, strength: number) {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const clickPitch = 600 + Math.min(1000, strength * 10);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(clickPitch, this.ctx.currentTime);

      const targetGain = volume * 0.5;
      gain.gain.setValueAtTime(targetGain, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.025);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.03);
    } catch {
      // ignore
    }
  }

  public playAlertBeep(isPositive: boolean = true) {
    this.initContext();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';

      if (isPositive) {
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      } else {
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.2);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch {
      // ignore
    }
  }

  public playGeofenceChime(volume: number = 0.7) {
    this.initContext();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [
        { freq: 784, start: 0, duration: 0.12 },     // G5
        { freq: 1046.5, start: 0.10, duration: 0.14 }, // C6
        { freq: 1568, start: 0.22, duration: 0.40 },  // G6 (longer chime ring)
      ];

      notes.forEach(({ freq, start, duration }) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + start);

        const peakGain = Math.min(0.8, volume * 0.6);
        gain.gain.setValueAtTime(0.001, now + start);
        gain.gain.linearRampToValueAtTime(peakGain, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + duration);
      });
    } catch {
      // ignore
    }
  }

  /**
   * Joyful, bright triple-bell chime for favorite finding proximity alarm (< 3m)
   */
  public playFavoriteProximityAlarm(volume: number = 0.8) {
    this.initContext();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      // High-precision melodic bell arpeggio: C6 -> E6 -> G6 -> C7
      const notes = [
        { freq: 1046.5, start: 0, duration: 0.12 },
        { freq: 1318.5, start: 0.08, duration: 0.14 },
        { freq: 1568.0, start: 0.16, duration: 0.18 },
        { freq: 2093.0, start: 0.25, duration: 0.45 },
      ];

      notes.forEach(({ freq, start, duration }) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + start);

        const peakGain = Math.min(0.9, volume * 0.7);
        gain.gain.setValueAtTime(0.001, now + start);
        gain.gain.linearRampToValueAtTime(peakGain, now + start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + duration);
      });
    } catch {
      // ignore
    }
  }

  public stopContinuousTone() {
    if (this.oscillator) {
      try {
        if (this.gainNode && this.ctx) {
          this.gainNode.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.04);
        }
        setTimeout(() => {
          if (this.oscillator) {
            try {
              this.oscillator.stop();
              this.oscillator.disconnect();
            } catch {
              // ignore
            }
            this.oscillator = null;
            this.gainNode = null;
          }
        }, 50);
      } catch {
        this.oscillator = null;
        this.gainNode = null;
      }
    }
  }
}

export const audioService = new DetectorAudioService();
