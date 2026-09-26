import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Mountain,
  AlertTriangle,
  ShieldCheck,
  Compass,
  RotateCcw,
  Eye,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  Play,
  Pause,
  MapPin,
  Flame,
  Info,
  ChevronRight,
  TrendingDown,
  Navigation,
} from 'lucide-react';
import {
  analyzeTerrainArea,
  TerrainAnalysisResult,
  TerrainGridPoint,
} from '../services/elevationTerrainService';
import { MetalFinding, GPSLocation } from '../types/detector';
import { HistoricalMarkerSite } from '../types/historicalSite';

interface Terrain3DAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  centerLocation: { lat: number; lng: number; title: string };
  userLocation: GPSLocation | null;
  findings: MetalFinding[];
  historicalSites?: HistoricalMarkerSite[];
  onFlyToLocation?: (lat: number, lng: number) => void;
}

export const Terrain3DAnalysisModal: React.FC<Terrain3DAnalysisModalProps> = ({
  isOpen,
  onClose,
  centerLocation,
  userLocation,
  findings,
  historicalSites = [],
  onFlyToLocation,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Analysis state
  const [radiusMeters, setRadiusMeters] = useState<number>(100);
  const [analysis, setAnalysis] = useState<TerrainAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 3D Viewport controls
  const [yaw, setYaw] = useState<number>(45); // horizontal rotation in degrees
  const [pitch, setPitch] = useState<number>(38); // vertical tilt in degrees (15 to 80)
  const [zoom, setZoom] = useState<number>(1.15); // zoom factor
  const [heightScale, setHeightScale] = useState<number>(2.2); // vertical exaggeration factor
  const [colorMode, setColorMode] = useState<'slope' | 'elevation'>('slope');
  const [showWireframe, setShowWireframe] = useState<boolean>(true);
  const [showFindingsMarkers, setShowFindingsMarkers] = useState<boolean>(true);
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(false);
  const [hoveredPoint, setHoveredPoint] = useState<TerrainGridPoint | null>(null);

  // Drag interaction
  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Load terrain analysis on center change or radius change
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);

    analyzeTerrainArea(centerLocation.lat, centerLocation.lng, radiusMeters, 13)
      .then((res) => {
        if (isMounted) {
          setAnalysis(res);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, centerLocation.lat, centerLocation.lng, radiusMeters]);

  // Auto-rotation loop
  useEffect(() => {
    if (!isAutoRotating) return;

    const timer = setInterval(() => {
      setYaw((prev) => (prev + 0.75) % 360);
    }, 35);

    return () => clearInterval(timer);
  }, [isAutoRotating]);

  // Project 3D points to 2D screen coordinates
  const project3D = (
    worldX: number,
    worldY: number,
    worldZ: number,
    canvasW: number,
    canvasH: number,
    yawDeg: number,
    pitchDeg: number,
    scale: number,
    zScale: number,
    minElev: number,
    maxElev: number
  ) => {
    // Normalize coordinates around origin (-1 to 1)
    const radYaw = (yawDeg * Math.PI) / 180;
    const radPitch = (pitchDeg * Math.PI) / 180;

    // Rotation around Z axis (Yaw)
    const x1 = worldX * Math.cos(radYaw) - worldY * Math.sin(radYaw);
    const y1 = worldX * Math.sin(radYaw) + worldY * Math.cos(radYaw);

    // Height offset normalized
    const elevSpan = Math.max(1, maxElev - minElev);
    const normZ = ((worldZ - minElev) / elevSpan) * 0.55 * zScale;

    // Tilt around X axis (Pitch)
    const x2 = x1;
    const y2 = y1 * Math.cos(radPitch) - normZ * Math.sin(radPitch);
    const z2 = y1 * Math.sin(radPitch) + normZ * Math.cos(radPitch);

    // Isometric projection with slight perspective
    const fov = 3.5;
    const dist = 3.2 - z2 * 0.2;
    const projX = (x2 / dist) * fov;
    const projY = (y2 / dist) * fov;

    const baseUnit = Math.min(canvasW, canvasH) * 0.38 * scale;
    const screenX = canvasW / 2 + projX * baseUnit;
    const screenY = canvasH / 2 + projY * baseUnit;

    return { x: screenX, y: screenY, depth: z2 };
  };

  // Slope color calculation
  const getSlopeColor = (slopeDeg: number) => {
    if (slopeDeg < 10) return { fill: '#10b981', stroke: '#34d399', label: 'Datar / Aman' }; // Emerald
    if (slopeDeg < 20) return { fill: '#eab308', stroke: '#fde047', label: 'Sedang' }; // Yellow
    if (slopeDeg < 30) return { fill: '#f97316', stroke: '#fb923c', label: 'Curam' }; // Orange
    return { fill: '#ef4444', stroke: '#f87171', label: 'Bahaya Jurang' }; // Red
  };

  // Elevation color calculation
  const getElevationColor = (elev: number, minE: number, maxE: number) => {
    const ratio = Math.max(0, Math.min(1, (elev - minE) / Math.max(1, maxE - minE)));
    if (ratio < 0.25) return { fill: '#0284c7', stroke: '#38bdf8' }; // Deep cyan
    if (ratio < 0.5) return { fill: '#10b981', stroke: '#34d399' }; // Emerald
    if (ratio < 0.75) return { fill: '#eab308', stroke: '#facc15' }; // Gold
    return { fill: '#f43f5e', stroke: '#fb7185' }; // Mountain peak rose
  };

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analysis) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Draw tactical grid background
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const { gridSize, points, minElevation, maxElevation } = analysis;
    const half = (gridSize - 1) / 2;

    // Project all grid points
    const projectedGrid: { x: number; y: number; depth: number }[][] = [];
    for (let r = 0; r < gridSize; r++) {
      projectedGrid[r] = [];
      for (let c = 0; c < gridSize; c++) {
        const pt = points[r * gridSize + c];
        const wx = (c - half) / half;
        const wy = (r - half) / half;
        const proj = project3D(
          wx,
          wy,
          pt.elevation,
          width,
          height,
          yaw,
          pitch,
          zoom,
          heightScale,
          minElevation,
          maxElevation
        );
        projectedGrid[r][c] = proj;
      }
    }

    // Build polygons (cells) with depth ordering (Painter's algorithm)
    interface CellPolygon {
      row: number;
      col: number;
      p0: { x: number; y: number; depth: number };
      p1: { x: number; y: number; depth: number };
      p2: { x: number; y: number; depth: number };
      p3: { x: number; y: number; depth: number };
      avgDepth: number;
      slope: number;
      avgElevation: number;
      isDanger: boolean;
    }

    const polygons: CellPolygon[] = [];
    for (let r = 0; r < gridSize - 1; r++) {
      for (let c = 0; c < gridSize - 1; c++) {
        const p0 = projectedGrid[r][c];
        const p1 = projectedGrid[r][c + 1];
        const p2 = projectedGrid[r + 1][c + 1];
        const p3 = projectedGrid[r + 1][c];

        const pt0 = points[r * gridSize + c];
        const pt1 = points[r * gridSize + (c + 1)];
        const pt2 = points[(r + 1) * gridSize + (c + 1)];
        const pt3 = points[(r + 1) * gridSize + c];

        const avgDepth = (p0.depth + p1.depth + p2.depth + p3.depth) / 4;
        const avgSlope = (pt0.slopeDegrees + pt1.slopeDegrees + pt2.slopeDegrees + pt3.slopeDegrees) / 4;
        const avgElev = (pt0.elevation + pt1.elevation + pt2.elevation + pt3.elevation) / 4;
        const isDanger = avgSlope >= 22;

        polygons.push({
          row: r,
          col: c,
          p0,
          p1,
          p2,
          p3,
          avgDepth,
          slope: avgSlope,
          avgElevation: avgElev,
          isDanger,
        });
      }
    }

    // Sort far to near
    polygons.sort((a, b) => b.avgDepth - a.avgDepth);

    // Draw polygons
    polygons.forEach((poly) => {
      ctx.beginPath();
      ctx.moveTo(poly.p0.x, poly.p0.y);
      ctx.lineTo(poly.p1.x, poly.p1.y);
      ctx.lineTo(poly.p2.x, poly.p2.y);
      ctx.lineTo(poly.p3.x, poly.p3.y);
      ctx.closePath();

      let colors =
        colorMode === 'slope'
          ? getSlopeColor(poly.slope)
          : getElevationColor(poly.avgElevation, minElevation, maxElevation);

      // Gradient fill with slight depth shading
      const depthShade = Math.max(0.4, Math.min(1.0, 1 - (poly.avgDepth + 1) * 0.15));
      ctx.fillStyle = colors.fill;
      ctx.globalAlpha = poly.isDanger ? 0.88 : 0.72;
      ctx.fill();

      // Danger stripes or outline for steep slopes
      if (poly.slope >= 30) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (showWireframe) {
        ctx.strokeStyle = colors.stroke;
        ctx.globalAlpha = 0.45 * depthShade;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });

    ctx.globalAlpha = 1.0;

    // Draw Center Compass Bearing Indicator at terrain base
    const centerPt = projectedGrid[half][half];
    if (centerPt) {
      ctx.beginPath();
      ctx.arc(centerPt.x, centerPt.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#06b6d4';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Center crosshair
      ctx.beginPath();
      ctx.arc(centerPt.x, centerPt.y, 14, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.7)';
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw Project Findings / Relics in 3D
    if (showFindingsMarkers && findings.length > 0) {
      findings.forEach((finding) => {
        const deltaLat = finding.lat - centerLocation.lat;
        const deltaLng = finding.lng - centerLocation.lng;
        const metersY = deltaLat * 111320;
        const metersX = deltaLng * 111320 * Math.cos((centerLocation.lat * Math.PI) / 180);

        // Check if within bounds
        if (Math.abs(metersX) <= radiusMeters && Math.abs(metersY) <= radiusMeters) {
          const normX = metersX / radiusMeters;
          const normY = -metersY / radiusMeters;

          // Approximate elevation of nearest cell
          const proj = project3D(
            normX,
            normY,
            analysis.centerElevation,
            width,
            height,
            yaw,
            pitch,
            zoom,
            heightScale,
            minElevation,
            maxElevation
          );

          // Render marker pin
          ctx.beginPath();
          ctx.arc(proj.x, proj.y - 12, 5, 0, Math.PI * 2);
          ctx.fillStyle =
            finding.category === 'gold'
              ? '#eab308'
              : finding.category === 'meteorite'
              ? '#c084fc'
              : '#38bdf8';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Anchor pin line
          ctx.beginPath();
          ctx.moveTo(proj.x, proj.y);
          ctx.lineTo(proj.x, proj.y - 12);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });
    }

    // Draw User Location Marker if in radius
    if (userLocation) {
      const deltaLat = userLocation.lat - centerLocation.lat;
      const deltaLng = userLocation.lng - centerLocation.lng;
      const metersY = deltaLat * 111320;
      const metersX = deltaLng * 111320 * Math.cos((centerLocation.lat * Math.PI) / 180);

      if (Math.abs(metersX) <= radiusMeters && Math.abs(metersY) <= radiusMeters) {
        const normX = metersX / radiusMeters;
        const normY = -metersY / radiusMeters;

        const proj = project3D(
          normX,
          normY,
          analysis.centerElevation,
          width,
          height,
          yaw,
          pitch,
          zoom,
          heightScale,
          minElevation,
          maxElevation
        );

        // Pulsing User GPS Marker
        ctx.beginPath();
        ctx.arc(proj.x, proj.y - 16, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#10b981';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('POSISI GPS', proj.x + 10, proj.y - 14);
      }
    }
  }, [
    analysis,
    yaw,
    pitch,
    zoom,
    heightScale,
    colorMode,
    showWireframe,
    showFindingsMarkers,
    findings,
    userLocation,
    centerLocation,
    radiusMeters,
  ]);

  // Mouse / Touch handlers for 3D Orbit Dragging
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;

    const deltaX = e.clientX - lastMousePosRef.current.x;
    const deltaY = e.clientY - lastMousePosRef.current.y;

    setYaw((prev) => (prev + deltaX * 0.6) % 360);
    setPitch((prev) => Math.max(12, Math.min(80, prev - deltaY * 0.5)));

    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      lastMousePosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || e.touches.length !== 1) return;

    const deltaX = e.touches[0].clientX - lastMousePosRef.current.x;
    const deltaY = e.touches[0].clientY - lastMousePosRef.current.y;

    setYaw((prev) => (prev + deltaX * 0.6) % 360);
    setPitch((prev) => Math.max(12, Math.min(80, prev - deltaY * 0.5)));

    lastMousePosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  // Cross section elevation profile across center line
  const crossSectionPoints = useMemo(() => {
    if (!analysis) return [];
    const { gridSize, points } = analysis;
    const midRow = Math.floor(gridSize / 2);
    const slice: { col: number; elev: number; slope: number }[] = [];
    for (let c = 0; c < gridSize; c++) {
      const pt = points[midRow * gridSize + c];
      slice.push({ col: c, elev: pt.elevation, slope: pt.slopeDegrees });
    }
    return slice;
  }, [analysis]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[95vh] flex flex-col bg-slate-950 border border-emerald-500/40 rounded-3xl shadow-2xl shadow-emerald-950/50 overflow-hidden ring-1 ring-white/10">
        {/* Top Header */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Mountain className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold font-mono text-white flex items-center gap-1.5">
                  <span>Terrain 3D Analysis</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                    Elevasi & Kemiringan Lereng
                  </span>
                </h3>
              </div>
              <p className="text-xs text-slate-400 font-mono flex items-center gap-1 truncate max-w-md">
                <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                <span className="truncate">{centerLocation.title}</span>
                <span className="text-slate-500 text-[10px]">
                  ({centerLocation.lat.toFixed(4)}, {centerLocation.lng.toFixed(4)})
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Radius Selector */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-mono">
              <span className="text-slate-400 px-1 text-[10px] hidden sm:inline">Radius:</span>
              {[50, 100, 200].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRadiusMeters(r)}
                  className={`px-2 py-0.5 rounded-lg transition-all ${
                    radiusMeters === r
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {r}m
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Danger Warning Banner if Peak Slope > 22° */}
        {analysis?.dangerWarning && (
          <div
            className={`px-4 py-2.5 flex items-start gap-2.5 text-xs font-mono border-b ${
              analysis.maxSlope >= 30
                ? 'bg-red-950/80 border-red-500/60 text-red-200'
                : 'bg-amber-950/80 border-amber-500/60 text-amber-200'
            }`}
          >
            <AlertTriangle
              className={`w-4 h-4 shrink-0 mt-0.5 ${
                analysis.maxSlope >= 30 ? 'text-red-400 animate-bounce' : 'text-amber-400'
              }`}
            />
            <div className="flex-1 leading-snug">
              <strong className="font-bold">
                {analysis.maxSlope >= 30 ? 'BAHAYA JURANG / TEBING CURAM:' : 'WASPADA LERENG:'}
              </strong>{' '}
              {analysis.dangerWarning}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-3 sm:p-4 space-y-3.5">
          {/* 3D Canvas Viewport Box */}
          <div className="relative w-full h-[280px] sm:h-[340px] bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-inner group">
            {isLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-cyan-400 font-mono text-xs">
                <Mountain className="w-8 h-8 animate-bounce" />
                <span>Memuat data elevasi & kalkulasi vektor kemiringan lereng 3D...</span>
              </div>
            ) : (
              <>
                <canvas
                  ref={canvasRef}
                  width={720}
                  height={340}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleMouseUp}
                  className="w-full h-full cursor-grab active:cursor-grabbing block"
                />

                {/* On-Canvas HUD Controls */}
                <div className="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1.5 pointer-events-auto">
                  {/* Mode Color Switcher */}
                  <div className="flex items-center bg-slate-900/90 backdrop-blur-md p-0.5 rounded-xl border border-slate-700 text-[10px] font-mono shadow-lg">
                    <button
                      type="button"
                      onClick={() => setColorMode('slope')}
                      className={`px-2 py-1 rounded-lg transition-all ${
                        colorMode === 'slope'
                          ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Kemiringan Lereng (°)
                    </button>
                    <button
                      type="button"
                      onClick={() => setColorMode('elevation')}
                      className={`px-2 py-1 rounded-lg transition-all ${
                        colorMode === 'elevation'
                          ? 'bg-sky-500 text-slate-950 font-bold shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Elevasi (m)
                    </button>
                  </div>

                  {/* Auto Rotate Button */}
                  <button
                    type="button"
                    onClick={() => setIsAutoRotating(!isAutoRotating)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[10px] font-mono backdrop-blur-md shadow-lg transition-all ${
                      isAutoRotating
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                        : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    {isAutoRotating ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    <span>{isAutoRotating ? 'Pause Orbit' : 'Auto 3D'}</span>
                  </button>

                  {/* Wireframe toggle */}
                  <button
                    type="button"
                    onClick={() => setShowWireframe(!showWireframe)}
                    className={`px-2 py-1 rounded-xl border text-[10px] font-mono backdrop-blur-md transition-all ${
                      showWireframe
                        ? 'bg-slate-800 border-slate-600 text-white'
                        : 'bg-slate-900/80 border-slate-800 text-slate-500'
                    }`}
                  >
                    Mesh Wireframe
                  </button>
                </div>

                {/* Compass & Rotation HUD bottom right */}
                <div className="absolute bottom-2.5 right-2.5 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-slate-700 text-[10px] font-mono text-slate-300 shadow-xl pointer-events-none">
                  <Compass className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Azimuth: {Math.round(yaw)}°</span>
                  <span>•</span>
                  <span>Elev: {Math.round(pitch)}°</span>
                </div>

                {/* Reset View Button */}
                <button
                  type="button"
                  onClick={() => {
                    setYaw(45);
                    setPitch(38);
                    setZoom(1.15);
                    setHeightScale(2.2);
                  }}
                  className="absolute bottom-2.5 left-2.5 flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700 text-[10px] font-mono text-slate-400 hover:text-white transition-all shadow-lg"
                  title="Reset Sudut Pandang Kamera 3D"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Sudut</span>
                </button>
              </>
            )}
          </div>

          {/* Slope Danger Spectrum Legend */}
          <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 font-bold flex items-center gap-1.5">
                <span>Indeks Kemiringan Medan Metal Detecting:</span>
              </span>
              <span className="text-[10px] text-slate-400">
                Putar / seret mouse untuk inspeksi 360°
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-[11px] font-mono flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0"></div>
                <div>
                  <div className="font-bold text-emerald-300">&lt; 10° Datar / Aman</div>
                  <div className="text-[9px] text-slate-400">Ideal akumulasi relik</div>
                </div>
              </div>

              <div className="p-2 rounded-xl bg-yellow-950/40 border border-yellow-500/40 text-[11px] font-mono flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500 shrink-0"></div>
                <div>
                  <div className="font-bold text-yellow-300">10° - 20° Sedang</div>
                  <div className="text-[9px] text-slate-400">Perbukitan terkontrol</div>
                </div>
              </div>

              <div className="p-2 rounded-xl bg-orange-950/40 border border-orange-500/40 text-[11px] font-mono flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500 shrink-0"></div>
                <div>
                  <div className="font-bold text-orange-300">20° - 30° Curam</div>
                  <div className="text-[9px] text-slate-400">Waspada tergelincir</div>
                </div>
              </div>

              <div className="p-2 rounded-xl bg-red-950/40 border border-red-500/60 text-[11px] font-mono flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500 shrink-0 animate-ping"></div>
                <div>
                  <div className="font-bold text-red-300">&gt; 30° Bahaya Jurang</div>
                  <div className="text-[9px] text-red-400">Hindari pencarian</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics KPI Grid */}
          {analysis && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 block uppercase">Kemiringan Puncak</span>
                <span
                  className={`text-lg font-bold block ${
                    analysis.maxSlope >= 30
                      ? 'text-red-400'
                      : analysis.maxSlope >= 20
                      ? 'text-orange-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {analysis.maxSlope}°
                </span>
                <span className="text-[10px] text-slate-500">Rata-rata: {analysis.averageSlope}°</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 block uppercase">Elevasi (mdpl)</span>
                <span className="text-lg font-bold text-cyan-300 block">
                  {analysis.centerElevation} m
                </span>
                <span className="text-[10px] text-slate-500">
                  Rentang: {analysis.minElevation} - {analysis.maxElevation} m
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 block uppercase">Area Berbahaya (&gt;20°)</span>
                <span
                  className={`text-lg font-bold block ${
                    analysis.dangerAreaPercentage >= 25 ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  {analysis.dangerAreaPercentage}%
                </span>
                <span className="text-[10px] text-slate-500">Dari total radius survei</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 block uppercase">Status Keamanan</span>
                <span
                  className={`text-sm font-bold block ${
                    analysis.safetyRating === 'BAHAYA EKSTREM'
                      ? 'text-red-400'
                      : analysis.safetyRating === 'WASPADA LERENG'
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {analysis.safetyRating}
                </span>
                <span className="text-[10px] text-slate-500">Survei Detektor Logam</span>
              </div>
            </div>
          )}

          {/* Cross-Section 2D Slice Profile */}
          {crossSectionPoints.length > 0 && (
            <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 font-bold flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Profil Penampang Melintang Elevasi (Barat ke Timur)</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  Toleransi lereng aman: &lt; 20°
                </span>
              </div>

              <div className="h-20 w-full flex items-end gap-1 pt-2">
                {crossSectionPoints.map((pt, idx) => {
                  const minE = analysis?.minElevation || 0;
                  const maxE = analysis?.maxElevation || 100;
                  const span = Math.max(1, maxE - minE);
                  const heightPercent = Math.max(15, Math.min(100, ((pt.elev - minE) / span) * 100));
                  const isSteep = pt.slope >= 22;

                  return (
                    <div
                      key={idx}
                      className="flex-1 flex flex-col items-center gap-1 group relative"
                    >
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full rounded-t transition-all ${
                          isSteep
                            ? 'bg-red-500 group-hover:bg-red-400'
                            : pt.slope >= 12
                            ? 'bg-amber-500 group-hover:bg-amber-400'
                            : 'bg-emerald-500 group-hover:bg-emerald-400'
                        }`}
                      />
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center bg-slate-950 p-1.5 rounded-lg border border-slate-700 text-[9px] font-mono whitespace-nowrap z-20 shadow-xl">
                        <span className="text-white font-bold">{pt.elev} m</span>
                        <span className={isSteep ? 'text-red-400' : 'text-emerald-400'}>
                          {pt.slope}° {isSteep ? '(Curam)' : '(Aman)'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
                <span>← Sisi Barat (-{radiusMeters}m)</span>
                <span className="text-cyan-400 font-bold">Titik Pusat Survei (0m)</span>
                <span>Sisi Timur (+{radiusMeters}m) →</span>
              </div>
            </div>
          )}

          {/* Tactical Advice for Metal Detecting on Slopes */}
          <div className="p-3 rounded-2xl bg-cyan-950/30 border border-cyan-500/40 text-xs font-sans text-cyan-200 space-y-1.5">
            <div className="font-bold font-mono text-cyan-300 flex items-center gap-1.5">
              <span>🛡️ Prosedur Keselamatan Ayunan Detektor di Medan Miring:</span>
            </div>
            <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-1">
              <li>
                <strong>Arah Ayunan Melintang:</strong> Selalu ayunkan koil sejajar dengan garis kontur (horizontal), jangan mengayun vertikal menanjak atau menurun agar tidak kehilangan keseimbangan tubuh.
              </li>
              <li>
                <strong>Hindari Melangkah Mundur:</strong> Jangan melangkah ke belakang saat menggali di lereng &gt; 15°. Periksa bebatuan lepas sebelum meletakkan pinpointer atau sekop.
              </li>
              <li>
                <strong>Perangkap Relik Kuno:</strong> Artefak logam berat yang tererosi sering berhenti di teras tanah datar (kemiringan &lt; 10°) atau di balik akar pohon besar di bagian bawah lereng.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Data Elevasi: SRTM Open Elevation DEM</span>
          </div>

          <div className="flex items-center gap-2">
            {onFlyToLocation && (
              <button
                type="button"
                onClick={() => {
                  onFlyToLocation(centerLocation.lat, centerLocation.lng);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs shadow-md transition-all active:scale-95"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Pusatkan di Peta Utama</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
