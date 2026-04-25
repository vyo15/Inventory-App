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
} from "@ant-design/icons";

// =========================
// SECTION: Sidebar Menu Config
// Tujuan:
// - merapikan struktur sidebar agar lebih profesional untuk konteks ERP / IMS
// - menyamakan penamaan group dan menu dengan bahasa Indonesia yang natural
// - menjaga route dan key tetap sama agar tidak mengganggu logic yang sudah berjalan
// Catatan:
// - perubahan di file ini fokus pada nama group, nama menu, dan urutan tampilan
// - path, key, dan struktur dasar tetap dipertahankan supaya aman untuk integrasi existing
// =========================
export const sidebarMenuItems = [
  // =========================
  // GROUP: Dashboard
  // Fungsi:
  // - pusat ringkasan operasional dan prioritas kerja harian
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
  // - menyimpan data referensi utama yang dipakai menu operasional
  // - nama group diganti dari "Data Utama" menjadi "Master Data"
  //   agar lebih profesional dan lebih umum dipakai di ERP / IMS
  // =========================
  {
    key: "master-data",
    icon: DatabaseOutlined,
    label: "Master Data",
    children: [
      { key: "products", label: "Produk Jadi", path: "/products" },
      { key: "raw-materials", label: "Bahan Baku", path: "/raw-materials" },
      { key: "categories", label: "Kategori", path: "/categories" },
      { key: "suppliers", label: "Supplier", path: "/suppliers" },
      { key: "customers", label: "Pelanggan", path: "/customers" },
      {
        key: "pricing-rules",
        icon: TagsOutlined,
        label: "Aturan Harga",
        path: "/pricing-rules",
      },
    ],
  },

  // =========================
  // GROUP: Inventaris
  // Fungsi:
  // - menjadi satu entry point untuk audit riwayat stok dan penyesuaian stok manual
  // Hubungan flow:
  // - Penyesuaian Stok sudah digabung ke halaman Manajemen Stok agar tidak ada menu/logic ganda
  // Status:
  // - aktif/final; menu Penyesuaian Stok lama sudah dihapus dari sidebar
  // =========================
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
    ],
  },

  // =========================
  // GROUP: Produksi
  // Fungsi:
  // - menggabungkan setup produksi dan operasional produksi dalam satu group
  // - urutan dibuat dari data setup -> eksekusi -> biaya agar lebih mudah dipahami user
  // Catatan:
  // - istilah teknis yang sudah lazim seperti BOM, Work Log, Payroll, dan HPP tetap dipakai
  // - istilah yang terasa terlalu campur disesuaikan ke bahasa Indonesia yang lebih natural
  // =========================
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
        label: "Bahan Setengah Jadi",
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

  // =========================
  // GROUP: Transaksi
  // Fungsi:
  // - menampung transaksi pembelian, penjualan, dan retur
  // - urutan dibuat lebih natural mengikuti alur bisnis umum:
  //   pembelian -> penjualan -> retur
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
  // - mencatat arus masuk dan arus keluar kas/biaya operasional
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
  // - menampung menu maintenance dan utilitas sistem yang bersifat sensitif
  // - nama group diganti dari "Utilities" menjadi "Sistem" agar lebih profesional
  // =========================
  {
    key: "utilities",
    icon: ToolOutlined,
    label: "Sistem",
    children: [
      {
        key: "reset-maintenance-data",
        label: "Reset & Maintenance Data",
        path: "/utilities/reset-maintenance-data",
      },
    ],
  },

  // =========================
  // GROUP: Laporan
  // Fungsi:
  // - menampilkan hasil rekap operasional untuk audit dan analisis
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
        key: "profit-loss",
        label: "Laba Rugi",
        path: "/profit-loss",
      },
      // =========================
      // MENU: Laporan Payroll
      // Fungsi:
      // - memisahkan rekap periode dan export payroll dari menu Payroll Produksi
      // - tetap membaca payroll line final tanpa membuat source of truth baru
      // =========================
      {
        key: "payroll-report",
        label: "Laporan Payroll",
        path: "/payroll-report",
      },
    ],
  },
];
