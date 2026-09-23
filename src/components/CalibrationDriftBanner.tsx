import React from 'react';
import { AlertTriangle, Zap, RefreshCw, ChevronRight, X } from 'lucide-react';
import { DriftMonitorState } from '../types/detector';

interface CalibrationDriftBannerProps {
  driftState: DriftMonitorState;
  onOpenModal: () => void;
  onTareZero: () => void;
  onDismiss?: () => void;
}

export const CalibrationDriftBanner: React.FC<CalibrationDriftBannerProps> = ({
  driftState,
  onOpenModal,
  onTareZero,
  onDismiss,
}) => {
  // Only display if environment is noisy or drift requires recalibration
  if (!driftState.isNoisyEnvironment && !driftState.needsRecalibration) {
    return null;
  }

  const isSevereDrift = driftState.status === 'SEVERE_DRIFT';
  const isHighNoise = driftState.status === 'HIGH_NOISE';

  return (
    <div
      className={`rounded-2xl p-3 border shadow-lg transition-all animate-in slide-in-from-top duration-300 font-sans ${
        isSevereDrift
          ? 'bg-gradient-to-r from-orange-950/70 via-amber-950/60 to-slate-900 border-orange-500/50 text-orange-200'
          : 'bg-gradient-to-r from-rose-950/70 via-red-950/60 to-slate-900 border-rose-500/50 text-rose-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-2.5">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
              isSevereDrift
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40 animate-pulse'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-bounce'
            }`}
          >
            {isSevereDrift ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black tracking-wide uppercase font-mono text-white">
                {isSevereDrift
                  ? 'Drift Baseline Signifikan!'
                  : 'Lingkungan Terlalu Berisik Magnetik!'}
              </span>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold border ${
                  isSevereDrift
                    ? 'bg-orange-500/30 text-orange-200 border-orange-400/50'
                    : 'bg-rose-500/30 text-rose-200 border-rose-400/50'
                }`}
              >
                {isSevereDrift
                  ? `Δ ${driftState.drift > 0 ? '+' : ''}${driftState.drift.toFixed(1)} µT`
                  : `Noise ±${driftState.noiseSigma.toFixed(1)} µT`}
              </span>
            </div>

            <p className="text-[11px] leading-snug opacity-90">
              {isSevereDrift
                ? 'Nilai medan bumi bergeser dari kalibrasi awal. Pengukuran target berisiko tidak akurat.'
                : 'Terdeteksi fluktuasi medan magnet tinggi (interferensi kabel listrik/mineral tanah). Target kecil bisa tersamarkan.'}
            </p>
          </div>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors shrink-0"
            title="Sembunyikan peringatan"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Quick Action bar */}
      <div className="flex items-center justify-end gap-2 mt-2.5 pt-2 border-t border-white/10 text-xs font-mono">
        <button
          type="button"
          onClick={onOpenModal}
          className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold transition-all"
        >
          <span>Monitor & Grafik</span>
          <ChevronRight className="w-3 h-3" />
        </button>

        <button
          type="button"
          onClick={onTareZero}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl font-bold text-white shadow-md active:scale-95 transition-all ${
            isSevereDrift
              ? 'bg-orange-600 hover:bg-orange-500 shadow-orange-950/60'
              : 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/60'
          }`}
        >
          <RefreshCw className="w-3 h-3" />
          <span>Tara Baseline Ulang</span>
        </button>
      </div>
    </div>
  );
};
