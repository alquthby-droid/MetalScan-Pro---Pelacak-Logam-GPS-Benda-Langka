import { GPSLocation, MetalFinding, MetalCategory } from '../types/detector';
import { calculateDistanceMeters } from './routePlannerService';

export interface TrailPoint {
  id: string;
  timestamp: number;
  lat: number;
  lng: number;
  magneticStrength: number; // in µT
  netStrength: number; // in µT
  accuracy: number;
  distanceFromStartMeters: number;
  stepDistanceMeters: number;
  isAnomaly: boolean;
  anomalyName?: string;
  anomalyCategory?: MetalCategory;
}

export interface TrailSummary {
  totalDistanceMeters: number;
  durationSeconds: number;
  startTime: number;
  endTime: number;
  pointCount: number;
  averageStrength: number;
  peakStrength: number;
  peakNetStrength: number;
  peakLocation: { lat: number; lng: number } | null;
  anomaliesDetectedCount: number;
  baseline: number;
}

const STORAGE_KEY = 'metalscan_gps_magnetic_trail_v1';
const MAX_TRAIL_POINTS = 300;

class TrailService {
  private points: TrailPoint[] = [];
  private listeners: Set<(points: TrailPoint[]) => void> = new Set();
  private lastRecordedTime: number = 0;
  private lastRecordedLat: number | null = null;
  private lastRecordedLng: number | null = null;
  private lastRecordedStrength: number = 48.0;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          this.points = parsed;
        }
      }
    } catch {
      this.points = [];
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.points));
    } catch {
      // ignore quota errors
    }
  }

  public getPoints(): TrailPoint[] {
    return [...this.points];
  }

  public subscribe(cb: (points: TrailPoint[]) => void): () => void {
    this.listeners.add(cb);
    cb(this.getPoints());
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify() {
    const pts = this.getPoints();
    this.listeners.forEach((cb) => {
      try {
        cb(pts);
      } catch (e) {
        console.error('Trail listener error:', e);
      }
    });
  }

  /**
   * Adds a new trail point from current GPS and Magnetometer sensor reading
   */
  public recordPoint(
    lat: number,
    lng: number,
    accuracy: number,
    magneticStrength: number,
    netStrength: number,
    baseline: number = 48.0,
    forceRecord: boolean = false,
    finding?: { name: string; category: MetalCategory }
  ): boolean {
    const now = Date.now();

    // Distance from previous recorded point
    let stepDistance = 0;
    if (this.lastRecordedLat !== null && this.lastRecordedLng !== null) {
      stepDistance = calculateDistanceMeters(this.lastRecordedLat, this.lastRecordedLng, lat, lng);
    }

    const strengthDelta = Math.abs(magneticStrength - this.lastRecordedStrength);
    const isAnomaly = netStrength >= 15 || strengthDelta >= 12 || !!finding;

    // Throttle: record if moved >= 2.5m, OR if significant magnetic spike (>= 8 µT change), OR if forced / finding logged
    const timeElapsed = now - this.lastRecordedTime;
    const shouldRecord =
      forceRecord ||
      this.points.length === 0 ||
      stepDistance >= 2.5 ||
      (isAnomaly && timeElapsed >= 1500) ||
      timeElapsed >= 8000;

    if (!shouldRecord) return false;

    // Calculate cumulative distance from start
    let cumulativeDistance = 0;
    if (this.points.length > 0) {
      const prev = this.points[this.points.length - 1];
      cumulativeDistance = prev.distanceFromStartMeters + stepDistance;
    }

    const newPoint: TrailPoint = {
      id: `tp_${now}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: now,
      lat,
      lng,
      magneticStrength: Number(magneticStrength.toFixed(1)),
      netStrength: Number(netStrength.toFixed(1)),
      accuracy: Math.round(accuracy),
      distanceFromStartMeters: Number(cumulativeDistance.toFixed(1)),
      stepDistanceMeters: Number(stepDistance.toFixed(1)),
      isAnomaly,
      anomalyName: finding?.name,
      anomalyCategory: finding?.category,
    };

    this.points.push(newPoint);

    // Keep within memory limit
    if (this.points.length > MAX_TRAIL_POINTS) {
      this.points = this.points.slice(this.points.length - MAX_TRAIL_POINTS);
    }

    this.lastRecordedTime = now;
    this.lastRecordedLat = lat;
    this.lastRecordedLng = lng;
    this.lastRecordedStrength = magneticStrength;

    this.saveToStorage();
    this.notify();
    return true;
  }

  /**
   * Seeds realistic demo exploration trail data if trail is currently empty or sparse,
   * synthesizing path breadcrumbs matching the actual coordinates and findings
   */
  public seedInitialTrailIfEmpty(
    centerLat: number,
    centerLng: number,
    baseline: number = 48.0,
    findings: MetalFinding[] = []
  ): void {
    if (this.points.length >= 10) return;

    const seeded: TrailPoint[] = [];
    const baseTime = Date.now() - 35 * 60 * 1000; // 35 minutes ago
    const stepCount = 28;

    let totalDist = 0;
    let prevLat = centerLat - 0.0018;
    let prevLng = centerLng - 0.0022;

    for (let i = 0; i < stepCount; i++) {
      const progress = i / (stepCount - 1);
      // Path walking curve
      const lat = prevLat + (centerLat - prevLat) * 0.12 + Math.sin(i * 0.4) * 0.00008;
      const lng = prevLng + (centerLng - prevLng) * 0.12 + Math.cos(i * 0.4) * 0.00008;
      const step = i === 0 ? 0 : 5 + Math.random() * 4;
      totalDist += step;

      // Check if this step is near any finding
      let matchedFinding: MetalFinding | undefined = undefined;
      for (const f of findings) {
        const d = calculateDistanceMeters(lat, lng, f.lat, f.lng);
        if (d <= 15) {
          matchedFinding = f;
          break;
        }
      }

      let strength = baseline + (Math.sin(i * 0.7) * 2.2) + (Math.random() - 0.5) * 1.5;
      let isAnomaly = false;

      // Synthetic peaks at finding locations or specific spots
      if (matchedFinding) {
        strength = matchedFinding.magneticStrength;
        isAnomaly = true;
      } else if (i === 6) {
        // Point anomaly 1: Small bronze coin
        strength = baseline + 32.5;
        isAnomaly = true;
      } else if (i === 7) {
        strength = baseline + 18.0;
        isAnomaly = true;
      } else if (i === 15) {
        // Point anomaly 2: Silver relic
        strength = baseline + 64.0;
        isAnomaly = true;
      } else if (i === 16) {
        strength = baseline + 88.5; // Peak gold/silver anomaly
        isAnomaly = true;
      } else if (i === 17) {
        strength = baseline + 45.0;
        isAnomaly = true;
      } else if (i === 23) {
        // Point anomaly 3: Iron spearhead
        strength = baseline + 28.0;
        isAnomaly = true;
      }

      const netStrength = Math.max(0, strength - baseline);

      seeded.push({
        id: `tp_seed_${i}`,
        timestamp: baseTime + i * 75 * 1000,
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        magneticStrength: Number(strength.toFixed(1)),
        netStrength: Number(netStrength.toFixed(1)),
        accuracy: 4,
        distanceFromStartMeters: Number(totalDist.toFixed(1)),
        stepDistanceMeters: Number(step.toFixed(1)),
        isAnomaly,
        anomalyName: matchedFinding?.name || (isAnomaly ? (strength > 100 ? 'Anomali Emas / Mulia' : strength > 75 ? 'Anomali Perak / Relik' : 'Anomali Logam Ferrous') : undefined),
        anomalyCategory: matchedFinding?.category || (isAnomaly ? (strength > 100 ? 'gold' : strength > 75 ? 'silver' : 'bronze') : undefined),
      });

      prevLat = lat;
      prevLng = lng;
    }

    this.points = seeded;
    this.saveToStorage();
    this.notify();
  }

  public getSummary(baseline: number = 48.0): TrailSummary {
    if (this.points.length === 0) {
      return {
        totalDistanceMeters: 0,
        durationSeconds: 0,
        startTime: Date.now(),
        endTime: Date.now(),
        pointCount: 0,
        averageStrength: baseline,
        peakStrength: baseline,
        peakNetStrength: 0,
        peakLocation: null,
        anomaliesDetectedCount: 0,
        baseline,
      };
    }

    const first = this.points[0];
    const last = this.points[this.points.length - 1];
    let sumStrength = 0;
    let peakStrength = 0;
    let peakLocation: { lat: number; lng: number } | null = null;
    let anomaliesCount = 0;

    for (const p of this.points) {
      sumStrength += p.magneticStrength;
      if (p.magneticStrength > peakStrength) {
        peakStrength = p.magneticStrength;
        peakLocation = { lat: p.lat, lng: p.lng };
      }
      if (p.isAnomaly) {
        anomaliesCount++;
      }
    }

    const avgStrength = sumStrength / this.points.length;
    const durationSeconds = Math.max(0, Math.round((last.timestamp - first.timestamp) / 1000));

    return {
      totalDistanceMeters: last.distanceFromStartMeters,
      durationSeconds,
      startTime: first.timestamp,
      endTime: last.timestamp,
      pointCount: this.points.length,
      averageStrength: Number(avgStrength.toFixed(1)),
      peakStrength: Number(peakStrength.toFixed(1)),
      peakNetStrength: Number(Math.max(0, peakStrength - baseline).toFixed(1)),
      peakLocation,
      anomaliesDetectedCount: anomaliesCount,
      baseline,
    };
  }

  public clearTrail() {
    this.points = [];
    this.lastRecordedLat = null;
    this.lastRecordedLng = null;
    this.lastRecordedTime = 0;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    this.notify();
  }
}

export const trailService = new TrailService();
