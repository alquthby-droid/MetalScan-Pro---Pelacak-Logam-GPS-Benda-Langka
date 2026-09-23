import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Zap,
  ShieldCheck,
  TrendingUp,
  Info,
  X,
  Compass,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { DriftMonitorState, DetectorSettings } from '../types/detector';
import { driftMonitorService } from '../services/driftMonitor';

interface CalibrationDriftModalProps {
  isOpen: boolean;
  onClose: () => void;
  driftState: DriftMonitorState;
  onTareZero: () => void;
  settings: DetectorSettings;
  onUpdateSettings: (newSettings: Partial<DetectorSettings>) => void;
}

export const CalibrationDriftModal: React.FC<CalibrationDriftModalProps> = ({
  isOpen,
  onClose,
  driftState,
  onTareZero,
  settings,
  onUpdateSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'monitor' | 'guide' | 'settings'>('monitor');
  const [justCalibrated, setJustCalibrated] = useState(false);

  if (!isOpen) return null;

  const handleRecalibrate = () => {
    onTareZero();
    setJustCalibrated(true);
    setTimeout(() => setJustCalibrated(false), 2500);
  };

  const currentNoiseSim = driftMonitorService.getSimulatedNoiseType();

  // Status visual configurations
  const getStatusConfig = () => {
    switch (driftState.status) {
      case 'STABLE':
        return {
          label: 'Baseline Stabil & Lingkungan Optimal',
          badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          indicatorClass: 'bg-emerald-400 shadow-emerald-500/50',
          icon: CheckCircle2,
          color: 'text-emerald-400',
        };
      case 'MODERATE_NOISE':
        return {
          label: 'Noise Sedang (Fluktuasi Terkendali)',
          badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          indicatorClass: 'bg-amber-400 shadow-amber-500/50',
          icon: Info,
          color: 'text-amber-400',
        };
      case 'HIGH_NOISE':
        return {
          label: 'Lingkungan Sangat Berisik (Interferensi Tinggi)',
          badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse',
          indicatorClass: 'bg-rose-500 shadow-rose-500/80 animate-ping',
          icon: Zap,
          color: 'text-rose-400',
        };
      case 'SEVERE_DRIFT':
        return {
          label: 'Drift Baseline Signifikan (Perlu Kalibrasi)',
          badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40 animate-pulse',
          indicatorClass: 'bg-orange-400 shadow-orange-500/80',
          icon: AlertTriangle,
          color: 'text-orange-400',
        };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  // Render SVG Sparkline of Drift History
  const renderDriftChart = () => {
    const history = driftState.history;
    const width = 360;
    const height = 110;
    const padding = 15;

    if (history.length < 2) {
      return (
        <div className="h-28 flex flex-col items-center justify-center text-slate-500 text-xs font-mono bg-slate-950/60 rounded-xl border border-slate-800">
          <Activity className="w-5 h-5 text-slate-600 animate-pulse mb-1" />
          <span>Mengumpulkan sampel stabilitas fluks magnetik...</span>
        </div>
      );
    }

    // Chart bounds (-10 to +10 µT scale or dynamic)
    const drifts = history.map((d) => d.drift);
    const maxVal = Math.max(8, ...drifts.map(Math.abs));
    const minDrift = -maxVal;
    const maxDrift = maxVal;

    const getX = (index: number) => padding + (index / (history.length - 1)) * (width - 2 * padding);
    const getY = (val: number) => {
      const normalized = (val - minDrift) / (maxDrift - minDrift);
      return height - padding - normalized * (height - 2 * padding);
    };

    const zeroY = getY(0);
    const safeUpperY = getY(3);
    const safeLowerY = getY(-3);

    // Build SVG path
    const points = history.map((d, i) => `${getX(i).toFixed(1)},${getY(d.drift).toFixed(1)}`).join(' ');

    return (
      <div className="relative bg-slate-950/90 rounded-2xl p-3 border border-slate-800/80 shadow-inner">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1.5">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block"></span>
              <span>Garis Pergeseran Baseline (Δ µT)</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-0.5 bg-emerald-500/80 inline-block"></span>
              <span>Zona Toleransi (±3 µT)</span>
            </span>
          </div>
          <span className="text-slate-500">~{history.length} detik terakhir</span>
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28 overflow-visible">
          <defs>
            <linearGradient id="driftGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.4" />
            </linearGradient>
          </defs>

          {/* Safe Stability Band (±3 µT) */}
          <rect
            x={padding}
            y={safeUpperY}
            width={width - 2 * padding}
            height={safeLowerY - safeUpperY}
            fill="#10b981"
            fillOpacity="0.08"
            stroke="#10b981"
            strokeWidth="0.8"
            strokeDasharray="3 3"
          />

          {/* Zero baseline axis */}
          <line
            x1={padding}
            y1={zeroY}
            x2={width - padding}
            y2={zeroY}
            stroke="#475569"
            strokeWidth="1"
            strokeDasharray="2 2"
          />

          {/* Main drift trend line */}
          <polyline
            fill="none"
            stroke="#22d3ee"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />

          {/* Current point pulsing dot */}
          {history.length > 0 && (
            <g transform={`translate(${getX(history.length - 1)}, ${getY(history[history.length - 1].drift)})`}>
              <circle
                r="5"
                fill={Math.abs(driftState.drift) > 5 ? '#f43f5e' : '#22d3ee'}
                className="animate-ping opacity-60"
              />
              <circle
                r="3.5"
                fill={Math.abs(driftState.drift) > 5 ? '#f43f5e' : '#22d3ee'}
                stroke="#0f172a"
                strokeWidth="1.5"
              />
            </g>
          )}

          {/* Scale labels */}
          <text x={padding + 2} y={safeUpperY - 3} fill="#10b981" fontSize="8" fontFamily="monospace">
            +3 µT
          </text>
          <text x={padding + 2} y={zeroY - 2} fill="#64748b" fontSize="8" fontFamily="monospace">
            0 µT (Tara)
          </text>
          <text x={padding + 2} y={safeLowerY + 8} fill="#10b981" fontSize="8" fontFamily="monospace">
            -3 µT
          </text>
        </svg>

        <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mt-1 border-t border-slate-800/60 pt-1.5">
          <span>
            Drift Saat Ini: <strong className={driftState.drift >= 0 ? 'text-cyan-400' : 'text-amber-400'}>
              {driftState.drift > 0 ? '+' : ''}{driftState.drift.toFixed(1)} µT
            </strong>{' '}
            ({driftState.driftPercentage}%)
          </span>
          <span>
            Noise Jitter: <strong className={driftState.noiseSigma > 3 ? 'text-rose-400' : 'text-slate-200'}>
              ±{driftState.noiseSigma.toFixed(2)} µT
            </strong>
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[650] flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/90 rounded-3xl max-w-md w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-cyan-900/30">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-white">Calibration Drift Monitor</h3>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  REAL-TIME
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Stabilitas Baseline & Analisis Derau Magnetik Lingkungan
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-4 pt-2 gap-2 text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('monitor')}
            className={`pb-2 px-3 flex items-center gap-1.5 border-b-2 font-bold transition-all ${
              activeTab === 'monitor'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Monitor & Grafik</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`pb-2 px-3 flex items-center gap-1.5 border-b-2 font-bold transition-all ${
              activeTab === 'guide'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Panduan Kalibrasi</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`pb-2 px-3 flex items-center gap-1.5 border-b-2 font-bold transition-all ${
              activeTab === 'settings'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Setelan Alert</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs font-sans">
          {activeTab === 'monitor' && (
            <>
              {/* Overall Quality Score & Status Banner */}
              <div className="bg-slate-950/80 rounded-2xl p-3.5 border border-slate-800 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusConfig.indicatorClass}`} />
                      <span className={`relative inline-flex rounded-full h-3 w-3 ${statusConfig.indicatorClass}`} />
                    </span>
                    <span className="text-xs font-bold text-slate-200">Indeks Kualitas Lingkungan:</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span
                      className={`text-lg font-black ${
                        driftState.qualityScore >= 80
                          ? 'text-emerald-400'
                          : driftState.qualityScore >= 50
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {driftState.qualityScore}%
                    </span>
                    <span className="text-[10px] text-slate-400">/ 100%</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      driftState.qualityScore >= 80
                        ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                        : driftState.qualityScore >= 50
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                        : 'bg-gradient-to-r from-rose-600 to-rose-400'
                    }`}
                    style={{ width: `${driftState.qualityScore}%` }}
                  />
                </div>

                {/* Status Pill */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium ${statusConfig.badgeClass}`}>
                  <StatusIcon className="w-4 h-4 shrink-0" />
                  <span className="leading-snug">{statusConfig.label}</span>
                </div>
              </div>

              {/* Metric 4-Grid Cards */}
              <div className="grid grid-cols-2 gap-2.5 font-mono">
                {/* Baseline Terkalibrasi vs Ambient */}
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 block">Baseline Kalibrasi (B₀)</span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-base font-extrabold text-cyan-300">
                      {driftState.calibratedBaseline.toFixed(1)} µT
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Amb: {driftState.currentAmbient.toFixed(1)}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-500 block">
                    Sejak {Math.round((Date.now() - driftState.calibratedAt) / 1000)} dtk lalu
                  </span>
                </div>

                {/* Pergeseran Drift (Δ µT) */}
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 block">Pergeseran Drift (ΔB)</span>
                  <div className="flex items-baseline justify-between">
                    <span
                      className={`text-base font-extrabold ${
                        Math.abs(driftState.drift) > 5 ? 'text-rose-400' : 'text-slate-100'
                      }`}
                    >
                      {driftState.drift > 0 ? '+' : ''}{driftState.drift.toFixed(1)} µT
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {driftState.driftPercentage}%
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-500 block">
                    Laju: {driftState.driftRatePerMin} µT/mnt
                  </span>
                </div>

                {/* Noise Jitter Sigma (σ) */}
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 block">Noise Jitter (RMS σ)</span>
                  <div className="flex items-baseline justify-between">
                    <span
                      className={`text-base font-extrabold ${
                        driftState.noiseSigma >= 3.5
                          ? 'text-rose-400'
                          : driftState.noiseSigma >= 1.8
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      ±{driftState.noiseSigma.toFixed(2)} µT
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {driftState.noiseSigma < 1.8 ? 'Rendah' : driftState.noiseSigma < 3.5 ? 'Sedang' : 'Tinggi'}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-500 block">Deviasi standar fluks</span>
                </div>

                {/* Peak-to-Peak Noise Amplitude */}
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 block">Peak-to-Peak (Max-Min)</span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-base font-extrabold text-slate-200">
                      {driftState.peakToPeakNoise.toFixed(1)} µT
                    </span>
                    <span className="text-[10px] text-slate-500">Amplitudo</span>
                  </div>
                  <span className="text-[9px] text-slate-500 block">Rentang noise rolling</span>
                </div>
              </div>

              {/* Sparkline Drift History Timeline */}
              {renderDriftChart()}

              {/* Diagnostic Assessment & Field Advice */}
              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/90 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                  <Info className="w-4 h-4 text-cyan-400" />
                  <span>Diagnosis Geofisika & Saran Lapangan:</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {driftState.diagnosis}
                </p>
                <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 text-[11px] text-cyan-300 flex items-start gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Rekomendasi:</strong>{' '}
                    {driftState.actionRecommendation}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Instant Tare & Simulated Noise Testing */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleRecalibrate}
                  className={`w-full py-2.5 px-4 rounded-2xl font-bold font-mono text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 ${
                    justCalibrated
                      ? 'bg-emerald-600 text-white shadow-emerald-900/50'
                      : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-900/40'
                  }`}
                >
                  <RefreshCw className={`w-4 h-4 ${justCalibrated ? 'animate-spin' : ''}`} />
                  <span>
                    {justCalibrated
                      ? 'Baseline Berhasil Di-Tara Ulang!'
                      : 'Tara Nol / Kalibrasi Ulang Baseline Sekarang'}
                  </span>
                </button>

                {/* Laboratory Simulated Noise Injection Buttons */}
                <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Uji Simulasi Gangguan Lingkungan:</span>
                    </span>
                    <span className="text-[10px] text-slate-500">Mode Testing</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 text-[10px] font-mono">
                    <button
                      type="button"
                      onClick={() => driftMonitorService.setSimulatedNoise('none')}
                      className={`p-1.5 rounded-xl border text-center transition-all ${
                        currentNoiseSim === 'none'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      Bebas
                    </button>
                    <button
                      type="button"
                      onClick={() => driftMonitorService.setSimulatedNoise('power_lines')}
                      className={`p-1.5 rounded-xl border text-center transition-all ${
                        currentNoiseSim === 'power_lines'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-bold'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                      title="Simulasi radiasi elektromagnetik kabel listrik"
                    >
                      Kabel Listrik
                    </button>
                    <button
                      type="button"
                      onClick={() => driftMonitorService.setSimulatedNoise('mineral_ground')}
                      className={`p-1.5 rounded-xl border text-center transition-all ${
                        currentNoiseSim === 'mineral_ground'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                      title="Simulasi tanah batuan mineral / pasir besi"
                    >
                      Pasir Besi
                    </button>
                    <button
                      type="button"
                      onClick={() => driftMonitorService.setSimulatedNoise('severe_drift')}
                      className={`p-1.5 rounded-xl border text-center transition-all ${
                        currentNoiseSim === 'severe_drift'
                          ? 'bg-orange-500/20 text-orange-300 border-orange-500/50 font-bold'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                      title="Simulasi baseline bergeser jauh"
                    >
                      Drift Berat
                    </button>
                  </div>
                </div>
              </div>

              {/* Calibration Event Log */}
              {driftState.calibrationLog.length > 0 && (
                <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 space-y-2">
                  <span className="text-[11px] font-mono text-slate-400 block">
                    Riwayat Kalibrasi Sesi Ini ({driftState.calibrationLog.length}):
                  </span>
                  <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                    {driftState.calibrationLog.map((rec) => (
                      <div
                        key={rec.id}
                        className="flex items-center justify-between text-[10px] font-mono bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800"
                      >
                        <span className="text-slate-400">
                          {new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="text-slate-300">
                          {rec.previousBaseline.toFixed(1)} µT → <strong className="text-emerald-400">{rec.newBaseline.toFixed(1)} µT</strong>
                        </span>
                        <span className="text-cyan-400">
                          Δ {rec.correctedDrift > 0 ? '+' : ''}{rec.correctedDrift.toFixed(1)} µT
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-3.5">
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-cyan-400 font-bold">
                  <Compass className="w-5 h-5" />
                  <span>Teknik Kalibrasi Magnetometer Angka 8 (Figure-8)</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Sensor magnetometer internal ponsel memerlukan penyesuaian fluks medan magnet bumi ketika berpindah lokasi atau terpapar benda logam besar.
                </p>

                {/* Step by step */}
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex items-start gap-2.5 p-2 bg-slate-900/90 rounded-xl border border-slate-800">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <strong className="text-white">Jauhi Logam & Kabel Listrik:</strong>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Pegang ponsel di udara setinggi dada, minimal 1.5 meter dari mobil, pagar besi, tiang listrik, atau kunci di saku.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2 bg-slate-900/90 rounded-xl border border-slate-800">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <strong className="text-white">Gerakan Pola Angka 8 (Tiga Dimensi):</strong>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Putar dan ayunkan ponsel membentuk pola angka 8 tidur (simbol tak terhingga ∞) sebanyak 3 sampai 5 kali selama ~5 detik.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2 bg-slate-900/90 rounded-xl border border-slate-800">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      3
                    </span>
                    <div>
                      <strong className="text-white">Tekan Tombol "Tara Nol":</strong>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Arahkan ponsel ke tanah target pencarian pada jarak sapuan ~10–15 cm, lalu tekan Tara Nol untuk mengunci baseline tanah lokal.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-emerald-950/30 rounded-xl border border-emerald-500/30 flex items-center gap-2 text-emerald-300 text-xs">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Kombinasi kalibrasi angka 8 + Tara Nol menjamin pembacaan target berharga bersih tanpa sinyal hantu.</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-3.5">
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-cyan-400 font-bold">
                  <Sliders className="w-5 h-5" />
                  <span>Sensitivitas Ambang Peringatan Drift</span>
                </div>

                {/* Drift Monitor Enable Toggle */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <span className="font-bold text-slate-100 block">Aktifkan Drift Monitor</span>
                    <span className="text-[11px] text-slate-400">
                      Pelacakan otomatis kestabilan baseline lingkungan
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.driftMonitorEnabled ?? true}
                      onChange={(e) => onUpdateSettings({ driftMonitorEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                  </label>
                </div>

                {/* Sound Alert on Noise Spike */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <span className="font-bold text-slate-100 block">Peringatan Suara Noise Spike</span>
                    <span className="text-[11px] text-slate-400">
                      Bunyikan notifikasi audio halus saat lingkungan mendadak berisik
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.driftSoundAlertEnabled ?? false}
                      onChange={(e) => onUpdateSettings({ driftSoundAlertEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                  </label>
                </div>

                {/* Threshold presets */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-300">Toleransi Pergeseran Ambang:</span>
                    <strong className="text-cyan-400 font-bold">{settings.driftAlertThreshold || 5.0} µT</strong>
                  </div>
                  <input
                    type="range"
                    min="2.0"
                    max="10.0"
                    step="0.5"
                    value={settings.driftAlertThreshold || 5.0}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onUpdateSettings({ driftAlertThreshold: val });
                      driftMonitorService.setThreshold(val);
                    }}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>2.0 µT (Sensitif)</span>
                    <span>5.0 µT (Normal)</span>
                    <span>10.0 µT (Toleransi Luas)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-500 text-[11px]">
            Kalibrasi baseline: {driftState.calibratedBaseline.toFixed(1)} µT
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-all"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
