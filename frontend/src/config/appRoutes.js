import { ROUTE_ACCESS_KEYS } from "../utils/auth/roleAccess";

// =========================
// SECTION: Canonical Frontend Routes — AKTIF / GUARDED
// Fungsi:
// - menjadi single source of truth untuk route Inventory dan Production;
// - menjaga pola URL konsisten: /module dan /module/feature.
// Guardrail:
// - perubahan path wajib diselaraskan dengan AppRoutes, sidebar, Dashboard, test, dan docs;
// - routeKey tidak diubah di file ini.
// =========================
export const APP_ROUTES = Object.freeze({
  INVENTORY: Object.freeze({
    HUB: "/inventory",
    STOCK_MANAGEMENT: "/inventory/stock-management",
  }),
  PRODUCTION: Object.freeze({
    HUB: "/production",
    PLANNING: "/production/planning",
    ORDERS: "/production/orders",
    WORK_LOGS: "/production/work-logs",
    STEPS: "/production/steps",
    EMPLOYEES: "/production/employees",
    PROFILES: "/production/profiles",
    SEMI_FINISHED_MATERIALS: "/production/semi-finished-materials",
    BOMS: "/production/boms",
    PAYROLLS: "/production/payrolls",
    HPP_ANALYSIS: "/production/hpp-analysis",
  }),
});

// =========================
// SECTION: Legacy Child Route Redirects — COMPATIBILITY / CLEANUP CANDIDATE
// Fungsi:
// - menjaga bookmark child route yang sebelumnya merupakan route aktif;
// - mengarahkan seluruh link lama ke canonical route tanpa melewati role guard.
// Guardrail:
// - exact hub lama /stock dan /produksi sengaja tidak dipertahankan;
// - menu, Dashboard, helper, dan docs operasional wajib memakai APP_ROUTES;
// - hapus bridge ini hanya lewat cleanup terpisah setelah penggunaan bookmark lama diaudit.
// =========================
export const LEGACY_ROUTE_REDIRECTS = Object.freeze([
  Object.freeze({
    from: "/stock-adjustment",
    to: APP_ROUTES.INVENTORY.STOCK_MANAGEMENT,
    routeKey: ROUTE_ACCESS_KEYS.STOCK_MANAGEMENT,
  }),
  Object.freeze({
    from: "/stock-management",
    to: APP_ROUTES.INVENTORY.STOCK_MANAGEMENT,
    routeKey: ROUTE_ACCESS_KEYS.STOCK_MANAGEMENT,
  }),
  Object.freeze({
    from: "/produksi/production-planning",
    to: APP_ROUTES.PRODUCTION.PLANNING,
    routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_PLANNING,
  }),
  Object.freeze({
    from: "/produksi/production-orders",
    to: APP_ROUTES.PRODUCTION.ORDERS,
    routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_ORDERS,
  }),
  Object.freeze({
    from: "/produksi/work-log-produksi",
    to: APP_ROUTES.PRODUCTION.WORK_LOGS,
    routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_WORK_LOGS,
  }),
  Object.freeze({
    from: "/produksi/tahapan-produksi",
    to: APP_ROUTES.PRODUCTION.STEPS,
    routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_STEPS,
  }),
  Object.freeze({
    from: "/produksi/karyawan-produksi",
    to: APP_ROUTES.PRODUCTION.EMPLOYEES,
    routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_EMPLOYEES,
  }),
  Object.freeze({
    from: "/produksi/profil-produksi",
    to: APP_ROUTES.PRODUCTION.PROFILES,
    routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_PROFILES,
  }),
  Object.freeze({
    from: "/produksi/semi-finished-materials",
    to: APP_ROUTES.PRODUCTION.SEMI_FINISHED_MATERIALS,
    routeKey: ROUTE_ACCESS_KEYS.SEMI_FINISHED_MATERIALS,
  }),
  Object.freeze({
    from: "/produksi/bom-produksi",
    to: APP_ROUTES.PRODUCTION.BOMS,
    routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_BOMS,
  }),
  Object.freeze({
    from: "/produksi/payroll-produksi",
    to: APP_ROUTES.PRODUCTION.PAYROLLS,
    routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_PAYROLLS,
  }),
  Object.freeze({
    from: "/produksi/analisis-hpp",
    to: APP_ROUTES.PRODUCTION.HPP_ANALYSIS,
    routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_HPP_ANALYSIS,
  }),
]);
