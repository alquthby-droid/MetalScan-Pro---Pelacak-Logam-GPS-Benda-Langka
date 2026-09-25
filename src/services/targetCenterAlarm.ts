/**
 * TargetCenterAlarmService
 * 
 * Provides acoustic and haptic proximity alarm when tracking the exact center point (epicenter)
 * of a logged metal finding. Operates 100% OFFLINE without requiring an internet connection.
 */

export interface TargetCenterAlarmState {
  isActive: boolean; // ONLINE or OFFLINE
  targetId: string | null;
  targetName: string | null;
  targetCategory: string | null;
  targetLat: number | null;
  targetLng: number | null;
  targetDepthCm: number | null;
  distanceMeters: number;
  bearingDegrees: number;
  isCenterReached: boolean; // < 2.0 meters
  isMuted: boolean;
  isSimulatedDistance: boolean;
}

class TargetCenterAlarmService {
  private audioCtx: AudioContext | null = null;
  private isOnline: boolean = false;
  private isMuted: boolean = false;
  private currentDistance: number = 999;
  private targetId: string | null = null;
  private targetName: string | null = null;
  private targetCategory: string | null = null;
  private targetLat: number | null = null;
  private targetLng: number | null = null;
  private targetDepthCm: number | null = null;
  private bearingDegrees: number = 0;
  private simulatedDistance: number | null = null;

  private pingTimer: ReturnType<typeof setTimeout> | null = null;
  private continuousOsc: OscillatorNode | null = null;
  private continuousGain: GainNode | null = null;
  private listeners: Set<(state: TargetCenterAlarmState) => void> = new Set();

  constructor() {
    this.scheduleNextPing = this.scheduleNextPing.bind(this);
  }

  private initAudio() {
    if (!this.audioCtx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  public activateAlarm(finding: {
    id: string;
    name: string;
    category: string;
    lat: number;
    lng: number;
    depthEstimateCm: number;
  }, userLat?: number | null, userLng?: number | null) {
    this.initAudio();
    this.isOnline = true;
    this.targetId = finding.id;
    this.targetName = finding.name;
    this.targetCategory = finding.category;
    this.targetLat = finding.lat;
    this.targetLng = finding.lng;
    this.targetDepthCm = finding.depthEstimateCm;

    if (userLat != null && userLng != null) {
      this.updateUserLocation(userLat, userLng);
    } else if (this.simulatedDistance != null) {
      this.currentDistance = this.simulatedDistance;
    } else {
      this.currentDistance = 8.5; // realistic default field proximity
    }

    this.startAlarmLoop();
    this.notify();
  }

  public deactivateAlarm() {
    this.isOnline = false;
    this.stopPingTimer();
    this.stopContinuousTone();
    this.notify();
  }

  public toggleAlarm(finding: {
    id: string;
    name: string;
    category: string;
    lat: number;
    lng: number;
    depthEstimateCm: number;
  }, userLat?: number | null, userLng?: number | null) {
    if (this.isOnline && this.targetId === finding.id) {
      this.deactivateAlarm();
    } else {
      this.activateAlarm(finding, userLat, userLng);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stopContinuousTone();
    }
    this.notify();
  }

  public setSimulatedDistance(distMeters: number | null) {
    this.simulatedDistance = distMeters;
    if (distMeters != null) {
      this.currentDistance = distMeters;
    }
    this.notify();
  }

  public updateUserLocation(userLat: number, userLng: number) {
    if (this.simulatedDistance != null) {
      this.currentDistance = this.simulatedDistance;
      this.notify();
      return;
    }

    if (this.targetLat != null && this.targetLng != null) {
      this.currentDistance = this.calculateDistance(userLat, userLng, this.targetLat, this.targetLng);
      this.bearingDegrees = this.calculateBearing(userLat, userLng, this.targetLat, this.targetLng);
      this.notify();
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.max(0.1, Number((R * c).toFixed(1)));
  }

  private calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.cos(phi1) * Math.sin(phi2) * Math.cos(deltaLambda);
    const theta = Math.atan2(y, x);
    return Math.round(((theta * 180) / Math.PI + 360) % 360);
  }

  private startAlarmLoop() {
    this.stopPingTimer();
    this.scheduleNextPing();
  }

  private stopPingTimer() {
    if (this.pingTimer) {
      clearTimeout(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleNextPing() {
    if (!this.isOnline) return;

    const dist = this.currentDistance;

    // If within 1.8 meters -> Exact epicenter reached!
    if (dist <= 1.8) {
      this.playContinuousLockTone();
      this.triggerHaptic(true);
      // Check again in 200ms
      this.pingTimer = setTimeout(this.scheduleNextPing, 200);
      return;
    }

    this.stopContinuousTone();

    // Ping interval scales with distance:
    // > 25m: 1600ms
    // 15 - 25m: 1000ms
    // 8 - 15m: 600ms
    // 4 - 8m: 320ms
    // 1.8 - 4m: 140ms
    let intervalMs = 1600;
    if (dist <= 4) {
      intervalMs = 150;
      this.triggerHaptic(false);
    } else if (dist <= 8) {
      intervalMs = 320;
    } else if (dist <= 15) {
      intervalMs = 600;
    } else if (dist <= 25) {
      intervalMs = 1000;
    }

    if (!this.isMuted) {
      this.playSonarPing(dist);
    }

    this.pingTimer = setTimeout(this.scheduleNextPing, intervalMs);
  }

  private playSonarPing(dist: number) {
    if (!this.audioCtx) return;
    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      // Pitch increases from 450Hz at 30m up to 1400Hz at 2m
      const basePitch = Math.min(1450, Math.max(450, 1500 - dist * 38));
      osc.type = dist <= 5 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(basePitch, now);
      osc.frequency.exponentialRampToValueAtTime(basePitch * 1.15, now + 0.06);

      const vol = dist <= 4 ? 0.35 : 0.2;
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (dist <= 4 ? 0.05 : 0.09));

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // ignore audio clock glitches
    }
  }

  private playContinuousLockTone() {
    if (this.isMuted || !this.audioCtx) return;

    if (!this.continuousOsc) {
      try {
        const now = this.audioCtx.currentTime;
        this.continuousOsc = this.audioCtx.createOscillator();
        this.continuousGain = this.audioCtx.createGain();

        this.continuousOsc.type = 'sawtooth';
        this.continuousOsc.frequency.setValueAtTime(1600, now);

        this.continuousGain.gain.setValueAtTime(0.001, now);
        this.continuousGain.gain.linearRampToValueAtTime(0.28, now + 0.05);

        this.continuousOsc.connect(this.continuousGain);
        this.continuousGain.connect(this.audioCtx.destination);
        this.continuousOsc.start(now);
      } catch {
        this.continuousOsc = null;
        this.continuousGain = null;
      }
    }
  }

  private stopContinuousTone() {
    if (this.continuousOsc && this.audioCtx) {
      try {
        const now = this.audioCtx.currentTime;
        if (this.continuousGain) {
          this.continuousGain.gain.linearRampToValueAtTime(0.0001, now + 0.04);
        }
        setTimeout(() => {
          if (this.continuousOsc) {
            try {
              this.continuousOsc.stop();
              this.continuousOsc.disconnect();
            } catch {
              // ignore
            }
            this.continuousOsc = null;
            this.continuousGain = null;
          }
        }, 50);
      } catch {
        this.continuousOsc = null;
        this.continuousGain = null;
      }
    }
  }

  private triggerHaptic(isCenter: boolean) {
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      try {
        if (isCenter) {
          navigator.vibrate([80, 40, 80, 40, 120]);
        } else {
          navigator.vibrate(40);
        }
      } catch {
        // ignore
      }
    }
  }

  public getState(): TargetCenterAlarmState {
    return {
      isActive: this.isOnline,
      targetId: this.targetId,
      targetName: this.targetName,
      targetCategory: this.targetCategory,
      targetLat: this.targetLat,
      targetLng: this.targetLng,
      targetDepthCm: this.targetDepthCm,
      distanceMeters: this.currentDistance,
      bearingDegrees: this.bearingDegrees,
      isCenterReached: this.currentDistance <= 1.8,
      isMuted: this.isMuted,
      isSimulatedDistance: this.simulatedDistance != null,
    };
  }

  public subscribe(listener: (state: TargetCenterAlarmState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const st = this.getState();
    this.listeners.forEach((l) => l(st));
  }
}

export const targetCenterAlarmService = new TargetCenterAlarmService();
