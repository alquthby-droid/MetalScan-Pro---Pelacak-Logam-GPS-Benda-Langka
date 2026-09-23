import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet.heat';
import { MetalFinding, GPSLocation, MetalCategory } from '../types/detector';
import { Layers, Crosshair, Navigation, Trash2, MapPin, Sparkles, ExternalLink, Calendar, Compass, Flame, Eye, EyeOff, Filter, Download, Target } from 'lucide-react';

interface FindingsMapProps {
  findings: MetalFinding[];
  userLocation: GPSLocation | null;
  onDeleteFinding: (id: string) => void;
  onSelectFinding?: (finding: MetalFinding) => void;
  onOpenExportModal?: () => void;
  onOpenHotspotsModal?: () => void;
}

const CATEGORY_FILTER_OPTIONS: { id: MetalCategory | 'all'; label: string; symbol: string; color: string; activeBg: string; activeBorder: string }[] = [
  { id: 'all', label: 'Semua', symbol: '✦', color: '#94a3b8', activeBg: 'bg-cyan-500/20', activeBorder: 'border-cyan-400' },
  { id: 'gold', label: 'Emas', symbol: '★', color: '#eab308', activeBg: 'bg-yellow-500/20', activeBorder: 'border-yellow-400' },
  { id: 'meteorite', label: 'Meteorit', symbol: '☄', color: '#c084fc', activeBg: 'bg-purple-500/20', activeBorder: 'border-purple-400' },
  { id: 'bronze', label: 'Perunggu', symbol: '⬢', color: '#f97316', activeBg: 'bg-orange-500/20', activeBorder: 'border-orange-400' },
  { id: 'silver', label: 'Perak', symbol: '◈', color: '#38bdf8', activeBg: 'bg-sky-500/20', activeBorder: 'border-sky-400' },
  { id: 'iron', label: 'Besi', symbol: '⛏', color: '#94a3b8', activeBg: 'bg-slate-700/50', activeBorder: 'border-slate-500' },
];

export const FindingsMap: React.FC<FindingsMapProps> = ({
  findings,
  userLocation,
  onDeleteFinding,
  onSelectFinding,
  onOpenExportModal,
  onOpenHotspotsModal,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userAccuracyCircleRef = useRef<L.Circle | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const heatLayerRef = useRef<L.Layer | null>(null);
  const baseLayersRef = useRef<{ [key: string]: L.TileLayer }>({});

  const [activeLayer, setActiveLayer] = useState<'dark' | 'satellite'>('dark');
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [showPins, setShowPins] = useState<boolean>(true);
  const [heatRadius, setHeatRadius] = useState<number>(35);
  const [selectedCategory, setSelectedCategory] = useState<MetalCategory | 'all'>('all');
  const [showFilterBar, setShowFilterBar] = useState<boolean>(true);
  const [selectedFinding, setSelectedFinding] = useState<MetalFinding | null>(null);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: findings.length };
    findings.forEach((f) => {
      counts[f.category] = (counts[f.category] || 0) + 1;
    });
    return counts;
  }, [findings]);

  // Filtered findings based on selected category
  const filteredFindings = useMemo(() => {
    if (selectedCategory === 'all') return findings;
    return findings.filter((f) => f.category === selectedCategory);
  }, [findings, selectedCategory]);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center (Jakarta or general region if GPS not yet ready)
    const initialLat = userLocation?.lat || -6.2088;
    const initialLng = userLocation?.lng || 106.8456;
    const initialZoom = userLocation ? 17 : 13;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    // Define Tile Layers
    const darkTileLayer = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 19,
        subdomains: 'abcd',
      }
    );

    const satelliteTileLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
      }
    );

    baseLayersRef.current = {
      dark: darkTileLayer,
      satellite: satelliteTileLayer,
    };

    darkTileLayer.addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;

    // Fix leaflet default icon path issues
    delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Base Layer (Dark vs Satellite)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !baseLayersRef.current) return;

    const { dark, satellite } = baseLayersRef.current;
    if (activeLayer === 'dark') {
      if (map.hasLayer(satellite)) map.removeLayer(satellite);
      if (!map.hasLayer(dark)) map.addLayer(dark);
    } else {
      if (map.hasLayer(dark)) map.removeLayer(dark);
      if (!map.hasLayer(satellite)) map.addLayer(satellite);
    }
  }, [activeLayer]);

  // Update User Location Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !userLocation) return;

    const userLatLng = L.latLng(userLocation.lat, userLocation.lng);

    // Custom pulsing user GPS marker
    const userIcon = L.divIcon({
      className: 'user-gps-marker',
      html: `
        <div style="position:relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 24px; height: 24px; border-radius: 9999px; background: rgba(56, 189, 248, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 14px; height: 14px; border-radius: 9999px; background: #0284c7; border: 2.5px solid #ffffff; box-shadow: 0 0 10px rgba(56, 189, 248, 0.9);"></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker(userLatLng, { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
      map.setView(userLatLng, Math.max(16, map.getZoom()));
    } else {
      userMarkerRef.current.setLatLng(userLatLng);
    }

    // Accuracy circle
    if (userLocation.accuracy && userLocation.accuracy > 0) {
      if (!userAccuracyCircleRef.current) {
        userAccuracyCircleRef.current = L.circle(userLatLng, {
          radius: userLocation.accuracy,
          color: '#38bdf8',
          weight: 1,
          opacity: 0.6,
          fillColor: '#38bdf8',
          fillOpacity: 0.1,
        }).addTo(map);
      } else {
        userAccuracyCircleRef.current.setLatLng(userLatLng);
        userAccuracyCircleRef.current.setRadius(userLocation.accuracy);
      }
    }
  }, [userLocation]);

  // Render Findings Markers & Heatmap based on filteredFindings
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    // Remove existing heatmap layer if any
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    // 1. Generate Heatmap Data from filtered findings
    // Weight calculation: Normalized by magneticStrength (e.g. 50uT -> 0.3, 100uT -> 0.65, 180uT -> 1.0)
    if (showHeatmap && filteredFindings.length > 0) {
      const heatPoints: [number, number, number][] = filteredFindings.map((f) => {
        // Higher intensity for stronger magnetic anomaly
        const intensity = Math.min(1.0, Math.max(0.25, f.magneticStrength / 130));
        return [f.lat, f.lng, intensity];
      });

      // Gradient color configuration: Cold (cyan/blue) -> Moderate (lime/yellow) -> Hot intense (orange/red/purple)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const heat = (L as any).heatLayer(heatPoints, {
        radius: heatRadius,
        blur: Math.round(heatRadius * 0.7),
        maxZoom: 18,
        max: 1.0,
        gradient: {
          0.2: '#06b6d4', // Cyan (low anomaly)
          0.4: '#10b981', // Emerald
          0.6: '#eab308', // Yellow/Gold
          0.8: '#f97316', // Orange
          1.0: '#ef4444', // Red-hot intense core
        },
      });

      heat.addTo(map);
      heatLayerRef.current = heat;
    }

    // 2. Render Pin Markers for filtered findings (if enabled)
    if (showPins) {
      filteredFindings.forEach((finding) => {
        // Category colors & symbols
        let pinColor = '#94a3b8'; // iron
        let symbol = '⛏';
        if (finding.category === 'gold') {
          pinColor = '#eab308';
          symbol = '★';
        } else if (finding.category === 'meteorite') {
          pinColor = '#c084fc';
          symbol = '☄';
        } else if (finding.category === 'silver') {
          pinColor = '#38bdf8';
          symbol = '◈';
        } else if (finding.category === 'bronze') {
          pinColor = '#f97316';
          symbol = '⬢';
        }

        const customIcon = L.divIcon({
          className: 'finding-pin-marker',
          html: `
            <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">
              <div style="width: 28px; height: 28px; border-radius: 9999px; background: ${pinColor}; border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; color: #000; font-weight: bold; font-size: 13px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
                ${symbol}
              </div>
              <div style="position: absolute; bottom: -4px; width: 6px; height: 6px; background: ${pinColor}; transform: rotate(45deg);"></div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 28],
        });

        const marker = L.marker([finding.lat, finding.lng], { icon: customIcon });

        marker.on('click', () => {
          setSelectedFinding(finding);
          if (onSelectFinding) onSelectFinding(finding);
        });

        marker.addTo(markersLayer);
      });
    }
  }, [filteredFindings, onSelectFinding, showHeatmap, showPins, heatRadius]);

  const centerOnUser = () => {
    if (!mapInstanceRef.current || !userLocation) return;
    mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 18, { animate: true });
  };

  const fitAllFindings = () => {
    if (!mapInstanceRef.current || filteredFindings.length === 0) return;
    const group = L.featureGroup(
      filteredFindings.map((f) => L.marker([f.lat, f.lng]))
    );
    if (userLocation) {
      group.addLayer(L.marker([userLocation.lat, userLocation.lng]));
    }
    mapInstanceRef.current.fitBounds(group.getBounds().pad(0.2), { animate: true });
  };

  const [isHeatmapSettingsOpen, setIsHeatmapSettingsOpen] = useState<boolean>(false);

  return (
    <div className="relative w-full h-[380px] md:h-[480px] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950 flex flex-col">
      {/* Top Map Action Bar */}
      <div className="absolute top-3 left-3 right-3 z-[400] flex items-center justify-between pointer-events-none gap-2">
        <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700/80 shadow-lg text-xs font-mono text-slate-200">
          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            {filteredFindings.length}
            {selectedCategory !== 'all' && ` / ${findings.length}`} Titik
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5 flex-wrap justify-end">
          {/* Toggle Category Filter Bar */}
          <button
            type="button"
            onClick={() => setShowFilterBar(!showFilterBar)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-mono shadow-lg active:scale-95 transition-all ${
              selectedCategory !== 'all'
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold'
                : showFilterBar
                ? 'bg-slate-800/90 border-slate-600 text-slate-200'
                : 'bg-slate-900/90 border-slate-700/80 text-slate-400 hover:text-slate-200'
            }`}
            title="Filter Tampilan Kategori Logam (Emas, Perunggu, Meteorit, dll.)"
          >
            <Filter className={`w-3.5 h-3.5 ${selectedCategory !== 'all' ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} />
            <span>Filter</span>
            {selectedCategory !== 'all' && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            )}
          </button>

          {/* Heatmap Toggle Button */}
          <button
            type="button"
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-mono shadow-lg active:scale-95 transition-all ${
              showHeatmap
                ? 'bg-gradient-to-r from-orange-600/90 to-red-600/90 border-orange-400/80 text-white shadow-orange-950/50'
                : 'bg-slate-900/90 border-slate-700/80 text-slate-400 hover:text-slate-200'
            }`}
            title="Aktifkan/Nonaktifkan Lapisan Heatmap Kerapatan Logam"
          >
            <Flame className={`w-3.5 h-3.5 ${showHeatmap ? 'text-amber-300 animate-pulse' : 'text-slate-400'}`} />
            <span>Heatmap</span>
            {showHeatmap && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            )}
          </button>

          {/* Toggle Pins */}
          <button
            type="button"
            onClick={() => setShowPins(!showPins)}
            className={`p-2 rounded-full backdrop-blur-md border shadow-lg active:scale-95 transition-all ${
              showPins
                ? 'bg-slate-900/90 border-slate-700/80 text-slate-200 hover:text-white'
                : 'bg-slate-900/60 border-slate-800 text-slate-500'
            }`}
            title={showPins ? 'Sembunyikan Pin Temuan' : 'Tampilkan Pin Temuan'}
          >
            {showPins ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          {/* Layer switcher */}
          <button
            type="button"
            onClick={() => setActiveLayer(activeLayer === 'dark' ? 'satellite' : 'dark')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-xs font-mono text-slate-300 hover:text-white shadow-lg active:scale-95 transition-all"
            title="Ganti Tampilan Peta Satelit / Gelap"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">{activeLayer === 'dark' ? 'Satelit' : 'Taktis Gelap'}</span>
          </button>

          {/* Gemini AI Hotspots Suggestion */}
          {findings.length > 0 && onOpenHotspotsModal && (
            <button
              type="button"
              onClick={onOpenHotspotsModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-amber-500/50 text-xs font-mono text-amber-300 hover:text-white hover:bg-amber-500/20 shadow-lg active:scale-95 transition-all"
              title="Prediksi Hotspot Penggalian Berikutnya dengan Gemini AI"
            >
              <Target className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Hotspot AI</span>
            </button>
          )}

          {/* Export findings / PDF / CSV */}
          {findings.length > 0 && onOpenExportModal && (
            <button
              type="button"
              onClick={onOpenExportModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-cyan-500/50 text-xs font-mono text-cyan-300 hover:text-white hover:bg-cyan-500/20 shadow-lg active:scale-95 transition-all"
              title="Ekspor Laporan PDF Lengkap Peta atau CSV Spreadsheet"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Ekspor PDF / CSV</span>
            </button>
          )}

          {/* Fit all bounds */}
          {filteredFindings.length > 0 && (
            <button
              type="button"
              onClick={fitAllFindings}
              className="p-2 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-slate-300 hover:text-white shadow-lg active:scale-95 transition-all"
              title="Lihat Semua Titik Temuan Sesuai Filter"
            >
              <Crosshair className="w-4 h-4 text-amber-400" />
            </button>
          )}

          {/* Re-center user */}
          <button
            type="button"
            onClick={centerOnUser}
            disabled={!userLocation}
            className={`p-2 rounded-full backdrop-blur-md border shadow-lg active:scale-95 transition-all ${
              userLocation
                ? 'bg-slate-900/90 border-slate-700/80 text-cyan-400 hover:bg-slate-800'
                : 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed'
            }`}
            title="Pusatkan ke Lokasi Saya Sekarang"
          >
            <Navigation className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Category Filter Chips Bar */}
      {showFilterBar && (
        <div className="absolute top-13 left-3 right-3 z-[400] flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 pointer-events-auto">
          <div className="flex items-center gap-1.5 bg-slate-900/95 backdrop-blur-md p-1 rounded-2xl border border-slate-700/80 shadow-2xl">
            {CATEGORY_FILTER_OPTIONS.map((opt) => {
              const count = categoryCounts[opt.id] || 0;
              const isSelected = selectedCategory === opt.id;

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedCategory(opt.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono transition-all whitespace-nowrap ${
                    isSelected
                      ? `${opt.activeBg} border ${opt.activeBorder} text-white font-bold shadow-md`
                      : 'bg-slate-950/60 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <span style={{ color: opt.color }}>{opt.symbol}</span>
                  <span>{opt.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected ? 'bg-slate-900 text-white font-bold' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Heatmap Legend & Radius Slider (When Heatmap Active) */}
      {showHeatmap && (
        <div className={`absolute ${showFilterBar ? 'top-26' : 'top-14'} left-3 z-[400] flex flex-col gap-1.5 pointer-events-auto transition-all`}>
          <div className="bg-slate-900/90 backdrop-blur-md p-2 rounded-2xl border border-slate-700/80 shadow-xl font-mono text-[10px] text-slate-300 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1 text-amber-400 font-bold">
                <Flame className="w-3 h-3 text-orange-400" />
                <span>Intensitas Logam</span>
              </div>
              <button
                type="button"
                onClick={() => setIsHeatmapSettingsOpen(!isHeatmapSettingsOpen)}
                className="text-[9px] text-cyan-400 hover:underline px-1 py-0.5"
              >
                {isHeatmapSettingsOpen ? 'Tutup' : 'Radius'}
              </button>
            </div>

            {/* Gradient Bar */}
            <div className="w-36 h-2 rounded-full bg-gradient-to-r from-cyan-500 via-emerald-400 via-yellow-400 via-orange-500 to-red-600 border border-slate-700"></div>
            <div className="flex items-center justify-between text-[8px] text-slate-400 font-mono">
              <span>Rendah</span>
              <span>Sedang</span>
              <span className="text-red-400 font-semibold">Tinggi / Padat</span>
            </div>

            {/* Adjustable Radius Slider dropdown */}
            {isHeatmapSettingsOpen && (
              <div className="mt-1 pt-1.5 border-t border-slate-800 flex flex-col gap-1">
                <div className="flex items-center justify-between text-[9px] text-slate-400">
                  <span>Radius Sebar:</span>
                  <span className="font-bold text-slate-200">{heatRadius}px</span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={65}
                  step={5}
                  value={heatRadius}
                  onChange={(e) => setHeatRadius(Number(e.target.value))}
                  className="w-full accent-orange-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actual Leaflet Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Selected Finding Details Drawer Modal */}
      {selectedFinding && (
        <div className="absolute bottom-3 left-3 right-3 z-[450] bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-4 shadow-2xl animate-in fade-in slide-in-from-bottom duration-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg border shadow-inner"
                style={{
                  backgroundColor:
                    selectedFinding.category === 'gold'
                      ? 'rgba(234, 179, 8, 0.2)'
                      : selectedFinding.category === 'meteorite'
                      ? 'rgba(192, 132, 252, 0.2)'
                      : 'rgba(56, 189, 248, 0.2)',
                  color:
                    selectedFinding.category === 'gold'
                      ? '#facc15'
                      : selectedFinding.category === 'meteorite'
                      ? '#c084fc'
                      : '#38bdf8',
                  borderColor:
                    selectedFinding.category === 'gold'
                      ? 'rgba(234, 179, 8, 0.5)'
                      : 'rgba(56, 189, 248, 0.5)',
                }}
              >
                {selectedFinding.category === 'gold'
                  ? '★'
                  : selectedFinding.category === 'meteorite'
                  ? '☄'
                  : '⛏'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-slate-100">{selectedFinding.name}</h4>
                  <span
                    className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-semibold ${
                      selectedFinding.autoSaved
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    }`}
                  >
                    {selectedFinding.autoSaved ? 'Auto-Simpan GPS' : 'Tandai Manual'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-0.5">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <strong>{selectedFinding.magneticStrength.toFixed(1)} µT</strong>
                  </span>
                  <span>•</span>
                  <span>Kedalaman: ~{selectedFinding.depthEstimateCm} cm</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedFinding(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 text-lg leading-none"
            >
              ×
            </button>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs font-mono text-slate-300">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>{new Date(selectedFinding.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400 truncate">
              <Compass className="w-3.5 h-3.5 text-slate-500" />
              <span>{selectedFinding.lat.toFixed(5)}, {selectedFinding.lng.toFixed(5)}</span>
            </div>
          </div>

          {selectedFinding.note && (
            <p className="mt-2 text-xs text-slate-300 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
              Catatan: {selectedFinding.note}
            </p>
          )}

          {/* Action buttons inside popup */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${selectedFinding.lat},${selectedFinding.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium font-mono shadow-md transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Navigasi Petunjuk Arah</span>
            </a>

            <button
              type="button"
              onClick={() => {
                onDeleteFinding(selectedFinding.id);
                setSelectedFinding(null);
              }}
              className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors"
              title="Hapus Temuan Ini"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* GPS Status Pill at bottom */}
      <div className="absolute bottom-3 left-3 z-[400] pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-full border border-slate-800 text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${
              userLocation ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span>
            {userLocation
              ? `GPS Akurat ±${Math.round(userLocation.accuracy)}m (${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)})`
              : 'Menghubungkan Sinyal Satelit GPS...'}
          </span>
        </div>
      </div>
    </div>
  );
};
