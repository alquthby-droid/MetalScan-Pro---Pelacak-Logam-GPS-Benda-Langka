import React, { useState, useEffect, useRef } from 'react';
import { Compass, Navigation, Power, Check, Info, Radio, Sparkles, X, ChevronDown } from 'lucide-react';
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

  const [heading, setHeading] = useState<number>(0);
  const [pitch, setPitch] = useState<number>(0);
  const [roll, setRoll] = useState<number>(0);
  const [sensorType, setSensorType] = useState<'hardware_absolute' | 'hardware_relative' | 'gps' | 'idle'>('idle');
  const [isPopupOpen, setIsPopupOpen] = useState<boolean>(false);
  const [permissionState, setPermissionState] = useState<'granted' | 'prompt' | 'denied'>('granted');

  const popupRef = useRef<HTMLDivElement | null>(null);

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

  // Persist state changes
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

  // Device orientation listener
  useEffect(() => {
    if (!isEnabled) {
      setSensorType('idle');
      return;
    }

    let isAbsoluteSupported = false;

    // Check for iOS DeviceOrientationEvent permission requirement
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doe = window.DeviceOrientationEvent as any;
    if (doe && typeof doe.requestPermission === 'function') {
      setPermissionState('prompt');
    }

    const handleOrientation = (e: DeviceOrientationEvent) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyEvent = e as any;
      let rawHeading: number | null = null;

      // 1. iOS Safari native webkitCompassHeading (0 = North, clockwise)
      if (typeof anyEvent.webkitCompassHeading === 'number' && !isNaN(anyEvent.webkitCompassHeading)) {
        rawHeading = anyEvent.webkitCompassHeading;
        setSensorType('hardware_absolute');
      }
      // 2. Android absolute deviceorientation
      else if (e.absolute && typeof e.alpha === 'number') {
        // Android alpha: 0 is North, counter-clockwise
        rawHeading = (360 - e.alpha) % 360;
        setSensorType('hardware_absolute');
        isAbsoluteSupported = true;
      }
      // 3. Relative orientation fallback
      else if (typeof e.alpha === 'number' && !isAbsoluteSupported) {
        rawHeading = (360 - e.alpha) % 360;
        setSensorType('hardware_relative');
      }

      if (rawHeading !== null) {
        setHeading(Math.round(rawHeading));
      }

      if (typeof e.beta === 'number') setPitch(Math.round(e.beta));
      if (typeof e.gamma === 'number') setRoll(Math.round(e.gamma));
    };

    // Try listening to standard & absolute device orientation
    window.addEventListener('deviceorientationabsolute', handleOrientation as EventListener, true);
    window.addEventListener('deviceorientation', handleOrientation as EventListener, true);

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation as EventListener, true);
      window.removeEventListener('deviceorientation', handleOrientation as EventListener, true);
    };
  }, [isEnabled]);

  // GPS Heading fallback if device orientation is unavailable but GPS reports heading
  useEffect(() => {
    if (isEnabled && sensorType === 'idle' && userLocation?.heading !== null && userLocation?.heading !== undefined) {
      setHeading(Math.round(userLocation.heading));
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

  // Convert degrees to cardinal direction
  const getCardinal = (deg: number): { code: string; nameId: string; symbol: string } => {
    const normalized = ((deg % 360) + 360) % 360;
    if (normalized >= 337.5 || normalized < 22.5) return { code: 'N', nameId: 'Utara', symbol: '▲' };
    if (normalized >= 22.5 && normalized < 67.5) return { code: 'NE', nameId: 'Timur Laut', symbol: '↗' };
    if (normalized >= 67.5 && normalized < 112.5) return { code: 'E', nameId: 'Timur', symbol: '▶' };
    if (normalized >= 112.5 && normalized < 157.5) return { code: 'SE', nameId: 'Tenggara', symbol: '↘' };
    if (normalized >= 157.5 && normalized < 202.5) return { code: 'S', nameId: 'Selatan', symbol: '▼' };
    if (normalized >= 202.5 && normalized < 247.5) return { code: 'SW', nameId: 'Barat Daya', symbol: '↙' };
    if (normalized >= 247.5 && normalized < 292.5) return { code: 'W', nameId: 'Barat', symbol: '◀' };
    return { code: 'NW', nameId: 'Barat Laut', symbol: '↖' };
  };

  const cardinal = getCardinal(heading);

  // Relative bearing to active alarm target or nearest finding
  const targetInfo = (() => {
    const target = activeAlarmTarget || (nearestFinding ? { lat: nearestFinding.lat, lng: nearestFinding.lng, name: nearestFinding.name } : null);
    if (!target || !userLocation || target.lat === null || target.lng === null) return null;

    const bearingToTarget = calculateBearingDegrees(userLocation.lat, userLocation.lng, target.lat, target.lng);
    const distanceMeters = calculateDistanceMeters(userLocation.lat, userLocation.lng, target.lat, target.lng);
    
    // Relative steering angle: targetBearing - currentHeading
    let relativeAngle = (bearingToTarget - heading + 360) % 360;
    if (relativeAngle > 180) relativeAngle -= 360;

    return {
      name: target.name || 'Sasaran Anomali',
      bearing: bearingToTarget,
      distanceMeters,
      relativeAngle,
      isAligned: Math.abs(relativeAngle) <= 10,
    };
  })();

  return (
    <div className="relative inline-flex items-center" ref={popupRef}>
      {/* Header Compass Pill */}
      <div
        className={`flex items-center gap-1.5 p-1 rounded-2xl border transition-all text-xs font-mono shadow-sm select-none ${
          isEnabled
            ? 'bg-slate-900/95 border-cyan-500/50 text-slate-200 hover:border-cyan-400'
            : 'bg-slate-900/60 border-slate-800 text-slate-500'
        }`}
      >
        {/* Clickable Bearing Display */}
        <button
          type="button"
          onClick={() => setIsPopupOpen(!isPopupOpen)}
          className="flex items-center gap-1.5 pl-1.5 pr-1 py-0.5 hover:text-white transition-colors"
          title={isEnabled ? `Arah: ${heading}° ${cardinal.code} (${cardinal.nameId}) - Klik untuk Detail HUD Kompas` : 'Kompas Nonaktif - Klik tombol ON untuk mengaktifkan'}
        >
          {/* Animated Compass Rose Miniature */}
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center border relative transition-transform ${
              isEnabled
                ? 'bg-slate-950 border-cyan-400/80 shadow-cyan-900/40'
                : 'bg-slate-950 border-slate-800 opacity-60'
            }`}
          >
            {/* Compass rotating needle */}
            <div
              className="w-full h-full flex items-center justify-center transition-transform duration-200 ease-out"
              style={{
                transform: `rotate(${isEnabled ? -heading : 0}deg)`,
              }}
            >
              {/* North Pointer (Red) */}
              <div
                className={`w-1 h-2 rounded-t-sm absolute top-0.5 transition-colors ${
                  isEnabled ? 'bg-rose-500 shadow-sm shadow-rose-500/80' : 'bg-slate-600'
                }`}
              />
              {/* South Pointer (White/Slate) */}
              <div className="w-1 h-2 bg-slate-300 rounded-b-sm absolute bottom-0.5 opacity-80" />
              {/* Center Pivot */}
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 z-10" />
            </div>
          </div>

          {isEnabled ? (
            <div className="flex items-center gap-1 leading-tight">
              <span className="font-extrabold text-cyan-300 tracking-wider">
                {String(heading).padStart(3, '0')}°
              </span>
              <span className="font-black px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px]">
                {cardinal.code}
              </span>
            </div>
          ) : (
            <span className="text-[11px] font-mono text-slate-500">
              Kompas
            </span>
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
        <div className="absolute top-11 right-0 sm:left-0 z-[600] w-64 bg-slate-900/98 backdrop-blur-2xl border border-cyan-500/50 rounded-3xl p-4 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 text-slate-200 font-mono">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-100">
              <Compass className="w-4 h-4 text-cyan-400 animate-spin-slow" />
              <span>Kompas Arah Navigasi</span>
            </div>
            <button
              type="button"
              onClick={() => setIsPopupOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Large Dial Display */}
          <div className="py-3 flex flex-col items-center justify-center">
            <div className="relative w-32 h-32 rounded-full border-2 border-slate-700/80 bg-slate-950 flex items-center justify-center shadow-inner">
              {/* Outer Cardinal Markers (Fixed on dial) */}
              <span className="absolute top-1 text-[11px] font-extrabold text-rose-400">N</span>
              <span className="absolute bottom-1 text-[10px] font-bold text-slate-400">S</span>
              <span className="absolute right-1.5 text-[10px] font-bold text-slate-400">E</span>
              <span className="absolute left-1.5 text-[10px] font-bold text-slate-400">W</span>

              {/* Crosshair guide */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                <div className="w-full h-px bg-cyan-400" />
                <div className="h-full w-px bg-cyan-400 absolute" />
              </div>

              {/* Rotating Compass Card */}
              <div
                className="w-full h-full rounded-full flex items-center justify-center transition-transform duration-150 ease-out"
                style={{ transform: `rotate(${-heading}deg)` }}
              >
                {/* Needle North */}
                <div className="w-2 h-12 bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-full absolute top-3 shadow-lg shadow-rose-600/50" />
                {/* Needle South */}
                <div className="w-2 h-12 bg-gradient-to-b from-slate-400 to-slate-600 rounded-b-full absolute bottom-3" />
                {/* Center Core */}
                <div className="w-4 h-4 rounded-full bg-slate-900 border-2 border-cyan-400 z-10 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>
              </div>
            </div>

            {/* Heading Digital Badge */}
            <div className="mt-2.5 flex items-center gap-2">
              <span className="text-xl font-black text-cyan-300 font-mono">
                {String(heading).padStart(3, '0')}°
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                {cardinal.code} • {cardinal.nameId}
              </span>
            </div>
          </div>

          {/* Level / Pitch & Roll Tilt Indicators (Helps user keep detector coil parallel to ground) */}
          <div className="bg-slate-950/80 p-2.5 rounded-2xl border border-slate-800 text-[10px] flex items-center justify-between gap-2">
            <span className="text-slate-400 uppercase">Kemiringan HP:</span>
            <div className="flex items-center gap-2 font-mono">
              <span className={Math.abs(pitch) > 25 ? 'text-amber-400' : 'text-slate-300'}>
                Pitch: {pitch}°
              </span>
              <span>•</span>
              <span className={Math.abs(roll) > 25 ? 'text-amber-400' : 'text-slate-300'}>
                Roll: {roll}°
              </span>
            </div>
          </div>

          {/* Relative Target Guidance if an alarm or nearest finding is active */}
          {targetInfo && (
            <div className="mt-2 p-2.5 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 text-[10px] space-y-1">
              <div className="flex items-center justify-between text-cyan-300 font-bold">
                <span className="truncate max-w-[130px]">{targetInfo.name}</span>
                <span>{targetInfo.distanceMeters.toFixed(0)}m</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Arah Sasaran:</span>
                <span className="text-amber-300 font-semibold">{targetInfo.bearing}°</span>
              </div>
              <div className="text-[10px] text-center pt-1 font-bold">
                {targetInfo.isAligned ? (
                  <span className="text-emerald-400">✓ Lurus searah sasaran</span>
                ) : targetInfo.relativeAngle > 0 ? (
                  <span className="text-cyan-300">Belok Kanan {Math.round(targetInfo.relativeAngle)}°</span>
                ) : (
                  <span className="text-cyan-300">Belok Kiri {Math.round(Math.abs(targetInfo.relativeAngle))}°</span>
                )}
              </div>
            </div>
          )}

          {/* iOS Safari Permission Button if required */}
          {permissionState === 'prompt' && (
            <button
              type="button"
              onClick={requestIOSPermission}
              className="mt-2 w-full py-1.5 px-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-mono font-bold transition-all"
            >
              Izinkan Sensor Kompas
            </button>
          )}

          {/* Sensor Status Footer */}
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[9px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${sensorType === 'idle' ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
              {sensorType === 'hardware_absolute'
                ? 'Magnetometer Presisi'
                : sensorType === 'hardware_relative'
                ? 'Giroskop Orientasi'
                : sensorType === 'gps'
                ? 'Navigasi GPS'
                : 'Sensor Standby'}
            </span>
            <button
              type="button"
              onClick={toggleCompass}
              className="text-rose-400 hover:underline"
            >
              Matikan
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
