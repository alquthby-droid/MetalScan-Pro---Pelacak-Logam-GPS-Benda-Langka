import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet.heat';
import { MetalFinding, GPSLocation, MetalCategory } from '../types/detector';
import {
  Layers,
  Crosshair,
  Navigation,
  Trash2,
  MapPin,
  Sparkles,
  ExternalLink,
  Calendar,
  Compass,
  Flame,
  Eye,
  EyeOff,
  Filter,
  Download,
  Target,
  Radio,
  Route,
  Footprints,
  Clock,
  Shovel,
  CheckCircle2,
  Radar,
  Bell,
  BellRing,
  Heart,
  Volume2,
  VolumeX,
  Vibrate,
  ShieldAlert,
  X,
} from 'lucide-react';
import { audioService } from '../services/audioSynthesizer';
import { SoilDepthIndicator } from './SoilDepthIndicator';
import { targetCenterAlarmService, TargetCenterAlarmState } from '../services/targetCenterAlarm';
import {
  RouteAlgorithm,
  planExcavationRoute,
  calculateDistanceMeters,
} from '../services/routePlannerService';
import { RoutePlannerModal } from './RoutePlannerModal';

interface FindingsMapProps {
  findings: MetalFinding[];
  userLocation: GPSLocation | null;
  onDeleteFinding: (id: string) => void;
  onSelectFinding?: (finding: MetalFinding) => void;
  onOpenExportModal?: () => void;
  onOpenHotspotsModal?: () => void;
  onOpenRoutePlanner?: () => void;
  onTogglePriority?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
}

const CATEGORY_FILTER_OPTIONS: { id: MetalCategory | 'all' | 'favorite'; label: string; symbol: string; color: string; activeBg: string; activeBorder: string }[] = [
  { id: 'all', label: 'Semua', symbol: '✦', color: '#94a3b8', activeBg: 'bg-cyan-500/20', activeBorder: 'border-cyan-400' },
  { id: 'favorite', label: 'Favorit', symbol: '❤️', color: '#f43f5e', activeBg: 'bg-rose-500/20', activeBorder: 'border-rose-400' },
  { id: 'gold', label: 'Emas', symbol: '★', color: '#eab308', activeBg: 'bg-yellow-500/20', activeBorder: 'border-yellow-400' },
  { id: 'meteorite', label: 'Meteorit', symbol: '☄', color: '#c084fc', activeBg: 'bg-purple-500/20', activeBorder: 'border-purple-400' },
  { id: 'bronze', label: 'Perunggu', symbol: '⬢', color: '#f97316', activeBg: 'bg-orange-500/20', activeBorder: 'border-orange-400' },
  { id: 'silver', label: 'Perak', symbol: '◈', color: '#38bdf8', activeBg: 'bg-sky-500/20', activeBorder: 'border-sky-400' },
  { id: 'iron', label: 'Besi', symbol: '⛏', color: '#94a3b8', activeBg: 'bg-slate-700/50', activeBorder: 'border-slate-500' },
];

export const FindingsMap: React.FC<FindingsMapProps> = ({
  findings,
  userLocation,
  onDeleteFinding,
  onSelectFinding,
  onOpenExportModal,
  onOpenHotspotsModal,
  onOpenRoutePlanner,
  onTogglePriority,
  onToggleFavorite,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userAccuracyCircleRef = useRef<L.Circle | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const heatLayerRef = useRef<L.Layer | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const radiusRingsLayerRef = useRef<L.LayerGroup | null>(null);
  const safeDistanceZonesLayerRef = useRef<L.LayerGroup | null>(null);
  const baseLayersRef = useRef<{ [key: string]: L.TileLayer }>({});

  const [activeLayer, setActiveLayer] = useState<'dark' | 'satellite'>('dark');
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [showRadiusRings, setShowRadiusRings] = useState<boolean>(true);
  const [showPins, setShowPins] = useState<boolean>(true);
  const [heatRadius, setHeatRadius] = useState<number>(35);
  const [selectedCategory, setSelectedCategory] = useState<MetalCategory | 'all' | 'favorite'>('all');
  const [showFilterBar, setShowFilterBar] = useState<boolean>(true);
  const [selectedFinding, setSelectedFinding] = useState<MetalFinding | null>(null);

  // Safe Distance Alarm States (< 3m radius for Favorite Findings)
  const [isSafeAlarmEnabled, setIsSafeAlarmEnabled] = useState<boolean>(true);
  const [isSafeAlarmMuted, setIsSafeAlarmMuted] = useState<boolean>(false);
  const [activeNearbyFinding, setActiveNearbyFinding] = useState<{
    finding: MetalFinding;
    distanceMeters: number;
    timestamp: number;
  } | null>(null);
  const [dismissedNearbyFindingId, setDismissedNearbyFindingId] = useState<string | null>(null);
  const [isAlarmTestSimulated, setIsAlarmTestSimulated] = useState<boolean>(false);
  const lastAlarmTriggerTimeRef = useRef<{ [findingId: string]: number }>({});

  // Route Planner States
  const [isRoutePlannerActive, setIsRoutePlannerActive] = useState<boolean>(false);
  const [isRoutePlannerModalOpen, setIsRoutePlannerModalOpen] = useState<boolean>(false);
  const [selectedRouteFindingIds, setSelectedRouteFindingIds] = useState<string[]>(() =>
    findings.map((f) => f.id)
  );
  const [routeAlgorithm, setRouteAlgorithm] = useState<RouteAlgorithm>('two_opt');
  const [startFromGPS, setStartFromGPS] = useState<boolean>(true);
  const [isRoundTripRoute, setIsRoundTripRoute] = useState<boolean>(false);

  // Synchronize route finding IDs when findings change
  useEffect(() => {
    setSelectedRouteFindingIds((prev) => {
      const validIdSet = new Set(findings.map((f) => f.id));
      const kept = prev.filter((id) => validIdSet.has(id));
      // If none selected or all were previously selected, select all
      if (kept.length === 0 || kept.length >= findings.length - 1) {
        return findings.map((f) => f.id);
      }
      return kept;
    });
  }, [findings]);

  // Target Center Sensor Alarm state
  const [alarmState, setAlarmState] = useState<TargetCenterAlarmState>(() =>
    targetCenterAlarmService.getState()
  );

  useEffect(() => {
    const unsub = targetCenterAlarmService.subscribe((st) => setAlarmState(st));
    return () => unsub();
  }, []);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: findings.length,
      favorite: findings.filter((f) => f.isFavorite).length,
    };
    findings.forEach((f) => {
      counts[f.category] = (counts[f.category] || 0) + 1;
    });
    return counts;
  }, [findings]);

  // Filtered findings based on selected category or favorite
  const filteredFindings = useMemo(() => {
    if (selectedCategory === 'all') return findings;
    if (selectedCategory === 'favorite') return findings.filter((f) => f.isFavorite === true);
    return findings.filter((f) => f.category === selectedCategory);
  }, [findings, selectedCategory]);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center (Jakarta or general region if GPS not yet ready)
    const initialLat = userLocation?.lat || -6.2088;
    const initialLng = userLocation?.lng || 106.8456;
    const initialZoom = userLocation ? 17 : 13;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    // Define Tile Layers
    const darkTileLayer = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 19,
        subdomains: 'abcd',
      }
    );

    const satelliteTileLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
      }
    );

    baseLayersRef.current = {
      dark: darkTileLayer,
      satellite: satelliteTileLayer,
    };

    darkTileLayer.addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;

    // Fix leaflet default icon path issues
    delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Base Layer (Dark vs Satellite)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !baseLayersRef.current) return;

    const { dark, satellite } = baseLayersRef.current;
    if (activeLayer === 'dark') {
      if (map.hasLayer(satellite)) map.removeLayer(satellite);
      if (!map.hasLayer(dark)) map.addLayer(dark);
    } else {
      if (map.hasLayer(dark)) map.removeLayer(dark);
      if (!map.hasLayer(satellite)) map.addLayer(satellite);
    }
  }, [activeLayer]);

  // Update User Location Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !userLocation) return;

    const userLatLng = L.latLng(userLocation.lat, userLocation.lng);

    // Custom pulsing user GPS marker
    const userIcon = L.divIcon({
      className: 'user-gps-marker',
      html: `
        <div style="position:relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 24px; height: 24px; border-radius: 9999px; background: rgba(56, 189, 248, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 14px; height: 14px; border-radius: 9999px; background: #0284c7; border: 2.5px solid #ffffff; box-shadow: 0 0 10px rgba(56, 189, 248, 0.9);"></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker(userLatLng, { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
      map.setView(userLatLng, Math.max(16, map.getZoom()));
    } else {
      userMarkerRef.current.setLatLng(userLatLng);
    }

    // Accuracy circle
    if (userLocation.accuracy && userLocation.accuracy > 0) {
      if (!userAccuracyCircleRef.current) {
        userAccuracyCircleRef.current = L.circle(userLatLng, {
          radius: userLocation.accuracy,
          color: '#38bdf8',
          weight: 1,
          opacity: 0.6,
          fillColor: '#38bdf8',
          fillOpacity: 0.1,
        }).addTo(map);
      } else {
        userAccuracyCircleRef.current.setLatLng(userLatLng);
        userAccuracyCircleRef.current.setRadius(userLocation.accuracy);
      }
    }
  }, [userLocation]);

  // Update Distance Radius Rings (5m, 10m, and 20m) around User Location
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (radiusRingsLayerRef.current) {
      map.removeLayer(radiusRingsLayerRef.current);
      radiusRingsLayerRef.current = null;
    }

    if (!showRadiusRings || !userLocation) return;

    const ringsGroup = L.layerGroup();
    const userLatLng = L.latLng(userLocation.lat, userLocation.lng);

    // 1 degree latitude ~ 111,320 meters
    const deltaLatPerMeter = 1 / 111320;

    // 1. Ring 5m (Direct Search Coil & Immediate Sweep Zone - Emerald)
    const circle5m = L.circle(userLatLng, {
      radius: 5,
      color: '#10b981',
      weight: 1.5,
      dashArray: '3, 4',
      fillColor: '#10b981',
      fillOpacity: 0.08,
      interactive: false,
    });
    ringsGroup.addLayer(circle5m);

    const badge5m = L.marker([userLocation.lat + 5 * deltaLatPerMeter, userLocation.lng], {
      icon: L.divIcon({
        className: 'radius-ring-badge',
        html: `<div style="transform: translate(-50%, -50%); background: rgba(6, 78, 59, 0.9); color: #6ee7b7; border: 1px solid #10b981; border-radius: 9999px; padding: 1px 5px; font-size: 8.5px; font-weight: bold; font-family: monospace; white-space: nowrap; pointer-events: none; box-shadow: 0 1px 4px rgba(0,0,0,0.6);">5m</div>`,
        iconSize: [0, 0],
      }),
      interactive: false,
    });
    ringsGroup.addLayer(badge5m);

    // 2. Ring 10m (Medium Proximity Detection Range - Cyan)
    const circle10m = L.circle(userLatLng, {
      radius: 10,
      color: '#06b6d4',
      weight: 1.5,
      dashArray: '4, 5',
      fillColor: '#06b6d4',
      fillOpacity: 0.05,
      interactive: false,
    });
    ringsGroup.addLayer(circle10m);

    const badge10m = L.marker([userLocation.lat + 10 * deltaLatPerMeter, userLocation.lng], {
      icon: L.divIcon({
        className: 'radius-ring-badge',
        html: `<div style="transform: translate(-50%, -50%); background: rgba(8, 51, 68, 0.9); color: #67e8f9; border: 1px solid #06b6d4; border-radius: 9999px; padding: 1px 5px; font-size: 8.5px; font-weight: bold; font-family: monospace; white-space: nowrap; pointer-events: none; box-shadow: 0 1px 4px rgba(0,0,0,0.6);">10m</div>`,
        iconSize: [0, 0],
      }),
      interactive: false,
    });
    ringsGroup.addLayer(badge10m);

    // 3. Ring 20m (Perimeter Search & Walking Horizon Range - Indigo)
    const circle20m = L.circle(userLatLng, {
      radius: 20,
      color: '#818cf8',
      weight: 1.5,
      dashArray: '5, 6',
      fillColor: '#818cf8',
      fillOpacity: 0.03,
      interactive: false,
    });
    ringsGroup.addLayer(circle20m);

    const badge20m = L.marker([userLocation.lat + 20 * deltaLatPerMeter, userLocation.lng], {
      icon: L.divIcon({
        className: 'radius-ring-badge',
        html: `<div style="transform: translate(-50%, -50%); background: rgba(30, 27, 75, 0.9); color: #c7d2fe; border: 1px solid #818cf8; border-radius: 9999px; padding: 1px 5px; font-size: 8.5px; font-weight: bold; font-family: monospace; white-space: nowrap; pointer-events: none; box-shadow: 0 1px 4px rgba(0,0,0,0.6);">20m</div>`,
        iconSize: [0, 0],
      }),
      interactive: false,
    });
    ringsGroup.addLayer(badge20m);

    ringsGroup.addTo(map);
    radiusRingsLayerRef.current = ringsGroup;

    return () => {
      if (radiusRingsLayerRef.current) {
        map.removeLayer(radiusRingsLayerRef.current);
        radiusRingsLayerRef.current = null;
      }
    };
  }, [userLocation, showRadiusRings]);

  // Favorite findings for Safe Distance Alarm
  const favoriteFindings = useMemo(() => {
    return findings.filter((f) => f.isFavorite === true);
  }, [findings]);

  // Safe Distance Proximity Alarm Monitor (< 3m from favorite findings)
  useEffect(() => {
    if (!isSafeAlarmEnabled || !userLocation) {
      if (!isAlarmTestSimulated) {
        setActiveNearbyFinding(null);
      }
      return;
    }

    if (isAlarmTestSimulated) return;

    if (favoriteFindings.length === 0) {
      setActiveNearbyFinding(null);
      return;
    }

    const userLatLng = L.latLng(userLocation.lat, userLocation.lng);
    let closestTarget: { finding: MetalFinding; distance: number } | null = null;

    for (const f of favoriteFindings) {
      const d = userLatLng.distanceTo(L.latLng(f.lat, f.lng));
      if (d < 3.0) {
        if (!closestTarget || d < closestTarget.distance) {
          closestTarget = { finding: f, distance: d };
        }
      }
    }

    if (closestTarget) {
      const targetId = closestTarget.finding.id;
      const now = Date.now();
      const lastTriggered = lastAlarmTriggerTimeRef.current[targetId] || 0;

      setActiveNearbyFinding({
        finding: closestTarget.finding,
        distanceMeters: Number(closestTarget.distance.toFixed(1)),
        timestamp: now,
      });

      // Fire audio alarm and vibration if not dismissed and debounce passed (> 10s)
      if (dismissedNearbyFindingId !== targetId && now - lastTriggered > 10000) {
        lastAlarmTriggerTimeRef.current[targetId] = now;

        if (!isSafeAlarmMuted) {
          audioService.playFavoriteProximityAlarm(0.85);
        }

        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate([200, 80, 200, 80, 300]);
          } catch {
            // ignore vibration error
          }
        }
      }
    } else {
      setActiveNearbyFinding(null);
      if (dismissedNearbyFindingId) {
        setDismissedNearbyFindingId(null);
      }
    }
  }, [
    userLocation,
    favoriteFindings,
    isSafeAlarmEnabled,
    isSafeAlarmMuted,
    dismissedNearbyFindingId,
    isAlarmTestSimulated,
  ]);

  // Draw 3-Meter Safe Distance Zones for Favorite Findings on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (safeDistanceZonesLayerRef.current) {
      map.removeLayer(safeDistanceZonesLayerRef.current);
      safeDistanceZonesLayerRef.current = null;
    }

    if (!isSafeAlarmEnabled || favoriteFindings.length === 0) return;

    const layerGroup = L.layerGroup();
    const deltaLatPerMeter = 1 / 111320;

    favoriteFindings.forEach((fav) => {
      const isInsideThis = activeNearbyFinding?.finding.id === fav.id;
      const ringColor = isInsideThis ? '#ef4444' : '#f43f5e';

      // 3m zone circle
      const zoneCircle = L.circle([fav.lat, fav.lng], {
        radius: 3,
        color: ringColor,
        weight: isInsideThis ? 2.5 : 1.5,
        dashArray: isInsideThis ? 'none' : '3, 4',
        fillColor: ringColor,
        fillOpacity: isInsideThis ? 0.3 : 0.12,
        interactive: false,
      });
      layerGroup.addLayer(zoneCircle);

      // 3m zone badge
      const badge = L.marker([fav.lat + 3 * deltaLatPerMeter, fav.lng], {
        icon: L.divIcon({
          className: 'safe-zone-badge',
          html: `<div style="transform: translate(-50%, -50%); background: rgba(136, 19, 55, 0.95); color: #fecdd3; border: 1px solid #f43f5e; border-radius: 9999px; padding: 1px 6px; font-size: 8px; font-weight: bold; font-family: monospace; white-space: nowrap; pointer-events: none; box-shadow: 0 1px 5px rgba(0,0,0,0.7); display: flex; align-items: center; gap: 3px;">
            <span style="color: #fda4af;">❤️</span>
            <span>3m Aman</span>
          </div>`,
          iconSize: [0, 0],
        }),
        interactive: false,
      });
      layerGroup.addLayer(badge);
    });

    layerGroup.addTo(map);
    safeDistanceZonesLayerRef.current = layerGroup;

    return () => {
      if (safeDistanceZonesLayerRef.current) {
        map.removeLayer(safeDistanceZonesLayerRef.current);
        safeDistanceZonesLayerRef.current = null;
      }
    };
  }, [favoriteFindings, isSafeAlarmEnabled, activeNearbyFinding]);

  // Quick test simulation for Safe Distance Alarm (< 3m)
  const handleTestSafeAlarm = () => {
    setIsAlarmTestSimulated(true);
    setDismissedNearbyFindingId(null);

    const candidate = favoriteFindings[0] || findings[0] || {
      id: 'test_fav_spot',
      name: 'Koin Emas Sasak (Titik Favorit)',
      category: 'gold' as MetalCategory,
      lat: userLocation ? userLocation.lat + 0.000015 : -8.5833,
      lng: userLocation ? userLocation.lng + 0.000015 : 116.1167,
      magneticStrength: 82.4,
      netStrength: 34.4,
      depthEstimateCm: 14,
      accuracy: 2.1,
      timestamp: Date.now(),
      autoSaved: false,
      isFavorite: true,
    };

    setActiveNearbyFinding({
      finding: candidate,
      distanceMeters: 1.8,
      timestamp: Date.now(),
    });

    if (!isSafeAlarmMuted) {
      audioService.playFavoriteProximityAlarm(0.9);
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([200, 80, 200, 80, 300]);
      } catch {}
    }
  };

  // Filter findings for Route Planner
  const selectedRouteFindings = useMemo(() => {
    const idSet = new Set(selectedRouteFindingIds);
    return findings.filter((f) => idSet.has(f.id));
  }, [findings, selectedRouteFindingIds]);

  // Calculated excavation route using chosen algorithm (TSP 2-Opt / Nearest Neighbor / Value Priority)
  const calculatedRoute = useMemo(() => {
    if (!isRoutePlannerActive || selectedRouteFindings.length === 0) return null;
    return planExcavationRoute({
      selectedFindings: selectedRouteFindings,
      userLocation,
      startFromUserGPS: startFromGPS && !!userLocation,
      algorithm: routeAlgorithm,
      isRoundTrip: isRoundTripRoute,
    });
  }, [
    isRoutePlannerActive,
    selectedRouteFindings,
    userLocation,
    startFromGPS,
    routeAlgorithm,
    isRoundTripRoute,
  ]);

  // Update Route Polyline & Sequence Trail on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    if (isRoutePlannerActive && calculatedRoute && calculatedRoute.pathCoordinates.length > 1) {
      const routeGroup = L.layerGroup();

      // Outer glow polyline
      const glowLine = L.polyline(calculatedRoute.pathCoordinates, {
        color: '#06b6d4',
        weight: 7,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round',
      });
      glowLine.addTo(routeGroup);

      // Inner glowing dashed polyline
      const dashLine = L.polyline(calculatedRoute.pathCoordinates, {
        color: '#38bdf8',
        weight: 3.5,
        dashArray: '8, 8',
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      });
      dashLine.addTo(routeGroup);

      // Start Marker if User GPS
      if (calculatedRoute.startLocation.isUserGPS) {
        const startIcon = L.divIcon({
          className: 'route-start-marker',
          html: `
            <div style="padding: 2px 7px; background: #0284c7; color: #fff; font-size: 10px; font-weight: bold; font-family: monospace; border-radius: 9999px; border: 1.5px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.6); white-space: nowrap;">
              ▶ AWAL (GPS)
            </div>
          `,
          iconAnchor: [32, 22],
        });
        L.marker([calculatedRoute.startLocation.lat, calculatedRoute.startLocation.lng], {
          icon: startIcon,
          zIndexOffset: 1500,
        }).addTo(routeGroup);
      }

      routeGroup.addTo(map);
      routeLayerRef.current = routeGroup;
    }
  }, [isRoutePlannerActive, calculatedRoute]);

  // Fit bounds to the planned route
  const fitRouteBounds = () => {
    if (!mapInstanceRef.current || !calculatedRoute || calculatedRoute.pathCoordinates.length === 0) return;
    const poly = L.polyline(calculatedRoute.pathCoordinates);
    mapInstanceRef.current.fitBounds(poly.getBounds().pad(0.25), { animate: true });
  };

  // Render Findings Markers & Heatmap based on filteredFindings & route planner mode
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    // Remove existing heatmap layer if any
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    // 1. Generate Heatmap Data from filtered findings
    // Weight calculation: Normalized by magneticStrength (e.g. 50uT -> 0.3, 100uT -> 0.65, 180uT -> 1.0)
    if (showHeatmap && filteredFindings.length > 0) {
      const heatPoints: [number, number, number][] = filteredFindings.map((f) => {
        // Higher intensity for stronger magnetic anomaly
        const intensity = Math.min(1.0, Math.max(0.25, f.magneticStrength / 130));
        return [f.lat, f.lng, intensity];
      });

      // Gradient color configuration: Cold (cyan/blue) -> Moderate (lime/yellow) -> Hot intense (orange/red/purple)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const heat = (L as any).heatLayer(heatPoints, {
        radius: heatRadius,
        blur: Math.round(heatRadius * 0.7),
        maxZoom: 18,
        max: 1.0,
        gradient: {
          0.2: '#06b6d4', // Cyan (low anomaly)
          0.4: '#10b981', // Emerald
          0.6: '#eab308', // Yellow/Gold
          0.8: '#f97316', // Orange
          1.0: '#ef4444', // Red-hot intense core
        },
      });

      heat.addTo(map);
      heatLayerRef.current = heat;
    }

    // 2. Render Pin Markers for filtered findings (if enabled)
    if (showPins) {
      filteredFindings.forEach((finding) => {
        // Category colors & symbols
        let pinColor = '#94a3b8'; // iron
        let symbol = '⛏';
        if (finding.category === 'gold') {
          pinColor = '#eab308';
          symbol = '★';
        } else if (finding.category === 'meteorite') {
          pinColor = '#c084fc';
          symbol = '☄';
        } else if (finding.category === 'silver') {
          pinColor = '#38bdf8';
          symbol = '◈';
        } else if (finding.category === 'bronze') {
          pinColor = '#f97316';
          symbol = '⬢';
        }

        let customIcon: L.DivIcon;

        // Custom display when Route Planner mode is active
        if (isRoutePlannerActive) {
          const isSelectedInRoute = selectedRouteFindingIds.includes(finding.id);
          const waypoint = calculatedRoute?.waypoints.find((w) => w.id === finding.id);
          const stepNumber = waypoint ? waypoint.stepNumber : null;

          if (isSelectedInRoute) {
            customIcon = L.divIcon({
              className: 'route-step-marker',
              html: `
                <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">
                  <div style="width: 30px; height: 30px; border-radius: 9999px; background: ${pinColor}; border: 2.5px solid #ffffff; display: flex; align-items: center; justify-content: center; color: #020617; font-weight: 900; font-size: 13px; font-family: monospace; box-shadow: 0 0 14px ${pinColor}, 0 4px 10px rgba(0,0,0,0.8);">
                    ${stepNumber ? stepNumber : '✓'}
                  </div>
                  <div style="position: absolute; bottom: -4px; width: 6px; height: 6px; background: ${pinColor}; transform: rotate(45deg);"></div>
                </div>
              `,
              iconSize: [34, 34],
              iconAnchor: [17, 30],
            });
          } else {
            // Unselected finding in route mode: dashed with + sign
            customIcon = L.divIcon({
              className: 'route-unselected-marker',
              html: `
                <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0.7; transition: transform 0.2s, opacity 0.2s;" onmouseover="this.style.transform='scale(1.15)'; this.style.opacity='1'" onmouseout="this.style.transform='scale(1)'; this.style.opacity='0.7'">
                  <div style="width: 24px; height: 24px; border-radius: 9999px; background: #0f172a; border: 1.5px dashed ${pinColor}; display: flex; align-items: center; justify-content: center; color: ${pinColor}; font-weight: bold; font-size: 12px; font-family: monospace;">
                    +
                  </div>
                </div>
              `,
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            });
          }
        } else {
          // Standard pin marker
          customIcon = L.divIcon({
            className: 'finding-pin-marker',
            html: `
              <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">
                <div style="width: 28px; height: 28px; border-radius: 9999px; background: ${pinColor}; border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; color: #000; font-weight: bold; font-size: 13px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
                  ${symbol}
                </div>
                ${finding.isPriority ? '<div style="position: absolute; top: -5px; right: -5px; background: #f59e0b; color: #000; font-size: 10px; width: 16px; height: 16px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-weight: 900; border: 1.5px solid #fff; box-shadow: 0 0 8px #f59e0b;">★</div>' : ''}
                ${finding.isFavorite ? '<div style="position: absolute; top: -5px; left: -5px; background: #e11d48; color: #fff; font-size: 10px; width: 17px; height: 17px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-weight: 900; border: 1.5px solid #fff; box-shadow: 0 0 8px #e11d48;">❤️</div>' : ''}
                <div style="position: absolute; bottom: -4px; width: 6px; height: 6px; background: ${pinColor}; transform: rotate(45deg);"></div>
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 28],
          });
        }

        // Draw 5-meter Geofence radius circle if finding is priority
        if (finding.isPriority) {
          const geofenceCircle = L.circle([finding.lat, finding.lng], {
            radius: 5,
            color: '#f59e0b',
            weight: 2,
            dashArray: '5, 5',
            fillColor: '#fbbf24',
            fillOpacity: 0.22,
          });
          geofenceCircle.bindTooltip(`🎯 Geofence 5m: ${finding.name}`, {
            direction: 'top',
          });
          geofenceCircle.addTo(markersLayer);
        }

        const marker = L.marker([finding.lat, finding.lng], { icon: customIcon });

        marker.on('click', () => {
          if (isRoutePlannerActive) {
            // In Route Planner mode: clicking toggles inclusion in route
            setSelectedRouteFindingIds((prev) =>
              prev.includes(finding.id)
                ? prev.filter((id) => id !== finding.id)
                : [...prev, finding.id]
            );
          } else {
            setSelectedFinding(finding);
            if (onSelectFinding) onSelectFinding(finding);
          }
        });

        marker.addTo(markersLayer);
      });
    }
  }, [
    filteredFindings,
    onSelectFinding,
    showHeatmap,
    showPins,
    heatRadius,
    isRoutePlannerActive,
    selectedRouteFindingIds,
    calculatedRoute,
  ]);

  const centerOnUser = () => {
    if (!mapInstanceRef.current || !userLocation) return;
    mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 18, { animate: true });
  };

  const fitAllFindings = () => {
    if (!mapInstanceRef.current || filteredFindings.length === 0) return;
    const group = L.featureGroup(
      filteredFindings.map((f) => L.marker([f.lat, f.lng]))
    );
    if (userLocation) {
      group.addLayer(L.marker([userLocation.lat, userLocation.lng]));
    }
    mapInstanceRef.current.fitBounds(group.getBounds().pad(0.2), { animate: true });
  };

  const [isHeatmapSettingsOpen, setIsHeatmapSettingsOpen] = useState<boolean>(false);

  return (
    <div className="relative w-full h-[380px] md:h-[480px] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950 flex flex-col">
      {/* Top Map Action Bar */}
      <div className="absolute top-3 left-3 right-3 z-[400] flex items-center justify-between pointer-events-none gap-2">
        <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700/80 shadow-lg text-xs font-mono text-slate-200">
          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            {filteredFindings.length}
            {selectedCategory !== 'all' && ` / ${findings.length}`} Titik
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5 flex-wrap justify-end">
          {/* Toggle Category Filter Bar */}
          <button
            type="button"
            onClick={() => setShowFilterBar(!showFilterBar)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-mono shadow-lg active:scale-95 transition-all ${
              selectedCategory !== 'all'
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold'
                : showFilterBar
                ? 'bg-slate-800/90 border-slate-600 text-slate-200'
                : 'bg-slate-900/90 border-slate-700/80 text-slate-400 hover:text-slate-200'
            }`}
            title="Filter Tampilan Kategori Logam (Emas, Perunggu, Meteorit, dll.)"
          >
            <Filter className={`w-3.5 h-3.5 ${selectedCategory !== 'all' ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} />
            <span>Filter</span>
            {selectedCategory !== 'all' && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            )}
          </button>

          {/* Heatmap Toggle Button */}
          <button
            type="button"
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-mono shadow-lg active:scale-95 transition-all ${
              showHeatmap
                ? 'bg-gradient-to-r from-orange-600/90 to-red-600/90 border-orange-400/80 text-white shadow-orange-950/50'
                : 'bg-slate-900/90 border-slate-700/80 text-slate-400 hover:text-slate-200'
            }`}
            title="Aktifkan/Nonaktifkan Lapisan Heatmap Kerapatan Logam"
          >
            <Flame className={`w-3.5 h-3.5 ${showHeatmap ? 'text-amber-300 animate-pulse' : 'text-slate-400'}`} />
            <span>Heatmap</span>
            {showHeatmap && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            )}
          </button>

          {/* Toggle Pins */}
          <button
            type="button"
            onClick={() => setShowPins(!showPins)}
            className={`p-2 rounded-full backdrop-blur-md border shadow-lg active:scale-95 transition-all ${
              showPins
                ? 'bg-slate-900/90 border-slate-700/80 text-slate-200 hover:text-white'
                : 'bg-slate-900/60 border-slate-800 text-slate-500'
            }`}
            title={showPins ? 'Sembunyikan Pin Temuan' : 'Tampilkan Pin Temuan'}
          >
            {showPins ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          {/* Radius Jarak (5m, 10m, 20m) Toggle Button */}
          <button
            type="button"
            onClick={() => setShowRadiusRings(!showRadiusRings)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-mono shadow-lg active:scale-95 transition-all ${
              showRadiusRings
                ? 'bg-gradient-to-r from-emerald-600/90 to-teal-600/90 border-emerald-400 text-white shadow-emerald-950/60 font-bold'
                : 'bg-slate-900/90 border-slate-700/80 text-slate-400 hover:text-slate-200'
            }`}
            title="Tampilkan Lingkaran Radius Jarak 5m, 10m, dan 20m di Sekitar Posisi Pengguna"
          >
            <Radar className={`w-3.5 h-3.5 ${showRadiusRings ? 'text-emerald-300 animate-pulse' : 'text-slate-400'}`} />
            <span>Radius Jarak</span>
            {showRadiusRings && (
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-950/90 text-emerald-300 font-bold border border-emerald-500/40">
                5-20m
              </span>
            )}
          </button>

          {/* Alarm Jarak Aman (< 3m Favorit) Toggle Button */}
          <button
            type="button"
            onClick={() => setIsSafeAlarmEnabled(!isSafeAlarmEnabled)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-mono shadow-lg active:scale-95 transition-all ${
              isSafeAlarmEnabled
                ? 'bg-gradient-to-r from-rose-600/90 to-pink-600/90 border-rose-400 text-white shadow-rose-950/60 font-bold'
                : 'bg-slate-900/90 border-slate-700/80 text-slate-400 hover:text-slate-200'
            }`}
            title="Alarm Jarak Aman: Bergetar dan berbunyi saat mendekati temuan favorit dalam radius < 3m"
          >
            <BellRing className={`w-3.5 h-3.5 ${isSafeAlarmEnabled ? 'text-rose-300 animate-pulse' : 'text-slate-400'}`} />
            <span>Alarm Aman</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-rose-950/90 text-rose-300 font-bold border border-rose-500/40 flex items-center gap-0.5">
              <span>❤️</span>
              <span>&lt;3m</span>
            </span>
          </button>

          {/* Route Planner Toggle Button */}
          {findings.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const nextState = !isRoutePlannerActive;
                setIsRoutePlannerActive(nextState);
                if (nextState && selectedRouteFindingIds.length === 0) {
                  setSelectedRouteFindingIds(findings.map((f) => f.id));
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-mono shadow-lg active:scale-95 transition-all ${
                isRoutePlannerActive
                  ? 'bg-gradient-to-r from-emerald-600/90 to-cyan-600/90 border-emerald-400 text-white shadow-emerald-950/60 font-bold'
                  : 'bg-slate-900/90 border-slate-700/80 text-slate-300 hover:text-white'
              }`}
              title="Perencana Rute Penggalian Optimal (TSP / Terdekat)"
            >
              <Route className={`w-3.5 h-3.5 ${isRoutePlannerActive ? 'text-emerald-300 animate-pulse' : 'text-cyan-400'}`} />
              <span>Route Planner</span>
              {isRoutePlannerActive && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-950/90 text-emerald-300 font-bold border border-emerald-500/40">
                  {selectedRouteFindingIds.length}
                </span>
              )}
            </button>
          )}

          {/* Layer switcher */}
          <button
            type="button"
            onClick={() => setActiveLayer(activeLayer === 'dark' ? 'satellite' : 'dark')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-xs font-mono text-slate-300 hover:text-white shadow-lg active:scale-95 transition-all"
            title="Ganti Tampilan Peta Satelit / Gelap"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">{activeLayer === 'dark' ? 'Satelit' : 'Taktis Gelap'}</span>
          </button>

          {/* Gemini AI Hotspots Suggestion */}
          {findings.length > 0 && onOpenHotspotsModal && (
            <button
              type="button"
              onClick={onOpenHotspotsModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-amber-500/50 text-xs font-mono text-amber-300 hover:text-white hover:bg-amber-500/20 shadow-lg active:scale-95 transition-all"
              title="Prediksi Hotspot Penggalian Berikutnya dengan Gemini AI"
            >
              <Target className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Hotspot AI</span>
            </button>
          )}

          {/* Export findings / PDF / CSV */}
          {findings.length > 0 && onOpenExportModal && (
            <button
              type="button"
              onClick={onOpenExportModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-cyan-500/50 text-xs font-mono text-cyan-300 hover:text-white hover:bg-cyan-500/20 shadow-lg active:scale-95 transition-all"
              title="Ekspor Laporan PDF Lengkap Peta atau CSV Spreadsheet"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Ekspor PDF / CSV</span>
            </button>
          )}

          {/* Fit all bounds */}
          {filteredFindings.length > 0 && (
            <button
              type="button"
              onClick={fitAllFindings}
              className="p-2 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-slate-300 hover:text-white shadow-lg active:scale-95 transition-all"
              title="Lihat Semua Titik Temuan Sesuai Filter"
            >
              <Crosshair className="w-4 h-4 text-amber-400" />
            </button>
          )}

          {/* Re-center user */}
          <button
            type="button"
            onClick={centerOnUser}
            disabled={!userLocation}
            className={`p-2 rounded-full backdrop-blur-md border shadow-lg active:scale-95 transition-all ${
              userLocation
                ? 'bg-slate-900/90 border-slate-700/80 text-cyan-400 hover:bg-slate-800'
                : 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed'
            }`}
            title="Pusatkan ke Lokasi Saya Sekarang"
          >
            <Navigation className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Category Filter Chips Bar */}
      {showFilterBar && (
        <div className="absolute top-13 left-3 right-3 z-[400] flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 pointer-events-auto">
          <div className="flex items-center gap-1.5 bg-slate-900/95 backdrop-blur-md p-1 rounded-2xl border border-slate-700/80 shadow-2xl">
            {CATEGORY_FILTER_OPTIONS.map((opt) => {
              const count = categoryCounts[opt.id] || 0;
              const isSelected = selectedCategory === opt.id;

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedCategory(opt.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono transition-all whitespace-nowrap ${
                    isSelected
                      ? `${opt.activeBg} border ${opt.activeBorder} text-white font-bold shadow-md`
                      : 'bg-slate-950/60 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <span style={{ color: opt.color }}>{opt.symbol}</span>
                  <span>{opt.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected ? 'bg-slate-900 text-white font-bold' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Heatmap Legend & Radius Slider (When Heatmap Active) */}
      {showHeatmap && (
        <div className={`absolute ${showFilterBar ? 'top-26' : 'top-14'} left-3 z-[400] flex flex-col gap-1.5 pointer-events-auto transition-all`}>
          <div className="bg-slate-900/90 backdrop-blur-md p-2 rounded-2xl border border-slate-700/80 shadow-xl font-mono text-[10px] text-slate-300 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1 text-amber-400 font-bold">
                <Flame className="w-3 h-3 text-orange-400" />
                <span>Intensitas Logam</span>
              </div>
              <button
                type="button"
                onClick={() => setIsHeatmapSettingsOpen(!isHeatmapSettingsOpen)}
                className="text-[9px] text-cyan-400 hover:underline px-1 py-0.5"
              >
                {isHeatmapSettingsOpen ? 'Tutup' : 'Radius'}
              </button>
            </div>

            {/* Gradient Bar */}
            <div className="w-36 h-2 rounded-full bg-gradient-to-r from-cyan-500 via-emerald-400 via-yellow-400 via-orange-500 to-red-600 border border-slate-700"></div>
            <div className="flex items-center justify-between text-[8px] text-slate-400 font-mono">
              <span>Rendah</span>
              <span>Sedang</span>
              <span className="text-red-400 font-semibold">Tinggi / Padat</span>
            </div>

            {/* Adjustable Radius Slider dropdown */}
            {isHeatmapSettingsOpen && (
              <div className="mt-1 pt-1.5 border-t border-slate-800 flex flex-col gap-1">
                <div className="flex items-center justify-between text-[9px] text-slate-400">
                  <span>Radius Sebar:</span>
                  <span className="font-bold text-slate-200">{heatRadius}px</span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={65}
                  step={5}
                  value={heatRadius}
                  onChange={(e) => setHeatRadius(Number(e.target.value))}
                  className="w-full accent-orange-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actual Leaflet Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Safe Distance Alarm Alert Banner (< 3m) */}
      {activeNearbyFinding && dismissedNearbyFindingId !== activeNearbyFinding.finding.id && (
        <div className="absolute top-16 left-3 right-3 sm:left-auto sm:right-4 sm:max-w-md z-[500] animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto">
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-rose-950/95 via-slate-900/95 to-slate-950/95 backdrop-blur-xl border-2 border-rose-500/80 shadow-2xl shadow-rose-950/80 text-white space-y-2.5 ring-2 ring-rose-500/30">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="relative p-2 rounded-xl bg-rose-500/25 border border-rose-400/50 text-rose-300">
                  <BellRing className="w-5 h-5 text-rose-400 animate-bounce" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-rose-300 uppercase tracking-wider">
                    <span>🚨 Alarm Jarak Aman (&lt; 3m)</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-extrabold text-[9px] animate-pulse">
                      DEKAT
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white tracking-tight line-clamp-1 mt-0.5">
                    {activeNearbyFinding.finding.name}
                  </h4>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsSafeAlarmMuted(!isSafeAlarmMuted)}
                  className={`p-1.5 rounded-lg border text-xs transition-colors ${
                    isSafeAlarmMuted
                      ? 'bg-slate-800 text-slate-400 border-slate-700'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                  }`}
                  title={isSafeAlarmMuted ? 'Bunyikan Alarm' : 'Bungkam Suara Alarm'}
                >
                  {isSafeAlarmMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDismissedNearbyFindingId(activeNearbyFinding.finding.id);
                    setIsAlarmTestSimulated(false);
                  }}
                  className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                  title="Tutup Peringatan Ini"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-mono bg-rose-950/40 p-2 rounded-xl border border-rose-900/60">
              <div className="flex items-center gap-1.5 text-rose-200">
                <Crosshair className="w-3.5 h-3.5 text-rose-400 animate-spin" />
                <span>Jarak ke Titik:</span>
                <span className="font-extrabold text-sm text-white px-1.5 py-0.5 rounded bg-rose-600/60 border border-rose-400/50">
                  {activeNearbyFinding.distanceMeters} meter
                </span>
              </div>

              <div className="text-[11px] text-slate-300">
                Radius &lt; 3m terdeteksi!
              </div>
            </div>

            <p className="text-[11px] text-slate-300 leading-snug font-sans">
              Titik koordinat temuan favorit ini berada sangat dekat dengan langkah Anda. Jangan sampai terlewatkan saat menyusuri jalur!
            </p>

            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.flyTo(
                      [activeNearbyFinding.finding.lat, activeNearbyFinding.finding.lng],
                      19,
                      { duration: 1.2 }
                    );
                  }
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold font-mono text-xs shadow-md transition-all active:scale-95"
              >
                <Target className="w-3.5 h-3.5" />
                <span>Pusatkan Peta</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedFinding(activeNearbyFinding.finding);
                }}
                className="flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs border border-slate-700 transition-all active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Detail</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Radius Jarak & Safe Distance Alarm Legend Chip */}
      {(showRadiusRings || isSafeAlarmEnabled) && userLocation && !selectedFinding && (
        <div className="absolute bottom-3 left-3 z-[400] pointer-events-auto flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-2.5 py-1.5 rounded-2xl border border-slate-700/80 shadow-xl font-mono text-[10px] text-slate-300 flex-wrap">
          {showRadiusRings && (
            <>
              <div className="flex items-center gap-1.5 font-bold text-slate-200">
                <Radar className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Radius:</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1" title="Lingkaran 5m: Jangkauan koil pencari & sapuan langsung">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 border border-emerald-300"></span>
                  <span className="text-emerald-300 font-semibold">5m</span>
                </span>
                <span className="flex items-center gap-1" title="Lingkaran 10m: Jangkauan deteksi anomali menengah">
                  <span className="w-2 h-2 rounded-full bg-cyan-500 border border-cyan-300"></span>
                  <span className="text-cyan-300 font-semibold">10m</span>
                </span>
                <span className="flex items-center gap-1" title="Lingkaran 20m: Perimeter luas langkah penjelajahan">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 border border-indigo-300"></span>
                  <span className="text-indigo-300 font-semibold">20m</span>
                </span>
              </div>
            </>
          )}

          {isSafeAlarmEnabled && (
            <div className={`flex items-center gap-1.5 ${showRadiusRings ? 'pl-2 border-l border-slate-700' : ''}`}>
              <span className="flex items-center gap-1" title="Lingkaran 3m: Alarm Jarak Aman temuan favorit">
                <span className="w-2 h-2 rounded-full bg-rose-500 border border-rose-300 animate-pulse"></span>
                <span className="text-rose-300 font-semibold">3m Aman ❤️</span>
              </span>
              <button
                type="button"
                onClick={handleTestSafeAlarm}
                className="px-2 py-0.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[9px] font-bold active:scale-95 transition-all"
                title="Uji coba alarm jarak aman & notifikasi suara"
              >
                Uji Alarm
              </button>
            </div>
          )}
        </div>
      )}

      {/* Selected Finding Details Drawer Modal */}
      {selectedFinding && (
        <div className="absolute bottom-3 left-3 right-3 z-[450] bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-4 shadow-2xl animate-in fade-in slide-in-from-bottom duration-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg border shadow-inner"
                style={{
                  backgroundColor:
                    selectedFinding.category === 'gold'
                      ? 'rgba(234, 179, 8, 0.2)'
                      : selectedFinding.category === 'meteorite'
                      ? 'rgba(192, 132, 252, 0.2)'
                      : 'rgba(56, 189, 248, 0.2)',
                  color:
                    selectedFinding.category === 'gold'
                      ? '#facc15'
                      : selectedFinding.category === 'meteorite'
                      ? '#c084fc'
                      : '#38bdf8',
                  borderColor:
                    selectedFinding.category === 'gold'
                      ? 'rgba(234, 179, 8, 0.5)'
                      : 'rgba(56, 189, 248, 0.5)',
                }}
              >
                {selectedFinding.category === 'gold'
                  ? '★'
                  : selectedFinding.category === 'meteorite'
                  ? '☄'
                  : '⛏'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-slate-100">{selectedFinding.name}</h4>
                  <span
                    className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-semibold ${
                      selectedFinding.autoSaved
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    }`}
                  >
                    {selectedFinding.autoSaved ? 'Auto-Simpan GPS' : 'Tandai Manual'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-0.5 flex-wrap">
                  <span className="flex items-center gap-1 text-amber-400 font-semibold">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>{selectedFinding.magneticStrength.toFixed(1)} µT</span>
                  </span>
                  <span>•</span>
                  <SoilDepthIndicator
                    depthCm={selectedFinding.depthEstimateCm}
                    itemName={selectedFinding.name}
                    category={selectedFinding.category}
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedFinding(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 text-lg leading-none"
            >
              ×
            </button>
          </div>

          {/* Priority Geofence 5m Quick Status */}
          <div className="mt-2 p-2 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
              <span className="text-amber-400">★</span>
              Geofence Radius 5m:
            </span>
            {onTogglePriority && (
              <button
                type="button"
                onClick={() => {
                  onTogglePriority(selectedFinding.id);
                  setSelectedFinding((prev) => (prev ? { ...prev, isPriority: !prev.isPriority } : null));
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all ${
                  selectedFinding.isPriority
                    ? 'bg-amber-500/25 text-amber-300 border-amber-400 ring-1 ring-amber-400/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
                }`}
              >
                {selectedFinding.isPriority ? '★ Prioritas 5m AKTIF' : '☆ Jadikan Prioritas 5m'}
              </button>
            )}
          </div>

          {/* Favorite Status Toggle in Map Popup */}
          <div className="mt-2 p-2 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
              <span className="text-rose-400">❤️</span>
              Filter Favorit:
            </span>
            {onToggleFavorite && (
              <button
                type="button"
                onClick={() => {
                  onToggleFavorite(selectedFinding.id);
                  setSelectedFinding((prev) => (prev ? { ...prev, isFavorite: !prev.isFavorite } : null));
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all flex items-center gap-1 ${
                  selectedFinding.isFavorite
                    ? 'bg-rose-500/25 text-rose-300 border-rose-400 ring-1 ring-rose-400/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
                }`}
              >
                <span>{selectedFinding.isFavorite ? '❤️' : '🤍'}</span>
                <span>{selectedFinding.isFavorite ? 'Favorit (Dipantau Alarm <3m)' : 'Tandai Favorit'}</span>
              </button>
            )}
          </div>

          {/* Sensor Alarm Quick Status in Map Popup */}
          <div className="mt-2.5 p-2 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
              <Radio className="w-3 h-3 text-cyan-400" />
              Sensor Alarm Titik Pusat:
            </span>
            <button
              type="button"
              onClick={() => {
                targetCenterAlarmService.toggleAlarm(
                  {
                    id: selectedFinding.id,
                    name: selectedFinding.name,
                    category: selectedFinding.category,
                    lat: selectedFinding.lat,
                    lng: selectedFinding.lng,
                    depthEstimateCm: selectedFinding.depthEstimateCm,
                  },
                  userLocation?.lat,
                  userLocation?.lng
                );
              }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all ${
                alarmState.isActive && alarmState.targetId === selectedFinding.id
                  ? 'bg-rose-500/25 text-rose-300 border-rose-500/80 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              {alarmState.isActive && alarmState.targetId === selectedFinding.id
                ? `ONLINE (${alarmState.distanceMeters.toFixed(1)}m)`
                : 'OFFLINE (Aktifkan)'}
            </button>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs font-mono text-slate-300">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>{new Date(selectedFinding.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400 truncate">
              <Compass className="w-3.5 h-3.5 text-slate-500" />
              <span>{selectedFinding.lat.toFixed(5)}, {selectedFinding.lng.toFixed(5)}</span>
            </div>
          </div>

          {selectedFinding.note && (
            <p className="mt-2 text-xs text-slate-300 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
              Catatan: {selectedFinding.note}
            </p>
          )}

          {/* Action buttons inside popup */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${selectedFinding.lat},${selectedFinding.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium font-mono shadow-md transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Navigasi Petunjuk Arah</span>
            </a>

            <button
              type="button"
              onClick={() => {
                onDeleteFinding(selectedFinding.id);
                setSelectedFinding(null);
              }}
              className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors"
              title="Hapus Temuan Ini"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Route Planner HUD Bar when Route Planner mode is active */}
      {isRoutePlannerActive && (
        <div className="absolute bottom-11 left-3 right-3 z-[430] bg-slate-900/95 backdrop-blur-xl border border-emerald-500/50 rounded-2xl p-2.5 sm:px-3.5 shadow-2xl animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-400 text-emerald-300 flex items-center justify-center font-bold">
                <Route className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-100 font-mono">
                    {calculatedRoute
                      ? `${calculatedRoute.waypoints.length} Titik Sasaran • ${(calculatedRoute.totalDistanceMeters >= 1000 ? `${(calculatedRoute.totalDistanceMeters / 1000).toFixed(2)} km` : `${calculatedRoute.totalDistanceMeters.toFixed(0)} m`)}`
                      : 'Pilih Titik di Peta'}
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                    {routeAlgorithm === 'two_opt' ? '2-Opt TSP' : routeAlgorithm === 'value_priority' ? 'Prioritas Nilai' : 'Rute Terdekat'}
                  </span>
                </div>
                {calculatedRoute && (
                  <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 mt-0.5">
                    <span>Jalan: ~{calculatedRoute.totalWalkingMinutes} mnt</span>
                    <span>•</span>
                    <span>Gali: ~{calculatedRoute.totalDiggingMinutes} mnt</span>
                    <span>•</span>
                    <span className="text-purple-300">Total: ~{calculatedRoute.totalExpeditionMinutes} mnt</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              {calculatedRoute && calculatedRoute.pathCoordinates.length > 1 && (
                <button
                  type="button"
                  onClick={fitRouteBounds}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-mono transition-all"
                  title="Pusatkan peta ke seluruh rute"
                >
                  Fokus Rute
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsRoutePlannerModalOpen(true)}
                className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white rounded-xl text-xs font-mono font-bold shadow-md transition-all active:scale-95"
              >
                <span>Detail & Jadwal</span>
                <ExternalLink className="w-3 h-3" />
              </button>

              <button
                type="button"
                onClick={() => setIsRoutePlannerActive(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Tutup Mode Route Planner"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Route Planner Full Modal */}
      <RoutePlannerModal
        isOpen={isRoutePlannerModalOpen}
        onClose={() => setIsRoutePlannerModalOpen(false)}
        findings={findings}
        userLocation={userLocation}
        selectedFindingIds={selectedRouteFindingIds}
        onToggleFindingSelection={(id) =>
          setSelectedRouteFindingIds((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
          )
        }
        onSelectAllFindings={() => setSelectedRouteFindingIds(findings.map((f) => f.id))}
        onClearSelectedFindings={() => setSelectedRouteFindingIds([])}
        onSelectValuableFindings={() =>
          setSelectedRouteFindingIds(
            findings
              .filter(
                (f) =>
                  f.category === 'gold' ||
                  f.category === 'meteorite' ||
                  f.category === 'silver'
              )
              .map((f) => f.id)
          )
        }
        activeAlgorithm={routeAlgorithm}
        onChangeAlgorithm={(algo) => setRouteAlgorithm(algo)}
        startFromUserGPS={startFromGPS}
        onToggleStartFromUserGPS={(val) => setStartFromGPS(val)}
        isRoundTrip={isRoundTripRoute}
        onToggleIsRoundTrip={(val) => setIsRoundTripRoute(val)}
        onFocusWaypointOnMap={(finding) => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([finding.lat, finding.lng], 18, { animate: true });
          }
          setSelectedFinding(finding);
        }}
      />

      {/* GPS Status Pill at bottom */}
      <div className="absolute bottom-3 left-3 z-[400] pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-full border border-slate-800 text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${
              userLocation ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span>
            {userLocation
              ? `GPS Akurat ±${Math.round(userLocation.accuracy)}m (${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)})`
              : 'Menghubungkan Sinyal Satelit GPS...'}
          </span>
        </div>
      </div>
    </div>
  );
};
