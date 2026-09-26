import React, { useMemo } from 'react';
import { MetalFinding, MetalCategory } from '../types/detector';
import {
  X,
  ArrowLeftRight,
  Sparkles,
  MapPin,
  Layers,
  Zap,
  Target,
  Compass,
  Scale,
  Calendar,
  ChevronDown,
  Navigation,
  ExternalLink,
  ShieldCheck,
  Flame,
} from 'lucide-react';

interface ArtifactComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetA: MetalFinding | null;
  targetB: MetalFinding | null;
  allFindings: MetalFinding[];
  onSelectTargetA: (finding: MetalFinding) => void;
  onSelectTargetB: (finding: MetalFinding) => void;
  onNavigateToMap?: (finding: MetalFinding) => void;
}

// Haversine formula to compute distance in meters between 2 coordinates
function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

const CATEGORY_COLORS: Record<MetalCategory, { bg: string; text: string; border: string; label: string; symbol: string }> = {
  gold: {
    bg: 'bg-amber-500/20',
    text: 'text-amber-300',
    border: 'border-amber-400/50',
    label: 'Emas (Gold)',
    symbol: '★',
  },
  meteorite: {
    bg: 'bg-purple-500/20',
    text: 'text-purple-300',
    border: 'border-purple-400/50',
    label: 'Meteorit Kosmik',
    symbol: '☄',
  },
  silver: {
    bg: 'bg-cyan-500/20',
    text: 'text-cyan-300',
    border: 'border-cyan-400/50',
    label: 'Perak (Silver)',
    symbol: '◈',
  },
  bronze: {
    bg: 'bg-orange-500/20',
    text: 'text-orange-300',
    border: 'border-orange-400/50',
    label: 'Perunggu Kuno',
    symbol: '⬢',
  },
  iron: {
    bg: 'bg-slate-700/40',
    text: 'text-slate-300',
    border: 'border-slate-600',
    label: 'Besi (Ferrous)',
    symbol: '⛏',
  },
  unknown: {
    bg: 'bg-slate-800',
    text: 'text-slate-400',
    border: 'border-slate-700',
    label: 'Mineral Tanah',
    symbol: '●',
  },
};

export const ArtifactComparisonModal: React.FC<ArtifactComparisonModalProps> = ({
  isOpen,
  onClose,
  targetA,
  targetB,
  allFindings,
  onSelectTargetA,
  onSelectTargetB,
  onNavigateToMap,
}) => {
  if (!isOpen) return null;

  // Fallback defaults if null
  const itemA = targetA || allFindings[0] || null;
  const itemB = targetB || allFindings[1] || allFindings[0] || null;

  // Swap target A & B
  const handleSwap = () => {
    if (itemA && itemB) {
      const temp = itemA;
      onSelectTargetA(itemB);
      onSelectTargetB(temp);
    }
  };

  // Distance between Artifact A and B
  const distanceBetween = useMemo(() => {
    if (!itemA || !itemB) return null;
    return calculateDistanceMeters(itemA.lat, itemA.lng, itemB.lat, itemB.lng);
  }, [itemA, itemB]);

  // Differential Metrics
  const fluxDiff = itemA && itemB ? itemA.magneticStrength - itemB.magneticStrength : 0;
  const depthDiff = itemA && itemB ? itemA.depthEstimateCm - itemB.depthEstimateCm : 0;

  // Maximum values for comparative bar scaling
  const maxFlux = Math.max(itemA?.magneticStrength || 50, itemB?.magneticStrength || 50, 10);
  const maxDepth = Math.max(itemA?.depthEstimateCm || 20, itemB?.depthEstimateCm || 20, 40);

  // Density Score (Flux strength per cm of depth)
  const densityA = itemA ? (itemA.magneticStrength / Math.max(1, itemA.depthEstimateCm)).toFixed(1) : '0';
  const densityB = itemB ? (itemB.magneticStrength / Math.max(1, itemB.depthEstimateCm)).toFixed(1) : '0';

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-mono text-slate-100">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-md">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <span>Perbandingan Artefak Side-by-Side</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                  Komparatif 2 Target
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-sans">
                Bandingkan kekuatan sinyal fluks magnetik, kedalaman tanah, dan karakteristik dua artefak temuan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSwap}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl text-xs font-bold border border-slate-700 active:scale-95 transition-all"
              title="Tukar Posisi Artefak A dan B"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tukar</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Artifact Selectors Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Slot A Selector */}
            <div className="bg-slate-950/70 p-3 rounded-2xl border border-cyan-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  Target A (Pembanding Utama)
                </span>
                <span className="text-[10px] text-slate-500">{allFindings.length} pilihan</span>
              </div>
              <select
                value={itemA?.id || ''}
                onChange={(e) => {
                  const found = allFindings.find((f) => f.id === e.target.value);
                  if (found) onSelectTargetA(found);
                }}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-cyan-400 cursor-pointer"
              >
                {allFindings.map((f, idx) => (
                  <option key={f.id} value={f.id} className="bg-slate-900 text-slate-200">
                    #{idx + 1} {f.name} ({f.magneticStrength.toFixed(0)}µT • {f.category})
                  </option>
                ))}
              </select>
            </div>

            {/* Slot B Selector */}
            <div className="bg-slate-950/70 p-3 rounded-2xl border border-purple-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-purple-400 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  Target B (Objek Komparasi)
                </span>
                <span className="text-[10px] text-slate-500">{allFindings.length} pilihan</span>
              </div>
              <select
                value={itemB?.id || ''}
                onChange={(e) => {
                  const found = allFindings.find((f) => f.id === e.target.value);
                  if (found) onSelectTargetB(found);
                }}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-purple-400 cursor-pointer"
              >
                {allFindings.map((f, idx) => (
                  <option key={f.id} value={f.id} className="bg-slate-900 text-slate-200">
                    #{idx + 1} {f.name} ({f.magneticStrength.toFixed(0)}µT • {f.category})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Spatial Distance Between Targets Card */}
          {distanceBetween !== null && itemA && itemB && itemA.id !== itemB.id && (
            <div className="bg-gradient-to-r from-cyan-950/40 via-slate-950/80 to-purple-950/40 border border-slate-800 rounded-2xl p-2.5 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="text-slate-300">
                  Jarak Spasial Antar Sasaran di Lapangan:
                </span>
              </div>
              <span className="font-black text-white px-2.5 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300">
                {distanceBetween < 1000
                  ? `${distanceBetween.toFixed(1)} meter`
                  : `${(distanceBetween / 1000).toFixed(2)} km`}
              </span>
            </div>
          )}

          {/* Side-by-Side Hero Cards */}
          {itemA && itemB ? (
            <div className="space-y-4">
              {/* Artifact Identity Headers */}
              <div className="grid grid-cols-2 gap-3">
                {/* Card A */}
                {(() => {
                  const meta = CATEGORY_COLORS[itemA.category];
                  return (
                    <div className="bg-slate-950/80 border border-cyan-500/40 rounded-2xl p-3.5 space-y-2 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
                      <div className="flex items-start justify-between gap-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${meta.bg} ${meta.text} ${meta.border}`}>
                          {meta.symbol} {meta.label}
                        </span>
                        <span className="text-[9px] text-cyan-400 font-bold px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800">
                          SLOT A
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-white truncate" title={itemA.name}>
                        {itemA.name}
                      </h3>
                      <div className="text-[10px] text-slate-400 space-y-0.5">
                        {itemA.locationName && (
                          <div className="truncate text-cyan-300">📍 {itemA.locationName}</div>
                        )}
                        <div>GPS: {itemA.lat.toFixed(5)}, {itemA.lng.toFixed(5)}</div>
                      </div>
                    </div>
                  );
                })()}

                {/* Card B */}
                {(() => {
                  const meta = CATEGORY_COLORS[itemB.category];
                  return (
                    <div className="bg-slate-950/80 border border-purple-500/40 rounded-2xl p-3.5 space-y-2 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
                      <div className="flex items-start justify-between gap-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${meta.bg} ${meta.text} ${meta.border}`}>
                          {meta.symbol} {meta.label}
                        </span>
                        <span className="text-[9px] text-purple-400 font-bold px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-800">
                          SLOT B
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-white truncate" title={itemB.name}>
                        {itemB.name}
                      </h3>
                      <div className="text-[10px] text-slate-400 space-y-0.5">
                        {itemB.locationName && (
                          <div className="truncate text-purple-300">📍 {itemB.locationName}</div>
                        )}
                        <div>GPS: {itemB.lat.toFixed(5)}, {itemB.lng.toFixed(5)}</div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Detailed Metrics Comparison Table */}
              <div className="bg-slate-950/80 rounded-2xl border border-slate-800 overflow-hidden text-xs">
                {/* Metric 1: Total Magnetic Strength */}
                <div className="p-3 border-b border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span className="flex items-center gap-1 font-semibold text-slate-300">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>Kekuatan Fluks Magnetik Total (µT):</span>
                    </span>
                    <span className="text-[10px] font-bold text-amber-300">
                      {fluxDiff > 0
                        ? `Target A +${fluxDiff.toFixed(1)} µT lebih pekat`
                        : fluxDiff < 0
                        ? `Target B +${Math.abs(fluxDiff).toFixed(1)} µT lebih pekat`
                        : 'Kekuatan sinyal identik'}
                    </span>
                  </div>

                  {/* Side-by-Side Values */}
                  <div className="grid grid-cols-2 gap-3 items-center">
                    <div>
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-sm font-black text-cyan-300">
                          {itemA.magneticStrength.toFixed(1)} µT
                        </span>
                        <span className="text-[9px] text-slate-500">
                          Net: +{itemA.netStrength.toFixed(1)}
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all"
                          style={{ width: `${Math.max(8, (itemA.magneticStrength / maxFlux) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-sm font-black text-purple-300">
                          {itemB.magneticStrength.toFixed(1)} µT
                        </span>
                        <span className="text-[9px] text-slate-500">
                          Net: +{itemB.netStrength.toFixed(1)}
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all"
                          style={{ width: `${Math.max(8, (itemB.magneticStrength / maxFlux) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Metric 2: Estimated Soil Depth */}
                <div className="p-3 border-b border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span className="flex items-center gap-1 font-semibold text-slate-300">
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Estimasi Kedalaman Tanah (cm):</span>
                    </span>
                    <span className="text-[10px] font-bold text-emerald-300">
                      {depthDiff < 0
                        ? `Target A ~${Math.abs(depthDiff)} cm lebih dangkal (Lebih mudah digali)`
                        : depthDiff > 0
                        ? `Target B ~${depthDiff} cm lebih dangkal (Lebih mudah digali)`
                        : 'Kedalaman relatif sama'}
                    </span>
                  </div>

                  {/* Side-by-Side Depth Bars */}
                  <div className="grid grid-cols-2 gap-3 items-center">
                    <div>
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-sm font-black text-emerald-300">
                          ~{itemA.depthEstimateCm} cm
                        </span>
                        <span className="text-[9px] text-slate-500">
                          {itemA.depthEstimateCm <= 10 ? 'Lapisan Atas' : 'Subsoil'}
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all"
                          style={{ width: `${Math.max(8, (itemA.depthEstimateCm / maxDepth) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-sm font-black text-emerald-300">
                          ~{itemB.depthEstimateCm} cm
                        </span>
                        <span className="text-[9px] text-slate-500">
                          {itemB.depthEstimateCm <= 10 ? 'Lapisan Atas' : 'Subsoil'}
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-400 rounded-full transition-all"
                          style={{ width: `${Math.max(8, (itemB.depthEstimateCm / maxDepth) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Metric 3: Signal Concentration Index (µT/cm) */}
                <div className="p-3 border-b border-slate-800/80">
                  <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1.5">
                    <span className="flex items-center gap-1 font-semibold text-slate-300">
                      <Flame className="w-3.5 h-3.5 text-rose-400" />
                      <span>Indeks Konsentrasi Sinyal (µT/cm):</span>
                    </span>
                    <span className="text-[10px] text-slate-500">Rasio fluks terhadap kedalaman</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
                      <div className="text-sm font-black text-cyan-300">{densityA} µT/cm</div>
                      <span className="text-[9px] text-slate-500">
                        {Number(densityA) >= 6 ? 'Sasaran Sangat Padat' : 'Respons Moderat'}
                      </span>
                    </div>

                    <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
                      <div className="text-sm font-black text-purple-300">{densityB} µT/cm</div>
                      <span className="text-[9px] text-slate-500">
                        {Number(densityB) >= 6 ? 'Sasaran Sangat Padat' : 'Respons Moderat'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Metric 4: AI Historical Analysis (if present) */}
                {(itemA.aiAnalysis || itemB.aiAnalysis) && (
                  <div className="p-3 border-b border-slate-800/80 space-y-1.5">
                    <div className="text-[11px] font-semibold text-indigo-300 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Identifikasi Gemini AI:</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-[10px]">
                      <div className="bg-slate-900/80 p-2 rounded-xl border border-indigo-500/20">
                        {itemA.aiAnalysis ? (
                          <>
                            <div className="font-bold text-white text-xs">{itemA.aiAnalysis.artifactName}</div>
                            <div className="text-indigo-300">Era: {itemA.aiAnalysis.historicalEra}</div>
                            <div className="text-emerald-400">Keyakinan: {itemA.aiAnalysis.confidenceScore}%</div>
                          </>
                        ) : (
                          <span className="text-slate-500 italic">Belum dikaji AI</span>
                        )}
                      </div>

                      <div className="bg-slate-900/80 p-2 rounded-xl border border-indigo-500/20">
                        {itemB.aiAnalysis ? (
                          <>
                            <div className="font-bold text-white text-xs">{itemB.aiAnalysis.artifactName}</div>
                            <div className="text-indigo-300">Era: {itemB.aiAnalysis.historicalEra}</div>
                            <div className="text-emerald-400">Keyakinan: {itemB.aiAnalysis.confidenceScore}%</div>
                          </>
                        ) : (
                          <span className="text-slate-500 italic">Belum dikaji AI</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Tactical Assessment & Excavation Recommendation Box */}
              <div className="bg-gradient-to-r from-emerald-950/50 via-slate-950/80 to-cyan-950/40 p-3.5 rounded-2xl border border-emerald-500/40 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Kesimpulan Taktis Lapangan:</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300 font-sans">
                  {(() => {
                    const isGoldA = itemA.category === 'gold' || itemA.category === 'meteorite';
                    const isGoldB = itemB.category === 'gold' || itemB.category === 'meteorite';

                    if (isGoldA && !isGoldB) {
                      return `Target A (${itemA.name}) diprioritaskan terlebih dahulu karena termasuk kategori bernilai tinggi (${itemA.category.toUpperCase()}) dan memiliki fluks ${itemA.magneticStrength.toFixed(1)} µT.`;
                    }
                    if (isGoldB && !isGoldA) {
                      return `Target B (${itemB.name}) diprioritaskan terlebih dahulu karena termasuk kategori bernilai tinggi (${itemB.category.toUpperCase()}) dan memiliki fluks ${itemB.magneticStrength.toFixed(1)} µT.`;
                    }
                    if (itemA.depthEstimateCm < itemB.depthEstimateCm) {
                      return `Target A (${itemA.name}) berada ${Math.abs(depthDiff)} cm lebih dangkal sehingga meminimalkan waktu dan tenaga penggalian awal sebelum beralih ke Target B.`;
                    }
                    if (itemB.depthEstimateCm < itemA.depthEstimateCm) {
                      return `Target B (${itemB.name}) berada ${depthDiff} cm lebih dangkal sehingga disarankan untuk digali lebih dulu sebelum membuka sektor Target A.`;
                    }
                    return `Kedua artefak memiliki kedalaman yang setara. Target dengan fluks magnetik lebih tinggi (${
                      itemA.magneticStrength >= itemB.magneticStrength ? itemA.name : itemB.name
                    }) disarankan untuk difokuskan terlebih dahulu.`;
                  })()}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">
              Pilih minimal 2 temuan untuk memulai perbandingan.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {itemA && onNavigateToMap && (
              <button
                type="button"
                onClick={() => {
                  onNavigateToMap(itemA);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Lihat Target A di Peta</span>
              </button>
            )}

            {itemB && onNavigateToMap && itemA?.id !== itemB.id && (
              <button
                type="button"
                onClick={() => {
                  onNavigateToMap(itemB);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-bold transition-all"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Lihat Target B di Peta</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
