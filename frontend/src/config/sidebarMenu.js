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
  PlayCircleOutlined,
  SettingOutlined,
  LineChartOutlined,
  FileDoneOutlined,
  FormOutlined,
  OrderedListOutlined,
  ProfileOutlined,
  UnorderedListOutlined,
  DollarCircleOutlined,
  CalculatorOutlined,
  GiftOutlined,
  InboxOutlined,
  UserOutlined,
  ShopOutlined,
  SwapOutlined,
  PlusCircleOutlined,
  MinusCircleOutlined,
  BookOutlined,
  HddOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import { APP_ROUTES } from "./appRoutes";
import { ROLE_GROUPS } from "../utils/auth/roleAccess";

// IMS NOTE [AKTIF / GUARDED]:
// Sidebar memakai ROLE_GROUPS.ADMIN_ONLY untuk menu sensitif Administrator dan ROLE_GROUPS.OPERATIONAL_DAILY untuk menu operasional harian.
// Perubahan access matrix ini hanya mengatur visibility/menu guard; route, label, path, dan business flow tidak berubah.

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
// Cleanup data historis:
// - tidak ada data historis pada config aktif; route data historis /stock-adjustment tetap ditangani di AppRoutes.
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
  // - Master Data dibatasi Administrator karena dapat mengubah setup referensi bisnis;
  // - user operasional tetap memakai data referensi dari halaman transaksi/produksi tanpa membuka menu setup.
  // =========================
  {
    key: "master-data",
    icon: DatabaseOutlined,
    label: "Master Data",
    hubPath: "/master-data",
    hubIcon: DatabaseOutlined,
    hubEyebrow: "Workspace Master Data",
    hubDescription:
      "Kelola data referensi utama yang digunakan pada transaksi, stok, harga, dan produksi.",
    allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
    children: [
      {
        key: "products",
        label: "Produk Jadi",
        hubIcon: GiftOutlined,
        hubDescription:
          "Kelola produk jadi, varian, harga jual, minimum stok, dan status penggunaan.",
        path: "/products",
        allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
      },
      {
        key: "raw-materials",
        label: "Raw Materials",
        hubLabel: "Bahan Baku",
        hubIcon: InboxOutlined,
        hubDescription:
          "Kelola bahan baku, satuan, harga beli, minimum stok, dan status penggunaan.",
        path: "/raw-materials",
        allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
      },
      {
        key: "categories",
        label: "Kategori",
        hubIcon: TagsOutlined,
        hubDescription:
          "Kelola kategori untuk pengelompokan produk dan bahan baku.",
        path: "/categories",
        allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
      },
      {
        key: "suppliers",
        label: "Supplier",
        hubIcon: ShopOutlined,
        hubDescription:
          "Kelola identitas supplier, kontak, serta katalog kebutuhan restock.",
        path: "/suppliers",
        allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
      },
      {
        key: "customers",
        label: "Customer",
        hubIcon: UserOutlined,
        hubDescription:
          "Kelola data customer untuk penjualan dan penelusuran riwayat transaksi.",
        path: "/customers",
        allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
      },
      {
        key: "pricing-rules",
        icon: TagsOutlined,
        label: "Pricing Rules",
        hubLabel: "Aturan Harga",
        hubIcon: CalculatorOutlined,
        hubDescription:
          "Kelola aturan harga otomatis dan lakukan preview sebelum diterapkan.",
        path: "/pricing-rules",
        allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
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
    hubPath: APP_ROUTES.INVENTORY.HUB,
    hubIcon: InboxOutlined,
    hubEyebrow: "Workspace Stok",
    hubTitle: "Kontrol Stok",
    hubDescription:
      "Pantau persediaan dan audit pergerakan stok, lalu lakukan penyesuaian manual melalui flow resmi.",
    allowedRoles: ROLE_GROUPS.OPERATIONAL_DAILY,
    children: [
      {
        key: "stock-management",
        label: "Stock Management",
        hubLabel: "Manajemen Stok",
        hubIcon: InboxOutlined,
        hubDescription:
          "Tinjau stok tersedia, stok dipesan, batas minimum, riwayat pergerakan, dan adjustment ber-audit.",
        path: APP_ROUTES.INVENTORY.STOCK_MANAGEMENT,
        allowedRoles: ROLE_GROUPS.OPERATIONAL_DAILY,
      },
    ],
  },

  // =========================
  // GROUP: Produksi — AKTIF / GUARDED
  // Fungsi:
  // - menampung flow produksi dan memisahkan operation, setup, dan cost analysis.
  // Akses:
  // - operation boleh tampil untuk Administrator dan User;
  // - setup/cost analysis dibatasi Administrator karena berdampak pada master produksi, payroll, dan HPP.
  // =========================
  {
    key: "productions",
    icon: BuildOutlined,
    label: "Produksi",
    hubPath: APP_ROUTES.PRODUCTION.HUB,
    hubIcon: BuildOutlined,
    hubEyebrow: "Workspace Produksi",
    hubDescription:
      "Kelola pekerjaan produksi dari perencanaan, pelaksanaan, pencatatan hasil, hingga evaluasi biaya.",
    allowedRoles: ROLE_GROUPS.OPERATIONAL_DAILY,
    children: [
      {
        key: "production-operation",
        icon: CalendarOutlined,
        hubIcon: PlayCircleOutlined,
        label: "Production Operation",
        hubLabel: "Operasional Produksi",
        hubDescription:
          "Alur kerja harian: susun planning, buat order, lalu catat hasil produksi.",
        allowedRoles: ROLE_GROUPS.OPERATIONAL_DAILY,
        children: [
          {
            key: "production-planning",
            label: "Production Planning",
            hubLabel: "Planning Produksi",
            hubDescription:
              "Susun kebutuhan, target, dan jadwal produksi sebelum order dibuat.",
            path: APP_ROUTES.PRODUCTION.PLANNING,
            icon: CalendarOutlined,
            hubIcon: CalendarOutlined,
            allowedRoles: ROLE_GROUPS.OPERATIONAL_DAILY,
          },
          {
            key: "production-orders",
            label: "Order Produksi",
            hubDescription:
              "Jalankan dan pantau order produksi yang berasal dari planning.",
            path: APP_ROUTES.PRODUCTION.ORDERS,
            icon: FileTextOutlined,
            hubIcon: FileDoneOutlined,
            allowedRoles: ROLE_GROUPS.OPERATIONAL_DAILY,
          },
          {
            key: "production-work-logs",
            label: "Work Log Produksi",
            hubDescription:
              "Catat progres, hasil kerja, serta pemakaian aktual pada setiap order.",
            path: APP_ROUTES.PRODUCTION.WORK_LOGS,
            icon: FileTextOutlined,
            hubIcon: FormOutlined,
            allowedRoles: ROLE_GROUPS.OPERATIONAL_DAILY,
          },
        ],
      },
      {
        key: "production-setup",
        icon: ToolOutlined,
        hubIcon: SettingOutlined,
        label: "Production Setup",
        hubLabel: "Pengaturan Produksi",
        hubDescription:
          "Siapkan tahapan, pekerja, template, semi product, dan resep produksi.",
        allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
        children: [
          {
            key: "production-steps",
            label: "Tahapan Produksi",
            hubDescription:
              "Atur urutan tahapan kerja yang digunakan dalam proses produksi.",
            path: APP_ROUTES.PRODUCTION.STEPS,
            icon: ApartmentOutlined,
            hubIcon: OrderedListOutlined,
            allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
          },
          {
            key: "production-employees",
            label: "Karyawan Produksi",
            hubDescription:
              "Kelola pekerja yang digunakan pada work log dan payroll produksi.",
            path: APP_ROUTES.PRODUCTION.EMPLOYEES,
            icon: TeamOutlined,
            hubIcon: TeamOutlined,
            allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
          },
          {
            key: "production-profiles",
            label: "Production Profile / Template",
            hubLabel: "Template Produksi",
            hubDescription:
              "Buat template tahapan dan standar kerja untuk proses berulang.",
            path: APP_ROUTES.PRODUCTION.PROFILES,
            icon: FileTextOutlined,
            hubIcon: ProfileOutlined,
            allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
          },
          {
            key: "semi-finished-materials",
            label: "Semi Product",
            hubLabel: "Produk Setengah Jadi",
            hubDescription:
              "Kelola produk setengah jadi yang dipakai pada proses berikutnya.",
            path: APP_ROUTES.PRODUCTION.SEMI_FINISHED_MATERIALS,
            icon: ClusterOutlined,
            hubIcon: BuildOutlined,
            allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
          },
          {
            key: "production-boms",
            label: "BOM / Resep Produksi",
            hubDescription:
              "Tetapkan komposisi bahan dan kebutuhan standar setiap produk.",
            path: APP_ROUTES.PRODUCTION.BOMS,
            icon: DeploymentUnitOutlined,
            hubIcon: UnorderedListOutlined,
            allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
          },
        ],
      },
      {
        key: "production-cost-analysis",
        icon: MoneyCollectOutlined,
        hubIcon: LineChartOutlined,
        label: "Cost & Analysis",
        hubLabel: "Biaya & Analisis",
        hubDescription:
          "Tinjau payroll final dan HPP berdasarkan data produksi aktual.",
        allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
        children: [
          {
            key: "production-payrolls",
            label: "Payroll Produksi",
            hubDescription:
              "Tinjau dan selesaikan upah berdasarkan work log produksi.",
            path: APP_ROUTES.PRODUCTION.PAYROLLS,
            icon: MoneyCollectOutlined,
            hubIcon: DollarCircleOutlined,
            allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
          },
          {
            key: "production-hpp-analysis",
            label: "Analisis HPP Produksi",
            hubDescription:
              "Analisis biaya material aktual, payroll final, dan overhead.",
            path: APP_ROUTES.PRODUCTION.HPP_ANALYSIS,
            icon: AppstoreOutlined,
            hubIcon: CalculatorOutlined,
            allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
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
  // - Administrator dan User boleh melihat transaksi operasional harian sesuai access matrix.
  // =========================
  {
    key: "transactions",
    icon: ShoppingCartOutlined,
    label: "Transaksi",
    hubPath: "/transactions",
    hubIcon: SwapOutlined,
    hubEyebrow: "Workspace Transaksi",
    hubDescription:
      "Kelola pembelian, penjualan, dan retur operasional melalui flow transaksi resmi.",
    allowedRoles: ROLE_GROUPS.OPERATIONAL_DAILY,
    children: [
      {
        key: "purchases",
        label: "Pembelian",
        hubIcon: ShoppingCartOutlined,
        hubDescription:
          "Catat pembelian dan penerimaan bahan untuk memperbarui stok serta histori transaksi.",
        path: "/purchases",
        allowedRoles: ROLE_GROUPS.OPERATIONAL_DAILY,
      },
      {
        key: "sales",
        label: "Penjualan",
        hubIcon: DollarCircleOutlined,
        hubDescription:
          "Kelola penjualan dari pembuatan transaksi hingga penyelesaian dan pencatatan pendapatan.",
        path: "/sales",
        allowedRoles: ROLE_GROUPS.OPERATIONAL_DAILY,
      },
      {
        key: "returns",
        label: "Retur",
        hubIcon: SwapOutlined,
        hubDescription:
          "Proses retur dari penjualan terkait dengan batas jumlah yang masih dapat dikembalikan.",
        path: "/returns",
        allowedRoles: ROLE_GROUPS.OPERATIONAL_DAILY,
      },
    ],
  },

  // =========================
  // GROUP: Kas & Biaya — AKTIF / GUARDED
  // Fungsi:
  // - mencatat arus masuk dan keluar kas/biaya operasional.
  // Akses:
  // - dibatasi Administrator karena berkaitan dengan finance dan laporan.
  // =========================
  {
    key: "finance",
    icon: WalletOutlined,
    label: "Kas & Biaya",
    hubPath: "/finance",
    hubIcon: WalletOutlined,
    hubEyebrow: "Workspace Kas & Biaya",
    hubDescription:
      "Kelola pemasukan dan pengeluaran resmi serta audit pergerakan kas dalam satu workspace.",
    allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
    children: [
      {
        key: "cash-in",
        label: "Pemasukan",
        hubIcon: PlusCircleOutlined,
        hubDescription:
          "Catat pemasukan resmi dan telusuri sumber transaksi kas masuk.",
        path: "/cash-in",
        allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
      },
      {
        key: "cash-out",
        label: "Pengeluaran",
        hubIcon: MinusCircleOutlined,
        hubDescription:
          "Catat pengeluaran operasional dan telusuri penggunaan kas keluar.",
        path: "/cash-out",
        allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
      },
      {
        key: "money-movement-ledger",
        label: "Buku Besar Kas",
        hubIcon: BookOutlined,
        hubDescription:
          "Audit pergerakan uang dari pemasukan dan pengeluaran tanpa mengubah transaksi sumber.",
        path: "/finance/money-movement-ledger",
        allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
      },
    ],
  },

  // =========================
  // GROUP: Sistem — AKTIF / GUARDED
  // Fungsi:
  // - menampung Manajemen User dan maintenance/reset yang sensitif.
  // Akses:
  // - Manajemen User hanya boleh tampil untuk Administrator sesuai guard;
  // - Maintenance Center ikut akses penuh Administrator sesuai penyederhanaan 2 role aktif.
  // Status:
  // - GUARDED: user biasa tidak boleh melihat parent Sistem; child sensitif tetap punya allowedRoles sendiri.
  // =========================
  {
    key: "utilities",
    icon: ToolOutlined,
    label: "Sistem",
    hubPath: "/system",
    hubIcon: SettingOutlined,
    hubEyebrow: "Workspace Sistem",
    hubDescription:
      "Kelola pengguna serta jalankan backup, audit, dan maintenance data dengan guard keamanan.",
    allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
    children: [
      {
        key: "user-management",
        icon: UserSwitchOutlined,
        label: "Manajemen User",
        hubIcon: UserSwitchOutlined,
        hubDescription:
          "Kelola akun lokal, role, status akses, dan kredensial pengguna IMS.",
        path: "/system/user-management",
        allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
      },
      {
        key: "reset-maintenance-data",
        label: "Maintenance Center",
        hubIcon: HddOutlined,
        hubDescription:
          "Kelola backup dan restore, audit data, repair aman, serta reset testing terbatas.",
        path: "/utilities/reset-maintenance-data",
        allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
      },
    ],
  },

  // =========================
  // GROUP: Laporan — AKTIF / GUARDED
  // Fungsi:
  // - menampilkan rekap operasional dan export untuk audit/analisis.
  // Akses:
  // - dibatasi Administrator karena laporan bisa memuat finance, payroll, HPP, dan laba rugi.
  // =========================
  {
    key: "reports",
    icon: PrinterOutlined,
    label: "Laporan",
    hubPath: "/reports",
    hubIcon: BarChartOutlined,
    hubEyebrow: "Workspace Laporan",
    hubDescription:
      "Tinjau rekap stok, transaksi, payroll, dan hasil keuangan untuk audit serta analisis.",
    allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
    children: [
      {
        key: "report-stock",
        label: "Laporan Stok",
        hubIcon: BarChartOutlined,
        hubDescription:
          "Tinjau posisi dan pergerakan stok untuk kebutuhan audit persediaan.",
        path: "/report-stock",
        allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
      },
      {
        key: "purchases-report",
        label: "Laporan Pembelian",
        hubIcon: ShoppingCartOutlined,
        hubDescription:
          "Tinjau rekap pembelian dan nilai transaksi berdasarkan periode laporan.",
        path: "/purchases-report",
        allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
      },
      {
        key: "sales-report",
        label: "Laporan Penjualan",
        hubIcon: LineChartOutlined,
        hubDescription:
          "Tinjau rekap penjualan, nilai transaksi, dan performa berdasarkan periode.",
        path: "/sales-report",
        allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
      },
      {
        key: "payroll-report",
        label: "Laporan Payroll",
        hubIcon: DollarCircleOutlined,
        hubDescription:
          "Tinjau rekap payroll produksi final untuk kebutuhan pengecekan dan pelaporan.",
        path: "/payroll-report",
        allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
      },
      {
        key: "profit-loss",
        label: "Laba Rugi",
        hubIcon: CalculatorOutlined,
        hubDescription:
          "Analisis pendapatan, biaya, dan laba rugi berdasarkan data transaksi resmi.",
        path: "/profit-loss",
        allowedRoles: ROLE_GROUPS.ADMIN_ONLY,
      },
    ],
  },
];
