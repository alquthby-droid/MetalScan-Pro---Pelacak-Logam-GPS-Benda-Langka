import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MetalFinding, GPSLocation } from '../types/detector';
import {
  Camera,
  CameraOff,
  Compass,
  Crosshair,
  Maximize2,
  Minimize2,
  Navigation,
  Sparkles,
  Layers,
  Info,
  RefreshCw,
} from 'lucide-react';

interface ARMetalFinderProps {
  findings: MetalFinding[];
  userLocation: GPSLocation | null;
  currentMagneticStrength: number;
}

interface ARTarget {
  id: string;
  name: string;
  category: string;
  strength: number;
  depth: number;
  distanceMeters: number;
  bearingDeg: number;
  screenX: number; // percentage 0-100%
  screenY: number; // percentage 0-100%
  isVisibleInFOV: boolean;
  color: string;
  symbol: string;
}

// Haversine formula to compute distance in meters between 2 coordinates
function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Calculate compass bearing from point A to point B in degrees (0 - 360)
function calculateBearingDegrees(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);

  const bearing = ((theta * 180) / Math.PI + 360) % 360;
  return bearing;
}

export const ARMetalFinder: React.FC<ARMetalFinderProps> = ({
  findings,
  userLocation,
  currentMagneticStrength,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [deviceHeading, setDeviceHeading] = useState<number>(0);
  const [devicePitch, setDevicePitch] = useState<number>(0); // tilt up/down
  const [deviceRoll, setDeviceRoll] = useState<number>(0);
  const [hasOrientationSensor, setHasOrientationSensor] = useState<boolean>(false);
  const [filterRadiusMeters, setFilterRadiusMeters] = useState<number>(100);
  const [selectedTarget, setSelectedTarget] = useState<ARTarget | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Start Real Device Camera feed
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('WebRTC / Kamera tidak didukung pada browser ini');
      }

      // Prefer rear environment camera for Augmented Reality
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setIsCameraActive(true);
    } catch (err: unknown) {
      const msg =
        err instanceof Error && (err.name === 'NotAllowedError' || err.message.includes('Permission'))
          ? 'Izin kamera belum aktif. Berikan izin kamera di browser untuk menampilkan target di layar AR.'
          : err instanceof Error
          ? err.message
          : 'Izin kamera ditolak atau kamera tidak tersedia.';
      setCameraError(msg);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Device Orientation Handler (Compass heading & horizon tilt)
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      // iOS webkitCompassHeading vs standard alpha
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const webkitCompass = (e as any).webkitCompassHeading;
      let heading = 0;

      if (typeof webkitCompass === 'number' && !isNaN(webkitCompass)) {
        heading = webkitCompass;
      } else if (e.alpha !== null) {
        // Approximate standard heading (alpha goes counter-clockwise 0-360)
        heading = (360 - e.alpha) % 360;
      }

      const beta = e.beta || 0; // Pitch: [-180, 180] (holding upright is ~90 deg)
      const gamma = e.gamma || 0; // Roll: [-90, 90]

      setDeviceHeading(heading);
      setDevicePitch(beta);
      setDeviceRoll(gamma);
      setHasOrientationSensor(true);
    };

    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleOrientation);
    }

    return () => {
      if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
        window.removeEventListener('deviceorientation', handleOrientation);
      }
    };
  }, []);

  // Use GPS heading fallback if available
  useEffect(() => {
    if (userLocation?.heading !== null && userLocation?.heading !== undefined && !hasOrientationSensor) {
      setDeviceHeading(userLocation.heading);
    }
  }, [userLocation, hasOrientationSensor]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Compute AR Screen Targets based on GPS coordinates and device orientation
  // Horizontal Camera FOV is roughly 65 degrees
  const HORIZONTAL_FOV = 65;
  const VERTICAL_FOV = 50;

  const arTargets: ARTarget[] = useMemo(() => {
    // Reference user position (fallback to first finding or standard coord if GPS not ready)
    const userLat = userLocation?.lat ?? (findings[0]?.lat || -6.2088);
    const userLng = userLocation?.lng ?? (findings[0]?.lng || 106.8456);

    return findings
      .map((item) => {
        const distance = calculateDistanceMeters(userLat, userLng, item.lat, item.lng);
        const bearing = calculateBearingDegrees(userLat, userLng, item.lat, item.lng);

        // Angle difference relative to device heading (-180 to +180)
        let deltaHeading = bearing - deviceHeading;
        while (deltaHeading > 180) deltaHeading -= 360;
        while (deltaHeading < -180) deltaHeading += 360;

        // Check if item is inside current camera Horizontal Field of View
        const halfFovX = HORIZONTAL_FOV / 2;
        const isVisibleInFOV = Math.abs(deltaHeading) <= halfFovX;

        // Map deltaHeading (-halfFovX ... +halfFovX) to percentage (0% ... 100%)
        const screenX = 50 + (deltaHeading / halfFovX) * 45;

        // Pitch elevation calculation:
        // When user tilts phone up/down, items on the ground appear higher or lower
        // Normalized holding pitch is ~65-80 degrees
        const basePitch = 70;
        const deltaPitch = (devicePitch - basePitch) * 0.6;
        // Distant items sit closer to horizon, nearby items sit lower
        const distanceOffsetY = Math.min(25, Math.max(-25, Math.log10(Math.max(1, distance)) * 12));
        const screenY = Math.min(88, Math.max(12, 52 + deltaPitch - distanceOffsetY));

        // Colors & symbols
        let color = '#94a3b8';
        let symbol = '⛏';
        if (item.category === 'gold') {
          color = '#eab308';
          symbol = '★';
        } else if (item.category === 'meteorite') {
          color = '#c084fc';
          symbol = '☄';
        } else if (item.category === 'silver') {
          color = '#38bdf8';
          symbol = '◈';
        } else if (item.category === 'bronze') {
          color = '#f97316';
          symbol = '⬢';
        }

        return {
          id: item.id,
          name: item.name,
          category: item.category,
          strength: item.magneticStrength,
          depth: item.depthEstimateCm,
          distanceMeters: Math.round(distance),
          bearingDeg: Math.round(bearing),
          screenX: Math.max(5, Math.min(95, screenX)),
          screenY,
          isVisibleInFOV,
          color,
          symbol,
        };
      })
      .filter((t) => t.distanceMeters <= filterRadiusMeters)
      .sort((a, b) => b.distanceMeters - a.distanceMeters); // render farthest first
  }, [findings, userLocation, deviceHeading, devicePitch, filterRadiusMeters]);

  // Cardinal direction label for heading
  const getCardinalDirection = (deg: number) => {
    const dirs = ['U (0°)', 'TL (45°)', 'T (90°)', 'TG (135°)', 'S (180°)', 'BD (225°)', 'B (270°)', 'BL (315°)'];
    const idx = Math.round(deg / 45) % 8;
    return dirs[idx];
  };

  return (
    <div
      className={`relative w-full rounded-3xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950 transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen' : 'h-[440px] md:h-[500px]'
      } flex flex-col`}
    >
      {/* 1. Camera Video Element / AR Backdrop */}
      {isCameraActive ? (
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className="absolute inset-0 w-full h-full object-cover z-0"
        />
      ) : (
        <div className="absolute inset-0 w-full h-full z-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 flex flex-col items-center justify-center p-6 text-center">
          {/* Tactical Simulated HUD Grid when Camera is off */}
          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
          <div className="relative z-10 max-w-sm flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-950/50">
              <Camera className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 font-mono">
                Augmented Reality (AR) Lapangan
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Aktifkan kamera ponsel untuk melihat posisi target logam diproyeksikan secara virtual di dunia nyata sesuai arah kompas & GPS Anda.
              </p>
            </div>

            {cameraError && (
              <div className="text-[11px] font-mono text-rose-400 bg-rose-950/40 border border-rose-800/60 p-2.5 rounded-xl">
                {cameraError}
              </div>
            )}

            <button
              type="button"
              onClick={startCamera}
              className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs font-mono shadow-lg shadow-cyan-900/40 active:scale-95 transition-all"
            >
              <Camera className="w-4 h-4" />
              <span>Buka Kamera AR</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Tactical AR HUD Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-4">
        {/* Top AR Bar */}
        <div className="flex items-center justify-between gap-2 pointer-events-auto">
          {/* Compass Heading & Horizon Info */}
          <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-700/80 shadow-xl font-mono text-xs text-slate-200">
            <Compass className="w-4 h-4 text-cyan-400 animate-spin-slow" />
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-cyan-300">{Math.round(deviceHeading)}°</span>
              <span className="text-[10px] text-slate-400">{getCardinalDirection(deviceHeading)}</span>
            </div>
          </div>

          {/* Quick AR Controls */}
          <div className="flex items-center gap-2">
            {/* Filter Radius Slider Selector */}
            <div className="bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-2xl border border-slate-700/80 shadow-xl font-mono text-[11px] text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>≤{filterRadiusMeters}m</span>
              <select
                value={filterRadiusMeters}
                onChange={(e) => setFilterRadiusMeters(Number(e.target.value))}
                className="bg-transparent text-cyan-400 outline-none cursor-pointer"
              >
                <option value={25} className="bg-slate-900 text-slate-200">25m</option>
                <option value={50} className="bg-slate-900 text-slate-200">50m</option>
                <option value={100} className="bg-slate-900 text-slate-200">100m</option>
                <option value={500} className="bg-slate-900 text-slate-200">500m</option>
                <option value={2000} className="bg-slate-900 text-slate-200">2km</option>
              </select>
            </div>

            {/* Camera Toggle */}
            {isCameraActive ? (
              <button
                type="button"
                onClick={stopCamera}
                className="p-2 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-rose-400 hover:text-white shadow-lg active:scale-95 transition-all"
                title="Matikan Kamera"
              >
                <CameraOff className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={startCamera}
                className="p-2 rounded-2xl bg-cyan-600/90 backdrop-blur-md border border-cyan-400 text-white shadow-lg active:scale-95 transition-all"
                title="Hidupkan Kamera AR"
              >
                <Camera className="w-4 h-4" />
              </button>
            )}

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-slate-300 hover:text-white shadow-lg active:scale-95 transition-all"
              title={isFullscreen ? 'Keluar Layar Penuh' : 'Mode AR Layar Penuh'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Center Reticle / Tactical Target Boresight */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none opacity-40">
          <div className="w-16 h-16 rounded-full border border-cyan-400/60 border-dashed animate-spin-slow flex items-center justify-center" />
          <Crosshair className="absolute w-8 h-8 text-cyan-400" />
        </div>

        {/* Compass Horizon Ribbon at top */}
        <div className="absolute top-14 left-1/2 -translate-x-1/2 pointer-events-none flex items-center gap-4 text-[10px] font-mono text-cyan-300/80 bg-slate-950/60 backdrop-blur-md px-4 py-0.5 rounded-full border border-cyan-500/20">
          <span>{((deviceHeading - 30 + 360) % 360).toFixed(0)}°</span>
          <span className="w-1 h-1 rounded-full bg-cyan-400" />
          <span className="font-bold text-cyan-200">{Math.round(deviceHeading)}°</span>
          <span className="w-1 h-1 rounded-full bg-cyan-400" />
          <span>{((deviceHeading + 30) % 360).toFixed(0)}°</span>
        </div>

        {/* 3. 3D AR Spatial Floating Markers */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {arTargets.map((target) => {
            const isSelected = selectedTarget?.id === target.id;

            // When target is in FOV, position directly at screenX/screenY
            // When target is outside FOV, show edge guidance arrow
            if (!target.isVisibleInFOV) {
              // Edge indicator arrow
              const isToTheRight = ((target.bearingDeg - deviceHeading + 360) % 360) < 180;
              return (
                <div
                  key={target.id}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    [isToTheRight ? 'right' : 'left']: '12px',
                    transform: 'translateY(-50%)',
                    borderColor: target.color,
                  }}
                  className="pointer-events-auto flex items-center gap-1 bg-slate-900/90 backdrop-blur-md px-2 py-1 rounded-xl border text-[10px] font-mono shadow-xl animate-pulse cursor-pointer"
                  onClick={() => setSelectedTarget(target)}
                >
                  <span style={{ color: target.color }}>{target.symbol}</span>
                  <span className="text-slate-200 font-bold">{target.distanceMeters}m</span>
                  <span className="text-cyan-400">{isToTheRight ? '▶' : '◀'}</span>
                </div>
              );
            }

            // Target is in Field of View: render interactive 3D billboard pin
            return (
              <div
                key={target.id}
                style={{
                  position: 'absolute',
                  left: `${target.screenX}%`,
                  top: `${target.screenY}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className="pointer-events-auto flex flex-col items-center cursor-pointer transition-transform duration-100 hover:scale-110 active:scale-95 group"
                onClick={() => setSelectedTarget(target)}
              >
                {/* Floating AR Target Card */}
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-2xl backdrop-blur-md border shadow-2xl transition-all ${
                    isSelected
                      ? 'bg-slate-900/95 border-amber-400 ring-2 ring-amber-400/50 scale-105'
                      : 'bg-slate-950/85 border-slate-700/80 hover:border-slate-500'
                  }`}
                  style={{ borderColor: isSelected ? '#facc15' : target.color }}
                >
                  {/* Glowing Symbol Orb */}
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shadow-md"
                    style={{
                      backgroundColor: target.color,
                      color: '#000000',
                      boxShadow: `0 0 12px ${target.color}88`,
                    }}
                  >
                    {target.symbol}
                  </div>

                  <div className="flex flex-col font-mono text-left">
                    <span className="text-[11px] font-bold text-slate-100 flex items-center gap-1">
                      <span>{target.name}</span>
                      <span className="text-[9px] px-1 rounded bg-slate-800 text-amber-300">
                        {target.strength.toFixed(0)}µT
                      </span>
                    </span>
                    <span className="text-[9px] text-cyan-300 flex items-center gap-1">
                      <Navigation className="w-2.5 h-2.5" />
                      <span>{target.distanceMeters}m ({target.bearingDeg}°)</span>
                      <span>• ~{target.depth}cm</span>
                    </span>
                  </div>
                </div>

                {/* Laser Boresight Pointer Stick to ground */}
                <div
                  className="w-0.5 h-7 shadow-lg"
                  style={{
                    backgroundColor: target.color,
                    boxShadow: `0 0 8px ${target.color}`,
                  }}
                />
                <div
                  className="w-2 h-2 rounded-full border border-white"
                  style={{ backgroundColor: target.color }}
                />
              </div>
            );
          })}
        </div>

        {/* Selected Target Full Inspector Drawer Modal (Inside AR View) */}
        {selectedTarget && (
          <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-3 shadow-2xl font-mono text-xs text-slate-200 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom duration-200">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-base border"
                style={{
                  backgroundColor: `${selectedTarget.color}25`,
                  color: selectedTarget.color,
                  borderColor: selectedTarget.color,
                }}
              >
                {selectedTarget.symbol}
              </div>
              <div>
                <h4 className="font-bold text-slate-100 flex items-center gap-2">
                  <span>{selectedTarget.name}</span>
                  <span className="text-[10px] text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded-full border border-amber-500/40">
                    {selectedTarget.strength} µT
                  </span>
                </h4>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                  <span>Jarak Real: {selectedTarget.distanceMeters} Meter</span>
                  <span>•</span>
                  <span>Arah: {selectedTarget.bearingDeg}° ({getCardinalDirection(selectedTarget.bearingDeg)})</span>
                  <span>•</span>
                  <span>Kedalaman: ~{selectedTarget.depth} cm</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedTarget(null)}
              className="text-slate-400 hover:text-white px-2 py-1 text-sm bg-slate-800 rounded-lg"
            >
              ✕
            </button>
          </div>
        )}

        {/* Bottom AR Real-Time Status Strip */}
        <div className="flex items-center justify-between pointer-events-auto gap-2">
          {/* Current Live Sensor reading pill */}
          <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1 rounded-2xl border border-slate-700/80 shadow-xl font-mono text-[11px] text-slate-300 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Medan Magnet:</span>
            <strong className="text-amber-400">{currentMagneticStrength.toFixed(1)} µT</strong>
          </div>

          {/* AR Target Count in view */}
          <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1 rounded-2xl border border-slate-700/80 shadow-xl font-mono text-[11px] text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
            <span>
              {arTargets.filter((t) => t.isVisibleInFOV).length} / {arTargets.length} Dalam Bidik Kamera
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
