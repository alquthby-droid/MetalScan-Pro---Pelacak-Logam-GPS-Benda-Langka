import React from 'react';
import { GeofenceState, GeofenceTarget } from '../types/detector';
import {
  Compass,
  MapPin,
  Volume2,
  VolumeX,
  X,
  Target,
  Radio,
  LocateFixed,
  Flame,
  ArrowUp,
  AlertTriangle,
} from 'lucide-react';

interface GeofenceAlertBannerProps {
  geofenceState: GeofenceState;
  onDismiss: () => void;
  onNavigateToMap?: (target: GeofenceTarget) => void;
  onActivateTargetAlarm?: (target: GeofenceTarget) => void;
  onOpenCompass?: (target: GeofenceTarget) => void;
  onToggleMute?: () => void;
}

function getCompassDirection(deg: number): string {
  const directions = ['U', 'TL', 'T', 'TG', 'S', 'BD', 'B', 'BL'];
  const index = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return directions[index];
}

export const GeofenceAlertBanner: React.FC<GeofenceAlertBannerProps> = ({
  geofenceState,
  onDismiss,
  onNavigateToMap,
  onActivateTargetAlarm,
  onOpenCompass,
  onToggleMute,
}) => {
  const target = geofenceState.currentTargetInside;
  if (!target) return null;

  const distance = Math.max(0, geofenceState.currentDistanceMeters ?? 0);
  const bearing = Math.round(geofenceState.currentBearingDegrees ?? 0);
  const maxRadius = target.radiusMeters || 5.0;

  // Closeness percentage from 0% (at maxRadius e.g. 5m) to 100% (at 0m target center)
  const proximityPercent = Math.max(
    0,
    Math.min(100, Math.round(((maxRadius - distance) / maxRadius) * 100))
  );

  // Proximity Urgency Tier
  const isExtremeClose = distance <= 1.5; // < 1.5m: right below search coil
  const isVeryClose = distance <= 3.0; // 1.5m - 3.0m: fast approach
  const isInPerimeter = distance <= maxRadius; // 3.0m - 5.0m: in perimeter

  const urgencyColor = isExtremeClose
    ? '#ef4444' // red-500
    : isVeryClose
    ? '#f97316' // orange-500
    : '#f59e0b'; // amber-500

  const cardinalDir = getCompassDirection(bearing);

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[800] w-[95%] max-w-lg pointer-events-auto animate-in slide-in-from-top-4 duration-300">
      {/* Animated Breathe / Pulse Card Container */}
      <div
        className={`relative bg-slate-950/95 backdrop-blur-2xl rounded-3xl p-3.5 shadow-2xl text-slate-100 flex flex-col gap-2.5 transition-all duration-300 ${
          isExtremeClose
            ? 'geofence-banner-rapid-pulse border-2 border-red-500 shadow-red-950/80'
            : isVeryClose
            ? 'geofence-banner-breathe-intense border-2 border-orange-500 shadow-orange-950/70'
            : 'geofence-banner-breathe border-2 border-amber-500/80 shadow-amber-950/60'
        }`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center shrink-0">
              <div
                className={`w-9 h-9 rounded-2xl border flex items-center justify-center transition-colors ${
                  isExtremeClose
                    ? 'bg-red-500/20 border-red-400 text-red-300'
                    : isVeryClose
                    ? 'bg-orange-500/20 border-orange-400 text-orange-300'
                    : 'bg-amber-500/20 border-amber-400 text-amber-300'
                }`}
              >
                {isExtremeClose ? (
                  <Flame className="w-5 h-5 text-red-400 animate-bounce" />
                ) : (
                  <Radio className="w-4 h-4 animate-spin-slow" />
                )}
              </div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ backgroundColor: urgencyColor }}
                ></span>
                <span
                  className="relative inline-flex rounded-full h-3 w-3"
                  style={{ backgroundColor: urgencyColor }}
                ></span>
              </span>
            </div>

            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md font-mono border ${
                    isExtremeClose
                      ? 'bg-red-500/30 text-red-300 border-red-400/60 animate-pulse'
                      : isVeryClose
                      ? 'bg-orange-500/30 text-orange-300 border-orange-400/50'
                      : 'bg-amber-500/30 text-amber-300 border-amber-400/50'
                  }`}
                >
                  {isExtremeClose
                    ? '🚨 TARGET DI DEKAT KOIL (<1.5M)'
                    : isVeryClose
                    ? '🔥 ZONA GEOFENCE SANGAT DEKAT'
                    : '🎯 GEOFENCE 5M TERDETEKSI'}
                </span>
                <span className="text-[9px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  LOKASI REAL-TIME
                </span>
              </div>
              <h3 className="text-sm font-black text-white font-mono truncate max-w-[230px] sm:max-w-xs mt-0.5 flex items-center gap-1.5">
                <span>{target.name}</span>
                {target.category === 'gold' && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40">
                    EMAS
                  </span>
                )}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onToggleMute && (
              <button
                type="button"
                onClick={onToggleMute}
                className="p-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                title={geofenceState.isAudioMuted ? 'Buka Suara' : 'Bungkam Suara'}
              >
                {geofenceState.isAudioMuted ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-amber-400" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="p-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Tutup Peringatan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* HERO: Indikator Jarak ke Target Terdekat Real-Time */}
        <div
          className={`p-3 rounded-2xl border font-mono transition-all duration-300 ${
            isExtremeClose
              ? 'bg-gradient-to-r from-red-950/70 via-slate-900/90 to-red-950/60 border-red-500/60'
              : isVeryClose
              ? 'bg-gradient-to-r from-orange-950/60 via-slate-900/90 to-amber-950/50 border-orange-500/50'
              : 'bg-slate-900/90 border-slate-800'
          }`}
        >
          {/* Top Title & Distance Readout */}
          <div className="flex items-end justify-between gap-2 mb-2">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                <LocateFixed
                  className={`w-3.5 h-3.5 ${
                    isExtremeClose
                      ? 'text-red-400 animate-spin-slow'
                      : isVeryClose
                      ? 'text-orange-400 animate-pulse'
                      : 'text-amber-400'
                  }`}
                />
                <span>Jarak ke Target Terdekat</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {isExtremeClose ? (
                  <span className="text-red-300 font-bold flex items-center gap-1">
                    <span>⚡ Posisi Di Bawah Titik Sensor</span>
                  </span>
                ) : isVeryClose ? (
                  <span className="text-orange-300 font-medium">Langkah perlahan mendekat</span>
                ) : (
                  <span className="text-amber-300/90 font-medium">Dalam radius pantau 5 meter</span>
                )}
              </div>
            </div>

            {/* Giant Live Distance Metric */}
            <div className="text-right">
              <div className="flex items-baseline justify-end gap-1">
                <span
                  className={`text-2xl sm:text-3xl font-black tracking-tight ${
                    isExtremeClose
                      ? 'text-red-400 drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]'
                      : isVeryClose
                      ? 'text-orange-400 drop-shadow-[0_0_10px_rgba(249,115,22,0.7)]'
                      : 'text-amber-400'
                  }`}
                >
                  {distance.toFixed(1)}
                </span>
                <span className="text-xs font-bold text-slate-300">meter</span>
              </div>
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                {proximityPercent}% Kedekatan
              </div>
            </div>
          </div>

          {/* Proximity Gauge Progress Bar */}
          <div className="space-y-1">
            <div className="relative w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isExtremeClose
                    ? 'bg-gradient-to-r from-orange-500 via-red-500 to-rose-400 shadow-[0_0_8px_rgba(239,68,68,0.9)]'
                    : isVeryClose
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]'
                    : 'bg-gradient-to-r from-emerald-500 via-cyan-400 to-amber-400'
                }`}
                style={{ width: `${Math.max(8, proximityPercent)}%` }}
              />
            </div>
            {/* Range markers */}
            <div className="flex items-center justify-between text-[8px] text-slate-500 font-mono px-0.5">
              <span>{maxRadius}m (Batas)</span>
              <span>2.5m</span>
              <span>1.0m</span>
              <span className={isExtremeClose ? 'text-red-400 font-bold' : 'text-slate-400'}>
                0m (Target)
              </span>
            </div>
          </div>
        </div>

        {/* Live Proximity Metric Grid: Bearing & Depth */}
        <div className="grid grid-cols-2 gap-2 bg-slate-900/80 p-2 rounded-2xl border border-slate-800 font-mono">
          <div className="bg-slate-950/60 p-2 rounded-xl flex items-center justify-between">
            <div className="text-left">
              <span className="text-[9px] text-slate-400 uppercase block">Arah Kompas</span>
              <div className="text-xs font-black text-cyan-400 flex items-center gap-1 mt-0.5">
                <span>{cardinalDir}</span>
                <span className="text-slate-400 font-normal">({bearing}°)</span>
              </div>
            </div>
            <div
              className="w-7 h-7 rounded-lg bg-cyan-950/70 border border-cyan-800/60 flex items-center justify-center text-cyan-300"
              style={{ transform: `rotate(${bearing}deg)` }}
              title={`Arah kompas target: ${bearing}°`}
            >
              <ArrowUp className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-slate-950/60 p-2 rounded-xl text-left">
            <span className="text-[9px] text-slate-400 uppercase block">Estimasi Kedalaman</span>
            <div className="text-xs font-black text-emerald-400 mt-0.5">
              ~{target.depthEstimateCm ?? 15} cm
            </div>
          </div>
        </div>

        {/* Tactical Action Buttons */}
        <div className="grid grid-cols-3 gap-1.5 font-mono">
          {onNavigateToMap && (
            <button
              type="button"
              onClick={() => onNavigateToMap(target)}
              className="flex items-center justify-center gap-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[11px] font-medium transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <span>Di Peta</span>
            </button>
          )}

          {onOpenCompass && (
            <button
              type="button"
              onClick={() => onOpenCompass(target)}
              className="flex items-center justify-center gap-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[11px] font-medium transition-colors"
            >
              <Compass className="w-3.5 h-3.5 text-emerald-400" />
              <span>Kompas</span>
            </button>
          )}

          {onActivateTargetAlarm && (
            <button
              type="button"
              onClick={() => onActivateTargetAlarm(target)}
              className={`flex items-center justify-center gap-1 py-1.5 px-2 font-bold rounded-xl text-[11px] shadow-sm transition-all ${
                isExtremeClose
                  ? 'bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white animate-pulse'
                  : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Pinpointer</span>
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Breathe and Pulse Keyframes */}
      <style>{`
        @keyframes geofence-breathe-subtle {
          0% {
            transform: scale(1);
            box-shadow: 0 0 16px rgba(245, 158, 11, 0.35), 0 12px 30px rgba(0, 0, 0, 0.8);
            border-color: rgba(245, 158, 11, 0.7);
          }
          50% {
            transform: scale(1.015);
            box-shadow: 0 0 32px rgba(245, 158, 11, 0.75), 0 0 16px rgba(251, 191, 36, 0.6), 0 14px 34px rgba(0, 0, 0, 0.9);
            border-color: rgba(251, 191, 36, 0.95);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 16px rgba(245, 158, 11, 0.35), 0 12px 30px rgba(0, 0, 0, 0.8);
            border-color: rgba(245, 158, 11, 0.7);
          }
        }

        @keyframes geofence-breathe-intense {
          0% {
            transform: scale(1);
            box-shadow: 0 0 20px rgba(249, 115, 22, 0.45), 0 14px 32px rgba(0, 0, 0, 0.85);
            border-color: rgba(249, 115, 22, 0.8);
          }
          50% {
            transform: scale(1.022);
            box-shadow: 0 0 42px rgba(249, 115, 22, 0.85), 0 0 22px rgba(245, 158, 11, 0.7), 0 16px 38px rgba(0, 0, 0, 0.95);
            border-color: rgba(253, 186, 116, 1);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 20px rgba(249, 115, 22, 0.45), 0 14px 32px rgba(0, 0, 0, 0.85);
            border-color: rgba(249, 115, 22, 0.8);
          }
        }

        @keyframes geofence-rapid-pulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 24px rgba(239, 68, 68, 0.55), 0 14px 32px rgba(0, 0, 0, 0.9);
            border-color: rgba(239, 68, 68, 0.85);
          }
          50% {
            transform: scale(1.028);
            box-shadow: 0 0 52px rgba(239, 68, 68, 0.95), 0 0 28px rgba(249, 115, 22, 0.8), 0 18px 42px rgba(0, 0, 0, 0.95);
            border-color: rgba(254, 202, 202, 1);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 24px rgba(239, 68, 68, 0.55), 0 14px 32px rgba(0, 0, 0, 0.9);
            border-color: rgba(239, 68, 68, 0.85);
          }
        }

        .geofence-banner-breathe {
          animation: geofence-breathe-subtle 2.2s infinite ease-in-out;
        }

        .geofence-banner-breathe-intense {
          animation: geofence-breathe-intense 1.5s infinite ease-in-out;
        }

        .geofence-banner-rapid-pulse {
          animation: geofence-rapid-pulse 0.95s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

