import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  TrendingUp,
  MapPin,
  Sparkles,
  Download,
  Trash2,
  Info,
  Layers,
  ArrowRight,
  Compass,
  Activity,
  FileSpreadsheet,
  RotateCcw,
  Check,
} from 'lucide-react';
import { TrailPoint, TrailSummary, trailService } from '../services/trailService';
import { MetalFinding, MetalCategory } from '../types/detector';

interface TrailReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseline: number;
  threshold?: number;
  userLat?: number | null;
  userLng?: number | null;
  findings?: MetalFinding[];
  onNavigateToFinding?: (findingId: string) => void;
}

export const TrailReportModal: React.FC<TrailReportModalProps> = ({
  isOpen,
  onClose,
  baseline = 48.0,
  threshold = 70.0,
  userLat,
  userLng,
  findings = [],
  onNavigateToFinding,
}) => {
  const [points, setPoints] = useState<TrailPoint[]>([]);
  const [hoveredPoint, setHoveredPoint] = useState<TrailPoint | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<TrailPoint | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Subscribe to live trail points
  useEffect(() => {
    if (!isOpen) return;

    // Seed if empty and user coordinates available
    if (userLat && userLng) {
      trailService.seedInitialTrailIfEmpty(userLat, userLng, baseline, findings);
    } else {
      // Fallback center for Lombok NTB
      trailService.seedInitialTrailIfEmpty(-8.5833, 116.1167, baseline, findings);
    }

    const unsub = trailService.subscribe((pts) => {
      setPoints(pts);
    });

    return () => {
      unsub();
    };
  }, [isOpen, userLat, userLng, baseline, findings]);

  const summary: TrailSummary = useMemo(() => {
    return trailService.getSummary(baseline);
  }, [points, baseline]);

  // Compute chart min / max
  const chartBounds = useMemo(() => {
    if (points.length === 0) {
      return { minStrength: 30, maxStrength: 150, maxDistance: 100 };
    }
    let minS = 40;
    let maxS = 100;
    let maxD = 10;

    for (const p of points) {
      if (p.magneticStrength < minS) minS = Math.floor(p.magneticStrength - 5);
      if (p.magneticStrength > maxS) maxS = Math.ceil(p.magneticStrength + 15);
      if (p.distanceFromStartMeters > maxD) maxD = p.distanceFromStartMeters;
    }

    // Always give headroom for threshold
    if (threshold > maxS - 10) maxS = threshold + 25;

    return {
      minStrength: Math.max(0, minS),
      maxStrength: Math.max(120, maxS),
      maxDistance: Math.max(20, maxD),
    };
  }, [points, threshold]);

  // Render high performance line chart on Canvas
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI retina display
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 30, right: 30, bottom: 45, left: 50 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (points.length < 2) {
      ctx.fillStyle = '#64748b';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Mengumpulkan data koordinat dan fluks magnetik...', width / 2, height / 2);
      return;
    }

    const { minStrength, maxStrength, maxDistance } = chartBounds;

    const getX = (dist: number) => padding.left + (dist / maxDistance) * chartW;
    const getY = (strength: number) =>
      padding.top + chartH - ((strength - minStrength) / (maxStrength - minStrength)) * chartH;

    // Draw background grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;

    // 5 horizontal grid lines
    const gridSteps = 5;
    for (let i = 0; i <= gridSteps; i++) {
      const val = minStrength + (i / gridSteps) * (maxStrength - minStrength);
      const y = getY(val);

      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Label Y axis (µT)
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(val)} µT`, padding.left - 6, y + 3);
    }

    // Baseline Reference Line (dashed cyan)
    const baselineY = getY(baseline);
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padding.left, baselineY);
    ctx.lineTo(width - padding.right, baselineY);
    ctx.stroke();
    ctx.fillStyle = '#06b6d4';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Tara Dasar: ${baseline.toFixed(0)} µT`, padding.left + 6, baselineY - 6);
    ctx.restore();

    // Threshold Reference Line (dashed amber)
    const threshY = getY(threshold);
    if (threshY >= padding.top && threshY <= padding.top + chartH) {
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padding.left, threshY);
      ctx.lineTo(width - padding.right, threshY);
      ctx.stroke();
      ctx.fillStyle = '#f59e0b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`Ambang Anomali: ${threshold.toFixed(0)} µT`, width - padding.right - 6, threshY - 6);
      ctx.restore();
    }

    // Draw Smooth Area Gradient
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    gradient.addColorStop(0, 'rgba(234, 179, 8, 0.45)'); // Yellow/gold at peaks
    gradient.addColorStop(0.4, 'rgba(56, 189, 248, 0.35)'); // Cyan
    gradient.addColorStop(1, 'rgba(15, 23, 42, 0.05)'); // Slate transparent

    ctx.beginPath();
    ctx.moveTo(getX(points[0].distanceFromStartMeters), padding.top + chartH);

    for (let i = 0; i < points.length; i++) {
      const x = getX(points[i].distanceFromStartMeters);
      const y = getY(points[i].magneticStrength);
      if (i === 0) {
        ctx.lineTo(x, y);
      } else {
        // Curve smoothing
        const prevX = getX(points[i - 1].distanceFromStartMeters);
        const prevY = getY(points[i - 1].magneticStrength);
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    }

    const lastX = getX(points[points.length - 1].distanceFromStartMeters);
    ctx.lineTo(lastX, padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw Smooth Line Stroke
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const x = getX(points[i].distanceFromStartMeters);
      const y = getY(points[i].magneticStrength);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevX = getX(points[i - 1].distanceFromStartMeters);
        const prevY = getY(points[i - 1].magneticStrength);
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    }
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#0284c7';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0; // reset shadow

    // Draw Data Point Pins on Anomaly Peaks
    points.forEach((p) => {
      const x = getX(p.distanceFromStartMeters);
      const y = getY(p.magneticStrength);

      if (p.isAnomaly || p.magneticStrength >= threshold) {
        // Glowing halo for anomaly
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fillStyle = p.magneticStrength >= 100 ? 'rgba(234, 179, 8, 0.4)' : 'rgba(56, 189, 248, 0.4)';
        ctx.fill();

        // Solid center pin
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = p.magneticStrength >= 100 ? '#facc15' : '#38bdf8';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();

        // Label on peak
        if (p.magneticStrength >= threshold + 5) {
          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${p.magneticStrength.toFixed(0)}µT`, x, y - 9);
        }
      }
    });

    // Draw Active Hover Scrubber Line if any
    const activePoint = hoveredPoint || selectedPoint;
    if (activePoint) {
      const hX = getX(activePoint.distanceFromStartMeters);
      const hY = getY(activePoint.magneticStrength);

      ctx.save();
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hX, padding.top);
      ctx.lineTo(hX, padding.top + chartH);
      ctx.stroke();

      // Highlight circle
      ctx.beginPath();
      ctx.arc(hX, hY, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#f43f5e';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // X-Axis Labels (Distance in meters)
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';

    const distStep = Math.max(10, Math.round(maxDistance / 6 / 10) * 10);
    for (let d = 0; d <= maxDistance; d += distStep) {
      const x = getX(d);
      ctx.fillText(`${d} m`, x, height - padding.bottom + 16);

      // Small tick
      ctx.beginPath();
      ctx.moveTo(x, padding.top + chartH);
      ctx.lineTo(x, padding.top + chartH + 4);
      ctx.strokeStyle = '#475569';
      ctx.stroke();
    }

    // X Axis Title
    ctx.fillText('Jalur Penjelajahan (Jarak Tempuh dari Titik Mulai)', width / 2, height - 8);
  }, [points, chartBounds, baseline, threshold, hoveredPoint, selectedPoint, isOpen]);

  // Handle canvas mouse move for interactive scrubbing
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const xPos = e.clientX - rect.left;
    const paddingLeft = 50;
    const paddingRight = 30;
    const chartW = rect.width - paddingLeft - paddingRight;

    if (xPos < paddingLeft || xPos > rect.width - paddingRight) {
      setHoveredPoint(null);
      return;
    }

    const ratio = (xPos - paddingLeft) / chartW;
    const targetDist = ratio * chartBounds.maxDistance;

    // Find nearest point
    let closest: TrailPoint | null = null;
    let minDiff = Infinity;

    for (const p of points) {
      const diff = Math.abs(p.distanceFromStartMeters - targetDist);
      if (diff < minDiff) {
        minDiff = diff;
        closest = p;
      }
    }

    setHoveredPoint(closest);
  };

  const handleCanvasMouseLeave = () => {
    setHoveredPoint(null);
  };

  const handleCanvasClick = () => {
    if (hoveredPoint) {
      setSelectedPoint(hoveredPoint);
    }
  };

  // Export Trail to CSV
  const handleExportCSV = () => {
    if (points.length === 0) return;
    const headers = [
      'Titik #',
      'Waktu',
      'Jarak_Tempuh_m',
      'Fluks_Total_uT',
      'Fluks_Net_uT',
      'Latitude',
      'Longitude',
      'Akurasi_GPS_m',
      'Status_Anomali',
      'Nama_Temuan',
    ];

    const rows = points.map((p, idx) => [
      idx + 1,
      new Date(p.timestamp).toISOString(),
      p.distanceFromStartMeters,
      p.magneticStrength,
      p.netStrength,
      p.lat,
      p.lng,
      p.accuracy,
      p.isAnomaly ? 'ANOMALI' : 'NORMAL',
      p.anomalyName ? `"${p.anomalyName.replace(/"/g, '""')}"` : '',
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `laporan_jejak_medan_magnet_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Clear Trail
  const handleClearTrail = () => {
    if (window.confirm('Yakin ingin mereset rekaman jejak fluks GPS? Data baru akan mulai dicatat dari titik saat ini.')) {
      trailService.clearTrail();
      setSelectedPoint(null);
      setHoveredPoint(null);
    }
  };

  const activePoint = hoveredPoint || selectedPoint || (points.length > 0 ? points[points.length - 1] : null);

  // Filter list of anomalies along trail
  const trailAnomalies = useMemo(() => {
    return points.filter((p) => p.isAnomaly || p.magneticStrength >= threshold);
  }, [points, threshold]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 font-mono">
      <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-inner">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>Laporan Jejak Medan Magnetik</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  GPS Track Trend
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-sans">
                Visualisasi fluks magnetik sepanjang rute GPS untuk menganalisis gradien dan pembentukan anomali target.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/40 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
              title="Unduh Riwayat Jejak CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-teal-400" />
              <span>Ekspor CSV</span>
            </button>

            <button
              type="button"
              onClick={handleClearTrail}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-colors"
              title="Reset Jejak GPS"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Key Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Jarak Tempuh</span>
              <div className="text-lg sm:text-xl font-bold text-cyan-300 mt-1">
                {summary.totalDistanceMeters >= 1000
                  ? `${(summary.totalDistanceMeters / 1000).toFixed(2)} km`
                  : `${summary.totalDistanceMeters.toFixed(0)} meter`}
              </div>
              <span className="text-[9px] text-slate-500">{summary.pointCount} titik sampel tercatat</span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Puncak Fluks Tertinggi</span>
              <div className="text-lg sm:text-xl font-bold text-amber-300 mt-1">
                {summary.peakStrength.toFixed(1)} µT
              </div>
              <span className="text-[9px] text-amber-400/80">
                +{summary.peakNetStrength.toFixed(1)} µT di atas tara dasar
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Medan Rata-rata Latar</span>
              <div className="text-lg sm:text-xl font-bold text-slate-200 mt-1">
                {summary.averageStrength.toFixed(1)} µT
              </div>
              <span className="text-[9px] text-slate-500">Tara Nol Kalibrasi: {baseline.toFixed(0)} µT</span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Anomali Terdeteksi</span>
              <div className="text-lg sm:text-xl font-bold text-rose-300 mt-1">
                {summary.anomaliesDetectedCount} Hotspot
              </div>
              <span className="text-[9px] text-emerald-400 font-semibold">
                {summary.anomaliesDetectedCount > 0 ? '✓ Pembentukan terkonfirmasi' : 'Kondisi steril'}
              </span>
            </div>
          </div>

          {/* Interactive Line Chart Canvas Card */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-3 sm:p-4 shadow-xl flex flex-col gap-2">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>Grafik Tren Fluks Medan Magnetik vs Jalur GPS</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-slate-400 flex-wrap">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-0.5 bg-cyan-400 inline-block" />
                  <span>Fluks Terukur (µT)</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-0.5 border-t border-dashed border-cyan-400 inline-block" />
                  <span>Tara Nol ({baseline.toFixed(0)} µT)</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-0.5 border-t border-dashed border-amber-400 inline-block" />
                  <span>Ambang Anomali ({threshold.toFixed(0)} µT)</span>
                </span>
              </div>
            </div>

            {/* Canvas Container */}
            <div className="relative w-full h-64 sm:h-72">
              <canvas
                ref={canvasRef}
                onMouseMove={handleCanvasMouseMove}
                onMouseLeave={handleCanvasMouseLeave}
                onClick={handleCanvasClick}
                className="w-full h-full cursor-crosshair rounded-xl"
              />
            </div>

            <div className="text-[10px] text-slate-400 flex items-center justify-between px-1">
              <span>💡 Geser kursor atau sentuh grafik untuk membedah titik pengukuran secara detail.</span>
              <span className="hidden sm:inline text-slate-500">Unit X: Meter Jalur | Unit Y: Mikrotesla (µT)</span>
            </div>
          </div>

          {/* Active Hover / Selected Point Detailed Inspector Card */}
          {activePoint && (
            <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/40 border border-cyan-500/40 text-xs shadow-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                    activePoint.isAnomaly
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-900/30'
                      : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                  }`}
                >
                  {activePoint.isAnomaly ? '★' : '•'}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap font-bold text-slate-200">
                    <span>
                      Jarak Tempuh: <strong className="text-cyan-300">{activePoint.distanceFromStartMeters} m</strong>
                    </span>
                    <span>•</span>
                    <span className="text-amber-300 font-extrabold">{activePoint.magneticStrength} µT</span>
                    <span className="text-[10px] text-emerald-400 font-normal">
                      (+{activePoint.netStrength} µT)
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                    <MapPin className="w-3 h-3 text-cyan-400" />
                    <span>
                      GPS: {activePoint.lat.toFixed(5)}, {activePoint.lng.toFixed(5)} (±{activePoint.accuracy}m)
                    </span>
                    <span>•</span>
                    <span>{new Date(activePoint.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>

              {activePoint.anomalyName ? (
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>{activePoint.anomalyName}</span>
                  </span>
                </div>
              ) : activePoint.isAnomaly ? (
                <span className="px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-semibold self-start sm:self-auto">
                  Lonjakan Anomali Logam
                </span>
              ) : (
                <span className="text-[10px] text-slate-500 self-start sm:self-auto">
                  Fluks Latar Alami
                </span>
              )}
            </div>
          )}

          {/* Educational Formation Guide (Membantu Pengguna Membedakan Anomali) */}
          <div className="bg-slate-950/70 p-4 rounded-3xl border border-slate-800 space-y-2.5">
            <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Bagaimana Anomali Terbentuk di Sepanjang Jalur Eksplorasi?</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] font-sans">
              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-300 font-mono text-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Puncak Runcing (Point Target)</span>
                </div>
                <p className="text-slate-400 leading-relaxed text-[10px]">
                  Fluks melonjak tajam dalam rentang &lt;1.5 meter lalu turun kembali ke latar bumi. Karakteristik
                  khas koin emas/perak tunggal, cincin, pisau, atau pecahan logam padat dekat permukaan.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-purple-300 font-mono text-xs">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  <span>Halo Lebar (Broad Mass)</span>
                </div>
                <p className="text-slate-400 leading-relaxed text-[10px]">
                  Fluks naik melandai dan bertahan tinggi sepanjang 3–8 meter. Menandakan massa feromagnetik masif
                  seperti bejana kuno, meriam terpendam, formasi meteorit nikel, atau klaster perunggu padat.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-cyan-300 font-mono text-xs">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>Riak Latar (Mineralization Drift)</span>
                </div>
                <p className="text-slate-400 leading-relaxed text-[10px]">
                  Fluktuasi bergelombang halus (&plusmn;1–3 µT) tanpa puncak ekstrem. Menunjukkan lapisan tanah
                  mengandung pasir besi vulkanik alami, tanah liat merah, atau batuan basaltik.
                </p>
              </div>
            </div>
          </div>

          {/* List of Formed Anomalies along the Trail */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-200">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Titik Hotspot Anomali di Jalur Ini ({trailAnomalies.length})</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Urutan kronologis langkah GPS</span>
            </div>

            {trailAnomalies.length === 0 ? (
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-500">
                Belum ada anomali medan yang melampaui ambang deteksi di jalur GPS saat ini.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {trailAnomalies.map((anom, idx) => (
                  <div
                    key={anom.id}
                    onClick={() => setSelectedPoint(anom)}
                    className={`p-3 rounded-2xl border text-xs cursor-pointer transition-all ${
                      selectedPoint?.id === anom.id
                        ? 'bg-amber-950/40 border-amber-500/70 shadow-md ring-1 ring-amber-500/50'
                        : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-amber-300 flex items-center gap-1.5">
                        <span className="text-xs">#{idx + 1}</span>
                        <span>{anom.anomalyName || 'Anomali Medan Logam'}</span>
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                        {anom.magneticStrength} µT
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>Jarak: ~{anom.distanceFromStartMeters} m dari titik mulai</span>
                      <span className="text-slate-500">
                        {anom.lat.toFixed(5)}, {anom.lng.toFixed(5)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/70">
          <span className="text-[10px] text-slate-500 hidden sm:inline">
            Status Jejak: Aktif merekam otomatis setiap pergerakan GPS & perubahan fluks.
          </span>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex-1 sm:flex-none px-4 py-2 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/40 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              Unduh CSV
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
            >
              Tutup Laporan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
