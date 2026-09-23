import React, { useState } from 'react';
import { MetalFinding, GPSLocation, GeminiFindingAnalysis, MetalCategory } from '../types/detector';
import { geminiService } from '../services/geminiService';
import {
  Sparkles,
  X,
  Loader2,
  Calendar,
  Layers,
  MapPin,
  ShieldAlert,
  CheckCircle2,
  HelpCircle,
  Clock,
  Compass,
  FileText,
  AlertTriangle,
  RotateCw,
  Award,
  ArrowRight,
} from 'lucide-react';

interface GeminiAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  finding: MetalFinding | null;
  userLocation: GPSLocation | null;
  onApplyAnalysis: (
    findingId: string,
    analysis: GeminiFindingAnalysis,
    updatedName?: string,
    updatedCategory?: MetalCategory,
    updatedNote?: string
  ) => void;
}

export const GeminiAnalysisModal: React.FC<GeminiAnalysisModalProps> = ({
  isOpen,
  onClose,
  finding,
  userLocation,
  onApplyAnalysis,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<GeminiFindingAnalysis | null>(null);
  const [appliedSuccess, setAppliedSuccess] = useState<boolean>(false);

  // If finding has prior cached analysis, load it
  React.useEffect(() => {
    if (finding?.aiAnalysis) {
      setAnalysis(finding.aiAnalysis);
    } else {
      setAnalysis(null);
    }
    setError(null);
    setAppliedSuccess(false);
  }, [finding]);

  if (!isOpen || !finding) return null;

  const handleStartAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await geminiService.analyzeFinding(finding, userLocation);
      setAnalysis(res);
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : 'Terjadi kendala saat menganalisis temuan dengan Gemini API'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleApplyToFinding = () => {
    if (!analysis) return;
    const appendNote = `[Analisis AI Gemini: ${analysis.artifactName} (${analysis.historicalEra}) - ${analysis.historicalContext}]`;
    const finalNote = finding.note ? `${finding.note}\n\n${appendNote}` : appendNote;

    onApplyAnalysis(
      finding.id,
      analysis,
      analysis.artifactName,
      analysis.suggestedCategory,
      finalNote
    );
    setAppliedSuccess(true);
    setTimeout(() => {
      setAppliedSuccess(false);
    }, 3500);
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shadow-inner">
              <Sparkles className="w-5 h-5 animate-pulse text-indigo-400" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <span>Analisis Artefak & Sejarah Gemini</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  AI Arkeologi
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Klasifikasi artefak berbasis lokasi geospasial, era sejarah, & fluks magnetik
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
          {/* Finding summary card */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 space-y-2 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>{finding.name}</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                {finding.category}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-slate-800/80">
              <div>
                <span className="text-[10px] text-slate-500 block">Fluks Magnetik</span>
                <span className="font-bold text-amber-400">{finding.magneticStrength.toFixed(1)} µT</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Net Anomali</span>
                <span className="font-bold text-cyan-400">+{finding.netStrength.toFixed(1)} µT</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Kedalaman</span>
                <span className="font-bold text-slate-200">~{finding.depthEstimateCm} cm</span>
              </div>
            </div>

            {finding.note && (
              <div className="text-[11px] text-slate-400 bg-slate-900/90 p-2 rounded-xl border border-slate-800/80">
                <span className="text-slate-500 font-semibold block text-[10px]">Catatan Lapangan:</span>
                "{finding.note}"
              </div>
            )}
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-2xl flex items-start gap-2.5 text-xs text-red-300 font-mono">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Gagal Menganalisis:</span> {error}
              </div>
            </div>
          )}

          {/* Success Banner */}
          {appliedSuccess && (
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl flex items-center gap-2 text-xs text-emerald-300 font-mono animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Data rekomendasi artefak berhasil diperbarui ke catatan temuan!</span>
            </div>
          )}

          {/* Analysis Result or Call to Action */}
          {!analysis && !loading && (
            <div className="text-center py-6 px-4 bg-slate-950/40 border border-dashed border-indigo-500/30 rounded-2xl space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-sm text-slate-200">
                  Mulai Analisis Kecerdasan Buatan Gemini
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Gemini akan memeriksa respon fluks magnetik, koordinat geografis wilayah, kedalaman galian, serta catatan lapangan untuk mengidentifikasi kemungkinan jenis artefak, asal era sejarah, dan nilai arkeologisnya.
                </p>
              </div>

              <button
                type="button"
                onClick={handleStartAnalysis}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-mono font-bold text-xs shadow-lg shadow-indigo-950/50 active:scale-95 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>Analisis Temuan Ini Sekarang</span>
              </button>
            </div>
          )}

          {loading && (
            <div className="text-center py-10 px-4 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mx-auto" />
              <div className="space-y-1">
                <h4 className="font-mono font-bold text-sm text-slate-200">
                  Gemini Sedang Mengkaji Data Geofisika & Sejarah...
                </h4>
                <p className="text-xs text-slate-400 font-mono">
                  Menghubungkan fluks {finding.magneticStrength.toFixed(1)} µT dengan catatan sejarah geospasial
                </p>
              </div>
            </div>
          )}

          {analysis && !loading && (
            <div className="space-y-3 animate-in fade-in duration-300">
              {/* Primary Artifact Classification Card */}
              <div className="bg-gradient-to-br from-indigo-950/60 to-purple-950/40 border border-indigo-500/50 rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono text-indigo-300 uppercase tracking-wider block">
                      Kemungkinan Objek / Artefak Terdeteksi:
                    </span>
                    <h3 className="text-base font-bold text-white mt-0.5">
                      {analysis.artifactName}
                    </h3>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-mono text-slate-400 block">Tingkat Keyakinan</span>
                    <div className="flex items-center gap-1 font-mono font-bold text-emerald-400 text-sm">
                      <Award className="w-4 h-4" />
                      <span>{analysis.confidenceScore}%</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-indigo-500/30">
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      <span>Estimasi Era Historis:</span>
                    </span>
                    <span className="font-bold text-cyan-300 text-[11px] mt-0.5 block">
                      {analysis.historicalEra}
                    </span>
                  </div>

                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                      <Award className="w-3 h-3 text-amber-400" />
                      <span>Signifikansi Budaya:</span>
                    </span>
                    <span
                      className={`font-bold text-[11px] mt-0.5 block ${
                        analysis.culturalSignificance.toLowerCase() === 'tinggi'
                          ? 'text-amber-400'
                          : 'text-slate-200'
                      }`}
                    >
                      {analysis.culturalSignificance}
                    </span>
                  </div>
                </div>
              </div>

              {/* Material & Magnetic Response */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 space-y-1.5 text-xs font-mono">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Karakteristik Material & Fluks Magnetik:</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {analysis.materialAnalysis}
                </p>
              </div>

              {/* Historical Geospatial Context */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 space-y-1.5 text-xs font-mono">
                <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-[11px]">
                  <Compass className="w-3.5 h-3.5" />
                  <span>Konteks Geografis & Sejarah Wilayah:</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {analysis.historicalContext}
                </p>
              </div>

              {/* Excavation Guidance & Preservation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 space-y-1">
                  <span className="text-indigo-400 font-bold text-[11px] flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" />
                    <span>Panduan Penggalian:</span>
                  </span>
                  <p className="text-slate-300 text-[10px] leading-relaxed">
                    {analysis.excavationAdvice}
                  </p>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 space-y-1">
                  <span className="text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Perawatan & Patina:</span>
                  </span>
                  <p className="text-slate-300 text-[10px] leading-relaxed">
                    {analysis.conservationTip}
                  </p>
                </div>
              </div>

              {/* Apply / Update Actions */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleApplyToFinding}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono font-bold text-xs shadow-lg shadow-emerald-950/40 active:scale-98 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Terapkan Rekomendasi ke Temuan</span>
                </button>

                <button
                  type="button"
                  onClick={handleStartAnalysis}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono text-xs active:scale-98 transition-all"
                  title="Analisis Ulang dengan Gemini"
                >
                  <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Analisis Ulang</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Didukung oleh Gemini 3.8 Flash Geofisika & Arkeologi</span>
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
