import React from 'react';
import {
  Settings,
  Volume2,
  VolumeX,
  Vibrate,
  Save,
  Shield,
  HelpCircle,
  X,
  Flashlight,
  Zap,
  Battery,
  BatteryCharging,
  BatteryWarning,
  Leaf,
  EyeOff,
  Radio,
  Activity,
  Smartphone,
  Globe,
  Cloud,
  Play,
  Moon,
  Sun,
  Eye,
  CloudRain,
} from 'lucide-react';
import { DetectorSettings, BatteryState, ThemeMode } from '../types/detector';
import { batteryManager } from '../services/batteryManager';
import { PWAInstallButton } from './PWAInstallButton';
import { geofenceService } from '../services/geofenceService';

interface DetectorSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: DetectorSettings;
  onUpdateSettings: (newSettings: Partial<DetectorSettings>) => void;
  batteryState?: BatteryState;
  onOpenDeployGuide?: () => void;
  onOpenWeatherModal?: () => void;
}

export const DetectorSettingsModal: React.FC<DetectorSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  batteryState,
  onOpenDeployGuide,
  onOpenWeatherModal,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-md w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Pengaturan MetalScan Pro</h3>
              <p className="text-[11px] text-slate-400 font-mono">Sensitivitas, Auto-GPS & Audio</p>
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

        {/* Settings Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs font-sans">
          {/* 1. Fitur Auto-Simpan Lokasi Temuan pada Peta */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-amber-500/30 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Save className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-slate-100">Auto-Simpan GPS Otomatis</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoSaveEnabled}
                  onChange={(e) => onUpdateSettings({ autoSaveEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            <p className="text-[11px] text-slate-400">
              Menyimpan titik GPS secara otomatis pada peta saat lonjakan medan magnet melebihi ambang batas tanpa perlu menyentuh layar.
            </p>

            {settings.autoSaveEnabled && (
              <div className="pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between font-mono text-[11px] text-slate-300 mb-1">
                  <span>Ambang Batas Pemicu:</span>
                  <span className="font-bold text-amber-400">{settings.autoSaveThreshold} µT</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="180"
                  step="5"
                  value={settings.autoSaveThreshold}
                  onChange={(e) => onUpdateSettings({ autoSaveThreshold: Number(e.target.value) })}
                  className="w-full accent-amber-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
                />
                <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-1">
                  <span>Sensitif (60 µT)</span>
                  <span>Standar (90 µT)</span>
                  <span>Emas/Langka (&gt;130 µT)</span>
                </div>
              </div>
            )}
          </div>

          {/* 2. Suara & Audio Feedback */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {settings.soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-500" />
                )}
                <span className="font-bold text-slate-100">Audio Suara Detektor</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.soundEnabled}
                  onChange={(e) => onUpdateSettings({ soundEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            {settings.soundEnabled && (
              <>
                <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ audioMode: 'tone' })}
                    className={`p-2 rounded-xl border text-center transition-colors ${
                      settings.audioMode === 'tone'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    Nada Pitch Kontinu
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ audioMode: 'geiger' })}
                    className={`p-2 rounded-xl border text-center transition-colors ${
                      settings.audioMode === 'geiger'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    Klik Geiger Cepat
                  </button>
                </div>

                <div className="pt-1">
                  <div className="flex items-center justify-between font-mono text-[11px] text-slate-300 mb-1">
                    <span>Volume Audio:</span>
                    <span className="text-emerald-400">{Math.round(settings.soundVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={settings.soundVolume}
                    onChange={(e) => onUpdateSettings({ soundVolume: Number(e.target.value) })}
                    className="w-full accent-emerald-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
                  />
                </div>
              </>
            )}
          </div>

          {/* 3. Proximity Pulse (Lampu Kilat Flash LED / Visual Strobe) */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-amber-500/20 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flashlight className="w-4 h-4 text-amber-400" />
                <div>
                  <div className="font-bold text-slate-100 flex items-center gap-1.5">
                    <span>Proximity Pulse (Flash LED)</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Night Vision
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Flash LED ponsel berkedip sebanding dengan intensitas medan logam
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.proximityPulseEnabled ?? true}
                  onChange={(e) => onUpdateSettings({ proximityPulseEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            <p className="text-[11px] text-slate-400">
              Alarm visual untuk lingkungan minim cahaya / malam hari. Frekuensi kedipan meningkat drastis saat semakin dekat ke target logam.
            </p>

            {(settings.proximityPulseEnabled ?? true) && (
              <div className="pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between font-mono text-[11px] text-slate-300 mb-1">
                  <span>Pemicu Pulsa Flash:</span>
                  <span className="font-bold text-amber-400">{(settings.proximityPulseThreshold || 75)} µT</span>
                </div>
                <input
                  type="range"
                  min="55"
                  max="160"
                  step="5"
                  value={settings.proximityPulseThreshold || 75}
                  onChange={(e) => onUpdateSettings({ proximityPulseThreshold: Number(e.target.value) })}
                  className="w-full accent-amber-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
                />
                <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-1">
                  <span>Cepat (55 µT)</span>
                  <span>Moderat (75 µT)</span>
                  <span>Hanya Lonjakan Kuat (130 µT)</span>
                </div>
              </div>
            )}
          </div>

          {/* 4. Getaran Haptik */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Vibrate className="w-4 h-4 text-cyan-400" />
              <div>
                <div className="font-bold text-slate-100">Getaran Haptik Android</div>
                <div className="text-[11px] text-slate-400">Ponsel bergetar saat mendekati logam</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.vibrationEnabled}
                onChange={(e) => onUpdateSettings({ vibrationEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
            </label>
          </div>

          {/* 5. Filter Diskriminasi Target */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-400" />
              <span className="font-bold text-slate-100">Mode Filter Diskriminasi</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
              {[
                { id: 'all_metal', label: 'Semua Logam' },
                { id: 'relic_gold', label: 'Emas & Relik' },
                { id: 'ferrous_reject', label: 'Tolak Besi' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onUpdateSettings({ detectionMode: m.id as any })}
                  className={`p-2 rounded-xl border text-center transition-colors ${
                    settings.detectionMode === m.id
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 font-bold'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* 6. Mode Hemat Baterai & Layar Mati (Smart Battery Saver) */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Leaf className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="font-bold text-slate-100 flex items-center gap-1.5">
                    <span>Mode Hemat Baterai Cerdas</span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                      batteryState?.isPowerSaveActive
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {batteryState?.isPowerSaveActive ? 'Eco Aktif' : 'Standby'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Otomatis turunkan frekuensi sensor saat baterai lemah atau layar mati
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.batterySaverEnabled ?? true}
                  onChange={(e) => onUpdateSettings({ batterySaverEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            {/* Real-time Hardware Telemetry Bar */}
            <div className="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800 space-y-2 font-mono text-[11px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-300">
                  {batteryState?.charging ? (
                    <BatteryCharging className="w-4 h-4 text-emerald-400 animate-pulse" />
                  ) : (batteryState?.level || 100) <= (settings.batterySaverThreshold || 20) ? (
                    <BatteryWarning className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Battery className="w-4 h-4 text-slate-300" />
                  )}
                  <span>Status Daya Baterai:</span>
                </div>
                <span className={`font-bold ${
                  (batteryState?.level || 100) <= (settings.batterySaverThreshold || 20)
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}>
                  {batteryState?.level ?? 100}% {batteryState?.charging ? '(Mengisi Daya)' : ''}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80 text-[10px]">
                <div className="bg-slate-950/60 p-1.5 rounded-lg border border-slate-800">
                  <div className="text-slate-400 flex items-center gap-1">
                    <Radio className="w-3 h-3 text-cyan-400" />
                    <span>Magnetometer:</span>
                  </div>
                  <div className="font-bold text-slate-200 mt-0.5">
                    {batteryState?.currentMagnetometerHz || 30} Hz
                    {batteryState?.isPowerSaveActive && (
                      <span className="text-emerald-400 text-[9px] ml-1">(Diturunkan)</span>
                    )}
                  </div>
                </div>

                <div className="bg-slate-950/60 p-1.5 rounded-lg border border-slate-800">
                  <div className="text-slate-400 flex items-center gap-1">
                    <EyeOff className="w-3 h-3 text-purple-400" />
                    <span>Mode GPS:</span>
                  </div>
                  <div className="font-bold text-slate-200 mt-0.5">
                    {batteryState?.gpsMode === 'battery_saving'
                      ? 'Hemat (Cell/WiFi)'
                      : batteryState?.gpsMode === 'standby'
                      ? 'Standby Layar Mati'
                      : 'Satelit GNSS Aktif'}
                  </div>
                </div>
              </div>

              {batteryState?.isScreenOff && (
                <div className="text-[10px] text-amber-300 bg-amber-500/10 p-1 rounded border border-amber-500/20">
                  Layar mati/latar belakang terdeteksi: Polling dipangkas ke 2 Hz untuk menghemat baterai maksimum.
                </div>
              )}
            </div>

            {/* Threshold Slider */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between font-mono text-[11px] text-slate-300">
                <span>Ambang Baterai Lemah:</span>
                <span className="font-bold text-emerald-400">{settings.batterySaverThreshold || 20}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="35"
                step="5"
                value={settings.batterySaverThreshold || 20}
                onChange={(e) => onUpdateSettings({ batterySaverThreshold: Number(e.target.value) })}
                className="w-full accent-emerald-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[9px] font-mono text-slate-500">
                <span>10% (Kritis)</span>
                <span>20% (Rekomendasi)</span>
                <span>35% (Konservatif)</span>
              </div>
            </div>

            {/* Manual Eco Mode Force Override */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
              <span className="text-slate-300">Paksa Mode Hemat Daya (Eco Manual)</span>
              <button
                type="button"
                onClick={() => onUpdateSettings({ forceBatterySaver: !settings.forceBatterySaver })}
                className={`px-3 py-1 rounded-xl font-mono text-[11px] border transition-all ${
                  settings.forceBatterySaver
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {settings.forceBatterySaver ? 'Aktif (Forced)' : 'Mati'}
              </button>
            </div>

            {/* Testing & Simulation Trigger */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 font-mono text-[10px]">
              <span className="text-slate-400">Uji Daya Rendah:</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => batteryManager.setSimulatedBattery(15, false)}
                  className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                  title="Simulasikan baterai 15% untuk menguji penurunan polling sensor"
                >
                  Set 15%
                </button>
                <button
                  type="button"
                  onClick={() => batteryManager.setSimulatedBattery(88, false)}
                  className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
                  title="Simulasikan baterai 88%"
                >
                  Set 88%
                </button>
                <button
                  type="button"
                  onClick={() => batteryManager.resetSimulation()}
                  className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
                  title="Kembali ke pembacaan baterai sistem asli"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* 7. Calibration Drift Monitor & Environmental Noise Alerts */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-cyan-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <div>
                  <div className="font-bold text-slate-100">Calibration Drift Monitor</div>
                  <div className="text-[11px] text-slate-400">
                    Lacak stabilitas baseline & deteksi noise magnetik
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.driftMonitorEnabled ?? true}
                  onChange={(e) => onUpdateSettings({ driftMonitorEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>

            {(settings.driftMonitorEnabled ?? true) && (
              <div className="pt-2 border-t border-slate-800 space-y-3">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-300">Ambang Toleransi Drift Baseline:</span>
                    <span className="font-bold text-cyan-400">{settings.driftAlertThreshold || 5.0} µT</span>
                  </div>
                  <input
                    type="range"
                    min="2.0"
                    max="10.0"
                    step="0.5"
                    value={settings.driftAlertThreshold || 5.0}
                    onChange={(e) => onUpdateSettings({ driftAlertThreshold: Number(e.target.value) })}
                    className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
                  />
                  <div className="flex justify-between text-[9px] font-mono text-slate-500">
                    <span>Sensitif (2 µT)</span>
                    <span>Standar (5 µT)</span>
                    <span>Toleransi Tinggi (10 µT)</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-300 text-xs">Peringatan Audio Noise Spike:</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.driftSoundAlertEnabled ?? false}
                      onChange={(e) => onUpdateSettings({ driftSoundAlertEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* 8. Radar Geofence Temuan Prioritas (Notifikasi Suara Otomatis 5 Meter) */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-amber-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-amber-400 animate-spin-slow" />
                <div>
                  <div className="font-bold text-slate-100 flex items-center gap-1.5">
                    <span>Radar Geofence (Radius 5m)</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      AUDIO OTOMATIS
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Notifikasi suara & getar otomatis saat masuk perimeter temuan prioritas
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.geofenceEnabled ?? true}
                  onChange={(e) => onUpdateSettings({ geofenceEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {(settings.geofenceEnabled ?? true) && (
              <div className="pt-2 border-t border-slate-800 space-y-3">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-300">Radius Peringatan Geofence:</span>
                    <span className="font-bold text-amber-400">
                      {settings.geofenceRadiusMeters || 5} Meter
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 font-mono text-xs">
                    {[3, 5, 10, 15].map((rad) => {
                      const isActive = (settings.geofenceRadiusMeters || 5) === rad;
                      return (
                        <button
                          key={rad}
                          type="button"
                          onClick={() => onUpdateSettings({ geofenceRadiusMeters: rad })}
                          className={`py-1.5 rounded-xl border text-center font-bold transition-all ${
                            isActive
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-sm'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          {rad}m {rad === 5 ? '★' : ''}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">
                    ★ 5 meter merupakan standar akurasi GPS lapangan optimal untuk eksplorasi logam.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-300 text-xs">Suara Chime Geofence (Web Audio):</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.geofenceSoundAlertEnabled ?? true}
                      onChange={(e) => onUpdateSettings({ geofenceSoundAlertEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-300 text-xs">Getaran Haptic HP (Pola Deteksi):</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.geofenceVibrationAlertEnabled ?? true}
                      onChange={(e) => onUpdateSettings({ geofenceVibrationAlertEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                {/* Test Audio & Simulator Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                  <button
                    type="button"
                    onClick={() => geofenceService.playTestChime(settings.soundVolume || 0.7)}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 rounded-xl transition-all active:scale-95"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Tes Nada Chime</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      geofenceService.simulateGeofenceEnter(undefined, settings);
                      onClose();
                    }}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/50 rounded-xl transition-all active:scale-95 font-bold"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Uji Masuk 5m</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 9. Panduan Deploy Gratis (Selain Vercel & Netlify) */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-cyan-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-cyan-400" />
                <div>
                  <div className="font-bold text-slate-100">Panduan Deploy Gratis</div>
                  <div className="text-[11px] text-slate-400">
                    Opsi cloud alternatif selain Vercel & Netlify (Render, Cloudflare, Railway)
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Pelajari cara mempublikasikan aplikasi MetalScan Pro secara gratis 100% dengan HTTPS aman untuk mengaktifkan sensor magnetometer HP di mana saja.
            </p>
            {onOpenDeployGuide && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDeployGuide();
                }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 font-mono text-xs font-bold transition-all"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Buka Panduan Deploy Gratis</span>
              </button>
            )}
          </div>

          {/* 10. Deteksi Waktu Lokal & Mode Gelap Otomatis (Survei Malam Taktis) */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-purple-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-purple-400" />
                <div>
                  <div className="font-bold text-slate-100 flex items-center gap-1.5">
                    <span>Mode Gelap & Deteksi Waktu Lokal</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      ERGONOMI
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Otomatis aktif saat matahari terbenam untuk mengurangi silau & kelelahan mata
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="text-xs text-slate-300 font-mono">Pilihan Mode Layar:</div>
              <div className="grid grid-cols-2 gap-1.5 font-mono text-xs">
                {[
                  { id: 'auto', label: '🌙 Otomatis (Waktu)', desc: 'Aktif saat matahari terbenam' },
                  { id: 'night_vision', label: '🔴 Malam Taktis', desc: 'OLED hitam murni & merah' },
                  { id: 'dark', label: '🌑 Gelap Standar', desc: 'Slate 950 sepanjang hari' },
                  { id: 'day', label: '☀️ Siang Terang', desc: 'Kontras tinggi sinar matahari' },
                ].map((item) => {
                  const isActive = (settings.themeMode || 'auto') === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onUpdateSettings({ themeMode: item.id as ThemeMode })}
                      className={`p-2 rounded-xl border text-left transition-all ${
                        isActive
                          ? 'bg-purple-600/25 text-purple-200 border-purple-500/70 font-bold shadow-sm'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xs">{item.label}</div>
                      <div className="text-[9px] text-slate-500 truncate mt-0.5">{item.desc}</div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                ★ <strong>Manfaat Lapangan:</strong> Mode gelap malam hari menjaga sensitivitas sel batang mata (*rhodopsin*) agar mata tidak buta sesaat saat beralih antara melihat layar HP dan mengamati medan tanah yang gelap.
              </p>
            </div>
          </div>

          {/* 11. Pemantau Cuaca & Peringatan Petir Real-time */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-cyan-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CloudRain className="w-4 h-4 text-cyan-400" />
                <div>
                  <div className="font-bold text-slate-100 flex items-center gap-1.5">
                    <span>Pemantau Cuaca & Keselamatan Gali</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      LIVE RADAR
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Peringatan dini petir, hujan lebat, dan kondisi tanah becek
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.weatherAlertsEnabled ?? true}
                  onChange={(e) => onUpdateSettings({ weatherAlertsEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>

            <p className="text-[11px] text-slate-400 font-mono">
              Secara otomatis menilai risiko sengatan petir pada batang detektor logam dan stabilitas dinding lubang galian saat tanah jenuh air.
            </p>

            {onOpenWeatherModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenWeatherModal();
                }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 font-mono text-xs font-bold transition-all"
              >
                <CloudRain className="w-3.5 h-3.5" />
                <span>Buka Laporan Cuaca & Analisis Keselamatan</span>
              </button>
            )}
          </div>

          {/* PWA Android & Mobile App Installation Card */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-emerald-500/30 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-slate-100">Instal Aplikasi di Android / HP</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Pasang MetalScan Pro sebagai aplikasi mandiri (PWA) di perangkat Android untuk akses layar penuh, responsivitas sensor maksimal, dan penggunaan tanpa koneksi internet.
            </p>
            <PWAInstallButton variant="full" />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-semibold shadow-lg shadow-cyan-900/30 transition-colors"
          >
            Terapkan & Simpan
          </button>
        </div>
      </div>
    </div>
  );
};
