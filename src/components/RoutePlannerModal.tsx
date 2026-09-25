import React, { useState, useMemo } from 'react';
import {
  Route,
  Navigation,
  Compass,
  Clock,
  Footprints,
  Shovel,
  Sparkles,
  ExternalLink,
  Download,
  Trash2,
  CheckCircle2,
  X,
  Layers,
  ArrowRight,
  Maximize2,
  Sliders,
  ChevronRight,
  MapPin,
  Flame,
  Radio,
  Share2,
} from 'lucide-react';
import { MetalFinding, GPSLocation, MetalCategory } from '../types/detector';
import {
  ExcavationRoute,
  RouteAlgorithm,
  planExcavationRoute,
  generateGoogleMapsRouteUrl,
  generateRouteGPX,
  calculateDistanceMeters,
} from '../services/routePlannerService';
import { SoilDepthIndicator } from './SoilDepthIndicator';
import { targetCenterAlarmService } from '../services/targetCenterAlarm';

interface RoutePlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  findings: MetalFinding[];
  userLocation: GPSLocation | null;
  selectedFindingIds: string[];
  onToggleFindingSelection: (id: string) => void;
  onSelectAllFindings: () => void;
  onClearSelectedFindings: () => void;
  onSelectValuableFindings: () => void;
  activeAlgorithm: RouteAlgorithm;
  onChangeAlgorithm: (algo: RouteAlgorithm) => void;
  startFromUserGPS: boolean;
  onToggleStartFromUserGPS: (val: boolean) => void;
  isRoundTrip: boolean;
  onToggleIsRoundTrip: (val: boolean) => void;
  onFocusWaypointOnMap?: (finding: MetalFinding) => void;
}

export const RoutePlannerModal: React.FC<RoutePlannerModalProps> = ({
  isOpen,
  onClose,
  findings,
  userLocation,
  selectedFindingIds,
  onToggleFindingSelection,
  onSelectAllFindings,
  onClearSelectedFindings,
  onSelectValuableFindings,
  activeAlgorithm,
  onChangeAlgorithm,
  startFromUserGPS,
  onToggleStartFromUserGPS,
  isRoundTrip,
  onToggleIsRoundTrip,
  onFocusWaypointOnMap,
}) => {
  const [activeTab, setActiveTab] = useState<'itinerary' | 'selection'>('itinerary');
  const [activeWaypointIndex, setActiveWaypointIndex] = useState<number>(0);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Filter selected findings
  const selectedFindingsList = useMemo(() => {
    const idSet = new Set(selectedFindingIds);
    return findings.filter((f) => idSet.has(f.id));
  }, [findings, selectedFindingIds]);

  // Compute calculated route
  const calculatedRoute: ExcavationRoute | null = useMemo(() => {
    if (selectedFindingsList.length === 0) return null;
    return planExcavationRoute({
      selectedFindings: selectedFindingsList,
      userLocation,
      startFromUserGPS,
      algorithm: activeAlgorithm,
      isRoundTrip,
    });
  }, [selectedFindingsList, userLocation, startFromUserGPS, activeAlgorithm, isRoundTrip]);

  // Download GPX File
  const handleDownloadGPX = () => {
    if (!calculatedRoute) return;
    const gpxString = generateRouteGPX(calculatedRoute);
    const blob = new Blob([gpxString], { type: 'application/gpx+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rute-ekspedisi-${new Date().toISOString().slice(0, 10)}.gpx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy Route Itinerary Text
  const handleCopyItinerary = () => {
    if (!calculatedRoute) return;
    let text = `🧭 PERENCANA RUTE PENGGALIAN LOGAM (MetalScan PRO)\n`;
    text += `Algoritma: ${
      activeAlgorithm === 'two_opt'
        ? 'Optimal 2-Opt TSP'
        : activeAlgorithm === 'value_priority'
        ? 'Prioritas Nilai & Kedalaman'
        : 'Rute Terdekat (Nearest Neighbor)'
    }\n`;
    text += `Total Jarak: ${(calculatedRoute.totalDistanceMeters / 1000).toFixed(2)} km (${calculatedRoute.totalDistanceMeters.toFixed(0)}m)\n`;
    text += `Total Waktu Ekspedisi: ~${calculatedRoute.totalExpeditionMinutes} menit (Jalan: ${calculatedRoute.totalWalkingMinutes}m, Penggalian: ${calculatedRoute.totalDiggingMinutes}m)\n`;
    text += `Titik Awal: ${calculatedRoute.startLocation.label}\n\n`;
    text += `JADWAL PENGGALIAN LANGKAH-DEMI-LANGKAH:\n`;

    calculatedRoute.waypoints.forEach((w) => {
      text += `[Stop #${w.stepNumber}] ${w.finding.name}\n`;
      text += `  • Jarak dari pos sebelumnya: ${w.distanceFromPrevMeters.toFixed(0)}m (${w.bearingFromPrevDegrees}° ${w.cardinalDirection})\n`;
      text += `  • Kategori: ${w.finding.category.toUpperCase()} | Kedalaman: ${w.finding.depthEstimateCm} cm (~${w.estimatedDigTimeMinutes} menit)\n`;
      text += `  • Koordinat: ${w.lat.toFixed(5)}, ${w.lng.toFixed(5)}\n\n`;
    });

    if (calculatedRoute.isRoundTrip) {
      text += `[Finish] Kembali ke titik awal (${calculatedRoute.startLocation.label})\n`;
    }

    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-900/30 text-white">
              <Route className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-1.5">
                  Route Planner Penggalian
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold">
                  TSP Optimizer
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Hitung jalur terpendek dan urutan penggalian optimal antar temuan logam
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Algorithm & Origin Settings Bar */}
        <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Metode Rute:</span>
              <button
                type="button"
                onClick={() => onChangeAlgorithm('two_opt')}
                className={`px-2.5 py-1 rounded-xl text-xs font-mono transition-all border ${
                  activeAlgorithm === 'two_opt'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="Menggunakan optimasi heuristik 2-Opt TSP untuk mencari rute paling efisien tanpa garis silang"
              >
                ★ Jalur Optimal (2-Opt TSP)
              </button>
              <button
                type="button"
                onClick={() => onChangeAlgorithm('nearest_neighbor')}
                className={`px-2.5 py-1 rounded-xl text-xs font-mono transition-all border ${
                  activeAlgorithm === 'nearest_neighbor'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="Menghubungkan titik sasaran terdekat secara berurutan"
              >
                Rute Terdekat
              </button>
              <button
                type="button"
                onClick={() => onChangeAlgorithm('value_priority')}
                className={`px-2.5 py-1 rounded-xl text-xs font-mono transition-all border ${
                  activeAlgorithm === 'value_priority'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="Memprioritaskan temuan bernilai tinggi (Emas/Meteorit) dan lapisan dangkal terlebih dahulu"
              >
                Prioritas Nilai / Dangkal
              </button>
            </div>

            <div className="flex items-center gap-3">
              {/* Start from GPS */}
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-mono text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={startFromUserGPS}
                  onChange={(e) => onToggleStartFromUserGPS(e.target.checked)}
                  disabled={!userLocation}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0 bg-slate-900 w-3.5 h-3.5"
                />
                <span className={!userLocation ? 'text-slate-500' : ''}>Mulai dari GPS Saya</span>
              </label>

              {/* Round Trip */}
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-mono text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={isRoundTrip}
                  onChange={(e) => onToggleIsRoundTrip(e.target.checked)}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0 bg-slate-900 w-3.5 h-3.5"
                />
                <span>Rute Melingkar</span>
              </label>
            </div>
          </div>
        </div>

        {/* Route Stats Metric Highlights */}
        {calculatedRoute && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 sm:px-4 bg-slate-950/40 border-b border-slate-800">
            <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-2.5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
                <Footprints className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase block">Total Jarak</span>
                <span className="text-sm font-bold font-mono text-slate-100">
                  {calculatedRoute.totalDistanceMeters >= 1000
                    ? `${(calculatedRoute.totalDistanceMeters / 1000).toFixed(2)} km`
                    : `${calculatedRoute.totalDistanceMeters.toFixed(0)} m`}
                </span>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-2.5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase block">Waktu Jalan</span>
                <span className="text-sm font-bold font-mono text-slate-100">
                  ~{calculatedRoute.totalWalkingMinutes} mnt
                </span>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-2.5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                <Shovel className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase block">Est. Gali</span>
                <span className="text-sm font-bold font-mono text-slate-100">
                  ~{calculatedRoute.totalDiggingMinutes} mnt
                </span>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-2.5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase block">Total Ekspedisi</span>
                <span className="text-sm font-bold font-mono text-purple-300">
                  ~{calculatedRoute.totalExpeditionMinutes} mnt
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab Switcher: Itinerary Timeline vs Pick Points */}
        <div className="px-4 pt-2.5 pb-1 flex items-center justify-between border-b border-slate-800/70 bg-slate-900/60">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('itinerary')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-all ${
                activeTab === 'itinerary'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Route className="w-3.5 h-3.5" />
              <span>Urutan Jalur ({calculatedRoute ? calculatedRoute.waypoints.length : 0})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('selection')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-all ${
                activeTab === 'selection'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Pilih Titik ({selectedFindingIds.length}/{findings.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onSelectAllFindings}
              className="text-[11px] font-mono px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Pilih seluruh titik temuan yang tersimpan"
            >
              Semua
            </button>
            <button
              type="button"
              onClick={onSelectValuableFindings}
              className="text-[11px] font-mono px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors"
              title="Pilih hanya temuan bernilai tinggi (Emas, Meteorit, Perak)"
            >
              ★ Bernilai
            </button>
            {selectedFindingIds.length > 0 && (
              <button
                type="button"
                onClick={onClearSelectedFindings}
                className="text-[11px] font-mono px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
              >
                Hapus
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === 'itinerary' && (
            <>
              {!calculatedRoute || calculatedRoute.waypoints.length === 0 ? (
                <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-3xl bg-slate-950/40">
                  <Route className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-slate-300 mb-1">Belum Ada Titik Sasaran Dipilih</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4 font-mono">
                    Pilih minimal 1 atau beberapa titik temuan dari tab &ldquo;Pilih Titik&rdquo; atau langsung klik pin di peta untuk menghitung rute penggalian terdekat.
                  </p>
                  <button
                    type="button"
                    onClick={onSelectAllFindings}
                    className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-emerald-600 text-white rounded-xl text-xs font-mono font-bold shadow-md hover:from-cyan-500 hover:to-emerald-500 transition-all"
                  >
                    Pilih Semua ({findings.length} Titik)
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {/* Origin Step Header */}
                  <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-400 text-cyan-300 flex items-center justify-center font-mono font-bold text-xs">
                        S
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-cyan-400 uppercase font-semibold">
                          Titik Awal Ekspedisi:
                        </span>
                        <h5 className="text-xs font-bold text-slate-200">{calculatedRoute.startLocation.label}</h5>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {calculatedRoute.startLocation.lat.toFixed(5)}, {calculatedRoute.startLocation.lng.toFixed(5)}
                    </span>
                  </div>

                  {/* Waypoint Steps */}
                  {calculatedRoute.waypoints.map((wp, idx) => {
                    const isFocus = activeWaypointIndex === idx;
                    const catColor =
                      wp.finding.category === 'gold'
                        ? '#eab308'
                        : wp.finding.category === 'meteorite'
                        ? '#c084fc'
                        : wp.finding.category === 'silver'
                        ? '#38bdf8'
                        : wp.finding.category === 'bronze'
                        ? '#f97316'
                        : '#94a3b8';

                    return (
                      <div
                        key={wp.id}
                        className={`p-3 rounded-2xl border transition-all ${
                          isFocus
                            ? 'bg-slate-950 border-cyan-500/80 shadow-lg shadow-cyan-950/50'
                            : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                        }`}
                        onClick={() => setActiveWaypointIndex(idx)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            {/* Step Number Circle */}
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center font-mono font-bold text-xs shrink-0 text-slate-900 shadow-md"
                              style={{ backgroundColor: catColor }}
                            >
                              {wp.stepNumber}
                            </div>

                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h5 className="text-xs font-bold text-slate-100">{wp.finding.name}</h5>
                                <span
                                  className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded-full font-bold"
                                  style={{
                                    backgroundColor: `${catColor}20`,
                                    color: catColor,
                                    border: `1px solid ${catColor}40`,
                                  }}
                                >
                                  {wp.finding.category}
                                </span>
                              </div>

                              {/* Leg Nav info */}
                              <div className="mt-1 flex items-center gap-2 text-xs font-mono text-slate-400 flex-wrap">
                                <span className="flex items-center gap-1 text-cyan-300 font-semibold">
                                  <Compass className="w-3 h-3 text-cyan-400" />
                                  <span>
                                    {wp.distanceFromPrevMeters.toFixed(0)}m • {wp.bearingFromPrevDegrees}°{' '}
                                    {wp.cardinalDirection}
                                  </span>
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-amber-400">
                                  <Shovel className="w-3 h-3" />
                                  <span>{wp.finding.depthEstimateCm} cm (~{wp.estimatedDigTimeMinutes} mnt)</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            {onFocusWaypointOnMap && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onFocusWaypointOnMap(wp.finding);
                                  onClose();
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-white transition-colors"
                                title="Lihat titik ini di peta Leaflet"
                              >
                                <Maximize2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Set Alarm */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                targetCenterAlarmService.toggleAlarm(
                                  {
                                    id: wp.finding.id,
                                    name: wp.finding.name,
                                    category: wp.finding.category,
                                    lat: wp.finding.lat,
                                    lng: wp.finding.lng,
                                    depthEstimateCm: wp.finding.depthEstimateCm,
                                  },
                                  userLocation?.lat,
                                  userLocation?.lng
                                );
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-white transition-colors"
                              title="Setel Sensor Alarm Titik Pusat ke sasaran ini"
                            >
                              <Radio className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Extra leg information */}
                        <div className="mt-2 pt-2 border-t border-slate-900 flex items-center justify-between text-[10px] font-mono text-slate-500">
                          <span>Kumulatif: {(wp.cumulativeDistanceMeters / 1000).toFixed(2)} km</span>
                          <span>Waktu kumulatif: ~{wp.cumulativeTimeMinutes} mnt</span>
                          <span>Kekuatan sensor: {wp.finding.magneticStrength.toFixed(1)} µT</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Return Leg if Round-Trip */}
                  {calculatedRoute.isRoundTrip && (
                    <div className="p-3 rounded-2xl bg-slate-950/80 border border-dashed border-emerald-500/40 flex items-center justify-between text-xs font-mono text-emerald-300">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Kembali ke Titik Awal ({calculatedRoute.startLocation.label})</span>
                      </div>
                      <span className="text-slate-400">Rute selesai tertutup</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === 'selection' && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 font-mono mb-2">
                Pilih atau batalkan titik temuan untuk dimasukkan ke kalkulasi rute penggalian:
              </p>

              {findings.map((f) => {
                const isSelected = selectedFindingIds.includes(f.id);
                const distanceToUser = userLocation
                  ? calculateDistanceMeters(userLocation.lat, userLocation.lng, f.lat, f.lng)
                  : null;

                return (
                  <div
                    key={f.id}
                    onClick={() => onToggleFindingSelection(f.id)}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-slate-900/90 border-cyan-500/60 shadow-md'
                        : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                          isSelected
                            ? 'bg-cyan-500 border-cyan-400 text-slate-950 font-bold'
                            : 'border-slate-700 bg-slate-900'
                        }`}
                      >
                        {isSelected && '✓'}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className={`text-xs font-bold ${isSelected ? 'text-slate-100' : 'text-slate-400'}`}>
                            {f.name}
                          </h5>
                          <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                            {f.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 mt-0.5">
                          <span>Kedalaman: {f.depthEstimateCm} cm</span>
                          <span>•</span>
                          <span>Sensor: {f.magneticStrength.toFixed(1)} µT</span>
                          {distanceToUser !== null && (
                            <>
                              <span>•</span>
                              <span className="text-cyan-400">Jarak: {distanceToUser.toFixed(0)}m</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <SoilDepthIndicator
                      depthCm={f.depthEstimateCm}
                      itemName={f.name}
                      category={f.category}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {calculatedRoute && (
              <a
                href={generateGoogleMapsRouteUrl(calculatedRoute)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-mono font-medium shadow-md transition-all active:scale-95"
                title="Buka rute multi-stop langsung di aplikasi Google Maps"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Buka Google Maps</span>
              </a>
            )}

            {calculatedRoute && (
              <button
                type="button"
                onClick={handleDownloadGPX}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-mono transition-all active:scale-95"
                title="Unduh berkas GPX untuk GPS handheld atau Garmin"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Ekspor GPX</span>
              </button>
            )}

            {calculatedRoute && (
              <button
                type="button"
                onClick={handleCopyItinerary}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-mono transition-all active:scale-95"
                title="Salin ringkasan jadwal ekspedisi ke papan klip"
              >
                <Share2 className="w-3.5 h-3.5 text-slate-400" />
                <span>{isCopied ? 'Tersalin!' : 'Salin Teks'}</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-mono font-medium transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
