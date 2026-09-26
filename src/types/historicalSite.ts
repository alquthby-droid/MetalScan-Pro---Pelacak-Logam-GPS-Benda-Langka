export type HistoricalSiteCategory =
  | 'archaeological_site'
  | 'megalithic'
  | 'ancient_capital'
  | 'temple_complex'
  | 'shipwreck_maritime'
  | 'colonial_fortress'
  | 'mining_heritage';

export type HistoricalEra =
  | 'Prasejarah'
  | 'Klasik Hindu-Buddha'
  | 'Kesultanan Islam'
  | 'Kolonial & Maritim'
  | 'Megalitikum';

export type ArtifactPotentialLevel = 'SANGAT TINGGI' | 'TINGGI' | 'SEDANG';

export interface HistoricalMarkerSite {
  id: string;
  name: string;
  alternateName?: string;
  region: string;
  lat: number;
  lng: number;
  elevationMeters: number;
  category: HistoricalSiteCategory;
  categoryLabel: string;
  era: HistoricalEra;
  discoveryYear: number | string;
  artifactPotential: ArtifactPotentialLevel;
  artifactPotentialScore: number; // 0 - 100%
  knownArtifactTypes: string[];
  description: string;
  tacticalDetectorAdvice: string;
  openDatabaseSource: 'OpenStreetMap Historic Database' | 'UNESCO World Heritage' | 'Pleiades Ancient Gazetteer' | 'Puslit Arkenas Terbuka';
  openDatabaseId: string;
  sourceUrl?: string;
  averageSlopeDegrees?: number;
  terrainType: string;
}
