import React, { useState } from 'react';
import { Layers, ArrowDown, Shovel, Info, X, Check, Clock, AlertCircle } from 'lucide-react';

interface SoilDepthIndicatorProps {
  depthCm: number;
  itemName?: string;
  category?: string;
  compact?: boolean;
}

export interface DepthTier {
  id: 'surface' | 'medium' | 'deep' | 'extreme';
  label: string;
  sublabel: string;
  stratumName: string;
  rangeText: string;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  iconBg: string;
  activeTiers: number; // 1 to 4
  recommendedTool: string;
  digDifficulty: 'Mudah' | 'Sedang' | 'Keras' | 'Sangat Keras';
  estimatedTime: string;
  advice: string;
}

export function getDepthTier(depthCm: number): DepthTier {
  if (depthCm <= 10) {
    return {
      id: 'surface',
      label: 'Dangkal',
      sublabel: 'Lapisan Humus / Tanah Permukaan',
      stratumName: 'Topsoil (0-10 cm)',
      rangeText: '0 - 10 cm',
      color: '#10b981',
      bgColor: 'bg-emerald-500/15',
      borderColor: 'border-emerald-500/40',
      textColor: 'text-emerald-400',
      iconBg: 'bg-emerald-950/60',
      activeTiers: 1,
      recommendedTool: 'Sekop Tangan Kecil (Hand Trowel) & Pinpointer',
      digDifficulty: 'Mudah',
      estimatedTime: '1 - 3 Menit',
      advice: 'Cukup buat sayatan tapal kuda kecil pada rumput untuk mengangkat target tanpa merusak area.',
    };
  } else if (depthCm <= 20) {
    return {
      id: 'medium',
      label: 'Sedang',
      sublabel: 'Lapisan Tanah Subsoil',
      stratumName: 'Subsoil (11-20 cm)',
      rangeText: '11 - 20 cm',
      color: '#f59e0b',
      bgColor: 'bg-amber-500/15',
      borderColor: 'border-amber-500/40',
      textColor: 'text-amber-400',
      iconBg: 'bg-amber-950/60',
      activeTiers: 2,
      recommendedTool: 'Sekop Taman Bergerigi (Serrated Digger)',
      digDifficulty: 'Sedang',
      estimatedTime: '3 - 7 Menit',
      advice: 'Gali lubang kerucut selebar 15cm. Periksa berkala dinding lubang dengan koil sebelum menggali lebih dalam.',
    };
  } else if (depthCm <= 35) {
    return {
      id: 'deep',
      label: 'Dalam',
      sublabel: 'Lapisan Tanah Keras / Berkerikil',
      stratumName: 'Hardpan / Gravel (21-35 cm)',
      rangeText: '21 - 35 cm',
      color: '#f97316',
      bgColor: 'bg-orange-500/15',
      borderColor: 'border-orange-500/40',
      textColor: 'text-orange-400',
      iconBg: 'bg-orange-950/60',
      activeTiers: 3,
      recommendedTool: 'Cangkul Mini / Sekop Lapangan T-Handle',
      digDifficulty: 'Keras',
      estimatedTime: '8 - 15 Menit',
      advice: 'Lapisan tanah padat. Keluarkan tanah galian ke alas terpal untuk memudahkan pencarian titik sasaran.',
    };
  } else {
    return {
      id: 'extreme',
      label: 'Sangat Dalam',
      sublabel: 'Lapisan Batuan Dasar (Bedrock)',
      stratumName: 'Deep Bedrock (>35 cm)',
      rangeText: '> 35 cm',
      color: '#c084fc',
      bgColor: 'bg-purple-500/15',
      borderColor: 'border-purple-500/40',
      textColor: 'text-purple-400',
      iconBg: 'bg-purple-950/60',
      activeTiers: 4,
      recommendedTool: 'Linggis Mini, Sekop Panjang & Koil Pencari Besar',
      digDifficulty: 'Sangat Keras',
      estimatedTime: '15 - 25 Menit',
      advice: 'Target artefak berada jauh di bawah horizon tanah. Butuh kehati-hatian ekstra agar mata cangkul tidak menggores artefak kuno.',
    };
  }
}

export const SoilDepthIndicator: React.FC<SoilDepthIndicatorProps> = ({
  depthCm,
  itemName = 'Temuan Logam',
  category = 'all',
  compact = false,
}) => {
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const tier = getDepthTier(depthCm);

  // Maximum visual scale normalized up to 45 cm
  const maxScaleCm = 45;
  const progressPercent = Math.min(100, Math.max(8, (depthCm / maxScaleCm) * 100));

  return (
    <>
      <div
        onClick={() => setShowDetailModal(true)}
        className={`group inline-flex items-center gap-2 p-1.5 rounded-xl border cursor-pointer transition-all duration-200 hover:scale-[1.02] ${tier.bgColor} ${tier.borderColor} select-none`}
        title={`Estimasi Kedalaman: ~${depthCm} cm (${tier.label} - ${tier.sublabel}). Klik untuk rincian stratigrafi tanah.`}
      >
        {/* Custom Visual Stratum Ground Layer Icon */}
        <div className={`relative w-7 h-7 rounded-lg ${tier.iconBg} border ${tier.borderColor} flex items-center justify-center overflow-hidden shrink-0 shadow-sm`}>
          {/* Surface line (grass/ground top) */}
          <div className="absolute top-1 left-1 right-1 h-0.5 bg-emerald-400 rounded-full" />
          
          {/* Stratum soil layers: 4 vertical levels */}
          <div className="absolute bottom-1 left-1.5 right-1.5 flex flex-col-reverse gap-0.5">
            {[1, 2, 3, 4].map((levelIndex) => {
              const isActive = levelIndex <= tier.activeTiers;
              return (
                <div
                  key={levelIndex}
                  className={`h-0.5 rounded-full transition-colors ${
                    isActive ? 'bg-amber-300' : 'bg-slate-700/60'
                  }`}
                  style={{
                    backgroundColor: isActive ? tier.color : undefined,
                  }}
                />
              );
            })}
          </div>

          {/* Depth arrow marker */}
          <ArrowDown className={`w-3.5 h-3.5 ${tier.textColor} animate-pulse`} />
        </div>

        {/* Text and Depth Bar */}
        <div className="flex flex-col min-w-0 pr-1">
          <div className="flex items-center gap-1.5 text-[10px] font-mono leading-none">
            <span className={`font-bold ${tier.textColor}`}>~{depthCm} cm</span>
            <span className="text-slate-400 text-[9px] uppercase tracking-wider font-semibold">
              ({tier.label})
            </span>
          </div>

          {/* Visual Mini Progress Notch */}
          <div className="w-16 sm:w-20 h-1.5 bg-slate-900/90 rounded-full overflow-hidden border border-slate-700/60 mt-1 flex">
            <div
              className="h-full rounded-full transition-all duration-500 shadow-sm"
              style={{
                width: `${progressPercent}%`,
                backgroundColor: tier.color,
              }}
            />
          </div>
        </div>

        <Info className="w-3 h-3 text-slate-400 opacity-60 group-hover:opacity-100 group-hover:text-cyan-400 transition-all ml-0.5 shrink-0" />
      </div>

      {/* Modal Detail Profil Lapisan Tanah & Rekomendasi Galian */}
      {showDetailModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowDetailModal(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-5 shadow-2xl relative flex flex-col gap-4 text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg border font-mono"
                  style={{
                    backgroundColor: tier.bgColor,
                    borderColor: tier.color,
                    color: tier.color,
                  }}
                >
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                    <span>Estimasi Lapisan Kedalaman Tanah</span>
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400">
                    Target: <strong className="text-white">{itemName}</strong> (~{depthCm} cm)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Visual Cross-Section Soil Profile */}
            <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-850 pb-2">
                <span className="flex items-center gap-1">
                  <span>Permukaan Tanah (0 cm)</span>
                </span>
                <span className="text-cyan-400 font-bold">Titik Benda: ~{depthCm} cm</span>
              </div>

              {/* Stratigraphy Graphic */}
              <div className="relative border border-slate-800 rounded-xl overflow-hidden text-[10px] font-mono flex flex-col">
                {/* Layer 1: Topsoil */}
                <div
                  className={`p-2 border-b border-slate-800/80 flex items-center justify-between transition-all ${
                    tier.id === 'surface'
                      ? 'bg-emerald-950/60 text-emerald-300 font-semibold'
                      : 'bg-stone-900/40 text-stone-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span>Lapisan Humus (Topsoil)</span>
                  </div>
                  <span>0 - 10 cm</span>
                </div>

                {/* Layer 2: Subsoil */}
                <div
                  className={`p-2 border-b border-slate-800/80 flex items-center justify-between transition-all ${
                    tier.id === 'medium'
                      ? 'bg-amber-950/60 text-amber-300 font-semibold'
                      : 'bg-stone-900/30 text-stone-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                    <span>Lapisan Tanah Liat/Subsoil</span>
                  </div>
                  <span>11 - 20 cm</span>
                </div>

                {/* Layer 3: Hardpan */}
                <div
                  className={`p-2 border-b border-slate-800/80 flex items-center justify-between transition-all ${
                    tier.id === 'deep'
                      ? 'bg-orange-950/60 text-orange-300 font-semibold'
                      : 'bg-stone-900/20 text-stone-500'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                    <span>Lapisan Padat & Kerikil (Hardpan)</span>
                  </div>
                  <span>21 - 35 cm</span>
                </div>

                {/* Layer 4: Bedrock */}
                <div
                  className={`p-2 flex items-center justify-between transition-all ${
                    tier.id === 'extreme'
                      ? 'bg-purple-950/60 text-purple-300 font-semibold'
                      : 'bg-stone-950 text-stone-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                    <span>Lapisan Batuan Dasar (Bedrock)</span>
                  </div>
                  <span>&gt; 35 cm</span>
                </div>

                {/* Object buried marker overlay indicator */}
                <div
                  className="absolute left-24 right-4 py-0.5 px-2 rounded-md border text-[9px] font-bold font-mono shadow-md flex items-center gap-1.5 pointer-events-none transition-all"
                  style={{
                    backgroundColor: tier.color,
                    color: '#0f172a',
                    top: `${Math.min(78, Math.max(12, (depthCm / 45) * 80))}%`,
                    borderColor: '#ffffff',
                  }}
                >
                  <span>🎯</span>
                  <span>Benda Logam (~{depthCm} cm)</span>
                </div>
              </div>
            </div>

            {/* Tactical Field Advice */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  Estimasi Waktu Gali
                </span>
                <span className="text-sm font-bold text-slate-200 mt-1 block">
                  {tier.estimatedTime}
                </span>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-amber-400" />
                  Tingkat Kepadatan
                </span>
                <span className="text-sm font-bold text-amber-400 mt-1 block">
                  {tier.digDifficulty}
                </span>
              </div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 flex flex-col gap-1.5 text-xs font-mono">
              <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                <Shovel className="w-3.5 h-3.5 text-emerald-400" />
                Alat Rekomendasi
              </span>
              <span className="text-slate-200 font-semibold">{tier.recommendedTool}</span>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed bg-slate-900/60 p-2 rounded-xl border border-slate-800/80">
                💡 <strong>Saran Lapangan:</strong> {tier.advice}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowDetailModal(false)}
              className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold transition-all shadow-md active:scale-95"
            >
              Tutup Rincian
            </button>
          </div>
        </div>
      )}
    </>
  );
};
