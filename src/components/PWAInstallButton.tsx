import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X, CheckCircle2, Share } from 'lucide-react';

interface PWAInstallButtonProps {
  variant?: 'header' | 'button' | 'full';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

  // If already running inside installed standalone PWA app, hide button
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      {variant === 'header' ? (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-mono transition-all active:scale-95 shadow-sm ${
            isInstallable
              ? 'bg-gradient-to-r from-emerald-600/90 to-teal-600/90 hover:from-emerald-500 hover:to-teal-500 text-white border-emerald-400 font-bold shadow-emerald-950/40'
              : 'bg-slate-800/80 hover:bg-slate-700/80 text-emerald-400 border-emerald-500/30'
          } ${className}`}
          title="Instal MetalScan PRO di Perangkat Android atau Ponsel Anda"
        >
          <Smartphone className={`w-3.5 h-3.5 ${isInstallable ? 'animate-bounce' : ''}`} />
          <span className="hidden sm:inline">Instal App</span>
          <span className="sm:hidden">Instal</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs font-mono shadow-lg shadow-emerald-950/50 active:scale-98 transition-all ${className}`}
        >
          <Download className="w-4 h-4" />
          <span>Pasang / Instal di Android</span>
        </button>
      )}

      {/* Android & Mobile Installation Guide Modal (when beforeinstallprompt hasn't fired yet or browser requires menu flow) */}
      {showGuideModal && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-4 text-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-400 text-emerald-300 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">Pasang di Android / HP</h4>
                  <p className="text-[11px] text-slate-400 font-mono">Panduan Instalasi PWA</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-xs text-slate-300 font-mono bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
                <p className="font-semibold text-cyan-300 flex items-center gap-1.5">
                  <Share className="w-4 h-4" />
                  <span>Untuk Safari di iPhone / iPad:</span>
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                  <li>Ketuk tombol <strong>Share</strong> (ikon kotak panah ke atas) di bilah navigasi Safari.</li>
                  <li>Gulir ke bawah dan pilih <strong>Tambahkan ke Layar Utama</strong> (<em>Add to Home Screen</em>).</li>
                  <li>Ketuk <strong>Tambah</strong> di sudut kanan atas.</li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-300 font-mono bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
                <p className="font-semibold text-emerald-300 flex items-center gap-1.5">
                  <Download className="w-4 h-4" />
                  <span>Untuk Google Chrome di Android:</span>
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                  <li>Ketuk ikon titik tiga <strong>(⋮)</strong> di sudut kanan atas browser Chrome.</li>
                  <li>Pilih menu <strong>&ldquo;Instal Aplikasi&rdquo;</strong> atau <strong>&ldquo;Tambahkan ke Layar Utama&rdquo;</strong>.</li>
                  <li>Ketuk <strong>Instal</strong>. Aplikasi akan muncul di laci aplikasi Android dan beroperasi seperti aplikasi native tanpa bilah URL!</li>
                </ol>
              </div>
            )}

            <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-[11px] font-mono text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Akses offline penuh, sensor orientasi kompas, dan pelacak GPS siap digunakan.</span>
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-mono font-medium transition-colors"
            >
              Mengerti & Tutup
            </button>
          </div>
        </div>
      )}
    </>
  );
};
