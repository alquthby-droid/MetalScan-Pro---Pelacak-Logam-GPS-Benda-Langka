import { MagneticReading, SoilMineralizationProfile, SoilMineralizationLevel, SoilProfilingProgress, SoilShallowFeasibility } from '../types/detector';
import { sensorManager } from './sensorManager';

type ProgressListener = (progress: SoilProfilingProgress) => void;
type ProfileCompleteListener = (profile: SoilMineralizationProfile) => void;

const STORAGE_KEY = 'metalscan_soil_mineralization_profiles';
const DEFAULT_DURATION_SECONDS = 60;

class SoilMineralizationService {
  private isProfiling = false;
  private isPaused = false;
  private startTime = 0;
  private pausedDuration = 0;
  private pauseStartedAt = 0;
  private durationSeconds = DEFAULT_DURATION_SECONDS;

  private samples: Array<{
    total: number;
    net: number;
    x: number;
    y: number;
    z: number;
    tiltAngle: number;
    timestamp: number;
  }> = [];

  private timerId: any = null;
  private unsubscribeSensor: (() => void) | null = null;
  private progressListeners: Set<ProgressListener> = new Set();
  private completeListeners: Set<ProfileCompleteListener> = new Set();

  private currentLocation: { lat?: number; lng?: number } = {};
  private simulatedMode: 'NONE' | 'CLEAN' | 'MEDIUM' | 'VOLCANIC' | 'MAGNETITE' = 'NONE';
  private latestProfile: SoilMineralizationProfile | null = null;

  constructor() {
    this.loadLastProfile();
  }

  public setLocation(lat?: number, lng?: number) {
    this.currentLocation = { lat, lng };
  }

  public setSimulatedMode(mode: 'NONE' | 'CLEAN' | 'MEDIUM' | 'VOLCANIC' | 'MAGNETITE') {
    this.simulatedMode = mode;
  }

  public getSimulatedMode() {
    return this.simulatedMode;
  }

  public subscribeProgress(listener: ProgressListener): () => void {
    this.progressListeners.add(listener);
    listener(this.getProgressState());
    return () => this.progressListeners.delete(listener);
  }

  public subscribeComplete(listener: ProfileCompleteListener): () => void {
    this.completeListeners.add(listener);
    return () => this.completeListeners.delete(listener);
  }

  public startProfiling(durationSeconds: number = DEFAULT_DURATION_SECONDS): boolean {
    if (this.isProfiling) {
      this.cancelProfiling();
    }

    this.durationSeconds = durationSeconds;
    this.samples = [];
    this.isProfiling = true;
    this.isPaused = false;
    this.startTime = Date.now();
    this.pausedDuration = 0;
    this.pauseStartedAt = 0;

    // Subscribe to sensor stream
    this.unsubscribeSensor = sensorManager.subscribe((reading) => {
      this.handleIncomingReading(reading);
    });

    // 10 Hz ticker for smooth progress and countdown updates
    this.timerId = setInterval(() => {
      this.tick();
    }, 100);

    this.notifyProgress();
    return true;
  }

  public pauseProfiling() {
    if (!this.isProfiling || this.isPaused) return;
    this.isPaused = true;
    this.pauseStartedAt = Date.now();
    this.notifyProgress();
  }

  public resumeProfiling() {
    if (!this.isProfiling || !this.isPaused) return;
    this.isPaused = false;
    this.pausedDuration += (Date.now() - this.pauseStartedAt);
    this.pauseStartedAt = 0;
    this.notifyProgress();
  }

  public cancelProfiling() {
    this.cleanup();
    this.notifyProgress();
  }

  private cleanup() {
    this.isProfiling = false;
    this.isPaused = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.unsubscribeSensor) {
      this.unsubscribeSensor();
      this.unsubscribeSensor = null;
    }
  }

  private handleIncomingReading(reading: MagneticReading) {
    if (!this.isProfiling || this.isPaused) return;

    let total = reading.total;
    let x = reading.x;
    let y = reading.y;
    let z = reading.z;

    // Apply simulation noise if selected
    if (this.simulatedMode !== 'NONE') {
      const now = Date.now();
      let noiseAmp = 0.15;
      if (this.simulatedMode === 'MEDIUM') noiseAmp = 0.65;
      if (this.simulatedMode === 'VOLCANIC') noiseAmp = 1.6;
      if (this.simulatedMode === 'MAGNETITE') noiseAmp = 3.8;

      const randomJitter = (Math.random() - 0.5) * noiseAmp * 2;
      const slowDrift = Math.sin(now / 4000) * (noiseAmp * 0.8);
      total += (randomJitter + slowDrift);
      x += (Math.random() - 0.5) * noiseAmp;
      y += (Math.random() - 0.5) * noiseAmp;
      z += (Math.random() - 0.5) * noiseAmp;
    }

    // Compute magnetic inclination/tilt angle in degrees
    const horiz = Math.sqrt(x * x + y * y);
    const tiltAngle = (Math.atan2(z, horiz || 0.001) * 180) / Math.PI;

    this.samples.push({
      total,
      net: reading.netTotal,
      x,
      y,
      z,
      tiltAngle,
      timestamp: Date.now(),
    });
  }

  private tick() {
    if (!this.isProfiling || this.isPaused) return;

    const elapsedMs = Date.now() - this.startTime - this.pausedDuration;
    const elapsedSeconds = Math.min(this.durationSeconds, Math.floor(elapsedMs / 1000));

    if (elapsedMs >= this.durationSeconds * 1000) {
      this.finishProfiling();
      return;
    }

    this.notifyProgress();
  }

  private finishProfiling() {
    this.cleanup();

    if (this.samples.length < 5) {
      // Fallback: create mock sample if sensor was completely idle
      const base = sensorManager.getBaseline() || 48.0;
      for (let i = 0; i < 30; i++) {
        this.samples.push({
          total: base + (Math.random() - 0.5) * 0.2,
          net: (Math.random() - 0.5) * 0.2,
          x: 20,
          y: 5,
          z: -43,
          tiltAngle: -60,
          timestamp: Date.now() - (30 - i) * 1000,
        });
      }
    }

    const profile = this.computeProfileFromSamples();
    this.latestProfile = profile;
    this.saveProfileToStorage(profile);

    this.notifyProgress();
    this.completeListeners.forEach((l) => l(profile));
  }

  private computeProfileFromSamples(): SoilMineralizationProfile {
    const totals = this.samples.map((s) => s.total);
    const count = totals.length;
    const sum = totals.reduce((a, b) => a + b, 0);
    const mean = sum / count;

    // Variance & Standard Deviation
    const variance = totals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / count;
    const noiseSigma = Math.sqrt(variance);

    // Min & Max
    const minVal = Math.min(...totals);
    const maxVal = Math.max(...totals);
    const peakToPeak = maxVal - minVal;

    // 3D Tilt Variation
    const tilts = this.samples.map((s) => s.tiltAngle);
    const meanTilt = tilts.reduce((a, b) => a + b, 0) / count;
    const tiltVariance = tilts.reduce((acc, v) => acc + Math.pow(v - meanTilt, 2), 0) / count;
    const tiltSigma = Math.sqrt(tiltVariance);

    // Mineralization Score Calculation (0 - 100)
    // Formula combines Noise Sigma (45%), Peak-to-Peak (35%), and Tilt Jitter (20%)
    const sigmaScore = Math.min(100, (noiseSigma / 2.5) * 100);
    const peakScore = Math.min(100, (peakToPeak / 7.0) * 100);
    const tiltScore = Math.min(100, (tiltSigma / 3.0) * 100);

    const rawScore = (sigmaScore * 0.45) + (peakScore * 0.35) + (tiltScore * 0.20);
    const mineralizationScore = Math.min(100, Math.max(2, Math.round(rawScore)));

    let level: SoilMineralizationLevel = 'VERY_LOW';
    let soilClassification = 'Tanah Pasir / Humus Netral (Non-Mineral)';

    if (mineralizationScore <= 25) {
      level = 'VERY_LOW';
      soilClassification = 'Tanah Pasir Pantai Bersih / Humus Organik Ringan';
    } else if (mineralizationScore <= 50) {
      level = 'LOW_MEDIUM';
      soilClassification = 'Tanah Lempung Sedimen (Mineralisasi Rendah-Sedang)';
    } else if (mineralizationScore <= 75) {
      level = 'HIGH';
      soilClassification = 'Tanah Vulkanik / Laterit Merah (Mineralisasi Tinggi)';
    } else {
      level = 'SEVERE';
      soilClassification = 'Pasir Besi Magnetit / Batuan Ferrite Berat (Ekstrem)';
    }

    const shallowFeasibility = this.evaluateShallowFeasibility(mineralizationScore, level, noiseSigma);

    return {
      id: `soil_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      lat: this.currentLocation.lat,
      lng: this.currentLocation.lng,
      durationSeconds: this.durationSeconds,
      sampleCount: count,
      meanStrength: Number(mean.toFixed(2)),
      noiseSigma: Number(noiseSigma.toFixed(3)),
      peakToPeakVariance: Number(peakToPeak.toFixed(2)),
      magneticTiltVariation: Number(tiltSigma.toFixed(2)),
      mineralizationScore,
      level,
      soilClassification,
      shallowDetectionFeasibility: shallowFeasibility,
    };
  }

  private evaluateShallowFeasibility(
    score: number,
    level: SoilMineralizationLevel,
    noiseSigma: number
  ): SoilShallowFeasibility {
    if (level === 'VERY_LOW') {
      return {
        status: 'EXCELLENT',
        title: 'Sangat Ideal untuk Deteksi Dangkal & Dalam',
        description: 'Matriks tanah nyaris bebas dari interferensi mineral fero. Noise latar sangat hening (σ < 0.3 µT). Respon koin tipis, cincin, dan emas butir kecil pada kedalaman 0-25 cm akan terdengar sangat bersih dan akurat.',
        effectiveShallowDepthCm: 35,
        recommendedSensitivityReductionPercent: 0,
        recommendedGroundBalanceOffset: 0.0,
        tacticalAdvice: [
          'Sensitivitas detektor dapat disetel maksimal (Level 5 / 100%) tanpa gangguan sinyal palsu.',
          'Gunakan koil pencari standar atau konsentris untuk target koin dangkal berpresisi tinggi.',
          'Ambang batas otomatis (Auto-Save Threshold) dapat diturunkan ke 60-65 µT untuk mendeteksi anomali terkecil.',
        ],
      };
    }

    if (level === 'LOW_MEDIUM') {
      return {
        status: 'GOOD',
        title: 'Cukup Bagus untuk Deteksi Dangkal Normal',
        description: 'Terdapat kandungan mineral lempung wajar. Sedikit riak magnetik mikro terukur (σ ~ 0.3 - 0.8 µT). Deteksi dangkal 0-15 cm tetap stabil dengan Ground Balance dasar.',
        effectiveShallowDepthCm: 25,
        recommendedSensitivityReductionPercent: 5,
        recommendedGroundBalanceOffset: 1.2,
        tacticalAdvice: [
          'Pertahankan Ground Balance terkalibrasi sebelum menyapu setiap area baru.',
          'Koil Double-D (DD) direkomendasikan jika ingin sapuan lebih stabil.',
          'Tetapkan ambang batas auto-save di rentang 68-72 µT agar riak tanah tidak memicu log palsu.',
        ],
      };
    }

    if (level === 'HIGH') {
      return {
        status: 'CHALLENGING',
        title: 'Tantangan Tinggi: Rawan Sinyal Tanah Palsu (Ground Chatter)',
        description: 'Kandungan oksida besi (hematit/magnetit) atau tanah laterit vulkanik cukup padat (σ > 1.0 µT). Anomali logam kecil di kedalaman dangkal (< 8 cm) berisiko terdistorsi atau terhalang respon tanah panas (hot rock / mineralization halo).',
        effectiveShallowDepthCm: 14,
        recommendedSensitivityReductionPercent: 20,
        recommendedGroundBalanceOffset: 3.5,
        tacticalAdvice: [
          'Wajib kurangi Sensitivitas sebesar 15-20% untuk memadamkan riak obrolan tanah (ground chatter).',
          'Lakukan kalibrasi "Tara Nol" berulang-ulang di atas tanah bersih tanpa logam.',
          'Ayunkan koil 3-5 cm lebih tinggi dari permukaan tanah untuk meredam respons matriks mineral dangkal.',
          'Naikkan ambang batas Auto-Save ke minimal 75-80 µT agar tidak merekam ground false-positive.',
        ],
      };
    }

    // SEVERE
    return {
      status: 'POOR',
      title: 'Kritis: Tanah Sangat Termineralisasi (Topsoil Masking Berat)',
      description: 'Matriks tanah jenuh pasir besi magnetit, basal, atau batuan besi berat (σ > 2.5 µT, variansi > 6 µT). Logam dangkal (< 5 cm) akan mengalami "masking" parah dimana tanah berteriak lebih keras dibanding target koin/emas.',
      effectiveShallowDepthCm: 6,
      recommendedSensitivityReductionPercent: 40,
      recommendedGroundBalanceOffset: 6.8,
      tacticalAdvice: [
        'Koil VLF standar akan mengalami saturasi; prioritaskan detektor Pulse Induction (PI) atau koil DD berukuran kecil (5"-7").',
        'Kurangi sensitivitas 35-45% dan gunakan fitur "Ferrous Reject" / diskriminasi besi ketat.',
        'Angkat koil setidaknya 7-10 cm di atas tanah saat memindai.',
        'Hindari mencari nugget/emas tipis di lapisan topsoil tanpa teknologi ground balance multi-frekuensi simultan.',
      ],
    };
  }

  public getProgressState(): SoilProfilingProgress {
    const elapsedMs = this.isProfiling
      ? (Date.now() - this.startTime - this.pausedDuration - (this.isPaused ? Date.now() - this.pauseStartedAt : 0))
      : 0;

    const elapsedSeconds = Math.min(this.durationSeconds, Math.max(0, Math.floor(elapsedMs / 1000)));
    const remainingSeconds = Math.max(0, this.durationSeconds - elapsedSeconds);
    const progressPercent = Math.min(100, Math.max(0, Math.round((elapsedMs / (this.durationSeconds * 1000)) * 100)));

    const totals = this.samples.map((s) => s.total);
    const count = totals.length;
    const sum = totals.reduce((a, b) => a + b, 0);
    const liveMean = count > 0 ? Number((sum / count).toFixed(2)) : (sensorManager.getBaseline() || 48.0);

    const variance = count > 1
      ? totals.reduce((acc, v) => acc + Math.pow(v - liveMean, 2), 0) / count
      : 0;
    const liveSigma = Number(Math.sqrt(variance).toFixed(3));

    const liveMin = count > 0 ? Number(Math.min(...totals).toFixed(1)) : liveMean;
    const liveMax = count > 0 ? Number(Math.max(...totals).toFixed(1)) : liveMean;

    // Quick score preview
    const previewScore = Math.min(100, Math.max(2, Math.round(
      (Math.min(100, (liveSigma / 2.5) * 100) * 0.5) +
      (Math.min(100, ((liveMax - liveMin) / 7.0) * 100) * 0.5)
    )));

    // Recent 35 noise offsets for waveform
    const recent = this.samples.slice(-35).map((s) => Number((s.total - liveMean).toFixed(2)));

    return {
      isActive: this.isProfiling,
      isPaused: this.isPaused,
      isCompleted: !this.isProfiling && this.latestProfile !== null && elapsedSeconds === 0,
      elapsedSeconds,
      remainingSeconds,
      totalDurationSeconds: this.durationSeconds,
      progressPercent,
      currentSamplesCount: count,
      liveMean,
      liveSigma,
      liveMin,
      liveMax,
      currentScorePreview: previewScore || 10,
      recentNoiseWaveform: recent.length > 0 ? recent : [0, 0, 0, 0],
    };
  }

  public getLatestProfile(): SoilMineralizationProfile | null {
    return this.latestProfile;
  }

  public getSavedProfiles(): SoilMineralizationProfile[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data) as SoilMineralizationProfile[];
    } catch {
      return [];
    }
  }

  public deleteProfile(id: string) {
    try {
      const list = this.getSavedProfiles().filter((p) => p.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      if (this.latestProfile?.id === id) {
        this.latestProfile = list[0] || null;
      }
      this.notifyProgress();
    } catch (e) {
      console.warn('Failed to delete soil profile:', e);
    }
  }

  private saveProfileToStorage(profile: SoilMineralizationProfile) {
    try {
      const list = this.getSavedProfiles();
      const updated = [profile, ...list.filter((p) => p.id !== profile.id)].slice(0, 30);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to persist soil profile:', e);
    }
  }

  private loadLastProfile() {
    try {
      const list = this.getSavedProfiles();
      if (list.length > 0) {
        this.latestProfile = list[0];
      }
    } catch (e) {
      console.warn('Failed to load soil profile:', e);
    }
  }

  private notifyProgress() {
    const state = this.getProgressState();
    this.progressListeners.forEach((l) => l(state));
  }
}

export const soilMineralizationService = new SoilMineralizationService();
