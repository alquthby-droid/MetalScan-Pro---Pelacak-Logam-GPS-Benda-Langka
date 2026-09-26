import React, { useState, useEffect } from 'react';
import { MetalFinding, GPSLocation } from '../types/detector';
import { exportFindingsToCSV, exportFindingsToPDF, generateMapSnapshot } from '../services/exportService';
import { trailService, TrailSummary } from '../services/trailService';
import {
  Download,
  FileSpreadsheet,
  FileText,
  MapPin,
  Sparkles,
  X,
  CheckCircle2,
  Loader2,
  Calendar,
  User,
  Compass,
  Eye,
  Route,
  Navigation,
} from 'lucide-react';

interface ExportFindingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  findings: MetalFinding[];
  userLocation: GPSLocation | null;
}

export const ExportFindingsModal: React.FC<ExportFindingsModalProps> = ({
  isOpen,
  onClose,
  findings,
  userLocation,
}) => {
  const [surveyorName, setSurveyorName] = useState<string>('Prospector / Surveyor Lapangan');
  const [areaLocation, setAreaLocation] = useState<string>('Sektor Eksplorasi Logam & Relik');
  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);
  const [isExportingCSV, setIsExportingCSV] = useState<boolean>(false);
  const [mapPreviewUrl, setMapPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);
  const [trailSummary, setTrailSummary] = useState<TrailSummary>(() => trailService.getSummary());

  // Generate a live preview of the map snapshot with travel route when opening the modal
  useEffect(() => {
    if (!isOpen || findings.length === 0) return;

    let isMounted = true;
    setIsLoadingPreview(true);
    setTrailSummary(trailService.getSummary());

    generateMapSnapshot(findings, userLocation, 720, 420)
      .then((dataUrl) => {
        if (isMounted) {
          setMapPreviewUrl(dataUrl);
          setIsLoadingPreview(false);
        }
      })
      .catch((err) => {
        console.error('Failed to generate map preview:', err);
        if (isMounted) setIsLoadingPreview(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, findings, userLocation]);

  if (!isOpen) return null;

  const handleExportCSV = () => {
    setIsExportingCSV(true);
    try {
      exportFindingsToCSV(findings);
      setExportSuccessMsg('File CSV berhasil diunduh! Siap dibuka di Microsoft Excel atau Google Sheets.');
      setTimeout(() => setExportSuccessMsg(null), 4000);
    } catch (err) {
      console.error(err);
      alert('Gagal mengekspor file CSV.');
    } finally {
      setIsExportingCSV(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      await exportFindingsToPDF(findings, userLocation, {
        surveyTitle: 'LAPORAN HASIL SURVEI EKSPLORASI LOGAM & ARTEFAK',
        surveyorName,
        areaLocation,
      });
      setExportSuccessMsg('Laporan PDF Profesional (Statistik, Peta Rute & Tabel GPS) berhasil dibuat dan diunduh!');
      setTimeout(() => setExportSuccessMsg(null), 4500);
    } catch (err) {
      console.error(err);
      alert('Gagal mengekspor dokumen PDF.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const highestFlux = findings.reduce((max, f) => Math.max(max, f.magneticStrength), 0);
  const goldCount = findings.filter((f) => f.category === 'gold').length;
  const meteoriteCount = findings.filter((f) => f.category === 'meteorite').length;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <span>Ekspor Data Temuan & Laporan</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {findings.length} Titik
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Format CSV spreadsheet atau Laporan PDF Profesional lengkap peta rute & koordinat GPS
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Notification banner */}
          {exportSuccessMsg && (
            <div className="flex items-center gap-2 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-xs font-mono text-emerald-300 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{exportSuccessMsg}</span>
            </div>
          )}

          {/* Quick Metrics Bar: Findings & Route Stats */}
          <div className="grid grid-cols-4 gap-1.5 bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800/80 font-mono text-center">
            <div>
              <div className="text-[9px] text-slate-500 uppercase">Temuan</div>
              <div className="text-xs sm:text-sm font-bold text-slate-200 mt-0.5">{findings.length} Titik</div>
            </div>
            <div>
              <div className="text-[9px] text-amber-400/80 uppercase">Fluks Puncak</div>
              <div className="text-xs sm:text-sm font-bold text-amber-400 mt-0.5">{highestFlux.toFixed(1)} µT</div>
            </div>
            <div>
              <div className="text-[9px] text-yellow-400/80 uppercase">Emas/Meteorit</div>
              <div className="text-xs sm:text-sm font-bold text-yellow-300 mt-0.5">{goldCount + meteoriteCount} Item</div>
            </div>
            <div>
              <div className="text-[9px] text-cyan-400/80 uppercase">Rute Jelajah</div>
              <div className="text-xs sm:text-sm font-bold text-cyan-300 mt-0.5">
                {trailSummary.totalDistanceMeters >= 1000
                  ? `${(trailSummary.totalDistanceMeters / 1000).toFixed(1)}km`
                  : `${Math.round(trailSummary.totalDistanceMeters)}m`}
              </div>
            </div>
          </div>

          {/* Option 1: Professional PDF Report with Map Snapshot & Travel Route */}
          <div className="bg-slate-950/90 border border-indigo-500/50 rounded-2xl p-4 space-y-3 shadow-lg shadow-indigo-950/20 hover:border-indigo-500/70 transition-all">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 flex-wrap">
                    <span>Laporan PDF Profesional</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 font-bold uppercase">
                      Statistik • Peta Rute • Tabel GPS
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Dokumen resmi A4 siap cetak memuat ringkasan statistik temuan, peta visual rute perjalanan GPS, nomor pin, dan daftar koordinat GPS dalam tabel rapi.
                  </p>
                </div>
              </div>
            </div>

            {/* Custom report metadata fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono pt-1">
              <div className="space-y-1">
                <label className="text-slate-400 text-[11px] flex items-center gap-1">
                  <User className="w-3 h-3 text-cyan-400" />
                  <span>Nama Surveyor / Petugas:</span>
                </label>
                <input
                  type="text"
                  value={surveyorName}
                  onChange={(e) => setSurveyorName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 text-[11px] flex items-center gap-1">
                  <Compass className="w-3 h-3 text-amber-400" />
                  <span>Lokasi / Nama Sektor Survei:</span>
                </label>
                <input
                  type="text"
                  value={areaLocation}
                  onChange={(e) => setAreaLocation(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Map Preview Snapshot with Travel Route */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1">
                  <Route className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Pratinjau Peta Rute Perjalanan & Titik GPS:</span>
                </span>
                <span className="text-[10px] text-cyan-300/80">Jalur Rute GPS • Arah Utara • Grid Lintang/Bujur</span>
              </div>

              <div className="relative w-full h-36 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center">
                {isLoadingPreview ? (
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                    <span>Menyusun Peta Rute Geografis...</span>
                  </div>
                ) : mapPreviewUrl ? (
                  <img
                    src={mapPreviewUrl}
                    alt="Pratinjau Peta Rute Snapshot PDF"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-slate-500 font-mono">Belum ada titik data</span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isExportingPDF || findings.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-mono font-bold text-xs shadow-lg shadow-indigo-950/50 active:scale-98 transition-all disabled:opacity-50"
            >
              {isExportingPDF ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sedang Menyusun Laporan PDF Profesional...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>Unduh Laporan PDF Profesional (.pdf)</span>
                </>
              )}
            </button>
          </div>

          {/* Option 2: CSV Spreadsheet Export Card */}
          <div className="bg-slate-950/80 border border-teal-500/30 rounded-2xl p-4 space-y-3 hover:border-teal-500/50 transition-all">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                    <span>Ekspor Format CSV Spreadsheet</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300">
                      .csv
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Format tabular universal dengan UTF-8 BOM untuk Microsoft Excel, Google Sheets, & LibreOffice.
                  </p>
                </div>
              </div>
            </div>

            <div className="text-[11px] font-mono text-slate-400 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 space-y-1">
              <div className="text-slate-300 font-semibold">Kolom yang disertakan:</div>
              <p className="text-[10px] leading-relaxed text-slate-400">
                ID, Timestamp ISO, Tanggal & Jam Lokal, Latitude & Longitude presisi 6 desimal, Nama Landmark/Lokasi, Akurasi GPS, Fluks Total & Net, Kategori Logam, Nama Temuan, Kedalaman (cm), Tipe Perekaman, & Catatan Lapangan.
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={isExportingCSV || findings.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-mono font-bold text-xs shadow-lg shadow-teal-950/40 active:scale-98 transition-all disabled:opacity-50"
            >
              {isExportingCSV ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sedang Membuat File CSV...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Unduh File CSV (.csv)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>Ekspor Waktu Riil: {new Date().toLocaleDateString('id-ID')}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
