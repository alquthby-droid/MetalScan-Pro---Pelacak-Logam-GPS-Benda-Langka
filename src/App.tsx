/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  Compass,
  MapPin,
  Activity,
  ListFilter,
  Volume2,
  VolumeX,
  Settings,
  BookOpen,
  Sparkles,
  Zap,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  BarChart3,
  Camera,
  Flashlight,
  Battery,
  BatteryCharging,
  BatteryWarning,
  Leaf,
  Heart,
} from 'lucide-react';

import {
  MagneticReading,
  MetalFinding,
  DetectorSettings,
  GPSLocation,
  BatteryState,
} from './types/detector';
import { sensorManager, SensorManager } from './services/sensorManager';
import { audioService } from './services/audioSynthesizer';
import { proximityPulseService } from './services/proximityPulse';
import { batteryManager } from './services/batteryManager';
import { GaugeMeter } from './components/GaugeMeter';
import { DepthProbabilityGauge } from './components/DepthProbabilityGauge';
import { WaveformChart } from './components/WaveformChart';
import { RadarScanner } from './components/RadarScanner';
import { FindingsMap } from './components/FindingsMap';
import { FindingsList } from './components/FindingsList';
import { FindingsDistributionChart } from './components/FindingsDistributionChart';
import { WeeklyTrendLineChart } from './components/WeeklyTrendLineChart';
import { ARMetalFinder } from './components/ARMetalFinder';
import { SimulationControls } from './components/SimulationControls';
import { DetectorSettingsModal } from './components/DetectorSettingsModal';
import { RareItemGuideModal } from './components/RareItemGuideModal';
import { ExportFindingsModal } from './components/ExportFindingsModal';
import { GeminiAnalysisModal } from './components/GeminiAnalysisModal';
import { GeminiHotspotsModal } from './components/GeminiHotspotsModal';
import {
  GeminiFindingAnalysis,
  GeminiExcavationHotspot,
  MetalCategory,
  DriftMonitorState,
  GeofenceState,
  WeatherCondition,
  NightModeState,
  ThemeMode,
} from './types/detector';
import { driftMonitorService } from './services/driftMonitor';
import { CalibrationDriftModal } from './components/CalibrationDriftModal';
import { CalibrationDriftBanner } from './components/CalibrationDriftBanner';
import { targetCenterAlarmService, TargetCenterAlarmState } from './services/targetCenterAlarm';
import { TargetCenterAlarmBanner } from './components/TargetCenterAlarmBanner';
import { HeaderCompassBearing } from './components/HeaderCompassBearing';
import { PWAInstallButton } from './components/PWAInstallButton';
import { geofenceService } from './services/geofenceService';
import { GeofenceAlertBanner } from './components/GeofenceAlertBanner';
import { FreeDeploymentGuideModal } from './components/FreeDeploymentGuideModal';
import { weatherService } from './services/weatherService';
import { WeatherBadgeHeader } from './components/WeatherBadgeHeader';
import { WeatherSafetyModal } from './components/WeatherSafetyModal';
import { ExcavationSafetyBanner } from './components/ExcavationSafetyBanner';
import { NightModeToggle } from './components/NightModeToggle';
import { SoilMineralizationModal } from './components/SoilMineralizationModal';
import { trailService } from './services/trailService';
import { reverseGeocodingService } from './services/reverseGeocodingService';
import { adaptiveSamplingService } from './services/adaptiveSamplingService';
import { AdaptiveSamplingState } from './types/detector';
import { Cloud, Eye } from 'lucide-react';

const DEFAULT_SETTINGS: DetectorSettings = {
  autoSaveEnabled: true,
  autoSaveThreshold: 90.0, // µT
  soundEnabled: true,
  soundVolume: 0.6,
  vibrationEnabled: true,
  vibrationIntensity: 'medium',
  proximityPulseEnabled: true,
  proximityPulseThreshold: 75.0, // µT
  sensitivity: 3,
  baselineOffset: 48.0,
  detectionMode: 'all_metal',
  audioMode: 'tone',
  isSimulated: false,
  batterySaverEnabled: true,
  batterySaverThreshold: 20,
  forceBatterySaver: false,
  adaptiveSamplingEnabled: true,
  driftMonitorEnabled: true,
  driftAlertThreshold: 5.0,
  driftSoundAlertEnabled: false,
  geofenceEnabled: true,
  geofenceRadiusMeters: 5,
  geofenceSoundAlertEnabled: true,
  geofenceVibrationAlertEnabled: true,
  themeMode: 'auto',
  tacticalNightVision: true,
  weatherAlertsEnabled: true,
};

const SEED_FINDINGS: MetalFinding[] = [
  {
    id: 'seed-1',
    timestamp: Date.now() - 1000 * 60 * 35,
    lat: -6.2088 + 0.0012,
    lng: 106.8456 + 0.0008,
    accuracy: 3.5,
    magneticStrength: 154.2,
    netStrength: 106.2,
    category: 'gold',
    name: 'Emas / Logam Mulia Berharga',
    depthEstimateCm: 11,
    note: 'Anomali terdeteksi di kedalaman dangkal tanah pasir.',
    autoSaved: true,
    isPriority: true,
    isFavorite: true,
  },
  {
    id: 'seed-2',
    timestamp: Date.now() - 1000 * 60 * 90,
    lat: -6.2088 - 0.0015,
    lng: 106.8456 + 0.0018,
    accuracy: 4.0,
    magneticStrength: 198.6,
    netStrength: 150.6,
    category: 'meteorite',
    name: 'Meteorit / Anomali Feromagnetik Langka',
    depthEstimateCm: 7,
    note: 'Batu berpori berat dengan tarikan magnetik kuat.',
    autoSaved: true,
    isPriority: true,
  },
  {
    id: 'seed-3',
    timestamp: Date.now() - 1000 * 60 * 180,
    lat: -6.2088 + 0.0005,
    lng: 106.8456 - 0.0022,
    accuracy: 5.0,
    magneticStrength: 78.4,
    netStrength: 30.4,
    category: 'bronze',
    name: 'Perunggu / Kuningan Kuno',
    depthEstimateCm: 18,
    note: 'Diduga pecahan uang koin kuno / artefak perunggu.',
    autoSaved: false,
    isFavorite: true,
  },
  {
    id: 'seed-4',
    timestamp: Date.now() - 1000 * 60 * 240,
    lat: -6.2088 - 0.0008,
    lng: 106.8456 - 0.0011,
    accuracy: 4.5,
    magneticStrength: 62.1,
    netStrength: 14.1,
    category: 'iron',
    name: 'Besi Tua / Relik Perkakasan',
    depthEstimateCm: 25,
    note: 'Paku tempa kuno atau serpihan perkakas besi.',
    autoSaved: false,
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'detector' | 'map' | 'list'>('detector');
  const [currentReading, setCurrentReading] = useState<MagneticReading>({
    x: 0,
    y: 0,
    z: 48,
    total: 48,
    netTotal: 0,
    timestamp: Date.now(),
  });
  const [baseline, setBaseline] = useState<number>(48.0);
  const [userLocation, setUserLocation] = useState<GPSLocation | null>(null);
  const [sensorStatus, setSensorStatus] = useState<{
    supported: boolean;
    type: 'hardware' | 'orientation_fallback' | 'simulation';
    message: string;
  }>({
    supported: false,
    type: 'simulation',
    message: 'Memulai sensor...',
  });

  const [settings, setSettings] = useState<DetectorSettings>(() => {
    try {
      const saved = localStorage.getItem('metalscan_settings');
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });

  const [findings, setFindings] = useState<MetalFinding[]>(() => {
    try {
      const saved = localStorage.getItem('metalscan_findings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return SEED_FINDINGS;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [analyzingFinding, setAnalyzingFinding] = useState<MetalFinding | null>(null);
  const [isHotspotsModalOpen, setIsHotspotsModalOpen] = useState<boolean>(false);
  const [showMapStats, setShowMapStats] = useState<boolean>(true);
  const [showARView, setShowARView] = useState<boolean>(false);
  const [isStrobing, setIsStrobing] = useState<boolean>(false);
  const [strobeIntensity, setStrobeIntensity] = useState<number>(0);
  const [torchStatus, setTorchStatus] = useState<{ supported: boolean; message: string }>({
    supported: false,
    message: '',
  });
  const [batteryState, setBatteryState] = useState<BatteryState>(() => batteryManager.getState());
  const [driftState, setDriftState] = useState<DriftMonitorState>(() => driftMonitorService.getState());
  const [isDriftModalOpen, setIsDriftModalOpen] = useState<boolean>(false);
  const [isDriftBannerDismissed, setIsDriftBannerDismissed] = useState<boolean>(false);
  const [isSoilProfilerOpen, setIsSoilProfilerOpen] = useState<boolean>(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [targetAlarmState, setTargetAlarmState] = useState<TargetCenterAlarmState>(() =>
    targetCenterAlarmService.getState()
  );

  useEffect(() => {
    const unsub = targetCenterAlarmService.subscribe((st) => setTargetAlarmState(st));
    return () => unsub();
  }, []);

  const [geofenceState, setGeofenceState] = useState<GeofenceState>(() => geofenceService.getState());
  const [isDeployGuideOpen, setIsDeployGuideOpen] = useState<boolean>(false);

  const [adaptiveSamplingState, setAdaptiveSamplingState] = useState<AdaptiveSamplingState>(() =>
    adaptiveSamplingService.getState()
  );

  useEffect(() => {
    adaptiveSamplingService.init();
    adaptiveSamplingService.setEnabled(settings.adaptiveSamplingEnabled ?? true);
    const unsub = adaptiveSamplingService.subscribe((st) => {
      setAdaptiveSamplingState(st);
      if (settings.adaptiveSamplingEnabled ?? true) {
        sensorManager.setDynamicAdaptiveSamplingRate(st.sensorHz);
      }
    });
    return () => {
      unsub();
      adaptiveSamplingService.destroy();
    };
  }, [settings.adaptiveSamplingEnabled]);

  useEffect(() => {
    const unsub = geofenceService.subscribe((st) => setGeofenceState(st));
    return () => unsub();
  }, []);

  useEffect(() => {
    geofenceService.syncTargets(findings, settings.geofenceRadiusMeters || 5);
  }, [findings, settings.geofenceRadiusMeters]);

  useEffect(() => {
    if (userLocation) {
      geofenceService.evaluatePosition(userLocation, settings);
    }
  }, [userLocation, settings]);

  const handleTogglePriority = (id: string) => {
    setFindings((prev) =>
      prev.map((f) => (f.id === id ? { ...f, isPriority: !f.isPriority } : f))
    );
  };

  const handleToggleFavorite = (id: string) => {
    setFindings((prev) =>
      prev.map((f) => (f.id === id ? { ...f, isFavorite: !f.isFavorite } : f))
    );
  };

  const [recentNotification, setRecentNotification] = useState<{
    title: string;
    message: string;
    category: string;
    time: number;
  } | null>(null);

  // Weather and Field Excavation Safety State
  const [weather, setWeather] = useState<WeatherCondition | null>(() => weatherService.getCondition());
  const [isWeatherModalOpen, setIsWeatherModalOpen] = useState<boolean>(false);
  const [isWeatherLoading, setIsWeatherLoading] = useState<boolean>(false);

  useEffect(() => {
    const unsub = weatherService.subscribe((cond) => setWeather(cond));
    return () => unsub();
  }, []);

  // Fetch real-time weather on GPS update and periodically every 10 mins
  useEffect(() => {
    const lat = userLocation?.lat ?? -6.2088;
    const lng = userLocation?.lng ?? 106.8456;
    weatherService.fetchWeather(lat, lng);

    const interval = setInterval(() => {
      weatherService.fetchWeather(lat, lng);
    }, 1000 * 60 * 10);

    return () => clearInterval(interval);
  }, [userLocation?.lat, userLocation?.lng]);

  const handleRefreshWeather = async () => {
    setIsWeatherLoading(true);
    const lat = userLocation?.lat ?? -6.2088;
    const lng = userLocation?.lng ?? 106.8456;
    await weatherService.fetchWeather(lat, lng, true);
    setIsWeatherLoading(false);
  };

  // Local Time Detection & Automatic Dark Mode / Tactical Night Vision
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const nightState: NightModeState = useMemo(() => {
    const hour = currentTime.getHours();
    const localTimeString = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isClockNight = hour >= 18 || hour < 6;
    const isSunNight = weather ? !weather.isDay : isClockNight;
    const effectiveIsNight = isSunNight;

    const mode = settings.themeMode || 'auto';
    let isNightActive = false;
    let isTactical = false;
    let reason = '';

    if (mode === 'auto') {
      isNightActive = effectiveIsNight;
      isTactical = effectiveIsNight && (settings.tacticalNightVision ?? true);
      reason = effectiveIsNight
        ? `Malam hari (${weather?.sunset ? `Sunset ${weather.sunset}` : '18:00 - 06:00'})`
        : `Siang hari (${weather?.sunrise ? `Sunrise ${weather.sunrise}` : '06:00 - 18:00'})`;
    } else if (mode === 'night_vision') {
      isNightActive = true;
      isTactical = true;
      reason = 'Mode Malam Taktis OLED Aktif Manual';
    } else if (mode === 'dark') {
      isNightActive = true;
      isTactical = false;
      reason = 'Mode Gelap Standar Aktif';
    } else {
      isNightActive = false;
      isTactical = false;
      reason = 'Mode Siang Terang Aktif';
    }

    return {
      themeMode: mode,
      isNightTime: isNightActive,
      isTacticalRedActive: isTactical,
      localTimeString,
      sunsetTime: weather?.sunset,
      sunriseTime: weather?.sunrise,
      reason,
    };
  }, [currentTime, weather, settings.themeMode, settings.tacticalNightVision]);

  // Auto-save cooldown and spike tracking refs
  const lastAutoSaveTimeRef = useRef<number>(0);
  const isSpikeActiveRef = useRef<boolean>(false);
  const spikePeakReadingRef = useRef<MagneticReading | null>(null);
  const latestLocationRef = useRef<GPSLocation | null>(null);
  const currentReadingRef = useRef<MagneticReading>(currentReading);

  useEffect(() => {
    currentReadingRef.current = currentReading;
  }, [currentReading]);

  // Persist findings
  useEffect(() => {
    try {
      localStorage.setItem('metalscan_findings', JSON.stringify(findings));
    } catch {
      // ignore
    }
  }, [findings]);

  // Persist settings
  useEffect(() => {
    try {
      localStorage.setItem('metalscan_settings', JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  // Initialize Battery Manager & Power Save Watcher
  useEffect(() => {
    let unsubBattery: (() => void) | null = null;

    batteryManager.init().then(() => {
      const initial = batteryManager.evaluate(
        settings.batterySaverEnabled ?? true,
        settings.batterySaverThreshold ?? 20,
        settings.forceBatterySaver ?? false,
        adaptiveSamplingState
      );
      setBatteryState(initial);
      if (initial.isPowerSaveActive || initial.isScreenOff) {
        sensorManager.setPowerSaveMode(initial.isPowerSaveActive, initial.isScreenOff);
      } else if (settings.adaptiveSamplingEnabled ?? true) {
        sensorManager.setDynamicAdaptiveSamplingRate(adaptiveSamplingState.sensorHz);
      }
    });

    unsubBattery = batteryManager.subscribe((st) => {
      setBatteryState(st);
      if (st.isPowerSaveActive || st.isScreenOff) {
        sensorManager.setPowerSaveMode(st.isPowerSaveActive, st.isScreenOff);
      } else if (settings.adaptiveSamplingEnabled ?? true) {
        sensorManager.setDynamicAdaptiveSamplingRate(adaptiveSamplingState.sensorHz);
      }
    });

    return () => {
      if (unsubBattery) unsubBattery();
      batteryManager.destroy();
    };
  }, []);

  // Update battery evaluation whenever power saving settings or adaptive sampling changes
  useEffect(() => {
    const st = batteryManager.evaluate(
      settings.batterySaverEnabled ?? true,
      settings.batterySaverThreshold ?? 20,
      settings.forceBatterySaver ?? false,
      adaptiveSamplingState
    );
    setBatteryState(st);
    if (st.isPowerSaveActive || st.isScreenOff) {
      sensorManager.setPowerSaveMode(st.isPowerSaveActive, st.isScreenOff);
    } else if (settings.adaptiveSamplingEnabled ?? true) {
      sensorManager.setDynamicAdaptiveSamplingRate(adaptiveSamplingState.sensorHz);
    } else {
      sensorManager.setPowerSaveMode(false, false);
    }
  }, [
    settings.batterySaverEnabled,
    settings.batterySaverThreshold,
    settings.forceBatterySaver,
    settings.adaptiveSamplingEnabled,
    adaptiveSamplingState,
  ]);

  // Initialize Sensors & Proximity Pulse
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let unsubStrobe: (() => void) | null = null;

    const setup = async () => {
      const res = await sensorManager.initSensor(false);
      setSensorStatus(res);
      setBaseline(sensorManager.getBaseline());

      unsubscribe = sensorManager.subscribe((reading) => {
        setCurrentReading(reading);
        currentReadingRef.current = reading;
        if (settings.driftMonitorEnabled ?? true) {
          driftMonitorService.updateReading(reading, isSpikeActiveRef.current);
        }

        if (latestLocationRef.current) {
          trailService.recordPoint(
            latestLocationRef.current.lat,
            latestLocationRef.current.lng,
            latestLocationRef.current.accuracy,
            reading.total,
            reading.netTotal,
            sensorManager.getBaseline()
          );
        }
      });

      // Listen for visual strobe state for UI screen flash
      unsubStrobe = proximityPulseService.onStrobeChange((strobing, intensity) => {
        setIsStrobing(strobing);
        setStrobeIntensity(intensity);
      });
    };

    setup();

    return () => {
      if (unsubscribe) unsubscribe();
      if (unsubStrobe) unsubStrobe();
      sensorManager.destroy();
      audioService.stopContinuousTone();
      proximityPulseService.destroy();
    };
  }, []);

  // Calibration Drift Monitor Watcher & Threshold Synchronization
  useEffect(() => {
    driftMonitorService.setThreshold(settings.driftAlertThreshold || 5.0);

    const unsubDrift = driftMonitorService.subscribe((state) => {
      setDriftState(state);

      // Play subtle warning audio if noise is high and sound alert is toggled on
      if (
        settings.driftSoundAlertEnabled &&
        (state.status === 'HIGH_NOISE' || state.status === 'SEVERE_DRIFT')
      ) {
        audioService.playAlertBeep(false);
      }
    });

    return () => {
      unsubDrift();
    };
  }, [settings.driftAlertThreshold, settings.driftSoundAlertEnabled, settings.driftMonitorEnabled]);

  // Initialize GPS Geolocation Watcher (Automatically reduced polling & low power mode when battery is low, screen is off, or user is stationary)
  useEffect(() => {
    if (!('geolocation' in navigator)) return;

    const isEco = batteryState.isPowerSaveActive;
    const isScreenHidden = batteryState.isScreenOff;
    const isAdaptive = (settings.adaptiveSamplingEnabled ?? true) && !isEco && !isScreenHidden;
    const gpsProfile = isAdaptive ? adaptiveSamplingState.gpsProfile : isEco ? 'eco_standby' : 'high_precision';

    const maxAge = isScreenHidden
      ? 60000
      : isEco
      ? 30000
      : gpsProfile === 'eco_standby'
      ? 25000
      : gpsProfile === 'balanced'
      ? 8000
      : 2500;

    const timeout = isEco ? 25000 : gpsProfile === 'eco_standby' ? 20000 : 10000;
    const enableHighAccuracy = !isEco && !isScreenHidden && (gpsProfile === 'high_precision' || !isAdaptive);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const loc: GPSLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          timestamp: pos.timestamp,
        };
        setUserLocation(loc);
        latestLocationRef.current = loc;
        adaptiveSamplingService.updateGpsSpeed(pos.coords.speed);
        targetCenterAlarmService.updateUserLocation(loc.lat, loc.lng);
        trailService.recordPoint(
          loc.lat,
          loc.lng,
          loc.accuracy,
          currentReadingRef.current.total,
          currentReadingRef.current.netTotal,
          sensorManager.getBaseline()
        );
      },
      (err) => {
        console.warn('Geolocation watch error:', err.message);
      },
      {
        enableHighAccuracy,
        maximumAge: maxAge,
        timeout,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [
    batteryState.isPowerSaveActive,
    batteryState.isScreenOff,
    settings.adaptiveSamplingEnabled,
    adaptiveSamplingState.gpsProfile,
  ]);

  // Update Audio feedback, Vibration & Proximity Pulse Flash LED based on magnetic reading
  useEffect(() => {
    // Only synthesize audio when on detector tab or if background allowed
    audioService.updateTone(
      currentReading.netTotal,
      settings.audioMode,
      settings.soundEnabled,
      settings.soundVolume
    );

    // Vibration pulse if strong signal
    if (
      settings.vibrationEnabled &&
      currentReading.total >= settings.autoSaveThreshold &&
      'vibrate' in navigator
    ) {
      try {
        const intensity = settings.vibrationIntensity || 'medium';
        const duration = intensity === 'light' ? 18 : intensity === 'strong' ? 75 : 40;
        navigator.vibrate(duration);
      } catch {
        // ignore
      }
    }

    // Proximity Pulse (Flash LED / Visual Strobe) update
    proximityPulseService.updateSignal(
      currentReading.netTotal,
      currentReading.total,
      settings.proximityPulseThreshold || 75.0,
      settings.proximityPulseEnabled ?? true
    );
  }, [currentReading, settings]);

  // Auto-Save Trigger Detection Logic
  useEffect(() => {
    if (!settings.autoSaveEnabled) return;

    const now = Date.now();
    const threshold = settings.autoSaveThreshold;

    if (currentReading.total >= threshold) {
      // Start or update spike
      if (!isSpikeActiveRef.current) {
        isSpikeActiveRef.current = true;
        spikePeakReadingRef.current = currentReading;
      } else {
        if (
          spikePeakReadingRef.current &&
          currentReading.total > spikePeakReadingRef.current.total
        ) {
          spikePeakReadingRef.current = currentReading;
        }
      }
    } else {
      // Spike has fallen back down below threshold
      if (isSpikeActiveRef.current) {
        isSpikeActiveRef.current = false;
        const peak = spikePeakReadingRef.current;

        // Check cooldown (min 8 seconds between auto-saves)
        if (peak && now - lastAutoSaveTimeRef.current > 8000) {
          lastAutoSaveTimeRef.current = now;
          recordFinding(peak, true);
        }
      }
    }
  }, [currentReading, settings.autoSaveEnabled, settings.autoSaveThreshold]);

  // Record a finding to state and map
  const recordFinding = useCallback(
    (reading: MagneticReading, isAutoSaved: boolean = false) => {
      const loc = latestLocationRef.current || userLocation || {
        lat: -6.2088 + (Math.random() - 0.5) * 0.003,
        lng: 106.8456 + (Math.random() - 0.5) * 0.003,
        accuracy: 8,
        altitude: null,
        speed: null,
        heading: null,
        timestamp: Date.now(),
      };

      const classification = SensorManager.classifyMetal(reading.netTotal, reading.total);

      const newFinding: MetalFinding = {
        id: `finding-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: Date.now(),
        lat: loc.lat,
        lng: loc.lng,
        accuracy: loc.accuracy || 5,
        magneticStrength: reading.total,
        netStrength: reading.netTotal,
        category: classification.category,
        name: classification.name,
        depthEstimateCm: classification.depthCm,
        note: isAutoSaved
          ? `Auto-rekam GPS saat mendeteksi fluks medan ${reading.total.toFixed(1)} µT`
          : 'Ditandai manual oleh pengguna',
        autoSaved: isAutoSaved,
      };

      setFindings((prev) => [newFinding, ...prev]);

      // Record point in trail service as confirmed anomaly
      trailService.recordPoint(
        loc.lat,
        loc.lng,
        loc.accuracy || 5,
        reading.total,
        reading.netTotal,
        sensorManager.getBaseline(),
        true,
        { name: classification.name, category: classification.category }
      );

      // Sound chime and celebratory visual alert
      audioService.playAlertBeep(true);
      if ('vibrate' in navigator && settings.vibrationEnabled) {
        try {
          const intensity = settings.vibrationIntensity || 'medium';
          const pattern =
            intensity === 'light'
              ? [40, 30, 50]
              : intensity === 'strong'
              ? [160, 50, 220, 50, 160]
              : [100, 50, 200];
          navigator.vibrate(pattern);
        } catch {
          // ignore
        }
      }

      try {
        confetti({
          particleCount: 35,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#eab308', '#38bdf8', '#a855f7', '#10b981'],
        });
      } catch {
        // ignore
      }

      setRecentNotification({
        title: isAutoSaved ? 'Auto-Simpan GPS Berhasil!' : 'Titik Temuan Disimpan!',
        message: `${classification.name} (${reading.total.toFixed(1)} µT) dicatat pada peta.`,
        category: classification.category,
        time: Date.now(),
      });

      // Clear toast after 5s
      setTimeout(() => {
        setRecentNotification(null);
      }, 5000);

      // Automatic Reverse Geocoding API: menambahkan nama lokasi atau landmark terdekat ke dalam temuan
      reverseGeocodingService
        .reverseGeocode(loc.lat, loc.lng)
        .then((geo) => {
          if (geo && geo.locationName) {
            setFindings((prev) =>
              prev.map((f) => {
                if (f.id === newFinding.id) {
                  const locationBadge = geo.landmark
                    ? `📍 Landmark: ${geo.landmark} (${geo.locationName})`
                    : `📍 Lokasi: ${geo.locationName}`;
                  return {
                    ...f,
                    locationName: geo.locationName,
                    note: `${locationBadge} • ${f.note || ''}`,
                  };
                }
                return f;
              })
            );

            setRecentNotification({
              title: isAutoSaved ? 'Auto-Simpan + Lokasi Terdeteksi!' : 'Temuan + Lokasi Terdeteksi!',
              message: `${classification.name} • 📍 ${geo.locationName}`,
              category: classification.category,
              time: Date.now(),
            });
          }
        })
        .catch((err) => {
          console.warn('Reverse geocoding error for finding:', err);
        });
    },
    [userLocation, settings.vibrationEnabled]
  );

  // Manual Pin Finding Button
  const handleManualPin = () => {
    audioService.unlockAudio();
    recordFinding(currentReading, false);
  };

  // Quick Pin: Satu klik cepat tandai lokasi saat ini & simpan sebagai Titik Pantau Favorit
  const handleQuickPinFavorite = useCallback(() => {
    audioService.unlockAudio();
    const loc = latestLocationRef.current || userLocation || {
      lat: -6.2088 + (Math.random() - 0.5) * 0.003,
      lng: 106.8456 + (Math.random() - 0.5) * 0.003,
      accuracy: 5,
      altitude: null,
      speed: null,
      heading: null,
      timestamp: Date.now(),
    };

    const reading = currentReadingRef.current;
    const classification = SensorManager.classifyMetal(reading.netTotal, reading.total);
    const countFavorites = findings.filter((f) => f.isFavorite).length + 1;

    const newFavoriteFinding: MetalFinding = {
      id: `fav-pin-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: Date.now(),
      lat: loc.lat,
      lng: loc.lng,
      accuracy: loc.accuracy || 5,
      magneticStrength: reading.total,
      netStrength: reading.netTotal,
      category: classification.category !== 'unknown' ? classification.category : 'gold',
      name: `Titik Pantau Favorit #${countFavorites}`,
      depthEstimateCm: classification.depthCm,
      note: `Titik Pantau Favorit ditandai cepat pada fluks ${reading.total.toFixed(1)} µT. Diprioritaskan untuk pemantauan berkala.`,
      autoSaved: false,
      isFavorite: true,
      isPriority: true,
    };

    setFindings((prev) => [newFavoriteFinding, ...prev]);

    // Record in trail service
    trailService.recordPoint(
      loc.lat,
      loc.lng,
      loc.accuracy || 5,
      reading.total,
      reading.netTotal,
      sensorManager.getBaseline(),
      true,
      { name: newFavoriteFinding.name, category: newFavoriteFinding.category }
    );

    // Audio chime & vibration
    audioService.playAlertBeep(true);
    if ('vibrate' in navigator && settings.vibrationEnabled) {
      try {
        const intensity = settings.vibrationIntensity || 'medium';
        const pattern =
          intensity === 'light'
            ? [35, 25, 45]
            : intensity === 'strong'
            ? [180, 50, 220, 50, 180]
            : [100, 40, 150];
        navigator.vibrate(pattern);
      } catch {
        // ignore
      }
    }

    try {
      confetti({
        particleCount: 40,
        spread: 70,
        origin: { y: 0.75 },
        colors: ['#f43f5e', '#ec4899', '#fb7185', '#eab308'],
      });
    } catch {
      // ignore
    }

    setRecentNotification({
      title: '⭐ Quick Pin: Titik Pantau Favorit Disimpan!',
      message: `${newFavoriteFinding.name} (${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}) dicatat & difavoritkan pada peta.`,
      category: 'gold',
      time: Date.now(),
    });

    setTimeout(() => {
      setRecentNotification(null);
    }, 5000);

    // Automatic Reverse Geocoding API: menambahkan nama lokasi atau landmark terdekat ke dalam Quick Pin
    reverseGeocodingService
      .reverseGeocode(loc.lat, loc.lng)
      .then((geo) => {
        if (geo && geo.locationName) {
          setFindings((prev) =>
            prev.map((f) => {
              if (f.id === newFavoriteFinding.id) {
                const locationBadge = geo.landmark
                  ? `📍 Landmark: ${geo.landmark} (${geo.locationName})`
                  : `📍 Lokasi: ${geo.locationName}`;
                return {
                  ...f,
                  locationName: geo.locationName,
                  note: `${locationBadge} • ${f.note || ''}`,
                };
              }
              return f;
            })
          );

          setRecentNotification({
            title: '⭐ Quick Pin: Lokasi Terdeteksi!',
            message: `📍 ${geo.locationName} (${newFavoriteFinding.name})`,
            category: 'gold',
            time: Date.now(),
          });
        }
      })
      .catch((err) => {
        console.warn('Quick Pin auto reverse geocoding error:', err);
      });
  }, [userLocation, findings, settings.vibrationEnabled]);

  // Tare Zero Calibration
  const handleTareZero = () => {
    audioService.unlockAudio();
    const newBase = sensorManager.calibrateBaseline();
    setBaseline(newBase);
    driftMonitorService.recordCalibration(newBase);
    setIsDriftBannerDismissed(false);
    setRecentNotification({
      title: 'Tara Nol Berhasil!',
      message: `Nilai dasar bumi dikalibrasi ke ${newBase.toFixed(1)} µT. Anomali logam sekarang terisolasi bersih.`,
      category: 'calibrated',
      time: Date.now(),
    });
    setTimeout(() => setRecentNotification(null), 4000);
  };

  // Soil Mineralization Tactical Settings Application
  const handleApplySoilSettings = (reductionPercent: number, gbOffset: number) => {
    setSettings((prev) => {
      let newSens = prev.sensitivity;
      if (reductionPercent >= 35) {
        newSens = Math.max(1, Math.min(prev.sensitivity, 2));
      } else if (reductionPercent >= 15) {
        newSens = Math.max(2, Math.min(prev.sensitivity, 3));
      }
      const newThreshold = Math.max(60, prev.autoSaveThreshold + gbOffset * 1.5);
      return {
        ...prev,
        sensitivity: newSens,
        autoSaveThreshold: Number(newThreshold.toFixed(1)),
      };
    });
    setRecentNotification({
      title: 'Setelan Tanah Diterapkan!',
      message: `Sensitivitas & ambang batas telah disesuaikan berdasarkan profil kepadatan mineral tanah.`,
      category: 'calibrated',
      time: Date.now(),
    });
    setTimeout(() => setRecentNotification(null), 4000);
  };

  const handleAddFinding = (newFinding: MetalFinding) => {
    setFindings((prev) => [newFinding, ...prev]);
    audioService.playAlertBeep(true);
    setRecentNotification({
      title: 'Target NTB Disimpan!',
      message: `${newFinding.name} ditambahkan ke koleksi temuan Anda.`,
      category: newFinding.category,
      time: Date.now(),
    });
    setTimeout(() => {
      setRecentNotification(null);
    }, 4000);
  };

  const handleDeleteFinding = (id: string) => {
    setFindings((prev) => prev.filter((f) => f.id !== id));
  };

  const handleClearAllFindings = () => {
    setFindings([]);
  };

  const handleUpdateNote = (id: string, note: string) => {
    setFindings((prev) =>
      prev.map((f) => (f.id === id ? { ...f, note } : f))
    );
  };

  const handleApplyGeminiAnalysis = (
    findingId: string,
    analysis: GeminiFindingAnalysis,
    updatedName?: string,
    updatedCategory?: MetalCategory,
    updatedNote?: string
  ) => {
    setFindings((prev) =>
      prev.map((f) => {
        if (f.id === findingId) {
          return {
            ...f,
            name: updatedName || f.name,
            category: updatedCategory || f.category,
            note: updatedNote !== undefined ? updatedNote : f.note,
            aiAnalysis: analysis,
          };
        }
        return f;
      })
    );
    setRecentNotification({
      title: 'Analisis AI Diterapkan!',
      message: `Rekomendasi artefak "${analysis.artifactName}" berhasil diperbarui.`,
      category: 'ai_updated',
      time: Date.now(),
    });
    setTimeout(() => setRecentNotification(null), 4000);
  };

  const handlePinHotspotToFindings = (hotspot: GeminiExcavationHotspot) => {
    const newFinding: MetalFinding = {
      id: `hotspot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      lat: hotspot.lat,
      lng: hotspot.lng,
      accuracy: hotspot.radiusMeters,
      magneticStrength: 78.5,
      netStrength: 30.5,
      category: 'unknown',
      name: `★ AI: ${hotspot.name}`,
      depthEstimateCm: hotspot.estimatedDepthCm,
      note: `[Prediksi AI: Prioritas ${hotspot.priority} - Sasaran: ${hotspot.expectedTargetType}] ${hotspot.tacticalRationale} | Setelan: ${hotspot.suggestedDetectorSettings}`,
      autoSaved: false,
    };
    setFindings((prev) => [newFinding, ...prev]);
    setRecentNotification({
      title: 'Hotspot AI Disematkan!',
      message: `${hotspot.name} berhasil ditambahkan ke peta navigasi GPS.`,
      category: 'hotspot_pinned',
      time: Date.now(),
    });
    setTimeout(() => setRecentNotification(null), 4000);
  };

  const toggleProximityPulse = async () => {
    const nextState = !(settings.proximityPulseEnabled ?? true);
    if (nextState) {
      const res = await proximityPulseService.initTorch();
      setTorchStatus(res);
    }
    setSettings((prev) => ({ ...prev, proximityPulseEnabled: nextState }));
  };

  return (
    <div
      className={`min-h-screen flex flex-col font-sans max-w-2xl mx-auto border-x shadow-2xl relative transition-colors duration-300 ${
        nightState.isTacticalRedActive
          ? 'bg-black border-red-950/70 text-rose-100 selection:bg-rose-900'
          : nightState.isNightTime
          ? 'bg-slate-950 border-slate-900 text-slate-100'
          : 'bg-slate-900 border-slate-800 text-slate-100'
      }`}
      onClick={() => audioService.unlockAudio()}
    >
      {/* Tactical Night Vision Top Strip */}
      {nightState.isTacticalRedActive && (
        <div className="bg-red-950/50 border-b border-red-900/50 px-3.5 py-1 text-[10px] font-mono text-rose-300 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Eye className="w-3 h-3 text-rose-400 animate-pulse" />
            <span>Mode Malam Taktis Aktif (OLED Reduksi Silau Lapangan)</span>
          </span>
          <span className="text-rose-400/80 font-bold">{nightState.localTimeString}</span>
        </div>
      )}

      {/* Proximity Pulse Night Vision Screen Strobe / Visual Alarm Backdrop Overlay */}
      {isStrobing && (
        <div
          className="fixed inset-0 pointer-events-none z-[999] transition-opacity duration-75 mix-blend-screen"
          style={{
            backgroundColor: '#fbbf24',
            opacity: Math.max(0.15, Math.min(0.7, strobeIntensity * 0.7)),
            boxShadow: 'inset 0 0 100px rgba(251, 191, 36, 0.9)',
          }}
        />
      )}

      {/* Android Native-Style Header Bar */}
      <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 px-3 py-2 flex items-center justify-between gap-1.5 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-cyan-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-900/30 text-white font-black text-xs shrink-0">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h1 className="text-xs sm:text-sm font-extrabold tracking-wide text-white uppercase font-mono truncate">
                MetalScan Pro
              </h1>
              <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                GPS
              </span>
            </div>
            <p className="text-[9px] text-slate-400 font-mono flex items-center gap-1 truncate">
              <span className="text-cyan-400 font-semibold">{currentReading.total.toFixed(0)} µT</span>
            </p>
          </div>
        </div>

        {/* Action icons with Real-time Compass, Weather, Night Mode, etc. */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Weather & Excavation Safety Live Badge */}
          <WeatherBadgeHeader
            weather={weather}
            onOpenWeatherModal={() => setIsWeatherModalOpen(true)}
          />

          {/* Local Time Detection & Auto Dark / Night Vision Toggle */}
          <NightModeToggle
            nightState={nightState}
            onSelectThemeMode={(mode) => setSettings((prev) => ({ ...prev, themeMode: mode }))}
          />

          {/* Real-time Bearing Compass with ON/OFF switch */}
          <HeaderCompassBearing
            userLocation={userLocation}
            activeAlarmTarget={
              targetAlarmState.isActive && targetAlarmState.targetId
                ? {
                    lat: targetAlarmState.targetLat,
                    lng: targetAlarmState.targetLng,
                    name: targetAlarmState.targetName,
                  }
                : null
            }
            nearestFinding={findings.length > 0 ? findings[0] : null}
          />

          {/* Android PWA Install App Button */}
          <PWAInstallButton variant="header" />

          {/* Calibration Drift Monitor Badge */}
          <button
            type="button"
            onClick={() => setIsDriftModalOpen(true)}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl border text-xs font-mono transition-all ${
              driftState.status === 'STABLE'
                ? 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                : driftState.status === 'MODERATE_NOISE'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-950/40'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm shadow-rose-950/40 animate-pulse'
            }`}
            title={`Calibration Drift Monitor: ${
              driftState.status === 'STABLE'
                ? `Baseline Stabil (Drift: ${driftState.drift > 0 ? '+' : ''}${driftState.drift.toFixed(1)} µT, Noise: ±${driftState.noiseSigma.toFixed(1)} µT)`
                : driftState.status === 'MODERATE_NOISE'
                ? `Noise Sedang (Drift: ${driftState.drift > 0 ? '+' : ''}${driftState.drift.toFixed(1)} µT)`
                : `Lingkungan Berisik! (Noise: ±${driftState.noiseSigma.toFixed(1)} µT)`
            } - Buka Monitor`}
          >
            <Activity
              className={`w-3.5 h-3.5 ${
                driftState.status === 'STABLE'
                  ? 'text-cyan-400'
                  : driftState.status === 'MODERATE_NOISE'
                  ? 'text-amber-400'
                  : 'text-rose-400 animate-spin'
              }`}
            />
            <span className="font-bold">
              {driftState.drift > 0 ? '+' : ''}
              {driftState.drift.toFixed(1)}
            </span>
            <span className="text-[9px] text-slate-400">µT</span>
            {driftState.status !== 'STABLE' && (
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  driftState.status === 'MODERATE_NOISE'
                    ? 'bg-amber-400'
                    : 'bg-rose-500 animate-ping'
                }`}
              />
            )}
          </button>

          {/* Battery & Eco Power-Save Indicator */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-mono transition-all ${
              batteryState.isPowerSaveActive
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-950/40'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
            title={`Baterai: ${batteryState.level}% ${batteryState.charging ? '(Mengisi Daya)' : ''} | Mode: ${
              batteryState.isPowerSaveActive
                ? `Hemat Daya Aktif (${batteryState.currentMagnetometerHz} Hz, GPS Eco)`
                : 'Normal (30 Hz, GPS Akurat)'
            }`}
          >
            {batteryState.charging ? (
              <BatteryCharging className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            ) : batteryState.isLow ? (
              <BatteryWarning className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
            ) : (
              <Battery className="w-3.5 h-3.5 text-slate-300" />
            )}
            <span>{batteryState.level}%</span>
            {batteryState.isPowerSaveActive ? (
              <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-400 text-black font-extrabold flex items-center gap-0.5">
                <Leaf className="w-2.5 h-2.5" />
                <span>ECO</span>
              </span>
            ) : (settings.adaptiveSamplingEnabled ?? true) ? (
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-bold font-mono flex items-center gap-0.5 ${
                  adaptiveSamplingState.motionState === 'STATIONARY'
                    ? 'bg-amber-500/30 text-amber-200 border border-amber-500/40'
                    : adaptiveSamplingState.motionState === 'SLOW_MOVE'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                }`}
                title={`Smart Battery Adaptive Sampling: ${
                  adaptiveSamplingState.motionState === 'STATIONARY'
                    ? 'Pengguna Berhenti (8 Hz • GPS Eco • Hemat ~62%)'
                    : adaptiveSamplingState.motionState === 'SLOW_MOVE'
                    ? 'Gerak Lambat/Ayunan Teliti (18 Hz • GPS Seimbang • Hemat ~40%)'
                    : 'Gerak Cepat (32 Hz • GPS Presisi)'
                }`}
              >
                <span>{adaptiveSamplingState.sensorHz}Hz</span>
              </span>
            ) : null}
          </button>

          {/* Proximity Pulse Flash LED quick toggle */}
          <button
            type="button"
            onClick={toggleProximityPulse}
            className={`p-2 rounded-xl border transition-all ${
              (settings.proximityPulseEnabled ?? true)
                ? isStrobing
                  ? 'bg-amber-400 text-black border-white shadow-lg shadow-amber-500/80 scale-105 animate-pulse font-bold'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
            title={`Proximity Pulse Flash LED: ${(settings.proximityPulseEnabled ?? true) ? 'Aktif (Berkedip sebanding intensitas)' : 'Nonaktif'}`}
          >
            <Flashlight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              audioService.unlockAudio();
              setSettings((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }));
            }}
            className={`p-2 rounded-xl border transition-colors ${
              settings.soundEnabled
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
            title="Aktif/Nonaktifkan Suara"
          >
            {settings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setIsGuideOpen(true)}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-800 transition-colors"
            title="Buku Panduan Identifikasi Benda Langka"
          >
            <BookOpen className="w-4 h-4" />
          </button>

          {/* Panduan Deploy Cloud Gratis Modal Trigger */}
          <button
            type="button"
            onClick={() => setIsDeployGuideOpen(true)}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-800 transition-colors"
            title="Panduan Deploy Cloud Gratis (Render, Cloudflare, Railway, Koyeb, dll.)"
          >
            <Cloud className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
            title="Pengaturan Sensor & Auto-GPS"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Excavation Weather Safety Warning Banner (Lightning / Heavy Rain / Dangerous Mud alert) */}
      <ExcavationSafetyBanner
        weather={weather}
        onOpenWeatherModal={() => setIsWeatherModalOpen(true)}
      />

      {/* Geofence 5m Priority Finding Proximity Alert Banner */}
      {geofenceState.currentTargetInside && (
        <GeofenceAlertBanner
          geofenceState={geofenceState}
          onDismiss={() => geofenceService.dismissCurrentAlert()}
          onNavigateToMap={() => {
            setActiveTab('map');
            geofenceService.dismissCurrentAlert();
          }}
          onActivateTargetAlarm={(target) => {
            targetCenterAlarmService.activateAlarm(
              {
                id: target.id,
                name: target.name,
                category: target.category,
                lat: target.lat,
                lng: target.lng,
                depthEstimateCm: target.depthEstimateCm ?? 15,
              },
              userLocation?.lat,
              userLocation?.lng
            );
          }}
          onOpenCompass={() => {
            setActiveTab('list');
            geofenceService.dismissCurrentAlert();
          }}
          onToggleMute={() => geofenceService.toggleMute()}
        />
      )}

      {/* Floating Notification Toast */}
      {recentNotification && (
        <div className="fixed top-16 left-4 right-4 max-w-md mx-auto z-[550] bg-slate-900/95 backdrop-blur-xl border border-amber-500/50 rounded-2xl p-3.5 shadow-2xl animate-in slide-in-from-top duration-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0">
              <CheckCircle2 className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-100">{recentNotification.title}</h4>
              <p className="text-[11px] text-slate-300 leading-tight mt-0.5 font-mono">
                {recentNotification.message}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRecentNotification(null)}
            className="text-slate-400 hover:text-white text-sm p-1"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Tab Views */}
      <main className="flex-1 p-4 pb-24 space-y-4">
        {activeTab === 'detector' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Quick Status / Auto-save Status Strip with AR Toggle */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/60 border border-slate-800 px-3.5 py-2 rounded-2xl text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      settings.autoSaveEnabled ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'
                    }`}
                  />
                  <span className="text-slate-300">
                    Auto-GPS:{' '}
                    <strong className={settings.autoSaveEnabled ? 'text-amber-400' : 'text-slate-500'}>
                      {settings.autoSaveEnabled ? `AKTIF (>${settings.autoSaveThreshold} µT)` : 'NONAKTIF'}
                    </strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* AR Camera Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setShowARView(!showARView)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-xl font-bold text-xs font-mono border transition-all ${
                      showARView
                        ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white border-cyan-400 shadow-md shadow-cyan-900/50'
                        : 'bg-slate-800/90 text-cyan-400 border-cyan-500/30 hover:bg-slate-800 hover:border-cyan-400/60'
                    }`}
                    title="Lihat Temuan di Dunia Nyata Melalui Kamera AR"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{showARView ? 'Tutup AR' : 'Kamera AR (3D)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleManualPin}
                    className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold text-xs shadow-md shadow-cyan-900/40 active:scale-95 transition-all"
                    title="Simpan titik GPS lokasi saat ini ke peta"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Tandai GPS</span>
                  </button>
                </div>
              </div>

              {/* Eco Power-Save Active Banner */}
              {batteryState.isPowerSaveActive && (
                <div className="flex items-center justify-between bg-emerald-950/40 border border-emerald-500/30 px-3.5 py-1.5 rounded-xl text-xs font-mono text-emerald-300 shadow-sm animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <Leaf className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>
                      <strong className="text-emerald-200">Mode Hemat Daya:</strong> Magnetometer{' '}
                      <span className="text-white font-bold">{batteryState.currentMagnetometerHz} Hz</span> • GPS Mode Hemat
                      {batteryState.isScreenOff && ' (Layar Redup/Mati)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    className="text-[11px] underline text-emerald-400 hover:text-white"
                  >
                    Atur
                  </button>
                </div>
              )}
            </div>

            {/* Augmented Reality View (Shown when toggled) */}
            {showARView && (
              <ARMetalFinder
                findings={findings}
                userLocation={userLocation}
                currentMagneticStrength={currentReading.total}
              />
            )}

            {/* Calibration Drift Monitor & Environmental Noise Warning Banner */}
            {(settings.driftMonitorEnabled ?? true) && !isDriftBannerDismissed && (
              <CalibrationDriftBanner
                driftState={driftState}
                onOpenModal={() => setIsDriftModalOpen(true)}
                onTareZero={handleTareZero}
                onDismiss={() => setIsDriftBannerDismissed(true)}
              />
            )}

            {/* Tactical Analog / Digital Arc Gauge */}
            <GaugeMeter
              totalStrength={currentReading.total}
              netStrength={currentReading.netTotal}
              baseline={baseline}
              threshold={settings.autoSaveThreshold}
              onTareZero={handleTareZero}
              isProximityPulsing={isStrobing}
              driftState={driftState}
              onOpenDriftMonitor={() => setIsDriftModalOpen(true)}
              onOpenSoilProfiler={() => setIsSoilProfilerOpen(true)}
            />

            {/* Visual Real-time Depth Probability Gauge */}
            <DepthProbabilityGauge
              netStrength={currentReading.netTotal}
              totalStrength={currentReading.total}
              baseline={baseline}
              threshold={settings.autoSaveThreshold}
              onOpenSoilProfiler={() => setIsSoilProfilerOpen(true)}
            />

            {/* Real-time Oscilloscope Waveform Canvas */}
            <WaveformChart
              currentReading={currentReading}
              baseline={baseline}
              threshold={settings.autoSaveThreshold}
              autoSaveEnabled={settings.autoSaveEnabled}
            />

            {/* Radar Proximity Sonar Scanner */}
            <RadarScanner
              netStrength={currentReading.netTotal}
              totalStrength={currentReading.total}
              heading={userLocation?.heading || null}
            />

            {/* Quick Testing Console for Laptop / Testing */}
            <SimulationControls
              isSimulating={sensorManager.isSimulating()}
              onToggleSim={(sim) => sensorManager.setSimulationMode(sim)}
              onTareZero={handleTareZero}
              sensorType={sensorStatus.type}
              onOpenSoilProfiler={() => setIsSoilProfilerOpen(true)}
            />
          </div>
        )}

        {activeTab === 'map' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-cyan-400" />
                  <span>Peta Sebaran Temuan Logam</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Titik koordinat yang disimpan otomatis berdasarkan anomali sensor
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleQuickPinFavorite}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-rose-600 via-pink-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white rounded-xl text-xs font-mono font-bold shadow-md shadow-rose-950/40 border border-rose-400/50 transition-all active:scale-95 group"
                  title="Quick Pin: Tandai lokasi saat ini dengan satu klik & simpan otomatis sebagai Titik Pantau Favorit"
                >
                  <Heart className="w-3.5 h-3.5 fill-current text-white animate-pulse group-hover:scale-125 transition-transform" />
                  <span>Quick Pin (Titik Pantau)</span>
                </button>

                <button
                  type="button"
                  onClick={handleManualPin}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-mono font-semibold shadow-md transition-all active:scale-95"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tandai Manual</span>
                </button>
              </div>
            </div>

            {/* Target Center Sensor Alarm HUD Banner if active */}
            {targetAlarmState.isActive && targetAlarmState.targetId && (
              <TargetCenterAlarmBanner
                alarmState={targetAlarmState}
                onDeactivate={() => targetCenterAlarmService.deactivateAlarm()}
              />
            )}

            {/* Leaflet Map Canvas */}
            <FindingsMap
              findings={findings}
              userLocation={userLocation}
              onDeleteFinding={handleDeleteFinding}
              onOpenExportModal={() => setIsExportModalOpen(true)}
              onOpenHotspotsModal={() => setIsHotspotsModalOpen(true)}
              onTogglePriority={handleTogglePriority}
              onToggleFavorite={handleToggleFavorite}
              onQuickPin={handleQuickPinFavorite}
            />

            {/* Quick summary below map with D3 toggle & Export launcher */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 text-xs text-slate-300 font-mono flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-slate-400">Tersimpan:</span>{' '}
                <strong className="text-slate-100">{findings.length} Titik</strong>
                <span className="text-slate-600 mx-2">|</span>
                <span className="text-slate-400">Auto-GPS:</span>{' '}
                <strong className="text-amber-400">
                  {findings.filter((f) => f.autoSaved).length} Otomatis
                </strong>
              </div>

              <div className="flex items-center gap-2">
                {findings.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsHotspotsModalOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-mono border bg-amber-600/20 text-amber-300 border-amber-500/40 hover:bg-amber-600/30 transition-all"
                    title="Prediksi Hotspot Penggalian Berikutnya dengan Gemini AI"
                  >
                    <span>Hotspot AI</span>
                  </button>
                )}

                {findings.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsExportModalOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-mono border bg-teal-600/20 text-teal-300 border-teal-500/40 hover:bg-teal-600/30 transition-all"
                    title="Ekspor Laporan PDF Lengkap Peta & CSV Spreadsheet"
                  >
                    <span>Ekspor PDF / CSV</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowMapStats(!showMapStats)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-mono border transition-all ${
                    showMapStats
                      ? 'bg-purple-600/30 text-purple-300 border-purple-500/50'
                      : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
                  <span>{showMapStats ? 'Sembunyikan D3' : 'Statistik D3'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <span>Lihat Tabel Data</span>
                  <span>→</span>
                </button>
              </div>
            </div>

            {/* D3 Distribution Bar Chart & Weekly Trend Line Chart underneath map if enabled */}
            {showMapStats && (
              <div className="space-y-4">
                <FindingsDistributionChart
                  findings={findings}
                  selectedCategory={selectedCategoryFilter}
                  onSelectCategory={setSelectedCategoryFilter}
                />
                <WeeklyTrendLineChart findings={findings} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'list' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* D3 Bar Chart Visualization for Metal Type Distribution */}
            <FindingsDistributionChart
              findings={findings}
              selectedCategory={selectedCategoryFilter}
              onSelectCategory={setSelectedCategoryFilter}
            />

            {/* Weekly Trend Line Chart - Tren Temuan 7 Hari Terakhir */}
            <WeeklyTrendLineChart findings={findings} />

            <FindingsList
              findings={findings}
              userLocation={userLocation}
              baseline={baseline}
              threshold={settings.autoSaveThreshold}
              onDeleteFinding={handleDeleteFinding}
              onClearAll={handleClearAllFindings}
              onUpdateNote={handleUpdateNote}
              onNavigateToMap={() => setActiveTab('map')}
              onOpenExportModal={() => setIsExportModalOpen(true)}
              onOpenAnalysisModal={(finding) => setAnalyzingFinding(finding)}
              onOpenHotspotsModal={() => setIsHotspotsModalOpen(true)}
              onOpenSoilProfiler={() => setIsSoilProfilerOpen(true)}
              selectedCategory={selectedCategoryFilter}
              onCategoryChange={setSelectedCategoryFilter}
              onAddFinding={handleAddFinding}
              onTogglePriority={handleTogglePriority}
              onToggleFavorite={handleToggleFavorite}
            />
          </div>
        )}
      </main>

      {/* Android Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/90 z-50 px-6 py-2.5 flex items-center justify-around shadow-2xl">
        <button
          type="button"
          onClick={() => {
            audioService.unlockAudio();
            setActiveTab('detector');
          }}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'detector'
              ? 'text-cyan-400 scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-5 h-5" />
          <span className="text-[10px] font-mono font-semibold">Detektor & Grafik</span>
        </button>

        <button
          type="button"
          onClick={() => {
            audioService.unlockAudio();
            setActiveTab('map');
          }}
          className={`flex flex-col items-center gap-1 transition-all relative ${
            activeTab === 'map'
              ? 'text-cyan-400 scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapPin className="w-5 h-5" />
          <span className="text-[10px] font-mono font-semibold">Peta Temuan</span>
          {findings.length > 0 && (
            <span className="absolute -top-1 right-2 w-4 h-4 bg-amber-500 text-slate-950 text-[9px] font-bold rounded-full flex items-center justify-center font-mono">
              {findings.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            audioService.unlockAudio();
            setActiveTab('list');
          }}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'list'
              ? 'text-cyan-400 scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px] font-mono font-semibold">Statistik & Log</span>
        </button>
      </nav>

      {/* Settings Modal */}
      <DetectorSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(newSettings) => setSettings((prev) => ({ ...prev, ...newSettings }))}
        batteryState={batteryState}
        onOpenDeployGuide={() => setIsDeployGuideOpen(true)}
        onOpenWeatherModal={() => setIsWeatherModalOpen(true)}
      />

      {/* Real-time Weather & Excavation Safety Assessment Modal */}
      <WeatherSafetyModal
        isOpen={isWeatherModalOpen}
        onClose={() => setIsWeatherModalOpen(false)}
        weather={weather}
        onRefresh={handleRefreshWeather}
        isLoading={isWeatherLoading}
      />

      {/* Free Deployment Guide Modal (Non-Vercel / Non-Netlify) */}
      <FreeDeploymentGuideModal
        isOpen={isDeployGuideOpen}
        onClose={() => setIsDeployGuideOpen(false)}
      />

      {/* Rare Item Guide Modal */}
      <RareItemGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      {/* Export Findings & Maps Modal */}
      <ExportFindingsModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        findings={findings}
        userLocation={userLocation}
      />

      {/* Gemini AI Artifact & Historical Analysis Modal */}
      <GeminiAnalysisModal
        isOpen={!!analyzingFinding}
        onClose={() => setAnalyzingFinding(null)}
        finding={analyzingFinding}
        userLocation={userLocation}
        onApplyAnalysis={handleApplyGeminiAnalysis}
      />

      {/* Gemini AI Next Excavation Hotspots Suggestion Modal */}
      <GeminiHotspotsModal
        isOpen={isHotspotsModalOpen}
        onClose={() => setIsHotspotsModalOpen(false)}
        findings={findings}
        userLocation={userLocation}
        onPinHotspotToFindings={handlePinHotspotToFindings}
        onNavigateToMap={() => setActiveTab('map')}
      />

      {/* Calibration Drift Monitor Modal */}
      <CalibrationDriftModal
        isOpen={isDriftModalOpen}
        onClose={() => setIsDriftModalOpen(false)}
        driftState={driftState}
        onTareZero={handleTareZero}
        settings={settings}
        onUpdateSettings={(newSettings) => setSettings((prev) => ({ ...prev, ...newSettings }))}
      />

      {/* Soil Mineralization Profiler 60-Second System Modal */}
      <SoilMineralizationModal
        isOpen={isSoilProfilerOpen}
        onClose={() => setIsSoilProfilerOpen(false)}
        userLat={userLocation?.lat}
        userLng={userLocation?.lng}
        onApplySettings={handleApplySoilSettings}
      />
    </div>
  );
}
