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
  Globe,
  Mountain,
  Map,
  ChevronDown,
  Moon,
  Tag,
  CircleDot,
  RotateCcw,
  Landmark,
  TrendingDown,
  AlertTriangle,
  ChevronRight,
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
import { trailService, TrailPoint } from '../services/trailService';
import { HistoricalMarkerSite } from '../types/historicalSite';
import { HISTORICAL_MARKERS_DATA } from '../data/historicalSitesData';
import { Terrain3DAnalysisModal } from './Terrain3DAnalysisModal';
import { HistoricalMarkersModal } from './HistoricalMarkersModal';
import { analyzeTerrainArea } from '../services/elevationTerrainService';

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
  onQuickPin?: () => void;
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

export type MapBaseLayerType = 'map' | 'satellite' | 'terrain' | 'opentopo' | 'dark';

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
  onQuickPin,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userAccuracyCircleRef = useRef<L.Circle | null>(null);
  const prevUserLocationRef = useRef<GPSLocation | null>(null);
  const [isAutoPanActive, setIsAutoPanActive] = useState<boolean>(true);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const heatLayerRef = useRef<L.Layer | null>(null);
  const archeologicalHotspotsLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const radiusRingsLayerRef = useRef<L.LayerGroup | null>(null);
  const safeDistanceZonesLayerRef = useRef<L.LayerGroup | null>(null);
  const trackLoggerLayerRef = useRef<L.LayerGroup | null>(null);
  const searchRadiusLayerRef = useRef<L.LayerGroup | null>(null);
  const historicalMarkersLayerRef = useRef<L.LayerGroup | null>(null);
  const slopeAnalysisLayerRef = useRef<L.LayerGroup | null>(null);
  const baseLayersRef = useRef<{ [key: string]: L.TileLayer }>({});

  const [activeLayer, setActiveLayer] = useState<MapBaseLayerType>('satellite');
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [showHillshade, setShowHillshade] = useState<boolean>(false);
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState<boolean>(false);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [showHotspotBeacons, setShowHotspotBeacons] = useState<boolean>(true);
  const [showHistoricalMarkers, setShowHistoricalMarkers] = useState<boolean>(true);
  const [showSlopeAnalysis, setShowSlopeAnalysis] = useState<boolean>(false);
  const [isTerrain3DModalOpen, setIsTerrain3DModalOpen] = useState<boolean>(false);
  const [isHistoricalMarkersModalOpen, setIsHistoricalMarkersModalOpen] = useState<boolean>(false);
  const [terrain3DCenter, setTerrain3DCenter] = useState<{ lat: number; lng: number; title: string }>({
    lat: -7.5583,
    lng: 112.3811,
    title: 'Kawasan Ibukota Majapahit Trowulan',
  });
  const [currentSlopeInfo, setCurrentSlopeInfo] = useState<{
    slope: number;
    elev: number;
    dangerLevel: 'SAFE' | 'MODERATE' | 'STEEP' | 'EXTREME';
  } | null>(null);
  const [isHeatmapSettingsOpen, setIsHeatmapSettingsOpen] = useState<boolean>(false);
  const [showRadiusRings, setShowRadiusRings] = useState<boolean>(true);
  const [showPins, setShowPins] = useState<boolean>(true);
  const [heatRadius, setHeatRadius] = useState<number>(35);
  const [selectedCategory, setSelectedCategory] = useState<MetalCategory | 'all' | 'favorite'>('all');
  const [showFilterBar, setShowFilterBar] = useState<boolean>(true);
  const [selectedFinding, setSelectedFinding] = useState<MetalFinding | null>(null);

  // Search Radius State (Dynamic coverage area: 10m, 25m, 50m, 100m, 250m)
  const [searchRadius, setSearchRadius] = useState<'all' | 10 | 25 | 50 | 100 | 250>('all');
  const [isSearchRadiusMenuOpen, setIsSearchRadiusMenuOpen] = useState<boolean>(false);

  // Track Logger States (GPS movement trail recording)
  const [showTrackLog, setShowTrackLog] = useState<boolean>(true);
  const [trailPoints, setTrailPoints] = useState<TrailPoint[]>(() => trailService.getPoints());

  // Marker Animation Preference: 'drop_pulse' (Drop and Pulse), 'pulse', 'drop', or 'none'
  const [markerAnimation, setMarkerAnimation] = useState<'drop_pulse' | 'pulse' | 'drop' | 'none'>('drop_pulse');

  // Safe Distance Alarm States (< 3m radius for Favorite Findings)
  const [isSafeAlarmEnabled, setIsSafeAlarmEnabled] = useState<boolean>(true);
  const [isSafeAlarmMuted, setIsSafeAlarmMuted] = useState<boolean>(false);
  const [activeNearbyFinding, setActiveNearbyFinding] = useState<{
    finding: MetalFinding;
    distanceMeters: number;
    timestamp: number;
  } | null>(null);
  const [dismissedNearbyFindingId, setDismissedNearbyFindingId] = useState<string | null>(null);
  const dismissedNearbyFindingIdRef = useRef<string | null>(null);
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
        const allIds = findings.map((f) => f.id);
        if (
          prev.length === allIds.length &&
          prev.every((id, idx) => id === allIds[idx])
        ) {
          return prev;
        }
        return allIds;
      }
      if (
        prev.length === kept.length &&
        prev.every((id, idx) => id === kept[idx])
      ) {
        return prev;
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

  // Subscribe to real-time Track Logger GPS trail points
  useEffect(() => {
    const unsub = trailService.subscribe((pts) => {
      setTrailPoints(pts);
    });
    return () => unsub();
  }, []);

  // Real-time counts of findings within each search radius
  const radiusCounts = useMemo(() => {
    if (!userLocation) return { 10: 0, 25: 0, 50: 0, 100: 0, 250: 0 };
    const counts = { 10: 0, 25: 0, 50: 0, 100: 0, 250: 0 };
    findings.forEach((f) => {
      const d = calculateDistanceMeters(userLocation.lat, userLocation.lng, f.lat, f.lng);
      if (d <= 10) counts[10]++;
      if (d <= 25) counts[25]++;
      if (d <= 50) counts[50]++;
      if (d <= 100) counts[100]++;
      if (d <= 250) counts[250]++;
    });
    return counts;
  }, [findings, userLocation?.lat, userLocation?.lng]);

  // Filtered findings based on selected category or favorite AND searchRadius
  const filteredFindings = useMemo(() => {
    let list = findings;
    if (selectedCategory === 'favorite') {
      list = list.filter((f) => f.isFavorite === true);
    } else if (selectedCategory !== 'all') {
      list = list.filter((f) => f.category === selectedCategory);
    }

    // Dynamic Search Radius filter around user GPS position
    if (searchRadius !== 'all' && userLocation) {
      list = list.filter((f) => {
        const d = calculateDistanceMeters(userLocation.lat, userLocation.lng, f.lat, f.lng);
        return d <= searchRadius;
      });
    }

    return list;
  }, [findings, selectedCategory, searchRadius, userLocation?.lat, userLocation?.lng]);

  // Archaeological Hotspot Clusters (Area Konsentrasi Temuan Logam Tinggi di Lapangan)
  const archeologicalHotspots = useMemo(() => {
    if (filteredFindings.length === 0) return [];

    const clusters: {
      id: string;
      lat: number;
      lng: number;
      findings: MetalFinding[];
      count: number;
      peakFlux: number;
      avgFlux: number;
      avgDepthCm: number;
      dominantCategory: MetalCategory;
      significance: 'KRITIS_TINGGI' | 'TINGGI' | 'SEDANG';
      title: string;
    }[] = [];

    const visitedIds = new Set<string>();

    filteredFindings.forEach((finding) => {
      if (visitedIds.has(finding.id)) return;

      // Group nearby findings within 35 meters radius
      const clusterMembers = filteredFindings.filter((other) => {
        const dist = calculateDistanceMeters(finding.lat, finding.lng, other.lat, other.lng);
        return dist <= 35;
      });

      clusterMembers.forEach((m) => visitedIds.add(m.id));

      const count = clusterMembers.length;
      const peakFinding = clusterMembers.reduce(
        (max, curr) => (curr.magneticStrength > max.magneticStrength ? curr : max),
        clusterMembers[0]
      );
      const totalFlux = clusterMembers.reduce((acc, curr) => acc + curr.magneticStrength, 0);
      const avgFlux = Number((totalFlux / count).toFixed(1));
      const totalDepth = clusterMembers.reduce(
        (acc, curr) => acc + (curr.depthEstimateCm || 15),
        0
      );
      const avgDepthCm = Math.round(totalDepth / count);

      // Dominant metal category in this cluster
      const catCount: Record<string, number> = {};
      clusterMembers.forEach((m) => {
        catCount[m.category] = (catCount[m.category] || 0) + 1;
      });
      let dominantCategory: MetalCategory = finding.category;
      let maxCatCount = 0;
      Object.entries(catCount).forEach(([cat, cnt]) => {
        if (cnt > maxCatCount) {
          maxCatCount = cnt;
          dominantCategory = cat as MetalCategory;
        }
      });

      const significance =
        count >= 3 || peakFinding.magneticStrength >= 140
          ? 'KRITIS_TINGGI'
          : count >= 2 || peakFinding.magneticStrength >= 105
          ? 'TINGGI'
          : 'SEDANG';

      const catLabel =
        dominantCategory === 'gold'
          ? 'Emas & Mulia'
          : dominantCategory === 'meteorite'
          ? 'Meteorit & Aerolit'
          : dominantCategory === 'bronze'
          ? 'Perunggu Kuno'
          : dominantCategory === 'silver'
          ? 'Perak Murni'
          : 'Ferrous Relik';

      // An archeological hotspot is detected when there is a cluster of >= 2 findings OR high magnetic anomaly >= 105 uT
      if (count >= 2 || peakFinding.magneticStrength >= 105) {
        clusters.push({
          id: `hotspot-${finding.id}`,
          lat: peakFinding.lat,
          lng: peakFinding.lng,
          findings: clusterMembers,
          count,
          peakFlux: peakFinding.magneticStrength,
          avgFlux,
          avgDepthCm,
          dominantCategory,
          significance,
          title: `Hotspot ${catLabel} (${count} Temuan)`,
        });
      }
    });

    return clusters;
  }, [filteredFindings]);

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

    // Define Tile Layers & Overlays
    const mapTileLayer = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: 'CartoDB Voyager',
      }
    );

    const darkTileLayer = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: 'CartoDB Dark',
      }
    );

    const satelliteTileLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Esri World Imagery',
      }
    );

    const terrainTileLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Esri World Topo Map',
      }
    );

    const openTopoTileLayer = L.tileLayer(
      'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 17,
        subdomains: 'abc',
        attribution: 'OpenTopoMap',
      }
    );

    const labelsOverlay = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        pane: 'overlayPane',
      }
    );

    const hillshadeOverlay = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        opacity: 0.45,
        pane: 'overlayPane',
      }
    );

    baseLayersRef.current = {
      map: mapTileLayer,
      dark: darkTileLayer,
      satellite: satelliteTileLayer,
      terrain: terrainTileLayer,
      opentopo: openTopoTileLayer,
      labels: labelsOverlay,
      hillshade: hillshadeOverlay,
    };

    const initialBaseLayer = baseLayersRef.current[activeLayer] || satelliteTileLayer;
    initialBaseLayer.addTo(map);

    if (showLabels && labelsOverlay) {
      labelsOverlay.addTo(map);
    }
    if (showHillshade && hillshadeOverlay) {
      hillshadeOverlay.addTo(map);
    }

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;

    // Pause auto-panning when user manually drags/explores the map
    map.on('dragstart', () => {
      setIsAutoPanActive(false);
    });

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

  // Update Base Layer & Overlays (Map, Satellite, Terrain, OpenTopo, Dark, Labels, Hillshade)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !baseLayersRef.current) return;

    const { map: mapBase, dark, satellite, terrain, opentopo, labels, hillshade } = baseLayersRef.current;
    const baseLayers = [mapBase, dark, satellite, terrain, opentopo];

    // Remove inactive base layers
    baseLayers.forEach((layer) => {
      if (layer && map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    });

    // Add active base layer
    const targetLayer = baseLayersRef.current[activeLayer];
    if (targetLayer && !map.hasLayer(targetLayer)) {
      map.addLayer(targetLayer);
    }

    // Toggle Labels overlay
    if (labels) {
      if (showLabels && !map.hasLayer(labels)) {
        map.addLayer(labels);
      } else if (!showLabels && map.hasLayer(labels)) {
        map.removeLayer(labels);
      }
    }

    // Toggle Hillshade overlay
    if (hillshade) {
      if (showHillshade && !map.hasLayer(hillshade)) {
        map.addLayer(hillshade);
      } else if (!showHillshade && map.hasLayer(hillshade)) {
        map.removeLayer(hillshade);
      }
    }
  }, [activeLayer, showLabels, showHillshade]);

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

    const prevLocation = prevUserLocationRef.current;

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker(userLatLng, { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
      map.setView(userLatLng, Math.max(16, map.getZoom()));
    } else {
      userMarkerRef.current.setLatLng(userLatLng);

      // Smooth panning animation when user moves/changes location
      if (isAutoPanActive && prevLocation) {
        const distMoved = calculateDistanceMeters(
          prevLocation.lat,
          prevLocation.lng,
          userLocation.lat,
          userLocation.lng
        );
        // If moved at least 0.5m, smoothly pan map to the new position instead of instantly jumping
        if (distMoved >= 0.5) {
          map.panTo(userLatLng, {
            animate: true,
            duration: 1.5, // 1.5s gentle gliding pan
            easeLinearity: 0.25,
            noMoveStart: false,
          });
        }
      }
    }

    prevUserLocationRef.current = userLocation;

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
  }, [userLocation, isAutoPanActive]);

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
        setActiveNearbyFinding((prev) => (prev === null ? null : null));
      }
      return;
    }

    if (isAlarmTestSimulated) return;

    if (favoriteFindings.length === 0) {
      setActiveNearbyFinding((prev) => (prev === null ? null : null));
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
      const dist = Number(closestTarget.distance.toFixed(1));
      const now = Date.now();
      const lastTriggered = lastAlarmTriggerTimeRef.current[targetId] || 0;

      setActiveNearbyFinding((prev) => {
        if (
          prev &&
          prev.finding.id === targetId &&
          Math.abs(prev.distanceMeters - dist) < 0.2
        ) {
          return prev;
        }
        return {
          finding: closestTarget.finding,
          distanceMeters: dist,
          timestamp: now,
        };
      });

      // Fire audio alarm and vibration if not dismissed and debounce passed (> 10s)
      if (dismissedNearbyFindingIdRef.current !== targetId && now - lastTriggered > 10000) {
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
      setActiveNearbyFinding((prev) => (prev === null ? null : null));
      if (dismissedNearbyFindingIdRef.current) {
        dismissedNearbyFindingIdRef.current = null;
        setDismissedNearbyFindingId(null);
      }
    }
  }, [
    userLocation?.lat,
    userLocation?.lng,
    favoriteFindings,
    isSafeAlarmEnabled,
    isSafeAlarmMuted,
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
  }, [favoriteFindings, isSafeAlarmEnabled, activeNearbyFinding?.finding.id]);

  // Quick test simulation for Safe Distance Alarm (< 3m)
  const handleTestSafeAlarm = () => {
    setIsAlarmTestSimulated(true);
    dismissedNearbyFindingIdRef.current = null;
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

  // Render Track Logger (GPS movement trail polyline) on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (trackLoggerLayerRef.current) {
      map.removeLayer(trackLoggerLayerRef.current);
      trackLoggerLayerRef.current = null;
    }

    if (!showTrackLog || trailPoints.length === 0) return;

    const trackGroup = L.layerGroup();
    const coords: [number, number][] = trailPoints.map((p) => [p.lat, p.lng]);

    if (coords.length > 1) {
      // Outer ambient glowing polyline
      const glowTrack = L.polyline(coords, {
        color: '#10b981',
        weight: 6,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round',
      });
      glowTrack.addTo(trackGroup);

      // Inner distinct tracking polyline
      const innerTrack = L.polyline(coords, {
        color: '#06b6d4',
        weight: 2.5,
        dashArray: '5, 5',
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      });
      innerTrack.addTo(trackGroup);

      // Start Marker
      const startPt = trailPoints[0];
      const startMarker = L.circleMarker([startPt.lat, startPt.lng], {
        radius: 5,
        color: '#10b981',
        fillColor: '#ffffff',
        fillOpacity: 1,
        weight: 2,
      });
      startMarker.bindTooltip('🚩 Titik Awal Jejak Pencarian', { direction: 'top' });
      startMarker.addTo(trackGroup);

      // Magnetic anomaly breadcrumb dots along the trail
      trailPoints.forEach((pt, index) => {
        if (pt.isAnomaly && index > 0 && index < trailPoints.length - 1) {
          const anomalyMarker = L.circleMarker([pt.lat, pt.lng], {
            radius: 4,
            color: '#f59e0b',
            fillColor: '#fbbf24',
            fillOpacity: 0.8,
            weight: 1.5,
          });
          anomalyMarker.bindTooltip(
            `⚡ Anomali Magnetik: ${pt.magneticStrength} µT (+${pt.netStrength} µT)`,
            { direction: 'top' }
          );
          anomalyMarker.addTo(trackGroup);
        }
      });
    }

    trackGroup.addTo(map);
    trackLoggerLayerRef.current = trackGroup;

    return () => {
      if (trackLoggerLayerRef.current) {
        map.removeLayer(trackLoggerLayerRef.current);
        trackLoggerLayerRef.current = null;
      }
    };
  }, [showTrackLog, trailPoints]);

  // Render Search Radius Circle on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (searchRadiusLayerRef.current) {
      map.removeLayer(searchRadiusLayerRef.current);
      searchRadiusLayerRef.current = null;
    }

    if (searchRadius === 'all' || !userLocation) return;

    const radiusGroup = L.layerGroup();

    // 1. Interactive Pulsing Search Radius Circle
    const radiusCircle = L.circle([userLocation.lat, userLocation.lng], {
      radius: searchRadius,
      color: '#06b6d4',
      weight: 2,
      dashArray: '6, 6',
      fillColor: '#06b6d4',
      fillOpacity: 0.08,
      interactive: false,
    });
    radiusCircle.addTo(radiusGroup);

    // 2. Search Radius Perimeter Badge Label
    const deltaLat = searchRadius / 111320;
    const badgeMarker = L.marker([userLocation.lat + deltaLat, userLocation.lng], {
      icon: L.divIcon({
        className: 'search-radius-badge',
        html: `
          <div style="transform: translate(-50%, -100%); background: rgba(8, 51, 68, 0.95); color: #67e8f9; border: 1.5px solid #22d3ee; border-radius: 9999px; padding: 2px 8px; font-size: 9px; font-weight: bold; font-family: monospace; white-space: nowrap; box-shadow: 0 2px 10px rgba(0,0,0,0.6); pointer-events: none; display: flex; align-items: center; gap: 4px;">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 9999px; background: #22d3ee;"></span>
            <span>Jangkauan Radius ${searchRadius}m (${filteredFindings.length} Titik)</span>
          </div>
        `,
        iconSize: [0, 0],
      }),
      interactive: false,
    });
    badgeMarker.addTo(radiusGroup);

    radiusGroup.addTo(map);
    searchRadiusLayerRef.current = radiusGroup;

    return () => {
      if (searchRadiusLayerRef.current) {
        map.removeLayer(searchRadiusLayerRef.current);
        searchRadiusLayerRef.current = null;
      }
    };
  }, [searchRadius, userLocation?.lat, userLocation?.lng, filteredFindings.length]);

  // Render Historical Markers on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (historicalMarkersLayerRef.current) {
      map.removeLayer(historicalMarkersLayerRef.current);
      historicalMarkersLayerRef.current = null;
    }

    if (!showHistoricalMarkers) return;

    const group = L.layerGroup();

    HISTORICAL_MARKERS_DATA.forEach((site) => {
      const iconHtml = `
        <div class="historical-marker-node" style="position: relative; width: 44px; height: 50px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.25s;" onmouseover="this.style.transform='scale(1.2) translateY(-4px)'" onmouseout="this.style.transform='scale(1) translateY(0)'">
          <!-- Pulse Halo -->
          <div class="hotspot-pulse-ring-elem" style="position: absolute; top: 2px; width: 38px; height: 38px; border-radius: 9999px; border: 2px solid #f59e0b; pointer-events: none; opacity: 0.85;"></div>
          
          <!-- Pedestal Monument Icon -->
          <div style="position: relative; z-index: 3; width: 34px; height: 34px; border-radius: 12px; background: linear-gradient(135deg, #78350f 0%, #d97706 50%, #f59e0b 100%); border: 2px solid #fef08a; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,0,0,0.8), 0 0 16px rgba(245, 158, 11, 0.6); color: #fff; font-size: 17px;">
            🏛️
          </div>

          <!-- Potential Badge -->
          <div style="position: absolute; top: -10px; z-index: 5; background: #92400e; color: #fef08a; font-size: 8px; font-weight: 900; font-family: monospace; padding: 1px 5px; border-radius: 9999px; border: 1px solid #fef08a; box-shadow: 0 2px 6px rgba(0,0,0,0.7); white-space: nowrap;">
            ★ ${site.artifactPotentialScore}% RELIK
          </div>

          <!-- Stem Arrow -->
          <div style="position: absolute; bottom: 4px; width: 8px; height: 8px; background: #78350f; transform: rotate(45deg); z-index: 2; border-right: 1.5px solid #fef08a; border-bottom: 1.5px solid #fef08a;"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'historical-site-marker',
        html: iconHtml,
        iconSize: [44, 50],
        iconAnchor: [22, 46],
      });

      const marker = L.marker([site.lat, site.lng], { icon: customIcon });

      const popupContent = document.createElement('div');
      popupContent.style.minWidth = '230px';
      popupContent.style.maxWidth = '280px';
      popupContent.style.fontFamily = 'monospace';
      popupContent.style.color = '#f1f5f9';
      popupContent.style.fontSize = '11px';
      popupContent.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 5px;">
          <span style="font-size: 9px; font-weight: bold; background: rgba(245, 158, 11, 0.2); color: #fcd34d; border: 1px solid rgba(245, 158, 11, 0.4); padding: 1px 6px; border-radius: 9999px;">
            ${site.era}
          </span>
          <span style="font-size: 9px; color: #38bdf8; font-weight: bold;">
            ★ ${site.artifactPotentialScore}% Potensi Relik
          </span>
        </div>
        <h4 style="font-size: 13px; font-weight: bold; color: #fff; margin: 0 0 2px 0;">${site.name}</h4>
        <div style="font-size: 10px; color: #94a3b8; margin-bottom: 6px;">📍 ${site.region} • ${site.elevationMeters} mdpl (Lereng ~${site.averageSlopeDegrees ?? 5}°)</div>
        <p style="font-size: 10px; color: #cbd5e1; line-height: 1.35; margin: 0 0 6px 0; font-family: sans-serif;">${site.description}</p>
        <div style="font-size: 9px; color: #fde68a; margin-bottom: 8px;"><strong>Potensi Artefak:</strong> ${site.knownArtifactTypes.slice(0, 3).join(', ')}</div>
        <div style="font-size: 8px; color: #64748b; margin-bottom: 8px;">Sumber: ${site.openDatabaseSource} (${site.openDatabaseId})</div>
        <div style="display: flex; gap: 6px;">
          <button id="btn-hist-3d-${site.id}" style="flex: 1; padding: 6px 8px; background: #059669; color: #fff; border: none; border-radius: 8px; font-size: 10px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
            ⛰️ Medan 3D
          </button>
          <a href="https://www.google.com/maps/dir/?api=1&destination=${site.lat},${site.lng}" target="_blank" rel="noopener noreferrer" style="flex: 1; text-align: center; text-decoration: none; padding: 6px 8px; background: #0284c7; color: #fff; border-radius: 8px; font-size: 10px; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 4px;">
            🧭 Rute Arah
          </a>
        </div>
      `;

      marker.bindPopup(popupContent, { maxWidth: 300, className: 'historical-marker-popup' });

      marker.on('popupopen', () => {
        const btn3D = document.getElementById(`btn-hist-3d-${site.id}`);
        if (btn3D) {
          btn3D.onclick = () => {
            setTerrain3DCenter({
              lat: site.lat,
              lng: site.lng,
              title: site.name,
            });
            setIsTerrain3DModalOpen(true);
          };
        }
      });

      marker.addTo(group);
    });

    group.addTo(map);
    historicalMarkersLayerRef.current = group;

    return () => {
      if (historicalMarkersLayerRef.current) {
        map.removeLayer(historicalMarkersLayerRef.current);
        historicalMarkersLayerRef.current = null;
      }
    };
  }, [showHistoricalMarkers]);

  // Render Slope Danger Analysis Overlay on Leaflet Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (slopeAnalysisLayerRef.current) {
      map.removeLayer(slopeAnalysisLayerRef.current);
      slopeAnalysisLayerRef.current = null;
    }

    if (!showSlopeAnalysis) {
      setCurrentSlopeInfo(null);
      return;
    }

    let isMounted = true;
    const centerLat = userLocation?.lat || map.getCenter().lat;
    const centerLng = userLocation?.lng || map.getCenter().lng;

    analyzeTerrainArea(centerLat, centerLng, 120, 11).then((res) => {
      if (!isMounted || !mapInstanceRef.current) return;

      const group = L.layerGroup();

      // Render colored slope circle zones
      res.points.forEach((pt) => {
        const color =
          pt.slopeDegrees < 10
            ? '#10b981'
            : pt.slopeDegrees < 20
            ? '#eab308'
            : pt.slopeDegrees < 30
            ? '#f97316'
            : '#ef4444';

        const circle = L.circle([pt.lat, pt.lng], {
          radius: 11,
          color: color,
          weight: 1.5,
          fillColor: color,
          fillOpacity: pt.isDanger ? 0.38 : 0.22,
        });

        circle.bindTooltip(
          `⛰️ Elev: ${pt.elevation}m • Kemiringan: ${pt.slopeDegrees}° (${pt.slopeCategory === 'EXTREME_DANGER' ? 'BAHAYA JURANG' : pt.slopeCategory === 'STEEP' ? 'CURAM' : pt.slopeCategory === 'MODERATE' ? 'SEDANG' : 'AMAN'})`,
          { direction: 'top', className: 'slope-tooltip' }
        );

        circle.addTo(group);
      });

      // Update current slope info
      const dangerLevel =
        res.maxSlope >= 30
          ? 'EXTREME'
          : res.maxSlope >= 20
          ? 'STEEP'
          : res.maxSlope >= 10
          ? 'MODERATE'
          : 'SAFE';

      setCurrentSlopeInfo({
        slope: res.centerPointSlope,
        elev: res.centerElevation,
        dangerLevel,
      });

      group.addTo(map);
      slopeAnalysisLayerRef.current = group;
    });

    return () => {
      isMounted = false;
      if (slopeAnalysisLayerRef.current) {
        map.removeLayer(slopeAnalysisLayerRef.current);
        slopeAnalysisLayerRef.current = null;
      }
    };
  }, [showSlopeAnalysis, userLocation?.lat, userLocation?.lng]);

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

    // Remove existing archeological hotspots layer if any
    if (archeologicalHotspotsLayerRef.current) {
      map.removeLayer(archeologicalHotspotsLayerRef.current);
      archeologicalHotspotsLayerRef.current = null;
    }

    // 1. Generate Heatmap Thermal Anomaly Layer from filtered findings
    // Weight calculation: Normalized by magneticStrength & net anomaly
    if (showHeatmap && filteredFindings.length > 0) {
      const heatPoints: [number, number, number][] = filteredFindings.map((f) => {
        // Higher intensity for stronger magnetic anomaly
        const intensity = Math.min(1.0, Math.max(0.25, f.magneticStrength / 130));
        return [f.lat, f.lng, intensity];
      });

      // Gradient color configuration: Cold (cyan/blue) -> Moderate (emerald/lime) -> Warm (yellow/gold) -> Hot intense (orange) -> Deep Red Core
      if (typeof (L as any).heatLayer === 'function') {
        const heat = (L as any).heatLayer(heatPoints, {
          radius: heatRadius,
          blur: Math.round(heatRadius * 0.72),
          maxZoom: 18,
          max: 1.0,
          minOpacity: 0.28,
          gradient: {
            0.15: '#06b6d4', // Cyan (low anomaly)
            0.35: '#10b981', // Emerald
            0.55: '#eab308', // Gold / Amber
            0.75: '#f97316', // Orange
            1.0: '#ef4444', // Red-hot intense core
          },
        });

        heat.addTo(map);
        heatLayerRef.current = heat;
      }

      // 1b. Render Archeological Hotspot Concentration Zones & Beacons
      if (showHotspotBeacons && archeologicalHotspots.length > 0) {
        const hotspotGroup = L.layerGroup();

        archeologicalHotspots.forEach((hotspot) => {
          const zoneColor =
            hotspot.significance === 'KRITIS_TINGGI'
              ? '#ef4444'
              : hotspot.significance === 'TINGGI'
              ? '#f97316'
              : '#f59e0b';

          // Concentration radius circle (18m - 28m)
          const concentrationCircle = L.circle([hotspot.lat, hotspot.lng], {
            radius: Math.min(28, Math.max(16, hotspot.count * 6.5)),
            color: zoneColor,
            weight: 2,
            dashArray: '4, 4',
            fillColor: zoneColor,
            fillOpacity: 0.16,
            interactive: false,
          });
          hotspotGroup.addLayer(concentrationCircle);

          // Animated Hotspot Beacon Marker
          const beaconIcon = L.divIcon({
            className: 'archeological-hotspot-beacon',
            html: `
              <div style="position: relative; width: 48px; height: 52px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.25s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">
                <!-- Dual Radiating Flame Pulse Rings -->
                <div class="hotspot-pulse-ring-elem" style="position: absolute; width: 44px; height: 44px; border-radius: 9999px; border: 2.5px solid ${zoneColor}; pointer-events: none; opacity: 0.95;"></div>
                <div class="hotspot-pulse-ring-elem" style="position: absolute; width: 44px; height: 44px; border-radius: 9999px; border: 1.5px solid #fbbf24; pointer-events: none; animation-delay: 1.1s; opacity: 0.75;"></div>

                <!-- Top Badge Pill -->
                <div style="position: absolute; top: -14px; left: 50%; transform: translateX(-50%); z-index: 10; background: linear-gradient(90deg, #b91c1c, #ea580c); color: #fff; font-size: 8px; font-weight: 900; font-family: monospace; padding: 1px 6px; border-radius: 9999px; border: 1px solid #fca5a5; box-shadow: 0 2px 8px rgba(185,28,28,0.7); white-space: nowrap; letter-spacing: 0.4px; display: flex; align-items: center; gap: 3px;">
                  <span style="color: #fef08a;">🔥</span>
                  <span>HOTSPOT</span>
                </div>

                <!-- Flaming Core Body -->
                <div style="position: relative; z-index: 3; width: 34px; height: 34px; border-radius: 9999px; background: radial-gradient(circle, #fef08a 0%, #f97316 50%, #991b1b 100%); border: 2.5px solid #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 16px rgba(249,115,22,0.9), 0 4px 12px rgba(0,0,0,0.8);">
                  <span style="font-size: 15px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.8));">🔥</span>
                </div>

                <!-- Bottom Intensity Label -->
                <div style="position: absolute; bottom: -12px; left: 50%; transform: translateX(-50%); z-index: 10; background: #020617; color: #fdba74; font-size: 7.5px; font-weight: bold; font-family: monospace; padding: 0.5px 4px; border-radius: 4px; border: 1px solid #c2410c; white-space: nowrap;">
                  ${hotspot.count} Titik • ${hotspot.peakFlux.toFixed(0)}µT
                </div>
              </div>
            `,
            iconSize: [48, 52],
            iconAnchor: [24, 26],
          });

          const beaconMarker = L.marker([hotspot.lat, hotspot.lng], {
            icon: beaconIcon,
            zIndexOffset: 850,
          });

          beaconMarker.bindPopup(`
            <div style="font-family: ui-sans-serif, system-ui, sans-serif; color: #f1f5f9; min-width: 210px; max-width: 250px; padding: 2px;">
              <div style="display: flex; align-items: center; gap: 6px; border-bottom: 1px solid #334155; padding-bottom: 6px; margin-bottom: 6px;">
                <span style="font-size: 16px;">🏛️</span>
                <div>
                  <div style="font-weight: 800; font-size: 12px; color: #f97316; font-family: monospace;">HOTSPOT ARKEOLOGIS</div>
                  <div style="font-size: 10px; color: #94a3b8;">${hotspot.title}</div>
                </div>
              </div>
              <div style="font-size: 11px; space-y: 4px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                  <span style="color: #94a3b8;">Kepadatan:</span>
                  <strong style="color: #67e8f9;">${hotspot.count} Temuan Berdekatan</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                  <span style="color: #94a3b8;">Fluks Puncak:</span>
                  <strong style="color: #f59e0b;">${hotspot.peakFlux.toFixed(1)} µT</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                  <span style="color: #94a3b8;">Rata-rata Kedalaman:</span>
                  <strong style="color: #cbd5e1;">~${hotspot.avgDepthCm} cm</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                  <span style="color: #94a3b8;">Status Sektor:</span>
                  <span style="color: #f87171; font-weight: bold; font-family: monospace; font-size: 10px;">${hotspot.significance.replace('_', ' ')}</span>
                </div>
              </div>
              <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid #334155; border-radius: 8px; padding: 6px; font-size: 10px; color: #cbd5e1; line-height: 1.35; margin-bottom: 6px;">
                🔍 <strong>Rekomendasi Lapangan:</strong> Konsentrasi anomali tinggi mengindikasikan akumulasi logam padat atau sisa struktur artefak kuno. Lakukan pemindaian kisi-kisi (grid) secara teliti.
              </div>
            </div>
          `);

          hotspotGroup.addLayer(beaconMarker);
        });

        hotspotGroup.addTo(map);
        archeologicalHotspotsLayerRef.current = hotspotGroup;
      }
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
        } else if (
          finding.isFavorite ||
          finding.name.toLowerCase().includes('titik pantau') ||
          finding.name.toLowerCase().includes('pantau') ||
          finding.note?.toLowerCase().includes('titik pantau')
        ) {
          // Distinctive 'Titik Pantau Favorit' Waypoint Beacon Marker (Rotated diamond shield with ruby-rose & gold styling)
          const isSelected = selectedFinding?.id === finding.id;
          const shouldDrop = markerAnimation === 'drop_pulse' || markerAnimation === 'drop';
          const dropClass = shouldDrop ? 'marker-drop-anim' : '';

          customIcon = L.divIcon({
            className: 'favorite-waypoint-marker',
            html: `
              <div class="${dropClass}" style="position: relative; width: 44px; height: 50px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.25s;" onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform='scale(1)'">
                <!-- Dual Radiant Pulsing Beacon Radar Rings for Favorite Watchpoint -->
                <div class="fav-waypoint-pulse-ring" style="position: absolute; width: 42px; height: 42px; border-radius: 9999px; border: 2.5px solid #f43f5e; pointer-events: none; opacity: 0.95;"></div>
                <div class="fav-waypoint-pulse-ring" style="position: absolute; width: 42px; height: 42px; border-radius: 9999px; border: 1.5px solid #fb7185; pointer-events: none; animation-delay: 1.1s; opacity: 0.75;"></div>

                <!-- Top Badge Pill -->
                <div style="position: absolute; top: -14px; left: 50%; transform: translateX(-50%); z-index: 10; background: linear-gradient(90deg, #e11d48, #be123c); color: #fff; font-size: 8px; font-weight: 900; font-family: monospace; padding: 1.5px 6px; border-radius: 9999px; border: 1.5px solid #fecdd3; box-shadow: 0 2px 8px rgba(225,29,72,0.7); white-space: nowrap; letter-spacing: 0.5px; display: flex; align-items: center; gap: 3px;">
                  <span style="color: #fef08a;">★</span>
                  <span>PANTAU</span>
                </div>

                <!-- Rotated Diamond Shield Beacon Body -->
                <div style="position: relative; z-index: 3; width: 32px; height: 32px; border-radius: 10px; transform: rotate(45deg); background: linear-gradient(135deg, #f43f5e 0%, #e11d48 55%, #881337 100%); border: 2.5px solid #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 16px rgba(244, 63, 94, 0.9), 0 5px 15px rgba(0,0,0,0.8);">
                  <div style="transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; font-size: 15px; filter: drop-shadow(0 1px 3px rgba(0,0,0,0.7));">
                    💖
                  </div>
                </div>

                <!-- Diamond Pointer Stem -->
                <div style="position: absolute; bottom: 2px; width: 9px; height: 9px; background: #881337; transform: rotate(45deg); z-index: 2; border-right: 1.5px solid #ffffff; border-bottom: 1.5px solid #ffffff;"></div>
              </div>
            `,
            iconSize: [44, 50],
            iconAnchor: [22, 44],
          });
        } else {
          // Standard pin marker with Drop and Pulse animations
          const isRecent = Date.now() - finding.timestamp < 1000 * 60 * 15; // Logged within 15 mins
          const isSelected = selectedFinding?.id === finding.id;
          const shouldDrop = markerAnimation === 'drop_pulse' || markerAnimation === 'drop';
          const shouldPulse =
            (markerAnimation === 'drop_pulse' || markerAnimation === 'pulse') &&
            (isRecent || finding.isPriority || isSelected);

          const dropClass = shouldDrop ? 'marker-drop-anim' : '';

          customIcon = L.divIcon({
            className: 'finding-pin-marker',
            html: `
              <div class="${dropClass}" style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">
                ${
                  shouldPulse
                    ? `
                      <div class="marker-pulse-ring-elem" style="position: absolute; width: 38px; height: 38px; border-radius: 9999px; border: 2.5px solid ${pinColor}; pointer-events: none; opacity: 0.9;"></div>
                      <div class="marker-pulse-ring-elem" style="position: absolute; width: 38px; height: 38px; border-radius: 9999px; border: 1.5px solid ${pinColor}; pointer-events: none; animation-delay: 0.8s; opacity: 0.7;"></div>
                    `
                    : ''
                }
                <div style="position: relative; z-index: 2; width: 28px; height: 28px; border-radius: 9999px; background: ${pinColor}; border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; color: #000; font-weight: bold; font-size: 13px; box-shadow: 0 4px 14px rgba(0,0,0,0.6);">
                  ${symbol}
                </div>
                ${isRecent ? '<div style="position: absolute; top: -14px; left: 50%; transform: translateX(-50%); z-index: 5; background: #06b6d4; color: #020617; font-size: 8px; font-weight: 900; font-family: monospace; padding: 1px 5px; border-radius: 4px; border: 1px solid #ffffff; box-shadow: 0 1px 4px rgba(0,0,0,0.6); white-space: nowrap;">BARU</div>' : ''}
                ${finding.isPriority ? '<div style="position: absolute; top: -5px; right: -5px; z-index: 4; background: #f59e0b; color: #000; font-size: 10px; width: 16px; height: 16px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-weight: 900; border: 1.5px solid #fff; box-shadow: 0 0 8px #f59e0b;">★</div>' : ''}
                ${finding.isFavorite ? '<div style="position: absolute; top: -5px; left: -5px; z-index: 4; background: #e11d48; color: #fff; font-size: 10px; width: 17px; height: 17px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-weight: 900; border: 1.5px solid #fff; box-shadow: 0 0 8px #e11d48;">❤️</div>' : ''}
                <div style="position: absolute; bottom: 0px; width: 6px; height: 6px; background: ${pinColor}; transform: rotate(45deg); z-index: 1;"></div>
              </div>
            `,
            iconSize: [36, 36],
            iconAnchor: [18, 30],
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
    archeologicalHotspots,
    onSelectFinding,
    showHeatmap,
    showHotspotBeacons,
    showPins,
    heatRadius,
    isRoutePlannerActive,
    selectedRouteFindingIds,
    calculatedRoute,
    markerAnimation,
    selectedFinding?.id,
  ]);

  const centerOnUser = () => {
    if (!mapInstanceRef.current || !userLocation) return;
    setIsAutoPanActive(true);
    mapInstanceRef.current.panTo([userLocation.lat, userLocation.lng], {
      animate: true,
      duration: 1.5,
      easeLinearity: 0.25,
    });
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

          {/* Heatmap & Archeological Hotspot Toggle Button */}
          <button
            type="button"
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-mono shadow-lg active:scale-95 transition-all shrink-0 ${
              showHeatmap
                ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 border-amber-300 text-white shadow-amber-950/70 font-bold'
                : 'bg-slate-900/90 border-slate-700/80 text-slate-400 hover:text-slate-200'
            }`}
            title="Heatmap: Visualisasi kerapatan dan anomali konsentrasi logam tinggi untuk menemukan hotspot arkeologis"
          >
            <Flame className={`w-3.5 h-3.5 ${showHeatmap ? 'text-amber-200 animate-pulse' : 'text-slate-400'}`} />
            <span>Heatmap</span>
            {archeologicalHotspots.length > 0 && (
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                  showHeatmap
                    ? 'bg-amber-950 text-amber-200 border border-amber-400/50'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {archeologicalHotspots.length} Hotspot
              </span>
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

          {/* Quick Pin (Titik Pantau Favorit) Button */}
          <button
            type="button"
            onClick={() => {
              if (onQuickPin) {
                onQuickPin();
              }
              if (mapInstanceRef.current && userLocation) {
                setIsAutoPanActive(true);
                mapInstanceRef.current.panTo([userLocation.lat, userLocation.lng], {
                  animate: true,
                  duration: 1.5,
                  easeLinearity: 0.25,
                });
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-rose-600 via-pink-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-mono text-xs font-bold shadow-lg shadow-rose-950/60 border border-rose-300/60 active:scale-95 transition-all group shrink-0"
            title="Quick Pin: Tandai lokasi saat ini dengan satu klik cepat & simpan sebagai Titik Pantau Favorit"
          >
            <Heart className="w-3.5 h-3.5 fill-current text-white group-hover:scale-125 transition-transform animate-pulse" />
            <span>Quick Pin</span>
            <span className="hidden sm:inline text-[10px] text-rose-100 font-normal">Titik Pantau</span>
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

          {/* Track Logger (Jejak Pencarian GPS) Toggle Button */}
          <button
            type="button"
            onClick={() => setShowTrackLog(!showTrackLog)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-mono shadow-lg active:scale-95 transition-all ${
              showTrackLog
                ? 'bg-gradient-to-r from-teal-600/90 to-emerald-600/90 border-teal-400 text-white shadow-teal-950/60 font-bold'
                : 'bg-slate-900/90 border-slate-700/80 text-slate-400 hover:text-slate-200'
            }`}
            title="Track Logger: Merekam & menampilkan jalur lintasan GPS pencarian sebagai garis polyline di peta"
          >
            <Footprints className={`w-3.5 h-3.5 ${showTrackLog ? 'text-teal-200 animate-pulse' : 'text-slate-400'}`} />
            <span>Track Logger</span>
            {trailPoints.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-teal-950/90 text-teal-200 font-bold border border-teal-400/40">
                {trailPoints.length} pt
              </span>
            )}
          </button>

          {/* Marker Animation Preference Toggle Button */}
          <button
            type="button"
            onClick={() => {
              setMarkerAnimation((prev) => {
                if (prev === 'drop_pulse') return 'pulse';
                if (prev === 'pulse') return 'drop';
                if (prev === 'drop') return 'none';
                return 'drop_pulse';
              });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-xs font-mono text-cyan-300 hover:text-white shadow-lg active:scale-95 transition-all"
            title={`Animasi Penanda Peta: ${
              markerAnimation === 'drop_pulse'
                ? 'Drop & Pulse Aktif'
                : markerAnimation === 'pulse'
                ? 'Hanya Pulse Gelombang'
                : markerAnimation === 'drop'
                ? 'Hanya Drop Jatuh'
                : 'Animasi Nonaktif'
            }. Klik untuk mengganti mode.`}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Animasi:</span>
            <span className="font-bold text-white uppercase text-[10px]">
              {markerAnimation === 'drop_pulse'
                ? 'Drop+Pulse'
                : markerAnimation === 'pulse'
                ? 'Pulse'
                : markerAnimation === 'drop'
                ? 'Drop'
                : 'Off'}
            </span>
          </button>

          {/* Opsi Pengalihan Layer Peta: Peta Jalan, Citra Satelit, Topografi Medan */}
          <div className="flex items-center p-0.5 rounded-full bg-slate-900/95 backdrop-blur-md border border-slate-700/80 shadow-lg font-mono text-xs">
            {/* 1. Map (Peta Jalan) */}
            <button
              type="button"
              onClick={() => setActiveLayer('map')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                activeLayer === 'map'
                  ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
              title="Lapisan Peta Jalan & Vektor Transportasi (Street Map)"
            >
              <Map className="w-3 h-3" />
              <span>Peta Jalan</span>
            </button>

            {/* 2. Satellite (Citra Satelit) */}
            <button
              type="button"
              onClick={() => setActiveLayer('satellite')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                activeLayer === 'satellite'
                  ? 'bg-sky-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
              title="Lapisan Citra Satelit Udara Resolusi Tinggi (Satellite Imagery)"
            >
              <Globe className="w-3 h-3" />
              <span>Citra Satelit</span>
            </button>

            {/* 3. Terrain (Peta Topografi Medan) */}
            <button
              type="button"
              onClick={() => setActiveLayer('terrain')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                activeLayer === 'terrain'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
              title="Lapisan Peta Topografi Medan, Kontur Elevasi & Relief Gunung (Terrain)"
            >
              <Mountain className="w-3 h-3" />
              <span>Peta Topografi</span>
            </button>

            {/* Dropdown for More / Custom Layers */}
            <button
              type="button"
              onClick={() => setIsLayerMenuOpen(!isLayerMenuOpen)}
              className={`p-1.5 rounded-full transition-all text-slate-400 hover:text-white ${
                isLayerMenuOpen || activeLayer === 'dark' || activeLayer === 'opentopo'
                  ? 'bg-slate-800 text-cyan-400'
                  : 'hover:bg-slate-800/60'
              }`}
              title="Opsi Lapisan Tambahan & Pengaturan Overlay (Taktis Gelap, OpenTopo, Label Jalan, Relief 3D)"
            >
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isLayerMenuOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Historical Markers (Situs Arkeologi Terbuka) Button */}
          <button
            type="button"
            onClick={() => setIsHistoricalMarkersModalOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-mono shadow-lg active:scale-95 transition-all ${
              showHistoricalMarkers
                ? 'bg-gradient-to-r from-amber-600/90 to-yellow-600/90 border-amber-400 text-slate-950 font-extrabold shadow-amber-950/60'
                : 'bg-slate-900/90 border-slate-700/80 text-amber-300 hover:text-white'
            }`}
            title="Situs Arkeologi Terbuka (Historical Markers): Jelajahi situs sejarah berpotensi artefak tinggi dari open database"
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>Situs Arkeologi</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950 text-amber-300 font-bold border border-amber-400/40">
              {HISTORICAL_MARKERS_DATA.length}
            </span>
          </button>

          {/* Terrain 3D Analysis Button */}
          <button
            type="button"
            onClick={() => {
              const centerLat = userLocation?.lat || (mapInstanceRef.current ? mapInstanceRef.current.getCenter().lat : -7.5583);
              const centerLng = userLocation?.lng || (mapInstanceRef.current ? mapInstanceRef.current.getCenter().lng : 112.3811);
              setTerrain3DCenter({
                lat: centerLat,
                lng: centerLng,
                title: userLocation ? 'Posisi GPS Pendeteksian Lapangan' : 'Area Peta Eksplorasi',
              });
              setIsTerrain3DModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-600/90 to-teal-600/90 hover:from-emerald-500 hover:to-teal-500 text-white font-mono font-bold text-xs shadow-lg shadow-emerald-950/50 border border-emerald-400 active:scale-95 transition-all"
            title="Terrain 3D Analysis: Visualisasi 3D elevasi & analisis kemiringan lereng untuk mendeteksi bahaya tebing/jurang saat survei logam"
          >
            <Mountain className="w-3.5 h-3.5 text-emerald-200" />
            <span>Terrain 3D</span>
          </button>

          {/* Slope Danger Overlay Toggle */}
          <button
            type="button"
            onClick={() => setShowSlopeAnalysis(!showSlopeAnalysis)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full backdrop-blur-md border text-xs font-mono shadow-lg active:scale-95 transition-all ${
              showSlopeAnalysis
                ? 'bg-rose-500/20 border-rose-400 text-rose-300 font-bold'
                : 'bg-slate-900/90 border-slate-700/80 text-slate-400 hover:text-slate-200'
            }`}
            title="Overlay Kontur Kemiringan Lereng di Peta: Hijau (Datar), Kuning (Sedang), Jingga (Curam), Merah (Bahaya Jurang)"
          >
            <TrendingDown className={`w-3.5 h-3.5 ${showSlopeAnalysis ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">Kontur Lereng</span>
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

          {/* Re-center user & Smooth Auto-Pan Status */}
          <button
            type="button"
            onClick={centerOnUser}
            disabled={!userLocation}
            className={`p-2 rounded-full backdrop-blur-md border shadow-lg active:scale-95 transition-all relative ${
              userLocation
                ? isAutoPanActive
                  ? 'bg-slate-900/95 border-emerald-400 text-emerald-300 shadow-emerald-950/50 ring-1 ring-emerald-400/50'
                  : 'bg-slate-900/90 border-slate-700/80 text-cyan-400 hover:bg-slate-800'
                : 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed'
            }`}
            title={
              isAutoPanActive
                ? 'Panning Halus Aktif: Peta bergeser perlahan mengikuti pergerakan lokasi GPS Anda'
                : 'Pusatkan & Aktifkan Panning Halus ke Lokasi GPS Sekarang'
            }
          >
            <Navigation className={`w-4 h-4 ${isAutoPanActive ? 'text-emerald-400 animate-pulse' : ''}`} />
            {isAutoPanActive && userLocation && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
          </button>
        </div>
      </div>

      {/* Category & Search Radius Filter Chips Bar */}
      {showFilterBar && (
        <div className="absolute top-13 left-3 right-3 z-[400] flex flex-col gap-1.5 pointer-events-auto">
          {/* Row 1: Metal Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
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

          {/* Row 2: Search Radius (Radius Pencarian) Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <div className="flex items-center gap-1 bg-slate-900/95 backdrop-blur-md px-2.5 py-1 rounded-2xl border border-cyan-500/40 shadow-xl text-xs font-mono">
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1 mr-1">
                <Target className="w-3 h-3 text-cyan-400" />
                <span>Radius Pencarian:</span>
              </span>

              {[
                { id: 'all' as const, label: 'Semua Area', count: findings.length },
                { id: 10 as const, label: '10m', count: radiusCounts[10] },
                { id: 25 as const, label: '25m', count: radiusCounts[25] },
                { id: 50 as const, label: '50m', count: radiusCounts[50] },
                { id: 100 as const, label: '100m', count: radiusCounts[100] },
                { id: 250 as const, label: '250m', count: radiusCounts[250] },
              ].map((r) => {
                const isSelected = searchRadius === r.id;
                return (
                  <button
                    key={String(r.id)}
                    type="button"
                    onClick={() => setSearchRadius(r.id)}
                    className={`flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-xs font-mono transition-all whitespace-nowrap ${
                      isSelected
                        ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-sm'
                        : 'bg-slate-950/70 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
                    }`}
                    title={
                      r.id === 'all'
                        ? 'Tampilkan semua temuan tanpa batasan radius'
                        : `Filter temuan dalam radius ${r.id} meter dari posisi GPS saya (${r.count} titik)`
                    }
                  >
                    <span>{r.label}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                        isSelected ? 'bg-cyan-950 text-cyan-300' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {r.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Heatmap & Archeological Hotspots HUD Panel (When Heatmap Active) */}
      {showHeatmap && (
        <div className={`absolute ${showFilterBar ? 'top-32 sm:top-28' : 'top-14'} left-3 z-[400] flex flex-col gap-1.5 pointer-events-auto transition-all`}>
          <div className="bg-slate-900/95 backdrop-blur-md p-2.5 rounded-2xl border border-amber-500/50 shadow-2xl shadow-black/80 font-mono text-[10px] text-slate-300 flex flex-col gap-2 max-w-[210px] sm:max-w-[240px]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                <Flame className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
                <span className="text-[11px]">Heatmap Hotspot</span>
              </div>
              <button
                type="button"
                onClick={() => setIsHeatmapSettingsOpen(!isHeatmapSettingsOpen)}
                className="text-[9px] text-cyan-400 hover:text-white px-1.5 py-0.5 rounded-lg bg-slate-800/80 border border-slate-700/80 hover:border-cyan-400 transition-all font-semibold"
              >
                {isHeatmapSettingsOpen ? 'Tutup Opsi' : 'Atur Hotspot'}
              </button>
            </div>

            {/* Gradient Bar with Anomaly Flux Reference */}
            <div>
              <div className="w-full h-2 rounded-full bg-gradient-to-r from-cyan-500 via-emerald-400 via-yellow-400 via-orange-500 to-red-600 border border-slate-700 shadow-inner"></div>
              <div className="flex items-center justify-between text-[8px] text-slate-400 font-mono mt-0.5">
                <span>&lt;65µT</span>
                <span>90µT</span>
                <span className="text-red-400 font-bold">&gt;130µT Inti</span>
              </div>
            </div>

            {/* Hotspot Cluster Counter Badge */}
            {archeologicalHotspots.length > 0 ? (
              <div className="flex items-center justify-between bg-amber-950/40 border border-amber-500/40 px-2 py-1 rounded-xl text-[9px] text-amber-200">
                <span className="flex items-center gap-1">
                  <span>🏛️</span>
                  <span>{archeologicalHotspots.length} Hotspot Terdeteksi</span>
                </span>
                <span className="font-bold text-amber-400">Padat</span>
              </div>
            ) : (
              <div className="text-[9px] text-slate-400 italic">
                Belum ada klaster padat temuan di area ini.
              </div>
            )}

            {/* Adjustable Settings Drawer: Radius, Beacons, Focus Mode */}
            {isHeatmapSettingsOpen && (
              <div className="mt-0.5 pt-2 border-t border-slate-800 flex flex-col gap-2 animate-in fade-in duration-150">
                {/* 1. Radius Sebar */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[9px] text-slate-300">
                    <span>Radius Sebar Panas:</span>
                    <span className="font-bold text-amber-300">{heatRadius}px</span>
                  </div>
                  <input
                    type="range"
                    min={15}
                    max={65}
                    step={5}
                    value={heatRadius}
                    onChange={(e) => setHeatRadius(Number(e.target.value))}
                    className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* 2. Toggle Hotspot Beacons */}
                <button
                  type="button"
                  onClick={() => setShowHotspotBeacons(!showHotspotBeacons)}
                  className={`w-full flex items-center justify-between p-1.5 rounded-xl border text-[9px] font-mono transition-all ${
                    showHotspotBeacons
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 font-semibold'
                      : 'bg-slate-950/80 border-slate-800 text-slate-400'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <span>🔥</span>
                    <span>Tandai Titik Hotspot</span>
                  </span>
                  <span className={`w-2 h-2 rounded-full ${showHotspotBeacons ? 'bg-amber-400 animate-pulse' : 'bg-slate-700'}`} />
                </button>

                {/* 3. Pure Heatmap Focus (Toggle Pins) */}
                <button
                  type="button"
                  onClick={() => setShowPins(!showPins)}
                  className={`w-full flex items-center justify-between p-1.5 rounded-xl border text-[9px] font-mono transition-all ${
                    !showPins
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 font-bold'
                      : 'bg-slate-950/80 border-slate-800 text-slate-400'
                  }`}
                  title="Sembunyikan pin marker agar konsentrasi sebaran thermal terlihat murni"
                >
                  <span className="flex items-center gap-1">
                    {!showPins ? <Eye className="w-3 h-3 text-cyan-400" /> : <EyeOff className="w-3 h-3 text-slate-500" />}
                    <span>Fokus Heatmap Murni</span>
                  </span>
                  <span className={`text-[8px] font-bold ${!showPins ? 'text-cyan-300' : 'text-slate-500'}`}>
                    {!showPins ? 'AKTIF' : 'PIN ON'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Marker & Hotspot Animation Keyframe Styles */}
      <style>{`
        @keyframes marker-drop {
          0% {
            transform: translateY(-42px) scale(0.5);
            opacity: 0;
          }
          50% {
            transform: translateY(6px) scale(1.12);
            opacity: 1;
          }
          75% {
            transform: translateY(-3px) scale(0.96);
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        @keyframes marker-pulse-ring {
          0% {
            transform: scale(0.7);
            opacity: 0.95;
          }
          50% {
            transform: scale(1.9);
            opacity: 0.35;
          }
          100% {
            transform: scale(2.6);
            opacity: 0;
          }
        }
        .marker-drop-anim {
          animation: marker-drop 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .marker-pulse-ring-elem {
          animation: marker-pulse-ring 2.2s infinite cubic-bezier(0.215, 0.61, 0.355, 1);
        }
        @keyframes fav-beacon-pulse {
          0% {
            transform: scale(0.65);
            opacity: 0.95;
          }
          50% {
            transform: scale(2.05);
            opacity: 0.35;
          }
          100% {
            transform: scale(2.85);
            opacity: 0;
          }
        }
        .fav-waypoint-pulse-ring {
          animation: fav-beacon-pulse 2.2s infinite cubic-bezier(0.215, 0.61, 0.355, 1);
        }
        @keyframes hotspot-pulse-ring {
          0% {
            transform: scale(0.65);
            opacity: 0.95;
          }
          50% {
            transform: scale(2.2);
            opacity: 0.35;
          }
          100% {
            transform: scale(3.1);
            opacity: 0;
          }
        }
        .hotspot-pulse-ring-elem {
          animation: hotspot-pulse-ring 2.0s infinite cubic-bezier(0.215, 0.61, 0.355, 1);
        }
      `}</style>

      {/* Actual Leaflet Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Tactical Layer & Terrain Selection Panel Modal */}
      {isLayerMenuOpen && (
        <>
          {/* Backdrop click to close */}
          <div
            className="absolute inset-0 z-[480] bg-black/40 backdrop-blur-[2px] pointer-events-auto"
            onClick={() => setIsLayerMenuOpen(false)}
          />

          {/* Floating Card */}
          <div className="absolute top-14 right-3 sm:right-4 z-[490] w-84 sm:w-96 max-w-[calc(100vw-24px)] max-h-[calc(100%-70px)] overflow-y-auto no-scrollbar bg-slate-950/95 backdrop-blur-xl border border-slate-700/90 rounded-3xl p-4 shadow-2xl shadow-black/90 animate-in fade-in zoom-in-95 duration-150 pointer-events-auto text-slate-200 space-y-3 ring-1 ring-white/10">
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold font-mono text-white flex items-center gap-1.5">
                    <span>Visual Medan & Lapisan Peta</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Survei Terbuka
                    </span>
                  </h4>
                  <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                    Konteks visual kontur, vegetasi, & elevasi saat survei logam
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLayerMenuOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Tutup Menu Lapisan"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Base Layer Selection */}
            <div className="space-y-2">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold">
                Pilih Tampilan Dasar Lapangan (Map, Satellite, Terrain):
              </div>

              {/* 1. Map (Peta Standar / Vektor Jalan) */}
              <button
                type="button"
                onClick={() => {
                  setActiveLayer('map');
                }}
                className={`w-full text-left p-3 rounded-2xl border transition-all flex items-start gap-3 ${
                  activeLayer === 'map'
                    ? 'bg-gradient-to-r from-cyan-950/80 to-slate-900 border-cyan-400/90 shadow-lg shadow-cyan-950/50 ring-1 ring-cyan-400/40'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div
                  className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                    activeLayer === 'map'
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/40'
                      : 'bg-slate-800 text-cyan-400'
                  }`}
                >
                  <Map className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold font-mono text-white flex items-center gap-1.5">
                      🗺️ Map (Peta Standar & Vektor)
                    </span>
                    {activeLayer === 'map' && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500 text-slate-950 font-mono font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Aktif
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                    Peta jalan vektor jernih dengan nama tempat, jalur transportasi, batas kawasan hijau, dan hidrologi standar.
                  </p>
                </div>
              </button>

              {/* 2. Citra Satelit Udara */}
              <button
                type="button"
                onClick={() => {
                  setActiveLayer('satellite');
                }}
                className={`w-full text-left p-3 rounded-2xl border transition-all flex items-start gap-3 ${
                  activeLayer === 'satellite'
                    ? 'bg-gradient-to-r from-sky-950/80 to-slate-900 border-sky-400/90 shadow-lg shadow-sky-950/50 ring-1 ring-sky-400/40'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div
                  className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                    activeLayer === 'satellite'
                      ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/40'
                      : 'bg-slate-800 text-sky-400'
                  }`}
                >
                  <Globe className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold font-mono text-white flex items-center gap-1.5">
                      🛰️ Citra Satelit Udara
                    </span>
                    {activeLayer === 'satellite' && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-sky-500 text-slate-950 font-mono font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Aktif
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                    Foto udara resolusi tinggi (Esri World Imagery) memperlihatkan batas vegetasi semak, formasi batuan, tanah terbuka, dan jejak setapak.
                  </p>
                </div>
              </button>

              {/* 2. Topografi Medan (Terrain) */}
              <button
                type="button"
                onClick={() => {
                  setActiveLayer('terrain');
                }}
                className={`w-full text-left p-3 rounded-2xl border transition-all flex items-start gap-3 ${
                  activeLayer === 'terrain'
                    ? 'bg-gradient-to-r from-emerald-950/80 to-slate-900 border-emerald-400/90 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-400/40'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div
                  className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                    activeLayer === 'terrain'
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/40'
                      : 'bg-slate-800 text-emerald-400'
                  }`}
                >
                  <Mountain className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold font-mono text-white flex items-center gap-1.5">
                      ⛰️ Topografi Medan (Terrain)
                    </span>
                    {activeLayer === 'terrain' && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-mono font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Aktif
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                    Kontur ketinggian, shading relief bukit & lembah, hidrologi aliran air, dan elevasi medan untuk survei alam bebas.
                  </p>
                </div>
              </button>

              {/* 3. Kontur Ekstrem (OpenTopoMap) */}
              <button
                type="button"
                onClick={() => {
                  setActiveLayer('opentopo');
                }}
                className={`w-full text-left p-3 rounded-2xl border transition-all flex items-start gap-3 ${
                  activeLayer === 'opentopo'
                    ? 'bg-gradient-to-r from-amber-950/80 to-slate-900 border-amber-400/90 shadow-lg shadow-amber-950/50 ring-1 ring-amber-400/40'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div
                  className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                    activeLayer === 'opentopo'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/40'
                      : 'bg-slate-800 text-amber-400'
                  }`}
                >
                  <Map className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold font-mono text-white flex items-center gap-1.5">
                      🗺️ Kontur Ekstrem (OpenTopo)
                    </span>
                    {activeLayer === 'opentopo' && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Aktif
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                    Garis kontur topografi metrik rinci per meter, tebing lereng curam, dan rute jalur pendakian / eksplorasi outdoor.
                  </p>
                </div>
              </button>

              {/* 4. Taktis Gelap (CartoDB Dark) */}
              <button
                type="button"
                onClick={() => {
                  setActiveLayer('dark');
                }}
                className={`w-full text-left p-3 rounded-2xl border transition-all flex items-start gap-3 ${
                  activeLayer === 'dark'
                    ? 'bg-gradient-to-r from-slate-900 to-slate-950 border-cyan-400/90 shadow-lg shadow-cyan-950/50 ring-1 ring-cyan-400/40'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div
                  className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                    activeLayer === 'dark'
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/40'
                      : 'bg-slate-800 text-cyan-400'
                  }`}
                >
                  <Moon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold font-mono text-white flex items-center gap-1.5">
                      🌑 Taktis Gelap (CartoDB Dark)
                    </span>
                    {activeLayer === 'dark' && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500 text-slate-950 font-mono font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Aktif
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                    Latar gelap kontras tinggi untuk visualisasi sensor magnetik dan intensitas kerapatan heatmap tanpa gangguan warna peta.
                  </p>
                </div>
              </button>
            </div>

            {/* Overlays Section */}
            <div className="pt-2.5 border-t border-slate-800 space-y-2">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold flex items-center justify-between">
                <span>Lapisan Tambahan Opsional:</span>
                <span className="text-cyan-400 text-[9px] lowercase font-normal">dapat ditumpuk</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Toggle Labels */}
                <button
                  type="button"
                  onClick={() => setShowLabels(!showLabels)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-mono transition-all ${
                    showLabels
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 font-bold shadow-sm'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Tag className={`w-3.5 h-3.5 ${showLabels ? 'text-cyan-400' : 'text-slate-500'}`} />
                    <span>Label Jalan</span>
                  </div>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      showLabels ? 'bg-cyan-400 animate-pulse' : 'bg-slate-700'
                    }`}
                  />
                </button>

                {/* Toggle Hillshade */}
                <button
                  type="button"
                  onClick={() => setShowHillshade(!showHillshade)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-mono transition-all ${
                    showHillshade
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-bold shadow-sm'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Mountain className={`w-3.5 h-3.5 ${showHillshade ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span>Relief 3D</span>
                  </div>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      showHillshade ? 'bg-emerald-400 animate-pulse' : 'bg-slate-700'
                    }`}
                  />
                </button>

                {/* Toggle Heatmap Hotspot */}
                <button
                  type="button"
                  onClick={() => setShowHeatmap(!showHeatmap)}
                  className={`col-span-2 flex items-center justify-between p-2.5 rounded-xl border text-xs font-mono transition-all ${
                    showHeatmap
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold shadow-sm'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Flame className={`w-3.5 h-3.5 ${showHeatmap ? 'text-amber-400' : 'text-slate-500'}`} />
                    <span>Visualisasi Heatmap & Hotspot Arkeologis</span>
                  </div>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      showHeatmap ? 'bg-amber-400 animate-pulse' : 'bg-slate-700'
                    }`}
                  />
                </button>

                {/* Toggle Historical Markers */}
                <button
                  type="button"
                  onClick={() => setShowHistoricalMarkers(!showHistoricalMarkers)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-mono transition-all ${
                    showHistoricalMarkers
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold shadow-sm'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Landmark className={`w-3.5 h-3.5 ${showHistoricalMarkers ? 'text-amber-400' : 'text-slate-500'}`} />
                    <span>Situs Arkeologi</span>
                  </div>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      showHistoricalMarkers ? 'bg-amber-400 animate-pulse' : 'bg-slate-700'
                    }`}
                  />
                </button>

                {/* Toggle Slope Danger Overlay */}
                <button
                  type="button"
                  onClick={() => setShowSlopeAnalysis(!showSlopeAnalysis)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-mono transition-all ${
                    showSlopeAnalysis
                      ? 'bg-rose-500/20 border-rose-400 text-rose-200 font-bold shadow-sm'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <TrendingDown className={`w-3.5 h-3.5 ${showSlopeAnalysis ? 'text-rose-400' : 'text-slate-500'}`} />
                    <span>Kontur Lereng</span>
                  </div>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      showSlopeAnalysis ? 'bg-rose-400 animate-pulse' : 'bg-slate-700'
                    }`}
                  />
                </button>

                {/* Quick Launcher for 3D Terrain Analysis */}
                <button
                  type="button"
                  onClick={() => {
                    setIsLayerMenuOpen(false);
                    const centerLat = userLocation?.lat || (mapInstanceRef.current ? mapInstanceRef.current.getCenter().lat : -7.5583);
                    const centerLng = userLocation?.lng || (mapInstanceRef.current ? mapInstanceRef.current.getCenter().lng : 112.3811);
                    setTerrain3DCenter({
                      lat: centerLat,
                      lng: centerLng,
                      title: userLocation ? 'Posisi GPS Pendeteksian Lapangan' : 'Area Peta Eksplorasi',
                    });
                    setIsTerrain3DModalOpen(true);
                  }}
                  className="col-span-2 flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-emerald-950/80 to-teal-950/80 border border-emerald-500/50 text-emerald-200 font-bold text-xs font-mono hover:from-emerald-900/90 hover:to-teal-900/90 transition-all shadow-md"
                >
                  <div className="flex items-center gap-2">
                    <Mountain className="w-4 h-4 text-emerald-400" />
                    <span>Buka Terrain 3D Analysis Interaktif</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-emerald-400" />
                </button>
              </div>
            </div>

            {/* Field Advice Note */}
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[10px] text-slate-400 font-sans leading-relaxed">
              💡 <strong className="text-slate-200">Tips Survei Lapangan:</strong> Gunakan layer <strong className="text-sky-300">Satelit</strong> untuk mendeteksi batas tutupan pohon dan singkapan batuan terbuka, atau layer <strong className="text-emerald-300">Topografi Medan</strong> untuk membaca lembah cekungan tempat pengendapan logam berat akibat limpasan air hujan.
            </div>
          </div>
        </>
      )}

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
                    dismissedNearbyFindingIdRef.current = activeNearbyFinding.finding.id;
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

      {/* Active Map Base Layer Indicator Badge (Bottom-Right) */}
      {!selectedFinding && (
        <div className="absolute bottom-3 right-3 z-[400] pointer-events-auto">
          <button
            type="button"
            onClick={() => setIsLayerMenuOpen(true)}
            className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-2.5 py-1.5 rounded-2xl border border-slate-700/80 shadow-xl font-mono text-[10px] text-slate-300 hover:text-white hover:border-slate-600 transition-all active:scale-95 group"
            title="Klik untuk memilih tampilan visual medan & lapisan satelit/terrain"
          >
            {activeLayer === 'map' ? (
              <Map className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
            ) : activeLayer === 'satellite' ? (
              <Globe className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform" />
            ) : activeLayer === 'terrain' ? (
              <Mountain className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
            ) : activeLayer === 'opentopo' ? (
              <Map className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-slate-400 group-hover:scale-110 transition-transform" />
            )}
            <span className="font-semibold text-slate-200">
              {activeLayer === 'map'
                ? 'Peta Map'
                : activeLayer === 'satellite'
                ? 'Satelit Udara'
                : activeLayer === 'terrain'
                ? 'Topografi Medan'
                : activeLayer === 'opentopo'
                ? 'Kontur Ekstrem'
                : 'Taktis Gelap'}
            </span>
            {showLabels && <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800">Label</span>}
            {showHillshade && <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800">3D</span>}
          </button>
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

          {selectedFinding.locationName && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-mono text-cyan-300 bg-cyan-950/50 p-2 rounded-lg border border-cyan-800/50">
              <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-[9px] text-cyan-400/80 uppercase font-bold tracking-wider shrink-0">Lokasi / Landmark:</span>
              <span className="truncate font-semibold text-slate-100">{selectedFinding.locationName}</span>
            </div>
          )}

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

      {/* Floating Slope Hazard HUD pill when Slope Analysis is active */}
      {showSlopeAnalysis && currentSlopeInfo && (
        <div className="absolute bottom-12 left-3 z-[410] pointer-events-auto animate-in fade-in duration-200">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-700/80 shadow-2xl font-mono text-xs text-white">
            <TrendingDown
              className={`w-4 h-4 ${
                currentSlopeInfo.dangerLevel === 'EXTREME'
                  ? 'text-red-400 animate-bounce'
                  : currentSlopeInfo.dangerLevel === 'STEEP'
                  ? 'text-orange-400'
                  : 'text-emerald-400'
              }`}
            />
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Kemiringan Medan:</span>
              <span
                className={`font-bold ${
                  currentSlopeInfo.dangerLevel === 'EXTREME'
                    ? 'text-red-400'
                    : currentSlopeInfo.dangerLevel === 'STEEP'
                    ? 'text-orange-400'
                    : 'text-emerald-400'
                }`}
              >
                {currentSlopeInfo.slope}°
              </span>
              <span className="text-[10px] text-slate-400">({currentSlopeInfo.elev}m)</span>
            </div>
            <button
              type="button"
              onClick={() => {
                const centerLat = userLocation?.lat || (mapInstanceRef.current ? mapInstanceRef.current.getCenter().lat : -7.5583);
                const centerLng = userLocation?.lng || (mapInstanceRef.current ? mapInstanceRef.current.getCenter().lng : 112.3811);
                setTerrain3DCenter({
                  lat: centerLat,
                  lng: centerLng,
                  title: 'Analisis Kemiringan Lereng 3D',
                });
                setIsTerrain3DModalOpen(true);
              }}
              className="ml-1 px-2.5 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold shadow active:scale-95 transition-all"
            >
              Buka 3D
            </button>
          </div>
        </div>
      )}

      {/* 3D Terrain Analysis Modal */}
      <Terrain3DAnalysisModal
        isOpen={isTerrain3DModalOpen}
        onClose={() => setIsTerrain3DModalOpen(false)}
        centerLocation={terrain3DCenter}
        userLocation={userLocation}
        findings={findings}
        historicalSites={HISTORICAL_MARKERS_DATA}
        onFlyToLocation={(lat, lng) => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([lat, lng], 17, { duration: 1.2 });
          }
        }}
      />

      {/* Historical Markers Explorer Modal */}
      <HistoricalMarkersModal
        isOpen={isHistoricalMarkersModalOpen}
        onClose={() => setIsHistoricalMarkersModalOpen(false)}
        userLocation={userLocation}
        onSelectSiteOnMap={(site) => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([site.lat, site.lng], 16, { duration: 1.2 });
          }
        }}
        onOpen3DTerrainAnalysis={(site) => {
          setTerrain3DCenter({
            lat: site.lat,
            lng: site.lng,
            title: site.name,
          });
          setIsTerrain3DModalOpen(true);
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
