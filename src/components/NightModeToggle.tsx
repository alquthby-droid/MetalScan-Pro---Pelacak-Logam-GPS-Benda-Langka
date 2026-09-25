import React, { useState } from 'react';
import { Moon, Sun, Eye, Sparkles, Check, ChevronDown } from 'lucide-react';
import { ThemeMode, NightModeState } from '../types/detector';

interface NightModeToggleProps {
  nightState: NightModeState;
  onSelectThemeMode: (mode: ThemeMode) => void;
  onToggleTacticalRed?: () => void;
}

export const NightModeToggle: React.FC<NightModeToggleProps> = ({
  nightState,
  onSelectThemeMode,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const getButtonContent = () => {
    switch (nightState.themeMode) {
      case 'auto':
        return {
          icon: nightState.isNightTime ? (
            <Moon className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
          ) : (
            <Sun className="w-3.5 h-3.5 text-yellow-400" />
          ),
          text: nightState.isNightTime ? 'Malam (Auto)' : 'Siang (Auto)',
          badge: nightState.isNightTime ? '🌙' : '☀️',
          chipClass: nightState.isNightTime
            ? 'bg-purple-950/40 text-purple-200 border-purple-500/50'
            : 'bg-amber-950/30 text-amber-200 border-amber-500/40',
        };
      case 'night_vision':
        return {
          icon: <Eye className="w-3.5 h-3.5 text-rose-400 animate-pulse" />,
          text: 'Taktis OLED',
          badge: '🔴',
          chipClass: 'bg-rose-950/60 text-rose-200 border-rose-500/70 shadow-sm shadow-rose-950/60',
        };
      case 'dark':
        return {
          icon: <Moon className="w-3.5 h-3.5 text-cyan-400" />,
          text: 'Gelap',
          badge: '🌑',
          chipClass: 'bg-slate-900 text-slate-200 border-slate-700',
        };
      case 'day':
        return {
          icon: <Sun className="w-3.5 h-3.5 text-amber-400" />,
          text: 'Terang',
          badge: '☀️',
          chipClass: 'bg-yellow-950/30 text-yellow-200 border-yellow-500/40',
        };
    }
  };

  const current = getButtonContent();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-mono transition-all active:scale-95 ${current.chipClass}`}
        title={`Mode Layar: ${current.text} | Waktu Lokal: ${nightState.localTimeString} (${nightState.reason})`}
      >
        {current.icon}
        <span className="hidden sm:inline font-bold">{current.text}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[650]"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 z-[660] w-64 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-2 space-y-1 backdrop-blur-xl animate-in fade-in zoom-in-95 text-xs font-mono">
            <div className="px-2.5 py-1.5 border-b border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
              <span>MODE LAYAR & REDUKSI SILAU</span>
              <span className="text-cyan-400 font-bold">{nightState.localTimeString}</span>
            </div>

            {/* Auto Mode */}
            <button
              type="button"
              onClick={() => {
                onSelectThemeMode('auto');
                setIsOpen(false);
              }}
              className={`w-full flex items-start gap-2.5 p-2 rounded-xl text-left transition-all ${
                nightState.themeMode === 'auto'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                  : 'hover:bg-slate-800/80 text-slate-300'
              }`}
            >
              <div className="mt-0.5">
                {nightState.isNightTime ? (
                  <Moon className="w-4 h-4 text-purple-400" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold flex items-center justify-between">
                  <span>Otomatis (Waktu Lokal)</span>
                  {nightState.themeMode === 'auto' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                  Aktifkan mode gelap saat matahari terbenam ({nightState.sunsetTime || '18:00'}) untuk mencegah kelelahan mata.
                </div>
              </div>
            </button>

            {/* Tactical Night Vision OLED Mode */}
            <button
              type="button"
              onClick={() => {
                onSelectThemeMode('night_vision');
                setIsOpen(false);
              }}
              className={`w-full flex items-start gap-2.5 p-2 rounded-xl text-left transition-all ${
                nightState.themeMode === 'night_vision'
                  ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40'
                  : 'hover:bg-slate-800/80 text-slate-300'
              }`}
            >
              <Eye className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-bold flex items-center justify-between text-rose-300">
                  <span>Malam Taktis (OLED Hitam)</span>
                  {nightState.themeMode === 'night_vision' && (
                    <Check className="w-3.5 h-3.5 text-rose-400" />
                  )}
                </div>
                <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                  Layar hitam murni OLED dengan aksen merah/amber untuk menjaga penglihatan malam alami di lapangan gelap.
                </div>
              </div>
            </button>

            {/* Standard Dark */}
            <button
              type="button"
              onClick={() => {
                onSelectThemeMode('dark');
                setIsOpen(false);
              }}
              className={`w-full flex items-start gap-2.5 p-2 rounded-xl text-left transition-all ${
                nightState.themeMode === 'dark'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                  : 'hover:bg-slate-800/80 text-slate-300'
              }`}
            >
              <Moon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-bold flex items-center justify-between">
                  <span>Gelap Standar</span>
                  {nightState.themeMode === 'dark' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                  Tema gelap slate standar sepanjang waktu.
                </div>
              </div>
            </button>

            {/* Day / High Contrast Mode */}
            <button
              type="button"
              onClick={() => {
                onSelectThemeMode('day');
                setIsOpen(false);
              }}
              className={`w-full flex items-start gap-2.5 p-2 rounded-xl text-left transition-all ${
                nightState.themeMode === 'day'
                  ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                  : 'hover:bg-slate-800/80 text-slate-300'
              }`}
            >
              <Sun className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-bold flex items-center justify-between">
                  <span>Mode Siang Terang</span>
                  {nightState.themeMode === 'day' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </div>
                <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                  Kontras tinggi untuk penggunaan di bawah sinar matahari terik.
                </div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
