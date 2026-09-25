import React, { useState, useEffect, useRef } from 'react';
import {
  NTBPriorityFinding,
  NTB_PRIORITY_FINDINGS,
  calculateDistanceMeters,
  calculateBearingDegrees,
  getSteeringGuidance,
  getCardinalDirectionIndo,
} from '../data/ntbPriorityFindings';
import { GPSLocation, MetalFinding } from '../types/detector';
import {
  Compass,
  Navigation,
  Navigation2,
  X,
  Target,
  Radio,
  Sliders,
  Layers,
  MapPin,
  ExternalLink,
  Volume2,
  VolumeX,
  ShieldCheck,
  CheckCircle2,
  ArrowUp,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Mountain,
} from 'lucide-react';
import { SoilDepthIndicator } from './SoilDepthIndicator';
import { targetCenterAlarmService, TargetCenterAlarmState } from '../services/targetCenterAlarm';

interface GpsCompassModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetFinding: NTBPriorityFinding | null;
  onSelectFinding: (finding: NTBPriorityFinding) => void;
  userLocation: GPSLocation | null;
  onPinToUserFindings?: (finding: NTBPriorityFinding) => void;
  onNavigateToMap?: () => void;
}

export const GpsCompassModal: React.FC<GpsCompassModalProps> = ({
  isOpen,
  onClose,
  targetFinding: initialTarget,
  onSelectFinding,
  userLocation,
  onPinToUserFindings,
  onNavigateToMap,
}) => {
  const [activeTarget, setActiveTarget] = useState<NTBPriorityFinding>(() => {
    return initialTarget || NTB_PRIORITY_FINDINGS[0];
  });

  // Keep synced if initialTarget changes
  useEffect(() => {
    if (initialTarget) {
      setActiveTarget(initialTarget);
    }
  }, [initialTarget]);

  // Real device orientation heading or simulated heading
  const [deviceHeading, setDeviceHeading] = useState<number>(() => userLocation?.heading || 0);
  const [isSimulatingHeading, setIsSimulatingHeading] = useState<boolean>(false);
  const [simulatedHeading, setSimulatedHeading] = useState<number>(0);
  const [showSimControls, setShowSimControls] = useState<boolean>(false);
  const [isPinned, setIsPinned] = useState<boolean>(false);

  // Proximity alarm state
  const [alarmState, setAlarmState] = useState<TargetCenterAlarmState>(() =>
    targetCenterAlarmService.getState()
  );

  useEffect(() => {
    const unsub = targetCenterAlarmService.subscribe((st) => setAlarmState(st));
    return () => unsub();
  }, []);

  // Listen to device orientation (Compass Hardware)
  useEffect(() => {
    if (!isOpen) return;

    let hasOrientation = false;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      // webkitCompassHeading for iOS, alpha for Android
      let heading: number | null = null;
      if ('webkitCompassHeading' in e && typeof (e as { webkitCompassHeading?: number }).webkitCompassHeading === 'number') {
        heading = (e as { webkitCompassHeading: number }).webkitCompassHeading;
      } else if (e.alpha !== null) {
        heading = (360 - e.alpha) % 360;
      }

      if (heading !== null && !isNaN(heading)) {
        hasOrientation = true;
        if (!isSimulatingHeading) {
          setDeviceHeading(Math.round(heading));
        }
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute', handleOrientation as EventListener, true);
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
      if ('ondeviceorientationabsolute' in window) {
        window.removeEventListener('deviceorientationabsolute', handleOrientation as EventListener, true);
      }
    };
  }, [isOpen, isSimulatingHeading]);

  // Fallback to userLocation.heading if available
  useEffect(() => {
    if (userLocation?.heading != null && !isSimulatingHeading) {
      setDeviceHeading(Math.round(userLocation.heading));
    }
  }, [userLocation, isSimulatingHeading]);

  if (!isOpen) return null;

  // Use user location or default Lombok center coordinates if GPS not yet fixed
  const userLat = userLocation?.lat ?? -8.5833;
  const userLng = userLocation?.lng ?? 116.1167;

  // Calculate Distance & Bearing
  const distanceM = calculateDistanceMeters(userLat, userLng, activeTarget.lat, activeTarget.lng);
  const bearingDeg = calculateBearingDegrees(userLat, userLng, activeTarget.lat, activeTarget.lng);

  // Effective Heading
  const effectiveHeading = isSimulatingHeading ? simulatedHeading : deviceHeading;

  // Steering Guidance
  const steering = getSteeringGuidance(effectiveHeading, bearingDeg);

  // Relative Bearing to target (how many degrees to rotate compass needle)
  // Target Needle rotation angle relative to top of the screen: (bearing - heading)
  const needleAngle = (bearingDeg - effectiveHeading + 360) % 360;

  // Compass Rose Dial rotation: -effectiveHeading
  const dialRotation = -effectiveHeading;

  // Format distance
  const formattedDistance =
    distanceM >= 1000
      ? `${(distanceM / 1000).toFixed(2)} km`
      : `${Math.round(distanceM)} m`;

  const handleToggleAlarm = () => {
    targetCenterAlarmService.toggleAlarm(
      {
        id: activeTarget.id,
        name: activeTarget.name,
        category: activeTarget.category,
        lat: activeTarget.lat,
        lng: activeTarget.lng,
        depthEstimateCm: activeTarget.estimatedDepthCm,
      },
      userLat,
      userLng
    );
  };

  const handlePin = () => {
    onPinToUserFindings?.(activeTarget);
    setIsPinned(true);
    setTimeout(() => setIsPinned(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Compass className="w-5 h-5 animate-spin" style={{ animationDuration: '20s' }} />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base text-slate-100 flex items-center gap-2">
                <span>Kompas GPS Navigasi NTB</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase">
                  Prioritas
                </span>
              </h2>
              <p className="text-[11px] font-mono text-slate-400">
                Panduan Geospasial Sasaran Logam & Artefak Berharga Nusa Tenggara Barat
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Waypoint Target Selector Dropdown */}
          <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 uppercase text-[10px] flex items-center gap-1 font-semibold">
                <Target className="w-3.5 h-3.5 text-amber-400" />
                Pilih Sasaran Prioritas NTB:
              </span>
              <span className="text-[10px] text-cyan-400">
                {NTB_PRIORITY_FINDINGS.length} Titik Terdaftar
              </span>
            </div>

            <select
              value={activeTarget.id}
              onChange={(e) => {
                const found = NTB_PRIORITY_FINDINGS.find((item) => item.id === e.target.value);
                if (found) {
                  setActiveTarget(found);
                  onSelectFinding(found);
                }
              }}
              className="w-full bg-slate-900 border border-slate-700 hover:border-cyan-500/60 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 outline-none transition-all cursor-pointer font-medium"
            >
              {NTB_PRIORITY_FINDINGS.map((item) => (
                <option key={item.id} value={item.id} className="bg-slate-900 text-slate-100">
                  [{item.region}] {item.name} — {item.category.toUpperCase()} ({item.priority})
                </option>
              ))}
            </select>
          </div>

          {/* Steer Advice Directional Banner */}
          <div
            className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all duration-300 ${
              steering.isAligned
                ? 'bg-emerald-950/70 border-emerald-500/80 ring-2 ring-emerald-500/30'
                : steering.direction === 'RIGHT'
                ? 'bg-amber-950/50 border-amber-500/60'
                : steering.direction === 'LEFT'
                ? 'bg-cyan-950/50 border-cyan-500/60'
                : 'bg-rose-950/50 border-rose-500/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-lg border shrink-0 ${
                  steering.isAligned
                    ? 'bg-emerald-500 text-slate-950 border-emerald-300 animate-bounce'
                    : 'bg-slate-900 text-slate-100 border-slate-700'
                }`}
              >
                {steering.isAligned ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : steering.direction === 'RIGHT' ? (
                  <ArrowRight className="w-5 h-5 text-amber-400 animate-pulse" />
                ) : steering.direction === 'LEFT' ? (
                  <ArrowLeft className="w-5 h-5 text-cyan-400 animate-pulse" />
                ) : (
                  <RotateCcw className="w-5 h-5 text-rose-400" />
                )}
              </div>

              <div>
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                  Panduan Kemudi Arah:
                </div>
                <div
                  className={`text-sm sm:text-base font-bold font-mono ${
                    steering.isAligned ? 'text-emerald-300' : 'text-white'
                  }`}
                >
                  {steering.advice}
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                  Jarak: <strong className="text-white">{formattedDistance}</strong> • Arah Sasaran:{' '}
                  <strong className="text-amber-400">{bearingDeg}° {getCardinalDirectionIndo(bearingDeg)}</strong>
                </div>
              </div>
            </div>

            {/* Offline GPS Indicator */}
            <div className="hidden sm:flex flex-col items-end text-right text-[10px] font-mono text-emerald-400">
              <span className="flex items-center gap-1 font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                GPS FIX 3D
              </span>
              <span className="text-slate-500">100% OFFLINE</span>
            </div>
          </div>

          {/* MAIN TACTICAL COMPASS VISUALIZER */}
          <div className="relative bg-slate-950/90 border border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center shadow-inner overflow-hidden">
            {/* Ambient Circular Grid Lines */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
              <div className="w-64 h-64 border border-cyan-500 rounded-full" />
              <div className="w-48 h-48 border border-slate-600 rounded-full absolute" />
              <div className="w-32 h-32 border border-slate-600 rounded-full absolute" />
              <div className="w-full h-px bg-slate-700 absolute" />
              <div className="h-full w-px bg-slate-700 absolute" />
            </div>

            {/* Heading Indicator on top (Lubbers Line) */}
            <div className="relative z-10 mb-2 flex flex-col items-center">
              <div className="w-3 h-3 border-l-2 border-r-2 border-t-4 border-t-amber-400 border-l-transparent border-r-transparent mb-1" />
              <div className="px-3 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-amber-300">
                Heading: {effectiveHeading}° {getCardinalDirectionIndo(effectiveHeading)}
              </div>
            </div>

            {/* ROTATING COMPASS DIAL */}
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center select-none">
              {/* The Dial that rotates matching user heading */}
              <div
                className="w-full h-full rounded-full border-2 border-slate-700/80 bg-slate-900/60 shadow-2xl relative transition-transform duration-200 ease-out flex items-center justify-center"
                style={{
                  transform: `rotate(${dialRotation}deg)`,
                }}
              >
                {/* 360 Degree Tick Marks */}
                {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                  <div
                    key={deg}
                    className="absolute w-full h-full flex justify-center items-start pt-1.5"
                    style={{ transform: `rotate(${deg}deg)` }}
                  >
                    <div
                      className={`w-0.5 ${
                        deg % 90 === 0
                          ? 'h-3 bg-amber-400'
                          : 'h-2 bg-slate-500'
                      }`}
                    />
                  </div>
                ))}

                {/* Cardinal Points */}
                {/* UTARA / NORTH (Top on Dial) */}
                <div className="absolute top-4 text-xs font-bold font-mono text-red-500">
                  U
                </div>
                {/* TIMUR / EAST */}
                <div className="absolute right-4 text-xs font-bold font-mono text-slate-300">
                  T
                </div>
                {/* SELATAN / SOUTH */}
                <div className="absolute bottom-4 text-xs font-bold font-mono text-slate-300">
                  S
                </div>
                {/* BARAT / WEST */}
                <div className="absolute left-4 text-xs font-bold font-mono text-slate-300">
                  B
                </div>

                {/* Intercardinal Points */}
                <div
                  className="absolute w-full h-full flex justify-center items-start pt-4 text-[9px] font-mono text-slate-500"
                  style={{ transform: 'rotate(45deg)' }}
                >
                  <span>TL</span>
                </div>
                <div
                  className="absolute w-full h-full flex justify-center items-start pt-4 text-[9px] font-mono text-slate-500"
                  style={{ transform: 'rotate(135deg)' }}
                >
                  <span>TG</span>
                </div>
                <div
                  className="absolute w-full h-full flex justify-center items-start pt-4 text-[9px] font-mono text-slate-500"
                  style={{ transform: 'rotate(225deg)' }}
                >
                  <span>BD</span>
                </div>
                <div
                  className="absolute w-full h-full flex justify-center items-start pt-4 text-[9px] font-mono text-slate-500"
                  style={{ transform: 'rotate(315deg)' }}
                >
                  <span>BL</span>
                </div>

                {/* Magnetic North Pointer inside the dial */}
                <div className="absolute w-1 h-20 bg-gradient-to-t from-transparent to-red-500 -top-0 rounded-full opacity-80" />
              </div>

              {/* TARGET BEARING NEEDLE (Independent vector pointing to target) */}
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-200 ease-out z-20"
                style={{
                  transform: `rotate(${needleAngle}deg)`,
                }}
              >
                {/* Pointer Arrow to Target */}
                <div className="relative flex flex-col items-center h-full justify-between py-2">
                  {/* Arrow Head Pointing to Target */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[24px] ${
                        steering.isAligned
                          ? 'border-b-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.9)] animate-pulse'
                          : 'border-b-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.7)]'
                      }`}
                    />
                    <div
                      className={`px-1.5 py-0.5 -mt-1 rounded text-[9px] font-bold font-mono shadow-md ${
                        steering.isAligned
                          ? 'bg-emerald-400 text-slate-950'
                          : 'bg-cyan-500 text-slate-950'
                      }`}
                    >
                      SASARAN
                    </div>
                  </div>

                  {/* Tail of needle */}
                  <div className="w-1.5 h-8 bg-slate-600 rounded-full opacity-50" />
                </div>
              </div>

              {/* Center Pivot Hub */}
              <div className="absolute z-30 w-16 h-16 rounded-full bg-slate-950 border-2 border-slate-700 flex flex-col items-center justify-center shadow-xl">
                <span className="text-[10px] font-mono font-bold text-amber-400">
                  {bearingDeg}°
                </span>
                <span className="text-[8px] font-mono text-slate-400">TARGET</span>
              </div>
            </div>

            {/* Bottom Compass Readout Bar */}
            <div className="mt-4 flex items-center justify-between w-full max-w-sm px-4 py-2 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-mono">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase">Jarak Lurus</span>
                <span className="text-base font-bold text-white">{formattedDistance}</span>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div className="flex flex-col text-center">
                <span className="text-[10px] text-slate-500 uppercase">Deviasi Arah</span>
                <span
                  className={`text-sm font-bold ${
                    steering.isAligned ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {steering.deltaAngle}° {steering.direction === 'AHEAD' ? 'PAS' : steering.direction}
                </span>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-slate-500 uppercase">Elevasi</span>
                <span className="text-xs font-bold text-cyan-400">
                  {activeTarget.elevationMeters} mdpl
                </span>
              </div>
            </div>
          </div>

          {/* Target Artifact Tactical Information Card */}
          <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2 border-b border-slate-850 pb-2.5">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-sm text-slate-100">{activeTarget.name}</h3>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                    {activeTarget.priority}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span>{activeTarget.locationName}</span>
                </p>
              </div>

              {/* Depth Indicator component */}
              <div className="shrink-0">
                <SoilDepthIndicator
                  depthCm={activeTarget.estimatedDepthCm}
                  itemName={activeTarget.name}
                  category={activeTarget.category}
                />
              </div>
            </div>

            <div className="text-xs font-mono text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed">
              <span className="text-amber-400 font-semibold block mb-0.5">📜 Konteks Sejarah & Geologi:</span>
              <p className="text-[11px] text-slate-400">{activeTarget.historicalContext}</p>
            </div>

            <div className="text-xs font-mono text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed">
              <span className="text-cyan-400 font-semibold block mb-0.5">🎯 Saran Taktis Ekskavasi:</span>
              <p className="text-[11px] text-slate-400">{activeTarget.tacticalAdvice}</p>
            </div>

            {/* Coordinates and Age metadata */}
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block">Koordinat Target NTB:</span>
                <span className="text-slate-200 font-bold">
                  {activeTarget.lat.toFixed(5)}, {activeTarget.lng.toFixed(5)}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block">Estimasi Era / Usia:</span>
                <span className="text-slate-200 font-bold">{activeTarget.estimatedAge}</span>
              </div>
            </div>
          </div>

          {/* ACTIONS BAR */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {/* Proximity Alarm Button */}
            <button
              type="button"
              onClick={handleToggleAlarm}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-mono font-bold transition-all shadow-md active:scale-95 ${
                alarmState.isActive && alarmState.targetId === activeTarget.id
                  ? 'bg-rose-500/25 text-rose-300 border-rose-500/70 ring-1 ring-rose-500/40 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>
                {alarmState.isActive && alarmState.targetId === activeTarget.id
                  ? 'Alarm Pusat: ONLINE'
                  : 'Aktifkan Alarm Pusat'}
              </span>
            </button>

            {/* Pin to User Findings */}
            {onPinToUserFindings && (
              <button
                type="button"
                onClick={handlePin}
                className="flex items-center gap-1.5 py-2.5 px-3 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-semibold transition-all active:scale-95"
                title="Tambahkan titik sasaran NTB ini ke daftar temuan pribadi"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>{isPinned ? 'Tersimpan!' : 'Pin ke Koleksi'}</span>
              </button>
            )}

            {/* Google Maps Route */}
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${activeTarget.lat},${activeTarget.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 text-xs font-mono font-semibold transition-all"
              title="Buka rute navigasi jalan di Google Maps"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Google Maps</span>
            </a>

            {/* Simulator heading toggle for testing */}
            <button
              type="button"
              onClick={() => setShowSimControls(!showSimControls)}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-400 border border-slate-700 transition-all"
              title="Uji putar kompas secara manual (Testing Console)"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>

          {/* Heading Simulator Panel for Desktop/Laptop Testing */}
          {showSimControls && (
            <div className="bg-slate-950 p-3 rounded-xl border border-purple-500/40 flex flex-col gap-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs font-mono text-purple-300">
                <span className="flex items-center gap-1.5 font-bold">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Simulator Putar Kompas (Desktop Testing Console):</span>
                </span>
                <span className="text-white font-bold">{effectiveHeading}°</span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="359"
                  value={effectiveHeading}
                  onChange={(e) => {
                    setIsSimulatingHeading(true);
                    setSimulatedHeading(parseInt(e.target.value, 10));
                  }}
                  className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <div className="flex items-center gap-1">
                  <span>Preset Cepat:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSimulatingHeading(true);
                      setSimulatedHeading(bearingDeg);
                    }}
                    className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold"
                  >
                    Tepat ke Sasaran ({bearingDeg}°)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSimulatingHeading(true);
                      setSimulatedHeading((bearingDeg + 90) % 360);
                    }}
                    className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                  >
                    +90°
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSimulatingHeading(false)}
                  className="text-cyan-400 underline font-semibold"
                >
                  Gunakan Sensor Asli
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400 text-[10px]">
            Titik Sasaran Aktif: <strong className="text-white">{activeTarget.name}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold transition-all shadow-md active:scale-95"
          >
            Tutup Kompas
          </button>
        </div>
      </div>
    </div>
  );
};
