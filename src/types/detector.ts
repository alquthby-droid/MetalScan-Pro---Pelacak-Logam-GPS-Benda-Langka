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
  isPriority?: boolean; // Geofence 5m monitoring target flag
  isFavorite?: boolean; // Favoritkan temuan untuk filter khusus di peta & statistik
  aiAnalysis?: GeminiFindingAnalysis;
  locationName?: string; // Nama lokasi / landmark terdekat dari reverse geocoding API
}

export type VibrationIntensity = 'light' | 'medium' | 'strong';

export type MotionActivityState = 'STATIONARY' | 'SLOW_MOVE' | 'FAST_MOVE';

export interface AdaptiveSamplingState {
  enabled: boolean;
  motionState: MotionActivityState;
  accelerometerMagnitude: number; // in m/s²
  motionSpeedEstimateMs: number; // in m/s
  sensorHz: number; // target sensor polling frequency (e.g. 8, 18, 32 Hz)
  gpsProfile: 'eco_standby' | 'balanced' | 'high_precision';
  gpsIntervalMs: number;
  estimatedBatterySavingsPercent: number; // e.g. 62%
  isDeviceMotionSupported: boolean;
  lastMotionUpdate: number;
}

export interface DetectorSettings {
  autoSaveEnabled: boolean;
  autoSaveThreshold: number; // in µT (net or total)
  soundEnabled: boolean;
  soundVolume: number;
  vibrationEnabled: boolean;
  vibrationIntensity?: VibrationIntensity; // 'light' | 'medium' | 'strong' (preferensi kenyamanan getaran haptik)
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
  adaptiveSamplingEnabled?: boolean; // Smart Battery Adaptive Sampling (Algoritma hemat daya berbasis sensor akselerometer)
  driftMonitorEnabled: boolean; // Calibration Drift Monitor active
  driftAlertThreshold: number; // in µT (e.g. 5.0 µT)
  driftSoundAlertEnabled: boolean; // Audio chime when environment becomes noisy
  geofenceEnabled: boolean; // Auto monitoring perimeter around priority findings
  geofenceRadiusMeters: number; // default 5 meters
  geofenceSoundAlertEnabled: boolean; // Audio chime upon entering 5m radius
  geofenceVibrationAlertEnabled: boolean; // Haptic vibration on geofence trigger
  themeMode?: ThemeMode; // 'auto' | 'night_vision' | 'dark' | 'day'
  tacticalNightVision?: boolean; // Deep OLED black + red/amber night vision accents
  weatherAlertsEnabled?: boolean; // Peringatan cuaca dan petir aktif
}

export type ExcavationSafetyLevel = 'safe' | 'caution' | 'danger';

export interface WeatherCondition {
  temperatureC: number;
  apparentTempC: number;
  humidityPercent: number;
  weatherCode: number;
  weatherDescription: string;
  weatherIcon: string;
  windSpeedKmH: number;
  windGustsKmH: number;
  precipitationMm: number;
  rainMm: number;
  precipitationProbability: number;
  isDay: boolean;
  sunrise?: string;
  sunset?: string;
  timezone: string;
  cityName?: string;
  lastUpdated: number;
  safetyAssessment: {
    level: ExcavationSafetyLevel;
    score: number; // 0 - 100
    title: string;
    advice: string;
    isLightningRisk: boolean;
    isHeavyRain: boolean;
    isMuddyGround: boolean;
  };
}

export type ThemeMode = 'auto' | 'night_vision' | 'dark' | 'day';

export interface NightModeState {
  themeMode: ThemeMode;
  isNightTime: boolean;
  isTacticalRedActive: boolean;
  localTimeString: string;
  sunsetTime?: string;
  sunriseTime?: string;
  reason: string;
}

export interface GeofenceTarget {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: MetalCategory;
  magneticStrength?: number;
  depthEstimateCm?: number;
  isPriority: boolean;
  radiusMeters: number;
}

export interface GeofenceEvent {
  target: GeofenceTarget;
  distanceMeters: number;
  bearingDegrees: number;
  timestamp: number;
  type: 'ENTER' | 'INSIDE' | 'EXIT';
}

export interface GeofenceState {
  isActive: boolean;
  activeTargetsCount: number;
  currentTargetInside: GeofenceTarget | null;
  currentDistanceMeters: number | null;
  currentBearingDegrees: number | null;
  lastTriggerTimestamp: number | null;
  isAudioMuted: boolean;
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
  adaptiveSamplingState?: AdaptiveSamplingState;
}

export type SoilMineralizationLevel = 'VERY_LOW' | 'LOW_MEDIUM' | 'HIGH' | 'SEVERE';

export interface SoilShallowFeasibility {
  status: 'EXCELLENT' | 'GOOD' | 'CHALLENGING' | 'POOR';
  title: string;
  description: string;
  effectiveShallowDepthCm: number;
  recommendedSensitivityReductionPercent: number;
  recommendedGroundBalanceOffset: number;
  tacticalAdvice: string[];
}

export interface SoilMineralizationProfile {
  id: string;
  timestamp: number;
  lat?: number;
  lng?: number;
  durationSeconds: number;
  sampleCount: number;
  meanStrength: number; // in µT
  noiseSigma: number; // standard deviation of noise in µT
  peakToPeakVariance: number; // max - min in µT
  magneticTiltVariation: number; // 3D angle jitter in degrees
  mineralizationScore: number; // 0 to 100
  level: SoilMineralizationLevel;
  soilClassification: string;
  shallowDetectionFeasibility: SoilShallowFeasibility;
  notes?: string;
}

export interface SoilProfilingProgress {
  isActive: boolean;
  isPaused: boolean;
  isCompleted: boolean;
  elapsedSeconds: number;
  remainingSeconds: number;
  totalDurationSeconds: number;
  progressPercent: number;
  currentSamplesCount: number;
  liveMean: number;
  liveSigma: number;
  liveMin: number;
  liveMax: number;
  currentScorePreview: number;
  recentNoiseWaveform: number[]; // last ~30 values for visual oscilloscope
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
