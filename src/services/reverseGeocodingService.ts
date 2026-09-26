/**
 * Reverse Geocoding Service
 * Menyediakan integrasi pemanggilan API terbalik (Reverse Geocoding)
 * untuk mendapatkan nama lokasi atau landmark terdekat secara otomatis
 * setiap kali Quick Pin, Manual Pin, atau Auto-Simpan dilakukan.
 */

export interface ReverseGeocodeResult {
  locationName: string;
  landmark?: string;
  suburb?: string;
  city?: string;
  state?: string;
  country?: string;
  formattedCoordinates: string;
  isFallback: boolean;
}

class ReverseGeocodingService {
  // In-memory cache based on rounded lat,lng (~15m radius)
  private cache: Map<string, ReverseGeocodeResult> = new Map();
  // Persistent local cache key
  private STORAGE_KEY = 'metalscan_geocache_v1';

  constructor() {
    this.loadCache();
  }

  private loadCache(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          Object.entries(parsed).forEach(([key, val]) => {
            this.cache.set(key, val as ReverseGeocodeResult);
          });
        }
      }
    } catch {
      // ignore
    }
  }

  private saveCache(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const obj: Record<string, ReverseGeocodeResult> = {};
        // Keep max 150 items
        let count = 0;
        this.cache.forEach((v, k) => {
          if (count < 150) {
            obj[k] = v;
            count++;
          }
        });
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(obj));
      }
    } catch {
      // ignore
    }
  }

  private getCacheKey(lat: number, lng: number): string {
    // 4 decimals ≈ 11 meters precision
    return `${lat.toFixed(4)},${lng.toFixed(4)}`;
  }

  /**
   * Format human-readable geographic coordinates
   */
  public formatCoordinates(lat: number, lng: number): string {
    const latDir = lat >= 0 ? 'LU' : 'LS';
    const lngDir = lng >= 0 ? 'BT' : 'BB';
    return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
  }

  /**
   * Pemanggilan Reverse Geocoding API secara otomatis
   */
  public async reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
    const key = this.getCacheKey(lat, lng);
    const coordsStr = this.formatCoordinates(lat, lng);

    // 1. Check in-memory / persistent cache
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    // 2. Query OpenStreetMap Nominatim reverse geocode endpoint
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500); // 4.5s timeout

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept-Language': 'id, en;q=0.8',
          'User-Agent': 'MetalScanPro-Detector/1.0',
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const address = data.address || {};

        // Extract landmark or prominent local point of interest
        const landmark =
          address.historic ||
          address.tourism ||
          address.amenity ||
          address.leisure ||
          address.building ||
          address.archaeological_site ||
          address.park ||
          address.place ||
          address.natural ||
          data.name ||
          undefined;

        const road = address.road || address.pedestrian || address.path || address.footway;
        const suburb = address.suburb || address.village || address.neighbourhood || address.hamlet;
        const city = address.city || address.town || address.county || address.regency || address.municipality;
        const state = address.state || address.province;
        const country = address.country;

        // Build clean concise location string
        const parts: string[] = [];
        if (landmark) parts.push(landmark);
        if (road && road !== landmark) parts.push(road);
        if (suburb && suburb !== landmark) parts.push(suburb);
        if (city && !parts.includes(city)) parts.push(city);

        let locationName = parts.slice(0, 3).join(', ');

        if (!locationName) {
          locationName = data.display_name
            ? data.display_name.split(',').slice(0, 3).join(',').trim()
            : `Sektor Lapangan (${coordsStr})`;
        }

        const result: ReverseGeocodeResult = {
          locationName,
          landmark,
          suburb,
          city,
          state,
          country,
          formattedCoordinates: coordsStr,
          isFallback: false,
        };

        this.cache.set(key, result);
        this.saveCache();
        return result;
      }
    } catch (err) {
      console.warn('Reverse geocoding network lookup error, using coordinate landmark:', err);
    }

    // 3. Graceful fallback if network is unavailable or rate-limited in offline field
    const fallbackResult: ReverseGeocodeResult = {
      locationName: `Sektor Koordinat ${coordsStr}`,
      landmark: undefined,
      suburb: undefined,
      city: undefined,
      formattedCoordinates: coordsStr,
      isFallback: true,
    };

    return fallbackResult;
  }
}

export const reverseGeocodingService = new ReverseGeocodingService();
