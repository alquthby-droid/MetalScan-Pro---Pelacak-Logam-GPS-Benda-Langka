import React, { useState } from 'react';
import { Sparkles, Radio, Compass, Disc, Flashlight, Activity, Play, Pause } from 'lucide-react';
import { SensorManager, sensorManager } from '../services/sensorManager';
import { DriftMonitorState } from '../types/detector';

interface GaugeMeterProps {
  totalStrength: number;
  netStrength: number;
  baseline: number;
  threshold: number;
  onTareZero: () => void;
  isProximityPulsing?: boolean;
  driftState?: DriftMonitorState;
  onOpenDriftMonitor?: () => void;
}

export const GaugeMeter: React.FC<GaugeMeterProps> = ({
  totalStrength,
  netStrength,
  baseline,
  threshold,
  onTareZero,
  isProximityPulsing = false,
  driftState,
  onOpenDriftMonitor,
}) => {
  const [isSweeping, setIsSweeping] = useState<boolean>(() => sensorManager.isAutoSweep());

  const handleToggleSweep = () => {
    const next = sensorManager.toggleAutoSweep();
    setIsSweeping(next);
  };

  const handleInteractiveDeflect = () => {
    sensorManager.deflectPointer(45);
  };

  // Classification
  const classification = SensorManager.classifyMetal(netStrength, totalStrength);

  // Gauge scale: 0 to 220 µT
  const maxScale = 220;
  const clampedVal = Math.min(maxScale, Math.max(0, totalStrength));
  // Needle angle: -120 deg to +120 deg (240 deg total arc)
  const angle = -120 + (clampedVal / maxScale) * 240;

  // Percentage for progress ring
  const percent = Math.min(100, Math.max(0, (totalStrength / maxScale) * 100));

  // Is threshold breached?
  const isThresholdBreached = totalStrength >= threshold;

  return (
    <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
      {/* Background radial glow */}
      <div
        className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl pointer-events-none transition-all duration-300"
        style={{
          backgroundColor: isThresholdBreached ? 'rgba(234, 179, 8, 0.18)' : 'rgba(16, 185, 129, 0.12)',
        }}
      />

      {/* Top Header & Quick Action */}
      <div className="flex items-center justify-between mb-2 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></div>
          <span className="text-[11px] font-mono tracking-widest uppercase text-slate-400 font-semibold">
            Detektor Medan Magnetik
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {driftState && onOpenDriftMonitor && (
            <button
              type="button"
              onClick={onOpenDriftMonitor}
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono rounded-full border transition-all ${
                driftState.status === 'STABLE'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:border-emerald-500/60'
                  : driftState.status === 'MODERATE_NOISE'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:border-amber-400'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:border-rose-400 animate-pulse'
              }`}
              title="Klik untuk membuka Calibration Drift Monitor"
            >
              <Activity className="w-3 h-3" />
              <span>
                {driftState.status === 'STABLE'
                  ? 'Drift Ok'
                  : driftState.status === 'MODERATE_NOISE'
                  ? 'Noise Sedang'
                  : 'Berisik!'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleSweep}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded-full border transition-all active:scale-95 ${
              isSweeping
                ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/60 shadow-sm shadow-emerald-900/50 animate-pulse'
                : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title={isSweeping ? 'Matikan Simulasi Ayunan Koil' : 'Mulai Simulasi Ayunan Koil (Deteksi Dinamis)'}
          >
            {isSweeping ? (
              <Pause className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Play className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span>{isSweeping ? 'Ayunan Aktif' : 'Uji Ayunan'}</span>
          </button>

          <button
            type="button"
            onClick={onTareZero}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-medium rounded-full bg-slate-800/90 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 hover:border-cyan-500/60 shadow-sm transition-all active:scale-95"
            title="Kalibrasi Tara Nol: Mengurangi medan magnet bumi lokal agar anomali logam lebih presisi"
          >
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Tara Nol ({baseline.toFixed(0)} µT)</span>
          </button>
        </div>
      </div>

      {/* Main Gauge Graphic */}
      <div
        className="relative flex flex-col items-center justify-center my-1 select-none cursor-pointer"
        onClick={handleInteractiveDeflect}
        onMouseMove={handleInteractiveDeflect}
        title="Klik atau usap dial untuk menguji defleksi medan magnet"
      >
        <svg className="w-64 h-48 overflow-visible" viewBox="0 0 200 150">
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="35%" stopColor="#10b981" />
              <stop offset="70%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>

            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background Track Arc */}
          <path
            d="M 25 130 A 75 75 0 1 1 175 130"
            fill="none"
            stroke="#1e293b"
            strokeWidth="12"
            strokeLinecap="round"
          />

          {/* Active Gradient Arc */}
          <path
            d="M 25 130 A 75 75 0 1 1 175 130"
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray="290"
            strokeDashoffset={290 - (percent / 100) * 290}
            className="transition-all duration-75 ease-out"
          />

          {/* Ticks & Labels along circumference */}
          {[
            { val: 0, label: '0' },
            { val: 50, label: '50' },
            { val: 100, label: '100' },
            { val: 150, label: '150' },
            { val: 200, label: '200+' },
          ].map(({ val, label }) => {
            const tickAngle = (-120 + (val / maxScale) * 240) * (Math.PI / 180);
            const r1 = 66;
            const r2 = 72;
            const x1 = 100 + r1 * Math.sin(tickAngle);
            const y1 = 110 - r1 * Math.cos(tickAngle);
            const x2 = 100 + r2 * Math.sin(tickAngle);
            const y2 = 110 - r2 * Math.cos(tickAngle);

            const textR = 56;
            const tx = 100 + textR * Math.sin(tickAngle);
            const ty = 110 - textR * Math.cos(tickAngle);

            return (
              <g key={val}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#475569" strokeWidth="1.5" />
                <text
                  x={tx}
                  y={ty}
                  fill="#64748b"
                  fontSize="7"
                  fontFamily="monospace"
                  textAnchor="middle"
                  alignmentBaseline="middle"
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* Threshold Marker Indicator */}
          {(() => {
            const threshAngle = (-120 + (Math.min(maxScale, threshold) / maxScale) * 240) * (Math.PI / 180);
            const tx1 = 100 + 76 * Math.sin(threshAngle);
            const ty1 = 110 - 76 * Math.cos(threshAngle);
            const tx2 = 100 + 84 * Math.sin(threshAngle);
            const ty2 = 110 - 84 * Math.cos(threshAngle);
            return (
              <line
                x1={tx1}
                y1={ty1}
                x2={tx2}
                y2={ty2}
                stroke="#fbbf24"
                strokeWidth="3"
                strokeLinecap="round"
              />
            );
          })()}

          {/* Center Pivot Point */}
          <circle cx="100" cy="110" r="10" fill="#0f172a" stroke="#334155" strokeWidth="2" />
          <circle cx="100" cy="110" r="4" fill="#38bdf8" />

          {/* Needle with Smooth CSS transform */}
          <g
            style={{
              transformOrigin: '100px 110px',
              transform: `rotate(${angle}deg)`,
              transition: 'transform 0.08s ease-out',
            }}
          >
            <polygon
              points="98,110 102,110 100.5,38 99.5,38"
              fill={isThresholdBreached ? '#f59e0b' : '#38bdf8'}
              filter="url(#glow)"
            />
            <circle cx="100" cy="36" r="2.5" fill="#f8fafc" />
          </g>
        </svg>

        {/* Big Digital Readout in center of gauge */}
        <div className="absolute bottom-1 text-center flex flex-col items-center">
          <div className="flex items-baseline justify-center gap-1.5">
            <span
              className={`text-4xl font-extrabold tracking-tight font-mono transition-colors ${
                isThresholdBreached ? 'text-amber-400 drop-shadow-md' : 'text-slate-100'
              }`}
            >
              {totalStrength.toFixed(1)}
            </span>
            <span className="text-xs font-mono font-bold text-slate-400">µT</span>
          </div>

          <div className="text-[11px] font-mono font-medium text-slate-400 flex items-center gap-2 mt-0.5">
            <span>Delta: <strong className="text-emerald-400">+{netStrength.toFixed(1)} µT</strong></span>
            <span>•</span>
            <span>Kedalaman: <strong className="text-cyan-400">{classification.depthCm > 0 ? `~${classification.depthCm} cm` : 'Jauh'}</strong></span>
          </div>
        </div>
      </div>

      {/* Target Classification Badge */}
      <div
        className={`mt-3 p-3 rounded-2xl border transition-all ${classification.badgeBg} flex items-center justify-between`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center border shadow-inner"
            style={{
              borderColor: `${classification.color}60`,
              backgroundColor: `${classification.color}20`,
              color: classification.color,
            }}
          >
            {classification.category === 'gold' ? (
              <Sparkles className="w-5 h-5 animate-spin" style={{ animationDuration: '8s' }} />
            ) : classification.category === 'meteorite' ? (
              <Radio className="w-5 h-5 animate-pulse" />
            ) : (
              <Disc className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold tracking-wide" style={{ color: classification.color }}>
                {classification.name}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/40 text-slate-300">
                {classification.probability}% Cocok
              </span>
            </div>
            <p className="text-[11px] text-slate-300/90 leading-tight mt-0.5 line-clamp-1">
              {classification.description}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          {isThresholdBreached && (
            <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/40 animate-pulse">
              ANOMALI TERDETEKSI
            </span>
          )}
          {isProximityPulsing && (
            <span className="text-[9px] font-mono font-bold text-black bg-amber-400 px-2 py-0.5 rounded-full shadow-md shadow-amber-400/50 flex items-center gap-1 animate-bounce">
              <Flashlight className="w-2.5 h-2.5" />
              <span>PULSA FLASH AKTIF</span>
            </span>
          )}
        </div>
      </div>

      {/* Material Discrimination Scale Bar */}
      <div className="mt-3 pt-3 border-t border-slate-800/80">
        <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 mb-1">
          <span>SPEKTRUM DISKRIMINASI LOGAM</span>
          <span>Besi → Koin → Relik → Emas → Meteorit</span>
        </div>
        <div className="grid grid-cols-5 gap-1 text-[9px] font-mono text-center">
          <div
            className={`py-1 rounded border transition-all ${
              classification.category === 'iron'
                ? 'bg-slate-700 text-slate-100 border-slate-400 font-bold scale-105'
                : 'bg-slate-900/60 text-slate-500 border-slate-800'
            }`}
          >
            Besi
          </div>
          <div
            className={`py-1 rounded border transition-all ${
              classification.category === 'bronze'
                ? 'bg-amber-900/80 text-amber-200 border-amber-500 font-bold scale-105'
                : 'bg-slate-900/60 text-slate-500 border-slate-800'
            }`}
          >
            Perunggu
          </div>
          <div
            className={`py-1 rounded border transition-all ${
              classification.category === 'silver'
                ? 'bg-sky-900/80 text-sky-200 border-sky-400 font-bold scale-105'
                : 'bg-slate-900/60 text-slate-500 border-slate-800'
            }`}
          >
            Perak / Koin
          </div>
          <div
            className={`py-1 rounded border transition-all ${
              classification.category === 'gold'
                ? 'bg-yellow-900/90 text-yellow-200 border-yellow-400 font-bold scale-105 shadow-md shadow-yellow-500/20'
                : 'bg-slate-900/60 text-slate-500 border-slate-800'
            }`}
          >
            ★ Emas
          </div>
          <div
            className={`py-1 rounded border transition-all ${
              classification.category === 'meteorite'
                ? 'bg-purple-900/90 text-purple-200 border-purple-400 font-bold scale-105 shadow-md shadow-purple-500/20'
                : 'bg-slate-900/60 text-slate-500 border-slate-800'
            }`}
          >
            ★ Meteorit
          </div>
        </div>
      </div>
    </div>
  );
};
