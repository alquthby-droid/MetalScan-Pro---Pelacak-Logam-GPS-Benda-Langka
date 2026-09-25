import React, { useState, useEffect } from 'react';
import { MetalFinding, MetalCategory, GPSLocation } from '../types/detector';
import {
  Download,
  Trash2,
  Search,
  ExternalLink,
  Sparkles,
  MapPin,
  Edit3,
  Check,
  FileSpreadsheet,
  FileCode,
  FileText,
  Share2,
  Loader2,
  Target,
  Wand2,
  Filter,
  ChevronDown,
  X,
  SlidersHorizontal,
  Radio,
  Layers,
  ArrowDown,
  Bell,
  BellOff,
  Navigation2,
  Compass,
  Mountain,
} from 'lucide-react';
import { exportFindingsToCSV, exportFindingsToPDF } from '../services/exportService';
import { geminiService } from '../services/geminiService';
import { SoilDepthIndicator } from './SoilDepthIndicator';
import { TargetCenterAlarmBanner } from './TargetCenterAlarmBanner';
import { targetCenterAlarmService, TargetCenterAlarmState } from '../services/targetCenterAlarm';
import {
  NTBPriorityFinding,
  NTB_PRIORITY_FINDINGS,
  calculateDistanceMeters,
  calculateBearingDegrees,
  getCardinalDirectionIndo,
} from '../data/ntbPriorityFindings';
import { GpsCompassModal } from './GpsCompassModal';

interface FindingsListProps {
  findings: MetalFinding[];
  userLocation?: GPSLocation | null;
  onDeleteFinding: (id: string) => void;
  onClearAll: () => void;
  onUpdateNote: (id: string, note: string) => void;
  onNavigateToMap: (finding: MetalFinding) => void;
  onOpenExportModal?: () => void;
  onOpenAnalysisModal?: (finding: MetalFinding) => void;
  onOpenHotspotsModal?: () => void;
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
  onAddFinding?: (finding: MetalFinding) => void;
  onOpenCompassModal?: (finding?: NTBPriorityFinding) => void;
  onTogglePriority?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
}

export const FindingsList: React.FC<FindingsListProps> = ({
  findings,
  userLocation,
  onDeleteFinding,
  onClearAll,
  onUpdateNote,
  onNavigateToMap,
  onOpenExportModal,
  onOpenAnalysisModal,
  onOpenHotspotsModal,
  selectedCategory: controlledCategory,
  onCategoryChange,
  onAddFinding,
  onOpenCompassModal,
  onTogglePriority,
  onToggleFavorite,
}) => {
  const [internalCategory, setInternalCategory] = useState<string>('all');
  const selectedCategory = controlledCategory !== undefined ? controlledCategory : internalCategory;

  const handleSelectCategory = (cat: string) => {
    setInternalCategory(cat);
    onCategoryChange?.(cat);
  };

  const [activeTabMode, setActiveTabMode] = useState<'my_findings' | 'ntb_priority'>('my_findings');
  const [isCompassModalOpen, setIsCompassModalOpen] = useState<boolean>(false);
  const [selectedCompassTarget, setSelectedCompassTarget] = useState<NTBPriorityFinding>(NTB_PRIORITY_FINDINGS[0]);
  const [pinnedNTBIds, setPinnedNTBIds] = useState<Set<string>>(new Set());
  const [selectedNTBRegion, setSelectedNTBRegion] = useState<string>('all');
  const [ntbSearchQuery, setNtbSearchQuery] = useState<string>('');
  const [selectedNTBPriority, setSelectedNTBPriority] = useState<string>('all');
  const [selectedNTBCategory, setSelectedNTBCategory] = useState<string>('all');

  const handleOpenCompass = (target?: NTBPriorityFinding) => {
    const chosen = target || selectedCompassTarget || NTB_PRIORITY_FINDINGS[0];
    setSelectedCompassTarget(chosen);
    setIsCompassModalOpen(true);
    onOpenCompassModal?.(chosen);
  };

  const handleOpenCompassForFinding = (f: MetalFinding) => {
    const converted: NTBPriorityFinding = {
      id: f.id,
      name: f.name,
      region: 'Lombok Barat',
      locationName: `Koordinat GPS ${f.lat.toFixed(5)}, ${f.lng.toFixed(5)}`,
      lat: f.lat,
      lng: f.lng,
      category: f.category,
      estimatedDepthCm: f.depthEstimateCm,
      magneticStrength: f.magneticStrength,
      priority: 'TINGGI',
      historicalContext: f.note || 'Titik temuan tercatat dari log magnetometer lapangan.',
      tacticalAdvice: 'Gunakan panduan jarum kompas untuk melacak kembali ke titik koordinat ini.',
      elevationMeters: 30,
      estimatedAge: new Date(f.timestamp).toLocaleDateString(),
    };
    setSelectedCompassTarget(converted);
    setIsCompassModalOpen(true);
  };

  const handleToggleNTBAlarm = (target: NTBPriorityFinding) => {
    targetCenterAlarmService.toggleAlarm(
      {
        id: target.id,
        name: target.name,
        category: target.category,
        lat: target.lat,
        lng: target.lng,
        depthEstimateCm: target.estimatedDepthCm,
      },
      userLocation?.lat,
      userLocation?.lng
    );
  };

  const handlePinNTB = (target: NTBPriorityFinding) => {
    const newFinding: MetalFinding = {
      id: `ntb-${target.id}-${Date.now()}`,
      timestamp: Date.now(),
      lat: target.lat,
      lng: target.lng,
      accuracy: 3.5,
      magneticStrength: target.magneticStrength,
      netStrength: Math.max(12, target.magneticStrength - 48),
      category: target.category,
      name: `${target.name} (${target.region})`,
      depthEstimateCm: target.estimatedDepthCm,
      note: `[Prioritas NTB: ${target.priority}] ${target.historicalContext} - ${target.tacticalAdvice}`,
      autoSaved: false,
    };
    onAddFinding?.(newFinding);
    setPinnedNTBIds((prev) => new Set([...prev, target.id]));
  };

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState<string>('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);
  const [isGeneratingNoteId, setIsGeneratingNoteId] = useState<string | null>(null);

  // Target Center Sensor Alarm state
  const [alarmState, setAlarmState] = useState<TargetCenterAlarmState>(() =>
    targetCenterAlarmService.getState()
  );

  useEffect(() => {
    const unsub = targetCenterAlarmService.subscribe((st) => setAlarmState(st));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (userLocation) {
      targetCenterAlarmService.updateUserLocation(userLocation.lat, userLocation.lng);
    }
  }, [userLocation]);

  const handleToggleAlarm = (finding: MetalFinding) => {
    targetCenterAlarmService.toggleAlarm(
      {
        id: finding.id,
        name: finding.name,
        category: finding.category,
        lat: finding.lat,
        lng: finding.lng,
        depthEstimateCm: finding.depthEstimateCm,
      },
      userLocation?.lat,
      userLocation?.lng
    );
  };

  const handleGenerateAutoNote = async (finding: MetalFinding) => {
    setIsGeneratingNoteId(finding.id);
    try {
      const note = await geminiService.generateAutoNote(finding);
      if (note) {
        onUpdateNote(finding.id, note);
      }
    } catch (err) {
      console.error('Failed to generate auto note:', err);
    } finally {
      setIsGeneratingNoteId(null);
    }
  };

  // Helper matching logic for metal category filter
  const isMatchingCategory = (findingCat: MetalCategory, filterCat: string): boolean => {
    if (filterCat === 'all') return true;
    if (filterCat === 'gold' || filterCat === 'emas') return findingCat === 'gold';
    if (filterCat === 'bronze' || filterCat === 'perunggu') return findingCat === 'bronze';
    if (filterCat === 'meteorite' || filterCat === 'meteorit') return findingCat === 'meteorite';
    if (filterCat === 'other' || filterCat === 'lainnya') {
      return findingCat !== 'gold' && findingCat !== 'bronze' && findingCat !== 'meteorite';
    }
    return findingCat === filterCat;
  };

  const filteredFindings = findings.filter((f) => {
    const matchesCat =
      selectedCategory === 'favorite'
        ? f.isFavorite === true
        : selectedCategory === 'priority'
        ? f.isPriority === true
        : isMatchingCategory(f.category, selectedCategory);
    const matchesSearch =
      searchQuery.trim() === '' ||
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.note && f.note.toLowerCase().includes(searchQuery.toLowerCase())) ||
      f.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const filteredNTBFindings = NTB_PRIORITY_FINDINGS.filter((item) => {
    const matchesRegion = selectedNTBRegion === 'all' || item.region === selectedNTBRegion;
    const matchesPriority = selectedNTBPriority === 'all' || item.priority === selectedNTBPriority;
    const matchesCategory =
      selectedNTBCategory === 'all' || isMatchingCategory(item.category, selectedNTBCategory);
    const query = ntbSearchQuery.trim().toLowerCase();
    const matchesSearch =
      query === '' ||
      item.name.toLowerCase().includes(query) ||
      item.region.toLowerCase().includes(query) ||
      item.locationName.toLowerCase().includes(query) ||
      item.historicalContext.toLowerCase().includes(query) ||
      item.tacticalAdvice.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query);
    return matchesRegion && matchesPriority && matchesCategory && matchesSearch;
  });

  // Calculate live counts
  const totalCount = findings.length;
  const favoriteCount = findings.filter((f) => f.isFavorite).length;
  const priorityCount = findings.filter((f) => f.isPriority).length;
  const goldCount = findings.filter((f) => f.category === 'gold').length;
  const bronzeCount = findings.filter((f) => f.category === 'bronze').length;
  const meteoriteCount = findings.filter((f) => f.category === 'meteorite').length;
  const otherCount = findings.filter(
    (f) => f.category !== 'gold' && f.category !== 'bronze' && f.category !== 'meteorite'
  ).length;
  const silverCount = findings.filter((f) => f.category === 'silver').length;
  const ironCount = findings.filter((f) => f.category === 'iron').length;
  const unknownCount = findings.filter((f) => f.category === 'unknown').length;
  const highestFlux = findings.reduce((max, f) => Math.max(max, f.magneticStrength), 0);

  const getCategoryLabel = (cat: string): string => {
    switch (cat) {
      case 'favorite':
      case 'favorit':
        return 'Favorit';
      case 'priority':
      case 'prioritas':
        return 'Prioritas 5m';
      case 'gold':
      case 'emas':
        return 'Emas';
      case 'bronze':
      case 'perunggu':
        return 'Perunggu';
      case 'meteorite':
      case 'meteorit':
        return 'Meteorit';
      case 'other':
      case 'lainnya':
        return 'Lainnya';
      case 'silver':
        return 'Perak';
      case 'iron':
        return 'Besi';
      case 'unknown':
        return 'Mineral Tanah';
      default:
        return 'Semua Kategori';
    }
  };

  const getCategoryTheme = (cat: MetalCategory) => {
    switch (cat) {
      case 'gold':
        return {
          symbol: '★',
          name: 'Emas (Gold)',
          chip: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
          bg: 'rgba(234, 179, 8, 0.15)',
          color: '#facc15',
          border: 'rgba(234, 179, 8, 0.45)',
        };
      case 'bronze':
        return {
          symbol: '⬢',
          name: 'Perunggu (Bronze)',
          chip: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
          bg: 'rgba(249, 115, 22, 0.15)',
          color: '#fb923c',
          border: 'rgba(249, 115, 22, 0.45)',
        };
      case 'meteorite':
        return {
          symbol: '☄',
          name: 'Meteorit (Meteorite)',
          chip: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
          bg: 'rgba(192, 132, 252, 0.15)',
          color: '#c084fc',
          border: 'rgba(192, 132, 252, 0.45)',
        };
      case 'silver':
        return {
          symbol: '◈',
          name: 'Perak (Silver)',
          chip: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
          bg: 'rgba(56, 189, 248, 0.15)',
          color: '#38bdf8',
          border: 'rgba(56, 189, 248, 0.45)',
        };
      case 'iron':
        return {
          symbol: '⛏',
          name: 'Besi (Ferrous)',
          chip: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
          bg: 'rgba(148, 163, 184, 0.15)',
          color: '#cbd5e1',
          border: 'rgba(148, 163, 184, 0.45)',
        };
      default:
        return {
          symbol: '❖',
          name: 'Lainnya (Mineral)',
          chip: 'bg-slate-600/20 text-slate-300 border-slate-600/40',
          bg: 'rgba(100, 116, 139, 0.15)',
          color: '#94a3b8',
          border: 'rgba(100, 116, 139, 0.45)',
        };
    }
  };

  // Export GPX format
  const exportGPX = () => {
    if (findings.length === 0) return;
    const gpxPoints = findings
      .map(
        (f) => `
    <wpt lat="${f.lat}" lon="${f.lng}">
      <time>${new Date(f.timestamp).toISOString()}</time>
      <name>${f.name.replace(/&/g, '&amp;')}</name>
      <desc>Fluks: ${f.magneticStrength.toFixed(1)} uT | Kategori: ${f.category} | Kedalaman: ~${f.depthEstimateCm}cm ${f.note ? '| ' + f.note : ''}</desc>
      <sym>Flag, Blue</sym>
    </wpt>`
      )
      .join('');

    const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MetalScan Pro Android" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Titik Temuan MetalScan Pro</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  ${gpxPoints}
</gpx>`;

    downloadFile(gpxContent, `temuan_logam_${Date.now()}.gpx`, 'application/gpx+xml');
  };

  // Export JSON
  const exportJSON = () => {
    const dataStr = JSON.stringify(findings, null, 2);
    downloadFile(dataStr, `temuan_logam_${Date.now()}.json`, 'application/json');
  };

  // Export PDF with full Maps
  const handleExportPDF = async () => {
    if (findings.length === 0) return;
    setIsGeneratingPDF(true);
    try {
      await exportFindingsToPDF(findings, userLocation);
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Terjadi kendala saat menyusun dokumen PDF.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Export CSV (Excel & Google Sheets compatible with UTF-8 BOM)
  const exportCSV = () => {
    exportFindingsToCSV(findings);
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const startEditNote = (finding: MetalFinding) => {
    setEditingId(finding.id);
    setEditNoteText(finding.note || '');
  };

  const saveEditNote = (id: string) => {
    onUpdateNote(id, editNoteText);
    setEditingId(null);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col gap-4">
      {/* Top Navigation Mode Tabs: My Findings vs NTB Priority Targets */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-950/90 rounded-2xl border border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTabMode('my_findings')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTabMode === 'my_findings'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>Koleksi Temuan Saya</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              activeTabMode === 'my_findings'
                ? 'bg-cyan-400/20 text-cyan-200'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {findings.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTabMode('ntb_priority')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTabMode === 'ntb_priority'
              ? 'bg-gradient-to-r from-amber-500/25 to-orange-500/25 text-amber-300 border border-amber-500/60 shadow-md ring-1 ring-amber-500/30'
              : 'text-slate-400 hover:text-amber-300 hover:bg-amber-950/20'
          }`}
        >
          <Compass className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '15s' }} />
          <span>Temuan Prioritas NTB</span>
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-bold border border-amber-400/40">
            {NTB_PRIORITY_FINDINGS.length} Titik GPS
          </span>
        </button>
      </div>

      {activeTabMode === 'my_findings' && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-150">
          {/* Header and statistics */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-amber-400" />
            <span>Koleksi Log Titik Temuan GPS</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Daftar koordinat dan data magnetik yang tersimpan otomatis & manual
          </p>
        </div>

        {findings.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Gemini Hotspots Suggestion Button */}
            {onOpenHotspotsModal && (
              <button
                type="button"
                onClick={onOpenHotspotsModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600/30 to-orange-600/30 hover:from-amber-600/40 hover:to-orange-600/40 text-amber-300 border border-amber-500/50 text-xs font-mono font-medium transition-all shadow-sm active:scale-95"
                title="Prediksi Hotspot Penggalian Berikutnya dengan Gemini AI"
              >
                <Target className="w-3.5 h-3.5 text-amber-400" />
                <span>Prediksi Hotspot AI</span>
              </button>
            )}

            {/* Ekspor CSV Button */}
            <button
              type="button"
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/40 text-xs font-mono font-medium transition-all shadow-sm active:scale-95"
              title="Unduh log temuan dalam format CSV (Excel & Google Sheets)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-teal-400" />
              <span>Ekspor CSV</span>
            </button>

            {/* Ekspor PDF Lengkap Peta Button */}
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isGeneratingPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/25 hover:bg-indigo-600/35 text-indigo-300 border border-indigo-500/40 text-xs font-mono font-medium transition-all shadow-sm active:scale-95 disabled:opacity-50"
              title="Unduh Laporan Dokumen PDF Lengkap beserta Peta GPS dan tabel"
            >
              {isGeneratingPDF ? (
                <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
              )}
              <span>{isGeneratingPDF ? 'Menyusun...' : 'Ekspor PDF (Peta)'}</span>
            </button>

            {/* Opsi Ekspor Lengkap Modal */}
            {onOpenExportModal && (
              <button
                type="button"
                onClick={onOpenExportModal}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-medium transition-all shadow-sm active:scale-95"
                title="Buka Menu Ekspor Lengkap & Kustomisasi Laporan"
              >
                <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Kustomisasi</span>
              </button>
            )}

            <button
              type="button"
              onClick={exportGPX}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-medium transition-all"
              title="Ekspor ke format GPX untuk GPS Lapangan / Google Earth"
            >
              <Download className="w-3.5 h-3.5" />
              <span>GPX</span>
            </button>

            <button
              type="button"
              onClick={exportJSON}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono transition-all"
              title="Ekspor format data mentah JSON"
            >
              <FileCode className="w-3.5 h-3.5 text-cyan-400" />
              <span>JSON</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (window.confirm('Yakin ingin menghapus semua titik temuan?')) {
                  onClearAll();
                }
              }}
              className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all"
              title="Hapus Semua Riwayat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Quick Stats Grid with Interactive Filter Clicking */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <button
          type="button"
          onClick={() => handleSelectCategory('all')}
          className={`p-3 rounded-2xl border text-left transition-all ${
            selectedCategory === 'all'
              ? 'bg-cyan-950/40 border-cyan-500/70 ring-1 ring-cyan-500/40'
              : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
          }`}
        >
          <div className="text-[10px] font-mono text-slate-400 uppercase">Total Temuan</div>
          <div className="text-xl font-bold font-mono text-slate-100 mt-1">{totalCount} Titik</div>
        </button>

        <button
          type="button"
          onClick={() => handleSelectCategory('gold')}
          className={`p-3 rounded-2xl border text-left transition-all ${
            selectedCategory === 'gold'
              ? 'bg-yellow-950/40 border-yellow-500/70 ring-1 ring-yellow-500/40'
              : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
          }`}
        >
          <div className="text-[10px] font-mono text-yellow-400/90 uppercase flex items-center gap-1">
            <span>★ Emas</span>
          </div>
          <div className="text-xl font-bold font-mono text-yellow-400 mt-1">{goldCount} Titik</div>
        </button>

        <button
          type="button"
          onClick={() => handleSelectCategory('bronze')}
          className={`p-3 rounded-2xl border text-left transition-all ${
            selectedCategory === 'bronze'
              ? 'bg-orange-950/40 border-orange-500/70 ring-1 ring-orange-500/40'
              : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
          }`}
        >
          <div className="text-[10px] font-mono text-orange-400/90 uppercase flex items-center gap-1">
            <span>⬢ Perunggu</span>
          </div>
          <div className="text-xl font-bold font-mono text-orange-400 mt-1">{bronzeCount} Titik</div>
        </button>

        <button
          type="button"
          onClick={() => handleSelectCategory('meteorite')}
          className={`p-3 rounded-2xl border text-left transition-all ${
            selectedCategory === 'meteorite'
              ? 'bg-purple-950/40 border-purple-500/70 ring-1 ring-purple-500/40'
              : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
          }`}
        >
          <div className="text-[10px] font-mono text-purple-400/90 uppercase flex items-center gap-1">
            <span>☄ Meteorit</span>
          </div>
          <div className="text-xl font-bold font-mono text-purple-400 mt-1">{meteoriteCount} Titik</div>
        </button>

        <button
          type="button"
          onClick={() => handleSelectCategory('other')}
          className={`p-3 rounded-2xl border text-left transition-all col-span-2 sm:col-span-1 ${
            selectedCategory === 'other' || ['silver', 'iron', 'unknown'].includes(selectedCategory)
              ? 'bg-slate-800/60 border-slate-400/70 ring-1 ring-slate-400/40'
              : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
          }`}
        >
          <div className="text-[10px] font-mono text-slate-300 uppercase flex items-center gap-1">
            <span>❖ Lainnya</span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-200 mt-1">{otherCount} Titik</div>
        </button>
      </div>

      {/* Target Center Sensor Alarm HUD Banner when an alarm is active (ONLINE) */}
      {alarmState.isActive && alarmState.targetId && (
        <TargetCenterAlarmBanner
          alarmState={alarmState}
          onDeactivate={() => targetCenterAlarmService.deactivateAlarm()}
        />
      )}

      {/* Filter and Search Bar with Dropdown Filter */}
      <div className="flex flex-col gap-2.5 bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Dropdown Filter for Metal Category */}
          <div className="relative min-w-[210px] sm:w-auto">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-cyan-400 flex items-center">
              <Filter className="w-3.5 h-3.5" />
            </div>
            <select
              id="metal-category-filter-dropdown"
              value={selectedCategory}
              onChange={(e) => handleSelectCategory(e.target.value)}
              className="w-full sm:w-auto pl-8 pr-8 py-2 bg-slate-900 border border-slate-700 hover:border-cyan-500/70 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 rounded-xl text-xs font-mono text-slate-100 outline-none transition-all cursor-pointer shadow-sm appearance-none font-medium"
              title="Filter temuan berdasarkan kategori logam"
              aria-label="Filter berdasarkan kategori logam"
            >
              <option value="all">Semua Kategori ({totalCount})</option>
              <option value="gold">★ Emas ({goldCount})</option>
              <option value="bronze">⬢ Perunggu ({bronzeCount})</option>
              <option value="meteorite">☄ Meteorit ({meteoriteCount})</option>
              <option value="other">❖ Lainnya ({otherCount})</option>
              <option value="silver">&nbsp;&nbsp;↳ Perak ({silverCount})</option>
              <option value="iron">&nbsp;&nbsp;↳ Besi / Ferrous ({ironCount})</option>
              <option value="unknown">&nbsp;&nbsp;↳ Mineral Lainnya ({unknownCount})</option>
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Cari nama temuan, koordinat, atau catatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-900 border border-slate-700/90 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
                title="Bersihkan pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Filter Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-[11px] font-mono">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
            <SlidersHorizontal className="w-3 h-3 text-slate-500" />
            Filter Cepat:
          </span>
          {[
            { id: 'all', label: 'Semua', count: totalCount },
            { id: 'favorite', label: '❤️ Favorit', count: favoriteCount },
            { id: 'priority', label: '★ Prioritas 5m', count: priorityCount },
            { id: 'gold', label: '★ Emas', count: goldCount },
            { id: 'bronze', label: '⬢ Perunggu', count: bronzeCount },
            { id: 'meteorite', label: '☄ Meteorit', count: meteoriteCount },
            { id: 'other', label: '❖ Lainnya', count: otherCount },
          ].map((tab) => {
            const isTabActive =
              tab.id === 'all'
                ? selectedCategory === 'all'
                : tab.id === 'other'
                ? selectedCategory === 'other' || ['silver', 'iron', 'unknown'].includes(selectedCategory)
                : selectedCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectCategory(tab.id)}
                className={`px-2.5 py-1 rounded-xl border whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isTabActive
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 font-semibold shadow-sm'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                    isTabActive ? 'bg-cyan-400/25 text-cyan-200' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Filter Indicator & Reset */}
        {(selectedCategory !== 'all' || searchQuery.trim() !== '') && (
          <div className="flex items-center justify-between text-[11px] font-mono bg-cyan-950/30 border border-cyan-800/40 px-2.5 py-1.5 rounded-xl text-cyan-300">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Filter className="w-3 h-3 text-cyan-400" />
              <span>
                Menampilkan <strong>{filteredFindings.length}</strong> dari {totalCount} temuan
                {selectedCategory !== 'all' && (
                  <span>
                    {' '}• Kategori:{' '}
                    <strong className="text-white">{getCategoryLabel(selectedCategory)}</strong>
                  </span>
                )}
                {searchQuery.trim() !== '' && (
                  <span> • Cari: "<strong>{searchQuery}</strong>"</span>
                )}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                handleSelectCategory('all');
                setSearchQuery('');
              }}
              className="text-[10px] text-cyan-400 hover:text-white underline font-semibold ml-2 shrink-0 flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              <span>Reset Filter</span>
            </button>
          </div>
        )}
      </div>

      {/* List items */}
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {findings.length === 0 ? (
          <div className="text-center py-10 px-4 bg-slate-950/40 rounded-2xl border border-slate-800/60">
            <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-2 animate-bounce" />
            <p className="text-xs font-semibold text-slate-400">Belum Ada Titik Temuan Tersimpan</p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-1">
              Saat fitur <strong>Auto-Simpan GPS</strong> aktif, aplikasi akan otomatis mencatat koordinat saat Anda mendekati benda logam di atas ambang batas.
            </p>
          </div>
        ) : filteredFindings.length === 0 ? (
          <div className="text-center py-8 px-4 bg-slate-950/40 rounded-2xl border border-slate-800/60">
            <Filter className="w-7 h-7 text-slate-500 mx-auto mb-2 opacity-60" />
            <p className="text-xs font-semibold text-slate-300">
              Tidak Ada Temuan untuk Kategori "{getCategoryLabel(selectedCategory)}"
            </p>
            <p className="text-[11px] text-slate-500 max-w-xs mx-auto mt-1">
              Tidak ada data temuan yang cocok dengan filter atau kata kunci saat ini.
            </p>
            <button
              type="button"
              onClick={() => {
                handleSelectCategory('all');
                setSearchQuery('');
              }}
              className="mt-3 px-3 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-medium transition-all"
            >
              Tampilkan Semua Temuan
            </button>
          </div>
        ) : (
          filteredFindings.map((finding) => {
            const theme = getCategoryTheme(finding.category);
            return (
              <div
                key={finding.id}
                className="bg-slate-950/80 hover:bg-slate-950 border border-slate-800/90 rounded-2xl p-3.5 transition-all flex flex-col gap-2.5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base border"
                      style={{
                        backgroundColor: theme.bg,
                        color: theme.color,
                        borderColor: theme.border,
                      }}
                    >
                      {theme.symbol}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-xs sm:text-sm text-slate-100">{finding.name}</h4>
                        <span
                          className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${theme.chip}`}
                        >
                          {getCategoryLabel(finding.category)}
                        </span>
                        <span
                          className={`text-[9px] font-mono px-2 py-0.5 rounded-full ${
                            finding.autoSaved
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          }`}
                        >
                          {finding.autoSaved ? 'Auto-GPS' : 'Manual'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 text-[11px] text-slate-400 font-mono mt-0.5 flex-wrap">
                        <span className="text-amber-400 font-semibold">{finding.magneticStrength.toFixed(1)} µT</span>
                        <span>•</span>
                        <span>{new Date(finding.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {/* Toggle Favorite for Map Filter & Quick Access */}
                    {onToggleFavorite && (
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(finding.id)}
                        className={`px-2.5 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all flex items-center gap-1 active:scale-95 ${
                          finding.isFavorite
                            ? 'bg-rose-500/25 text-rose-300 border-rose-400 shadow-sm ring-1 ring-rose-400/40'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-300 border-slate-700/80 hover:border-rose-500/50'
                        }`}
                        title={
                          finding.isFavorite
                            ? 'Temuan Favorit (Aktif di Filter Khusus Peta). Klik untuk hapus dari favorit.'
                            : 'Tandai sebagai Favorit agar muncul di filter khusus pada peta'
                        }
                      >
                        <span className={finding.isFavorite ? 'text-rose-400' : 'text-slate-500'}>
                          {finding.isFavorite ? '❤️' : '🤍'}
                        </span>
                        <span className="hidden sm:inline">
                          {finding.isFavorite ? 'Favorit' : 'Favoritkan'}
                        </span>
                      </button>
                    )}

                    {/* Toggle Priority for 5m Geofence Alarm */}
                    {onTogglePriority && (
                      <button
                        type="button"
                        onClick={() => onTogglePriority(finding.id)}
                        className={`px-2.5 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all flex items-center gap-1 active:scale-95 ${
                          finding.isPriority
                            ? 'bg-amber-500/25 text-amber-300 border-amber-400 shadow-sm ring-1 ring-amber-400/40'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border-slate-700/80 hover:border-amber-500/50'
                        }`}
                        title={
                          finding.isPriority
                            ? 'Sasaran Prioritas Geofence Aktif (Notifikasi Suara 5m). Klik untuk nonaktifkan.'
                            : 'Aktifkan sebagai Sasaran Prioritas Geofence (Notifikasi Suara otomatis saat masuk 5m)'
                        }
                      >
                        <span className={finding.isPriority ? 'text-amber-400' : 'text-slate-500'}>
                          {finding.isPriority ? '★' : '☆'}
                        </span>
                        <span className="hidden sm:inline">
                          {finding.isPriority ? 'Geofence 5m' : 'Prioritas'}
                        </span>
                      </button>
                    )}

                    {/* Sensor Alarm Online/Offline Toggle Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleAlarm(finding)}
                      className={`px-2.5 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all flex items-center gap-1.5 active:scale-95 ${
                        alarmState.isActive && alarmState.targetId === finding.id
                          ? 'bg-rose-500/25 text-rose-300 border-rose-500/80 shadow-md ring-1 ring-rose-500/50 animate-pulse'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border-slate-700/80 hover:border-cyan-500/50'
                      }`}
                      title={
                        alarmState.isActive && alarmState.targetId === finding.id
                          ? 'Sensor Alarm Titik Pusat sedang ONLINE (Aktif). Klik untuk matikan (OFFLINE).'
                          : 'Aktifkan Sensor Alarm Titik Pusat (ONLINE) untuk memandu ke pusat lokasi benda'
                      }
                    >
                      <Radio
                        className={`w-3.5 h-3.5 ${
                          alarmState.isActive && alarmState.targetId === finding.id
                            ? 'text-rose-400 animate-spin'
                            : 'text-slate-400'
                        }`}
                      />
                      <span className="hidden sm:inline">
                        {alarmState.isActive && alarmState.targetId === finding.id
                          ? `Alarm Pusat: ONLINE (${alarmState.distanceMeters.toFixed(1)}m)`
                          : 'Alarm Pusat: OFFLINE'}
                      </span>
                      <span className="sm:hidden font-bold">
                        {alarmState.isActive && alarmState.targetId === finding.id
                          ? `${alarmState.distanceMeters.toFixed(1)}m`
                          : 'Alarm'}
                      </span>
                    </button>

                    {onOpenAnalysisModal && (
                      <button
                        type="button"
                        onClick={() => onOpenAnalysisModal(finding)}
                        className={`p-2 rounded-xl border transition-all ${
                          finding.aiAnalysis
                            ? 'bg-indigo-600/25 text-indigo-300 border-indigo-500/50 hover:bg-indigo-600/35 shadow-sm'
                            : 'bg-slate-900 hover:bg-indigo-900/30 text-indigo-400 border-slate-700/80 hover:border-indigo-500/40'
                        }`}
                        title={finding.aiAnalysis ? 'Lihat Hasil Analisis Gemini AI' : 'Analisis Artefak & Sejarah dengan Gemini AI'}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenCompassForFinding(finding)}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-amber-950/40 text-amber-400 border border-slate-700/80 hover:border-amber-500/50 transition-colors"
                      title="Arahkan Kompas GPS ke titik temuan ini"
                    >
                      <Compass className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onNavigateToMap(finding)}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-700/80 transition-colors"
                      title="Lihat di Peta"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                    </button>

                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${finding.lat},${finding.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-blue-400 border border-slate-700/80 transition-colors"
                      title="Buka Rute di Google Maps"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      type="button"
                      onClick={() => onDeleteFinding(finding.id)}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-700/80 transition-colors"
                      title="Hapus Temuan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Visual Depth Estimation & Soil Stratum Indicator Strip */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs font-mono">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      Ikon Kedalaman Tanah:
                    </span>
                    <SoilDepthIndicator
                      depthCm={finding.depthEstimateCm}
                      itemName={finding.name}
                      category={finding.category}
                    />
                  </div>

                  {alarmState.isActive && alarmState.targetId === finding.id ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-rose-300 bg-rose-950/60 px-2.5 py-1 rounded-xl border border-rose-500/50 font-semibold animate-pulse">
                      <Radio className="w-3 h-3 text-rose-400 animate-spin" />
                      <span>Pusat: <strong>{alarmState.distanceMeters.toFixed(1)} m</strong></span>
                      <span className="text-rose-400/80 text-[10px]">(~{alarmState.bearingDegrees}°)</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggleAlarm(finding)}
                      className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 transition-colors"
                    >
                      <Radio className="w-3 h-3 text-cyan-400" />
                      <span>Pantau Titik Pusat (Alarm Online) →</span>
                    </button>
                  )}
                </div>

              {/* Coordinates line */}
              <div className="text-[10px] font-mono text-slate-500 bg-slate-900/50 px-2.5 py-1.5 rounded-xl border border-slate-800/80 flex items-center justify-between">
                <span>GPS: {finding.lat.toFixed(6)}, {finding.lng.toFixed(6)} (±{Math.round(finding.accuracy)}m)</span>
                <span>Waktu: {new Date(finding.timestamp).toLocaleDateString()}</span>
              </div>

              {/* AI Analysis Artifact Card (if analyzed) */}
              {finding.aiAnalysis && (
                <div className="bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900/80 border border-indigo-500/40 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div>
                      <div className="text-white font-bold text-xs flex items-center gap-1.5">
                        <span>{finding.aiAnalysis.artifactName}</span>
                        <span className="text-[10px] text-emerald-400 font-normal">
                          ({finding.aiAnalysis.confidenceScore}%)
                        </span>
                      </div>
                      <div className="text-[10px] text-indigo-300">
                        Era: {finding.aiAnalysis.historicalEra}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenAnalysisModal?.(finding)}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold shrink-0 px-2 py-1 rounded bg-indigo-500/20 border border-indigo-500/30"
                  >
                    Kaji AI →
                  </button>
                </div>
              )}

              {/* Note section */}
              {editingId === finding.id ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={editNoteText}
                    onChange={(e) => setEditNoteText(e.target.value)}
                    placeholder="Tulis catatan temuan..."
                    className="flex-1 bg-slate-900 border border-cyan-500/50 rounded-lg px-2 py-1 text-xs text-slate-200 font-mono focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => saveEditNote(finding.id)}
                    className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
                    title="Simpan Catatan"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs text-slate-400 gap-2">
                  <span className="italic truncate flex-1">
                    {finding.note ? `"${finding.note}"` : 'Belum ada catatan...'}
                  </span>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Auto-Note with Gemini */}
                    <button
                      type="button"
                      onClick={() => handleGenerateAutoNote(finding)}
                      disabled={isGeneratingNoteId === finding.id}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono px-2 py-0.5 rounded bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 transition-all disabled:opacity-50"
                      title="Buatkan Catatan Pengamatan Lapangan Otomatis Menggunakan Gemini AI"
                    >
                      {isGeneratingNoteId === finding.id ? (
                        <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                      ) : (
                        <Wand2 className="w-3 h-3 text-indigo-400" />
                      )}
                      <span>Auto-Note AI</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => startEditNote(finding)}
                      className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 font-mono"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{finding.note ? 'Ubah' : '+ Catatan'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
      </div>
      </div>
      )}

      {/* NTB Priority Findings Tab Mode */}
      {activeTabMode === 'ntb_priority' && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-150">
          {/* NTB Header & Compass CTA */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Compass className="w-5 h-5 text-amber-400 animate-spin" style={{ animationDuration: '20s' }} />
                <span>Daftar Temuan Prioritas NTB (Nusa Tenggara Barat)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Database geospasial anomali logam mulia, deposit emas purba Sekotong, artefak perunggu Selaparang, dan patahan meteorit Kaldera Tambora.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleOpenCompass()}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-mono font-bold shadow-lg shadow-amber-900/40 transition-all active:scale-95"
                title="Buka Kompas GPS Navigasi untuk menuju titik sasaran NTB"
              >
                <Compass className="w-4 h-4 animate-spin" style={{ animationDuration: '10s' }} />
                <span>Buka Kompas GPS Navigasi NTB</span>
              </button>
            </div>
          </div>

          {/* Quick Stats Grid for NTB */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-3 rounded-2xl border bg-slate-950/60 border-slate-800/80">
              <div className="text-[10px] font-mono text-slate-400 uppercase">Total Sasaran NTB</div>
              <div className="text-xl font-bold font-mono text-slate-100 mt-1">{NTB_PRIORITY_FINDINGS.length} Titik</div>
            </div>
            <div className="p-3 rounded-2xl border bg-yellow-950/20 border-yellow-500/30">
              <div className="text-[10px] font-mono text-yellow-400 uppercase">Emas & Mulia</div>
              <div className="text-xl font-bold font-mono text-yellow-400 mt-1">
                {NTB_PRIORITY_FINDINGS.filter((f) => f.category === 'gold').length} Lokasi
              </div>
            </div>
            <div className="p-3 rounded-2xl border bg-orange-950/20 border-orange-500/30">
              <div className="text-[10px] font-mono text-orange-400 uppercase">Artefak Perunggu</div>
              <div className="text-xl font-bold font-mono text-orange-400 mt-1">
                {NTB_PRIORITY_FINDINGS.filter((f) => f.category === 'bronze').length} Lokasi
              </div>
            </div>
            <div className="p-3 rounded-2xl border bg-purple-950/20 border-purple-500/30">
              <div className="text-[10px] font-mono text-purple-400 uppercase">Meteorit Tambora</div>
              <div className="text-xl font-bold font-mono text-purple-400 mt-1">
                {NTB_PRIORITY_FINDINGS.filter((f) => f.category === 'meteorite').length} Lokasi
              </div>
            </div>
          </div>

          {/* Target Center Sensor Alarm HUD Banner when an alarm is active (ONLINE) */}
          {alarmState.isActive && alarmState.targetId && (
            <TargetCenterAlarmBanner
              alarmState={alarmState}
              onDeactivate={() => targetCenterAlarmService.deactivateAlarm()}
            />
          )}

          {/* NTB Filter & Search Bar */}
          <div className="flex flex-col gap-2.5 bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
            {/* Region selector pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px] font-mono">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
                <MapPin className="w-3 h-3 text-amber-400" />
                Wilayah NTB:
              </span>
              {[
                { id: 'all', label: 'Semua NTB' },
                { id: 'Lombok Barat', label: 'Lombok Barat' },
                { id: 'Lombok Timur', label: 'Lombok Timur' },
                { id: 'Lombok Tengah', label: 'Lombok Tengah' },
                { id: 'Sumbawa Barat', label: 'Sumbawa Barat' },
                { id: 'Sumbawa', label: 'Sumbawa' },
                { id: 'Dompu / Tambora', label: 'Dompu / Tambora' },
                { id: 'Bima', label: 'Bima' },
              ].map((reg) => {
                const isActive = selectedNTBRegion === reg.id;
                const count =
                  reg.id === 'all'
                    ? NTB_PRIORITY_FINDINGS.length
                    : NTB_PRIORITY_FINDINGS.filter((f) => f.region === reg.id).length;
                return (
                  <button
                    key={reg.id}
                    type="button"
                    onClick={() => setSelectedNTBRegion(reg.id)}
                    className={`px-2.5 py-1 rounded-xl border whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 font-semibold shadow-sm'
                        : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <span>{reg.label}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive ? 'bg-amber-400/25 text-amber-200' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search and Priority Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {/* Priority Select */}
              <div className="relative min-w-[180px] sm:w-auto">
                <select
                  value={selectedNTBPriority}
                  onChange={(e) => setSelectedNTBPriority(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 bg-slate-900 border border-slate-700 hover:border-amber-500/60 focus:border-amber-400 rounded-xl text-xs font-mono text-slate-100 outline-none transition-all cursor-pointer font-medium"
                >
                  <option value="all">Semua Tingkat Prioritas</option>
                  <option value="SANGAT TINGGI">★ Prioritas: SANGAT TINGGI</option>
                  <option value="TINGGI">▲ Prioritas: TINGGI</option>
                  <option value="SEDANG">● Prioritas: SEDANG</option>
                </select>
              </div>

              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Cari nama sasaran, artefak, era sejarah NTB..."
                  value={ntbSearchQuery}
                  onChange={(e) => setNtbSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-900 border border-slate-700/90 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                />
                {ntbSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setNtbSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
                    title="Bersihkan pencarian"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Active filter summary */}
            {(selectedNTBRegion !== 'all' || selectedNTBPriority !== 'all' || ntbSearchQuery.trim() !== '') && (
              <div className="flex items-center justify-between text-[11px] font-mono bg-amber-950/30 border border-amber-800/40 px-2.5 py-1.5 rounded-xl text-amber-300">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Filter className="w-3 h-3 text-amber-400" />
                  <span>
                    Menampilkan <strong>{filteredNTBFindings.length}</strong> dari {NTB_PRIORITY_FINDINGS.length} sasaran prioritas NTB
                    {selectedNTBRegion !== 'all' && <span> • Wilayah: <strong className="text-white">{selectedNTBRegion}</strong></span>}
                    {selectedNTBPriority !== 'all' && <span> • Prioritas: <strong className="text-white">{selectedNTBPriority}</strong></span>}
                    {ntbSearchQuery.trim() !== '' && <span> • Cari: "<strong>{ntbSearchQuery}</strong>"</span>}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedNTBRegion('all');
                    setSelectedNTBPriority('all');
                    setNtbSearchQuery('');
                  }}
                  className="text-[10px] text-amber-400 hover:text-white underline font-semibold ml-2 shrink-0 flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  <span>Reset Filter</span>
                </button>
              </div>
            )}
          </div>

          {/* NTB Priority Findings Cards List */}
          <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
            {filteredNTBFindings.length === 0 ? (
              <div className="text-center py-8 px-4 bg-slate-950/40 rounded-2xl border border-slate-800/60">
                <Compass className="w-7 h-7 text-slate-500 mx-auto mb-2 opacity-60" />
                <p className="text-xs font-semibold text-slate-300">
                  Tidak Ada Sasaran NTB yang Cocok
                </p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto mt-1">
                  Coba sesuaikan pilihan filter wilayah atau kata kunci pencarian.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedNTBRegion('all');
                    setSelectedNTBPriority('all');
                    setNtbSearchQuery('');
                  }}
                  className="mt-3 px-3 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-mono font-medium transition-all"
                >
                  Tampilkan Semua Sasaran NTB
                </button>
              </div>
            ) : (
              filteredNTBFindings.map((item) => {
                const theme = getCategoryTheme(item.category);
                const userLat = userLocation?.lat ?? -8.5833;
                const userLng = userLocation?.lng ?? 116.1167;
                const distanceM = calculateDistanceMeters(userLat, userLng, item.lat, item.lng);
                const bearingDeg = calculateBearingDegrees(userLat, userLng, item.lat, item.lng);
                const cardinal = getCardinalDirectionIndo(bearingDeg);
                const formattedDistance =
                  distanceM >= 1000
                    ? `${(distanceM / 1000).toFixed(1)} km`
                    : `${Math.round(distanceM)} m`;
                const userHeading = userLocation?.heading || 0;
                const needleAngle = (bearingDeg - userHeading + 360) % 360;
                const isAlarmOnline = alarmState.isActive && alarmState.targetId === item.id;
                const isPinned = pinnedNTBIds.has(item.id);

                return (
                  <div
                    key={item.id}
                    className="bg-slate-950/85 hover:bg-slate-950 border border-slate-800/90 rounded-2xl p-4 transition-all flex flex-col gap-3 shadow-md"
                  >
                    {/* Header line */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base border shrink-0 mt-0.5"
                          style={{
                            backgroundColor: theme.bg,
                            color: theme.color,
                            borderColor: theme.border,
                          }}
                        >
                          {theme.symbol}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-sm sm:text-base text-slate-100">{item.name}</h4>
                            <span
                              className={`text-[9px] font-mono px-2 py-0.5 rounded-full border font-bold uppercase ${
                                item.priority === 'SANGAT TINGGI'
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                                  : item.priority === 'TINGGI'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                                  : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                              }`}
                            >
                              {item.priority}
                            </span>
                            <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${theme.chip}`}>
                              {getCategoryLabel(item.category)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5 flex-wrap">
                            <span className="flex items-center gap-1 text-cyan-300">
                              <MapPin className="w-3 h-3 text-cyan-400" />
                              {item.locationName}
                            </span>
                            <span>•</span>
                            <span className="text-amber-400 font-semibold">{item.magneticStrength.toFixed(1)} µT</span>
                            <span>•</span>
                            <span className="text-slate-400">{item.elevationMeters} mdpl</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Depth Stratum Indicator Strip */}
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs font-mono">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-cyan-400" />
                          Estimasi Lapisan Tanah:
                        </span>
                        <SoilDepthIndicator
                          depthCm={item.estimatedDepthCm}
                          itemName={item.name}
                          category={item.category}
                        />
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Era: <strong className="text-slate-300">{item.estimatedAge}</strong>
                      </div>
                    </div>

                    {/* FEATURE HERO: KOMPAS GPS NAVIGASI & ALARM STRIP */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-amber-950/40 border border-amber-500/40 shadow-inner">
                      <div className="flex items-center gap-3">
                        {/* Mini Rotating Compass Indicator */}
                        <div className="relative w-11 h-11 rounded-2xl bg-slate-950 border border-amber-500/60 flex items-center justify-center shrink-0 shadow-md">
                          <div
                            className="w-full h-full flex items-center justify-center transition-transform duration-300"
                            style={{ transform: `rotate(${needleAngle}deg)` }}
                          >
                            <Navigation2 className="w-6 h-6 text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.7)]" />
                          </div>
                          <div className="absolute -bottom-1 text-[8px] font-mono font-bold text-slate-300 bg-slate-900 px-1 rounded border border-slate-700">
                            {bearingDeg}°
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <Compass className="w-3 h-3 text-amber-400" />
                            <span>Navigasi Kompas GPS Lapangan:</span>
                          </div>
                          <div className="text-sm font-bold font-mono text-white flex items-center gap-2 mt-0.5">
                            <span className="text-emerald-400">{formattedDistance}</span>
                            <span className="text-slate-500">•</span>
                            <span className="text-amber-300">{bearingDeg}° {cardinal}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {/* KOMPAS GPS BUTTON */}
                        <button
                          type="button"
                          onClick={() => handleOpenCompass(item)}
                          className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-mono font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-900/30 active:scale-95 transition-all"
                          title="Buka Kompas GPS Navigasi untuk menuju titik sasaran NTB ini"
                        >
                          <Compass className="w-4 h-4 animate-spin" style={{ animationDuration: '8s' }} />
                          <span>Kompas GPS</span>
                        </button>

                        {/* Alarm Online/Offline */}
                        <button
                          type="button"
                          onClick={() => handleToggleNTBAlarm(item)}
                          className={`px-3 py-2 rounded-xl border text-xs font-mono font-semibold transition-all flex items-center gap-1.5 active:scale-95 ${
                            isAlarmOnline
                              ? 'bg-rose-500/25 text-rose-300 border-rose-500/80 shadow-md ring-1 ring-rose-500/50 animate-pulse'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border-slate-700/80'
                          }`}
                          title={isAlarmOnline ? 'Alarm Titik Pusat ONLINE. Klik untuk matikan (OFFLINE).' : 'Aktifkan Sensor Alarm Titik Pusat (ONLINE)'}
                        >
                          <Radio className={`w-3.5 h-3.5 ${isAlarmOnline ? 'text-rose-400 animate-spin' : 'text-slate-400'}`} />
                          <span className="text-xs">{isAlarmOnline ? 'Alarm ONLINE' : 'Alarm OFFLINE'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Historical Context & Tactical Advice */}
                    <div className="space-y-1.5 text-xs font-mono">
                      <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 text-slate-300 leading-relaxed">
                        <span className="text-amber-400 font-semibold block mb-0.5">📜 Konteks Sejarah & Geologi:</span>
                        <p className="text-[11px] text-slate-400">{item.historicalContext}</p>
                      </div>

                      <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 text-slate-300 leading-relaxed">
                        <span className="text-cyan-400 font-semibold block mb-0.5">🎯 Saran Taktis Detektor:</span>
                        <p className="text-[11px] text-slate-400">{item.tacticalAdvice}</p>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-850 flex-wrap text-xs font-mono">
                      <div className="text-[10px] text-slate-500">
                        GPS: {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handlePinNTB(item)}
                          disabled={isPinned}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border transition-all ${
                            isPinned
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 opacity-80'
                              : 'bg-slate-900 hover:bg-cyan-900/30 text-cyan-300 border-slate-700 hover:border-cyan-500/50'
                          }`}
                          title="Simpan titik sasaran NTB ini ke daftar temuan pribadi"
                        >
                          <Sparkles className="w-3 h-3 text-cyan-400" />
                          <span>{isPinned ? 'Tersimpan di Log' : '+ Pin ke Koleksi'}</span>
                        </button>

                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-blue-400 border border-slate-700/80 transition-colors"
                          title="Buka rute navigasi di Google Maps"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Google Maps</span>
                        </a>

                        <button
                          type="button"
                          onClick={() =>
                            onNavigateToMap({
                              id: item.id,
                              timestamp: Date.now(),
                              lat: item.lat,
                              lng: item.lng,
                              accuracy: 3.0,
                              magneticStrength: item.magneticStrength,
                              netStrength: item.magneticStrength - 45,
                              category: item.category,
                              name: item.name,
                              depthEstimateCm: item.estimatedDepthCm,
                              autoSaved: false,
                            })
                          }
                          className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-700/80 transition-colors"
                          title="Lihat di Peta"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* GPS Compass Navigation Modal for NTB Priority Findings & User Targets */}
      <GpsCompassModal
        isOpen={isCompassModalOpen}
        onClose={() => setIsCompassModalOpen(false)}
        targetFinding={selectedCompassTarget}
        onSelectFinding={(target) => setSelectedCompassTarget(target)}
        userLocation={userLocation ?? null}
        onPinToUserFindings={handlePinNTB}
        onNavigateToMap={() => {
          setIsCompassModalOpen(false);
          onNavigateToMap?.({
            id: selectedCompassTarget.id,
            timestamp: Date.now(),
            lat: selectedCompassTarget.lat,
            lng: selectedCompassTarget.lng,
            accuracy: 3.0,
            magneticStrength: selectedCompassTarget.magneticStrength,
            netStrength: selectedCompassTarget.magneticStrength - 45,
            category: selectedCompassTarget.category,
            name: selectedCompassTarget.name,
            depthEstimateCm: selectedCompassTarget.estimatedDepthCm,
            autoSaved: false,
          });
        }}
      />
    </div>
  );
};
