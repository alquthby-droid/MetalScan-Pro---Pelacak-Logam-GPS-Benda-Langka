import { MetalCategory } from '../types/detector';

export interface NTBPriorityFinding {
  id: string;
  name: string;
  region: 'Lombok Barat' | 'Lombok Timur' | 'Lombok Tengah' | 'Sumbawa Barat' | 'Sumbawa' | 'Dompu / Tambora' | 'Bima';
  locationName: string;
  lat: number;
  lng: number;
  category: MetalCategory;
  estimatedDepthCm: number;
  magneticStrength: number; // in µT
  priority: 'SANGAT TINGGI' | 'TINGGI' | 'SEDANG';
  historicalContext: string;
  tacticalAdvice: string;
  elevationMeters: number;
  estimatedAge: string;
}

export const NTB_PRIORITY_FINDINGS: NTBPriorityFinding[] = [
  {
    id: 'ntb-1',
    name: 'Endapan Emas Plaser Sekotong',
    region: 'Lombok Barat',
    locationName: 'Lembah Perbukitan Sekotong, Lombok Barat',
    lat: -8.7612,
    lng: 115.9814,
    category: 'gold',
    estimatedDepthCm: 12,
    magneticStrength: 146.5,
    priority: 'SANGAT TINGGI',
    historicalContext: 'Formasi urat kuarsa hidrotermal dan aluvium purba Sekotong. Mengandung butiran emas bebas dan pirit emas sekunder.',
    tacticalAdvice: 'Gunakan mode diskriminasi relic_gold dengan ground balance manual untuk meredam mineral lempung setempat.',
    elevationMeters: 145,
    estimatedAge: 'Alami / Endapan Kuarter Purba',
  },
  {
    id: 'ntb-2',
    name: 'Artefak Perunggu Kerajaan Selaparang',
    region: 'Lombok Timur',
    locationName: 'Situs Makam & Peninggalan Selaparang, Lombok Timur',
    lat: -8.5321,
    lng: 116.5218,
    category: 'bronze',
    estimatedDepthCm: 24,
    magneticStrength: 92.4,
    priority: 'SANGAT TINGGI',
    historicalContext: 'Pusat kejayaan Kerajaan Selaparang abad ke-13 hingga ke-16. Indikasi fragmen bejana perunggu, genta upacara, dan uang gobog perunggu kuno.',
    tacticalAdvice: 'Sinyal berdenyut frekuensi menengah. Gunakan ayunan koil lambat dan periksa kedalaman di atas 20 cm.',
    elevationMeters: 230,
    estimatedAge: 'Abad XIII - XVI Masehi',
  },
  {
    id: 'ntb-3',
    name: 'Patahan Meteorit Kaldera Tambora',
    region: 'Dompu / Tambora',
    locationName: 'Lereng Kaldera Barat Gunung Tambora, Dompu/Bima',
    lat: -8.2478,
    lng: 117.9912,
    category: 'meteorite',
    estimatedDepthCm: 8,
    magneticStrength: 194.2,
    priority: 'SANGAT TINGGI',
    historicalContext: 'Fragmen batu meteorit siderit/kondrit feromagnetik tinggi yang tertimbun lapisan piroklastik Tambora. Densitas besi-nikel sangat tinggi.',
    tacticalAdvice: 'Fluks magnetik sangat tajam (>180 µT). Jaga jarak sensor dari bebatuan vulkanik basaltik biasa untuk validasi.',
    elevationMeters: 890,
    estimatedAge: 'Kosmik / Erupsi Bersejarah 1815',
  },
  {
    id: 'ntb-4',
    name: 'Koin Emas Dinasti Kesultanan Bima',
    region: 'Bima',
    locationName: 'Pesisir Teluk Bima & Pelabuhan Kuno, Bima',
    lat: -8.4556,
    lng: 118.7265,
    category: 'gold',
    estimatedDepthCm: 15,
    magneticStrength: 118.7,
    priority: 'TINGGI',
    historicalContext: 'Jalur perdagangan rempah dan maritim Kesultanan Bima. Teridentifikasi koin emas dinasti berinskripsi huruf Arab-Melayu.',
    tacticalAdvice: 'Target berada di pasir berlempung dekat muara. Aktifkan filter anti-besi untuk menghindari paku kapal modern.',
    elevationMeters: 18,
    estimatedAge: 'Abad XVII Masehi',
  },
  {
    id: 'ntb-5',
    name: 'Gudang Pusaka Besi Tempa Taliwang',
    region: 'Sumbawa Barat',
    locationName: 'Lembah Dataran Taliwang, Sumbawa Barat',
    lat: -8.7345,
    lng: 116.8521,
    category: 'iron',
    estimatedDepthCm: 28,
    magneticStrength: 82.6,
    priority: 'SEDANG',
    historicalContext: 'Sentra pandai besi dan persenjataan kuno Sumbawa era kedatuan. Diduga sisa mata tombak, keris pamor, dan perkakas tempa.',
    tacticalAdvice: 'Target feromagnetik berukuran sedang di kedalaman lebih dari 25 cm. Gunakan sekop lapangan bergagang panjang.',
    elevationMeters: 62,
    estimatedAge: 'Abad XVII - XVIII Masehi',
  },
  {
    id: 'ntb-6',
    name: 'Pasir Besi Magnetit Pantai Senggigi',
    region: 'Lombok Barat',
    locationName: 'Zona Pasang Surut Senggigi, Lombok Barat',
    lat: -8.5024,
    lng: 116.0543,
    category: 'iron',
    estimatedDepthCm: 10,
    magneticStrength: 165.8,
    priority: 'TINGGI',
    historicalContext: 'Konsentrasi pasir besi titanomagnetit hitam dengan induksi magnetik kuat hasil sedimentasi vulkanik Lombok utara.',
    tacticalAdvice: 'Ideal untuk kalibrasi kepekaan sensor magnetometer di pesisir barat NTB.',
    elevationMeters: 4,
    estimatedAge: 'Sedimen Kuarter Alami',
  },
  {
    id: 'ntb-7',
    name: 'Perhiasan Perak Kuno Sasak Pujut',
    region: 'Lombok Tengah',
    locationName: 'Perbukitan Desa Adat Pujut, Lombok Tengah',
    lat: -8.8234,
    lng: 116.2741,
    category: 'silver',
    estimatedDepthCm: 18,
    magneticStrength: 86.3,
    priority: 'TINGGI',
    historicalContext: 'Peninggalan ornamen perak murni dan gelang kawat kuno komunitas Sasak perbukitan selatan Mandalika.',
    tacticalAdvice: 'Konduktivitas perak tinggi memicu anomali eddy current. Pastikan laju sapuan koil stabil 0.5 m/detik.',
    elevationMeters: 110,
    estimatedAge: 'Abad XIV - XV Masehi',
  },
];

/**
 * Calculates geodesic distance between two points in meters using Haversine formula
 */
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
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
export function calculateBearingDegrees(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.cos(phi1) * Math.sin(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return Math.round(((theta * 180) / Math.PI + 360) % 360);
}

/**
 * Provides Indonesian steering guidance relative to user heading and target bearing
 */
export function getSteeringGuidance(userHeading: number, targetBearing: number): {
  advice: string;
  deltaAngle: number;
  direction: 'AHEAD' | 'RIGHT' | 'LEFT' | 'BEHIND';
  isAligned: boolean;
} {
  // Normalize difference to -180 .. +180
  let diff = (targetBearing - userHeading + 360) % 360;
  if (diff > 180) diff -= 360;

  const absDiff = Math.abs(diff);

  if (absDiff <= 6) {
    return {
      advice: 'LURUS KE SASARAN!',
      deltaAngle: Math.round(absDiff),
      direction: 'AHEAD',
      isAligned: true,
    };
  } else if (absDiff > 150) {
    return {
      advice: 'Putar Balik 180° ke Belakang',
      deltaAngle: Math.round(absDiff),
      direction: 'BEHIND',
      isAligned: false,
    };
  } else if (diff > 0) {
    return {
      advice: `Belok Kanan ${Math.round(diff)}°`,
      deltaAngle: Math.round(diff),
      direction: 'RIGHT',
      isAligned: false,
    };
  } else {
    return {
      advice: `Belok Kiri ${Math.round(absDiff)}°`,
      deltaAngle: Math.round(absDiff),
      direction: 'LEFT',
      isAligned: false,
    };
  }
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

  const normalized = (bearing % 360 + 360) % 360;
  for (const dir of directions) {
    if (normalized >= dir.min && normalized < dir.max) {
      return dir.label;
    }
  }
  return 'Utara (U)';
}
