import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { MetalFinding, MetalCategory } from '../types/detector';
import { BarChart3, TrendingUp, Sparkles, Layers, Zap } from 'lucide-react';

interface FindingsDistributionChartProps {
  findings: MetalFinding[];
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
}

interface CategoryStats {
  category: MetalCategory;
  name: string;
  shortName: string;
  count: number;
  percentage: number;
  avgFlux: number;
  maxFlux: number;
  color: string;
  gradientStart: string;
  gradientEnd: string;
  symbol: string;
}

const CATEGORY_META: Record<
  MetalCategory,
  { name: string; shortName: string; color: string; gradientStart: string; gradientEnd: string; symbol: string }
> = {
  gold: {
    name: 'Emas (Gold)',
    shortName: 'Emas',
    color: '#eab308',
    gradientStart: '#fde047',
    gradientEnd: '#ca8a04',
    symbol: '★',
  },
  meteorite: {
    name: 'Meteorit Kosmik',
    shortName: 'Meteorit',
    color: '#c084fc',
    gradientStart: '#e879f9',
    gradientEnd: '#9333ea',
    symbol: '☄',
  },
  silver: {
    name: 'Perak (Silver)',
    shortName: 'Perak',
    color: '#38bdf8',
    gradientStart: '#7dd3fc',
    gradientEnd: '#0284c7',
    symbol: '◈',
  },
  bronze: {
    name: 'Perunggu Kuno',
    shortName: 'Perunggu',
    color: '#f97316',
    gradientStart: '#fb923c',
    gradientEnd: '#c2410c',
    symbol: '⬢',
  },
  iron: {
    name: 'Besi (Ferrous)',
    shortName: 'Besi',
    color: '#94a3b8',
    gradientStart: '#cbd5e1',
    gradientEnd: '#64748b',
    symbol: '⛏',
  },
  unknown: {
    name: 'Mineral Tanah',
    shortName: 'Mineral',
    color: '#64748b',
    gradientStart: '#94a3b8',
    gradientEnd: '#475569',
    symbol: '●',
  },
};

export const FindingsDistributionChart: React.FC<FindingsDistributionChartProps> = ({
  findings,
  selectedCategory,
  onSelectCategory,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const [metric, setMetric] = useState<'count' | 'avgFlux'>('count');
  const [hoveredCategory, setHoveredCategory] = useState<CategoryStats | null>(null);

  const totalFindings = findings.length;

  // Compute category stats
  const statsData: CategoryStats[] = useMemo(() => {
    const categories: MetalCategory[] = ['gold', 'meteorite', 'silver', 'bronze', 'iron'];

    return categories.map((cat) => {
      const matched = findings.filter((f) => f.category === cat);
      const count = matched.length;
      const percentage = totalFindings > 0 ? (count / totalFindings) * 100 : 0;
      const avgFlux =
        count > 0 ? matched.reduce((sum, item) => sum + item.magneticStrength, 0) / count : 0;
      const maxFlux = count > 0 ? Math.max(...matched.map((m) => m.magneticStrength)) : 0;

      return {
        category: cat,
        name: CATEGORY_META[cat].name,
        shortName: CATEGORY_META[cat].shortName,
        count,
        percentage: Number(percentage.toFixed(1)),
        avgFlux: Number(avgFlux.toFixed(1)),
        maxFlux: Number(maxFlux.toFixed(1)),
        color: CATEGORY_META[cat].color,
        gradientStart: CATEGORY_META[cat].gradientStart,
        gradientEnd: CATEGORY_META[cat].gradientEnd,
        symbol: CATEGORY_META[cat].symbol,
      };
    });
  }, [findings]);

  // D3 Rendering with smooth animations
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const isCategorySelected = (cat: MetalCategory) => {
      if (!selectedCategory || selectedCategory === 'all') return false;
      if (selectedCategory === 'gold' || selectedCategory === 'emas') return cat === 'gold';
      if (selectedCategory === 'bronze' || selectedCategory === 'perunggu') return cat === 'bronze';
      if (selectedCategory === 'meteorite' || selectedCategory === 'meteorit') return cat === 'meteorite';
      if (selectedCategory === 'other' || selectedCategory === 'lainnya') {
        return cat !== 'gold' && cat !== 'bronze' && cat !== 'meteorite';
      }
      return selectedCategory === cat;
    };

    const hasActiveFilter = Boolean(selectedCategory && selectedCategory !== 'all');

    const containerWidth = containerRef.current.clientWidth || 360;
    const width = Math.max(300, containerWidth);
    const height = 230;
    const margin = { top: 28, right: 16, bottom: 42, left: 38 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', '100%').attr('height', height);

    // Definitions (Gradients & Glow Filters)
    const defs = svg.append('defs');

    // Create a linear gradient for each category bar
    statsData.forEach((d) => {
      const grad = defs
        .append('linearGradient')
        .attr('id', `bar-grad-${d.category}`)
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%');

      grad.append('stop').attr('offset', '0%').attr('stop-color', d.gradientStart);
      grad.append('stop').attr('offset', '100%').attr('stop-color', d.gradientEnd);
    });

    // Drop shadow filter for tactical feel
    const filter = defs.append('filter').attr('id', 'bar-shadow').attr('height', '130%');
    filter
      .append('feDropShadow')
      .attr('dx', '0')
      .attr('dy', '4')
      .attr('stdDeviation', '4')
      .attr('flood-color', '#000000')
      .attr('flood-opacity', '0.4');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3
      .scaleBand<string>()
      .domain(statsData.map((d) => d.shortName))
      .range([0, innerWidth])
      .padding(0.32);

    const maxY =
      metric === 'count'
        ? Math.max(5, d3.max(statsData, (d) => d.count) || 5)
        : Math.max(120, (d3.max(statsData, (d) => d.avgFlux) || 100) * 1.15);

    const yScale = d3.scaleLinear().domain([0, maxY]).nice().range([innerHeight, 0]);

    // Horizontal Grid Lines
    const yAxisTicks = yScale.ticks(4);
    g.append('g')
      .attr('class', 'grid-lines')
      .selectAll('line')
      .data(yAxisTicks)
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', '#1e293b')
      .attr('stroke-dasharray', '3,3')
      .attr('stroke-width', 1);

    // X Axis
    const xAxisGroup = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickSize(0));

    xAxisGroup.select('.domain').attr('stroke', '#334155');
    xAxisGroup
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '11px')
      .attr('font-family', 'monospace')
      .attr('dy', '14px');

    // Y Axis
    const yAxisGroup = g
      .append('g')
      .call(
        d3
          .axisLeft(yScale)
          .ticks(4)
          .tickFormat((d) => (metric === 'count' ? `${d}` : `${d}`))
          .tickSize(0)
      );

    yAxisGroup.select('.domain').attr('stroke', '#334155');
    yAxisGroup
      .selectAll('text')
      .attr('fill', '#64748b')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .attr('dx', '-4px');

    // Y Axis Label
    g.append('text')
      .attr('x', -8)
      .attr('y', -12)
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .attr('text-anchor', 'start')
      .text(metric === 'count' ? 'Titik' : 'µT');

    // Draw Bars with transition
    const bars = g
      .selectAll('.bar-group')
      .data(statsData)
      .enter()
      .append('g')
      .attr('class', 'bar-group')
      .attr('cursor', 'pointer');

    // Bar background slots
    bars
      .append('rect')
      .attr('x', (d) => xScale(d.shortName) || 0)
      .attr('y', 0)
      .attr('width', xScale.bandwidth())
      .attr('height', innerHeight)
      .attr('rx', 6)
      .attr('fill', '#0f172a')
      .attr('stroke', '#1e293b')
      .attr('stroke-width', 1)
      .attr('opacity', 0.6);

    // Active Data Bars
    bars
      .append('rect')
      .attr('class', 'active-bar')
      .attr('x', (d) => xScale(d.shortName) || 0)
      .attr('y', innerHeight)
      .attr('width', xScale.bandwidth())
      .attr('height', 0)
      .attr('rx', 6)
      .attr('fill', (d) => `url(#bar-grad-${d.category})`)
      .attr('stroke', (d) => d.color)
      .attr('stroke-width', (d) => (isCategorySelected(d.category) ? 2.5 : 1))
      .attr('opacity', (d) => (hasActiveFilter ? (isCategorySelected(d.category) ? 1.0 : 0.3) : 1.0))
      .attr('filter', 'url(#bar-shadow)')
      .transition()
      .duration(700)
      .ease(d3.easeCubicOut)
      .attr('y', (d) => yScale(metric === 'count' ? d.count : d.avgFlux))
      .attr('height', (d) => innerHeight - yScale(metric === 'count' ? d.count : d.avgFlux));

    // Value Labels on top of bars
    bars
      .append('text')
      .attr('class', 'bar-value-label')
      .attr('x', (d) => (xScale(d.shortName) || 0) + xScale.bandwidth() / 2)
      .attr('y', innerHeight)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('font-weight', 'bold')
      .attr('font-family', 'monospace')
      .attr('fill', (d) => d.color)
      .attr('opacity', (d) => (hasActiveFilter ? (isCategorySelected(d.category) ? 1.0 : 0.4) : 1.0))
      .transition()
      .duration(700)
      .ease(d3.easeCubicOut)
      .attr('y', (d) => {
        const val = metric === 'count' ? d.count : d.avgFlux;
        return yScale(val) - 6;
      })
      .tween('text', function (d) {
        const val = metric === 'count' ? d.count : d.avgFlux;
        const i = d3.interpolateNumber(0, val);
        return function (t) {
          const current = i(t);
          d3.select(this).text(
            metric === 'count'
              ? `${Math.round(current)}`
              : `${current.toFixed(0)}`
          );
        };
      });

    // Icons/Symbols inside or above bars
    bars
      .append('text')
      .attr('x', (d) => (xScale(d.shortName) || 0) + xScale.bandwidth() / 2)
      .attr('y', innerHeight - 8)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#ffffff')
      .attr('opacity', (d) => (hasActiveFilter ? (isCategorySelected(d.category) ? 0.95 : 0.35) : 0.85))
      .text((d) => d.symbol);

    // Interactive Hover & Click Handlers
    bars
      .on('mouseenter', function (event, d) {
        d3.select(this)
          .select('.active-bar')
          .transition()
          .duration(150)
          .attr('transform', 'scale(1.05)')
          .attr('transform-origin', `${(xScale(d.shortName) || 0) + xScale.bandwidth() / 2}px ${innerHeight}px`);

        setHoveredCategory(d);
      })
      .on('mouseleave', function () {
        d3.select(this)
          .select('.active-bar')
          .transition()
          .duration(150)
          .attr('transform', 'scale(1)');

        setHoveredCategory(null);
      })
      .on('click', function (event, d) {
        if (onSelectCategory) {
          const isCurrent = isCategorySelected(d.category);
          onSelectCategory(isCurrent ? 'all' : d.category);
        }
      });
  }, [findings, metric, statsData, selectedCategory, onSelectCategory]);

  return (
    <div
      ref={containerRef}
      className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-xl backdrop-blur-md flex flex-col gap-3"
    >
      {/* Header and Metric Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold tracking-wider uppercase text-slate-100 flex items-center gap-1.5 font-mono">
              <span>Distribusi Statistik Logam D3</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                d3.js v7
              </span>
              {selectedCategory && selectedCategory !== 'all' && (
                <button
                  type="button"
                  onClick={() => onSelectCategory?.('all')}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 flex items-center gap-1 transition-all"
                  title="Klik untuk melihat semua kategori"
                >
                  <span>Filter: {selectedCategory}</span>
                  <span>✕</span>
                </button>
              )}
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">
              Klik pada batang diagram atau gunakan dropdown untuk memfilter temuan
            </p>
          </div>
        </div>

        {/* Toggle between Count and Average Flux */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-mono self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMetric('count')}
            className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
              metric === 'count'
                ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-900/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Jumlah Temuan</span>
          </button>
          <button
            type="button"
            onClick={() => setMetric('avgFlux')}
            className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
              metric === 'avgFlux'
                ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-900/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3 h-3" />
            <span>Rerata Fluks (µT)</span>
          </button>
        </div>
      </div>

      {/* D3 SVG Chart Canvas */}
      <div className="relative w-full bg-slate-950/80 rounded-2xl border border-slate-800/80 p-2 overflow-hidden">
        <svg ref={svgRef} className="w-full h-auto block select-none" />

        {/* Dynamic Hovered Detail Card */}
        {hoveredCategory && (
          <div className="absolute top-2 right-2 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl p-2.5 shadow-xl text-xs font-mono pointer-events-none animate-in fade-in duration-150">
            <div className="flex items-center gap-1.5 font-bold" style={{ color: hoveredCategory.color }}>
              <span>{hoveredCategory.symbol}</span>
              <span>{hoveredCategory.name}</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-300 space-y-0.5">
              <div>
                Frekuensi: <strong>{hoveredCategory.count} titik</strong> ({hoveredCategory.percentage}%)
              </div>
              <div>
                Rata-rata: <strong>{hoveredCategory.avgFlux} µT</strong>
              </div>
              <div>
                Puncak: <strong>{hoveredCategory.maxFlux} µT</strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary Chips Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-center text-xs font-mono">
        {statsData.map((d) => (
          <div
            key={d.category}
            className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/80 flex flex-col items-center justify-center hover:border-slate-700 transition-colors"
          >
            <div className="flex items-center gap-1 text-[10px]" style={{ color: d.color }}>
              <span>{d.symbol}</span>
              <span className="font-semibold">{d.shortName}</span>
            </div>
            <div className="text-sm font-bold text-slate-100 mt-0.5">
              {d.count} <span className="text-[9px] text-slate-500 font-normal">titik</span>
            </div>
            <div className="text-[9px] text-slate-400">
              {d.percentage}% | ~{d.avgFlux} µT
            </div>
          </div>
        ))}
      </div>

      {/* Exploration Territory Insight Footer */}
      <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            Dominasi Area:{' '}
            <strong className="text-slate-200">
              {(() => {
                const top = [...statsData].sort((a, b) => b.count - a.count)[0];
                return top && top.count > 0 ? `${top.name} (${top.count} titik)` : 'Belum Terpetakan';
              })()}
            </strong>
          </span>
        </div>
        <span className="text-slate-500">Total: {totalFindings} titik terdaftar</span>
      </div>
    </div>
  );
};
