import {
  MagneticReading,
  DriftMonitorState,
  DriftDataPoint,
  CalibrationRecord,
  DriftStatus,
} from '../types/detector';

type DriftListener = (state: DriftMonitorState) => void;

class CalibrationDriftMonitorService {
  private calibratedBaseline: number = 48.0;
  private calibratedAt: number = Date.now();

  // Rolling window of recent readings for noise & baseline calculation (last 40 samples)
  private sampleWindow: number[] = [];
  private maxSamples: number = 40;

  // History timeline for sparkline / trend charts (sampled every ~1s, max 90 points)
  private history: DriftDataPoint[] = [];
  private maxHistory: number = 90;
  private lastHistorySampleTime: number = 0;

  // Calibration log
  private calibrationLog: CalibrationRecord[] = [];

  // Simulated noise injection for user testing
  private simulatedNoiseOffset: number = 0;
  private simulatedNoiseJitter: number = 0;

  // Listeners
  private listeners: Set<DriftListener> = new Set();

  // Configuration thresholds
  private alertThreshold: number = 5.0; // in µT

  // Current derived state cache
  private currentState: DriftMonitorState = {
    calibratedBaseline: 48.0,
    calibratedAt: Date.now(),
    currentAmbient: 48.0,
    drift: 0,
    driftPercentage: 0,
    driftRatePerMin: 0,
    noiseSigma: 0.2,
    peakToPeakNoise: 0.5,
    qualityScore: 98,
    status: 'STABLE',
    isNoisyEnvironment: false,
    needsRecalibration: false,
    history: [],
    calibrationLog: [],
    diagnosis: 'Kondisi medan magnet lingkungan stabil. Akurasi deteksi maksimal.',
    actionRecommendation: 'Lanjutkan penyisiran dengan ayunan detektor konstan.',
  };

  constructor() {
    this.calibratedBaseline = 48.0;
    this.calibratedAt = Date.now();
  }

  public setThreshold(thresholdMicroTesla: number) {
    this.alertThreshold = Math.max(1.5, thresholdMicroTesla);
    this.recalculate();
  }

  public recordCalibration(newBaseline: number): CalibrationRecord {
    const previous = this.calibratedBaseline;
    const correctedDrift = Number((this.currentState.currentAmbient - previous).toFixed(2));
    const noiseAtCal = this.currentState.noiseSigma;

    this.calibratedBaseline = Number(newBaseline.toFixed(1));
    this.calibratedAt = Date.now();
    this.sampleWindow = []; // reset window on fresh tare

    const record: CalibrationRecord = {
      id: `cal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      previousBaseline: previous,
      newBaseline: this.calibratedBaseline,
      correctedDrift,
      noiseAtCalibration: noiseAtCal,
    };

    this.calibrationLog = [record, ...this.calibrationLog.slice(0, 19)];
    this.recalculate();
    return record;
  }

  public updateReading(reading: MagneticReading, isSpikeActive: boolean = false) {
    // If a severe target anomaly spike is in progress (>15uT above baseline),
    // discount it from ambient baseline calculation to prevent legitimate targets from distorting ambient baseline
    let valueToWindow = reading.total;

    if (this.simulatedNoiseOffset !== 0 || this.simulatedNoiseJitter !== 0) {
      const jitter = (Math.random() - 0.5) * this.simulatedNoiseJitter;
      valueToWindow += this.simulatedNoiseOffset + jitter;
    }

    if (!isSpikeActive || reading.netTotal < 12.0) {
      this.sampleWindow.push(valueToWindow);
      if (this.sampleWindow.length > this.maxSamples) {
        this.sampleWindow.shift();
      }
    }

    const now = Date.now();
    // Record history point every 1.2 seconds for the trend chart
    if (now - this.lastHistorySampleTime >= 1200 && this.sampleWindow.length >= 3) {
      this.lastHistorySampleTime = now;
      const ambient = this.calculateMedian(this.sampleWindow);
      const drift = Number((ambient - this.calibratedBaseline).toFixed(1));
      const sigma = this.calculateStandardDeviation(this.sampleWindow);

      const point: DriftDataPoint = {
        timestamp: now,
        total: reading.total,
        baseline: this.calibratedBaseline,
        drift,
        noiseSigma: Number(sigma.toFixed(2)),
      };

      this.history.push(point);
      if (this.history.length > this.maxHistory) {
        this.history.shift();
      }
    }

    this.recalculate();
  }

  private recalculate() {
    if (this.sampleWindow.length < 2) return;

    // Use trimmed median to represent ambient field free of transient spikes
    const currentAmbient = Number(this.calculateMedian(this.sampleWindow).toFixed(1));
    const drift = Number((currentAmbient - this.calibratedBaseline).toFixed(1));
    const absDrift = Math.abs(drift);
    const driftPercentage = Number(
      ((absDrift / Math.max(1, this.calibratedBaseline)) * 100).toFixed(1)
    );

    const sigma = Number(this.calculateStandardDeviation(this.sampleWindow).toFixed(2));
    const minVal = Math.min(...this.sampleWindow);
    const maxVal = Math.max(...this.sampleWindow);
    const peakToPeak = Number((maxVal - minVal).toFixed(2));

    // Calculate drift rate (µT per minute)
    const elapsedMinutes = Math.max(0.2, (Date.now() - this.calibratedAt) / 60000);
    const driftRatePerMin = Number((absDrift / elapsedMinutes).toFixed(2));

    // Determine status
    let status: DriftStatus = 'STABLE';
    let isNoisy = false;
    let needsRecal = false;

    if (absDrift >= this.alertThreshold * 1.5 || absDrift >= 8.0) {
      status = 'SEVERE_DRIFT';
      needsRecal = true;
    } else if (sigma >= 3.8 || peakToPeak >= 11.0) {
      status = 'HIGH_NOISE';
      isNoisy = true;
    } else if (sigma >= 1.8 || absDrift >= this.alertThreshold * 0.6) {
      status = 'MODERATE_NOISE';
    }

    // Calculate Environmental Quality Score (0 - 100%)
    // Penalize high jitter sigma and excessive drift
    let penalty = sigma * 12 + absDrift * 6;
    let qualityScore = Math.max(8, Math.min(100, Math.round(100 - penalty)));

    // Generate diagnostic narrative
    let diagnosis = 'Kondisi medan magnet lingkungan stabil. Akurasi deteksi maksimal.';
    let actionRecommendation = 'Lanjutkan penyisiran dengan ayunan detektor konstan.';

    if (status === 'SEVERE_DRIFT') {
      diagnosis = `Baseline bergeser signifikan (${drift > 0 ? '+' : ''}${drift} µT) dari kalibrasi awal. Risiko target semu atau penurunan sensitivitas artefak dalam.`;
      actionRecommendation =
        'Segera lakukan "Tara Nol / Kalibrasi Ulang" di udara bebas atau area tanah netral.';
      qualityScore = Math.min(qualityScore, 42);
    } else if (status === 'HIGH_NOISE') {
      diagnosis = `Fluktuasi lingkungan tinggi (Jitter ±${sigma} µT, p-p ${peakToPeak} µT). Kemungkinan terdapat kabel listrik aktif bawah tanah, tiang tegangan tinggi, atau tanah kaya pasir besi.`;
      actionRecommendation =
        'Jauhi sumber interferensi elektromagnetik (EMI) atau turunkan sensitivitas detektor 1 tingkat.';
      qualityScore = Math.min(qualityScore, 48);
    } else if (status === 'MODERATE_NOISE') {
      diagnosis = `Terdeteksi sedikit fluktuasi magnetik sekitar (Jitter ±${sigma} µT). Pengaruh mineralisasi tanah atau pergeseran orientasi perangkat.`;
      actionRecommendation =
        'Posisikan perangkat stabil dan pertahankan jarak konstan dari permukaan tanah.';
    }

    this.currentState = {
      calibratedBaseline: this.calibratedBaseline,
      calibratedAt: this.calibratedAt,
      currentAmbient,
      drift,
      driftPercentage,
      driftRatePerMin,
      noiseSigma: sigma,
      peakToPeakNoise: peakToPeak,
      qualityScore,
      status,
      isNoisyEnvironment: isNoisy || status === 'HIGH_NOISE',
      needsRecalibration: needsRecal || status === 'SEVERE_DRIFT',
      history: [...this.history],
      calibrationLog: [...this.calibrationLog],
      diagnosis,
      actionRecommendation,
    };

    this.notifyListeners();
  }

  private calculateMedian(numbers: number[]): number {
    if (numbers.length === 0) return 48.0;
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 !== 0) {
      return sorted[mid];
    }
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private calculateStandardDeviation(numbers: number[]): number {
    if (numbers.length < 2) return 0;
    const mean = numbers.reduce((sum, val) => sum + val, 0) / numbers.length;
    const variance =
      numbers.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (numbers.length - 1);
    return Math.sqrt(variance);
  }

  public setSimulatedNoise(type: 'none' | 'power_lines' | 'mineral_ground' | 'severe_drift') {
    switch (type) {
      case 'none':
        this.simulatedNoiseOffset = 0;
        this.simulatedNoiseJitter = 0;
        break;
      case 'power_lines': // High frequency electromagnetic jitter
        this.simulatedNoiseOffset = 2.0;
        this.simulatedNoiseJitter = 8.5;
        break;
      case 'mineral_ground': // Mineralized soil baseline offset + noise
        this.simulatedNoiseOffset = 4.5;
        this.simulatedNoiseJitter = 4.0;
        break;
      case 'severe_drift': // Gradual massive baseline drift
        this.simulatedNoiseOffset = 11.5;
        this.simulatedNoiseJitter = 2.0;
        break;
    }
    this.recalculate();
  }

  public getSimulatedNoiseType(): 'none' | 'power_lines' | 'mineral_ground' | 'severe_drift' {
    if (this.simulatedNoiseOffset >= 10) return 'severe_drift';
    if (this.simulatedNoiseJitter >= 7) return 'power_lines';
    if (this.simulatedNoiseOffset >= 4) return 'mineral_ground';
    return 'none';
  }

  public getState(): DriftMonitorState {
    return this.currentState;
  }

  public subscribe(listener: DriftListener): () => void {
    this.listeners.add(listener);
    listener(this.currentState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      listener(this.currentState);
    }
  }

  public resetHistory() {
    this.history = [];
    this.sampleWindow = [];
    this.recalculate();
  }
}

export const driftMonitorService = new CalibrationDriftMonitorService();
