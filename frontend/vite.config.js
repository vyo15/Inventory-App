import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// AKTIF + GUARDED:
// Konfigurasi utama Vite untuk build IMS Bunga Flanel.
// File ini hanya mengatur proses build/frontend dev server, tidak menyentuh flow bisnis,
// stok, kas, produksi, laporan, maupun akses database runtime.
export default defineConfig({
  // AKTIF:
  // Plugin React tetap dipakai agar Vite bisa memproses JSX/React refresh
  // sesuai entry aplikasi di src/main.jsx.
  plugins: [react()],

  // AKTIF + GUARDED:
  // Base path dipertahankan agar URL lokal/LAN tetap konsisten dengan dev runner:
  // http://localhost:5173/Inventory-App/ dan http://IP-LAPTOP:5173/Inventory-App/.
  // Jangan diganti ke "/" kecuali route/base app ikut disesuaikan dan diuji ulang.
  base: "/Inventory-App/",

  server: {
    fs: {
      // Frontend perlu membaca util bersama di root monorepo, misalnya shared/passwordPolicy.js.
      allow: [fileURLToPath(new URL("..", import.meta.url))],
    },
  },

  build: {
    // AKTIF + GUARDED:
    // Batas warning saja, bukan business rule. Nilai ini dipertahankan agar build
    // tidak gagal hanya karena bundle vendor lebih besar setelah manualChunks dihapus.
    chunkSizeWarningLimit: 900,
  },
});
