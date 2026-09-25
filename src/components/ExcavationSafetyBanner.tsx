import React, { useState } from 'react';
import { WeatherCondition } from '../types/detector';
import { Zap, AlertTriangle, X, ShieldAlert, ChevronRight } from 'lucide-react';

interface ExcavationSafetyBannerProps {
  weather: WeatherCondition | null;
  onOpenWeatherModal: () => void;
}

export const ExcavationSafetyBanner: React.FC<ExcavationSafetyBannerProps> = ({
  weather,
  onOpenWeatherModal,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);

  if (!weather || isDismissed) return null;

  const safety = weather.safetyAssessment;
  if (!safety || safety.level === 'safe') return null;

  const isDanger = safety.level === 'danger';

  return (
    <div
      className={`mx-3.5 my-2 p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 shadow-lg ${
        isDanger
          ? 'bg-rose-950/80 border-rose-500/80 text-rose-100 ring-1 ring-rose-500/60 animate-pulse'
          : 'bg-amber-950/70 border-amber-500/70 text-amber-100 ring-1 ring-amber-500/40'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
            isDanger
              ? 'bg-rose-500/30 border-rose-400 text-rose-300'
              : 'bg-amber-500/30 border-amber-400 text-amber-300'
          }`}
        >
          {isDanger ? (
            <Zap className="w-4 h-4 text-amber-300 animate-bounce" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[9px] font-mono font-black uppercase px-1.5 py-0.2 rounded ${
                isDanger ? 'bg-rose-500 text-black' : 'bg-amber-400 text-black'
              }`}
            >
              {isDanger ? 'PERINGATAN BAHAYA' : 'WASPADA CUACA'}
            </span>
            <span className="text-xs font-bold truncate">
              {safety.title}
            </span>
          </div>
          <p className="text-[11px] opacity-90 truncate font-mono mt-0.5">
            {safety.advice}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onOpenWeatherModal}
          className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold border transition-all flex items-center gap-1 ${
            isDanger
              ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400'
              : 'bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border-amber-400'
          }`}
        >
          <span>Detail</span>
          <ChevronRight className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="p-1 rounded-lg text-slate-400 hover:text-white"
          title="Tutup Peringatan"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
