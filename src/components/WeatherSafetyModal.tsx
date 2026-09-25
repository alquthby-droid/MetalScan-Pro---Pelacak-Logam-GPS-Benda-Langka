import React from 'react';
import {
  Cloud,
  Sun,
  CloudRain,
  Zap,
  Wind,
  Droplets,
  Thermometer,
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Compass,
  RefreshCw,
  X,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { WeatherCondition } from '../types/detector';

interface WeatherSafetyModalProps {
  isOpen: boolean;
  onClose: () => void;
  weather: WeatherCondition | null;
  onRefresh: () => void;
  isLoading?: boolean;
}

export const WeatherSafetyModal: React.FC<WeatherSafetyModalProps> = ({
  isOpen,
  onClose,
  weather,
  onRefresh,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const safety = weather?.safetyAssessment;
  const isDanger = safety?.level === 'danger';
  const isCaution = safety?.level === 'caution';
  const isSafe = safety?.level === 'safe';

  return (
    <div className="fixed inset-0 z-[650] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 text-lg">
              {weather?.weatherIcon || '🌤️'}
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <span>Kondisi Cuaca & Keselamatan Lapangan</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded font-mono uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  REAL-TIME
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                {weather?.timezone || 'Lokasi Pengguna'} • Diperbarui:{' '}
                {weather?.lastUpdated
                  ? new Date(weather.lastUpdated).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Baru saja'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 transition-all disabled:opacity-50"
              title="Perbarui Cuaca Lapangan"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 overflow-y-auto space-y-4">
          {/* Main Weather Hero Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-4xl font-extrabold font-mono text-slate-100 tracking-tight">
                {weather?.temperatureC ?? 28}°C
              </div>
              <div className="text-xs text-slate-300 font-medium mt-1 flex items-center gap-2">
                <span>{weather?.weatherDescription || 'Cuaca Lapangan Stabil'}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400 font-mono">
                  Terasa: {weather?.apparentTempC ?? 30}°C
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-2">
                <span>{weather?.isDay ? '☀️ Siang Hari' : '🌙 Malam Hari (Mode Gelap)'}</span>
                <span>•</span>
                <span>Sunset: {weather?.sunset || '18:04'}</span>
              </div>
            </div>

            <div className="text-5xl select-none animate-pulse">
              {weather?.weatherIcon || '🌤️'}
            </div>
          </div>

          {/* Excavation Safety Assessment Verdict Card */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              isDanger
                ? 'bg-rose-950/40 border-rose-500/80 ring-1 ring-rose-500/50'
                : isCaution
                ? 'bg-amber-950/35 border-amber-500/70 ring-1 ring-amber-500/40'
                : 'bg-emerald-950/30 border-emerald-500/60 ring-1 ring-emerald-500/30'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                  isDanger
                    ? 'bg-rose-500/20 border-rose-400 text-rose-300'
                    : isCaution
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                }`}
              >
                {isDanger ? (
                  <ShieldAlert className="w-5 h-5 text-rose-400 animate-bounce" />
                ) : isCaution ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                ) : (
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                      isDanger
                        ? 'bg-rose-500/25 text-rose-300 border-rose-400 animate-pulse'
                        : isCaution
                        ? 'bg-amber-500/25 text-amber-300 border-amber-400'
                        : 'bg-emerald-500/25 text-emerald-300 border-emerald-400'
                    }`}
                  >
                    {isDanger
                      ? 'BAHAYA EKSTRIM'
                      : isCaution
                      ? 'WASPADA PENGGALIAN'
                      : 'AMAN UNTUK MENGGALI'}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    Skor: {safety?.score ?? 90}/100
                  </span>
                </div>

                <h4 className="font-bold text-sm text-slate-100">
                  {safety?.title || 'Kondisi Cuaca Kondusif'}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  {safety?.advice ||
                    'Cuaca stabil. Sangat ideal untuk menyapu koil detektor dan melakukan penggalian sasaran logam.'}
                </p>
              </div>
            </div>

            {/* Lightning warning highlight */}
            {safety?.isLightningRisk && (
              <div className="mt-3 p-3 rounded-xl bg-rose-900/40 border border-rose-500/60 flex items-center gap-2 text-rose-200 text-xs font-mono">
                <Zap className="w-4 h-4 text-amber-300 shrink-0 animate-ping" />
                <span>
                  <strong>PERINGATAN PETIR:</strong> Batang aluminium/karbon detektor logam dan sekop baja adalah konduktor petir yang sangat berbahaya di tanah lapang.
                </span>
              </div>
            )}
          </div>

          {/* Meteorological Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
                <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                <span>KELEMBAPAN</span>
              </div>
              <div className="text-base font-bold text-slate-100">
                {weather?.humidityPercent ?? 70}%
              </div>
              <div className="text-[10px] text-slate-500">
                {(weather?.humidityPercent ?? 70) > 80 ? 'Tanah Lembap' : 'Stabil'}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
                <Wind className="w-3.5 h-3.5 text-emerald-400" />
                <span>KECEPATAN ANGIN</span>
              </div>
              <div className="text-base font-bold text-slate-100">
                {weather?.windSpeedKmH ?? 10} km/j
              </div>
              <div className="text-[10px] text-slate-500">
                Gust: {weather?.windGustsKmH ?? 14} km/j
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
                <CloudRain className="w-3.5 h-3.5 text-indigo-400" />
                <span>CURAH HUJAN</span>
              </div>
              <div className="text-base font-bold text-slate-100">
                {weather?.precipitationMm ?? 0} mm
              </div>
              <div className="text-[10px] text-slate-500">
                Peluang: {weather?.precipitationProbability ?? 10}%
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>MATAHARI</span>
              </div>
              <div className="text-base font-bold text-slate-100">
                {weather?.sunset || '18:04'}
              </div>
              <div className="text-[10px] text-slate-500">
                Terbit: {weather?.sunrise || '05:58'}
              </div>
            </div>
          </div>

          {/* Tactical Field Excavation Guide Card */}
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs font-mono text-slate-300">
            <div className="font-bold text-slate-200 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-cyan-400" />
              <span>Panduan Penggalian Lapangan Berdasarkan Cuaca:</span>
            </div>
            <ul className="space-y-1.5 text-[11px] text-slate-400 list-disc list-inside">
              <li>
                <strong className="text-slate-200">Tanah Lembap/Basah:</strong> Meningkatkan konduktivitas tanah, sehingga respon magnetik terhadap logam mulia (emas/perak) bisa terbiaskan oleh mineral tanah. Kalibrasi ulang tombol Tare/Zero.
              </li>
              <li>
                <strong className="text-slate-200">Kondisi Malam Hari:</strong> Mode gelap otomatis aktif untuk menjaga adaptasi mata dalam kegelapan dan menghemat baterai HP saat survei malam.
              </li>
              <li>
                <strong className="text-slate-200">Keamanan Listrik/Petir:</strong> Jika suara guntur terdengar atau awan cumulonimbus pekat muncul, segera letakkan detektor di tanah dan jauhi area terbuka.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Open-Meteo Global Radar API</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold transition-all shadow-md shadow-cyan-950/40"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
