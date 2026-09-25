import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Compass,
  Navigation,
  Navigation2,
  Check,
  Info,
  Radio,
  Sparkles,
  X,
  RotateCcw,
  SlidersHorizontal,
  MapPin,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { GPSLocation, MetalFinding } from '../types/detector';
import { calculateBearingDegrees, calculateDistanceMeters } from '../services/routePlannerService';

interface HeaderCompassBearingProps {
  userLocation: GPSLocation | null;
  activeAlarmTarget?: {
    lat: number | null;
    lng: number | null;
    name: string | null;
  } | null;
  nearestFinding?: MetalFinding | null;
}

export type CompassMode = 'magnetic_north' | 'qibla' | 'target';

// Ka'bah / Makkah Al-Mukarramah Coordinates
const KAABA_COORDINATES = {
  lat: 21.422487,
  lng: 39.826206,
  name: "Ka'bah, Makkah",
};

// Default fallback coordinate if GPS not yet granted (Lombok NTB epicenter)
const DEFAULT_INDONESIA_LOCATION = {
  lat: -8.5833,
  lng: 116.1167,
};

/**
 * Calculates high-precision geodesic Qibla bearing in degrees (0 - 360)
 * from any point on Earth using spherical trigonometry
 */
export function calculateQiblaBearing(lat: number, lng: number): number {
  const phi1 = (lat * Math.PI) / 180;
  const phi2 = (KAABA_COORDINATES.lat * Math.PI) / 180;
  const deltaLambda = ((KAABA_COORDINATES.lng - lng) * Math.PI) / 180;

  const y = Math.sin(deltaLambda);
  const x = Math.cos(phi1) * Math.tan(phi2) - Math.sin(phi1) * Math.cos(deltaLambda);
  let qibla = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round(((qibla + 360) % 360) * 10) / 10;
}

/**
 * Calculates shortest difference between two angles in degrees (-180 to +180)
 */
function angularDifference(target: number, current: number): number {
  let diff = (target - current + 360) % 360;
  if (diff > 180) diff -= 360;
  return diff;
}

export const HeaderCompassBearing: React.FC<HeaderCompassBearingProps> = ({
  userLocation,
  activeAlarmTarget,
  nearestFinding,
}) => {
  // Persist ON/OFF state in localStorage
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('metalscan_header_compass_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  // Active Mode: 'magnetic_north' | 'qibla' | 'target'
  const [compassMode, setCompassMode] = useState<CompassMode>(() => {
    try {
      const saved = localStorage.getItem('metalscan_header_compass_mode') as CompassMode;
      if (saved === 'qibla' || saved === 'magnetic_north' || saved === 'target') {
        return saved;
      }
      return 'magnetic_north';
    } catch {
      return 'magnetic_north';
    }
  });

  const [heading, setHeading] = useState<number>(0);
  const [smoothHeading, setSmoothHeading] = useState<number>(0);
  const [pitch, setPitch] = useState<number>(0);
  const [roll, setRoll] = useState<number>(0);
  const [sensorType, setSensorType] = useState<
    'hardware_absolute' | 'ios_webkit' | 'hardware_relative' | 'gps' | 'idle'
  >('idle');
  const [isPopupOpen, setIsPopupOpen] = useState<boolean>(false);
  const [permissionState, setPermissionState] = useState<'granted' | 'prompt' | 'denied'>('granted');
  const [hasVibrated, setHasVibrated] = useState<boolean>(false);
  const [showSimControls, setShowSimControls] = useState<boolean>(false);

  const popupRef = useRef<HTMLDivElement | null>(null);
  const currentSmoothRef = useRef<number>(0);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setIsPopupOpen(false);
      }
    };
    if (isPopupOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPopupOpen]);

  // Persist enabled state changes
  const toggleCompass = () => {
    setIsEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('metalscan_header_compass_enabled', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Persist mode changes
  const handleSelectMode = (mode: CompassMode) => {
    setCompassMode(mode);
    try {
      localStorage.setItem('metalscan_header_compass_mode', mode);
    } catch {
      // ignore
    }
  };

  // Cycle mode from header button
  const handleCycleMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextMode: CompassMode =
      compassMode === 'magnetic_north'
        ? 'qibla'
        : compassMode === 'qibla' && (activeAlarmTarget || nearestFinding)
        ? 'target'
        : 'magnetic_north';
    handleSelectMode(nextMode);
  };

  // Real-time device orientation listener with screen rotation compensation
  useEffect(() => {
    if (!isEnabled) {
      setSensorType('idle');
      return;
    }

    let isAbsoluteDetected = false;

    // Check iOS permission requirement
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doe = window.DeviceOrientationEvent as any;
    if (doe && typeof doe.requestPermission === 'function') {
      setPermissionState('prompt');
    }

    const handleOrientation = (e: DeviceOrientationEvent) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyEvent = e as any;
      let rawHeading: number | null = null;

      // 1. iOS Safari webkitCompassHeading (0 = North, clockwise, highly accurate)
      if (
        typeof anyEvent.webkitCompassHeading === 'number' &&
        !isNaN(anyEvent.webkitCompassHeading) &&
        anyEvent.webkitCompassHeading >= 0
      ) {
        rawHeading = anyEvent.webkitCompassHeading;
        setSensorType('ios_webkit');
      }
      // 2. Android deviceorientationabsolute (e.absolute === true)
      else if (e.absolute && typeof e.alpha === 'number' && !isNaN(e.alpha)) {
        // In Android, alpha is counter-clockwise, 0 is North
        rawHeading = (360 - e.alpha) % 360;
        setSensorType('hardware_absolute');
        isAbsoluteDetected = true;
      }
      // 3. Fallback standard deviceorientation
      else if (typeof e.alpha === 'number' && !isNaN(e.alpha) && !isAbsoluteDetected) {
        rawHeading = (360 - e.alpha) % 360;
        setSensorType('hardware_relative');
      }

      // Compensate for screen orientation (portrait vs landscape)
      if (rawHeading !== null) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const screenAngle = (window.screen?.orientation?.angle || (window as any).orientation || 0) as number;
        const adjustedHeading = (rawHeading + screenAngle + 360) % 360;
        const rounded = Math.round(adjustedHeading);
        setHeading(rounded);

        // Circular smooth filter (exponential moving average avoiding 0/360 wrap glitch)
        const current = currentSmoothRef.current;
        const diff = angularDifference(rounded, current);
        // Alpha factor 0.35 gives responsive feel without shaking
        const nextVal = (current + diff * 0.35 + 360) % 360;
        currentSmoothRef.current = nextVal;
        setSmoothHeading(Math.round(nextVal));
      }

      if (typeof e.beta === 'number') setPitch(Math.round(e.beta));
      if (typeof e.gamma === 'number') setRoll(Math.round(e.gamma));
    };

    window.addEventListener('deviceorientationabsolute', handleOrientation as EventListener, true);
    window.addEventListener('deviceorientation', handleOrientation as EventListener, true);

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation as EventListener, true);
      window.removeEventListener('deviceorientation', handleOrientation as EventListener, true);
    };
  }, [isEnabled]);

  // GPS Heading fallback if device orientation is unavailable
  useEffect(() => {
    if (
      isEnabled &&
      sensorType === 'idle' &&
      userLocation?.heading !== null &&
      userLocation?.heading !== undefined &&
      !isNaN(userLocation.heading)
    ) {
      const h = Math.round(userLocation.heading);
      setHeading(h);
      setSmoothHeading(h);
      currentSmoothRef.current = h;
      setSensorType('gps');
    }
  }, [isEnabled, sensorType, userLocation]);

  // Request iOS permission if needed
  const requestIOSPermission = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doe = window.DeviceOrientationEvent as any;
    if (doe && typeof doe.requestPermission === 'function') {
      try {
        const response = await doe.requestPermission();
        if (response === 'granted') {
          setPermissionState('granted');
        } else {
          setPermissionState('denied');
        }
      } catch {
        setPermissionState('denied');
      }
    }
  };

  // Current effective coordinates (user GPS or regional fallback)
  const currentCoords = useMemo(() => {
    if (userLocation && typeof userLocation.lat === 'number' && typeof userLocation.lng === 'number') {
      return {
        lat: userLocation.lat,
        lng: userLocation.lng,
        isGPS: true,
      };
    }
    return {
      lat: DEFAULT_INDONESIA_LOCATION.lat,
      lng: DEFAULT_INDONESIA_LOCATION.lng,
      isGPS: false,
    };
  }, [userLocation]);

  // Calculate Qibla Bearing and distance
  const qiblaData = useMemo(() => {
    const bearing = calculateQiblaBearing(currentCoords.lat, currentCoords.lng);
    const distanceMeters = calculateDistanceMeters(
      currentCoords.lat,
      currentCoords.lng,
      KAABA_COORDINATES.lat,
      KAABA_COORDINATES.lng
    );
    const distanceKm = Math.round(distanceMeters / 1000);

    // Delta turn needed: Qibla - current heading
    let relativeDelta = angularDifference(bearing, smoothHeading);
    const isAligned = Math.abs(relativeDelta) <= 3; // within 3 degrees precision

    return {
      bearing,
      distanceKm,
      relativeDelta,
      isAligned,
    };
  }, [currentCoords, smoothHeading]);

  // Relative bearing to active alarm target or nearest finding
  const targetData = useMemo(() => {
    const target =
      activeAlarmTarget ||
      (nearestFinding ? { lat: nearestFinding.lat, lng: nearestFinding.lng, name: nearestFinding.name } : null);
    if (!target || !userLocation || target.lat === null || target.lng === null) return null;

    const bearing = calculateBearingDegrees(userLocation.lat, userLocation.lng, target.lat, target.lng);
    const distanceMeters = calculateDistanceMeters(userLocation.lat, userLocation.lng, target.lat, target.lng);
    let relativeDelta = angularDifference(bearing, smoothHeading);
    const isAligned = Math.abs(relativeDelta) <= 5;

    return {
      name: target.name || 'Sasaran Anomali Logam',
      bearing,
      distanceMeters,
      relativeDelta,
      isAligned,
    };
  }, [activeAlarmTarget, nearestFinding, userLocation, smoothHeading]);

  // Haptic feedback when accurately aligned with Qibla or North
  useEffect(() => {
    const shouldVibrate =
      (compassMode === 'qibla' && qiblaData.isAligned) ||
      (compassMode === 'magnetic_north' && Math.abs(angularDifference(0, smoothHeading)) <= 3);

    if (shouldVibrate && !hasVibrated) {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([40]);
        } catch {
          // ignore
        }
      }
      setHasVibrated(true);
    } else if (!shouldVibrate && hasVibrated) {
      setHasVibrated(false);
    }
  }, [compassMode, qiblaData.isAligned, smoothHeading, hasVibrated]);

  // Convert degrees to cardinal direction in Indonesian
  const getCardinal = (deg: number): { code: string; nameId: string; symbol: string } => {
    const normalized = ((deg % 360) + 360) % 360;
    if (normalized >= 337.5 || normalized < 22.5) return { code: 'U', nameId: 'Utara', symbol: '▲' };
    if (normalized >= 22.5 && normalized < 67.5) return { code: 'TL', nameId: 'Timur Laut', symbol: '↗' };
    if (normalized >= 67.5 && normalized < 112.5) return { code: 'T', nameId: 'Timur', symbol: '▶' };
    if (normalized >= 112.5 && normalized < 157.5) return { code: 'TG', nameId: 'Tenggara', symbol: '↘' };
    if (normalized >= 157.5 && normalized < 202.5) return { code: 'S', nameId: 'Selatan', symbol: '▼' };
    if (normalized >= 202.5 && normalized < 247.5) return { code: 'BD', nameId: 'Barat Daya', symbol: '↙' };
    if (normalized >= 247.5 && normalized < 292.5) return { code: 'B', nameId: 'Barat', symbol: '◀' };
    return { code: 'BL', nameId: 'Barat Laut', symbol: '↖' };
  };

  const currentCardinal = getCardinal(smoothHeading);
  const isFacingNorth = Math.abs(angularDifference(0, smoothHeading)) <= 3;
  const isDeviceFlat = Math.abs(pitch) <= 25 && Math.abs(roll) <= 25;

  // Active status color highlights
  const isModeAligned =
    (compassMode === 'qibla' && qiblaData.isAligned) ||
    (compassMode === 'magnetic_north' && isFacingNorth) ||
    (compassMode === 'target' && targetData?.isAligned);

  return (
    <div className="relative inline-flex items-center" ref={popupRef}>
      {/* Header Compass Main Pill */}
      <div
        className={`flex items-center gap-1.5 p-1 rounded-2xl border transition-all text-xs font-mono shadow-sm select-none ${
          !isEnabled
            ? 'bg-slate-900/60 border-slate-800 text-slate-500'
            : isModeAligned
            ? 'bg-emerald-950/90 border-emerald-500/80 text-emerald-200 shadow-lg shadow-emerald-900/40 ring-1 ring-emerald-500/40'
            : compassMode === 'qibla'
            ? 'bg-slate-900/95 border-amber-500/60 text-slate-200 hover:border-amber-400'
            : 'bg-slate-900/95 border-cyan-500/50 text-slate-200 hover:border-cyan-400'
        }`}
      >
        {/* Quick Mode Toggle Icon (🧭 vs 🕋 vs 🎯) */}
        {isEnabled && (
          <button
            type="button"
            onClick={handleCycleMode}
            className={`p-1 rounded-lg transition-all active:scale-90 flex items-center justify-center ${
              compassMode === 'qibla'
                ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40'
                : compassMode === 'target'
                ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40'
                : 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40'
            }`}
            title={`Mode: ${
              compassMode === 'qibla'
                ? 'Arah Kiblat (Ka’bah)'
                : compassMode === 'target'
                ? 'Sasaran Anomali'
                : 'Utara Magnetis'
            } - Klik untuk ganti mode`}
          >
            {compassMode === 'qibla' ? (
              <span className="text-xs leading-none select-none" role="img" aria-label="Kiblat">
                🕋
              </span>
            ) : compassMode === 'target' ? (
              <Radio className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
            )}
          </button>
        )}

        {/* Clickable Bearing Display to open detailed HUD */}
        <button
          type="button"
          onClick={() => setIsPopupOpen(!isPopupOpen)}
          className="flex items-center gap-1.5 px-1 py-0.5 hover:text-white transition-colors"
          title={
            isEnabled
              ? `Arah Sekarang: ${smoothHeading}° ${currentCardinal.code} (${currentCardinal.nameId}) | Mode: ${
                  compassMode === 'qibla' ? `Kiblat (${qiblaData.bearing}°)` : 'Utara Magnetis'
                } - Klik untuk HUD Lengkap`
              : 'Kompas Nonaktif - Klik ON untuk mengaktifkan'
          }
        >
          {/* Dynamic Animated Compass Miniature */}
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center border relative transition-transform ${
              !isEnabled
                ? 'bg-slate-950 border-slate-800 opacity-60'
                : isModeAligned
                ? 'bg-slate-950 border-emerald-400 shadow-sm shadow-emerald-400/50'
                : compassMode === 'qibla'
                ? 'bg-slate-950 border-amber-400/80 shadow-amber-900/30'
                : 'bg-slate-950 border-cyan-400/80 shadow-cyan-900/40'
            }`}
          >
            {/* Compass rotating needle container */}
            <div
              className="w-full h-full flex items-center justify-center transition-transform duration-100 ease-out"
              style={{
                transform: `rotate(${isEnabled ? -smoothHeading : 0}deg)`,
              }}
            >
              {/* North Pointer (Red) */}
              <div
                className={`w-1 h-2.5 rounded-t-sm absolute top-0.5 transition-colors ${
                  isEnabled ? 'bg-rose-500 shadow-sm shadow-rose-500/80' : 'bg-slate-600'
                }`}
              />
              {/* South Pointer (Silver) */}
              <div className="w-1 h-2.5 bg-slate-300 rounded-b-sm absolute bottom-0.5 opacity-80" />

              {/* Ka'bah marker miniature on dial if in Qibla mode */}
              {isEnabled && compassMode === 'qibla' && (
                <div
                  className="absolute inset-0 flex items-start justify-center pointer-events-none"
                  style={{ transform: `rotate(${qiblaData.bearing}deg)` }}
                >
                  <div className="w-1.5 h-1.5 bg-amber-400 rounded-full -mt-0.5 shadow-xs shadow-amber-300 ring-1 ring-amber-200" />
                </div>
              )}

              {/* Center Pivot */}
              <div
                className={`w-1.5 h-1.5 rounded-full z-10 ${
                  isModeAligned ? 'bg-emerald-400' : compassMode === 'qibla' ? 'bg-amber-400' : 'bg-cyan-400'
                }`}
              />
            </div>
          </div>

          {isEnabled ? (
            <div className="flex items-center gap-1 leading-tight">
              {compassMode === 'qibla' ? (
                <>
                  <span className="font-extrabold text-amber-300 tracking-wider">
                    {String(smoothHeading).padStart(3, '0')}°
                  </span>
                  <span
                    className={`font-black px-1 py-0.2 rounded text-[10px] ${
                      qiblaData.isAligned
                        ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 animate-pulse'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {qiblaData.isAligned ? 'KIBLAT ✓' : 'KBL'}
                  </span>
                </>
              ) : (
                <>
                  <span
                    className={`font-extrabold tracking-wider ${
                      isFacingNorth ? 'text-emerald-300' : 'text-cyan-300'
                    }`}
                  >
                    {String(smoothHeading).padStart(3, '0')}°
                  </span>
                  <span
                    className={`font-black px-1 py-0.2 rounded text-[10px] ${
                      isFacingNorth
                        ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                        : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    }`}
                  >
                    {currentCardinal.code}
                  </span>
                </>
              )}
            </div>
          ) : (
            <span className="text-[11px] font-mono text-slate-500">Kompas</span>
          )}
        </button>

        {/* ON / OFF Toggle Switch */}
        <button
          type="button"
          onClick={toggleCompass}
          className={`flex items-center justify-center px-1.5 py-0.5 rounded-lg text-[10px] font-mono font-black transition-all active:scale-95 ${
            isEnabled
              ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 shadow-xs'
              : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
          }`}
          title={isEnabled ? 'Matikan Kompas Header' : 'Aktifkan Kompas Header'}
        >
          {isEnabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Dropdown HUD Detail Compass Modal */}
      {isPopupOpen && isEnabled && (
        <div className="absolute top-12 right-0 sm:left-0 z-[650] w-72 sm:w-80 bg-slate-900/98 backdrop-blur-2xl border border-cyan-500/50 rounded-3xl p-4 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 text-slate-200 font-mono">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-100">
              <Compass className="w-4 h-4 text-cyan-400 animate-spin-slow" />
              <span>Kompas Navigasi & Kiblat</span>
            </div>
            <button
              type="button"
              onClick={() => setIsPopupOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mode Selector Segmented Tabs */}
          <div className="grid grid-cols-2 gap-1.5 mt-2.5 p-1 bg-slate-950/80 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => handleSelectMode('magnetic_north')}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all ${
                compassMode === 'magnetic_north'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Utara Magnetis</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectMode('qibla')}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all ${
                compassMode === 'qibla'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="text-xs">🕋</span>
              <span>Arah Kiblat</span>
            </button>
          </div>

          {/* Target Shortcut if active */}
          {(activeAlarmTarget || nearestFinding) && (
            <div className="mt-1.5 flex justify-end">
              <button
                type="button"
                onClick={() => handleSelectMode(compassMode === 'target' ? 'magnetic_north' : 'target')}
                className={`text-[10px] font-mono px-2 py-0.5 rounded-lg flex items-center gap-1 border transition-all ${
                  compassMode === 'target'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                    : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-rose-300'
                }`}
              >
                <Radio className="w-2.5 h-2.5 text-rose-400" />
                <span>
                  {compassMode === 'target' ? 'Mode Sasaran Aktif' : 'Lacak Sasaran Logam Terdekat'}
                </span>
              </button>
            </div>
          )}

          {/* Precision Circular Compass Dial */}
          <div className="py-3 flex flex-col items-center justify-center">
            <div className="relative w-40 h-40 rounded-full border-2 border-slate-700/80 bg-slate-950 flex items-center justify-center shadow-inner overflow-hidden">
              {/* Outer Degree Tick Ring */}
              <div
                className="absolute inset-0 rounded-full transition-transform duration-100 ease-out"
                style={{ transform: `rotate(${-smoothHeading}deg)` }}
              >
                {/* 12 Main Ticks (every 30 deg) */}
                {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                  <div
                    key={deg}
                    className="absolute inset-0 flex justify-center items-start pt-1"
                    style={{ transform: `rotate(${deg}deg)` }}
                  >
                    <div
                      className={`w-0.5 ${
                        deg % 90 === 0
                          ? deg === 0
                            ? 'h-3 bg-rose-500'
                            : 'h-2.5 bg-slate-400'
                          : 'h-1.5 bg-slate-600'
                      }`}
                    />
                  </div>
                ))}

                {/* Major Cardinal Labels attached to rotating dial */}
                <span className="absolute top-3 left-1/2 -translate-x-1/2 text-[11px] font-black text-rose-400">
                  U
                </span>
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-400">
                  S
                </span>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                  T
                </span>
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                  B
                </span>

                {/* Qibla Marker on rotating dial */}
                <div
                  className="absolute inset-0 flex justify-center items-start pt-0.5"
                  style={{ transform: `rotate(${qiblaData.bearing}deg)` }}
                >
                  <div className="flex flex-col items-center animate-bounce-slow">
                    <span className="text-[12px] leading-none drop-shadow-md" title={`Ka'bah (${qiblaData.bearing}°)`}>
                      🕋
                    </span>
                    <div className="w-1 h-3 bg-amber-400 rounded-b shadow-sm shadow-amber-400/80" />
                  </div>
                </div>

                {/* Target marker on rotating dial if target active */}
                {targetData && (
                  <div
                    className="absolute inset-0 flex justify-center items-start pt-1"
                    style={{ transform: `rotate(${targetData.bearing}deg)` }}
                  >
                    <div className="w-2 h-2 rounded-full bg-rose-500 border border-white shadow-sm shadow-rose-500 animate-ping" />
                  </div>
                )}
              </div>

              {/* Fixed Top Lubber Line (Indicator pointing forward) */}
              <div className="absolute top-0 z-20 flex flex-col items-center">
                <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[8px] border-t-cyan-400" />
              </div>

              {/* Center Crosshairs */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                <div className="w-full h-px bg-cyan-400" />
                <div className="h-full w-px bg-cyan-400 absolute" />
              </div>

              {/* Precision Needle (North/South) */}
              <div
                className="w-full h-full rounded-full flex items-center justify-center transition-transform duration-100 ease-out z-10 pointer-events-none"
                style={{ transform: `rotate(${-smoothHeading}deg)` }}
              >
                {/* Needle North (Red) */}
                <div className="w-2.5 h-14 bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-full absolute top-4 shadow-lg shadow-rose-600/50 flex items-center justify-center">
                  <div className="w-0.5 h-6 bg-rose-200 rounded-full opacity-60" />
                </div>
                {/* Needle South (Silver) */}
                <div className="w-2.5 h-14 bg-gradient-to-b from-slate-400 to-slate-600 rounded-b-full absolute bottom-4 flex items-center justify-center">
                  <div className="w-0.5 h-6 bg-slate-200 rounded-full opacity-40" />
                </div>
                {/* Center Core */}
                <div
                  className={`w-5 h-5 rounded-full bg-slate-900 border-2 z-10 flex items-center justify-center ${
                    isModeAligned
                      ? 'border-emerald-400 shadow-md shadow-emerald-400/50'
                      : compassMode === 'qibla'
                      ? 'border-amber-400'
                      : 'border-cyan-400'
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isModeAligned ? 'bg-emerald-300 animate-pulse' : 'bg-white'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Digital Readout & Status Banner */}
            <div className="mt-2.5 flex items-center gap-2">
              <span className="text-2xl font-black text-cyan-300 font-mono tracking-tight">
                {String(smoothHeading).padStart(3, '0')}°
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  {currentCardinal.code} • {currentCardinal.nameId}
                </span>
              </div>
            </div>
          </div>

          {/* Dynamic Guidance Banner Based on Active Mode */}
          {compassMode === 'qibla' ? (
            <div
              className={`p-3 rounded-2xl border text-xs space-y-1.5 transition-all ${
                qiblaData.isAligned
                  ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200 shadow-lg shadow-emerald-900/50'
                  : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
              }`}
            >
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5">
                  <span className="text-sm">🕋</span>
                  <span>Arah Kiblat (Ka'bah):</span>
                </span>
                <span className="text-amber-300 font-extrabold text-sm">{qiblaData.bearing}° BL</span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-300 border-t border-amber-500/20 pt-1">
                <span>Jarak ke Makkah:</span>
                <span className="font-semibold text-amber-300">~{qiblaData.distanceKm.toLocaleString('id-ID')} km</span>
              </div>

              {/* Steering Recommendation */}
              <div className="pt-1 text-center font-bold text-xs">
                {qiblaData.isAligned ? (
                  <div className="flex items-center justify-center gap-1 text-emerald-300">
                    <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                    <span>ALHAMDULILLAH! TEPAT MENGHADAP KIBLAT</span>
                  </div>
                ) : qiblaData.relativeDelta > 0 ? (
                  <div className="flex items-center justify-center gap-1 text-amber-300">
                    <Navigation className="w-3.5 h-3.5 rotate-90 text-amber-400" />
                    <span>Putar Badan ke KANAN {Math.round(qiblaData.relativeDelta)}°</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-1 text-amber-300">
                    <Navigation className="w-3.5 h-3.5 -rotate-90 text-amber-400" />
                    <span>Putar Badan ke KIRI {Math.round(Math.abs(qiblaData.relativeDelta))}°</span>
                  </div>
                )}
              </div>
            </div>
          ) : compassMode === 'target' && targetData ? (
            <div
              className={`p-3 rounded-2xl border text-xs space-y-1.5 ${
                targetData.isAligned
                  ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                  : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
              }`}
            >
              <div className="flex items-center justify-between font-bold">
                <span className="truncate max-w-[140px]">{targetData.name}</span>
                <span className="text-rose-300">{targetData.distanceMeters.toFixed(1)}m</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-300">
                <span>Arah Sasaran:</span>
                <span className="text-amber-300 font-semibold">{targetData.bearing}°</span>
              </div>
              <div className="pt-1 text-center font-bold text-xs">
                {targetData.isAligned ? (
                  <span className="text-emerald-400">✓ Lurus searah sasaran temuan!</span>
                ) : targetData.relativeDelta > 0 ? (
                  <span className="text-cyan-300">Belok Kanan {Math.round(targetData.relativeDelta)}°</span>
                ) : (
                  <span className="text-cyan-300">Belok Kiri {Math.round(Math.abs(targetData.relativeDelta))}°</span>
                )}
              </div>
            </div>
          ) : (
            <div
              className={`p-2.5 rounded-2xl border text-xs space-y-1 ${
                isFacingNorth
                  ? 'bg-emerald-950/70 border-emerald-500 text-emerald-200'
                  : 'bg-slate-950/70 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between font-bold">
                <span>Orientasi Utara Magnetis:</span>
                <span className="text-cyan-300">{smoothHeading}° {currentCardinal.code}</span>
              </div>
              <div className="text-[10px] text-center font-semibold pt-0.5">
                {isFacingNorth ? (
                  <span className="text-emerald-400 font-bold">✓ Tepat Menghadap Utara Sejati (0°)</span>
                ) : (
                  <span className="text-slate-400">
                    Jarum merah menunjuk ke Utara bumi. Sesuaikan arah ayunan detektor.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Level / Pitch & Roll Tilt Indicators (Helps user keep phone flat for maximum magnetometer accuracy) */}
          <div className="mt-2.5 bg-slate-950/90 p-2.5 rounded-2xl border border-slate-800 text-[10px] flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 text-slate-400 uppercase font-semibold">
              <span className={`w-2 h-2 rounded-full ${isDeviceFlat ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'}`} />
              <span>Kemiringan Ponsel:</span>
            </div>
            <div className="flex items-center gap-2 font-mono">
              <span className={Math.abs(pitch) > 25 ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                Pitch: {pitch}°
              </span>
              <span>•</span>
              <span className={Math.abs(roll) > 25 ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                Roll: {roll}°
              </span>
            </div>
          </div>

          {!isDeviceFlat && (
            <p className="mt-1 text-[9px] text-amber-400/90 text-center font-sans">
              ℹ️ Pegang ponsel mendatar (rata) agar sensor magnetik membaca arah paling akurat.
            </p>
          )}

          {/* iOS Safari Permission Button if required */}
          {permissionState === 'prompt' && (
            <button
              type="button"
              onClick={requestIOSPermission}
              className="mt-2.5 w-full py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-mono font-bold transition-all shadow-md"
            >
              Izinkan Sensor Kompas iOS
            </button>
          )}

          {/* Magnetometer Calibration Advice Accordion */}
          <div className="mt-2.5 p-2 bg-slate-950/60 rounded-xl border border-slate-800/80 text-[10px] text-slate-400">
            <div className="flex items-start gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-300">Kalibrasi Kompas:</span> Gerakkan ponsel membentuk pola
                angka 8 di udara selama 3 detik bila kompas menyimpang di dekat massa logam.
              </div>
            </div>
          </div>

          {/* Sensor Status Footer */}
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[9px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  sensorType === 'idle' ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'
                }`}
              />
              {sensorType === 'hardware_absolute'
                ? 'Magnetometer Presisi Absolut'
                : sensorType === 'ios_webkit'
                ? 'Sensor Kompas WebKit iOS'
                : sensorType === 'hardware_relative'
                ? 'Giroskop Orientasi'
                : sensorType === 'gps'
                ? 'Arah Navigasi GPS'
                : 'Sensor Siaga'}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSimControls(!showSimControls)}
                className="text-cyan-400 hover:underline"
              >
                {showSimControls ? 'Tutup Uji' : 'Uji Arah'}
              </button>
              <button
                type="button"
                onClick={toggleCompass}
                className="text-rose-400 hover:underline"
              >
                Matikan
              </button>
            </div>
          </div>

          {/* Test Simulation Controls for Desktop browser testing without physical magnetometer */}
          {showSimControls && (
            <div className="mt-2 p-2.5 bg-slate-950 border border-cyan-500/30 rounded-xl space-y-1.5 animate-in fade-in duration-150">
              <div className="flex justify-between items-center text-[10px] text-slate-300">
                <span>Simulasi Arah Kompas (Uji Perangkat):</span>
                <span className="font-bold text-cyan-300">{smoothHeading}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                value={smoothHeading}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setHeading(val);
                  setSmoothHeading(val);
                  currentSmoothRef.current = val;
                }}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-slate-500">
                <button
                  type="button"
                  onClick={() => {
                    setHeading(0);
                    setSmoothHeading(0);
                    currentSmoothRef.current = 0;
                  }}
                  className="hover:text-cyan-300"
                >
                  Utara (0°)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const qDeg = Math.round(qiblaData.bearing);
                    setHeading(qDeg);
                    setSmoothHeading(qDeg);
                    currentSmoothRef.current = qDeg;
                  }}
                  className="hover:text-amber-300 font-bold"
                >
                  Kiblat ({Math.round(qiblaData.bearing)}°)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHeading(180);
                    setSmoothHeading(180);
                    currentSmoothRef.current = 180;
                  }}
                  className="hover:text-cyan-300"
                >
                  Selatan (180°)
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
