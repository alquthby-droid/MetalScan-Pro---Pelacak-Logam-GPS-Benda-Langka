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
