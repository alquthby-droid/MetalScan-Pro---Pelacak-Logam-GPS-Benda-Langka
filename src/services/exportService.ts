import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MetalFinding, GPSLocation, MetalCategory } from '../types/detector';
import { trailService, TrailPoint } from './trailService';

/**
 * Calculates distance between two GPS coordinates in meters using the Haversine formula
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Generate a high-resolution canvas map snapshot of all findings, GPS travel route, and GPS bounds
 */
export async function generateMapSnapshot(
  findings: MetalFinding[],
  userLocation?: GPSLocation | null,
  width: number = 900,
  height: number = 520,
  trailPointsOverride?: TrailPoint[]
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // Fetch travel route trail points from trailService if not explicitly provided
  const trail = trailPointsOverride || trailService.getPoints();

  // Determine comprehensive GPS bounding box across findings, user location, and travel trail
  const allPoints: { lat: number; lng: number }[] = findings.map((f) => ({ lat: f.lat, lng: f.lng }));
  if (userLocation) {
    allPoints.push({ lat: userLocation.lat, lng: userLocation.lng });
  }
  trail.forEach((tp) => {
    allPoints.push({ lat: tp.lat, lng: tp.lng });
  });

  // Fallback defaults if no points
  if (allPoints.length === 0) {
    allPoints.push({ lat: -6.2088, lng: 106.8456 });
  }

  let minLat = Math.min(...allPoints.map((p) => p.lat));
  let maxLat = Math.max(...allPoints.map((p) => p.lat));
  let minLng = Math.min(...allPoints.map((p) => p.lng));
  let maxLng = Math.max(...allPoints.map((p) => p.lng));

  // Add margin around bounding box (at least 0.0018 deg ~ 200m if clustered)
  const latSpan = Math.max(maxLat - minLat, 0.002);
  const lngSpan = Math.max(maxLng - minLng, 0.0024);
  const latPad = latSpan * 0.22;
  const lngPad = lngSpan * 0.22;

  minLat -= latPad;
  maxLat += latPad;
  minLng -= lngPad;
  maxLng += lngPad;

  // Projection helper: lat/lng -> canvas x, y (with 45px padding for axes)
  const padX = 45;
  const padY = 40;
  const mapW = width - padX * 2;
  const mapH = height - padY * 2 - 35; // Leave space for legend at bottom

  const toX = (lng: number) => padX + ((lng - minLng) / (maxLng - minLng)) * mapW;
  const toY = (lat: number) => padY + ((maxLat - lat) / (maxLat - minLat)) * mapH;

  // 1. Background Fill - Tactical Dark Satellite / Topo Style
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#090d16');
  bgGrad.addColorStop(0.5, '#0b1120');
  bgGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Tactical Radar / Topographic Grid Lines
  ctx.save();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 1;

  // Grid lines along X (Longitude)
  const numGridX = 6;
  for (let i = 0; i <= numGridX; i++) {
    const x = padX + (i / numGridX) * mapW;
    ctx.beginPath();
    ctx.moveTo(x, padY);
    ctx.lineTo(x, padY + mapH);
    ctx.stroke();

    // Longitude label
    const curLng = minLng + (i / numGridX) * (maxLng - minLng);
    ctx.fillStyle = '#64748b';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${curLng.toFixed(4)}°E`, x, padY + mapH + 14);
  }

  // Grid lines along Y (Latitude)
  const numGridY = 5;
  for (let j = 0; j <= numGridY; j++) {
    const y = padY + (j / numGridY) * mapH;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(padX + mapW, y);
    ctx.stroke();

    // Latitude label
    const curLat = maxLat - (j / numGridY) * (maxLat - minLat);
    ctx.fillStyle = '#64748b';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${curLat.toFixed(4)}°`, padX - 6, y + 3);
  }
  ctx.restore();

  // 3. Subtle simulated topographic elevation contours
  ctx.save();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.07)';
  ctx.lineWidth = 1.5;
  const centerX = padX + mapW / 2;
  const centerY = padY + mapH / 2;
  for (let r = 50; r < Math.max(mapW, mapH); r += 60) {
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, r * 1.2, r * 0.75, 0.2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // 4. Heat Anomaly Zones (Soft radial glow around high magnetic strength findings)
  findings.forEach((f) => {
    const fx = toX(f.lng);
    const fy = toY(f.lat);
    const radius = Math.min(80, Math.max(25, (f.magneticStrength / 50) * 20));

    const heatGrad = ctx.createRadialGradient(fx, fy, 4, fx, fy, radius);
    if (f.category === 'gold') {
      heatGrad.addColorStop(0, 'rgba(234, 179, 8, 0.45)');
      heatGrad.addColorStop(0.5, 'rgba(234, 179, 8, 0.18)');
      heatGrad.addColorStop(1, 'rgba(234, 179, 8, 0)');
    } else if (f.category === 'meteorite') {
      heatGrad.addColorStop(0, 'rgba(192, 132, 252, 0.45)');
      heatGrad.addColorStop(0.5, 'rgba(192, 132, 252, 0.18)');
      heatGrad.addColorStop(1, 'rgba(192, 132, 252, 0)');
    } else {
      heatGrad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
      heatGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.12)');
      heatGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    }
    ctx.fillStyle = heatGrad;
    ctx.beginPath();
    ctx.arc(fx, fy, radius, 0, Math.PI * 2);
    ctx.fill();
  });

  // 5. DRAW ACTUAL TRAVEL ROUTE / GPS TRAJECTORY (Peta Rute Perjalanan GPS)
  if (trail.length > 1) {
    ctx.save();
    // Glowing ambient path underneath
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    trail.forEach((p, idx) => {
      const px = toX(p.lng);
      const py = toY(p.lat);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Foreground tactical dash path
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    trail.forEach((p, idx) => {
      const px = toX(p.lng);
      const py = toY(p.lat);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Checkpoints / Breadcrumb dots along path
    trail.forEach((p, idx) => {
      if (idx > 0 && idx < trail.length - 1 && idx % 3 === 0) {
        const px = toX(p.lng);
        const py = toY(p.lat);
        ctx.fillStyle = p.isAnomaly ? '#f59e0b' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Start point marker (TITIK AWAL RUTE)
    const startPoint = trail[0];
    const sx = toX(startPoint.lng);
    const sy = toY(startPoint.lat);
    ctx.fillStyle = '#10b981'; // emerald
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Start label
    ctx.font = 'bold 8.5px "JetBrains Mono", sans-serif';
    ctx.fillStyle = '#10b981';
    ctx.textAlign = 'center';
    ctx.fillText('START', sx, sy + 15);
    ctx.restore();
  } else if (findings.length > 1) {
    // Fallback: Connect findings if no trail recorded yet
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    findings.forEach((f, idx) => {
      const fx = toX(f.lng);
      const fy = toY(f.lat);
      if (idx === 0) ctx.moveTo(fx, fy);
      else ctx.lineTo(fx, fy);
    });
    ctx.stroke();
    ctx.restore();
  }

  // 6. Draw User Location Pin & Accuracy Circle (POSISI SURVEYOR)
  if (userLocation) {
    const ux = toX(userLocation.lng);
    const uy = toY(userLocation.lat);

    // Accuracy circle
    ctx.save();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ux, uy, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // User center dot
    ctx.fillStyle = '#0284c7';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(ux, uy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // User label
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 9px "JetBrains Mono", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POSISI SURVEYOR', ux, uy - 14);
    ctx.restore();
  }

  // 7. Draw Finding Pins with Number Badges and Callout Labels
  findings.forEach((f, index) => {
    const fx = toX(f.lng);
    const fy = toY(f.lat);
    const pinNumber = index + 1;

    let pinColor = '#94a3b8'; // iron
    let textColor = '#ffffff';
    if (f.category === 'gold') {
      pinColor = '#eab308';
      textColor = '#000000';
    } else if (f.category === 'meteorite') {
      pinColor = '#c084fc';
      textColor = '#000000';
    } else if (f.category === 'silver') {
      pinColor = '#38bdf8';
      textColor = '#000000';
    } else if (f.category === 'bronze') {
      pinColor = '#f97316';
      textColor = '#000000';
    }

    ctx.save();
    // Pin shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;

    // Pin Head Circle
    ctx.fillStyle = pinColor;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(fx, fy - 6, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Pin Point
    ctx.fillStyle = pinColor;
    ctx.beginPath();
    ctx.moveTo(fx - 5, fy - 2);
    ctx.lineTo(fx + 5, fy - 2);
    ctx.lineTo(fx, fy + 5);
    ctx.closePath();
    ctx.fill();

    // Pin Number
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = textColor;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${pinNumber}`, fx, fy - 6);

    // Callout Label Card above pin
    const labelText = `#${pinNumber} ${f.name} (${f.magneticStrength.toFixed(1)} µT)`;
    ctx.font = 'bold 9px "JetBrains Mono", sans-serif';
    const textWidth = ctx.measureText(labelText).width;
    const cardW = textWidth + 12;
    const cardH = 16;
    const cardX = fx - cardW / 2;
    const cardY = fy - 32;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = pinColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, fx, cardY + cardH / 2);

    ctx.restore();
  });

  // 8. Compass Rose / North Indicator (Top Right)
  ctx.save();
  const compX = padX + mapW - 28;
  const compY = padY + 30;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(compX, compY, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // North Arrow (Red)
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(compX, compY - 14);
  ctx.lineTo(compX - 4, compY);
  ctx.lineTo(compX + 4, compY);
  ctx.closePath();
  ctx.fill();

  // South Arrow (Slate)
  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.moveTo(compX, compY + 14);
  ctx.lineTo(compX - 4, compY);
  ctx.lineTo(compX + 4, compY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', compX, compY - 17);
  ctx.restore();

  // 9. Metric Scale Bar (Bottom Left)
  ctx.save();
  const totalMeters = haversineDistance(minLat, minLng, minLat, maxLng);
  const scaleBarPixels = 100;
  const metersPerPixel = totalMeters / mapW;
  const scaleBarMeters = Math.round(metersPerPixel * scaleBarPixels);

  const scaleX = padX + 15;
  const scaleY = padY + mapH - 18;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(scaleX - 6, scaleY - 14, scaleBarPixels + 12, 22);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(scaleX, scaleY);
  ctx.lineTo(scaleX + scaleBarPixels, scaleY);
  ctx.moveTo(scaleX, scaleY - 5);
  ctx.lineTo(scaleX, scaleY + 5);
  ctx.moveTo(scaleX + scaleBarPixels, scaleY - 5);
  ctx.lineTo(scaleX + scaleBarPixels, scaleY + 5);
  ctx.stroke();

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '9px "JetBrains Mono", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    `${scaleBarMeters >= 1000 ? (scaleBarMeters / 1000).toFixed(1) + ' km' : scaleBarMeters + ' m'}`,
    scaleX + scaleBarPixels / 2,
    scaleY - 4
  );
  ctx.restore();

  // 10. Bottom Category & Route Legend Strip
  ctx.save();
  const legendY = height - 22;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, height - 32, width, 32);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height - 32);
  ctx.lineTo(width, height - 32);
  ctx.stroke();

  const legends = [
    { label: '★ Emas', color: '#eab308' },
    { label: '☄ Meteorit', color: '#c084fc' },
    { label: '◈ Perak', color: '#38bdf8' },
    { label: '⬢ Perunggu', color: '#f97316' },
    { label: '⛏ Besi/Ferrous', color: '#94a3b8' },
    { label: '― Rute GPS', color: '#22d3ee' },
    { label: '● Titik Surveyor', color: '#0284c7' },
  ];

  ctx.font = '10px "JetBrains Mono", sans-serif';
  let curLegX = 24;
  legends.forEach((leg) => {
    ctx.fillStyle = leg.color;
    ctx.beginPath();
    ctx.arc(curLegX + 5, legendY, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(leg.label, curLegX + 13, legendY);
    curLegX += ctx.measureText(leg.label).width + 24;
  });
  ctx.restore();

  return canvas.toDataURL('image/png', 0.95);
}

/**
 * Export findings to RFC-compliant CSV with UTF-8 BOM for Excel and Google Sheets
 */
export function exportFindingsToCSV(findings: MetalFinding[], filename?: string): void {
  if (findings.length === 0) {
    alert('Tidak ada titik temuan untuk diekspor!');
    return;
  }

  const headers = [
    'Nomor_Index',
    'ID_Temuan',
    'Waktu_ISO',
    'Tanggal_Lokal',
    'Jam_Lokal',
    'Latitude',
    'Longitude',
    'Akurasi_GPS_Meter',
    'Fluks_Magnetik_Total_uT',
    'Fluks_Net_Anomali_uT',
    'Kategori_Material',
    'Nama_Temuan',
    'Nama_Lokasi_Landmark',
    'Estimasi_Kedalaman_cm',
    'Identifikasi_Artefak_AI',
    'Era_Historis_AI',
    'Metode_Perekaman',
    'Tautan_Navigasi_Google_Maps',
    'Catatan_Lapangan',
  ];

  const rows = findings.map((f, index) => {
    const d = new Date(f.timestamp);
    const dateStr = d.toISOString().split('T')[0];
    const timeStr = d.toTimeString().split(' ')[0];
    const gmapsUrl = `https://www.google.com/maps?q=${f.lat},${f.lng}`;

    return [
      index + 1,
      `"${f.id}"`,
      d.toISOString(),
      dateStr,
      timeStr,
      f.lat.toFixed(6),
      f.lng.toFixed(6),
      f.accuracy ? f.accuracy.toFixed(1) : '0',
      f.magneticStrength.toFixed(2),
      f.netStrength.toFixed(2),
      `"${f.category}"`,
      `"${(f.name || '').replace(/"/g, '""')}"`,
      `"${(f.locationName || '').replace(/"/g, '""')}"`,
      f.depthEstimateCm,
      `"${(f.aiAnalysis?.artifactName || '').replace(/"/g, '""')}"`,
      `"${(f.aiAnalysis?.historicalEra || '').replace(/"/g, '""')}"`,
      f.autoSaved ? 'Otomatis (Auto-GPS)' : 'Manual',
      `"${gmapsUrl}"`,
      `"${(f.note || '').replace(/"/g, '""')}"`,
    ];
  });

  // Prepend UTF-8 BOM (\uFEFF) so Excel, Google Sheets, Numbers open Indonesian characters cleanly
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
  const targetFilename =
    filename || `metalscan_pro_temuan_${new Date().toISOString().slice(0, 10)}.csv`;

  downloadBlob(csvContent, targetFilename, 'text/csv;charset=utf-8;');
}

/**
 * Export findings, travel route map, and organized GPS table to an official 'Laporan PDF Profesional'
 */
export async function exportFindingsToPDF(
  findings: MetalFinding[],
  userLocation?: GPSLocation | null,
  options?: {
    surveyTitle?: string;
    surveyorName?: string;
    areaLocation?: string;
  }
): Promise<void> {
  if (findings.length === 0) {
    alert('Tidak ada titik temuan untuk dibuat laporan PDF!');
    return;
  }

  // 1. Fetch Travel Route and Route Summary
  const trail = trailService.getPoints();
  const trailSummary = trailService.getSummary();

  // 2. Generate High-Res Geographic Map Snapshot including Travel Route
  const mapImageBase64 = await generateMapSnapshot(findings, userLocation, 960, 540, trail);

  // 3. Initialize jsPDF Document (A4 Portrait, mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Header Banner Background (Dark Tactical Slate)
  doc.setFillColor(15, 23, 42); // #0f172a
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Cyan Accent Line
  doc.setFillColor(6, 182, 212); // #06b6d4
  doc.rect(0, 40, pageWidth, 1.8, 'F');

  // Brand & Official Report Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('LAPORAN HASIL SURVEI EKSPLORASI LOGAM & ARTEFAK', margin, 14);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // #94a3b8
  doc.text(
    `MetalScan Pro • Precision Geological & Relic Field Detection Suite`,
    margin,
    21
  );

  doc.text(
    `Surveyor: ${options?.surveyorName || 'Prospector / Surveyor Lapangan'} | Lokasi: ${
      options?.areaLocation || 'Sektor Eksplorasi Geofisika'
    } | Tanggal: ${new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}`,
    margin,
    27
  );

  doc.text(
    `Total Sasaran: ${findings.length} Titik Temuan | Panjang Rute Jelajah: ${
      trailSummary.totalDistanceMeters >= 1000
        ? (trailSummary.totalDistanceMeters / 1000).toFixed(2) + ' km'
        : Math.round(trailSummary.totalDistanceMeters) + ' meter'
    } (${Math.round(trailSummary.durationSeconds / 60)} Menit)`,
    margin,
    33
  );

  // Official Status Badge
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(pageWidth - margin - 48, 9, 48, 22, 2, 2, 'F');
  doc.setTextColor(56, 189, 248);
  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.text('DOKUMEN RESMI', pageWidth - margin - 45, 16);
  doc.setTextColor(203, 213, 225);
  doc.setFontSize(6.5);
  doc.text('LAPORAN PDF PROFESIONAL', pageWidth - margin - 45, 21);
  doc.text(`ID: MSP-${Date.now().toString().slice(-7)}`, pageWidth - margin - 45, 26);

  let currentY = 48;

  // SECTION 1: RINGKASAN STATISTIK TEMUAN & RUTE JELAJAH (6 KPI Cards)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('1. RINGKASAN STATISTIK TEMUAN & PARAMETER SURVEI', margin, currentY);

  currentY += 4;

  const highestFlux = findings.reduce((max, f) => Math.max(max, f.magneticStrength), 0);
  const avgFlux =
    findings.reduce((sum, f) => sum + f.magneticStrength, 0) / (findings.length || 1);
  const goldCount = findings.filter((f) => f.category === 'gold').length;
  const meteoriteCount = findings.filter((f) => f.category === 'meteorite').length;
  const relicCount = findings.filter((f) => f.category === 'silver' || f.category === 'bronze').length;
  const avgDepth = Math.round(
    findings.reduce((sum, f) => sum + (f.depthEstimateCm || 15), 0) / (findings.length || 1)
  );

  const cardW = (contentWidth - 10) / 3;
  const cardH = 15;

  const statsCards = [
    {
      label: 'TOTAL TITIK TEMUAN',
      val: `${findings.length} Titik`,
      sub: `Fluks Rata: ${avgFlux.toFixed(1)} µT`,
      color: [15, 23, 42],
    },
    {
      label: 'FLUKS ANOMALI PUNCAK',
      val: `${highestFlux.toFixed(1)} µT`,
      sub: `Ambang Auto: Aktif`,
      color: [245, 158, 11],
    },
    {
      label: 'EMAS & METEORIT',
      val: `${goldCount + meteoriteCount} Sasaran`,
      sub: `Relik Lainnya: ${relicCount} Titik`,
      color: [147, 51, 234],
    },
    {
      label: 'RATA KEDALAMAN TANAH',
      val: `~${avgDepth} cm`,
      sub: `Estimasi Sensor Lapangan`,
      color: [14, 165, 233],
    },
    {
      label: 'TOTAL JARAK JELAJAH RUTE',
      val:
        trailSummary.totalDistanceMeters >= 1000
          ? `${(trailSummary.totalDistanceMeters / 1000).toFixed(2)} km`
          : `${Math.round(trailSummary.totalDistanceMeters)} meter`,
      sub: `GPS Track: ${trail.length} Titik`,
      color: [16, 185, 129],
    },
    {
      label: 'DURASI WAKTU SURVEI',
      val: `${Math.max(1, Math.round(trailSummary.durationSeconds / 60))} Menit`,
      sub: `Baseline: ~${trailSummary.baseline.toFixed(0)} µT`,
      color: [100, 116, 139],
    },
  ];

  statsCards.forEach((kpi, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const kx = margin + col * (cardW + 5);
    const ky = currentY + row * (cardH + 3);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(kx, ky, cardW, cardH, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, kx + 3, ky + 4.5);

    doc.setFontSize(10);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.val, kx + 3, ky + 9.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text(kpi.sub, kx + 3, ky + 13);
  });

  currentY += cardH * 2 + 8;

  // SECTION 2: PETA RUTE PERJALANAN & SEBARAN TITIK TEMUAN (High-Res Map Snapshot)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('2. PETA RUTE PERJALANAN & SEBARAN TITIK TEMUAN (GPS TACTICAL MAP)', margin, currentY);

  currentY += 3.5;

  const mapImageWidth = contentWidth;
  const mapImageHeight = 88; // mm

  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.4);
  doc.rect(margin, currentY, mapImageWidth, mapImageHeight);
  doc.addImage(mapImageBase64, 'PNG', margin, currentY, mapImageWidth, mapImageHeight);

  currentY += mapImageHeight + 3.5;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    '* Peta rute perjalanan di atas memvisualisasikan jalur lintasan GPS surveyor (garis biru neon), titik awal (START), nomor pin temuan, dan kontur anomali medan magnetik riil.',
    margin,
    currentY
  );

  currentY += 6;

  // SECTION 3: DAFTAR KOORDINAT GPS DALAM TABEL YANG RAPI
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('3. DAFTAR KOORDINAT GPS & DATA TITIK TEMUAN', margin, currentY);

  currentY += 2.5;

  // Format Table Data Rows
  const tableRows = findings.map((f, idx) => {
    const d = new Date(f.timestamp);
    const dateFormatted = d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
    const timeFormatted = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let catLabel = f.category.toUpperCase();
    if (f.category === 'gold') catLabel = 'EMAS';
    else if (f.category === 'meteorite') catLabel = 'METEORIT';
    else if (f.category === 'silver') catLabel = 'PERAK';
    else if (f.category === 'bronze') catLabel = 'PERUNGGU';
    else if (f.category === 'iron') catLabel = 'BESI';

    const locationText = f.locationName ? `\n📍 ${f.locationName}` : '';
    const aiText = f.aiAnalysis
      ? `\n[Artefak: ${f.aiAnalysis.artifactName} (${f.aiAnalysis.historicalEra})]`
      : '';

    return [
      (idx + 1).toString(),
      `${dateFormatted}\n${timeFormatted}`,
      `${f.name}${locationText}${aiText}`,
      catLabel,
      `${f.lat.toFixed(6)},\n${f.lng.toFixed(6)}`,
      `${f.accuracy ? f.accuracy.toFixed(0) : '3'}m`,
      `${f.magneticStrength.toFixed(1)} µT\n(Net: +${f.netStrength.toFixed(1)})`,
      `~${f.depthEstimateCm || 15} cm`,
      f.autoSaved ? 'Auto-GPS' : 'Manual Pin',
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        'No',
        'Waktu',
        'Nama Temuan & Landmark Lokasi',
        'Kategori',
        'Koordinat GPS',
        'Akurasi',
        'Fluks Medan',
        'Kedalaman',
        'Metode',
      ],
    ],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
    },
    styles: {
      fontSize: 7,
      cellPadding: 2,
      textColor: [30, 41, 59],
      valign: 'middle',
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8, fontStyle: 'bold' },
      1: { halign: 'center', cellWidth: 18 },
      2: { cellWidth: 50 },
      3: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
      4: { halign: 'center', cellWidth: 26, font: 'courier' },
      5: { halign: 'center', cellWidth: 14 },
      6: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
      7: { halign: 'center', cellWidth: 14 },
      8: { halign: 'center', cellWidth: 16 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawPage: (data) => {
      // Footer with page numbering
      const totalPages = doc.getNumberOfPages();
      const currentPage = data.pageNumber;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `MetalScan Pro • Laporan PDF Profesional Eksplorasi Geofisika GPS & Magnetometer`,
        margin,
        pageHeight - 8
      );
      doc.text(
        `Halaman ${currentPage} dari ${totalPages}`,
        pageWidth - margin - 24,
        pageHeight - 8
      );
    },
  });

  // 4. Trigger direct PDF download
  const pdfFilename = `metalscan_pro_laporan_profesional_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(pdfFilename);
}

function downloadBlob(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
