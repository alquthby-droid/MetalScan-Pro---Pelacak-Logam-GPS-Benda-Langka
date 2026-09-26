/**
 * Smart Battery Adaptive Sampling Service
 *
 * Mengatur frekuensi polling sensor (magnetometer) dan GPS secara dinamis
 * berdasarkan akselerometer dan kecepatan gerak pengguna di lapangan:
 * - STATIONARY (Berhenti/Jongkok Menggali): Sensor 8 Hz, GPS Eco (Hemat Daya ~62%)
 * - SLOW_MOVE  (Gerak Lambat/Ayunan Teliti): Sensor 18 Hz, GPS Seimbang (Hemat Daya ~40%)
 * - FAST_MOVE  (Gerak Cepat/Transisi Sektor): Sensor 32 Hz, GPS Presisi Tinggi (Hemat Daya ~10%)
 */

import { AdaptiveSamplingState, MotionActivityState } from '../types/detector';

type AdaptiveSamplingListener = (state: AdaptiveSamplingState) => void;

class AdaptiveSamplingService {
  private listeners: Set<AdaptiveSamplingListener> = new Set();

  private enabled: boolean = true;
  private motionState: MotionActivityState = 'SLOW_MOVE';
  private accelerometerMagnitude: number = 0.5; // m/s²
  private motionSpeedEstimateMs: number = 0.8; // m/s
  private isDeviceMotionSupported: boolean = false;
  private lastMotionUpdate: number = Date.now();

  // Sliding window of motion energy to prevent rapid oscillation
  private recentEnergies: number[] = [];
  private readonly WINDOW_SIZE = 12;

  // Stationary persistence counter
  private lowMotionSince: number = Date.now();

  // Manual simulation override for testing / environments without accelerometer
  private simulatedState: MotionActivityState | null = null;

  private currentState: AdaptiveSamplingState = {
    enabled: true,
    motionState: 'SLOW_MOVE',
    accelerometerMagnitude: 0.5,
    motionSpeedEstimateMs: 0.8,
    sensorHz: 18,
    gpsProfile: 'balanced',
    gpsIntervalMs: 8000,
    estimatedBatterySavingsPercent: 40,
    isDeviceMotionSupported: false,
    lastMotionUpdate: Date.now(),
  };

  private motionHandler: ((e: DeviceMotionEvent) => void) | null = null;

  constructor() {
    this.handleDeviceMotion = this.handleDeviceMotion.bind(this);
  }

  public init(): void {
    if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
      this.isDeviceMotionSupported = true;
      this.motionHandler = this.handleDeviceMotion;
      window.addEventListener('devicemotion', this.motionHandler as EventListener);
    }
    this.recomputeState();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.recomputeState();
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Handle real accelerometer motion events from device
   */
  private handleDeviceMotion(e: DeviceMotionEvent): void {
    if (!this.enabled || this.simulatedState !== null) return;

    let ax = 0;
    let ay = 0;
    let az = 0;

    // Prefer linear acceleration (excluding gravity) if device supports it
    if (e.acceleration && typeof e.acceleration.x === 'number') {
      ax = e.acceleration.x || 0;
      ay = e.acceleration.y || 0;
      az = e.acceleration.z || 0;
    } else if (e.accelerationIncludingGravity && typeof e.accelerationIncludingGravity.x === 'number') {
      // High-pass approximation
      const rawX = e.accelerationIncludingGravity.x || 0;
      const rawY = e.accelerationIncludingGravity.y || 0;
      const rawZ = e.accelerationIncludingGravity.z || 0;
      const magTotal = Math.sqrt(rawX * rawX + rawY * rawY + rawZ * rawZ);
      const deltaGravity = Math.abs(magTotal - 9.81);
      ax = deltaGravity;
      ay = 0;
      az = 0;
    }

    const instantMag = Math.sqrt(ax * ax + ay * ay + az * az);
    this.accelerometerMagnitude = Number(instantMag.toFixed(2));
    this.lastMotionUpdate = Date.now();

    // Push into sliding window
    this.recentEnergies.push(instantMag);
    if (this.recentEnergies.length > this.WINDOW_SIZE) {
      this.recentEnergies.shift();
    }

    this.evaluateMotion();
  }

  /**
   * Incorporate real-time GPS speed (from navigator.geolocation)
   */
  public updateGpsSpeed(speedMs: number | null): void {
    if (typeof speedMs === 'number' && !isNaN(speedMs) && speedMs >= 0) {
      this.motionSpeedEstimateMs = Number(speedMs.toFixed(2));
    }
    if (this.simulatedState === null) {
      this.evaluateMotion();
    }
  }

  /**
   * Core classification algorithm:
   * Categorizes motion into STATIONARY, SLOW_MOVE, or FAST_MOVE
   */
  private evaluateMotion(): void {
    if (this.simulatedState !== null) {
      this.motionState = this.simulatedState;
      this.recomputeState();
      return;
    }

    const avgEnergy =
      this.recentEnergies.length > 0
        ? this.recentEnergies.reduce((a, b) => a + b, 0) / this.recentEnergies.length
        : 0.4;

    const now = Date.now();

    // Thresholds:
    // Stationary: Low energy < 0.38 m/s² & slow GPS speed < 0.45 m/s
    const isStationaryCandidate = avgEnergy < 0.38 && this.motionSpeedEstimateMs < 0.45;
    // Fast: High energy > 1.35 m/s² or walking/running speed > 1.4 m/s
    const isFastCandidate = avgEnergy > 1.35 || this.motionSpeedEstimateMs > 1.4;

    let nextState: MotionActivityState = 'SLOW_MOVE';

    if (isStationaryCandidate) {
      // Require being stationary for at least 2.5s before throttling to avoid jitter during pause
      if (now - this.lowMotionSince > 2500) {
        nextState = 'STATIONARY';
      } else {
        nextState = 'SLOW_MOVE';
      }
    } else {
      this.lowMotionSince = now;
      if (isFastCandidate) {
        nextState = 'FAST_MOVE';
      } else {
        nextState = 'SLOW_MOVE';
      }
    }

    if (nextState !== this.motionState) {
      this.motionState = nextState;
      this.recomputeState();
    }
  }

  /**
   * Recompute frequencies, GPS profiles, and estimated battery savings
   */
  private recomputeState(): void {
    let sensorHz = 30;
    let gpsProfile: 'eco_standby' | 'balanced' | 'high_precision' = 'high_precision';
    let gpsIntervalMs = 2000;
    let estimatedBatterySavingsPercent = 0;

    if (!this.enabled) {
      // Algorithm disabled: fixed default 30 Hz & high precision
      sensorHz = 30;
      gpsProfile = 'high_precision';
      gpsIntervalMs = 2500;
      estimatedBatterySavingsPercent = 0;
    } else {
      switch (this.motionState) {
        case 'STATIONARY':
          // Stationary / Digging target: low 8 Hz polling, relaxed GPS
          sensorHz = 8;
          gpsProfile = 'eco_standby';
          gpsIntervalMs = 25000;
          estimatedBatterySavingsPercent = 62;
          break;
        case 'SLOW_MOVE':
          // Slow sweep / careful pace: balanced 18 Hz, optimal battery
          sensorHz = 18;
          gpsProfile = 'balanced';
          gpsIntervalMs = 8000;
          estimatedBatterySavingsPercent = 40;
          break;
        case 'FAST_MOVE':
          // Fast traverse / rapid swinging: high 32 Hz, full precision GPS
          sensorHz = 32;
          gpsProfile = 'high_precision';
          gpsIntervalMs = 2000;
          estimatedBatterySavingsPercent = 10;
          break;
      }
    }

    this.currentState = {
      enabled: this.enabled,
      motionState: this.motionState,
      accelerometerMagnitude: this.accelerometerMagnitude,
      motionSpeedEstimateMs: this.motionSpeedEstimateMs,
      sensorHz,
      gpsProfile,
      gpsIntervalMs,
      estimatedBatterySavingsPercent,
      isDeviceMotionSupported: this.isDeviceMotionSupported,
      lastMotionUpdate: this.lastMotionUpdate,
    };

    this.notify();
  }

  public getState(): AdaptiveSamplingState {
    return this.currentState;
  }

  /**
   * Manual override simulation for testing & demonstration
   */
  public simulateMotion(state: MotionActivityState | null): void {
    this.simulatedState = state;
    if (state === 'STATIONARY') {
      this.accelerometerMagnitude = 0.08;
      this.motionSpeedEstimateMs = 0.0;
      this.motionState = 'STATIONARY';
    } else if (state === 'SLOW_MOVE') {
      this.accelerometerMagnitude = 0.65;
      this.motionSpeedEstimateMs = 0.9;
      this.motionState = 'SLOW_MOVE';
    } else if (state === 'FAST_MOVE') {
      this.accelerometerMagnitude = 2.1;
      this.motionSpeedEstimateMs = 1.9;
      this.motionState = 'FAST_MOVE';
    }
    this.recomputeState();
  }

  public subscribe(callback: AdaptiveSamplingListener): () => void {
    this.listeners.add(callback);
    callback(this.currentState);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify(): void {
    this.listeners.forEach((cb) => {
      try {
        cb(this.currentState);
      } catch {
        // ignore
      }
    });
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && this.motionHandler) {
      window.removeEventListener('devicemotion', this.motionHandler as EventListener);
      this.motionHandler = null;
    }
    this.listeners.clear();
  }
}

export const adaptiveSamplingService = new AdaptiveSamplingService();
