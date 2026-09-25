import { WeatherCondition } from '../types/detector';

type WeatherListener = (condition: WeatherCondition | null) => void;

class WeatherService {
  private currentCondition: WeatherCondition | null = null;
  private listeners: Set<WeatherListener> = new Set();
  private lastFetchTime = 0;
  private lastCoords = { lat: 0, lng: 0 };
  private isFetching = false;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem('metalscan_weather');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Date.now() - parsed.lastUpdated < 1000 * 60 * 30) {
          this.currentCondition = parsed;
        }
      }
    } catch {
      // ignore
    }
  }

  private saveToStorage(data: WeatherCondition) {
    try {
      localStorage.setItem('metalscan_weather', JSON.stringify(data));
    } catch {
      // ignore
    }
  }

  public getCondition(): WeatherCondition | null {
    return this.currentCondition;
  }

  public subscribe(listener: WeatherListener): () => void {
    this.listeners.add(listener);
    listener(this.currentCondition);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => fn(this.currentCondition));
  }

  public async fetchWeather(lat = -6.2088, lng = 106.8456, force = false): Promise<WeatherCondition | null> {
    const now = Date.now();
    const distanceDelta =
      Math.abs(this.lastCoords.lat - lat) + Math.abs(this.lastCoords.lng - lng);

    // Cache for 10 minutes unless forced or position changed significantly (> 0.05 deg ~ 5km)
    if (
      !force &&
      this.currentCondition &&
      now - this.lastFetchTime < 1000 * 60 * 10 &&
      distanceDelta < 0.05
    ) {
      return this.currentCondition;
    }

    if (this.isFetching) return this.currentCondition;
    this.isFetching = true;

    try {
      const resp = await fetch(`/api/weather?lat=${lat}&lng=${lng}`);
      if (!resp.ok) {
        throw new Error(`Weather API returned ${resp.status}`);
      }
      const json = await resp.json();
      if (json.success && json.data) {
        this.currentCondition = json.data;
        this.lastFetchTime = now;
        this.lastCoords = { lat, lng };
        this.saveToStorage(json.data);
        this.notify();
        return this.currentCondition;
      }
      throw new Error('Invalid weather payload');
    } catch (err) {
      // Fallback: direct Open-Meteo call if proxy is down
      try {
        const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=sunrise,sunset&timezone=auto`;
        const omResp = await fetch(openMeteoUrl);
        if (omResp.ok) {
          const omData = await omResp.json();
          const cur = omData.current || {};
          const daily = omData.daily || {};
          const isDay = cur.is_day === 1;

          const parsedCondition: WeatherCondition = {
            temperatureC: Math.round(Number(cur.temperature_2m ?? 28)),
            apparentTempC: Math.round(Number(cur.apparent_temperature ?? 29)),
            humidityPercent: Math.round(Number(cur.relative_humidity_2m ?? 70)),
            weatherCode: Number(cur.weather_code ?? 0),
            weatherDescription: isDay ? 'Cerah Berawan' : 'Malam Berawan',
            weatherIcon: isDay ? '🌤️' : '🌙',
            windSpeedKmH: Math.round(Number(cur.wind_speed_10m ?? 8)),
            windGustsKmH: Math.round(Number(cur.wind_speed_10m ?? 8) * 1.3),
            precipitationMm: Number(cur.precipitation ?? 0),
            rainMm: Number(cur.precipitation ?? 0),
            precipitationProbability: cur.precipitation > 0 ? 70 : 10,
            isDay,
            sunrise: daily.sunrise?.[0] ? daily.sunrise[0].split('T')[1] : '05:58',
            sunset: daily.sunset?.[0] ? daily.sunset[0].split('T')[1] : '18:04',
            timezone: omData.timezone || 'Asia/Jakarta',
            lastUpdated: now,
            safetyAssessment: {
              level: 'safe',
              score: 90,
              title: 'Kondisi Cuaca Aman untuk Penggalian',
              advice: 'Cuaca stabil, aman untuk kegiatan penggalian detektor logam.',
              isLightningRisk: false,
              isHeavyRain: false,
              isMuddyGround: false,
            },
          };

          this.currentCondition = parsedCondition;
          this.lastFetchTime = now;
          this.lastCoords = { lat, lng };
          this.saveToStorage(parsedCondition);
          this.notify();
          return this.currentCondition;
        }
      } catch {
        // quiet fallback
      }
    } finally {
      this.isFetching = false;
    }

    return this.currentCondition;
  }

  /**
   * Determine whether it is currently night at the user's location
   */
  public isNight(): boolean {
    if (this.currentCondition) {
      return !this.currentCondition.isDay;
    }
    const hour = new Date().getHours();
    return hour >= 18 || hour < 6;
  }
}

export const weatherService = new WeatherService();
