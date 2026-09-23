import React, { useState } from 'react';
import {
  MetalFinding,
  GPSLocation,
  GeminiExcavationHotspot,
  GeminiHotspotsResult,
} from '../types/detector';
import { geminiService } from '../services/geminiService';
import {
  Target,
  Sparkles,
  X,
  Loader2,
  MapPin,
  Compass,
  AlertCircle,
  Navigation,
  CheckCircle2,
  ExternalLink,
  Layers,
  Sliders,
  TrendingUp,
  RotateCw,
} from 'lucide-react';

interface GeminiHotspotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  findings: MetalFinding[];
  userLocation: GPSLocation | null;
  onPinHotspotToFindings: (hotspot: GeminiExcavationHotspot) => void;
  onNavigateToMap: () => void;
}

export const GeminiHotspotsModal: React.FC<GeminiHotspotsModalProps> = ({
  isOpen,
  onClose,
  findings,
  userLocation,
  onPinHotspotToFindings,
  onNavigateToMap,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeminiHotspotsResult | null>(null);
  const [pinnedHotspots, setPinnedHotspots] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const handleCalculateHotspots = async () => {
    if (findings.length === 0) {
      setError('Belum ada data temuan historis. Lakukan beberapa pemindaian atau tambahkan titik temuan terlebih dahulu.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await geminiService.suggestExcavationHotspots(findings, userLocation);
      setResult(data);
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : 'Terjadi kendala saat menghitung hotspot penggalian dengan Gemini API'
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePin = (hotspot: GeminiExcavationHotspot) => {
    onPinHotspotToFindings(hotspot);
    setPinnedHotspots((prev) => new Set([...prev, hotspot.name]));
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Target className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <span>Prediksi Hotspot Penggalian AI</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                  Gemini Spasial
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Saran lokasi penggalian berikutnya berdasarkan analisis klaster & vektor magnetik historis
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Quick dataset status */}
          <div className="flex items-center justify-between bg-slate-950/70 p-3 rounded-2xl border border-slate-800 text-xs font-mono">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-400" />
              <span className="text-slate-300">
                Dataset Historis: <strong className="text-white">{findings.length} Titik Temuan</strong>
              </span>
            </div>
            {userLocation && (
              <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                <Navigation className="w-3 h-3" />
                <span>GPS Surveyor Terkunci</span>
              </span>
            )}
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-2xl flex items-start gap-2.5 text-xs text-red-300 font-mono">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Perhatian:</span> {error}
              </div>
            </div>
          )}

          {/* Initial Call To Action */}
          {!result && !loading && (
            <div className="text-center py-8 px-4 bg-slate-950/40 border border-dashed border-amber-500/30 rounded-2xl space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Target className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-sm text-slate-200">
                  Hitung Hotspot Penggalian Berikutnya dengan Gemini
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  Gemini akan menganalisis persebaran anomali magnetik (vektor fluks µT), korelasi temuan besi vs logam mulia, dan jalur geospasial untuk memprediksi 2–3 titik koordinat penggalian berikutnya yang paling menjanjikan.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCalculateHotspots}
                disabled={findings.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-mono font-bold text-xs shadow-lg shadow-amber-950/50 active:scale-95 transition-all disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>Analisis Hotspot Geospasial Sekarang</span>
              </button>
            </div>
          )}

          {/* Loading Indicator */}
          {loading && (
            <div className="text-center py-10 px-4 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400 mx-auto" />
              <div className="space-y-1">
                <h4 className="font-mono font-bold text-sm text-slate-200">
                  Gemini Sedang Mengkalkulasi Vektor Spasial & Gradien Fluks...
                </h4>
                <p className="text-xs text-slate-400 font-mono">
                  Menganalisis {findings.length} koordinat historis terhadap pola dispersi artefak
                </p>
              </div>
            </div>
          )}

          {/* Results View */}
          {result && !loading && (
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Cluster Analysis Card */}
              <div className="bg-slate-950/80 border border-amber-500/40 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono text-amber-400 font-bold">
                  <TrendingUp className="w-4 h-4" />
                  <span>Analisis Klaster Pola Sebaran Temuan:</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-mono">
                  {result.clusterAnalysis}
                </p>
                <div className="text-[11px] text-cyan-300 bg-cyan-950/30 p-2.5 rounded-xl border border-cyan-800/40 font-mono">
                  <strong className="text-cyan-400">Strategi Lapangan:</strong> {result.recommendationSummary}
                </div>
              </div>

              {/* Recommended Hotspots List */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Rekomendasi Titik Penggalian Berikutnya:</span>
                  <span className="text-amber-400 font-bold">{result.hotspots.length} Zona Terdeteksi</span>
                </h4>

                {result.hotspots.map((hotspot, idx) => {
                  const isPinned = pinnedHotspots.has(hotspot.name);
                  const gmapsUrl = `https://www.google.com/maps?q=${hotspot.lat},${hotspot.lng}`;

                  return (
                    <div
                      key={idx}
                      className="bg-slate-950/90 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-4 space-y-3 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-mono font-bold text-xs">
                            #{idx + 1}
                          </div>
                          <div>
                            <h5 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                              <span>{hotspot.name}</span>
                              <span
                                className={`text-[10px] font-mono px-2 py-0.2 rounded-full border ${
                                  hotspot.priority === 'TINGGI'
                                    ? 'bg-red-500/20 text-red-300 border-red-500/40 font-bold'
                                    : hotspot.priority === 'SEDANG'
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                    : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                }`}
                              >
                                Prioritas {hotspot.priority}
                              </span>
                            </h5>
                            <span className="text-xs text-amber-400/90 font-mono">
                              Sasaran: {hotspot.expectedTargetType}
                            </span>
                          </div>
                        </div>

                        <div className="text-right text-[11px] font-mono text-slate-400 shrink-0">
                          <div>Radius: ±{hotspot.radiusMeters}m</div>
                          <div className="text-slate-300 font-bold">Kedalaman: ~{hotspot.estimatedDepthCm}cm</div>
                        </div>
                      </div>

                      {/* Coordinates bar */}
                      <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Compass className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Koordinat:</span>
                        </span>
                        <span className="text-slate-200 font-bold">
                          {hotspot.lat.toFixed(6)}, {hotspot.lng.toFixed(6)}
                        </span>
                      </div>

                      {/* Rationale & Detector suggestions */}
                      <div className="space-y-1.5 text-xs font-mono">
                        <p className="text-slate-300 text-[11px] leading-relaxed">
                          <strong className="text-slate-400">Analisis Taktis:</strong> {hotspot.tacticalRationale}
                        </p>
                        <p className="text-cyan-300 text-[11px] leading-relaxed">
                          <strong className="text-cyan-400">Setelan Rekomendasi:</strong> {hotspot.suggestedDetectorSettings}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handlePin(hotspot)}
                          disabled={isPinned}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-mono text-xs font-semibold transition-all active:scale-95 ${
                            isPinned
                              ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {isPinned ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Telah Disematkan ke Peta</span>
                            </>
                          ) : (
                            <>
                              <MapPin className="w-3.5 h-3.5 text-amber-400" />
                              <span>Sematkan ke Peta & Log</span>
                            </>
                          )}
                        </button>

                        <a
                          href={gmapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono transition-all"
                          title="Navigasi Google Maps Langsung"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="hidden sm:inline">Navigasi</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleCalculateHotspots}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono"
                >
                  <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Hitung Ulang</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateToMap();
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold shadow-lg shadow-indigo-950/50"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Lihat di Peta GPS Lapangan →</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Prediksi Hotspot Berbasis Model Gemini 3.8 Flash</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
