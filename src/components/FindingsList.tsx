import React, { useState } from 'react';
import { MetalFinding, MetalCategory, GPSLocation } from '../types/detector';
import { Download, Trash2, Search, ExternalLink, Sparkles, MapPin, Edit3, Check, FileSpreadsheet, FileCode, FileText, Share2, Loader2, Target, Wand2 } from 'lucide-react';
import { exportFindingsToCSV, exportFindingsToPDF } from '../services/exportService';
import { geminiService } from '../services/geminiService';

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
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState<string>('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);
  const [isGeneratingNoteId, setIsGeneratingNoteId] = useState<string | null>(null);

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

  const filteredFindings = findings.filter((f) => {
    const matchesCat = selectedCategory === 'all' || f.category === selectedCategory;
    const matchesSearch =
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.note && f.note.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

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

  const highestFlux = findings.reduce((max, f) => Math.max(max, f.magneticStrength), 0);
  const goldCount = findings.filter((f) => f.category === 'gold').length;
  const meteoriteCount = findings.filter((f) => f.category === 'meteorite').length;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col gap-4">
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

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
          <div className="text-[10px] font-mono text-slate-400 uppercase">Total Temuan</div>
          <div className="text-xl font-bold font-mono text-slate-100 mt-1">{findings.length} Titik</div>
        </div>
        <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
          <div className="text-[10px] font-mono text-amber-400/90 uppercase">Fluks Tertinggi</div>
          <div className="text-xl font-bold font-mono text-amber-400 mt-1">{highestFlux.toFixed(1)} µT</div>
        </div>
        <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
          <div className="text-[10px] font-mono text-yellow-400/90 uppercase">Anomali Emas</div>
          <div className="text-xl font-bold font-mono text-yellow-400 mt-1">{goldCount} Titik</div>
        </div>
        <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
          <div className="text-[10px] font-mono text-purple-400/90 uppercase">Meteorit Langka</div>
          <div className="text-xl font-bold font-mono text-purple-400 mt-1">{meteoriteCount} Titik</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Cari nama temuan, koordinat, atau catatan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-[11px] font-mono">
          {[
            { id: 'all', label: 'Semua' },
            { id: 'gold', label: '★ Emas' },
            { id: 'meteorite', label: '☄ Meteorit' },
            { id: 'silver', label: 'Perak' },
            { id: 'bronze', label: 'Perunggu' },
            { id: 'iron', label: 'Besi' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedCategory(tab.id)}
              className={`px-3 py-1.5 rounded-xl border whitespace-nowrap transition-colors ${
                selectedCategory === tab.id
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-semibold'
                  : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* List items */}
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {filteredFindings.length === 0 ? (
          <div className="text-center py-10 px-4 bg-slate-950/40 rounded-2xl border border-slate-800/60">
            <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-2 animate-bounce" />
            <p className="text-xs font-semibold text-slate-400">Belum Ada Titik Temuan Tersimpan</p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-1">
              Saat fitur <strong>Auto-Simpan GPS</strong> aktif, aplikasi akan otomatis mencatat koordinat saat Anda mendekati benda logam di atas ambang batas.
            </p>
          </div>
        ) : (
          filteredFindings.map((finding) => (
            <div
              key={finding.id}
              className="bg-slate-950/80 hover:bg-slate-950 border border-slate-800/90 rounded-2xl p-3.5 transition-all flex flex-col gap-2.5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base border"
                    style={{
                      backgroundColor:
                        finding.category === 'gold'
                          ? 'rgba(234, 179, 8, 0.15)'
                          : finding.category === 'meteorite'
                          ? 'rgba(192, 132, 252, 0.15)'
                          : 'rgba(56, 189, 248, 0.15)',
                      color:
                        finding.category === 'gold'
                          ? '#facc15'
                          : finding.category === 'meteorite'
                          ? '#c084fc'
                          : '#38bdf8',
                      borderColor:
                        finding.category === 'gold'
                          ? 'rgba(234, 179, 8, 0.4)'
                          : 'rgba(56, 189, 248, 0.4)',
                    }}
                  >
                    {finding.category === 'gold'
                      ? '★'
                      : finding.category === 'meteorite'
                      ? '☄'
                      : '⛏'}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-xs sm:text-sm text-slate-100">{finding.name}</h4>
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
                      <span>Kedalaman: ~{finding.depthEstimateCm} cm</span>
                      <span>•</span>
                      <span>{new Date(finding.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
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
          ))
        )}
      </div>
    </div>
  );
};
