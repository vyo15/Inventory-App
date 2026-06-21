import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "../components/Auth/ProtectedRoute";
import DataLoadingState from "../components/Layout/Feedback/DataLoadingState";
import {
  APP_ROUTES,
  LEGACY_ROUTE_REDIRECTS,
} from "../config/appRoutes";
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
const ModuleHub = lazy(() => import("../pages/Navigation/ModuleHub"));

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
const MoneyMovementLedger = lazy(
  () => import("../pages/Finance/MoneyMovementLedger"),
);

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

// =====================================================
// SECTION: Lazy Route Fallback — AKTIF / GUARDED
// Fungsi:
// - Menampilkan feedback ringan saat chunk halaman lazy belum siap agar transisi route tidak blank.
//
// Dipakai oleh:
// - Suspense fallback di AppRoutes.
//
// Alasan perubahan:
// - Fallback lazy route memakai DataLoadingState lokal, bukan logo/fullscreen, agar tidak terasa seperti restart aplikasi setelah layout tampil. Route definitions, lazy imports, ProtectedRoute, dan role guard tidak berubah.
//
// Catatan cleanup:
// - belum ada.
//
// Risiko:
// - Jika route structure atau guard wrapper ikut diubah, halaman bisnis dan akses role bisa terganggu.
// =====================================================
const RouteFallback = (
  <DataLoadingState
    variant="table"
    rows={4}
    columns={4}
    message="Menyiapkan halaman..."
    minHeight={220}
  />
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
// Compatibility / cleanup:
// - exact hub lama /stock dan /produksi sudah dipensiunkan;
// - legacy child route diisolasi lewat LEGACY_ROUTE_REDIRECTS.
// =========================
const AppRoutes = ({ darkTheme }) => {
  const guardRoute = (routeKey, element) => (
    <ProtectedRoute routeKey={routeKey}>{element}</ProtectedRoute>
  );

  return (
    <Suspense fallback={RouteFallback}>
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
          path="/master-data"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.MASTER_DATA_HUB,
            <ModuleHub moduleKey="master-data" />,
          )}
        />
        <Route
          path={APP_ROUTES.INVENTORY.HUB}
          element={guardRoute(
            ROUTE_ACCESS_KEYS.INVENTORY_HUB,
            <ModuleHub moduleKey="inventory" />,
          )}
        />
        <Route
          path={APP_ROUTES.PRODUCTION.HUB}
          element={guardRoute(
            ROUTE_ACCESS_KEYS.PRODUCTION_HUB,
            <ModuleHub moduleKey="productions" />,
          )}
        />
        <Route
          path="/transactions"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.TRANSACTIONS_HUB,
            <ModuleHub moduleKey="transactions" />,
          )}
        />
        <Route
          path="/finance"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.FINANCE_HUB,
            <ModuleHub moduleKey="finance" />,
          )}
        />
        <Route
          path="/system"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.SYSTEM_HUB,
            <ModuleHub moduleKey="utilities" />,
          )}
        />
        <Route
          path="/reports"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.REPORTS_HUB,
            <ModuleHub moduleKey="reports" />,
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
          path={APP_ROUTES.PRODUCTION.STEPS}
          element={guardRoute(
            ROUTE_ACCESS_KEYS.PRODUCTION_STEPS,
            <ProductionSteps />,
          )}
        />
        <Route
          path={APP_ROUTES.PRODUCTION.EMPLOYEES}
          element={guardRoute(
            ROUTE_ACCESS_KEYS.PRODUCTION_EMPLOYEES,
            <ProductionEmployees />,
          )}
        />
        <Route
          path={APP_ROUTES.PRODUCTION.PROFILES}
          element={guardRoute(
            ROUTE_ACCESS_KEYS.PRODUCTION_PROFILES,
            <ProductionProfiles />,
          )}
        />
        <Route
          path={APP_ROUTES.PRODUCTION.SEMI_FINISHED_MATERIALS}
          element={guardRoute(
            ROUTE_ACCESS_KEYS.SEMI_FINISHED_MATERIALS,
            <SemiFinishedMaterials />,
          )}
        />
        <Route
          path={APP_ROUTES.PRODUCTION.PLANNING}
          element={guardRoute(
            ROUTE_ACCESS_KEYS.PRODUCTION_PLANNING,
            <ProductionPlanning />,
          )}
        />
        <Route
          path={APP_ROUTES.PRODUCTION.ORDERS}
          element={guardRoute(
            ROUTE_ACCESS_KEYS.PRODUCTION_ORDERS,
            <ProductionOrders />,
          )}
        />
        <Route
          path={APP_ROUTES.PRODUCTION.BOMS}
          element={guardRoute(
            ROUTE_ACCESS_KEYS.PRODUCTION_BOMS,
            <ProductionBoms />,
          )}
        />
        <Route
          path={APP_ROUTES.PRODUCTION.WORK_LOGS}
          element={guardRoute(
            ROUTE_ACCESS_KEYS.PRODUCTION_WORK_LOGS,
            <ProductionWorkLogs />,
          )}
        />
        <Route
          path={APP_ROUTES.PRODUCTION.PAYROLLS}
          element={guardRoute(
            ROUTE_ACCESS_KEYS.PRODUCTION_PAYROLLS,
            <ProductionPayrolls />,
          )}
        />
        <Route
          path={APP_ROUTES.PRODUCTION.HPP_ANALYSIS}
          element={guardRoute(
            ROUTE_ACCESS_KEYS.PRODUCTION_HPP_ANALYSIS,
            <ProductionHppAnalysis />,
          )}
        />

        <Route
          path={APP_ROUTES.INVENTORY.STOCK_MANAGEMENT}
          element={guardRoute(
            ROUTE_ACCESS_KEYS.STOCK_MANAGEMENT,
            <StockManagement />,
          )}
        />

        {/* Legacy child route hanya menjadi compatibility bridge terisolasi.
            Seluruh target tetap melewati route guard yang sama dengan canonical page. */}
        {LEGACY_ROUTE_REDIRECTS.map(({ from, to, routeKey }) => (
          <Route
            key={from}
            path={from}
            element={guardRoute(routeKey, <Navigate to={to} replace />)}
          />
        ))}

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
          path="/finance/money-movement-ledger"
          element={guardRoute(
            ROUTE_ACCESS_KEYS.MONEY_MOVEMENT_LEDGER,
            <MoneyMovementLedger />,
          )}
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

        {/* =========================
            SECTION: Redirect Maintenance Lama — COMPATIBILITY / CLEANUP CANDIDATE
            Fungsi:
            - menjaga bookmark lama /utilities/reset-test-data tetap menuju halaman maintenance final.
            Status:
            - Compatibility bridge; jangan hapus sebelum link/prosedur lama dipastikan tidak dipakai.
        ========================= */}
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
