import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// AKTIF + GUARDED:
// Konfigurasi utama Vite untuk build dan deploy IMS Bunga Flanel.
// File ini hanya mengatur proses build/deploy, tidak menyentuh flow bisnis,
// stok, kas, produksi, laporan, maupun data Firebase.
export default defineConfig({
  // AKTIF:
  // Plugin React tetap dipakai agar Vite bisa memproses JSX/React refresh
  // sesuai entry aplikasi di src/main.jsx.
  plugins: [react()],

  // AKTIF + GUARDED:
  // Base path wajib dipertahankan untuk GitHub Pages karena aplikasi dibuka dari
  // https://vyo15.github.io/Inventory-App/.
  // Jangan diganti ke "/" kecuali target deploy sudah bukan GitHub Pages subpath.
  base: "/Inventory-App/",

  build: {
    // AKTIF + GUARDED:
    // Batas warning saja, bukan business rule. Nilai ini dipertahankan agar build
    // tidak gagal hanya karena bundle vendor lebih besar setelah manualChunks dihapus.
    chunkSizeWarningLimit: 900,
  },
});
