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
  ToolOutlined,
  CalendarOutlined,
} from "@ant-design/icons";

// =========================
// SECTION: Sidebar Menu Config
// Fungsi:
// - menjadi sumber utama label, urutan, dan grouping menu aplikasi.
// Alasan dipakai:
// - patch ini hanya merapikan UX navigasi sidebar tanpa mengubah route/path/business logic.
// Status:
// - aktif dipakai oleh SidebarMenu.jsx; bukan legacy dan bukan kandidat cleanup.
// Catatan penting:
// - key dan path menu existing tetap dipertahankan agar active menu, route, dan bookmark tidak rusak.
// - subgroup Produksi dibuat untuk memisahkan operation, setup, dan cost analysis tanpa menyentuh halaman/service.
// =========================
export const sidebarMenuItems = [
  // =========================
  // GROUP: Dashboard
  // Fungsi:
  // - pusat ringkasan operasional dan prioritas kerja harian.
  // Status:
  // - aktif dipakai; label dan route tidak berubah.
  // =========================
  {
    key: "dashboard",
    icon: HomeOutlined,
    label: "Dashboard",
    path: "/dashboard",
  },

  // =========================
  // GROUP: Master Data
  // Fungsi:
  // - menyimpan data referensi utama yang dipakai transaksi, stock, dan produksi.
  // Alasan dipakai:
  // - label dibuat hybrid agar lebih profesional tetapi route/path tetap sama.
  // Status:
  // - aktif dipakai; perubahan hanya label tampilan, bukan data/schema.
  // =========================
  {
    key: "master-data",
    icon: DatabaseOutlined,
    label: "Master Data",
    children: [
      { key: "products", label: "Produk Jadi", path: "/products" },
      { key: "raw-materials", label: "Raw Materials", path: "/raw-materials" },
      { key: "categories", label: "Kategori", path: "/categories" },
      { key: "suppliers", label: "Supplier", path: "/suppliers" },
      { key: "customers", label: "Customer", path: "/customers" },
      {
        key: "pricing-rules",
        icon: TagsOutlined,
        label: "Pricing Rules",
        path: "/pricing-rules",
      },
    ],
  },

  // =========================
  // GROUP: Stock Control
  // Fungsi:
  // - entry point untuk manajemen stok, stock adjustment, dan audit riwayat stok.
  // Alasan dipakai:
  // - mengganti label "Inventaris" karena istilah itu bisa rancu dengan aset kantor.
  // - "Stock Control" lebih tepat untuk flow stock/currentStock/availableStock/variants.
  // Status:
  // - aktif dipakai; route Stock Management tetap sama dan tidak ada logic stok yang diubah.
  // =========================
  {
    key: "inventory",
    icon: AppstoreOutlined,
    label: "Stock Control",
    children: [
      {
        key: "stock-management",
        label: "Stock Management",
        path: "/stock-management",
      },
    ],
  },

  // =========================
  // GROUP: Produksi
  // Fungsi:
  // - menampung seluruh flow produksi, tetapi dipisah menjadi subgroup agar user tidak bingung.
  // Alasan dipakai:
  // - menu produksi sudah terlalu panjang jika semua item flat.
  // - subgroup membedakan pekerjaan harian, setup master produksi, dan biaya/analisis.
  // Status:
  // - aktif dipakai; subgroup hanya struktur navigasi, bukan route baru dan bukan business logic baru.
  // =========================
  {
    key: "productions",
    icon: BuildOutlined,
    label: "Produksi",
    children: [
      // =========================
      // SUBGROUP: Production Operation
      // Fungsi:
      // - menu kerja harian produksi: planning, order, lalu work log.
      // Alasan dipakai:
      // - item ini paling sering dipakai operator/admin produksi sehingga ditempatkan di atas.
      // Status:
      // - aktif dipakai; path existing tidak diubah.
      // =========================
      {
        key: "production-operation",
        label: "Production Operation",
        children: [
          {
            key: "production-planning",
            label: "Production Planning",
            path: "/produksi/production-planning",
            icon: CalendarOutlined,
          },
          {
            key: "production-orders",
            label: "Order Produksi",
            path: "/produksi/production-orders",
            icon: FileTextOutlined,
          },
          {
            key: "production-work-logs",
            label: "Work Log Produksi",
            path: "/produksi/work-log-produksi",
            icon: FileTextOutlined,
          },
        ],
      },

      // =========================
      // SUBGROUP: Production Setup
      // Fungsi:
      // - data/setup dasar yang dipakai sebelum produksi berjalan.
      // Alasan dipakai:
      // - memisahkan master setup dari flow operasional harian agar sidebar lebih mudah dipahami.
      // Status:
      // - aktif dipakai; tidak mengubah schema, service, atau route.
      // =========================
      {
        key: "production-setup",
        label: "Production Setup",
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
            label: "Production Profile / Template",
            path: "/produksi/profil-produksi",
            icon: FileTextOutlined,
          },
          {
            key: "semi-finished-materials",
            label: "Semi Product",
            path: "/produksi/semi-finished-materials",
            icon: ClusterOutlined,
          },
          {
            key: "production-boms",
            label: "BOM / Resep Produksi",
            path: "/produksi/bom-produksi",
            icon: DeploymentUnitOutlined,
          },
        ],
      },

      // =========================
      // SUBGROUP: Cost & Analysis
      // Fungsi:
      // - memisahkan payroll dan HPP dari proses eksekusi produksi harian.
      // Alasan dipakai:
      // - payroll dan HPP adalah area biaya/analisis, bukan menu setup atau eksekusi stok langsung.
      // Status:
      // - aktif dipakai; tidak mengubah kalkulasi payroll maupun rumus HPP.
      // =========================
      {
        key: "production-cost-analysis",
        label: "Cost & Analysis",
        children: [
          {
            key: "production-payrolls",
            label: "Payroll Produksi",
            path: "/produksi/payroll-produksi",
            icon: MoneyCollectOutlined,
          },
          {
            key: "production-hpp-analysis",
            label: "Analisis HPP Produksi",
            path: "/produksi/analisis-hpp",
            icon: AppstoreOutlined,
          },
        ],
      },
    ],
  },

  // =========================
  // GROUP: Transaksi
  // Fungsi:
  // - menampung transaksi pembelian, penjualan, dan retur.
  // Status:
  // - aktif dipakai; tidak diubah karena label sudah jelas untuk user operasional.
  // =========================
  {
    key: "transactions",
    icon: ShoppingCartOutlined,
    label: "Transaksi",
    children: [
      { key: "purchases", label: "Pembelian", path: "/purchases" },
      { key: "sales", label: "Penjualan", path: "/sales" },
      { key: "returns", label: "Retur", path: "/returns" },
    ],
  },

  // =========================
  // GROUP: Kas & Biaya
  // Fungsi:
  // - mencatat arus masuk dan arus keluar kas/biaya operasional.
  // Status:
  // - aktif dipakai; tidak diubah agar user tetap familiar.
  // =========================
  {
    key: "finance",
    icon: WalletOutlined,
    label: "Kas & Biaya",
    children: [
      { key: "cash-in", label: "Pemasukan", path: "/cash-in" },
      { key: "cash-out", label: "Pengeluaran", path: "/cash-out" },
    ],
  },

  // =========================
  // GROUP: Sistem
  // Fungsi:
  // - menampung menu maintenance/reset yang sensitif.
  // Alasan dipakai:
  // - label dibuat lebih pendek, tetapi tetap jelas bahwa menu ini bukan menu harian.
  // Status:
  // - aktif dipakai; route tetap sama dan tidak ada logic maintenance yang diubah.
  // =========================
  {
    key: "utilities",
    icon: ToolOutlined,
    label: "Sistem",
    children: [
      {
        key: "reset-maintenance-data",
        label: "Reset & Maintenance",
        path: "/utilities/reset-maintenance-data",
      },
    ],
  },

  // =========================
  // GROUP: Laporan
  // Fungsi:
  // - menampilkan rekap operasional dan export untuk audit/analisis.
  // Alasan dipakai:
  // - urutan dibuat dari laporan operasional ke ringkasan finansial.
  // Status:
  // - aktif dipakai; hanya label/urutan yang dirapikan tanpa mengubah report logic.
  // =========================
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
        key: "payroll-report",
        label: "Laporan Payroll",
        path: "/payroll-report",
      },
      {
        key: "profit-loss",
        label: "Laba Rugi",
        path: "/profit-loss",
      },
    ],
  },
];
