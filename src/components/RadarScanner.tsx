import React, { useEffect, useRef } from 'react';
import { Radio } from 'lucide-react';

interface RadarScannerProps {
  netStrength: number;
  totalStrength: number;
  heading: number | null;
}

export const RadarScanner: React.FC<RadarScannerProps> = ({
  netStrength,
  totalStrength,
  heading,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const angleRef = useRef<number>(0);

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

      const centerX = width / 2;
      const centerY = height / 2;
      const maxR = Math.min(centerX, centerY) - 8;

      ctx.clearRect(0, 0, width, height);

      // Radar circles
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;

      [0.25, 0.5, 0.75, 1.0].forEach((ratio) => {
        ctx.beginPath();
        ctx.arc(centerX, centerY, maxR * ratio, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Crosshairs
      ctx.beginPath();
      ctx.moveTo(centerX - maxR, centerY);
      ctx.lineTo(centerX + maxR, centerY);
      ctx.moveTo(centerX, centerY - maxR);
      ctx.lineTo(centerX, centerY + maxR);
      ctx.stroke();

      // Heading compass tick
      const currentHeading = heading || 0;
      const headingRad = (currentHeading * Math.PI) / 180;
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('N', centerX, centerY - maxR + 10);

      // Sweep line
      angleRef.current = (angleRef.current + 0.04) % (Math.PI * 2);
      const sweepAngle = angleRef.current;

      const sweepGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        maxR
      );
      sweepGradient.addColorStop(0, 'rgba(16, 185, 129, 0)');
      sweepGradient.addColorStop(1, 'rgba(16, 185, 129, 0.25)');

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, maxR, sweepAngle - 0.4, sweepAngle);
      ctx.closePath();
      ctx.fillStyle = sweepGradient;
      ctx.fill();
      ctx.restore();

      // Sweep bright line
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + maxR * Math.cos(sweepAngle), centerY + maxR * Math.sin(sweepAngle));
      ctx.stroke();

      // Blip anomaly if netStrength is noticeable
      if (netStrength > 8) {
        // Distance from center inversely proportional to strength (closer = stronger)
        const blipDistRatio = Math.max(0.18, 0.9 - Math.min(0.75, netStrength / 100));
        const blipRadius = maxR * blipDistRatio;
        const blipAngle = headingRad - Math.PI / 2 + 0.6;

        const bx = centerX + blipRadius * Math.cos(blipAngle);
        const by = centerY + blipRadius * Math.sin(blipAngle);

        const blipColor =
          netStrength > 80 ? '#eab308' : netStrength > 40 ? '#38bdf8' : '#10b981';

        ctx.fillStyle = blipColor;
        ctx.beginPath();
        ctx.arc(bx, by, 4 + Math.min(4, netStrength / 25), 0, Math.PI * 2);
        ctx.fill();

        // Pulsing echo ring
        const echoSize = 8 + (Date.now() % 1000) / 70;
        ctx.strokeStyle = blipColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(bx, by, echoSize, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [netStrength, totalStrength, heading]);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex items-center gap-3">
      <div className="relative w-24 h-24 shrink-0 bg-slate-950 rounded-xl border border-slate-800/80 overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>Sonar Radar Proksimitas</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
          {netStrength > 15
            ? 'Objek logam terdeteksi dalam zona radius sensor ponsel.'
            : 'Menyapu area tanah sekitar ponsel... Belum ada anomali terpusat.'}
        </p>

        <div className="mt-2 flex items-center gap-2 text-[10px] font-mono">
          <span className="bg-slate-950 px-2 py-0.5 rounded text-slate-300 border border-slate-800">
            Arah: {heading !== null ? `${Math.round(heading)}°` : '0° N'}
          </span>
          <span className="bg-slate-950 px-2 py-0.5 rounded text-slate-300 border border-slate-800">
            Rentang: ~30 cm
          </span>
        </div>
      </div>
    </div>
  );
};
