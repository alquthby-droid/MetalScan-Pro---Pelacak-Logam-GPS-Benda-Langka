import React from 'react';
import { WeatherCondition } from '../types/detector';
import { ShieldCheck, AlertTriangle, ShieldAlert, Cloud } from 'lucide-react';

interface WeatherBadgeHeaderProps {
  weather: WeatherCondition | null;
  onOpenWeatherModal: () => void;
}

export const WeatherBadgeHeader: React.FC<WeatherBadgeHeaderProps> = ({
  weather,
  onOpenWeatherModal,
}) => {
  const safety = weather?.safetyAssessment;
  const isDanger = safety?.level === 'danger';
  const isCaution = safety?.level === 'caution';

  return (
    <button
      type="button"
      onClick={onOpenWeatherModal}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-mono transition-all active:scale-95 shadow-sm ${
        isDanger
          ? 'bg-rose-500/25 text-rose-300 border-rose-500/80 animate-pulse ring-1 ring-rose-500/50'
          : isCaution
          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30'
          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700/80 hover:border-cyan-500/50'
      }`}
      title={`Cuaca: ${weather?.weatherDescription || 'Memuat...'} (${weather?.temperatureC ?? 28}°C) | Status Penggalian: ${
        safety?.title || 'Klik untuk rincian keselamatan lapangan'
      }`}
    >
      <span className="text-sm leading-none">{weather?.weatherIcon || '🌤️'}</span>
      <span className="font-bold text-slate-100 hidden xxs:inline">
        {weather?.temperatureC ?? 28}°C
      </span>

      <span
        className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold flex items-center gap-1 ${
          isDanger
            ? 'bg-rose-500 text-black'
            : isCaution
            ? 'bg-amber-400 text-black'
            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
        }`}
      >
        {isDanger ? (
          <>
            <ShieldAlert className="w-2.5 h-2.5" />
            <span>BAHAYA</span>
          </>
        ) : isCaution ? (
          <>
            <AlertTriangle className="w-2.5 h-2.5" />
            <span>WASPADA</span>
          </>
        ) : (
          <>
            <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
            <span>AMAN</span>
          </>
        )}
      </span>
    </button>
  );
};
