import React, { useState } from 'react';
import {
  Globe,
  Cloud,
  Server,
  Terminal,
  CheckCircle2,
  Copy,
  ExternalLink,
  X,
  Layers,
  Sparkles,
  ShieldCheck,
  Zap,
  Info,
  ChevronRight,
} from 'lucide-react';

interface FreeDeploymentGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DeployPlatform {
  id: string;
  name: string;
  badge: string;
  type: 'Full-Stack (Node + Express)' | 'Static PWA (Fastest)';
  cost: 'Gratis 100%' | 'Gratis (Free Tier)';
  summary: string;
  pros: string[];
  steps: {
    title: string;
    description: string;
    command?: string;
  }[];
  configSample?: {
    filename: string;
    content: string;
  };
}

export const FREE_DEPLOY_PLATFORMS: DeployPlatform[] = [
  {
    id: 'render',
    name: 'Render.com',
    badge: 'Rekomendasi Utama Fullstack',
    type: 'Full-Stack (Node + Express)',
    cost: 'Gratis 100%',
    summary:
      'Layanan cloud modern pengganti Heroku. Menyediakan hosting gratis untuk Web Service (Node.js/Express) maupun Static Site, dilengkapi SSL HTTPS otomatis gratis (krusial agar sensor Magnetometer & GPS PWA diizinkan browser).',
    pros: [
      'Mendukung server.ts Express backend langsung',
      'Gratis SSL HTTPS otomatis (wajib untuk sensor HP & PWA)',
      'Deploy otomatis dari GitHub setiap kali git push',
      'Subdomain gratis (contoh: metalscan.onrender.com)',
    ],
    steps: [
      {
        title: '1. Buat Repositori GitHub',
        description: 'Pastikan kode aplikasi Anda telah dipush ke repositori GitHub pribadi atau publik.',
      },
      {
        title: '2. Daftar di Render.com & Sambungkan GitHub',
        description: 'Buka render.com, daftar gratis menggunakan akun GitHub Anda.',
      },
      {
        title: '3. Buat Web Service Baru',
        description: 'Klik "New +" -> pilih "Web Service" -> pilih repositori GitHub MetalScan Anda.',
      },
      {
        title: '4. Atur Parameter Build & Start',
        description: 'Isi pengaturan konfigurasi berikut:',
        command: 'Build Command: npm install && npm run build\nStart Command: npx tsx server.ts (atau node server.ts)',
      },
      {
        title: '5. Tambahkan Environment Variable',
        description: 'Di tab "Environment", tambahkan NODE_ENV=production dan PORT=3000 (serta GEMINI_API_KEY jika menggunakan fitur AI). Klik "Create Web Service"!',
      },
    ],
    configSample: {
      filename: 'render.yaml',
      content: `services:
  - type: web
    name: metalscan-pro
    env: node
    plan: free
    buildCommand: npm install && npm run build
    startCommand: npx tsx server.ts
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000`,
    },
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare Pages',
    badge: 'Tercepat & Bandwidth Tak Terbatas',
    type: 'Static PWA (Fastest)',
    cost: 'Gratis 100%',
    summary:
      'Platform hosting statis gratis terbaik di dunia dengan 300+ data center global (termasuk Jakarta). Kecepatan loading instan, tanpa batasan bandwidth bulanan, dan 100% mendukung PWA Service Worker offline.',
    pros: [
      'Bandwidth bulanan unlimited 100% tanpa bayar',
      'Data center di Jakarta (latensi < 10ms di Indonesia)',
      'Dukungan penuh PWA manifest & offline precaching',
      'SSL/TLS bintang lima otomatis',
    ],
    steps: [
      {
        title: '1. Masuk ke Cloudflare Dashboard',
        description: 'Kunjungi dash.cloudflare.com -> pilih menu "Workers & Pages" -> "Create application" -> "Pages".',
      },
      {
        title: '2. Hubungkan Repositori GitHub',
        description: 'Pilih repo MetalScan Pro dan klik "Begin setup".',
      },
      {
        title: '3. Pengaturan Build Framework',
        description: 'Pilih framework preset "Vite":',
        command: 'Build command: npm run build\nBuild output directory: dist\nNode.js version: 18 atau 20',
      },
      {
        title: '4. Klik "Save and Deploy"',
        description: 'Dalam 45 detik, aplikasi MetalScan Pro Anda akan aktif di *.pages.dev dengan sertifikat HTTPS valid!',
      },
    ],
  },
  {
    id: 'railway',
    name: 'Railway.app',
    badge: 'Developer Experience Terbaik',
    type: 'Full-Stack (Node + Express)',
    cost: 'Gratis (Free Tier)',
    summary:
      'Platform cloud revolusioner dengan setup nol konfigurasi. Mendeteksi Node.js secara otomatis dan menjalankan server Express beserta Vite tanpa perlu file konfigurasi rumit.',
    pros: [
      'Setup instan 1-klik dari GitHub',
      'Mendukung container Docker dan server Node.js secara native',
      'Dashboard metrik real-time & logs interaktif',
      'Domain publik HTTPS gratis',
    ],
    steps: [
      {
        title: '1. Login ke Railway.app',
        description: 'Masuk dengan akun GitHub di railway.app.',
      },
      {
        title: '2. Buat New Project dari Repo GitHub',
        description: 'Pilih "Deploy from GitHub repo" dan pilih repositori Anda.',
      },
      {
        title: '3. Generate Domain',
        description: 'Di tab "Settings", klik "Generate Domain" untuk mendapatkan URL publik gratis.',
      },
    ],
  },
  {
    id: 'koyeb',
    name: 'Koyeb',
    badge: 'Alternatif Serverless Nano',
    type: 'Full-Stack (Node + Express)',
    cost: 'Gratis 100%',
    summary:
      'Layanan cloud serverless modern dengan tier gratis "Eco". Menjalankan server aplikasi Node.js atau Docker container secara berkesinambungan dengan koneksi global berkecepatan tinggi.',
    pros: [
      'Instance nano gratis tanpa kartu kredit di awal',
      'Dukungan HTTP/2 dan TLS otomatis',
      'Lokasi server fleksibel (Frankfurt, Washington, Tokyo)',
      'Bisa deploy dari git repository langsung',
    ],
    steps: [
      {
        title: '1. Daftar di Koyeb.com',
        description: 'Kunjungi koyeb.com dan buat akun gratis.',
      },
      {
        title: '2. Buat App & Pilih GitHub',
        description: 'Pilih "GitHub" sebagai sumber deployment.',
      },
      {
        title: '3. Tentukan Build & Run Command',
        description: 'Build command: npm run build | Run command: npx tsx server.ts',
      },
    ],
  },
  {
    id: 'github_pages',
    name: 'GitHub Pages',
    badge: 'Gratis Bawaan GitHub',
    type: 'Static PWA (Fastest)',
    cost: 'Gratis 100%',
    summary:
      'Solusi hosting gratis langsung dari repositori kode Anda. Cocok untuk menjalankan versi klien frontend PWA tanpa memerlukan backend terpisah.',
    pros: [
      'Terintegrasi langsung di repositori kode tanpa registrasi pihak ketiga',
      'Otomasi deployment via GitHub Actions (file workflow otomatis)',
      'Penyimpanan dan hosting gratis selamanya',
    ],
    steps: [
      {
        title: '1. Buka Repositori -> Settings -> Pages',
        description: 'Di menu "Source", pilih "GitHub Actions".',
      },
      {
        title: '2. Gunakan Template Static HTML / Vite',
        description: 'GitHub menyediakan workflow otomatis untuk membuild npm run build dan mempublikasikan folder dist.',
      },
    ],
  },
];

export const FreeDeploymentGuideModal: React.FC<FreeDeploymentGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedId, setSelectedId] = useState<string>('render');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentPlatform =
    FREE_DEPLOY_PLATFORMS.find((p) => p.id === selectedId) || FREE_DEPLOY_PLATFORMS[0];

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-[750] flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 font-mono">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-900/40 text-white">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Panduan Deploy Gratis
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Selain Vercel & Netlify
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Pilihan cloud hosting gratis 100% dengan HTTPS untuk PWA & Sensor HP
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Important Requirement Note for Sensors & PWA */}
          <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 text-xs text-slate-300 flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-cyan-300">PENTING untuk Sensor & PWA:</span> Browser (Chrome, Safari, Firefox) mewajibkan protokol <strong>HTTPS</strong> agar sensor Magnetometer HP, Geolocation GPS Presisi, dan PWA Service Worker diizinkan berjalan. Seluruh 5 platform di bawah menyediakan sertifikat HTTPS gratis otomatis.
            </div>
          </div>

          {/* Platform Tab Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {FREE_DEPLOY_PLATFORMS.map((platform) => {
              const isSelected = platform.id === selectedId;
              return (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => setSelectedId(platform.id)}
                  className={`p-2.5 rounded-2xl border text-left transition-all active:scale-98 ${
                    isSelected
                      ? 'bg-slate-800 border-cyan-400 text-white shadow-md shadow-cyan-950/50'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs font-bold truncate">{platform.name}</div>
                  <div className="text-[9px] text-cyan-300 mt-0.5 truncate">{platform.cost}</div>
                </button>
              );
            })}
          </div>

          {/* Active Platform Details Card */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-extrabold text-white">{currentPlatform.name}</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {currentPlatform.badge}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                  <span>Tipe: <strong className="text-cyan-300">{currentPlatform.type}</strong></span>
                  <span>•</span>
                  <span>Biaya: <strong className="text-emerald-400">{currentPlatform.cost}</strong></span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {currentPlatform.summary}
            </p>

            {/* Keunggulan */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Keunggulan Utama:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                {currentPlatform.pros.map((pro, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-slate-900/60 p-2 rounded-xl border border-slate-800/60">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{pro}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Langkah-Langkah Deployment */}
            <div className="space-y-3 pt-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Langkah-Langkah Deploy Step-by-Step:
              </span>
              <div className="space-y-2.5">
                {currentPlatform.steps.map((step, idx) => (
                  <div key={idx} className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800/80 space-y-1.5">
                    <div className="text-xs font-bold text-cyan-300">{step.title}</div>
                    <div className="text-[11px] text-slate-300">{step.description}</div>
                    {step.command && (
                      <div className="relative mt-2">
                        <pre className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[10px] text-emerald-300 overflow-x-auto select-all">
                          {step.command}
                        </pre>
                        <button
                          type="button"
                          onClick={() => handleCopy(step.command!, `cmd-${idx}`)}
                          className="absolute top-2 right-2 p-1 rounded-md bg-slate-800 text-slate-300 hover:text-white text-[9px] flex items-center gap-1 border border-slate-700"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedText === `cmd-${idx}` ? 'Disalin!' : 'Salin'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Optional Config Sample */}
            {currentPlatform.configSample && (
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-bold">File Konfigurasi Opsional ({currentPlatform.configSample.filename}):</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(currentPlatform.configSample!.content, 'config')}
                    className="flex items-center gap-1 text-[10px] text-cyan-400 hover:underline"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedText === 'config' ? 'Tersalin!' : 'Salin File'}</span>
                  </button>
                </div>
                <pre className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-[10px] text-slate-300 overflow-x-auto">
                  {currentPlatform.configSample.content}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 hidden sm:block">
            Semua platform di atas mendukung protokol HTTPS gratis untuk PWA.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-bold transition-colors ml-auto"
          >
            Tutup Panduan
          </button>
        </div>
      </div>
    </div>
  );
};
