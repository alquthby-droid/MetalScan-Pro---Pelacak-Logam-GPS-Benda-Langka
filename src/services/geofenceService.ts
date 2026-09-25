import {
  MetalFinding,
  GPSLocation,
  DetectorSettings,
  GeofenceTarget,
  GeofenceState,
  GeofenceEvent,
} from '../types/detector';
import { audioService } from './audioSynthesizer';
import { calculateDistanceMeters, calculateBearingDegrees } from './routePlannerService';

class GeofenceService {
  private targets: GeofenceTarget[] = [];
  private currentInsideTargetId: string | null = null;
  private lastTriggerTime: number = 0;
  private isMuted: boolean = false;
  private dismissedTargetId: string | null = null;
  private listeners: Set<(state: GeofenceState, event?: GeofenceEvent) => void> = new Set();

  private currentState: GeofenceState = {
    isActive: true,
    activeTargetsCount: 0,
    currentTargetInside: null,
    currentDistanceMeters: null,
    currentBearingDegrees: null,
    lastTriggerTimestamp: null,
    isAudioMuted: false,
  };

  /**
   * Synchronize list of findings into geofence targets.
   * Priority findings include:
   * 1. Findings explicitly flagged with isPriority === true
   * 2. Findings of category 'gold' or 'meteorite' or with netStrength > 50 µT if no explicit priority set
   */
  public syncTargets(
    findings: MetalFinding[],
    radiusMeters: number = 5,
    additionalPriorityTargets?: GeofenceTarget[]
  ) {
    const priorityList: GeofenceTarget[] = [];

    // Filter user findings
    findings.forEach((f) => {
      // If finding has isPriority flag set to true, or user has no priority items and category is gold
      const isPriority = f.isPriority === true;
      if (isPriority) {
        priorityList.push({
          id: f.id,
          name: f.name,
          lat: f.lat,
          lng: f.lng,
          category: f.category,
          magneticStrength: f.magneticStrength,
          depthEstimateCm: f.depthEstimateCm,
          isPriority: true,
          radiusMeters,
        });
      }
    });

    // Merge any additional pinned priority targets (e.g. pinned NTB historical sites)
    if (additionalPriorityTargets && additionalPriorityTargets.length > 0) {
      additionalPriorityTargets.forEach((t) => {
        if (!priorityList.some((existing) => existing.id === t.id)) {
          priorityList.push({
            ...t,
            radiusMeters: radiusMeters || t.radiusMeters || 5,
          });
        }
      });
    }

    this.targets = priorityList;
    this.currentState.activeTargetsCount = priorityList.length;
    this.notify();
  }

  /**
   * Evaluates user GPS against all priority geofence targets.
   * Checks for 5-meter perimeter breaches and triggers automatic sound/haptic alarms.
   */
  public evaluatePosition(
    userLocation: GPSLocation | null,
    settings: DetectorSettings
  ) {
    if (!settings.geofenceEnabled || !userLocation || this.targets.length === 0) {
      if (this.currentInsideTargetId !== null) {
        this.currentInsideTargetId = null;
        this.currentState.currentTargetInside = null;
        this.currentState.currentDistanceMeters = null;
        this.currentState.currentBearingDegrees = null;
        this.notify();
      }
      return;
    }

    const radiusThreshold = settings.geofenceRadiusMeters || 5.0;
    let closestTarget: GeofenceTarget | null = null;
    let minDistance = Infinity;
    let bearingToClosest = 0;

    for (const target of this.targets) {
      const dist = calculateDistanceMeters(
        userLocation.lat,
        userLocation.lng,
        target.lat,
        target.lng
      );

      if (dist < minDistance) {
        minDistance = dist;
        closestTarget = target;
        bearingToClosest = calculateBearingDegrees(
          userLocation.lat,
          userLocation.lng,
          target.lat,
          target.lng
        );
      }
    }

    // Check if user is inside the geofence perimeter (<= 5 meters)
    if (closestTarget && minDistance <= radiusThreshold) {
      const isNewEntry = this.currentInsideTargetId !== closestTarget.id;
      const isDifferentFromDismissed = this.dismissedTargetId !== closestTarget.id;

      this.currentInsideTargetId = closestTarget.id;
      this.currentState.currentTargetInside = closestTarget;
      this.currentState.currentDistanceMeters = Number(minDistance.toFixed(1));
      this.currentState.currentBearingDegrees = Math.round(bearingToClosest);

      if (isNewEntry && isDifferentFromDismissed) {
        // PERIMETER BREACH: TRIGGER AUTOMATIC AUDIO & HAPTIC ALARM
        this.lastTriggerTime = Date.now();
        this.currentState.lastTriggerTimestamp = this.lastTriggerTime;

        if (settings.geofenceSoundAlertEnabled && !this.isMuted) {
          audioService.playGeofenceChime(settings.soundVolume ?? 0.7);
        }

        if (settings.geofenceVibrationAlertEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate([200, 100, 200, 100, 400]);
          } catch {
            // vibration fallback
          }
        }

        const event: GeofenceEvent = {
          target: closestTarget,
          distanceMeters: this.currentState.currentDistanceMeters,
          bearingDegrees: this.currentState.currentBearingDegrees,
          timestamp: this.lastTriggerTime,
          type: 'ENTER',
        };

        this.notify(event);
      } else {
        // Continuous inside update
        this.notify();
      }
    } else {
      // User is outside the 5m geofence perimeter
      if (this.currentInsideTargetId !== null) {
        // EXIT EVENT
        const previousTarget = this.currentState.currentTargetInside;
        this.currentInsideTargetId = null;
        this.dismissedTargetId = null; // reset dismissal on exit so re-entry alerts again
        this.currentState.currentTargetInside = null;
        this.currentState.currentDistanceMeters = null;
        this.currentState.currentBearingDegrees = null;

        if (previousTarget) {
          const event: GeofenceEvent = {
            target: previousTarget,
            distanceMeters: Number(minDistance.toFixed(1)),
            bearingDegrees: Math.round(bearingToClosest),
            timestamp: Date.now(),
            type: 'EXIT',
          };
          this.notify(event);
        } else {
          this.notify();
        }
      }
    }
  }

  /**
   * Interactive Simulator: Test entering the 5m geofence on-demand
   */
  public simulateGeofenceEnter(
    targetOverride?: GeofenceTarget,
    settings?: Partial<DetectorSettings>
  ) {
    const target =
      targetOverride ||
      this.targets[0] || {
        id: 'sim-geofence-1',
        name: 'Artefak Emas Kuno (Simulasi 5m)',
        lat: -8.7612,
        lng: 115.9814,
        category: 'gold' as const,
        magneticStrength: 142.5,
        depthEstimateCm: 14,
        isPriority: true,
        radiusMeters: 5,
      };

    this.currentInsideTargetId = target.id;
    this.dismissedTargetId = null;
    this.lastTriggerTime = Date.now();

    this.currentState.currentTargetInside = target;
    this.currentState.currentDistanceMeters = 3.2; // 3.2 meters inside 5m zone
    this.currentState.currentBearingDegrees = 42;
    this.currentState.lastTriggerTimestamp = this.lastTriggerTime;

    const soundEnabled = settings?.geofenceSoundAlertEnabled ?? true;
    const soundVol = settings?.soundVolume ?? 0.8;
    const vibrationEnabled = settings?.geofenceVibrationAlertEnabled ?? true;

    if (soundEnabled && !this.isMuted) {
      audioService.playGeofenceChime(soundVol);
    }

    if (vibrationEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([200, 100, 200, 100, 400]);
      } catch {
        // ignore
      }
    }

    const event: GeofenceEvent = {
      target,
      distanceMeters: 3.2,
      bearingDegrees: 42,
      timestamp: this.lastTriggerTime,
      type: 'ENTER',
    };

    this.notify(event);
  }

  public dismissCurrentAlert() {
    if (this.currentInsideTargetId) {
      this.dismissedTargetId = this.currentInsideTargetId;
    }
    this.currentState.currentTargetInside = null;
    this.notify();
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    this.currentState.isAudioMuted = this.isMuted;
    this.notify();
  }

  public playTestChime(volume: number = 0.7) {
    audioService.playGeofenceChime(volume);
  }

  public getTargets(): GeofenceTarget[] {
    return this.targets;
  }

  public getState(): GeofenceState {
    return { ...this.currentState };
  }

  public subscribe(listener: (state: GeofenceState, event?: GeofenceEvent) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(event?: GeofenceEvent) {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state, event);
      } catch (err) {
        console.error('[GeofenceService] listener error', err);
      }
    });
  }
}

export const geofenceService = new GeofenceService();
