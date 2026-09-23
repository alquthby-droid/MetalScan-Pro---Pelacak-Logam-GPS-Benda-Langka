import React, { useState } from 'react';
import { Sliders, Sparkles, AlertCircle, PlayCircle, RefreshCw, Flashlight } from 'lucide-react';
import { sensorManager } from '../services/sensorManager';

interface SimulationControlsProps {
  isSimulating: boolean;
  onToggleSim: (sim: boolean) => void;
  onTareZero: () => void;
  sensorType: 'hardware' | 'orientation_fallback' | 'simulation';
}

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  isSimulating,
  onToggleSim,
  onTareZero,
  sensorType,
}) => {
  const [testSlider, setTestSlider] = useState<number>(0);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const applyTestAnomaly = (extraStrength: number) => {
    setTestSlider(extraStrength);
    sensorManager.setSimulatedAnomaly(extraStrength);
    if (!isSimulating) {
      onToggleSim(true);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setTestSlider(val);
    sensorManager.setSimulatedAnomaly(val);
    if (!isSimulating) {
      onToggleSim(true);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400"></div>
          <span className="text-xs font-mono font-semibold text-slate-200 flex items-center gap-1.5 flex-wrap">
            <span>Sumber Sensor:</span>
            <span className="text-cyan-400 uppercase">
              {sensorType === 'hardware'
                ? 'Magnetometer Hardware'
                : sensorType === 'orientation_fallback'
                ? 'Sensor Orientasi'
                : 'Mode Simulasi'}
            </span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono border ${
              sensorManager.isPowerSavingActive()
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              {sensorManager.getTargetFrequency()} Hz {sensorManager.isPowerSavingActive() ? '• Eco' : ''}
            </span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 transition-colors"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>{isExpanded ? 'Tutup Kontrol Uji' : 'Panel Uji Coba Logam'}</span>
        </button>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-3">
          <div className="flex items-start gap-2 text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <p>
              Gunakan tombol uji di bawah untuk menyimulasikan deteksi logam secara instan. Grafik fluks, audio detektor, getaran, dan fitur <strong>Auto-Simpan GPS</strong> akan langsung merespon!
            </p>
          </div>

          {/* Quick preset buttons */}
          <div>
            <div className="text-[10px] font-mono text-slate-400 uppercase mb-1.5 flex items-center justify-between">
              <span>Preset Uji Coba Benda Logam:</span>
              <button
                type="button"
                onClick={() => applyTestAnomaly(0)}
                className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Jauhkan Benda (0 µT)
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => applyTestAnomaly(110)}
                className="p-2 rounded-xl bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Koin Emas (+110 µT)</span>
              </button>

              <button
                type="button"
                onClick={() => applyTestAnomaly(165)}
                className="p-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span>Meteorit (+165 µT)</span>
              </button>

              <button
                type="button"
                onClick={() => applyTestAnomaly(65)}
                className="p-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <span>Relik Perak (+65 µT)</span>
              </button>

              <button
                type="button"
                onClick={() => applyTestAnomaly(25)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <span>Paku Besi (+25 µT)</span>
              </button>
            </div>
          </div>

          {/* Manual Range Slider */}
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-xs font-mono text-slate-300 mb-1.5">
              <span>Slider Kekuatan Fluks Uji:</span>
              <span className="font-bold text-cyan-400">+{testSlider} µT Tambahan</span>
            </div>
            <input
              type="range"
              min="0"
              max="200"
              step="2"
              value={testSlider}
              onChange={handleSliderChange}
              className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-1">
              <span>0 µT (Latar)</span>
              <span>50 µT</span>
              <span>100 µT</span>
              <span>150 µT</span>
              <span>200 µT (Maksimum)</span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] font-mono text-amber-300">
            <Flashlight className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span>
              <strong>Uji Proximity Pulse:</strong> Pilih preset Emas (+110 µT) atau geser slider untuk mengamati lampu flash LED & visual strobe berkedip cepat sebanding lonjakan sinyal.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
