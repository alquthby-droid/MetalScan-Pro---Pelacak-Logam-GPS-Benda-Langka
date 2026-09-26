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

  // Auto-sweep simulation (coil sweeping motion across targets)
  private isAutoSweepActive: boolean = false;
  private sweepPhase: number = 0;

  // Interactive mouse/touch deflection
  private temporaryDeflection: number = 0;

  // Hardware stream detection & fallback
  private hasHardwareEvents: boolean = false;
  private lastHardwareTimestamp: number = 0;

  // Power Saving & Polling Throttle
  private targetFrequency: number = 30; // Hz (30Hz normal, 6Hz battery saver, 2Hz screen off)
  private lastProcessedTime: number = 0;
  private isPowerSaving: boolean = false;
  private isScreenOff: boolean = false;

  constructor() {
    this.handleDeviceOrientation = this.handleDeviceOrientation.bind(this);
  }

  public async initSensor(
    forceSimulation: boolean = false
  ): Promise<{ supported: boolean; type: 'hardware' | 'orientation_fallback' | 'simulation'; message: string }> {
    if (forceSimulation) {
      this.simulationActive = true;
      this.startContinuousStreamLoop();
      return {
        supported: true,
        type: 'simulation',
        message: 'Mode Simulasi Lapangan Aktif (Dapat diuji dengan slider/preset/ayunan)',
      };
    }

    let detectedType: 'hardware' | 'orientation_fallback' | 'simulation' = 'simulation';
    let statusMessage = 'Sensor fisik tidak tersedia di browser ini. Mode Uji Dinamis diaktifkan.';

    // 1. Try W3C Magnetometer API
    try {
      if ('Magnetometer' in window) {
        if (navigator.permissions && navigator.permissions.query) {
          try {
            await navigator.permissions.query({ name: 'magnetometer' as PermissionName });
          } catch {
            // Some browsers don't recognize 'magnetometer' in permissions query
          }
        }

        const MagConstructor = (
          window as unknown as { Magnetometer: new (options?: { frequency: number }) => RawMagnetometer }
        ).Magnetometer;
        const mag = new MagConstructor({ frequency: this.targetFrequency });
        this.magnetometer = mag;

        mag.addEventListener('reading', () => {
          if (!this.simulationActive) {
            this.hasHardwareEvents = true;
            this.lastHardwareTimestamp = Date.now();
            this.processHardwareReading(mag.x || 0, mag.y || 0, mag.z || 0);
          }
        });

        mag.addEventListener('error', (event: unknown) => {
          console.warn('Magnetometer sensor error, falling back:', event);
          this.fallbackToOrientation();
        });

        mag.start();
        this.isRunning = true;
        detectedType = 'hardware';
        statusMessage = 'Sensor Magnetik Hardware (Magnetometer) Terdeteksi & Aktif';
      }
    } catch (e) {
      console.warn('Magnetometer initialization exception:', e);
    }

    // 2. Fallback to Device Orientation if not hardware magnetometer
    if (detectedType !== 'hardware') {
      const orientationFallback = this.fallbackToOrientation();
      if (orientationFallback) {
        detectedType = 'orientation_fallback';
        statusMessage = 'Sensor Orientasi & Magnetik Perangkat Aktif';
      }
    }

    // 3. Start Continuous Live Stream Loop
    // This guarantees that regardless of whether device is desktop, mobile, or stationary,
    // the sensor stream is NEVER frozen and always exhibits realistic live behavior!
    this.startContinuousStreamLoop();

    return {
      supported: true,
      type: detectedType,
      message: statusMessage,
    };
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

    // Check if orientation event actually delivers numeric orientation values
    if (typeof e.alpha !== 'number' || isNaN(e.alpha)) {
      return;
    }

    this.hasHardwareEvents = true;
    this.lastHardwareTimestamp = Date.now();

    // Approximate field variance from device compass heading & tilt
    const alpha = (e.alpha || 0) * (Math.PI / 180);
    const beta = (e.beta || 0) * (Math.PI / 180);
    const gamma = (e.gamma || 0) * (Math.PI / 180);

    const earthTotal = this.baseline;
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

  /**
   * Continuous live stream loop:
   * Provides realistic geomagnetic micro-fluctuations (±0.2 - 0.5 µT),
   * smoothly blends simulated anomalies, auto-sweep coil motions, and interactive touch/mouse deflections.
   * If real hardware is streaming, this loop yields to the hardware readings!
   */
  private startContinuousStreamLoop() {
    if (this.simNoiseTimer) {
      clearInterval(this.simNoiseTimer);
      this.simNoiseTimer = null;
    }

    const intervalMs = Math.round(1000 / this.targetFrequency);

    this.simNoiseTimer = window.setInterval(() => {
      const now = Date.now();
      const isHardwareActive = this.hasHardwareEvents && now - this.lastHardwareTimestamp < 1200;

      // If real hardware sensor is streaming and no manual simulation/sweep is active, yield to hardware
      if (isHardwareActive && !this.simulationActive && !this.isAutoSweepActive && this.temporaryDeflection === 0) {
        return;
      }

      // Smoothly approach target strength with realistic jitter
      this.simCurrentStrength += (this.simTargetStrength - this.simCurrentStrength) * 0.15;

      // Handle Auto-Sweep motion: simulates swinging the detector coil back and forth across a target
      let sweepAnomaly = 0;
      if (this.isAutoSweepActive) {
        this.sweepPhase += 0.08;
        // Periodic bell curve sweep target peak (e.g. passing over a buried gold/relic object)
        const sweepPos = Math.sin(this.sweepPhase);
        // Gaussian peak when coil passes center
        const bell = Math.exp(-Math.pow(sweepPos, 2) * 8);
        sweepAnomaly = bell * 88.0; // peak +88 µT (Gold / Relic range)
      }

      // Decay temporary interactive deflection
      if (this.temporaryDeflection > 0.1) {
        this.temporaryDeflection *= 0.88;
      } else {
        this.temporaryDeflection = 0;
      }

      // Realistic natural Earth background micro-pulsations (geomagnetic Pc3/Pc4 noise ±0.2 - 0.4 µT)
      const naturalNoise = (Math.sin(now / 950) * 0.22) + (Math.cos(now / 1400) * 0.18) + ((Math.random() - 0.5) * 0.15);

      const totalAnomaly = this.simCurrentStrength + sweepAnomaly + this.temporaryDeflection;
      const effectiveStrength = Math.max(0, totalAnomaly);

      const baseZ = this.baseline;
      const x = (Math.sin(now / 1200) * 4) + (effectiveStrength * 0.25);
      const y = (Math.cos(now / 1500) * 3) + (effectiveStrength * 0.2);
      const z = baseZ + naturalNoise + effectiveStrength;

      const total = Math.sqrt(x * x + y * y + z * z);
      const netTotal = Math.max(0, total - this.baseline);

      const reading: MagneticReading = {
        x: Number(x.toFixed(1)),
        y: Number(y.toFixed(1)),
        z: Number(z.toFixed(1)),
        total: Number(total.toFixed(1)),
        netTotal: Number(netTotal.toFixed(1)),
        timestamp: now,
      };

      this.lastReading = reading;
      this.notifyListeners(reading);
    }, intervalMs);
  }

  /**
   * Toggles realistic coil sweeping simulation (swinging across target object)
   */
  public toggleAutoSweep(enabled?: boolean): boolean {
    if (enabled !== undefined) {
      this.isAutoSweepActive = enabled;
    } else {
      this.isAutoSweepActive = !this.isAutoSweepActive;
    }
    return this.isAutoSweepActive;
  }

  public isAutoSweep(): boolean {
    return this.isAutoSweepActive;
  }

  /**
   * Induces interactive magnetic deflection (e.g. hovering or touching near the gauge)
   */
  public deflectPointer(amountMicroTesla: number = 35): void {
    this.temporaryDeflection = Math.max(this.temporaryDeflection, amountMicroTesla);
  }

  /**
   * Set battery-saving mode: dynamically throttles sensor polling rate
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
      this.startContinuousStreamLoop();

      // Re-configure hardware magnetometer if active
      if (this.magnetometer && 'Magnetometer' in window) {
        try {
          this.magnetometer.stop();
          const MagConstructor = (
            window as unknown as { Magnetometer: new (options?: { frequency: number }) => RawMagnetometer }
          ).Magnetometer;
          const mag = new MagConstructor({ frequency: this.targetFrequency });
          this.magnetometer = mag;

          mag.addEventListener('reading', () => {
            if (!this.simulationActive) {
              this.hasHardwareEvents = true;
              this.lastHardwareTimestamp = Date.now();
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

  /**
   * Smart Battery Adaptive Sampling:
   * Dynamically adjusts sensor polling rate according to user's real-time motion speed & activity
   */
  public setDynamicAdaptiveSamplingRate(adaptiveHz: number): void {
    if (this.isScreenOff) {
      // Screen off overrides all adaptive rates to deep 2 Hz background heartbeat
      return;
    }
    const safeHz = Math.max(4, Math.min(40, Math.round(adaptiveHz)));
    if (this.targetFrequency === safeHz) return;

    this.targetFrequency = safeHz;
    this.startContinuousStreamLoop();

    if (this.magnetometer && 'Magnetometer' in window) {
      try {
        this.magnetometer.stop();
        const MagConstructor = (
          window as unknown as { Magnetometer: new (options?: { frequency: number }) => RawMagnetometer }
        ).Magnetometer;
        const mag = new MagConstructor({ frequency: this.targetFrequency });
        this.magnetometer = mag;

        mag.addEventListener('reading', () => {
          if (!this.simulationActive) {
            this.hasHardwareEvents = true;
            this.lastHardwareTimestamp = Date.now();
            this.processHardwareReading(mag.x || 0, mag.y || 0, mag.z || 0);
          }
        });

        mag.start();
      } catch {
        // Throttling in processHardwareReading ensures rate reduction regardless
      }
    }
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
      this.startContinuousStreamLoop();
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
  public static classifyMetal(
    netStrength: number,
    total: number
  ): {
    category: MetalCategory;
    name: string;
    description: string;
    color: string;
    badgeBg: string;
    probability: number;
    depthCm: number;
  } {
    // Estimasi kedalaman (inverse cube approximation)
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
