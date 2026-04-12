import {
  HomeOutlined,
  DatabaseOutlined,
  ShoppingCartOutlined,
  AppstoreOutlined,
  WalletOutlined,
  PrinterOutlined,
  BuildOutlined,
  TagsOutlined,
  ApartmentOutlined,
  TeamOutlined,
  ClusterOutlined,
  DeploymentUnitOutlined,
  FileTextOutlined,
  MoneyCollectOutlined,
} from "@ant-design/icons";

// =========================
// SECTION: Sidebar Menu Config
// Catatan:
// - Jalur lama Komposisi Produk dan Produksi Dasar tidak ditampilkan lagi
// - Fokus menu produksi diarahkan ke arsitektur final
// =========================
export const sidebarMenuItems = [
  {
    key: "dashboard",
    icon: HomeOutlined,
    label: "Dashboard",
    path: "/dashboard",
  },
  {
    key: "master-data",
    icon: DatabaseOutlined,
    label: "Data Utama",
    children: [
      { key: "products", label: "Produk Jadi", path: "/products" },
      { key: "raw-materials", label: "Bahan Baku", path: "/raw-materials" },
      { key: "categories", label: "Kategori", path: "/categories" },
      { key: "suppliers", label: "Supplier", path: "/suppliers" },
      { key: "customers", label: "Pelanggan", path: "/customers" },
      {
        key: "pricing-rules",
        icon: TagsOutlined,
        label: "Pricing Rules",
        path: "/pricing-rules",
      },
    ],
  },
  {
    key: "inventory",
    icon: AppstoreOutlined,
    label: "Inventaris",
    children: [
      {
        key: "stock-management",
        label: "Manajemen Stok",
        path: "/stock-management",
      },
      {
        key: "stock-adjustment",
        label: "Penyesuaian Stok",
        path: "/stock-adjustment",
      },
    ],
  },
  {
    key: "productions",
    icon: BuildOutlined,
    label: "Produksi",
    children: [
      {
        key: "production-steps",
        label: "Tahapan Produksi",
        path: "/produksi/tahapan-produksi",
        icon: ApartmentOutlined,
      },
      {
        key: "production-employees",
        label: "Karyawan Produksi",
        path: "/produksi/karyawan-produksi",
        icon: TeamOutlined,
      },
      {
        key: "production-profiles",
        label: "Profil Produksi",
        path: "/produksi/profil-produksi",
        icon: FileTextOutlined,
      },
      {
        key: "semi-finished-materials",
        label: "Semi Finished Materials",
        path: "/produksi/semi-finished-materials",
        icon: ClusterOutlined,
      },
      {
        key: "production-boms",
        label: "BOM Produksi",
        path: "/produksi/bom-produksi",
        icon: DeploymentUnitOutlined,
      },
      {
        key: "production-orders",
        label: "Production Orders",
        path: "/produksi/production-orders",
        icon: FileTextOutlined,
      },
      {
        key: "production-work-logs",
        label: "Work Log Produksi",
        path: "/produksi/work-log-produksi",
        icon: FileTextOutlined,
      },
      {
        key: "production-payrolls",
        label: "Payroll Produksi",
        path: "/produksi/payroll-produksi",
        icon: MoneyCollectOutlined,
      },
      {
        key: "production-hpp-analysis",
        label: "Analisis HPP",
        path: "/produksi/analisis-hpp",
        icon: AppstoreOutlined,
      },
    ],
  },
  {
    key: "transactions",
    icon: ShoppingCartOutlined,
    label: "Transaksi",
    children: [
      { key: "sales", label: "Penjualan", path: "/sales" },
      { key: "purchases", label: "Pembelian", path: "/purchases" },
      { key: "returns", label: "Retur", path: "/returns" },
    ],
  },
  {
    key: "finance",
    icon: WalletOutlined,
    label: "Kas & Biaya",
    children: [
      { key: "cash-in", label: "Pemasukan", path: "/cash-in" },
      { key: "cash-out", label: "Pengeluaran", path: "/cash-out" },
    ],
  },
  {
    key: "reports",
    icon: PrinterOutlined,
    label: "Laporan",
    children: [
      {
        key: "report-stock",
        label: "Laporan Stok",
        path: "/report-stock",
      },
      {
        key: "purchases-report",
        label: "Laporan Pembelian",
        path: "/purchases-report",
      },
      {
        key: "sales-report",
        label: "Laporan Penjualan",
        path: "/sales-report",
      },
      {
        key: "profit-loss",
        label: "Laba Rugi",
        path: "/profit-loss",
      },
    ],
  },
];
