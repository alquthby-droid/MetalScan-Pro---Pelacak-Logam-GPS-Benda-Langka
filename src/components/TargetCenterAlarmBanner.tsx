import React, { useState } from 'react';
import { TargetCenterAlarmState, targetCenterAlarmService } from '../services/targetCenterAlarm';
import {
  Bell,
  BellOff,
  Radio,
  Navigation2,
  Volume2,
  VolumeX,
  Power,
  Sliders,
  CheckCircle2,
  Layers,
  MapPin,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { getDepthTier } from './SoilDepthIndicator';

interface TargetCenterAlarmBannerProps {
  alarmState: TargetCenterAlarmState;
  onDeactivate: () => void;
}

export const TargetCenterAlarmBanner: React.FC<TargetCenterAlarmBannerProps> = ({
  alarmState,
  onDeactivate,
}) => {
  const [showSimControls, setShowSimControls] = useState<boolean>(false);

  if (!alarmState.isActive || !alarmState.targetId) {
    return null;
  }

  const dist = alarmState.distanceMeters;
  const isLocked = alarmState.isCenterReached;
  const depthTier = alarmState.targetDepthCm ? getDepthTier(alarmState.targetDepthCm) : null;

  // Signal level (1 - 5)
  let signalLevel = 1;
  let statusText = 'Mencari Titik Pusat...';
  let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';

  if (isLocked) {
    signalLevel = 5;
    statusText = 'TEPAT DI TITIK PUSAT BENDA!';
    badgeColor = 'bg-rose-500 text-white border-rose-300 animate-pulse';
  } else if (dist <= 4) {
    signalLevel = 4;
    statusText = 'Sangat Dekat Titik Pusat!';
    badgeColor = 'bg-red-500/20 text-red-300 border-red-500/50 animate-pulse';
  } else if (dist <= 10) {
    signalLevel = 3;
    statusText = 'Mendekati Titik Sasaran';
    badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/50';
  } else if (dist <= 20) {
    signalLevel = 2;
    statusText = 'Sinyal Jangkauan Terdeteksi';
    badgeColor = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50';
  }

  return (
    <div
      className={`rounded-2xl border p-4 transition-all duration-300 shadow-xl backdrop-blur-md flex flex-col gap-3 relative overflow-hidden ${
        isLocked
          ? 'bg-gradient-to-r from-rose-950/80 via-slate-900 to-amber-950/70 border-rose-500/70 ring-2 ring-rose-500/40'
          : 'bg-gradient-to-r from-slate-900/95 via-cyan-950/60 to-slate-900/95 border-cyan-500/50'
      }`}
    >
      {/* Top Banner Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          {/* Pulsing Sonar Icon */}
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center border font-bold ${
              isLocked
                ? 'bg-rose-500 text-white border-rose-300 animate-bounce'
                : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
            }`}
          >
            <Radio className="w-4 h-4 animate-spin" style={{ animationDuration: '3s' }} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono text-slate-100 flex items-center gap-1.5">
                <span>Sensor Alarm Titik Pusat:</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  ONLINE
                </span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono truncate max-w-xs sm:max-w-sm mt-0.5">
              Target: <strong className="text-white">{alarmState.targetName}</strong>
              {alarmState.targetDepthCm && (
                <span> (Kedalaman ~{alarmState.targetDepthCm} cm)</span>
              )}
            </p>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2">
          {/* Mute/Unmute Audio Beep */}
          <button
            type="button"
            onClick={() => targetCenterAlarmService.setMuted(!alarmState.isMuted)}
            className={`p-2 rounded-xl border text-xs font-mono transition-all ${
              alarmState.isMuted
                ? 'bg-slate-800 text-slate-400 border-slate-700'
                : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30'
            }`}
            title={alarmState.isMuted ? 'Nyalakan Bunyi Alarm' : 'Senyapkan Bunyi Alarm'}
          >
            {alarmState.isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Test Simulation Distance Toggle */}
          <button
            type="button"
            onClick={() => setShowSimControls(!showSimControls)}
            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-mono transition-all flex items-center gap-1 ${
              showSimControls
                ? 'bg-purple-600/30 text-purple-300 border-purple-500/50'
                : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Buka panel simulasi pengujian jarak"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Uji Jarak</span>
          </button>

          {/* Turn OFFLINE Button */}
          <button
            type="button"
            onClick={onDeactivate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-mono font-semibold transition-all active:scale-95"
            title="Matikan Sensor Alarm (Ubah ke OFFLINE)"
          >
            <Power className="w-3.5 h-3.5" />
            <span>Matikan (OFFLINE)</span>
          </button>
        </div>
      </div>

      {/* Main Radar / Proximity Visualizer */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
        {/* Distance Display */}
        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 flex items-center justify-between sm:justify-start gap-3">
          <div className="relative">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center font-mono font-bold text-lg border ${
                isLocked
                  ? 'bg-rose-500 text-white border-rose-300 ring-2 ring-rose-400/50 animate-pulse'
                  : 'bg-cyan-950/70 text-cyan-400 border-cyan-500/50'
              }`}
            >
              {isLocked ? '🎯' : `${dist.toFixed(0)}m`}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Jarak ke Titik Pusat
            </div>
            <div className="text-xl font-bold font-mono text-white flex items-baseline gap-1">
              <span>{dist.toFixed(1)}</span>
              <span className="text-xs text-slate-400 font-normal">Meter</span>
            </div>
            <div className="text-[10px] font-mono text-cyan-400">
              Arah Kompas: ~{alarmState.bearingDegrees}°
            </div>
          </div>
        </div>

        {/* Proximity Status & Signal Strength Bar */}
        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 flex flex-col justify-between gap-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400 text-[10px] uppercase">Status Sinyal Pusat:</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${badgeColor}`}>
              {statusText}
            </span>
          </div>

          {/* 5-Segment Signal Bar */}
          <div className="flex items-center gap-1.5 h-3 w-full">
            {[1, 2, 3, 4, 5].map((level) => {
              const isBarActive = signalLevel >= level;
              return (
                <div
                  key={level}
                  className={`flex-1 h-full rounded-md transition-all duration-300 ${
                    isBarActive
                      ? level === 5
                        ? 'bg-rose-500 shadow-md shadow-rose-500/50'
                        : level >= 3
                        ? 'bg-amber-400'
                        : 'bg-cyan-400'
                      : 'bg-slate-800'
                  }`}
                />
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>Jauh (&gt;25m)</span>
            <span>Titik Pusat (&lt;2m)</span>
          </div>
        </div>

        {/* Offline Badge & Compass Pointer */}
        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 flex items-center justify-between gap-2">
          <div className="flex flex-col gap-1 text-[11px] font-mono">
            <span className="text-emerald-400 flex items-center gap-1 font-semibold text-[10px]">
              <ShieldCheck className="w-3.5 h-3.5" />
              100% OFFLINE READY
            </span>
            <span className="text-slate-400 text-[10px] leading-tight">
              Kalkulasi GPS & Audio sonar berjalan mandiri tanpa butuh kuota internet di pedalaman.
            </span>
          </div>

          {/* Bearing Pointer Arrow */}
          <div
            className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0 shadow-inner"
            title={`Arah menuju sasaran: ${alarmState.bearingDegrees}°`}
          >
            <Navigation2
              className="w-5 h-5 text-cyan-400 transition-transform duration-300"
              style={{
                transform: `rotate(${alarmState.bearingDegrees}deg)`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Simulation Distance Testing Bar (Useful for laptop/desktop preview) */}
      {showSimControls && (
        <div className="bg-slate-950 p-3 rounded-xl border border-purple-500/40 flex flex-col gap-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-xs font-mono text-purple-300">
            <span className="flex items-center gap-1 font-bold">
              <Sliders className="w-3.5 h-3.5" />
              <span>Simulasi Uji Jarak (Testing Console):</span>
            </span>
            <span className="text-white font-bold">{dist.toFixed(1)} Meter</span>
          </div>

          {/* Quick presets */}
          <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono">
            <span className="text-slate-400">Preset Uji:</span>
            <button
              type="button"
              onClick={() => targetCenterAlarmService.setSimulatedDistance(1.2)}
              className="px-2 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30"
            >
              1.2m (Pusat Tepat / Alarm Keras)
            </button>
            <button
              type="button"
              onClick={() => targetCenterAlarmService.setSimulatedDistance(3.5)}
              className="px-2 py-1 rounded bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30"
            >
              3.5m (Sangat Dekat)
            </button>
            <button
              type="button"
              onClick={() => targetCenterAlarmService.setSimulatedDistance(8.0)}
              className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
            >
              8.0m (Mendekat)
            </button>
            <button
              type="button"
              onClick={() => targetCenterAlarmService.setSimulatedDistance(22.0)}
              className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30"
            >
              22m (Jangkauan Luar)
            </button>
            <button
              type="button"
              onClick={() => targetCenterAlarmService.setSimulatedDistance(null)}
              className="px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:text-white"
            >
              Reset ke GPS Asli
            </button>
          </div>

          {/* Slider */}
          <input
            type="range"
            min="0.5"
            max="30"
            step="0.5"
            value={dist}
            onChange={(e) => targetCenterAlarmService.setSimulatedDistance(parseFloat(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
        </div>
      )}
    </div>
  );
};
