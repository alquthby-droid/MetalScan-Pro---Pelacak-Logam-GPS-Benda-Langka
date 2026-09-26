import React, { useState, useMemo } from 'react';
import {
  Landmark,
  Search,
  Filter,
  MapPin,
  ExternalLink,
  Sparkles,
  Mountain,
  Navigation,
  Compass,
  X,
  ChevronRight,
  Shield,
  Layers,
  Flame,
  Award,
} from 'lucide-react';
import { HistoricalMarkerSite, HistoricalEra, ArtifactPotentialLevel } from '../types/historicalSite';
import { HISTORICAL_MARKERS_DATA } from '../data/historicalSitesData';
import { GPSLocation } from '../types/detector';
import { calculateDistanceMeters } from '../services/routePlannerService';

interface HistoricalMarkersModalProps {
  isOpen: boolean;
  onClose: () => void;
  userLocation: GPSLocation | null;
  onSelectSiteOnMap: (site: HistoricalMarkerSite) => void;
  onOpen3DTerrainAnalysis: (site: HistoricalMarkerSite) => void;
}

const ERA_OPTIONS: { id: HistoricalEra | 'all'; label: string }[] = [
  { id: 'all', label: 'Semua Era' },
  { id: 'Prasejarah', label: 'Prasejarah' },
  { id: 'Klasik Hindu-Buddha', label: 'Klasik Hindu-Buddha' },
  { id: 'Kesultanan Islam', label: 'Kesultanan Islam' },
  { id: 'Kolonial & Maritim', label: 'Kolonial & Maritim' },
  { id: 'Megalitikum', label: 'Megalitikum' },
];

export const HistoricalMarkersModal: React.FC<HistoricalMarkersModalProps> = ({
  isOpen,
  onClose,
  userLocation,
  onSelectSiteOnMap,
  onOpen3DTerrainAnalysis,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEra, setSelectedEra] = useState<HistoricalEra | 'all'>('all');
  const [selectedPotential, setSelectedPotential] = useState<ArtifactPotentialLevel | 'all'>('all');
  const [selectedSiteDetail, setSelectedSiteDetail] = useState<HistoricalMarkerSite | null>(null);

  // Filtered and sorted sites
  const filteredSites = useMemo(() => {
    return HISTORICAL_MARKERS_DATA.filter((site) => {
      // Search text
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = site.name.toLowerCase().includes(query);
        const matchesRegion = site.region.toLowerCase().includes(query);
        const matchesCategory = site.categoryLabel.toLowerCase().includes(query);
        const matchesArtifacts = site.knownArtifactTypes.some((a) =>
          a.toLowerCase().includes(query)
        );
        if (!matchesName && !matchesRegion && !matchesCategory && !matchesArtifacts) {
          return false;
        }
      }

      // Era filter
      if (selectedEra !== 'all' && site.era !== selectedEra) {
        return false;
      }

      // Potential filter
      if (selectedPotential !== 'all' && site.artifactPotential !== selectedPotential) {
        return false;
      }

      return true;
    }).map((site) => {
      let distanceMeters: number | null = null;
      if (userLocation) {
        distanceMeters = calculateDistanceMeters(
          userLocation.lat,
          userLocation.lng,
          site.lat,
          site.lng
        );
      }
      return { ...site, distanceMeters };
    }).sort((a, b) => {
      // If userLocation available, sort by distance; else by artifact score
      if (a.distanceMeters !== null && b.distanceMeters !== null) {
        return a.distanceMeters - b.distanceMeters;
      }
      return b.artifactPotentialScore - a.artifactPotentialScore;
    });
  }, [searchQuery, selectedEra, selectedPotential, userLocation]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[95vh] flex flex-col bg-slate-950 border border-amber-500/40 rounded-3xl shadow-2xl shadow-amber-950/50 overflow-hidden ring-1 ring-white/10">
        {/* Top Header */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold font-mono text-white flex items-center gap-1.5">
                  <span>Situs Arkeologi Terbuka (Historical Markers)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                    Open Database
                  </span>
                </h3>
              </div>
              <p className="text-xs text-slate-400 font-sans">
                Eksplorasi koordinat geografis situs bersejarah dengan potensi artefak dan relik logam tinggi
              </p>
            </div>
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

        {/* Filter and Search Bar */}
        <div className="p-3 sm:px-4 bg-slate-900/60 border-b border-slate-800 space-y-2.5">
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari situs (contoh: Majapahit, Sangiran, Emas, Perunggu)..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Potential Filter */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-mono shrink-0">
              <span className="text-slate-400 px-1 text-[10px] hidden sm:inline">Potensi:</span>
              <button
                type="button"
                onClick={() => setSelectedPotential('all')}
                className={`px-2 py-0.5 rounded-lg transition-all ${
                  selectedPotential === 'all'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setSelectedPotential('SANGAT TINGGI')}
                className={`px-2 py-0.5 rounded-lg transition-all ${
                  selectedPotential === 'SANGAT TINGGI'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ★ Sangat Tinggi
              </button>
            </div>
          </div>

          {/* Era Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs font-mono">
            {ERA_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedEra(opt.id)}
                className={`px-2.5 py-1 rounded-xl transition-all whitespace-nowrap ${
                  selectedEra === opt.id
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-extrabold shadow-sm'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* List of Historical Marker Sites */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
            <span>Ditemukan {filteredSites.length} Situs Arkeologi Terbuka</span>
            <span>Sumber: OpenStreetMap / UNESCO / Arkenas</span>
          </div>

          {filteredSites.length === 0 ? (
            <div className="p-8 text-center text-slate-400 font-mono text-xs">
              Tidak ada situs yang cocok dengan kriteria filter pencarian Anda.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredSites.map((site) => {
                const isSelected = selectedSiteDetail?.id === site.id;

                return (
                  <div
                    key={site.id}
                    className={`p-3.5 rounded-2xl border transition-all text-left flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'bg-slate-900 border-amber-400/90 shadow-xl shadow-amber-950/30 ring-1 ring-amber-400/40'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono font-bold flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            <span>{site.artifactPotentialScore}% Potensi Relik</span>
                          </span>

                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                            {site.era}
                          </span>
                        </div>

                        {site.distanceMeters !== null && (
                          <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/50 px-2 py-0.5 rounded-lg border border-cyan-800/40 font-bold">
                            {site.distanceMeters >= 1000
                              ? `${(site.distanceMeters / 1000).toFixed(1)} km`
                              : `${site.distanceMeters.toFixed(0)} m`}{' '}
                            dari Anda
                          </span>
                        )}
                      </div>

                      {/* Site Name */}
                      <h4 className="text-sm font-bold text-white mt-2 leading-snug">
                        {site.name}
                      </h4>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                        <span className="truncate">{site.region}</span>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-300 font-sans mt-2 line-clamp-2 leading-relaxed">
                        {site.description}
                      </p>

                      {/* Relic Types Chips */}
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {site.knownArtifactTypes.slice(0, 3).map((art, idx) => (
                          <span
                            key={idx}
                            className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-slate-950 text-amber-200 border border-amber-900/40"
                          >
                            ✦ {art}
                          </span>
                        ))}
                        {site.knownArtifactTypes.length > 3 && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-slate-950 text-slate-400">
                            +{site.knownArtifactTypes.length - 3} lainnya
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 truncate">
                        <Mountain className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>{site.elevationMeters} mdpl</span>
                        <span>•</span>
                        <span>Lereng ~{site.averageSlopeDegrees ?? 5}°</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* 3D Terrain Analysis Button */}
                        <button
                          type="button"
                          onClick={() => {
                            onOpen3DTerrainAnalysis(site);
                            onClose();
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-semibold transition-all active:scale-95"
                          title="Analisis 3D Elevasi & Kemiringan Lereng Situs Ini"
                        >
                          <Mountain className="w-3 h-3" />
                          <span>Medan 3D</span>
                        </button>

                        {/* Fly to Map Button */}
                        <button
                          type="button"
                          onClick={() => {
                            onSelectSiteOnMap(site);
                            onClose();
                          }}
                          className="flex items-center gap-1 px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-mono font-bold shadow-md transition-all active:scale-95"
                        >
                          <Navigation className="w-3 h-3" />
                          <span>Peta</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 sm:px-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs font-mono text-slate-400">
          <span>🏛️ Sumber Terbuka: OpenStreetMap (historic=*) & Registrasi Warisan Dunia</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
