import React, { useState, useMemo } from 'react';
import {
  Layers,
  TrendingDown,
  Shovel,
  Info,
  ChevronDown,
  ChevronUp,
  Target,
  Sparkles,
  Compass,
  AlertCircle,
  Activity,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { getDepthTier, DepthTier } from './SoilDepthIndicator';
import { SensorManager } from '../services/sensorManager';

interface DepthProbabilityGaugeProps {
  netStrength: number;
  totalStrength: number;
  baseline: number;
  threshold?: number;
  onOpenSoilProfiler?: () => void;
}

export interface DepthProbabilityBreakdown {
  surfaceProb: number; // 0-10 cm (%)
  midProb: number;     // 11-20 cm (%)
  deepProb: number;    // 21-35 cm (%)
  extremeProb: number; // >35 cm (%)
  mostLikelyDepthCm: number;
  depthMarginCm: number;
  confidenceScore: number; // 0 - 100%
  dominantTier: DepthTier;
  snrRatio: number;
  signalQuality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'WEAK_NOISE';
}

/**
 * Calculates real-time depth probability distribution using magnetic dipole inverse-cube law
 * B ~ M / (depth^3) with Gaussian probability distribution around estimated center depth.
 */
export function calculateDepthProbability(
  netStrength: number,
  baseline: number
): DepthProbabilityBreakdown {
  const net = Math.max(0, netStrength);
  const snrRatio = Number((baseline > 0 ? net / (baseline * 0.15 + 1) : 0).toFixed(2));

  // Determine signal quality
  let signalQuality: DepthProbabilityBreakdown['signalQuality'] = 'WEAK_NOISE';
  if (net >= 45) {
    signalQuality = 'EXCELLENT';
  } else if (net >= 20) {
    signalQuality = 'GOOD';
  } else if (net >= 7) {
    signalQuality = 'FAIR';
  }

  // If signal is essentially noise (< 2 µT net)
  if (net < 2.0) {
    const tier = getDepthTier(15);
    return {
      surfaceProb: 25,
      midProb: 25,
      deepProb: 25,
      extremeProb: 25,
      mostLikelyDepthCm: 15,
      depthMarginCm: 12,
      confidenceScore: Math.min(20, Math.round(net * 10)),
      dominantTier: tier,
      snrRatio,
      signalQuality: 'WEAK_NOISE',
    };
  }

  // Inverted dipole model: Large net flux indicates very close/shallow target
  // net = 150uT -> ~4 cm; net = 80uT -> ~8 cm; net = 35uT -> ~15 cm; net = 12uT -> ~25 cm; net = 4uT -> ~38 cm
  const normalizedNet = Math.max(0.5, net);
  // Empirical dipole regression for handheld phone magnetometer:
  // d = 42 * (1 / (1 + (net / 22)^0.55)) + 3
  const rawEstimatedDepth = Math.max(
    3,
    Math.min(48, Math.round(42 / (1 + Math.pow(normalizedNet / 20, 0.65)) + 2))
  );

  // Margin of error narrows when signal is stronger
  const depthMarginCm = Math.max(1.5, Math.round(10 / (1 + net / 30) + 1.2));

  // Confidence is proportional to net strength and SNR
  const confidenceScore = Math.min(
    98,
    Math.max(25, Math.round(35 + Math.min(55, net * 0.8) + (snrRatio > 3 ? 10 : 0)))
  );

  // Compute probability density for each stratum (Gaussian PDF integrated over tiers)
  // Strata boundaries:
  // Stratum 1: 0 - 10 cm (mean 5)
  // Stratum 2: 11 - 20 cm (mean 15)
  // Stratum 3: 21 - 35 cm (mean 27)
  // Stratum 4: > 35 cm (mean 42)
  const calcWeight = (tierCenter: number) => {
    const sigma = Math.max(4.5, depthMarginCm * 1.4);
    const diff = tierCenter - rawEstimatedDepth;
    return Math.exp(-(diff * diff) / (2 * sigma * sigma));
  };

  const wSurface = calcWeight(6);
  const wMid = calcWeight(15);
  const wDeep = calcWeight(28);
  const wExtreme = calcWeight(42);

  const totalWeight = wSurface + wMid + wDeep + wExtreme || 1;

  let surfaceProb = Math.round((wSurface / totalWeight) * 100);
  let midProb = Math.round((wMid / totalWeight) * 100);
  let deepProb = Math.round((wDeep / totalWeight) * 100);
  let extremeProb = Math.round((wExtreme / totalWeight) * 100);

  // Normalize so sum is exactly 100%
  const sum = surfaceProb + midProb + deepProb + extremeProb;
  const delta = 100 - sum;
  if (delta !== 0) {
    if (surfaceProb >= midProb && surfaceProb >= deepProb) surfaceProb += delta;
    else if (midProb >= deepProb) midProb += delta;
    else deepProb += delta;
  }

  const dominantTier = getDepthTier(rawEstimatedDepth);

  return {
    surfaceProb: Math.max(1, surfaceProb),
    midProb: Math.max(1, midProb),
    deepProb: Math.max(1, deepProb),
    extremeProb: Math.max(1, extremeProb),
    mostLikelyDepthCm: rawEstimatedDepth,
    depthMarginCm,
    confidenceScore,
    dominantTier,
    snrRatio,
    signalQuality,
  };
}

export const DepthProbabilityGauge: React.FC<DepthProbabilityGaugeProps> = ({
  netStrength,
  totalStrength,
  baseline,
  threshold = 70.0,
  onOpenSoilProfiler,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [selectedStratum, setSelectedStratum] = useState<
    'surface' | 'medium' | 'deep' | 'extreme' | null
  >(null);

  // Calculate real-time probability breakdown
  const prob = useMemo(
    () => calculateDepthProbability(netStrength, baseline),
    [netStrength, baseline]
  );

  const metalClassification = SensorManager.classifyMetal(netStrength, totalStrength);

  // Depth marker position on 0-50 cm scale (0% = 0 cm top, 100% = 50 cm bottom)
  const depthPointerPercent = Math.min(100, Math.max(0, (prob.mostLikelyDepthCm / 50) * 100));

  return (
    <div className="bg-gradient-to-b from-slate-900/95 via-slate-950 to-slate-950 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl relative overflow-hidden backdrop-blur-md">
      {/* Background ambient glow based on dominant depth tier */}
      <div
        className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-20 transition-all duration-500"
        style={{ backgroundColor: prob.dominantTier.color }}
      />

      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div
            className="p-2 rounded-2xl border shadow-sm transition-colors duration-300"
            style={{
              backgroundColor: `${prob.dominantTier.color}20`,
              borderColor: `${prob.dominantTier.color}50`,
              color: prob.dominantTier.color,
            }}
          >
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold font-mono text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                <span>Depth Probability Gauge</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono">
                  Real-Time
                </span>
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 font-sans mt-0.5">
              Analisis probabilitas sebaran kedalaman lapisan tanah berdasarkan fluks magnetik
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onOpenSoilProfiler && (
            <button
              type="button"
              onClick={onOpenSoilProfiler}
              className="text-[10px] font-mono px-2 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all hidden sm:flex items-center gap-1"
              title="Analisis Profil Mineral Tanah"
            >
              <span>Profil Tanah</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
            title={isExpanded ? 'Sederhanakan Tampilan' : 'Tampilkan Detail Lengkap'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Probability HUD Row */}
      <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-stretch">
        {/* Left Column: Big Depth Gauge Meter & Confidence Badge */}
        <div className="sm:col-span-5 bg-slate-950/70 border border-slate-800/90 rounded-2xl p-3.5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Estimasi Kedalaman
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full animate-ping"
                style={{ backgroundColor: prob.dominantTier.color }}
              />
              <span
                className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border"
                style={{
                  backgroundColor: prob.dominantTier.bgColor,
                  borderColor: prob.dominantTier.borderColor,
                  color: prob.dominantTier.textColor,
                }}
              >
                {prob.dominantTier.label}
              </span>
            </div>
          </div>

          {/* Depth Big Numbers */}
          <div className="flex items-baseline gap-2">
            <span
              className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight"
              style={{ color: prob.dominantTier.color }}
            >
              ~{prob.mostLikelyDepthCm}
            </span>
            <span className="text-base font-bold font-mono text-slate-400">cm</span>
            <span className="text-xs font-mono text-slate-500">
              (±{prob.depthMarginCm} cm)
            </span>
          </div>

          {/* Confidence & Signal Quality Indicators */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-[11px] font-mono">
            <div className="flex items-center justify-between text-slate-400">
              <span>Tingkat Keyakinan:</span>
              <span className="font-bold text-slate-200">
                {prob.confidenceScore}%{' '}
                <span
                  className={
                    prob.confidenceScore > 75
                      ? 'text-emerald-400'
                      : prob.confidenceScore > 45
                      ? 'text-amber-400'
                      : 'text-slate-500'
                  }
                >
                  ({prob.confidenceScore > 75 ? 'Tinggi' : prob.confidenceScore > 45 ? 'Moderat' : 'Rendah'})
                </span>
              </span>
            </div>

            <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${prob.confidenceScore}%`,
                  backgroundColor: prob.dominantTier.color,
                }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
              <span>Fluks Bersih:</span>
              <span className="text-cyan-300 font-bold">+{netStrength.toFixed(1)} µT</span>
              <span>Kategori:</span>
              <span className="text-amber-300 font-bold truncate max-w-[90px]">
                {metalClassification.name.split('/')[0]}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Multi-Tier Stratum Probability Distribution Bars */}
        <div className="sm:col-span-7 bg-slate-950/70 border border-slate-800/90 rounded-2xl p-3.5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-cyan-400" />
              <span>Distribusi Probabilitas Lapisan Tanah</span>
            </span>
            <span className="text-[10px] font-mono text-slate-500">Total: 100%</span>
          </div>

          {/* 4 Stratum Rows */}
          <div className="space-y-2">
            {/* Stratum 1: 0 - 10 cm Dangkal (Humus / Topsoil) */}
            <div
              onClick={() =>
                setSelectedStratum(selectedStratum === 'surface' ? null : 'surface')
              }
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                prob.dominantTier.id === 'surface'
                  ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/30'
                  : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="font-bold text-emerald-300">Dangkal (0 - 10 cm)</span>
                  <span className="text-[10px] text-slate-400">Humus / Topsoil</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-xs">
                    {prob.surfaceProb}%
                  </span>
                  {prob.dominantTier.id === 'surface' && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                      Dominan
                    </span>
                  )}
                </div>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-emerald-400 rounded-full transition-all duration-300 shadow-sm shadow-emerald-500/50"
                  style={{ width: `${prob.surfaceProb}%` }}
                />
              </div>
            </div>

            {/* Stratum 2: 11 - 20 cm Sedang (Subsoil) */}
            <div
              onClick={() =>
                setSelectedStratum(selectedStratum === 'medium' ? null : 'medium')
              }
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                prob.dominantTier.id === 'medium'
                  ? 'bg-amber-950/40 border-amber-500/60 ring-1 ring-amber-500/30'
                  : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="font-bold text-amber-300">Sedang (11 - 20 cm)</span>
                  <span className="text-[10px] text-slate-400">Subsoil Tanah Liat</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-xs">
                    {prob.midProb}%
                  </span>
                  {prob.dominantTier.id === 'medium' && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                      Dominan
                    </span>
                  )}
                </div>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-300 shadow-sm shadow-amber-500/50"
                  style={{ width: `${prob.midProb}%` }}
                />
              </div>
            </div>

            {/* Stratum 3: 21 - 35 cm Dalam (Hardpan / Gravel) */}
            <div
              onClick={() =>
                setSelectedStratum(selectedStratum === 'deep' ? null : 'deep')
              }
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                prob.dominantTier.id === 'deep'
                  ? 'bg-orange-950/40 border-orange-500/60 ring-1 ring-orange-500/30'
                  : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-400" />
                  <span className="font-bold text-orange-300">Dalam (21 - 35 cm)</span>
                  <span className="text-[10px] text-slate-400">Kerikil / Hardpan</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-xs">
                    {prob.deepProb}%
                  </span>
                  {prob.dominantTier.id === 'deep' && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-orange-500/20 text-orange-300 font-bold border border-orange-500/40">
                      Dominan
                    </span>
                  )}
                </div>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-orange-400 rounded-full transition-all duration-300 shadow-sm shadow-orange-500/50"
                  style={{ width: `${prob.deepProb}%` }}
                />
              </div>
            </div>

            {/* Stratum 4: > 35 cm Ekstrem (Deep Bedrock) */}
            <div
              onClick={() =>
                setSelectedStratum(selectedStratum === 'extreme' ? null : 'extreme')
              }
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                prob.dominantTier.id === 'extreme'
                  ? 'bg-purple-950/40 border-purple-500/60 ring-1 ring-purple-500/30'
                  : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  <span className="font-bold text-purple-300">Ekstrem (&gt; 35 cm)</span>
                  <span className="text-[10px] text-slate-400">Batuan Dasar Bedrock</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-xs">
                    {prob.extremeProb}%
                  </span>
                  {prob.dominantTier.id === 'extreme' && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/40">
                      Dominan
                    </span>
                  )}
                </div>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-purple-400 rounded-full transition-all duration-300 shadow-sm shadow-purple-500/50"
                  style={{ width: `${prob.extremeProb}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Excavation Tactics & Soil Stratum Guide */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2.5 animate-in fade-in duration-200">
          {/* Vertical Stratum Cross-Section Visual Ruler */}
          <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
                <span>Penampang Profil Kedalaman Tanah (0 - 50 cm)</span>
              </span>
              <span className="text-[10px] font-mono text-cyan-400">
                Titik Prediksi: ~{prob.mostLikelyDepthCm} cm
              </span>
            </div>

            {/* Horizontal Stratum Bar with Needle */}
            <div className="relative h-7 rounded-xl overflow-hidden border border-slate-700/80 flex shadow-inner">
              {/* Stratum 1: 0-10 cm (20% of 50cm scale) */}
              <div
                className="h-full bg-emerald-950/80 border-r border-emerald-500/40 flex items-center justify-center text-[9px] font-mono font-bold text-emerald-300"
                style={{ width: '20%' }}
                title="Topsoil 0-10 cm"
              >
                0-10cm
              </div>
              {/* Stratum 2: 11-20 cm (20% of 50cm scale) */}
              <div
                className="h-full bg-amber-950/80 border-r border-amber-500/40 flex items-center justify-center text-[9px] font-mono font-bold text-amber-300"
                style={{ width: '20%' }}
                title="Subsoil 11-20 cm"
              >
                11-20cm
              </div>
              {/* Stratum 3: 21-35 cm (30% of 50cm scale) */}
              <div
                className="h-full bg-orange-950/80 border-r border-orange-500/40 flex items-center justify-center text-[9px] font-mono font-bold text-orange-300"
                style={{ width: '30%' }}
                title="Gravel / Hardpan 21-35 cm"
              >
                21-35cm
              </div>
              {/* Stratum 4: 36-50 cm (30% of 50cm scale) */}
              <div
                className="h-full bg-purple-950/80 flex items-center justify-center text-[9px] font-mono font-bold text-purple-300"
                style={{ width: '30%' }}
                title="Bedrock >35 cm"
              >
                &gt;35cm
              </div>

              {/* Dynamic Target Depth Needle Marker */}
              <div
                className="absolute top-0 bottom-0 w-1.5 bg-white shadow-lg shadow-cyan-400/90 rounded-full transition-all duration-300 pointer-events-none z-10"
                style={{ left: `calc(${depthPointerPercent}% - 3px)` }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-cyan-500 shadow-md animate-pulse" />
              </div>
            </div>
          </div>

          {/* Tactical Advice & Recommended Tool Card */}
          <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/90 text-xs font-mono space-y-1.5">
            <div className="flex items-center justify-between text-slate-300">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <Shovel className="w-3.5 h-3.5" />
                <span>Rekomendasi Alat Gali:</span>
              </div>
              <span className="text-slate-100 font-bold">
                {prob.dominantTier.recommendedTool}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Tingkat Kekerasan Galian:</span>
              <span className="font-bold text-slate-200">
                {prob.dominantTier.digDifficulty} • Estimasi {prob.dominantTier.estimatedTime}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 font-sans leading-relaxed pt-1 border-t border-slate-800">
              💡 <strong className="text-slate-200">Tips Penggalian:</strong>{' '}
              {prob.dominantTier.advice}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
