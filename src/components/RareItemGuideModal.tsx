import React from 'react';
import { BookOpen, Sparkles, Compass, ShieldAlert, Award, ChevronRight, X, Flashlight, Zap } from 'lucide-react';

interface RareItemGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RareItemGuideModal: React.FC<RareItemGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Panduan Deteksi Logam & Benda Langka</h3>
              <p className="text-[11px] text-slate-400 font-mono">Pedoman Geofisika & Sensor Ponsel</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300 font-sans leading-relaxed">
          {/* Section 1: Cara Kerja */}
          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <h4 className="font-bold text-cyan-400 flex items-center gap-1.5 mb-1.5">
              <Compass className="w-4 h-4" />
              Prinsip Kerja Magnetometer Ponsel
            </h4>
            <p className="text-slate-300 text-[11px]">
              Ponsel cerdas modern dilengkapi sensor <strong>Magnetometer 3-Axis</strong> (sensor kompas) yang mengukur medan magnet total bumi dalam satuan <strong>Mikrotesla (µT)</strong>. Di permukaan bumi, nilai normal berada di kisaran <strong>30 - 65 µT</strong>. Ketika ponsel digerakkan dekat logam feromagnetik atau konduktif berdaya induksi tinggi, garis fluks magnet bumi akan terdistorsi secara tajam.
            </p>
          </div>

          {/* Section 2: Panduan Benda Langka */}
          <div>
            <h4 className="font-bold text-amber-400 flex items-center gap-1.5 mb-2">
              <Sparkles className="w-4 h-4" />
              Klasifikasi Benda & Karakteristik Medan:
            </h4>
            <div className="space-y-2">
              <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 flex gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-purple-900/80 text-purple-300 flex items-center justify-center font-bold shrink-0 text-xs">
                  ☄
                </div>
                <div>
                  <div className="font-bold text-purple-300 text-xs">Batu Meteorit Langka (&gt; 140 µT)</div>
                  <p className="text-[11px] text-purple-200/80 mt-0.5">
                    Mengandung persentase tinggi paduan Kamacite & Taenite (besi-nikel kosmik) atau mineral magnetit murni. Menghasilkan lonjakan magnetik sangat tinggi bahkan pada jarak 5-15 cm.
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-yellow-950/40 border border-yellow-500/30 flex gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-yellow-900/80 text-yellow-300 flex items-center justify-center font-bold shrink-0 text-xs">
                  ★
                </div>
                <div>
                  <div className="font-bold text-yellow-300 text-xs">Koin Emas & Logam Mulia (85 - 140 µT)</div>
                  <p className="text-[11px] text-yellow-200/80 mt-0.5">
                    Meskipun emas murni diamagnetik, perhiasan emas dan koin kuno biasanya dipadukan dengan tembaga/nikel dan memicu anomali arus pusar (eddy current) yang terdeteksi saat sensor diayunkan.
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-sky-950/40 border border-sky-500/30 flex gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-sky-900/80 text-sky-300 flex items-center justify-center font-bold shrink-0 text-xs">
                  ◈
                </div>
                <div>
                  <div className="font-bold text-sky-300 text-xs">Perak & Artefak Perunggu (30 - 85 µT)</div>
                  <p className="text-[11px] text-sky-200/80 mt-0.5">
                    Peninggalan sejarah seperti pedang keris kuno, koin dirham perak kuno, mata tombak, dan bejana perunggu.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Tips Lapangan */}
          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <h4 className="font-bold text-emerald-400 flex items-center gap-1.5 mb-2">
              <Award className="w-4 h-4" />
              Tips Pencarian Lapangan Maksimal
            </h4>
            <ul className="space-y-1.5 text-[11px] text-slate-300 list-disc list-inside">
              <li>
                <strong>Tara Nol (Kalibrasi):</strong> Lakukan kalibrasi tara nol di udara terbuka yang jauh dari mobil atau tiang listrik agar nilai latar tanah terisolasi.
              </li>
              <li>
                <strong>Lepas Casing Magnetik:</strong> Lepaskan case HP berpenutup magnetik atau ring magnet MagSafe agar tidak mengganggu sensor internal.
              </li>
              <li>
                <strong>Arah Sensor:</strong> Sensor magnet biasanya berada di bagian atas atau sudut kamera ponsel. Ayunkan bagian atas ponsel sedekat mungkin dengan permukaan tanah (3-10 cm).
              </li>
              <li>
                <strong>Fitur Auto-Simpan:</strong> Biarkan fitur Auto-Simpan GPS aktif. Koordinat akan langsung tercatat di peta saat mendeteksi lonjakan tanpa perlu repot menekan tombol.
              </li>
              <li>
                <strong>Proximity Pulse (Flash LED Malam):</strong> Di lingkungan gelap atau minim cahaya, aktifkan Proximity Pulse (ikon senter di header). Lampu flash LED ponsel akan berkedip dengan frekuensi yang makin rapat saat kian dekat dengan target tersembunyi.
              </li>
              <li>
                <strong>Mode Hemat Baterai Cerdas:</strong> Saat menjelajah lapangan berjam-jam, sistem otomatis memangkas frekuensi magnetometer (30 Hz ➔ 6 Hz, atau 2 Hz saat layar mati) dan mengalihkan GPS ke mode hemat daya saat baterai menipis (≤20%) agar ponsel Anda awet seharian.
              </li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-semibold shadow-lg shadow-emerald-900/30 transition-colors"
          >
            Siap Berburu
          </button>
        </div>
      </div>
    </div>
  );
};
