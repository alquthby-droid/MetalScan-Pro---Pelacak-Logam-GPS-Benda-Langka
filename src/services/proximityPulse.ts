/**
 * ProximityPulseService
 * 
 * Controls device camera torch/flash LED pulsing proportional to magnetic signal intensity.
 * When a metal spike is detected or magnetic field exceeds baseline threshold,
 * the torch pulses at a frequency that increases as the magnetic intensity increases,
 * providing a tactical visual alarm in low-light / night environments.
 * 
 * Includes an in-app visual strobe fallback banner when camera torch hardware
 * is not available or in desktop / simulated browser environments.
 */

export class ProximityPulseService {
  private mediaStream: MediaStream | null = null;
  private videoTrack: MediaStreamTrack | null = null;
  private isTorchSupported: boolean = false;
  private isTorchActive: boolean = false;
  private isPulsing: boolean = false;
  private isEnabled: boolean = false;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private onStrobeChangeListeners: Set<(isStrobing: boolean, flashIntensity: number) => void> = new Set();

  private currentIntervalMs: number = 500;
  private lastPulseTime: number = 0;
  private lightState: boolean = false;

  constructor() {
    this.pulseLoop = this.pulseLoop.bind(this);
  }

  /**
   * Request camera permission and initialize torch capability on device
   */
  public async initTorch(): Promise<{ supported: boolean; message: string }> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.isTorchSupported = false;
        return { supported: false, message: 'WebRTC Camera API tidak didukung browser ini' };
      }

      // If we already have an active track with torch capability
      if (this.videoTrack && this.videoTrack.readyState === 'live') {
        return { supported: this.isTorchSupported, message: 'Torch sudah siap digunakan' };
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          advanced: [{ torch: true } as any],
        } as any,
      });

      this.mediaStream = stream;
      const track = stream.getVideoTracks()[0];
      if (!track) {
        this.isTorchSupported = false;
        return { supported: false, message: 'Track video tidak ditemukan' };
      }

      this.videoTrack = track;

      // Check if track supports 'torch' capability
      const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
      if (capabilities && 'torch' in capabilities) {
        this.isTorchSupported = true;
        return { supported: true, message: 'Lampu Kilat Kamera (Torch Hardware) Didukung & Siap' };
      } else {
        // Many Android devices do support torch through applyConstraints even if getCapabilities omits it
        // We test applying torch: false to check if supported
        try {
          await (track as any).applyConstraints({ advanced: [{ torch: false }] });
          this.isTorchSupported = true;
          return { supported: true, message: 'Lampu Kilat Kamera (Torch Hardware) Didukung' };
        } catch {
          this.isTorchSupported = false;
          return { supported: false, message: 'Sensor kamera tersedia, namun lampu kilat (LED Torch) tidak didukung pada browser/perangkat ini. Mode Visual Strobe Layar akan digunakan.' };
        }
      }
    } catch (err: unknown) {
      this.isTorchSupported = false;
      const msg = err instanceof Error ? err.message : 'Izin kamera ditolak';
      return { supported: false, message: `Akses kamera/lampu kilat: ${msg}. Visual Strobe Layar tetap aktif.` };
    }
  }

  /**
   * Turn torch hardware ON/OFF safely
   */
  private async setTorchHardware(on: boolean): Promise<void> {
    if (!this.videoTrack || this.videoTrack.readyState !== 'live' || !this.isTorchSupported) {
      return;
    }
    try {
      await (this.videoTrack as any).applyConstraints({
        advanced: [{ torch: on }],
      });
      this.isTorchActive = on;
    } catch {
      // Ignore transient hardware constraint errors
    }
  }

  /**
   * Main Proximity Pulse update function called on every magnetic sensor reading
   * @param netStrength µT above baseline
   * @param totalStrength total magnetic reading µT
   * @param threshold trigger threshold µT
   * @param enabled whether Proximity Pulse setting is turned ON
   */
  public updateSignal(
    netStrength: number,
    totalStrength: number,
    threshold: number,
    enabled: boolean
  ) {
    this.isEnabled = enabled;

    if (!enabled || (totalStrength < threshold && netStrength < 12)) {
      this.stopPulsing();
      return;
    }

    // Metal anomaly detected! Calculate pulse frequency proportional to intensity
    // Signal ranges from threshold to >200 µT
    // Flash interval: from 600ms (slow caution pulse) down to 50ms (rapid hyper-frequency pulse near gold/meteorite)
    const normalizedIntensity = Math.min(1.0, Math.max(0.1, (totalStrength - 48) / 140));
    
    // Interval decreases as magnetic field increases
    const newInterval = Math.round(
      Math.max(45, 600 - normalizedIntensity * 550)
    );

    this.currentIntervalMs = newInterval;

    if (!this.isPulsing) {
      this.startPulsing();
    }
  }

  private startPulsing() {
    this.isPulsing = true;
    this.lightState = false;
    this.pulseLoop();
  }

  private stopPulsing() {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.isPulsing = false;
    this.lightState = false;
    this.setTorchHardware(false);
    this.notifyStrobeChange(false, 0);
  }

  private pulseLoop() {
    if (!this.isPulsing || !this.isEnabled) {
      this.stopPulsing();
      return;
    }

    // Toggle flash state
    this.lightState = !this.lightState;
    const isLit = this.lightState;

    // Apply to hardware torch
    this.setTorchHardware(isLit);

    // Calculate intensity 0 - 1
    const intensity = Math.min(1, Math.max(0.2, 500 / this.currentIntervalMs));
    this.notifyStrobeChange(isLit, intensity);

    // On-duration is brief (e.g. 30ms-70ms) for sharp stroboscopic flash
    // Off-duration is remaining interval
    const duration = isLit
      ? Math.min(60, Math.max(25, this.currentIntervalMs * 0.25))
      : Math.max(25, this.currentIntervalMs * 0.75);

    this.timerId = setTimeout(this.pulseLoop, duration);
  }

  public onStrobeChange(callback: (isStrobing: boolean, flashIntensity: number) => void): () => void {
    this.onStrobeChangeListeners.add(callback);
    return () => {
      this.onStrobeChangeListeners.delete(callback);
    };
  }

  private notifyStrobeChange(isStrobing: boolean, flashIntensity: number) {
    this.onStrobeChangeListeners.forEach((cb) => {
      try {
        cb(isStrobing, flashIntensity);
      } catch {
        // ignore
      }
    });
  }

  public getStatus() {
    return {
      isTorchSupported: this.isTorchSupported,
      isPulsing: this.isPulsing,
      intervalMs: this.currentIntervalMs,
    };
  }

  public destroy() {
    this.stopPulsing();
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
      this.videoTrack = null;
    }
    this.onStrobeChangeListeners.clear();
  }
}

export const proximityPulseService = new ProximityPulseService();
