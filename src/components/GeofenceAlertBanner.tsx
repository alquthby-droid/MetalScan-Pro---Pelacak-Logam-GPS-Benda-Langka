import React from 'react';
import { GeofenceState, GeofenceTarget } from '../types/detector';
import {
  Bell,
  BellOff,
  Navigation,
  Compass,
  MapPin,
  Volume2,
  VolumeX,
  X,
  Target,
  Sparkles,
  Radio,
  ArrowRight,
} from 'lucide-react';

interface GeofenceAlertBannerProps {
  geofenceState: GeofenceState;
  onDismiss: () => void;
  onNavigateToMap?: (target: GeofenceTarget) => void;
  onActivateTargetAlarm?: (target: GeofenceTarget) => void;
  onOpenCompass?: (target: GeofenceTarget) => void;
  onToggleMute?: () => void;
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

  const distance = geofenceState.currentDistanceMeters ?? 0;
  const bearing = geofenceState.currentBearingDegrees ?? 0;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[800] w-[95%] max-w-lg animate-in slide-in-from-top-4 duration-300">
      <div className="bg-slate-950/95 backdrop-blur-2xl border-2 border-amber-500/80 rounded-3xl p-3.5 shadow-2xl shadow-amber-950/60 text-slate-100 flex flex-col gap-2.5">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center">
              <div className="w-8 h-8 rounded-2xl bg-amber-500/20 border border-amber-400 text-amber-300 flex items-center justify-center">
                <Radio className="w-4 h-4 animate-spin-slow" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/30 text-amber-300 border border-amber-400/50">
                  GEOFENCE 5M TERDETEKSI
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  LOKASI DI DEKAT ANDA
                </span>
              </div>
              <h3 className="text-sm font-black text-white font-mono truncate max-w-[240px] sm:max-w-xs mt-0.5">
                {target.name}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {onToggleMute && (
              <button
                type="button"
                onClick={onToggleMute}
                className="p-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
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
              className="p-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white"
              title="Tutup Peringatan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Proximity Metric Grid */}
        <div className="grid grid-cols-3 gap-2 bg-slate-900/80 p-2.5 rounded-2xl border border-slate-800 text-center font-mono">
          <div className="bg-slate-950/60 p-1.5 rounded-xl">
            <span className="text-[9px] text-slate-400 uppercase block">Jarak</span>
            <span className="text-base font-black text-amber-400">{distance.toFixed(1)} m</span>
          </div>
          <div className="bg-slate-950/60 p-1.5 rounded-xl">
            <span className="text-[9px] text-slate-400 uppercase block">Arah Kompas</span>
            <span className="text-base font-black text-cyan-400">{bearing}°</span>
          </div>
          <div className="bg-slate-950/60 p-1.5 rounded-xl">
            <span className="text-[9px] text-slate-400 uppercase block">Kedalaman</span>
            <span className="text-base font-black text-emerald-400">
              ~{target.depthEstimateCm ?? 15} cm
            </span>
          </div>
        </div>

        {/* Tactical Action Buttons */}
        <div className="grid grid-cols-3 gap-1.5">
          {onNavigateToMap && (
            <button
              type="button"
              onClick={() => onNavigateToMap(target)}
              className="flex items-center justify-center gap-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[11px] font-mono font-medium transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <span>Di Peta</span>
            </button>
          )}

          {onOpenCompass && (
            <button
              type="button"
              onClick={() => onOpenCompass(target)}
              className="flex items-center justify-center gap-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[11px] font-mono font-medium transition-colors"
            >
              <Compass className="w-3.5 h-3.5 text-emerald-400" />
              <span>Kompas</span>
            </button>
          )}

          {onActivateTargetAlarm && (
            <button
              type="button"
              onClick={() => onActivateTargetAlarm(target)}
              className="flex items-center justify-center gap-1 py-1.5 px-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold rounded-xl text-[11px] font-mono shadow-sm transition-all"
            >
              <Target className="w-3.5 h-3.5" />
              <span>Pinpointer</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
