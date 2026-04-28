import React, { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Spin } from "antd";
import ProtectedRoute from "../components/Auth/ProtectedRoute";
import { ROUTE_ACCESS_KEYS } from "../utils/auth/roleAccess";

// =========================
// SECTION: Lazy Loaded Pages — AKTIF
// Fungsi:
// - menjaga bundle awal tetap ringan dengan lazy import halaman.
// Hubungan flow aplikasi:
// - import halaman bisnis tetap sama; Fase D hanya menambahkan route/menu guard.
// Status:
// - AKTIF.
// - GUARDED: jangan mengubah path/import bisnis tanpa task khusus modul terkait.
// =========================
const Dashboard = lazy(() => import("../pages/Dashboard/Dashboard"));
const WeLost = lazy(() => import("../pages/ErrorPage/WeLost"));
const Unauthorized = lazy(() => import("../pages/Auth/Unauthorized"));

const Categories = lazy(() => import("../pages/MasterData/Categories"));
const Customers = lazy(() => import("../pages/MasterData/Customers"));
const PricingRules = lazy(() => import("../pages/MasterData/PricingRules"));
const Products = lazy(() => import("../pages/MasterData/Products"));
const RawMaterials = lazy(() => import("../pages/MasterData/RawMaterials"));
const SupplierPurchases = lazy(
  () => import("../pages/MasterData/SupplierPurchases"),
);

const ProductionSteps = lazy(() => import("../pages/Produksi/ProductionSteps"));
const ProductionEmployees = lazy(
  () => import("../pages/Produksi/ProductionEmployees"),
);
const ProductionProfiles = lazy(
  () => import("../pages/Produksi/ProductionProfiles"),
);
const SemiFinishedMaterials = lazy(
  () => import("../pages/Produksi/SemiFinishedMaterials"),
);
const ProductionBoms = lazy(() => import("../pages/Produksi/ProductionBoms"));
const ProductionPlanning = lazy(
  () => import("../pages/Produksi/ProductionPlanning"),
);
const ProductionWorkLogs = lazy(
  () => import("../pages/Produksi/ProductionWorkLogs"),
);
const ProductionPayrolls = lazy(
  () => import("../pages/Produksi/ProductionPayrolls"),
);
const ProductionHppAnalysis = lazy(
  () => import("../pages/Produksi/ProductionHppAnalysis"),
);
const ProductionOrders = lazy(
  () => import("../pages/Produksi/ProductionOrders"),
);

const StockManagement = lazy(
  () => import("../pages/Inventory/StockManagement"),
);

const Purchases = lazy(() => import("../pages/Transaksi/Purchases"));
const Returns = lazy(() => import("../pages/Transaksi/Returns"));
const Sales = lazy(() => import("../pages/Transaksi/Sales"));

const CashIn = lazy(() => import("../pages/Finance/CashIn"));
const CashOut = lazy(() => import("../pages/Finance/CashOut"));

const ProfitLossReport = lazy(
  () => import("../pages/Laporan/ProfitLossReport"),
);
const PurchasesReport = lazy(() => import("../pages/Laporan/PurchasesReport"));
const SalesReport = lazy(() => import("../pages/Laporan/SalesReport"));
const StockReport = lazy(() => import("../pages/Laporan/StockReport"));
const PayrollReport = lazy(() => import("../pages/Laporan/PayrollReport"));
const UserManagement = lazy(() => import("../pages/System/UserManagement"));
const ResetMaintenanceData = lazy(
  () => import("../pages/Utilities/ResetMaintenanceData"),
);

// =========================
// SECTION: Route Loader — AKTIF
// Fungsi:
// - fallback saat lazy page sedang dimuat.
// Hubungan flow aplikasi:
// - tidak mengubah data bisnis; hanya UX loading route.
// =========================
const RouteLoader = () => (
  <div
    style={{
      minHeight: "40vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <Spin size="large" />
  </div>
);

// =========================
// SECTION: App Routes — AKTIF / GUARDED
// Fungsi:
// - mendefinisikan seluruh route aplikasi;
// - membungkus route bisnis dengan ProtectedRoute agar role tidak bisa bypass via URL.
// Hubungan flow aplikasi:
// - App.jsx/AuthProvider tetap menjadi login gate;
// - route guard menjadi pengaman tambahan berbasis role;
// - sidebar/menu guard Fase D hanya mengatur menu yang terlihat.
// Status:
// - AKTIF.
// - GUARDED: jangan mengubah business page di sini; hanya route access wrapper.
// Legacy / cleanup:
// - `/stock-adjustment` adalah legacy bridge ke Stock Management dan kandidat cleanup bila bookmark lama sudah tidak dipakai.
// =========================
const AppRoutes = ({ darkTheme }) => {
  const guardRoute = (routeKey, element) => (
    <ProtectedRoute routeKey={routeKey}>{element}</ProtectedRoute>
  );

  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        <Route
          path="/dashboard"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.DASHBOARD,
            <Dashboard darkTheme={darkTheme} />,
          )}
        />

        <Route
          path="/categories"
          element={guardRoute(ROUTE_ACCESS_KEYS.CATEGORIES, <Categories />)}
        />
        <Route
          path="/customers"
          element={guardRoute(ROUTE_ACCESS_KEYS.CUSTOMERS, <Customers />)}
        />
        <Route
          path="/pricing-rules"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.PRICING_RULES,
            <PricingRules />,
          )}
        />
        <Route
          path="/products"
          element={guardRoute(ROUTE_ACCESS_KEYS.PRODUCTS, <Products />)}
        />
        <Route
          path="/raw-materials"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.RAW_MATERIALS,
            <RawMaterials />,
          )}
        />
        <Route
          path="/suppliers"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.SUPPLIERS,
            <SupplierPurchases />,
          )}
        />

        <Route
          path="/produksi/tahapan-produksi"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.PRODUCTION_STEPS,
            <ProductionSteps />,
          )}
        />
        <Route
          path="/produksi/karyawan-produksi"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.PRODUCTION_EMPLOYEES,
            <ProductionEmployees />,
          )}
        />
        <Route
          path="/produksi/profil-produksi"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.PRODUCTION_PROFILES,
            <ProductionProfiles />,
          )}
        />
        <Route
          path="/produksi/semi-finished-materials"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.SEMI_FINISHED_MATERIALS,
            <SemiFinishedMaterials />,
          )}
        />
        <Route
          path="/produksi/production-planning"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.PRODUCTION_PLANNING,
            <ProductionPlanning />,
          )}
        />
        <Route
          path="/produksi/production-orders"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.PRODUCTION_ORDERS,
            <ProductionOrders />,
          )}
        />
        <Route
          path="/produksi/bom-produksi"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.PRODUCTION_BOMS,
            <ProductionBoms />,
          )}
        />
        <Route
          path="/produksi/work-log-produksi"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.PRODUCTION_WORK_LOGS,
            <ProductionWorkLogs />,
          )}
        />
        <Route
          path="/produksi/payroll-produksi"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.PRODUCTION_PAYROLLS,
            <ProductionPayrolls />,
          )}
        />
        <Route
          path="/produksi/analisis-hpp"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.PRODUCTION_HPP_ANALYSIS,
            <ProductionHppAnalysis />,
          )}
        />

        {/* =========================
            SECTION: Legacy Inventory Redirect — LEGACY / CLEANUP CANDIDATE
            Fungsi:
            - menjaga bookmark lama /stock-adjustment tidak error.
            Hubungan flow:
            - Penyesuaian Stok sudah digabung ke Stock Management sebagai satu entry point inventory.
            Status:
            - LEGACY bridge; route tetap diproteksi memakai akses Stock Management.
        ========================= */}
        <Route
          path="/stock-adjustment"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.STOCK_MANAGEMENT,
            <Navigate to="/stock-management" replace />,
          )}
        />
        <Route
          path="/stock-management"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.STOCK_MANAGEMENT,
            <StockManagement />,
          )}
        />

        <Route
          path="/purchases"
          element={guardRoute(ROUTE_ACCESS_KEYS.PURCHASES, <Purchases />)}
        />
        <Route
          path="/returns"
          element={guardRoute(ROUTE_ACCESS_KEYS.RETURNS, <Returns />)}
        />
        <Route
          path="/sales"
          element={guardRoute(ROUTE_ACCESS_KEYS.SALES, <Sales />)}
        />

        <Route
          path="/cash-in"
          element={guardRoute(ROUTE_ACCESS_KEYS.CASH_IN, <CashIn />)}
        />
        <Route
          path="/cash-out"
          element={guardRoute(ROUTE_ACCESS_KEYS.CASH_OUT, <CashOut />)}
        />

        <Route
          path="/profit-loss"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.PROFIT_LOSS,
            <ProfitLossReport />,
          )}
        />
        <Route
          path="/purchases-report"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.PURCHASES_REPORT,
            <PurchasesReport />,
          )}
        />
        <Route
          path="/sales-report"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.SALES_REPORT,
            <SalesReport />,
          )}
        />
        <Route
          path="/report-stock"
          element={guardRoute(ROUTE_ACCESS_KEYS.STOCK_REPORT, <StockReport />)}
        />
        <Route
          path="/payroll-report"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.PAYROLL_REPORT,
            <PayrollReport />,
          )}
        />

        <Route
          path="/system/user-management"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.USER_MANAGEMENT,
            <UserManagement />,
          )}
        />

        <Route
          path="/utilities/reset-maintenance-data"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.RESET_MAINTENANCE,
            <ResetMaintenanceData darkTheme={darkTheme} />,
          )}
        />
        <Route
          path="/utilities/reset-test-data"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.RESET_MAINTENANCE,
            <Navigate to="/utilities/reset-maintenance-data" replace />,
          )}
        />

        <Route path="*" element={<WeLost />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
