import React, { useEffect, useRef, useState } from 'react';
import { MagneticReading } from '../types/detector';
import { Activity, Eye, Zap } from 'lucide-react';

interface WaveformChartProps {
  currentReading: MagneticReading;
  baseline: number;
  threshold: number;
  autoSaveEnabled: boolean;
}

export const WaveformChart: React.FC<WaveformChartProps> = ({
  currentReading,
  baseline,
  threshold,
  autoSaveEnabled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<MagneticReading[]>([]);
  const [showAxes, setShowAxes] = useState<boolean>(false);
  const [peakRecorded, setPeakRecorded] = useState<number>(0);

  // Buffer maximum 180 points (~10-15 seconds at 15-20 fps)
  useEffect(() => {
    const list = historyRef.current;
    list.push(currentReading);
    if (list.length > 200) {
      list.shift();
    }
    if (currentReading.total > peakRecorded) {
      setPeakRecorded(currentReading.total);
    }
  }, [currentReading, peakRecorded]);

  // Canvas rendering loop
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Background with tactical grid
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      // Grid lines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      const gridYCount = 5;
      for (let i = 0; i <= gridYCount; i++) {
        const y = (height / gridYCount) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const gridXCount = 8;
      for (let i = 0; i <= gridXCount; i++) {
        const x = (width / gridXCount) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      const list = historyRef.current;
      if (list.length < 2) {
        ctx.restore();
        animId = requestAnimationFrame(render);
        return;
      }

      // Determine dynamic Y-axis bounds
      let minY = 0;
      let maxY = 150;
      for (const item of list) {
        if (item.total > maxY - 20) maxY = Math.max(maxY, item.total + 30);
      }
      maxY = Math.max(maxY, threshold + 20, 160);

      const getY = (val: number) => {
        const clamped = Math.max(minY, Math.min(maxY, val));
        const pct = (clamped - minY) / (maxY - minY);
        return height - pct * (height - 24) - 12;
      };

      // 1. Draw Baseline (Tara Nol) Line
      const baselineY = getY(baseline);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#3b82f6'; // blue
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, baselineY);
      ctx.lineTo(width, baselineY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Baseline label
      ctx.fillStyle = '#60a5fa';
      ctx.font = '10px monospace';
      ctx.fillText(`Tara: ${baseline.toFixed(0)} µT`, 6, baselineY - 4);

      // 2. Draw Auto-Save Threshold Line
      if (autoSaveEnabled) {
        const threshY = getY(threshold);
        ctx.setLineDash([6, 3]);
        ctx.strokeStyle = '#f59e0b'; // amber
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, threshY);
        ctx.lineTo(width, threshY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`Ambang Simpan: ${threshold.toFixed(0)} µT`, width - 150, threshY - 4);
      }

      const stepX = width / Math.max(1, list.length - 1);

      // If Show Axes is toggled, draw X, Y, Z component lines
      if (showAxes) {
        const components: { key: 'x' | 'y' | 'z'; color: string }[] = [
          { key: 'x', color: '#ef4444' },
          { key: 'y', color: '#22c55e' },
          { key: 'z', color: '#06b6d4' },
        ];

        components.forEach(({ key, color }) => {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          list.forEach((item, idx) => {
            const x = idx * stepX;
            // center around mid
            const yVal = getY(baseline + item[key]);
            if (idx === 0) ctx.moveTo(x, yVal);
            else ctx.lineTo(x, yVal);
          });
          ctx.stroke();
        });
      }

      // 3. Draw Total Flux Waveform (|B|)
      // Fill gradient beneath curve
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, 'rgba(16, 185, 129, 0.45)'); // Emerald high
      grad.addColorStop(0.6, 'rgba(16, 185, 129, 0.15)');
      grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, height);
      list.forEach((item, idx) => {
        const x = idx * stepX;
        const y = getY(item.total);
        ctx.lineTo(x, y);
      });
      ctx.lineTo((list.length - 1) * stepX, height);
      ctx.closePath();
      ctx.fill();

      // Main line stroke
      ctx.strokeStyle = '#10b981'; // emerald-500
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      list.forEach((item, idx) => {
        const x = idx * stepX;
        const y = getY(item.total);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Pulse circle on current latest point
      const lastX = (list.length - 1) * stepX;
      const lastY = getY(list[list.length - 1].total);
      const isHigh = list[list.length - 1].total >= threshold;

      ctx.fillStyle = isHigh ? '#f59e0b' : '#10b981';
      ctx.beginPath();
      ctx.arc(lastX, lastY, 5, 0, Math.PI * 2);
      ctx.fill();

      // Outer glow
      ctx.strokeStyle = isHigh ? 'rgba(245, 158, 11, 0.5)' : 'rgba(16, 185, 129, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 9, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [baseline, threshold, autoSaveEnabled, showAxes]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Activity className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-bold tracking-wider uppercase text-slate-200">
              Grafik Fluks Magnet Real-Time
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">
              60 FPS Oskiloskop Geofisika (|B| Total)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowAxes(!showAxes)}
            className={`px-2 py-1 text-[10px] font-semibold rounded border transition-colors flex items-center gap-1 ${
              showAxes
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Tampilkan Komponen Vektor 3D X, Y, Z"
          >
            <Eye className="w-3 h-3" />
            3D (Bx,By,Bz)
          </button>

          <button
            type="button"
            onClick={() => setPeakRecorded(currentReading.total)}
            className="px-2 py-1 text-[10px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Reset Nilai Puncak"
          >
            Reset Peak
          </button>
        </div>
      </div>

      {/* Canvas view */}
      <div className="relative w-full h-44 rounded-xl overflow-hidden border border-slate-800/80 bg-slate-950">
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Legend overlays */}
        <div className="absolute top-2 left-2 flex items-center gap-2 text-[10px] font-mono pointer-events-none">
          <span className="flex items-center gap-1 bg-slate-900/80 px-1.5 py-0.5 rounded border border-emerald-500/30 text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Total |B|: {currentReading.total.toFixed(1)} µT
          </span>
          <span className="flex items-center gap-1 bg-slate-900/80 px-1.5 py-0.5 rounded border border-blue-500/30 text-blue-300">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            Net: +{currentReading.netTotal.toFixed(1)} µT
          </span>
        </div>

        <div className="absolute top-2 right-2 text-[10px] font-mono pointer-events-none">
          <span className="flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-300">
            <Zap className="w-3 h-3" />
            Max: {peakRecorded.toFixed(1)} µT
          </span>
        </div>

        {showAxes && (
          <div className="absolute bottom-2 left-2 flex items-center gap-2 text-[9px] font-mono pointer-events-none bg-slate-900/90 px-2 py-1 rounded border border-slate-800">
            <span className="text-red-400">X: {currentReading.x.toFixed(1)}</span>
            <span className="text-emerald-400">Y: {currentReading.y.toFixed(1)}</span>
            <span className="text-cyan-400">Z: {currentReading.z.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* Time & Scale footer info */}
      <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Rentang Waktu: ~15 detik</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-500">Frekuensi: ~30Hz</span>
        </div>
        <div className="flex items-center gap-1 text-emerald-400">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
          <span>Sensor Terkoneksi</span>
        </div>
      </div>
    </div>
  );
};
