import { BatteryState } from '../types/detector';

type BatteryListener = (state: BatteryState) => void;

interface BatteryManagerAPI extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
  addEventListener: (type: 'chargingchange' | 'levelchange', listener: EventListener) => void;
  removeEventListener: (type: 'chargingchange' | 'levelchange', listener: EventListener) => void;
}

export class BatteryManagerService {
  private batteryAPI: BatteryManagerAPI | null = null;
  private listeners: Set<BatteryListener> = new Set();
  
  private level: number = 100; // 0 to 100
  private charging: boolean = false;
  private supported: boolean = false;
  private isScreenOff: boolean = false;
  
  // Simulated battery for testing / environments without Battery API
  private simulatedLevel: number | null = null;
  private simulatedCharging: boolean | null = null;

  // Current calculated state
  private currentState: BatteryState = {
    level: 100,
    charging: false,
    supported: false,
    isLow: false,
    isScreenOff: false,
    isPowerSaveActive: false,
    currentMagnetometerHz: 30,
    gpsMode: 'high_accuracy',
  };

  constructor() {
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleBatteryChange = this.handleBatteryChange.bind(this);
  }

  public async init(): Promise<void> {
    // 1. Setup Screen Off / Visibility listener
    if (typeof document !== 'undefined') {
      this.isScreenOff = document.visibilityState === 'hidden';
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    // 2. Setup W3C Battery Status API if available
    try {
      if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
        const getBattery = (navigator as unknown as { getBattery: () => Promise<BatteryManagerAPI> }).getBattery;
        const battery = await getBattery.call(navigator);
        this.batteryAPI = battery;
        this.supported = true;
        this.level = Math.round((battery.level || 1.0) * 100);
        this.charging = !!battery.charging;

        battery.addEventListener('levelchange', this.handleBatteryChange);
        battery.addEventListener('chargingchange', this.handleBatteryChange);
      } else {
        // Battery API not standard in current desktop browser
        this.supported = false;
        this.level = 82; // Sensible default
        this.charging = false;
      }
    } catch (err) {
      console.warn('Battery Status API initialization error:', err);
      this.supported = false;
      this.level = 82;
    }

    this.recomputeState();
  }

  private handleVisibilityChange(): void {
    if (typeof document !== 'undefined') {
      this.isScreenOff = document.visibilityState === 'hidden';
      this.recomputeState();
    }
  }

  private handleBatteryChange(): void {
    if (this.batteryAPI) {
      this.level = Math.round((this.batteryAPI.level || 1.0) * 100);
      this.charging = !!this.batteryAPI.charging;
      this.recomputeState();
    }
  }

  /**
   * Evaluate power save mode according to user settings and environment
   */
  public evaluate(
    batterySaverEnabled: boolean = true,
    batterySaverThreshold: number = 20,
    forceBatterySaver: boolean = false
  ): BatteryState {
    const effectiveLevel = this.simulatedLevel !== null ? this.simulatedLevel : this.level;
    const effectiveCharging = this.simulatedCharging !== null ? this.simulatedCharging : this.charging;

    // Battery is low if level <= threshold and not charging
    const isLow = effectiveLevel <= batterySaverThreshold && !effectiveCharging;

    // Power save is active if forced OR (enabled and (low battery or screen is off))
    const isPowerSaveActive = forceBatterySaver || (batterySaverEnabled && (isLow || this.isScreenOff));

    // Calculate sensor frequencies
    let currentMagnetometerHz = 30;
    let gpsMode: 'high_accuracy' | 'battery_saving' | 'standby' = 'high_accuracy';

    if (this.isScreenOff) {
      // Screen is off / background: deep throttling
      currentMagnetometerHz = 2; // 2 Hz background heartbeat
      gpsMode = isPowerSaveActive ? 'standby' : 'battery_saving';
    } else if (isPowerSaveActive) {
      // Low battery or force eco: throttle to 6 Hz, low power GPS
      currentMagnetometerHz = 6;
      gpsMode = 'battery_saving';
    } else {
      currentMagnetometerHz = 30;
      gpsMode = 'high_accuracy';
    }

    this.currentState = {
      level: effectiveLevel,
      charging: effectiveCharging,
      supported: this.supported,
      isLow,
      isScreenOff: this.isScreenOff,
      isPowerSaveActive,
      currentMagnetometerHz,
      gpsMode,
    };

    return this.currentState;
  }

  private recomputeState(): void {
    // Notify listeners with current state using defaults; will be re-evaluated by App with settings
    this.evaluate();
    this.notify();
  }

  public getState(): BatteryState {
    return this.currentState;
  }

  public subscribe(callback: BatteryListener): () => void {
    this.listeners.add(callback);
    callback(this.currentState);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify(): void {
    this.listeners.forEach((cb) => {
      try {
        cb(this.currentState);
      } catch {
        // ignore
      }
    });
  }

  // Simulation controls for testing power saving mode
  public setSimulatedBattery(level: number | null, charging: boolean | null = null): void {
    this.simulatedLevel = level;
    this.simulatedCharging = charging;
    this.recomputeState();
  }

  public resetSimulation(): void {
    this.simulatedLevel = null;
    this.simulatedCharging = null;
    this.recomputeState();
  }

  public destroy(): void {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    if (this.batteryAPI) {
      this.batteryAPI.removeEventListener('levelchange', this.handleBatteryChange);
      this.batteryAPI.removeEventListener('chargingchange', this.handleBatteryChange);
    }
    this.listeners.clear();
  }
}

export const batteryManager = new BatteryManagerService();
