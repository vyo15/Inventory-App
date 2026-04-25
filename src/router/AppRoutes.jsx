import React, { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Spin } from "antd";

// =========================
// SECTION: Lazy Loaded Pages
// =========================
const Dashboard = lazy(() => import("../pages/Dashboard/Dashboard"));
const WeLost = lazy(() => import("../pages/ErrorPage/WeLost"));

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
const ProductionProfiles = lazy(() => import("../pages/Produksi/ProductionProfiles"));
const SemiFinishedMaterials = lazy(
  () => import("../pages/Produksi/SemiFinishedMaterials"),
);
const ProductionBoms = lazy(() => import("../pages/Produksi/ProductionBoms"));
// =========================
// SECTION: Production Planning
// Fungsi:
// - route target planning sebelum Production Order;
// - aktif dipakai untuk monitoring target, bukan mutasi stok.
// =========================
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
// =========================
// SECTION: Payroll Report
// Fungsi:
// - memberi area laporan payroll periode yang terpisah dari transaksi payroll harian
// - menjaga Payroll Produksi tetap fokus ke finalisasi line payroll
// =========================
const PayrollReport = lazy(() => import("../pages/Laporan/PayrollReport"));
const ResetMaintenanceData = lazy(() => import("../pages/Utilities/ResetMaintenanceData"));

// =========================
// SECTION: Route Loader
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
// SECTION: App Routes
// Catatan:
// - Jalur lama Product Compositions dan Produksi Dasar dipensiunkan
// - Arsitektur produksi final dipusatkan ke BOM -> Production Orders -> Work Log
// =========================
const AppRoutes = ({ darkTheme }) => {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route
          path="/dashboard"
          element={<Dashboard darkTheme={darkTheme} />}
        />

        <Route path="/categories" element={<Categories />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/pricing-rules" element={<PricingRules />} />
        <Route path="/products" element={<Products />} />
        <Route path="/raw-materials" element={<RawMaterials />} />
        <Route path="/suppliers" element={<SupplierPurchases />} />

        {/* =========================
            SECTION: Produksi Final
        ========================= */}
        <Route
          path="/produksi/tahapan-produksi"
          element={<ProductionSteps />}
        />
        <Route
          path="/produksi/karyawan-produksi"
          element={<ProductionEmployees />}
        />
        <Route
          path="/produksi/profil-produksi"
          element={<ProductionProfiles />}
        />
        <Route
          path="/produksi/semi-finished-materials"
          element={<SemiFinishedMaterials />}
        />
        <Route
          path="/produksi/production-planning"
          element={<ProductionPlanning />}
        />
        <Route
          path="/produksi/production-orders"
          element={<ProductionOrders />}
        />
        <Route path="/produksi/bom-produksi" element={<ProductionBoms />} />
        <Route
          path="/produksi/work-log-produksi"
          element={<ProductionWorkLogs />}
        />
        <Route
          path="/produksi/payroll-produksi"
          element={<ProductionPayrolls />}
        />
        <Route
          path="/produksi/analisis-hpp"
          element={<ProductionHppAnalysis />}
        />

        {/* =========================
            SECTION: Legacy Inventory Redirect
            Fungsi:
            - menjaga bookmark lama /stock-adjustment tidak error
            Hubungan flow:
            - Penyesuaian Stok sudah digabung ke Manajemen Stok sebagai satu entry point inventory
            Status:
            - legacy bridge; bukan halaman adjustment aktif dan kandidat cleanup jika bookmark lama sudah tidak dibutuhkan
        ========================= */}
        <Route path="/stock-adjustment" element={<Navigate to="/stock-management" replace />} />
        <Route path="/stock-management" element={<StockManagement />} />

        <Route path="/purchases" element={<Purchases />} />
        <Route path="/returns" element={<Returns />} />
        <Route path="/sales" element={<Sales />} />

        <Route path="/cash-in" element={<CashIn />} />
        <Route path="/cash-out" element={<CashOut />} />

        <Route path="/profit-loss" element={<ProfitLossReport />} />
        <Route path="/purchases-report" element={<PurchasesReport />} />
        <Route path="/sales-report" element={<SalesReport />} />
        <Route path="/report-stock" element={<StockReport />} />
        {/* =========================
            SECTION: Laporan Payroll
            Fungsi:
            - memisahkan rekap periode / export dari halaman Payroll Produksi
            - route ini hanya membaca payroll final dan tidak mengubah transaksi
        ========================= */}
        <Route path="/payroll-report" element={<PayrollReport />} />

        {/* Final route maintenance. Path lama reset-test-data di-redirect agar bookmark lama tetap aman. */}
        <Route
          path="/utilities/reset-maintenance-data"
          element={<ResetMaintenanceData darkTheme={darkTheme} />}
        />
        <Route
          path="/utilities/reset-test-data"
          element={<Navigate to="/utilities/reset-maintenance-data" replace />}
        />

        <Route path="*" element={<WeLost />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
