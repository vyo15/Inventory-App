import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// AKTIF + GUARDED:
// Konfigurasi utama Vite untuk build IMS Bunga Flanel.
// File ini hanya mengatur proses build/frontend dev server, tidak menyentuh flow bisnis,
// stok, kas, produksi, laporan, maupun akses database runtime.
export default defineConfig(({ mode }) => {
  const isTestMode = mode === "test";

  return {
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

    ...(isTestMode
      ? {
          // Node 22.12+ mengenali condition "module-sync" pada React Router 7.
          // Samakan resolusi client dan SSR Vitest agar tidak mencampur build CJS/ESM.
          resolve: {
            conditions: ["module-sync"],
          },
          ssr: {
            resolve: {
              conditions: ["module-sync"],
            },
          },
        }
      : {}),

    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.js",
      restoreMocks: true,
      clearMocks: true,
      css: true,
      coverage: {
        provider: "v8",
        reporter: ["text", "json-summary", "html"],
        reportsDirectory: "coverage",
        include: [
          "src/components/Auth/ProtectedRoute.jsx",
          "src/config/**/*.js",
          "src/data/adapters/sqlite/sqliteProductionAdapter.js",
          "src/pages/Auth/Login.jsx",
          "src/pages/Finance/helpers/financePeriodHelpers.js",
          "src/services/Maintenance/maintenanceLogService.js",
          "src/services/Pricing/pricingService.js",
          "src/services/Produksi/productionWorkLogsService.js",
          "src/services/System/*.js",
          "src/services/Transaksi/*.js",
          "src/utils/auth/roleAccess.js",
          "src/utils/export/sheetJsWriteAdapter.js",
          "src/utils/navigation/sidebarNavigation.js",
          "src/utils/variants/variantStockNormalizer.js",
        ],
        exclude: ["**/*.test.{js,jsx}"],
        thresholds: {
          statements: 55,
          branches: 38,
          functions: 35,
          lines: 60,
        },
      },
    },

    build: {
      // AKTIF + GUARDED:
      // Vendor split dibatasi ke library stabil. Business/page modules tetap mengikuti
      // dynamic import route agar tidak membuat coupling manual antarmodul IMS.
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = String(id || "").replaceAll("\\", "/");
            if (!normalizedId.includes("/node_modules/")) return undefined;
            if (/\/node_modules\/(react|react-dom|react-router|react-router-dom)\//.test(normalizedId)) {
              return "vendor-react";
            }
            if (normalizedId.includes("/node_modules/dayjs/")) return "vendor-date";
            return undefined;
          },
        },
      },
      chunkSizeWarningLimit: 900,
    },
  };
});
