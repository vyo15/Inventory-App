import { APP_ROUTES } from "../../../config/appRoutes";
import { formatNumberId } from "../../../utils/formatters/numberId";
import {
  formatDashboardDate,
  getNumericValue,
} from "./dashboardPageHelpers";

const INITIAL_SETUP_DISMISSED_STORAGE_KEY = "ims.dashboard.initialSetup.dismissed";

const INITIAL_SETUP_PHASES = Object.freeze([
  {
    key: "foundation",
    label: "Fase 1 · Fondasi",
    description: "Siapkan struktur dasar sebelum membuat master dan transaksi.",
  },
  {
    key: "operational-master",
    label: "Fase 2 · Master Operasional",
    description: "Lengkapi item, sumber restock, dan resep produksi.",
  },
  {
    key: "go-live",
    label: "Fase 3 · Go-Live",
    description: "Pastikan stok awal tercatat dan buat backup baseline.",
  },
]);

export const readInitialSetupDismissed = () => {
  try {
    return window.localStorage.getItem(INITIAL_SETUP_DISMISSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

export const writeInitialSetupDismissed = (dismissed) => {
  try {
    if (dismissed) {
      window.localStorage.setItem(INITIAL_SETUP_DISMISSED_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(INITIAL_SETUP_DISMISSED_STORAGE_KEY);
    }
  } catch {
    // Preferensi UI tidak boleh mengganggu Dashboard jika storage browser tidak tersedia.
  }
};

export const buildInitialSetupSteps = (readiness = {}) => {
  const flags = readiness?.flags || {};
  const counts = readiness?.counts || {};
  const diagnostics = readiness?.diagnostics || {};
  const categoryTotal = Object.values(counts.categoriesByType || {})
    .reduce((total, value) => total + getNumericValue(value), 0);

  return [
    {
      key: "categoriesReady",
      phase: "foundation",
      label: "Kategori & Kelompok",
      description: `${formatNumberId(categoryTotal)} kategori aktif untuk bentuk produk, jenis bunga, dan bahan.`,
      to: "/categories",
    },
    {
      key: "productionStepsReady",
      phase: "foundation",
      label: "Tahapan Produksi",
      description: `${formatNumberId(counts.productionSteps)} tahapan aktif untuk BOM dan Work Log.`,
      to: APP_ROUTES.PRODUCTION.STEPS,
    },
    {
      key: "productionEmployeesReady",
      phase: "foundation",
      label: "Karyawan Produksi",
      description: `${formatNumberId(counts.productionEmployees)} operator aktif untuk Work Log dan payroll.`,
      to: APP_ROUTES.PRODUCTION.EMPLOYEES,
    },
    {
      key: "masterItemsReady",
      phase: "operational-master",
      label: "Master Produk dan Bahan",
      description: `${formatNumberId(counts.products)} produk · ${formatNumberId(counts.rawMaterials)} bahan · ${formatNumberId(counts.semiFinished)} komponen.`,
      to: "/master-data",
    },
    {
      key: "supplierCatalogReady",
      phase: "operational-master",
      label: "Supplier & Katalog Restock",
      description: `${formatNumberId(counts.suppliers)} supplier · ${formatNumberId(counts.supplierOffers)} penawaran aktif.`,
      to: "/suppliers",
    },
    {
      key: "productionBomsReady",
      phase: "operational-master",
      label: "BOM / Resep Produksi",
      description: `${formatNumberId(counts.productionBoms)} BOM aktif sebagai dasar kebutuhan material.`,
      to: APP_ROUTES.PRODUCTION.BOMS,
    },
    {
      key: "openingStockReady",
      phase: "go-live",
      label: "Stok Awal Tercatat",
      description: diagnostics.positiveStockWithoutHistory
        ? `${formatNumberId(diagnostics.positiveStockWithoutHistoryItems)} item memiliki stok positif tanpa histori transaksi atau penyesuaian resmi.`
        : getNumericValue(counts.positiveStockItems) > 0
          ? `${formatNumberId(counts.positiveStockItems)} item memiliki stok dengan histori resmi.`
          : "Semua master masih dimulai dari stok 0; tidak ada opening stock yang perlu dicatat.",
      to: APP_ROUTES.INVENTORY.STOCK_MANAGEMENT,
      warning: Boolean(diagnostics.positiveStockWithoutHistory),
    },
    {
      key: "baselineBackupReady",
      phase: "go-live",
      label: "Backup Baseline Setup",
      description: diagnostics.latestVerifiedBackupAt
        ? `Backup verified terakhir: ${formatDashboardDate(diagnostics.latestVerifiedBackupAt)}.`
        : "Buat backup verified setelah seluruh master dan stok awal selesai diperiksa.",
      to: "/utilities/reset-maintenance-data",
    },
  ].map((step, index) => ({
    ...step,
    order: index + 1,
    complete: Boolean(flags[step.key]),
  }));
};

export const buildInitialSetupPhaseGroups = (steps = []) => INITIAL_SETUP_PHASES.map((phase) => ({
  ...phase,
  steps: steps.filter((step) => step.phase === phase.key),
}));
