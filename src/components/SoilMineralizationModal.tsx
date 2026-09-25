import React, { useState, useEffect } from 'react';
import {
  X,
  Mountain,
  Play,
  Pause,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Sliders,
  Layers,
  Sparkles,
  Info,
  Clock,
  Compass,
  History,
  Trash2,
  ChevronRight,
  TrendingDown,
  Activity,
} from 'lucide-react';
import {
  SoilMineralizationProfile,
  SoilProfilingProgress,
  SoilMineralizationLevel,
} from '../types/detector';
import { soilMineralizationService } from '../services/soilMineralizationService';

interface SoilMineralizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userLat?: number;
  userLng?: number;
  onApplySettings?: (sensitivityReductionPercent: number, groundBalanceOffset: number) => void;
}

export const SoilMineralizationModal: React.FC<SoilMineralizationModalProps> = ({
  isOpen,
  onClose,
  userLat,
  userLng,
  onApplySettings,
}) => {
  const [progress, setProgress] = useState<SoilProfilingProgress>(() =>
    soilMineralizationService.getProgressState()
  );
  const [activeProfile, setActiveProfile] = useState<SoilMineralizationProfile | null>(() =>
    soilMineralizationService.getLatestProfile()
  );
  const [savedProfiles, setSavedProfiles] = useState<SoilMineralizationProfile[]>(() =>
    soilMineralizationService.getSavedProfiles()
  );
  const [activeTab, setActiveTab] = useState<'profiler' | 'history'>('profiler');
  const [appliedFeedback, setAppliedFeedback] = useState<boolean>(false);
  const [simMode, setSimMode] = useState<'NONE' | 'CLEAN' | 'MEDIUM' | 'VOLCANIC' | 'MAGNETITE'>(
    () => soilMineralizationService.getSimulatedMode()
  );

  useEffect(() => {
    soilMineralizationService.setLocation(userLat, userLng);
  }, [userLat, userLng]);

  useEffect(() => {
    if (!isOpen) return;

    const unsubProgress = soilMineralizationService.subscribeProgress((p) => {
      setProgress(p);
    });

    const unsubComplete = soilMineralizationService.subscribeComplete((profile) => {
      setActiveProfile(profile);
      setSavedProfiles(soilMineralizationService.getSavedProfiles());
    });

    return () => {
      unsubProgress();
      unsubComplete();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStart = () => {
    setAppliedFeedback(false);
    soilMineralizationService.startProfiling(60);
  };

  const handlePause = () => {
    soilMineralizationService.pauseProfiling();
  };

  const handleResume = () => {
    soilMineralizationService.resumeProfiling();
  };

  const handleCancel = () => {
    soilMineralizationService.cancelProfiling();
  };

  const handleSelectSimMode = (mode: 'NONE' | 'CLEAN' | 'MEDIUM' | 'VOLCANIC' | 'MAGNETITE') => {
    setSimMode(mode);
    soilMineralizationService.setSimulatedMode(mode);
  };

  const handleDeleteProfile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    soilMineralizationService.deleteProfile(id);
    setSavedProfiles(soilMineralizationService.getSavedProfiles());
    if (activeProfile?.id === id) {
      setActiveProfile(soilMineralizationService.getLatestProfile());
    }
  };

  const handleApplyAdvice = () => {
    if (!activeProfile || !onApplySettings) return;
    const { recommendedSensitivityReductionPercent, recommendedGroundBalanceOffset } =
      activeProfile.shallowDetectionFeasibility;
    onApplySettings(
      recommendedSensitivityReductionPercent,
      recommendedGroundBalanceOffset
    );
    setAppliedFeedback(true);
    setTimeout(() => setAppliedFeedback(false), 3000);
  };

  // Helper colors
  const getScoreColor = (score: number) => {
    if (score <= 25) return { text: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', stroke: '#10b981' };
    if (score <= 50) return { text: 'text-cyan-400', bg: 'bg-cyan-500/20', border: 'border-cyan-500/40', stroke: '#06b6d4' };
    if (score <= 75) return { text: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/40', stroke: '#f59e0b' };
    return { text: 'text-rose-400', bg: 'bg-rose-500/20', border: 'border-rose-500/40', stroke: '#f43f5e' };
  };

  const profileToDisplay = activeProfile;
  const colors = profileToDisplay ? getScoreColor(profileToDisplay.mineralizationScore) : getScoreColor(progress.currentScorePreview);

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden font-sans">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Mountain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Soil Mineralization Profiler
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                  60 Detik
                </span>
              </div>
              <p className="text-xs text-slate-400 font-normal">
                Ukur rata-rata riak noise magnetik tanah & kelayakan deteksi dangkal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-950/30 border-b border-slate-800/80 text-xs font-mono shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('profiler')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
              activeTab === 'profiler'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Profiler Aktif</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
              activeTab === 'history'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Riwayat Lokasi ({savedProfiles.length})</span>
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {activeTab === 'profiler' && (
            <>
              {/* Profiling Status & Live Countdown Box */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 font-mono text-xs text-slate-300">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <span>Status Perekaman:</span>
                    {progress.isActive ? (
                      <span className="flex items-center gap-1 text-emerald-400 font-bold animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        {progress.isPaused ? 'Dijeda' : 'Merekam Sampel Tanah...'}
                      </span>
                    ) : (
                      <span className="text-slate-400">Siap / Diam</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Simulation Selector */}
                    <div className="flex items-center gap-1 text-[11px] font-mono bg-slate-800/80 px-2 py-1 rounded-xl border border-slate-700">
                      <span className="text-slate-400">Uji Coba:</span>
                      <select
                        aria-label="Pilih Jenis Tanah untuk Uji Coba Simulasi"
                        value={simMode}
                        onChange={(e) => handleSelectSimMode(e.target.value as any)}
                        className="bg-transparent text-amber-300 font-medium focus:outline-none cursor-pointer"
                      >
                        <option value="NONE" className="bg-slate-900 text-slate-200">Sensor Fisik Nyata</option>
                        <option value="CLEAN" className="bg-slate-900 text-slate-200">Simulasi: Pasir Bersih</option>
                        <option value="MEDIUM" className="bg-slate-900 text-slate-200">Simulasi: Tanah Lempung</option>
                        <option value="VOLCANIC" className="bg-slate-900 text-slate-200">Simulasi: Vulkanik/Laterit</option>
                        <option value="MAGNETITE" className="bg-slate-900 text-slate-200">Simulasi: Pasir Besi Magnetit</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Progress Bar & Countdown Display */}
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between font-mono">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-black tracking-tight text-white">
                        {progress.isActive ? progress.remainingSeconds : (profileToDisplay?.durationSeconds || 60)}
                      </span>
                      <span className="text-xs text-slate-400">detik tersisa</span>
                    </div>

                    <div className="text-right text-xs text-slate-400">
                      <span className="text-cyan-400 font-bold">{progress.currentSamplesCount}</span> sampel terkumpul
                    </div>
                  </div>

                  {/* Progress Line */}
                  <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden border border-slate-700/60 relative">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-amber-400 transition-all duration-150"
                      style={{ width: `${progress.progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Live Real-time Noise Waveform Canvas */}
                <div className="pt-1">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
                    <span>Oskiloskop Noise Magnetik Live (Δ µT)</span>
                    <span>σ: <strong className="text-slate-200">{progress.liveSigma} µT</strong></span>
                  </div>
                  <div className="h-16 w-full rounded-xl bg-slate-900/90 border border-slate-800 p-2 flex items-center justify-center relative overflow-hidden">
                    <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 40">
                      {/* Zero center baseline */}
                      <line x1="0" y1="20" x2="100" y2="20" stroke="#334155" strokeDasharray="2,2" strokeWidth="1" />
                      
                      {/* Waveform polyline */}
                      {progress.recentNoiseWaveform.length > 1 && (
                        <polyline
                          fill="none"
                          stroke={progress.isActive ? '#38bdf8' : '#64748b'}
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          points={progress.recentNoiseWaveform
                            .map((val, idx) => {
                              const x = (idx / (progress.recentNoiseWaveform.length - 1)) * 100;
                              // Scale val [-2.5, 2.5] to [38, 2]
                              const clamped = Math.max(-3, Math.min(3, val));
                              const y = 20 - (clamped / 3) * 16;
                              return `${x},${y}`;
                            })
                            .join(' ')}
                        />
                      )}
                    </svg>
                  </div>
                </div>

                {/* Profiler Action Buttons */}
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  {!progress.isActive ? (
                    <button
                      type="button"
                      onClick={handleStart}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold font-mono text-xs shadow-lg shadow-amber-950/40 transition-all active:scale-95"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Mulai Profiling Tanah (60 Detik)</span>
                    </button>
                  ) : (
                    <>
                      {progress.isPaused ? (
                        <button
                          type="button"
                          onClick={handleResume}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs shadow-lg transition-all active:scale-95"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          <span>Lanjutkan</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handlePause}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 font-bold font-mono text-xs shadow-lg transition-all active:scale-95"
                        >
                          <Pause className="w-4 h-4" />
                          <span>Jeda Perekaman</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleCancel}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono text-xs transition-all active:scale-95"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Batal</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Instructions Callout when not started */}
              {!progress.isActive && !profileToDisplay && (
                <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-800/40 text-xs text-cyan-200 font-sans space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-cyan-300 font-mono">
                    <Info className="w-4 h-4" />
                    <span>Petunjuk Profiling Tanah di Lapangan:</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    1. Dekatkan ponsel / sensor detektor sekitar <strong>5 - 10 cm</strong> di atas permukaan tanah target.<br />
                    2. Pastikan tidak ada logam besar buatan (mobil, pipa besi) dalam radius 2 meter.<br />
                    3. Klik tombol <strong>Mulai Profiling</strong> dan biarkan sensor menyerap fluktuasi geomagnetik tanah secara stabil selama 60 detik.
                  </p>
                </div>
              )}

              {/* Profile Results Card (When a profile is completed or loaded) */}
              {profileToDisplay && (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4 shadow-xl">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                        Hasil Analisis Matriks Tanah
                      </div>
                      <h3 className="text-base font-bold text-white mt-0.5">
                        {profileToDisplay.soilClassification}
                      </h3>
                      <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mt-1">
                        <span>Sampel: {profileToDisplay.sampleCount} pts</span>
                        <span>•</span>
                        <span>Durasi: {profileToDisplay.durationSeconds}s</span>
                        {profileToDisplay.lat && (
                          <>
                            <span>•</span>
                            <span>GPS: {profileToDisplay.lat.toFixed(4)}, {profileToDisplay.lng?.toFixed(4)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Big Score Radial Badge */}
                    <div className={`p-3 rounded-2xl border ${colors.bg} ${colors.border} text-center shrink-0`}>
                      <div className="text-[10px] font-mono text-slate-300 font-medium">SKOR MINERAL</div>
                      <div className={`text-2xl sm:text-3xl font-black font-mono ${colors.text}`}>
                        {profileToDisplay.mineralizationScore}
                        <span className="text-xs text-slate-400 font-normal">/100</span>
                      </div>
                      <div className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-full mt-1 ${colors.bg} ${colors.text}`}>
                        {profileToDisplay.level}
                      </div>
                    </div>
                  </div>

                  {/* Quantitative Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Noise Sigma (σ)</div>
                      <div className="text-sm font-bold text-slate-100 mt-0.5">{profileToDisplay.noiseSigma} µT</div>
                      <div className="text-[9px] text-slate-500">Standar deviasi</div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Peak-to-Peak (Δ)</div>
                      <div className="text-sm font-bold text-slate-100 mt-0.5">{profileToDisplay.peakToPeakVariance} µT</div>
                      <div className="text-[9px] text-slate-500">Max minus min</div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Rata-rata Kuat</div>
                      <div className="text-sm font-bold text-slate-100 mt-0.5">{profileToDisplay.meanStrength} µT</div>
                      <div className="text-[9px] text-slate-500">Fluks medan total</div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Jitter Vektor 3D</div>
                      <div className="text-sm font-bold text-slate-100 mt-0.5">{profileToDisplay.magneticTiltVariation}°</div>
                      <div className="text-[9px] text-slate-500">Variasi inklinasi</div>
                    </div>
                  </div>

                  {/* Shallow Detection Feasibility Breakdown */}
                  <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-700/80 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        {profileToDisplay.shallowDetectionFeasibility.status === 'EXCELLENT' ? (
                          <ShieldCheck className="w-5 h-5 text-emerald-400" />
                        ) : profileToDisplay.shallowDetectionFeasibility.status === 'GOOD' ? (
                          <CheckCircle2 className="w-5 h-5 text-cyan-400" />
                        ) : profileToDisplay.shallowDetectionFeasibility.status === 'CHALLENGING' ? (
                          <AlertTriangle className="w-5 h-5 text-amber-400" />
                        ) : (
                          <Flame className="w-5 h-5 text-rose-400" />
                        )}
                        <div>
                          <div className="text-xs font-mono font-bold text-slate-200">
                            Kelayakan Deteksi Dangkal (&lt; 15 cm)
                          </div>
                          <div className={`text-sm font-bold ${colors.text}`}>
                            {profileToDisplay.shallowDetectionFeasibility.title}
                          </div>
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        <span className="text-[10px] text-slate-400 block">Penetrasi Efektif</span>
                        <span className="text-sm font-bold text-white">
                          ±{profileToDisplay.shallowDetectionFeasibility.effectiveShallowDepthCm} cm
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed font-sans">
                      {profileToDisplay.shallowDetectionFeasibility.description}
                    </p>

                    {/* Tactical Settings Recommendation Row */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between flex-wrap gap-3 font-mono text-xs">
                      <div>
                        <div className="text-[10px] text-slate-400">Rekomendasi Setelan:</div>
                        <div className="text-slate-200 font-semibold mt-0.5">
                          Sensitivitas: {profileToDisplay.shallowDetectionFeasibility.recommendedSensitivityReductionPercent > 0
                            ? `Kurangi ${profileToDisplay.shallowDetectionFeasibility.recommendedSensitivityReductionPercent}%`
                            : 'Maksimal (100%)'}
                          {' • '}
                          Ground Balance Offset: +{profileToDisplay.shallowDetectionFeasibility.recommendedGroundBalanceOffset} µT
                        </div>
                      </div>

                      {onApplySettings && (
                        <button
                          type="button"
                          onClick={handleApplyAdvice}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all active:scale-95"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>{appliedFeedback ? 'Tersimpan!' : 'Terapkan ke Detektor'}</span>
                        </button>
                      )}
                    </div>

                    {/* Tactical Field Advice Bullet Points */}
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[11px] font-mono font-bold text-slate-300">
                        Strategi di Lapangan:
                      </div>
                      <ul className="space-y-1 text-xs text-slate-300 font-sans list-disc list-inside">
                        {profileToDisplay.shallowDetectionFeasibility.tacticalAdvice.map((tip, idx) => (
                          <li key={idx} className="leading-relaxed">
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Tab History View */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span>Daftar Profil Mineral Tersimpan ({savedProfiles.length})</span>
                <span className="text-[11px]">Tersimpan di memori perangkat</span>
              </div>

              {savedProfiles.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-slate-950/40 border border-slate-800 text-slate-400 space-y-2">
                  <Mountain className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="text-sm font-medium">Belum ada profil tanah tersimpan.</p>
                  <p className="text-xs text-slate-500">
                    Jalankan perekaman 60 detik pada tab Profiler untuk menyimpan data mineral tanah lokasi ini.
                  </p>
                </div>
              ) : (
                savedProfiles.map((p) => {
                  const itemColor = getScoreColor(p.mineralizationScore);
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setActiveProfile(p);
                        setActiveTab('profiler');
                      }}
                      className="p-3.5 rounded-2xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer flex items-center justify-between gap-3 group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full ${itemColor.bg} ${itemColor.text}`}>
                            Skor {p.mineralizationScore} • {p.level}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            {new Date(p.timestamp).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-200">
                          {p.soilClassification}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                          <span>σ: {p.noiseSigma} µT</span>
                          <span>•</span>
                          <span>Δ: {p.peakToPeakVariance} µT</span>
                          <span>•</span>
                          <span>Penetrasi: ±{p.shallowDetectionFeasibility.effectiveShallowDepthCm} cm</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => handleDeleteProfile(p.id, e)}
                          className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Hapus Profil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition-colors" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 text-[11px] font-mono text-slate-400 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <Mountain className="w-3.5 h-3.5 text-amber-400" />
            <span>Soil Mineralization Profiler 60s System</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
