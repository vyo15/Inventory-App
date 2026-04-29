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
  UserSwitchOutlined,
} from "@ant-design/icons";
import { ROLE_GROUPS } from "../utils/auth/roleAccess";

// =========================
// SECTION: Sidebar Menu Config — AKTIF / GUARDED
// Fungsi:
// - menjadi sumber utama label, urutan, grouping, dan metadata akses menu aplikasi.
// Hubungan flow aplikasi:
// - dipakai SidebarMenu.jsx untuk menampilkan menu sesuai role;
// - route guard tetap menjadi pengaman utama saat user membuka URL langsung.
// Status:
// - AKTIF dipakai oleh SidebarMenu.jsx.
// - GUARDED: jangan menambah menu sensitif tanpa allowedRoles dan route guard yang sesuai.
// Legacy / cleanup:
// - tidak ada legacy pada config aktif; route legacy /stock-adjustment tetap ditangani di AppRoutes.
// =========================
export const sidebarMenuItems = [
  // =========================
  // GROUP: Dashboard — AKTIF
  // Fungsi:
  // - pusat ringkasan operasional dan prioritas kerja harian.
  // Akses:
  // - semua role login boleh melihat Dashboard.
  // =========================
  {
    key: "dashboard",
    icon: HomeOutlined,
    label: "Dashboard",
    path: "/dashboard",
    allowedRoles: ROLE_GROUPS.ALL_AUTHENTICATED,
  },

  // =========================
  // GROUP: Master Data — AKTIF / GUARDED
  // Fungsi:
  // - data referensi utama yang dipakai transaksi, stock, dan produksi.
  // Akses:
  // - role operasional boleh melihat master dasar;
  // - Pricing Rules dibatasi Administrator dan super_admin legacy karena memengaruhi harga.
  // =========================
  {
    key: "master-data",
    icon: DatabaseOutlined,
    label: "Master Data",
    allowedRoles: ROLE_GROUPS.ALL_AUTHENTICATED,
    children: [
      {
        key: "products",
        label: "Produk Jadi",
        path: "/products",
        allowedRoles: ROLE_GROUPS.ALL_AUTHENTICATED,
      },
      {
        key: "raw-materials",
        label: "Raw Materials",
        path: "/raw-materials",
        allowedRoles: ROLE_GROUPS.ALL_AUTHENTICATED,
      },
      {
        key: "categories",
        label: "Kategori",
        path: "/categories",
        allowedRoles: ROLE_GROUPS.ALL_AUTHENTICATED,
      },
      {
        key: "suppliers",
        label: "Supplier",
        path: "/suppliers",
        allowedRoles: ROLE_GROUPS.ALL_AUTHENTICATED,
      },
      {
        key: "customers",
        label: "Customer",
        path: "/customers",
        allowedRoles: ROLE_GROUPS.ALL_AUTHENTICATED,
      },
      {
        key: "pricing-rules",
        icon: TagsOutlined,
        label: "Pricing Rules",
        path: "/pricing-rules",
        allowedRoles: ROLE_GROUPS.ADMIN_AND_SUPER,
      },
    ],
  },

  // =========================
  // GROUP: Stock Control — AKTIF / GUARDED
  // Fungsi:
  // - entry point untuk manajemen stok, stock adjustment, dan audit riwayat stok.
  // Hubungan flow aplikasi:
  // - menu ini hanya mengatur navigasi; logic stok tetap berada di halaman/service existing.
  // =========================
  {
    key: "inventory",
    icon: AppstoreOutlined,
    label: "Stock Control",
    allowedRoles: ROLE_GROUPS.ALL_AUTHENTICATED,
    children: [
      {
        key: "stock-management",
        label: "Stock Management",
        path: "/stock-management",
        allowedRoles: ROLE_GROUPS.ALL_AUTHENTICATED,
      },
    ],
  },

  // =========================
  // GROUP: Produksi — AKTIF / GUARDED
  // Fungsi:
  // - menampung flow produksi dan memisahkan operation, setup, dan cost analysis.
  // Akses:
  // - operation boleh tampil untuk semua role login;
  // - setup/cost analysis dibatasi Administrator dan super_admin legacy karena berdampak pada master produksi, payroll, dan HPP.
  // =========================
  {
    key: "productions",
    icon: BuildOutlined,
    label: "Produksi",
    allowedRoles: ROLE_GROUPS.ALL_AUTHENTICATED,
    children: [
      {
        key: "production-operation",
        label: "Production Operation",
        allowedRoles: ROLE_GROUPS.ALL_AUTHENTICATED,
        children: [
          {
            key: "production-planning",
            label: "Production Planning",
            path: "/produksi/production-planning",
            icon: CalendarOutlined,
            allowedRoles: ROLE_GROUPS.ALL_AUTHENTICATED,
          },
          {
            key: "production-orders",
            label: "Order Produksi",
            path: "/produksi/production-orders",
            icon: FileTextOutlined,
            allowedRoles: ROLE_GROUPS.ALL_AUTHENTICATED,
          },
          {
            key: "production-work-logs",
            label: "Work Log Produksi",
            path: "/produksi/work-log-produksi",
            icon: FileTextOutlined,
            allowedRoles: ROLE_GROUPS.ALL_AUTHENTICATED,
          },
        ],
      },
      {
        key: "production-setup",
        label: "Production Setup",
        allowedRoles: ROLE_GROUPS.ADMIN_AND_SUPER,
        children: [
          {
            key: "production-steps",
            label: "Tahapan Produksi",
            path: "/produksi/tahapan-produksi",
            icon: ApartmentOutlined,
            allowedRoles: ROLE_GROUPS.ADMIN_AND_SUPER,
          },
          {
            key: "production-employees",
            label: "Karyawan Produksi",
            path: "/produksi/karyawan-produksi",
            icon: TeamOutlined,
            allowedRoles: ROLE_GROUPS.ADMIN_AND_SUPER,
          },
          {
            key: "production-profiles",
            label: "Production Profile / Template",
            path: "/produksi/profil-produksi",
            icon: FileTextOutlined,
            allowedRoles: ROLE_GROUPS.ADMIN_AND_SUPER,
          },
          {
            key: "semi-finished-materials",
            label: "Semi Product",
            path: "/produksi/semi-finished-materials",
            icon: ClusterOutlined,
            allowedRoles: ROLE_GROUPS.ADMIN_AND_SUPER,
          },
          {
            key: "production-boms",
            label: "BOM / Resep Produksi",
            path: "/produksi/bom-produksi",
            icon: DeploymentUnitOutlined,
            allowedRoles: ROLE_GROUPS.ADMIN_AND_SUPER,
          },
        ],
      },
      {
        key: "production-cost-analysis",
        label: "Cost & Analysis",
        allowedRoles: ROLE_GROUPS.ADMIN_AND_SUPER,
        children: [
          {
            key: "production-payrolls",
            label: "Payroll Produksi",
            path: "/produksi/payroll-produksi",
            icon: MoneyCollectOutlined,
            allowedRoles: ROLE_GROUPS.ADMIN_AND_SUPER,
          },
          {
            key: "production-hpp-analysis",
            label: "Analisis HPP Produksi",
            path: "/produksi/analisis-hpp",
            icon: AppstoreOutlined,
            allowedRoles: ROLE_GROUPS.ADMIN_AND_SUPER,
          },
        ],
      },
    ],
  },

  // =========================
  // GROUP: Transaksi — AKTIF
  // Fungsi:
  // - menampung transaksi pembelian, penjualan, dan retur.
  // Akses:
  // - semua role login boleh melihat menu operasional transaksi pada fase awal.
  // =========================
  {
    key: "transactions",
    icon: ShoppingCartOutlined,
    label: "Transaksi",
    allowedRoles: ROLE_GROUPS.ALL_AUTHENTICATED,
    children: [
      {
        key: "purchases",
        label: "Pembelian",
        path: "/purchases",
        allowedRoles: ROLE_GROUPS.ALL_AUTHENTICATED,
      },
      {
        key: "sales",
        label: "Penjualan",
        path: "/sales",
        allowedRoles: ROLE_GROUPS.ALL_AUTHENTICATED,
      },
      {
        key: "returns",
        label: "Retur",
        path: "/returns",
        allowedRoles: ROLE_GROUPS.ALL_AUTHENTICATED,
      },
    ],
  },

  // =========================
  // GROUP: Kas & Biaya — AKTIF / GUARDED
  // Fungsi:
  // - mencatat arus masuk dan keluar kas/biaya operasional.
  // Akses:
  // - dibatasi Administrator dan super_admin legacy karena berkaitan dengan finance dan laporan.
  // =========================
  {
    key: "finance",
    icon: WalletOutlined,
    label: "Kas & Biaya",
    allowedRoles: ROLE_GROUPS.ADMIN_AND_SUPER,
    children: [
      {
        key: "cash-in",
        label: "Pemasukan",
        path: "/cash-in",
        allowedRoles: ROLE_GROUPS.ADMIN_AND_SUPER,
      },
      {
        key: "cash-out",
        label: "Pengeluaran",
        path: "/cash-out",
        allowedRoles: ROLE_GROUPS.ADMIN_AND_SUPER,
      },
    ],
  },

  // =========================
  // GROUP: Sistem — AKTIF / GUARDED
  // Fungsi:
  // - menampung Manajemen User dan maintenance/reset yang sensitif.
  // Akses:
  // - Manajemen User boleh tampil untuk Administrator dan super_admin legacy sesuai guard;
  // - Reset & Maintenance ikut akses penuh Administrator sesuai penyederhanaan 2 role aktif.
  // Status:
  // - GUARDED: user biasa tidak boleh melihat parent Sistem; child sensitif tetap punya allowedRoles sendiri.
  // =========================
  {
    key: "utilities",
    icon: ToolOutlined,
    label: "Sistem",
    allowedRoles: ROLE_GROUPS.ADMIN_AND_SUPER,
    children: [
      {
        key: "user-management",
        icon: UserSwitchOutlined,
        label: "Manajemen User",
        path: "/system/user-management",
        allowedRoles: ROLE_GROUPS.ADMIN_AND_SUPER,
      },
      {
        key: "reset-maintenance-data",
        label: "Reset & Maintenance",
        path: "/utilities/reset-maintenance-data",
        allowedRoles: ROLE_GROUPS.ADMIN_AND_SUPER,
      },
    ],
  },

  // =========================
  // GROUP: Laporan — AKTIF / GUARDED
  // Fungsi:
  // - menampilkan rekap operasional dan export untuk audit/analisis.
  // Akses:
  // - dibatasi Administrator dan super_admin legacy karena laporan bisa memuat finance, payroll, HPP, dan laba rugi.
  // =========================
  {
    key: "reports",
    icon: PrinterOutlined,
    label: "Laporan",
    allowedRoles: ROLE_GROUPS.ADMIN_AND_SUPER,
    children: [
      {
        key: "report-stock",
        label: "Laporan Stok",
        path: "/report-stock",
        allowedRoles: ROLE_GROUPS.ADMIN_AND_SUPER,
      },
      {
        key: "purchases-report",
        label: "Laporan Pembelian",
        path: "/purchases-report",
        allowedRoles: ROLE_GROUPS.ADMIN_AND_SUPER,
      },
      {
        key: "sales-report",
        label: "Laporan Penjualan",
        path: "/sales-report",
        allowedRoles: ROLE_GROUPS.ADMIN_AND_SUPER,
      },
      {
        key: "payroll-report",
        label: "Laporan Payroll",
        path: "/payroll-report",
        allowedRoles: ROLE_GROUPS.ADMIN_AND_SUPER,
      },
      {
        key: "profit-loss",
        label: "Laba Rugi",
        path: "/profit-loss",
        allowedRoles: ROLE_GROUPS.ADMIN_AND_SUPER,
      },
    ],
  },
];
