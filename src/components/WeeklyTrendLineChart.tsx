import React, { useMemo, useState } from 'react';
import { MetalFinding, MetalCategory } from '../types/detector';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Sparkles,
  Zap,
  Activity,
  Layers,
  ChevronRight,
  Info,
} from 'lucide-react';

interface WeeklyTrendLineChartProps {
  findings: MetalFinding[];
  className?: string;
}

interface DayTrendPoint {
  dateKey: string; // YYYY-MM-DD
  dayLabel: string; // "Sen", "Sel", etc.
  dateFormatted: string; // "20 Sep"
  fullDate: string; // "20 September 2026"
  isToday: boolean;
  count: number;
  maxFlux: number;
  avgFlux: number;
  categoryBreakdown: Record<MetalCategory, number>;
  topCategory?: MetalCategory;
  findings: MetalFinding[];
}

const INDONESIAN_DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const INDONESIAN_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

export const WeeklyTrendLineChart: React.FC<WeeklyTrendLineChartProps> = ({
  findings,
  className = '',
}) => {
  const [hoveredDay, setHoveredDay] = useState<DayTrendPoint | null>(null);

  // Compute 7 days series data (6 days ago -> today)
  const weekData: DayTrendPoint[] = useMemo(() => {
    const points: DayTrendPoint[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);

      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

      const matched = findings.filter((f) => {
        const fTime = f.timestamp;
        return fTime >= d.getTime() && fTime <= dayEnd.getTime();
      });

      const count = matched.length;
      const maxFlux = matched.reduce((max, f) => Math.max(max, f.magneticStrength), 0);
      const avgFlux =
        count > 0 ? matched.reduce((sum, f) => sum + f.magneticStrength, 0) / count : 0;

      const categoryBreakdown: Record<MetalCategory, number> = {
        gold: matched.filter((f) => f.category === 'gold').length,
        meteorite: matched.filter((f) => f.category === 'meteorite').length,
        silver: matched.filter((f) => f.category === 'silver').length,
        bronze: matched.filter((f) => f.category === 'bronze').length,
        iron: matched.filter((f) => f.category === 'iron').length,
        unknown: matched.filter((f) => f.category === 'unknown').length,
      };

      // Top category of the day
      let topCategory: MetalCategory | undefined;
      let topCount = 0;
      (Object.keys(categoryBreakdown) as MetalCategory[]).forEach((cat) => {
        if (categoryBreakdown[cat] > topCount) {
          topCount = categoryBreakdown[cat];
          topCategory = cat;
        }
      });

      points.push({
        dateKey,
        dayLabel: i === 0 ? 'Hari Ini' : INDONESIAN_DAYS[d.getDay()],
        dateFormatted: `${d.getDate()} ${INDONESIAN_MONTHS[d.getMonth()]}`,
        fullDate: `${d.getDate()} ${INDONESIAN_MONTHS[d.getMonth()]} ${d.getFullYear()}`,
        isToday: i === 0,
        count,
        maxFlux: Number(maxFlux.toFixed(1)),
        avgFlux: Number(avgFlux.toFixed(1)),
        categoryBreakdown,
        topCategory,
        findings: matched,
      });
    }

    return points;
  }, [findings]);

  // Total findings in the last 7 days
  const totalWeeklyFindings = useMemo(
    () => weekData.reduce((sum, p) => sum + p.count, 0),
    [weekData]
  );

  // Peak day in the week
  const peakDay = useMemo(() => {
    return [...weekData].sort((a, b) => b.count - a.count)[0];
  }, [weekData]);

  // Average per day in the past 7 days
  const averagePerDay = (totalWeeklyFindings / 7).toFixed(1);

  // Trend comparison: First 3 days vs Last 4 days
  const firstHalfCount = weekData.slice(0, 3).reduce((sum, p) => sum + p.count, 0);
  const secondHalfCount = weekData.slice(3).reduce((sum, p) => sum + p.count, 0);
  const isTrendingUp = secondHalfCount >= firstHalfCount;

  // SVG Chart dimensions
  const chartWidth = 560;
  const chartHeight = 160;
  const padLeft = 36;
  const padRight = 24;
  const padTop = 24;
  const padBottom = 32;

  const innerWidth = chartWidth - padLeft - padRight;
  const innerHeight = chartHeight - padTop - padBottom;

  // Maximum value for Y-axis (at least 5 for breathing room)
  const maxY = Math.max(4, ...weekData.map((d) => d.count)) + 1;

  // Generate SVG coordinates for the 7 points
  const points = useMemo(() => {
    return weekData.map((d, index) => {
      const x = padLeft + (index / (weekData.length - 1)) * innerWidth;
      const y = padTop + innerHeight - (d.count / maxY) * innerHeight;
      return { x, y, data: d };
    });
  }, [weekData, innerWidth, innerHeight, maxY, padLeft, padTop]);

  // Smooth SVG curve generator (Cubic Bezier curve)
  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx = (p0.x + p1.x) / 2;
      path += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return path;
  }, [points]);

  // Area path for gradient fill underneath curve
  const areaPath = useMemo(() => {
    if (points.length === 0) return '';
    const bottomY = padTop + innerHeight;
    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;

    let path = `M ${firstX} ${bottomY} L ${firstX} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx = (p0.x + p1.x) / 2;
      path += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    path += ` L ${lastX} ${bottomY} Z`;
    return path;
  }, [points, padTop, innerHeight]);

  return (
    <div
      className={`bg-slate-900/90 backdrop-blur-md rounded-3xl border border-slate-800 p-4 shadow-xl space-y-3 font-mono ${className}`}
    >
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <span>Tren Temuan Mingguan (7 Hari)</span>
                <span className="text-[10px] px-2 py-0.2 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Weekly Trend
                </span>
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 font-sans">
              Visualisasi produktivitas jumlah sasaran logam yang terdeteksi per hari
            </p>
          </div>
        </div>

        {/* Trend Indicator Pill */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border transition-colors ${
            isTrendingUp
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
          }`}
        >
          {isTrendingUp ? (
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span>{isTrendingUp ? 'Tren Meningkat' : 'Aktivitas Stabil'}</span>
        </div>
      </div>

      {/* Quick 3-Metric Summary Strip */}
      <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800/80 text-center">
        <div>
          <span className="text-[9px] text-slate-500 uppercase block">Total 7 Hari</span>
          <span className="text-base font-black text-cyan-300">{totalWeeklyFindings}</span>
          <span className="text-[9px] text-slate-400 block">Titik artefak</span>
        </div>
        <div>
          <span className="text-[9px] text-slate-500 uppercase block">Rerata Harian</span>
          <span className="text-base font-black text-emerald-300">{averagePerDay}</span>
          <span className="text-[9px] text-slate-400 block">Sasaran / hari</span>
        </div>
        <div>
          <span className="text-[9px] text-slate-500 uppercase block">Puncak Produktivitas</span>
          <span className="text-base font-black text-amber-400">
            {peakDay && peakDay.count > 0 ? `${peakDay.count} Titik` : '0 Titik'}
          </span>
          <span className="text-[9px] text-slate-400 block">
            {peakDay && peakDay.count > 0 ? peakDay.dayLabel : '-'}
          </span>
        </div>
      </div>

      {/* SVG Trend Line Chart Canvas */}
      <div className="relative w-full bg-slate-950/80 rounded-2xl border border-slate-800/80 p-2 overflow-hidden">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto block select-none"
        >
          <defs>
            {/* Smooth glowing area fill gradient */}
            <linearGradient id="weekly-area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
              <stop offset="60%" stopColor="#06b6d4" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </linearGradient>

            {/* Glowing line gradient */}
            <linearGradient id="weekly-line-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>

            {/* Glowing node filter */}
            <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#38bdf8" floodOpacity="0.8" />
            </filter>
          </defs>

          {/* Horizontal Reference Grid Lines */}
          {[0, Math.round(maxY / 2), maxY].map((val, idx) => {
            const gy = padTop + innerHeight - (val / maxY) * innerHeight;
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={gy}
                  x2={chartWidth - padRight}
                  y2={gy}
                  stroke="rgba(51, 65, 85, 0.4)"
                  strokeDasharray="3,3"
                />
                <text
                  x={padLeft - 6}
                  y={gy + 3}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="8.5"
                  fontFamily="monospace"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Area Gradient Fill */}
          <path d={areaPath} fill="url(#weekly-area-grad)" />

          {/* Spline Curve Line */}
          <path
            d={linePath}
            fill="none"
            stroke="url(#weekly-line-grad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points (Interactive Hoverable Circles) */}
          {points.map((pt, idx) => {
            const hasData = pt.data.count > 0;
            const isHovered = hoveredDay?.dateKey === pt.data.dateKey;
            const isPeak = pt.data.count === peakDay.count && pt.data.count > 0;

            return (
              <g
                key={idx}
                className="cursor-pointer group"
                onMouseEnter={() => setHoveredDay(pt.data)}
                onClick={() => setHoveredDay(pt.data)}
              >
                {/* Touch/Mouse Hover Target Area */}
                <circle cx={pt.x} cy={pt.y} r="14" fill="transparent" />

                {/* Pulse ring on peak day */}
                {isPeak && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="8"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    className="animate-ping"
                    opacity="0.6"
                  />
                )}

                {/* Outer Ring */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? '6' : hasData ? '4.5' : '3'}
                  fill={isHovered ? '#ffffff' : hasData ? '#06b6d4' : '#1e293b'}
                  stroke={isHovered ? '#38bdf8' : hasData ? '#0f172a' : '#475569'}
                  strokeWidth="2"
                  filter={hasData ? 'url(#node-glow)' : undefined}
                />

                {/* Data Value Badge above circle if count > 0 */}
                {hasData && (
                  <text
                    x={pt.x}
                    y={pt.y - 8}
                    textAnchor="middle"
                    fill={isPeak ? '#f59e0b' : '#38bdf8'}
                    fontSize="9.5"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {pt.data.count}
                  </text>
                )}

                {/* Day Labels along X Axis */}
                <text
                  x={pt.x}
                  y={chartHeight - 12}
                  textAnchor="middle"
                  fill={pt.data.isToday ? '#38bdf8' : isHovered ? '#f1f5f9' : '#64748b'}
                  fontWeight={pt.data.isToday || isHovered ? 'bold' : 'normal'}
                  fontSize="8.5"
                  fontFamily="monospace"
                >
                  {pt.data.dayLabel}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay Card */}
        {hoveredDay && (
          <div className="absolute top-2 right-2 bg-slate-900/95 backdrop-blur-md border border-cyan-500/40 rounded-xl p-2.5 shadow-2xl text-xs font-mono pointer-events-none animate-in fade-in duration-150 z-10 max-w-[210px]">
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1 mb-1.5">
              <span className="font-bold text-cyan-300">{hoveredDay.dayLabel}</span>
              <span className="text-[10px] text-slate-400">{hoveredDay.dateFormatted}</span>
            </div>

            <div className="space-y-1 text-[11px] text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Temuan:</span>
                <strong className="text-white">{hoveredDay.count} sasaran</strong>
              </div>

              {hoveredDay.count > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Fluks Puncak:</span>
                    <strong className="text-amber-400">{hoveredDay.maxFlux} µT</strong>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-400">Rerata Fluks:</span>
                    <strong className="text-emerald-400">~{hoveredDay.avgFlux} µT</strong>
                  </div>

                  {/* Category Pill Badges for this day */}
                  <div className="pt-1 flex items-center gap-1 flex-wrap text-[9px]">
                    {hoveredDay.categoryBreakdown.gold > 0 && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        ★ {hoveredDay.categoryBreakdown.gold} Emas
                      </span>
                    )}
                    {hoveredDay.categoryBreakdown.meteorite > 0 && (
                      <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        ☄ {hoveredDay.categoryBreakdown.meteorite} Meteorit
                      </span>
                    )}
                    {hoveredDay.categoryBreakdown.silver > 0 && (
                      <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        ◈ {hoveredDay.categoryBreakdown.silver} Perak
                      </span>
                    )}
                    {hoveredDay.categoryBreakdown.bronze > 0 && (
                      <span className="px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">
                        ⬢ {hoveredDay.categoryBreakdown.bronze} Perunggu
                      </span>
                    )}
                    {hoveredDay.categoryBreakdown.iron > 0 && (
                      <span className="px-1.5 py-0.2 rounded bg-slate-700 text-slate-300">
                        ⛏ {hoveredDay.categoryBreakdown.iron} Besi
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Productivity Insight Footer */}
      <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-cyan-400" />
          <span>
            {totalWeeklyFindings === 0
              ? 'Belum ada data temuan 7 hari terakhir. Mulai deteksi di lapangan untuk merekam kurva tren.'
              : `Aktivitas tertinggi tercatat pada ${peakDay.dayLabel} (${peakDay.count} sasaran terdeteksi).`}
          </span>
        </div>
      </div>
    </div>
  );
};
