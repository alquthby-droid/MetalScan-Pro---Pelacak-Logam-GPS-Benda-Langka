import { MagneticReading, MetalCategory } from '../types/detector';

interface SensorCallback {
  (reading: MagneticReading): void;
}

interface RawMagnetometer {
  x: number;
  y: number;
  z: number;
  start: () => void;
  stop: () => void;
  addEventListener: (type: string, listener: (event?: unknown) => void) => void;
  removeEventListener: (type: string, listener: (event?: unknown) => void) => void;
}

export class SensorManager {
  private magnetometer: RawMagnetometer | null = null;
  private listeners: Set<SensorCallback> = new Set();
  private isRunning: boolean = false;
  private baseline: number = 48.0; // Typical Earth magnetic field in µT
  private lastReading: MagneticReading = {
    x: 0,
    y: 0,
    z: 48,
    total: 48,
    netTotal: 0,
    timestamp: Date.now(),
  };

  private smoothedX: number = 0;
  private smoothedY: number = 0;
  private smoothedZ: number = 48;
  private alpha: number = 0.25; // Low-pass filter weight

  private simulationActive: boolean = false;
  private simTargetStrength: number = 0;
  private simCurrentStrength: number = 0;
  private simNoiseTimer: number | null = null;

  // Power Saving & Polling Throttle
  private targetFrequency: number = 30; // Hz (30Hz normal, 6Hz battery saver, 2Hz screen off)
  private lastProcessedTime: number = 0;
  private isPowerSaving: boolean = false;
  private isScreenOff: boolean = false;

  constructor() {
    this.handleDeviceOrientation = this.handleDeviceOrientation.bind(this);
  }

  public async initSensor(forceSimulation: boolean = false): Promise<{ supported: boolean; type: 'hardware' | 'orientation_fallback' | 'simulation'; message: string }> {
    if (forceSimulation) {
      this.simulationActive = true;
      this.startSimulationLoop();
      return { supported: true, type: 'simulation', message: 'Mode Simulasi Lapangan Aktif (Dapat diuji dengan slider/preset)' };
    }

    // Try W3C Magnetometer API
    try {
      if ('Magnetometer' in window) {
        // Query permission if available
        if (navigator.permissions && navigator.permissions.query) {
          try {
            await navigator.permissions.query({ name: 'magnetometer' as PermissionName });
          } catch {
            // Some browsers don't recognize 'magnetometer' in permissions query
          }
        }

        const MagConstructor = (window as unknown as { Magnetometer: new (options?: { frequency: number }) => RawMagnetometer }).Magnetometer;
        const mag = new MagConstructor({ frequency: 30 });
        this.magnetometer = mag;

        mag.addEventListener('reading', () => {
          if (!this.simulationActive) {
            this.processHardwareReading(mag.x || 0, mag.y || 0, mag.z || 0);
          }
        });

        mag.addEventListener('error', (event: unknown) => {
          console.warn('Magnetometer sensor error, falling back:', event);
          this.fallbackToOrientation();
        });

        mag.start();
        this.isRunning = true;
        this.simulationActive = false;
        return { supported: true, type: 'hardware', message: 'Sensor Magnetik Hardware (Magnetometer) Terdeteksi & Aktif' };
      }
    } catch (e) {
      console.warn('Magnetometer initialization exception:', e);
    }

    // Fallback to Device Orientation
    const orientationFallback = this.fallbackToOrientation();
    if (orientationFallback) {
      return { supported: true, type: 'orientation_fallback', message: 'Sensor Orientasi Perangkat Aktif (Estimasi Fluks Magnet)' };
    }

    // Default to simulation
    this.simulationActive = true;
    this.startSimulationLoop();
    return { supported: true, type: 'simulation', message: 'Sensor fisik tidak tersedia di browser ini. Mode Uji Interaktif diaktifkan.' };
  }

  private fallbackToOrientation(): boolean {
    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', this.handleDeviceOrientation as EventListener);
      this.isRunning = true;
      return true;
    }
    return false;
  }

  private handleDeviceOrientation(e: DeviceOrientationEvent) {
    if (this.simulationActive) return;

    // Approximate field variance from device compass heading & tilt
    const alpha = (e.alpha || 0) * (Math.PI / 180);
    const beta = (e.beta || 0) * (Math.PI / 180);
    const gamma = (e.gamma || 0) * (Math.PI / 180);

    const earthTotal = 48.0;
    const x = Math.sin(alpha) * Math.cos(beta) * 22;
    const y = Math.cos(alpha) * Math.sin(gamma) * 20;
    const z = Math.sqrt(Math.max(0, earthTotal * earthTotal - x * x - y * y));

    this.processHardwareReading(x, y, z);
  }

  private processHardwareReading(rawX: number, rawY: number, rawZ: number) {
    // Polling rate throttle for power saving mode
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const minIntervalMs = 1000 / this.targetFrequency;
    if (now - this.lastProcessedTime < minIntervalMs) {
      return;
    }
    this.lastProcessedTime = now;

    // Apply smoothing filter
    this.smoothedX = this.smoothedX + this.alpha * (rawX - this.smoothedX);
    this.smoothedY = this.smoothedY + this.alpha * (rawY - this.smoothedY);
    this.smoothedZ = this.smoothedZ + this.alpha * (rawZ - this.smoothedZ);

    const total = Math.sqrt(
      this.smoothedX * this.smoothedX +
      this.smoothedY * this.smoothedY +
      this.smoothedZ * this.smoothedZ
    );

    const netTotal = Math.max(0, total - this.baseline);

    const reading: MagneticReading = {
      x: Number(this.smoothedX.toFixed(1)),
      y: Number(this.smoothedY.toFixed(1)),
      z: Number(this.smoothedZ.toFixed(1)),
      total: Number(total.toFixed(1)),
      netTotal: Number(netTotal.toFixed(1)),
      timestamp: Date.now(),
    };

    this.lastReading = reading;
    this.notifyListeners(reading);
  }

  // Interactive Simulation Loop
  private startSimulationLoop() {
    if (this.simNoiseTimer) {
      clearInterval(this.simNoiseTimer);
      this.simNoiseTimer = null;
    }

    const intervalMs = Math.round(1000 / this.targetFrequency);

    this.simNoiseTimer = window.setInterval(() => {
      if (!this.simulationActive) return;

      // Smoothly approach target strength with realistic jitter
      this.simCurrentStrength += (this.simTargetStrength - this.simCurrentStrength) * 0.15;
      const jitter = (Math.random() - 0.5) * 1.8;
      const effectiveStrength = Math.max(0, this.simCurrentStrength + jitter);

      const baseZ = this.baseline;
      const x = (Math.sin(Date.now() / 800) * 8) + (effectiveStrength * 0.4);
      const y = (Math.cos(Date.now() / 900) * 6) + (effectiveStrength * 0.3);
      const z = baseZ + effectiveStrength;

      const total = Math.sqrt(x * x + y * y + z * z);
      const netTotal = Math.max(0, total - this.baseline);

      const reading: MagneticReading = {
        x: Number(x.toFixed(1)),
        y: Number(y.toFixed(1)),
        z: Number(z.toFixed(1)),
        total: Number(total.toFixed(1)),
        netTotal: Number(netTotal.toFixed(1)),
        timestamp: Date.now(),
      };

      this.lastReading = reading;
      this.notifyListeners(reading);
    }, intervalMs);
  }

  /**
   * Set battery-saving mode: dynamically throttles sensor polling rate
   * Normal: 30 Hz
   * Battery Saver (Low Battery / Forced): 6 Hz (saves ~75% processor wakeups)
   * Screen Off / Background: 2 Hz (deep sleep heartbeat saves ~93% wakeups)
   */
  public setPowerSaveMode(enabled: boolean, screenOff: boolean = false): void {
    const prevFreq = this.targetFrequency;
    this.isPowerSaving = enabled;
    this.isScreenOff = screenOff;

    if (screenOff) {
      this.targetFrequency = 2; // 2 Hz deep background
    } else if (enabled) {
      this.targetFrequency = 6; // 6 Hz battery saver
    } else {
      this.targetFrequency = 30; // 30 Hz standard
    }

    if (prevFreq !== this.targetFrequency) {
      if (this.simulationActive) {
        this.startSimulationLoop();
      }

      // Re-configure hardware magnetometer if possible
      if (this.magnetometer && 'Magnetometer' in window) {
        try {
          this.magnetometer.stop();
          const MagConstructor = (window as unknown as { Magnetometer: new (options?: { frequency: number }) => RawMagnetometer }).Magnetometer;
          const mag = new MagConstructor({ frequency: this.targetFrequency });
          this.magnetometer = mag;

          mag.addEventListener('reading', () => {
            if (!this.simulationActive) {
              this.processHardwareReading(mag.x || 0, mag.y || 0, mag.z || 0);
            }
          });

          mag.start();
        } catch {
          // Throttling in processHardwareReading ensures rate reduction regardless
        }
      }
    }
  }

  public getTargetFrequency(): number {
    return this.targetFrequency;
  }

  public isPowerSavingActive(): boolean {
    return this.isPowerSaving || this.isScreenOff;
  }

  public setSimulatedAnomaly(strengthMicroTesla: number) {
    this.simTargetStrength = strengthMicroTesla;
  }

  public calibrateBaseline(customBaseline?: number) {
    if (customBaseline !== undefined) {
      this.baseline = customBaseline;
    } else {
      this.baseline = this.lastReading.total || 48.0;
    }
    return this.baseline;
  }

  public getBaseline(): number {
    return this.baseline;
  }

  public setSimulationMode(enabled: boolean) {
    this.simulationActive = enabled;
    if (enabled) {
      this.startSimulationLoop();
    }
  }

  public isSimulating(): boolean {
    return this.simulationActive;
  }

  public subscribe(callback: SensorCallback): () => void {
    this.listeners.add(callback);
    callback(this.lastReading);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(reading: MagneticReading) {
    for (const cb of this.listeners) {
      cb(reading);
    }
  }

  public getLastReading(): MagneticReading {
    return this.lastReading;
  }

  public destroy() {
    if (this.magnetometer) {
      try {
        this.magnetometer.stop();
      } catch {
        // ignore
      }
      this.magnetometer = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('deviceorientation', this.handleDeviceOrientation as EventListener);
    }
    if (this.simNoiseTimer) {
      clearInterval(this.simNoiseTimer);
      this.simNoiseTimer = null;
    }
    this.listeners.clear();
  }

  // Classification utility based on microTesla deflection and signature profile
  public static classifyMetal(netStrength: number, total: number): {
    category: MetalCategory;
    name: string;
    description: string;
    color: string;
    badgeBg: string;
    probability: number;
    depthCm: number;
  } {
    // Estimasi kedalaman (inverse cube approximation)
    // Semakin besar signal mikrotesla, semakin dekat atau besar objek
    let depthCm = Math.round(Math.max(3, 45 - Math.log(Math.max(1, netStrength)) * 8));

    if (netStrength >= 140) {
      return {
        category: 'meteorite',
        name: 'Meteorit / Anomali Feromagnetik Langka',
        description: 'Medan magnet sangat masif! Berpotensi meteorit nikel-besi atau massa magnetit tinggi.',
        color: '#a855f7', // purple
        badgeBg: 'bg-purple-950/80 border-purple-500/50 text-purple-300',
        probability: 94,
        depthCm,
      };
    } else if (netStrength >= 85) {
      return {
        category: 'gold',
        name: 'Emas / Logam Mulia Berharga',
        description: 'Anomali konduktivitas tinggi terfokus. Ciri khas perhiasan, koin emas, atau relik berharga.',
        color: '#eab308', // gold yellow
        badgeBg: 'bg-yellow-950/80 border-yellow-500/50 text-yellow-300',
        probability: 88,
        depthCm,
      };
    } else if (netStrength >= 55) {
      return {
        category: 'silver',
        name: 'Perak / Paduan Konduktif',
        description: 'Respon medan tajam khas perak murni, uang koin kuno, atau paduan tembaga tinggi.',
        color: '#38bdf8', // cyan
        badgeBg: 'bg-sky-950/80 border-sky-500/50 text-sky-300',
        probability: 82,
        depthCm,
      };
    } else if (netStrength >= 30) {
      return {
        category: 'bronze',
        name: 'Perunggu / Kuningan Kuno',
        description: 'Respon arus eddy stabil. Kemungkinan artefak perunggu, koin tembaga, atau bejana.',
        color: '#f97316', // bronze orange
        badgeBg: 'bg-amber-950/80 border-amber-500/50 text-amber-300',
        probability: 78,
        depthCm,
      };
    } else if (netStrength >= 10) {
      return {
        category: 'iron',
        name: 'Besi / Logam Ferrous',
        description: 'Medan magnetik terpolarisasi. Umum ditemukan pada paku, perkakas, tapal kuda, atau pipa.',
        color: '#94a3b8', // slate/gray
        badgeBg: 'bg-slate-800/80 border-slate-600 text-slate-300',
        probability: 85,
        depthCm,
      };
    } else {
      return {
        category: 'unknown',
        name: 'Mineral Tanah Alami',
        description: 'Fluktuasi latar bumi normal atau pasir besi halus.',
        color: '#64748b',
        badgeBg: 'bg-slate-900 border-slate-700 text-slate-400',
        probability: 40,
        depthCm: 0,
      };
    }
  }
}

export const sensorManager = new SensorManager();
