import { MetalFinding, GPSLocation } from '../types/detector';

export type RouteAlgorithm = 'nearest_neighbor' | 'two_opt' | 'value_priority';

export interface RouteWaypoint {
  id: string;
  stepNumber: number;
  finding: MetalFinding;
  lat: number;
  lng: number;
  distanceFromPrevMeters: number;
  bearingFromPrevDegrees: number;
  cardinalDirection: string;
  estimatedDigTimeMinutes: number;
  cumulativeDistanceMeters: number;
  cumulativeTimeMinutes: number;
}

export interface ExcavationRoute {
  waypoints: RouteWaypoint[];
  startLocation: {
    lat: number;
    lng: number;
    label: string;
    isUserGPS: boolean;
  };
  totalDistanceMeters: number;
  totalWalkingMinutes: number;
  totalDiggingMinutes: number;
  totalExpeditionMinutes: number;
  algorithmUsed: RouteAlgorithm;
  isRoundTrip: boolean;
  pathCoordinates: [number, number][];
}

/**
 * Calculates accurate geodesic distance between two coordinates using Haversine formula (meters)
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.max(0.1, Number((R * c).toFixed(1)));
}

/**
 * Calculates the forward bearing from point 1 to point 2 in degrees (0 - 360)
 */
export function calculateBearingDegrees(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return Math.round(((theta * 180) / Math.PI + 360) % 360);
}

/**
 * Returns Indonesian cardinal direction name for a given degree (0-360)
 */
export function getCardinalDirectionIndo(bearing: number): string {
  const directions = [
    { label: 'Utara (U)', min: 337.5, max: 360 },
    { label: 'Utara (U)', min: 0, max: 22.5 },
    { label: 'Timur Laut (TL)', min: 22.5, max: 67.5 },
    { label: 'Timur (T)', min: 67.5, max: 112.5 },
    { label: 'Tenggara (TG)', min: 112.5, max: 157.5 },
    { label: 'Selatan (S)', min: 157.5, max: 202.5 },
    { label: 'Barat Daya (BD)', min: 202.5, max: 247.5 },
    { label: 'Barat (B)', min: 247.5, max: 292.5 },
    { label: 'Barat Laut (BL)', min: 292.5, max: 337.5 },
  ];

  const normalized = ((bearing % 360) + 360) % 360;
  for (const dir of directions) {
    if (normalized >= dir.min && normalized < dir.max) {
      return dir.label;
    }
  }
  return 'Utara (U)';
}

/**
 * Estimates digging time in minutes based on depth and category
 */
export function estimateDiggingMinutes(finding: MetalFinding): number {
  const depth = finding.depthEstimateCm || 10;
  // Base digging setup time 2.5 mins + 0.25 mins per cm depth
  let minutes = 2.5 + depth * 0.25;
  if (finding.category === 'gold' || finding.category === 'meteorite') {
    // Extra careful excavation for valuable/rare relics
    minutes += 1.5;
  }
  return Math.max(2, Math.round(minutes * 10) / 10);
}

/**
 * Calculates total tour distance for an array of points
 */
function calculateTourDistance(
  startLat: number,
  startLng: number,
  tour: MetalFinding[],
  isRoundTrip: boolean
): number {
  if (tour.length === 0) return 0;
  let dist = calculateDistanceMeters(startLat, startLng, tour[0].lat, tour[0].lng);
  for (let i = 0; i < tour.length - 1; i++) {
    dist += calculateDistanceMeters(tour[i].lat, tour[i].lng, tour[i + 1].lat, tour[i + 1].lng);
  }
  if (isRoundTrip && tour.length > 0) {
    dist += calculateDistanceMeters(tour[tour.length - 1].lat, tour[tour.length - 1].lng, startLat, startLng);
  }
  return dist;
}

/**
 * Nearest Neighbor TSP Heuristic Algorithm
 */
export function solveNearestNeighbor(
  startLat: number,
  startLng: number,
  points: MetalFinding[]
): MetalFinding[] {
  if (points.length <= 1) return [...points];

  const unvisited = [...points];
  const tour: MetalFinding[] = [];
  let currentLat = startLat;
  let currentLng = startLng;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const d = calculateDistanceMeters(currentLat, currentLng, unvisited[i].lat, unvisited[i].lng);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }

    const nextPoint = unvisited.splice(nearestIdx, 1)[0];
    tour.push(nextPoint);
    currentLat = nextPoint.lat;
    currentLng = nextPoint.lng;
  }

  return tour;
}

/**
 * 2-Opt Local Search TSP Optimization Algorithm
 * Improves Nearest Neighbor solution by reversing sub-tours to eliminate crossings
 */
export function solveTwoOpt(
  startLat: number,
  startLng: number,
  points: MetalFinding[],
  isRoundTrip: boolean
): MetalFinding[] {
  let tour = solveNearestNeighbor(startLat, startLng, points);
  if (tour.length <= 2) return tour;

  let improved = true;
  let iterations = 0;
  const maxIterations = 50; // Guard against infinite loop

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < tour.length - 1; i++) {
      for (let j = i + 1; j < tour.length; j++) {
        // Create 2-opt candidate by reversing segment [i, j]
        const newTour = [
          ...tour.slice(0, i),
          ...tour.slice(i, j + 1).reverse(),
          ...tour.slice(j + 1),
        ];

        const oldDist = calculateTourDistance(startLat, startLng, tour, isRoundTrip);
        const newDist = calculateTourDistance(startLat, startLng, newTour, isRoundTrip);

        if (newDist < oldDist - 0.5) {
          tour = newTour;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  return tour;
}

/**
 * Value / Depth Priority Greedy Heuristic
 * Prioritizes high value targets (Gold, Meteorite) and shallower targets first,
 * balancing geographic proximity.
 */
export function solveValuePriority(
  startLat: number,
  startLng: number,
  points: MetalFinding[]
): MetalFinding[] {
  if (points.length <= 1) return [...points];

  const categoryWeights: Record<string, number> = {
    gold: 100,
    meteorite: 90,
    silver: 70,
    bronze: 55,
    iron: 30,
  };

  const unvisited = [...points];
  const tour: MetalFinding[] = [];
  let currentLat = startLat;
  let currentLng = startLng;

  while (unvisited.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const p = unvisited[i];
      const dist = calculateDistanceMeters(currentLat, currentLng, p.lat, p.lng);
      const catWeight = categoryWeights[p.category] || 40;
      const shallowBonus = Math.max(0, 35 - (p.depthEstimateCm || 15)); // shallower = easier

      // Weighted score: balance target yield vs walking penalty
      // High score is better
      const score = (catWeight * 1.5 + shallowBonus * 2) / Math.max(10, Math.pow(dist, 0.65));

      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    const nextPoint = unvisited.splice(bestIdx, 1)[0];
    tour.push(nextPoint);
    currentLat = nextPoint.lat;
    currentLng = nextPoint.lng;
  }

  return tour;
}

/**
 * Plans an optimal excavation route across selected findings
 */
export function planExcavationRoute(params: {
  selectedFindings: MetalFinding[];
  userLocation: GPSLocation | null;
  startFromUserGPS: boolean;
  algorithm: RouteAlgorithm;
  isRoundTrip: boolean;
}): ExcavationRoute | null {
  const { selectedFindings, userLocation, startFromUserGPS, algorithm, isRoundTrip } = params;

  if (selectedFindings.length === 0) {
    return null;
  }

  // Determine starting coordinate
  let startLat = selectedFindings[0].lat;
  let startLng = selectedFindings[0].lng;
  let startLabel = selectedFindings[0].name;
  let isUserGPS = false;

  let pointsToOrder = [...selectedFindings];

  if (startFromUserGPS && userLocation) {
    startLat = userLocation.lat;
    startLng = userLocation.lng;
    startLabel = 'Lokasi GPS Saya Saat Ini';
    isUserGPS = true;
  } else if (!startFromUserGPS && selectedFindings.length > 1) {
    // Keep first point as anchor start
    startLat = selectedFindings[0].lat;
    startLng = selectedFindings[0].lng;
    startLabel = `Titik Awal: ${selectedFindings[0].name}`;
    pointsToOrder = selectedFindings.slice(1);
  }

  // Execute chosen algorithm
  let orderedPoints: MetalFinding[] = [];
  if (startFromUserGPS && userLocation) {
    if (algorithm === 'two_opt') {
      orderedPoints = solveTwoOpt(startLat, startLng, pointsToOrder, isRoundTrip);
    } else if (algorithm === 'value_priority') {
      orderedPoints = solveValuePriority(startLat, startLng, pointsToOrder);
    } else {
      orderedPoints = solveNearestNeighbor(startLat, startLng, pointsToOrder);
    }
  } else {
    // Starts from selectedFindings[0]
    if (algorithm === 'two_opt') {
      orderedPoints = [selectedFindings[0], ...solveTwoOpt(startLat, startLng, pointsToOrder, isRoundTrip)];
    } else if (algorithm === 'value_priority') {
      orderedPoints = [selectedFindings[0], ...solveValuePriority(startLat, startLng, pointsToOrder)];
    } else {
      orderedPoints = [selectedFindings[0], ...solveNearestNeighbor(startLat, startLng, pointsToOrder)];
    }
  }

  // Build Waypoints & detailed timeline
  const waypoints: RouteWaypoint[] = [];
  const pathCoordinates: [number, number][] = [[startLat, startLng]];

  let prevLat = startLat;
  let prevLng = startLng;
  let totalDistanceMeters = 0;
  let totalDiggingMinutes = 0;
  let cumulativeTime = 0;

  orderedPoints.forEach((finding, idx) => {
    const legDistance = calculateDistanceMeters(prevLat, prevLng, finding.lat, finding.lng);
    const legBearing = calculateBearingDegrees(prevLat, prevLng, finding.lat, finding.lng);
    const cardinal = getCardinalDirectionIndo(legBearing);
    const digTime = estimateDiggingMinutes(finding);

    // Walking pace ~ 1 meter/second = 60 meters/minute
    const walkTimeMin = legDistance / 60;
    cumulativeTime += walkTimeMin + digTime;
    totalDistanceMeters += legDistance;
    totalDiggingMinutes += digTime;

    waypoints.push({
      id: finding.id,
      stepNumber: idx + 1,
      finding,
      lat: finding.lat,
      lng: finding.lng,
      distanceFromPrevMeters: legDistance,
      bearingFromPrevDegrees: legBearing,
      cardinalDirection: cardinal,
      estimatedDigTimeMinutes: digTime,
      cumulativeDistanceMeters: totalDistanceMeters,
      cumulativeTimeMinutes: Math.round(cumulativeTime * 10) / 10,
    });

    pathCoordinates.push([finding.lat, finding.lng]);
    prevLat = finding.lat;
    prevLng = finding.lng;
  });

  // If round trip, add return leg to path
  if (isRoundTrip && orderedPoints.length > 0) {
    const returnDistance = calculateDistanceMeters(prevLat, prevLng, startLat, startLng);
    totalDistanceMeters += returnDistance;
    cumulativeTime += returnDistance / 60;
    pathCoordinates.push([startLat, startLng]);
  }

  const totalWalkingMinutes = Math.round((totalDistanceMeters / 60) * 10) / 10;
  const totalExpeditionMinutes = Math.round((totalWalkingMinutes + totalDiggingMinutes) * 10) / 10;

  return {
    waypoints,
    startLocation: {
      lat: startLat,
      lng: startLng,
      label: startLabel,
      isUserGPS,
    },
    totalDistanceMeters: Math.round(totalDistanceMeters * 10) / 10,
    totalWalkingMinutes,
    totalDiggingMinutes: Math.round(totalDiggingMinutes * 10) / 10,
    totalExpeditionMinutes,
    algorithmUsed: algorithm,
    isRoundTrip,
    pathCoordinates,
  };
}

/**
 * Generates an external Google Maps Multi-stop URL
 */
export function generateGoogleMapsRouteUrl(route: ExcavationRoute): string {
  if (route.waypoints.length === 0) return '';

  const origin = `${route.startLocation.lat},${route.startLocation.lng}`;
  const lastTarget = route.waypoints[route.waypoints.length - 1];
  const destination = route.isRoundTrip
    ? origin
    : `${lastTarget.lat},${lastTarget.lng}`;

  const waypointList = route.isRoundTrip
    ? route.waypoints.map((w) => `${w.lat},${w.lng}`).join('|')
    : route.waypoints
        .slice(0, -1)
        .map((w) => `${w.lat},${w.lng}`)
        .join('|');

  let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
  if (waypointList) {
    url += `&waypoints=${encodeURIComponent(waypointList)}`;
  }
  return url;
}

/**
 * Generates a GPX standard XML format for metal detector / handheld GPS devices
 */
export function generateRouteGPX(route: ExcavationRoute): string {
  const timeStr = new Date().toISOString();
  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MetalScan PRO - Route Planner" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Jalur Penggalian Logam - ${new Date().toLocaleDateString('id-ID')}</name>
    <desc>Rute optimal penggalian ekspedisi metal detector. Total: ${(route.totalDistanceMeters / 1000).toFixed(2)} km, ${route.waypoints.length} sasaran.</desc>
    <time>${timeStr}</time>
  </metadata>
`;

  // Waypoints
  route.waypoints.forEach((w) => {
    gpx += `  <wpt lat="${w.lat}" lon="${w.lng}">
    <name>[#${w.stepNumber}] ${w.finding.name.replace(/[<>&]/g, '')}</name>
    <desc>Kategori: ${w.finding.category}, Kedalaman: ${w.finding.depthEstimateCm}cm, Kekuatan: ${w.finding.magneticStrength}uT</desc>
    <sym>Flag, Blue</sym>
  </wpt>\n`;
  });

  // Route
  gpx += `  <rte>
    <name>Rute Penggalian Optimal</name>
    <number>1</number>
`;

  if (route.startLocation.isUserGPS) {
    gpx += `    <rtept lat="${route.startLocation.lat}" lon="${route.startLocation.lng}">
      <name>Titik Awal (GPS)</name>
    </rtept>\n`;
  }

  route.waypoints.forEach((w) => {
    gpx += `    <rtept lat="${w.lat}" lon="${w.lng}">
      <name>Sasaran #${w.stepNumber} - ${w.finding.name.replace(/[<>&]/g, '')}</name>
    </rtept>\n`;
  });

  if (route.isRoundTrip) {
    gpx += `    <rtept lat="${route.startLocation.lat}" lon="${route.startLocation.lng}">
      <name>Kembali ke Awal</name>
    </rtept>\n`;
  }

  gpx += `  </rte>
</gpx>`;

  return gpx;
}
