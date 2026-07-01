import {
  AppstoreOutlined,
  BarChartOutlined,
  BuildOutlined,
  ClockCircleOutlined,
  DollarCircleOutlined,
  PlusCircleOutlined,
  ShoppingCartOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { APP_ROUTES } from "../../../config/appRoutes";
import { canAccessRoute, ROUTE_ACCESS_KEYS } from "../../../utils/auth/roleAccess";

const buildDashboardQuickActions = (role) => [
  {
    key: "sales",
    routeKey: ROUTE_ACCESS_KEYS.SALES,
    label: "Tambah Penjualan",
    description: "Catat transaksi penjualan baru.",
    to: "/sales",
    icon: <PlusCircleOutlined />,
  },
  {
    key: "purchases",
    routeKey: ROUTE_ACCESS_KEYS.PURCHASES,
    label: "Tambah Pembelian",
    description: "Catat pembelian dan penambahan stok.",
    to: "/purchases",
    icon: <ShoppingCartOutlined />,
  },
  {
    key: "stock",
    routeKey: ROUTE_ACCESS_KEYS.STOCK_MANAGEMENT,
    label: "Cek Stok",
    description: "Periksa stok tersedia dan stok yang telah dipesan.",
    to: APP_ROUTES.INVENTORY.STOCK_MANAGEMENT,
    icon: <AppstoreOutlined />,
  },
  {
    key: "stock-report",
    routeKey: ROUTE_ACCESS_KEYS.STOCK_REPORT,
    label: "Laporan Stok",
    description: "Lihat laporan stok untuk pemeriksaan lanjutan.",
    to: "/report-stock",
    icon: <BarChartOutlined />,
  },
  {
    key: "planning",
    routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_PLANNING,
    label: "Perencanaan Produksi",
    description: "Pantau target mingguan dan bulanan produksi.",
    to: APP_ROUTES.PRODUCTION.PLANNING,
    icon: <ClockCircleOutlined />,
  },
  {
    key: "worklog",
    routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_WORK_LOGS,
    label: "Work Log Produksi",
    description: "Pantau pekerjaan produksi yang sedang berjalan.",
    to: APP_ROUTES.PRODUCTION.WORK_LOGS,
    icon: <BuildOutlined />,
  },
  {
    key: "payroll",
    routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_PAYROLLS,
    label: "Payroll Produksi",
    description: "Tinjau payroll yang belum dibayar.",
    to: APP_ROUTES.PRODUCTION.PAYROLLS,
    icon: <DollarCircleOutlined />,
  },
  {
    key: "cash-in",
    routeKey: ROUTE_ACCESS_KEYS.CASH_IN,
    label: "Kas Masuk",
    description: "Catat dan tinjau pemasukan operasional.",
    to: "/cash-in",
    icon: <WalletOutlined />,
  },
  {
    key: "cash-out",
    routeKey: ROUTE_ACCESS_KEYS.CASH_OUT,
    label: "Kas Keluar",
    description: "Catat dan tinjau biaya operasional.",
    to: "/cash-out",
    icon: <WalletOutlined />,
  },
].filter(({ routeKey }) => canAccessRoute(routeKey, role));

export default buildDashboardQuickActions;
