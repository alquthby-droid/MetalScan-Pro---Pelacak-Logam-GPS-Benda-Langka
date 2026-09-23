import {
  MetalFinding,
  GPSLocation,
  GeminiFindingAnalysis,
  GeminiHotspotsResult,
} from '../types/detector';

export class GeminiService {
  /**
   * Request automated finding notes analysis, location-based artifact classification,
   * historical era, and conservation guidance from Gemini.
   */
  async analyzeFinding(
    finding: MetalFinding,
    userLocation?: GPSLocation | null
  ): Promise<GeminiFindingAnalysis> {
    try {
      const response = await fetch('/api/gemini/analyze-finding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finding: {
            id: finding.id,
            name: finding.name,
            lat: finding.lat,
            lng: finding.lng,
            accuracy: finding.accuracy,
            magneticStrength: finding.magneticStrength,
            netStrength: finding.netStrength,
            depthEstimateCm: finding.depthEstimateCm,
            category: finding.category,
            note: finding.note,
            timestamp: finding.timestamp,
          },
          userLocation: userLocation
            ? { lat: userLocation.lat, lng: userLocation.lng }
            : null,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server error (${response.status})`);
      }

      const resData = await response.json();
      if (!resData.success || !resData.data) {
        throw new Error(resData.error || 'Format data analisis tidak valid');
      }

      const result: GeminiFindingAnalysis = {
        ...resData.data,
        analyzedAt: Date.now(),
      };
      return result;
    } catch (err: unknown) {
      console.error('Error calling Gemini analyzeFinding:', err);
      throw err;
    }
  }

  /**
   * Suggest next excavation hotspots based on spatial clustering of historical findings,
   * magnetic anomaly gradients, and historical geospatial archeological patterns.
   */
  async suggestExcavationHotspots(
    findings: MetalFinding[],
    userLocation?: GPSLocation | null
  ): Promise<GeminiHotspotsResult> {
    try {
      const response = await fetch('/api/gemini/suggest-hotspots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          findings,
          userLocation: userLocation
            ? { lat: userLocation.lat, lng: userLocation.lng }
            : null,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server error (${response.status})`);
      }

      const resData = await response.json();
      if (!resData.success || !resData.data) {
        throw new Error(resData.error || 'Format hotspot Gemini tidak valid');
      }

      const result: GeminiHotspotsResult = {
        ...resData.data,
        analyzedAt: Date.now(),
      };
      return result;
    } catch (err: unknown) {
      console.error('Error calling Gemini suggestExcavationHotspots:', err);
      throw err;
    }
  }

  /**
   * Automatically generate a rich field note based on magnetic flux, depth, category, and GPS.
   */
  async generateAutoNote(finding: MetalFinding): Promise<string> {
    try {
      const response = await fetch('/api/gemini/generate-auto-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finding }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server error (${response.status})`);
      }

      const resData = await response.json();
      return resData.note || '';
    } catch (err: unknown) {
      console.error('Error calling Gemini generateAutoNote:', err);
      throw err;
    }
  }
}

export const geminiService = new GeminiService();
