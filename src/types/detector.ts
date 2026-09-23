export type MetalCategory = 'gold' | 'meteorite' | 'bronze' | 'silver' | 'iron' | 'unknown';

export interface MagneticReading {
  x: number;
  y: number;
  z: number;
  total: number;
  netTotal: number;
  timestamp: number;
}

export interface GeminiFindingAnalysis {
  artifactName: string;
  confidenceScore: number;
  historicalEra: string;
  materialAnalysis: string;
  historicalContext: string;
  excavationAdvice: string;
  conservationTip: string;
  culturalSignificance: string;
  suggestedCategory: MetalCategory;
  analyzedAt?: number;
}

export interface GeminiExcavationHotspot {
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  priority: 'TINGGI' | 'SEDANG' | 'EKSPLORASI';
  expectedTargetType: string;
  estimatedDepthCm: number;
  tacticalRationale: string;
  suggestedDetectorSettings: string;
}

export interface GeminiHotspotsResult {
  clusterAnalysis: string;
  recommendationSummary: string;
  hotspots: GeminiExcavationHotspot[];
  analyzedAt?: number;
}

export interface MetalFinding {
  id: string;
  timestamp: number;
  lat: number;
  lng: number;
  accuracy: number;
  magneticStrength: number; // in µT
  netStrength: number; // µT above baseline
  category: MetalCategory;
  name: string;
  depthEstimateCm: number;
  note?: string;
  autoSaved: boolean;
  aiAnalysis?: GeminiFindingAnalysis;
}

export interface DetectorSettings {
  autoSaveEnabled: boolean;
  autoSaveThreshold: number; // in µT (net or total)
  soundEnabled: boolean;
  soundVolume: number;
  vibrationEnabled: boolean;
  proximityPulseEnabled: boolean; // Phone LED torch / visual pulse alarm
  proximityPulseThreshold: number; // in µT to trigger flash pulse
  sensitivity: number; // 1 to 5
  baselineOffset: number; // Calibrated Earth magnetic field
  detectionMode: 'all_metal' | 'relic_gold' | 'ferrous_reject';
  audioMode: 'tone' | 'geiger';
  isSimulated: boolean;
  batterySaverEnabled: boolean; // Auto reduce polling when battery low or screen off
  batterySaverThreshold: number; // percentage (e.g. 20)
  forceBatterySaver: boolean; // manual eco mode override
  driftMonitorEnabled: boolean; // Calibration Drift Monitor active
  driftAlertThreshold: number; // in µT (e.g. 5.0 µT)
  driftSoundAlertEnabled: boolean; // Audio chime when environment becomes noisy
}

export type DriftStatus = 'STABLE' | 'MODERATE_NOISE' | 'HIGH_NOISE' | 'SEVERE_DRIFT';

export interface DriftDataPoint {
  timestamp: number;
  total: number;
  baseline: number;
  drift: number;
  noiseSigma: number;
}

export interface CalibrationRecord {
  id: string;
  timestamp: number;
  previousBaseline: number;
  newBaseline: number;
  correctedDrift: number;
  noiseAtCalibration: number;
}

export interface DriftMonitorState {
  calibratedBaseline: number;
  calibratedAt: number;
  currentAmbient: number;
  drift: number;
  driftPercentage: number;
  driftRatePerMin: number;
  noiseSigma: number;
  peakToPeakNoise: number;
  qualityScore: number; // 0 - 100%
  status: DriftStatus;
  isNoisyEnvironment: boolean;
  needsRecalibration: boolean;
  history: DriftDataPoint[];
  calibrationLog: CalibrationRecord[];
  diagnosis: string;
  actionRecommendation: string;
}

export interface BatteryState {
  level: number; // 0 - 100%
  charging: boolean;
  supported: boolean;
  isLow: boolean;
  isScreenOff: boolean;
  isPowerSaveActive: boolean;
  currentMagnetometerHz: number;
  gpsMode: 'high_accuracy' | 'battery_saving' | 'standby';
}

export interface GPSLocation {
  lat: number;
  lng: number;
  accuracy: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
}
