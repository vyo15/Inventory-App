import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ROLES, ROUTE_ACCESS_KEYS } from "../../utils/auth/roleAccess";
import Dashboard from "./Dashboard";
import {
  DASHBOARD_PRIORITY,
  buildCashTrendSeries,
  buildSalesTrendSeries,
  buildTopSellingProducts,
  filterDashboardQuickActionsByRole,
  formatDashboardLoadWarning,
  sortDashboardAlertItems,
} from "./helpers/dashboardPageHelpers";

const {
  createEmptyDashboardDataFixture,
  mockReadDashboardData,
  mockUseAuth,
} = vi.hoisted(() => {
  const emptyPlanningPeriod = () => ({
    count: 0,
    targetQty: 0,
    actualCompletedQty: 0,
    remainingQty: 0,
    progressPercent: 0,
    priorityPlans: [],
  });
  const createEmptyDashboardData = () => ({
    lowStockRows: [],
    criticalStockPreview: [],
    recentActivities: [],
    productionOrders: [],
    workLogs: [],
    payrolls: [],
    expenses: [],
    incomes: [],
    revenues: [],
    sales: [],
    stockAuditRows: [],
    stockIssueMeta: {},
    planningSummary: {
      weekly: emptyPlanningPeriod(),
      monthly: emptyPlanningPeriod(),
      overdueCount: 0,
      behindTargetCount: 0,
      priorityPlans: [],
    },
  });

  return {
    createEmptyDashboardDataFixture: createEmptyDashboardData,
    mockReadDashboardData: vi.fn(),
    mockUseAuth: vi.fn(),
  };
});

vi.mock("../../hooks/useAuth", () => ({
  default: mockUseAuth,
}));

vi.mock("../../services/Dashboard/dashboardService", () => ({
  createEmptyDashboardData: createEmptyDashboardDataFixture,
  normalizeDashboardData: (data = {}) => {
    const fallback = createEmptyDashboardDataFixture();
    const planningSummary = data.planningSummary || fallback.planningSummary;
    return {
      ...fallback,
      ...data,
      planningSummary: {
        ...fallback.planningSummary,
        ...planningSummary,
        weekly: { ...fallback.planningSummary.weekly, ...(planningSummary.weekly || {}) },
        monthly: { ...fallback.planningSummary.monthly, ...(planningSummary.monthly || {}) },
        priorityPlans: Array.isArray(planningSummary.priorityPlans)
          ? planningSummary.priorityPlans
          : [],
      },
    };
  },
  readDashboardData: mockReadDashboardData,
}));

const ACTIONS = [
  { key: "sales", routeKey: ROUTE_ACCESS_KEYS.SALES },
  { key: "purchases", routeKey: ROUTE_ACCESS_KEYS.PURCHASES },
  { key: "stock", routeKey: ROUTE_ACCESS_KEYS.STOCK_MANAGEMENT },
  { key: "stock-report", routeKey: ROUTE_ACCESS_KEYS.STOCK_REPORT },
  { key: "planning", routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_PLANNING },
  { key: "worklog", routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_WORK_LOGS },
  { key: "payroll", routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_PAYROLLS },
  { key: "cash-in", routeKey: ROUTE_ACCESS_KEYS.CASH_IN },
  { key: "cash-out", routeKey: ROUTE_ACCESS_KEYS.CASH_OUT },
];

const actionKeys = (role) => filterDashboardQuickActionsByRole(ACTIONS, role).map((item) => item.key);

const renderDashboard = () => render(
  <MemoryRouter>
    <Dashboard />
  </MemoryRouter>,
);

const mockDashboardResult = (overrides = {}, failedReads = []) => {
  mockReadDashboardData.mockResolvedValue({
    dashboardData: {
      ...createEmptyDashboardDataFixture(),
      ...overrides,
    },
    failedReads,
  });
};

beforeEach(() => {
  mockReadDashboardData.mockReset();
  mockUseAuth.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});

  mockUseAuth.mockReturnValue({
    profile: { role: ROLES.USER },
  });
  mockDashboardResult();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Dashboard role-aware quick actions", () => {
  it("user hanya melihat aksi operasional yang route-nya diizinkan", () => {
    expect(actionKeys(ROLES.USER)).toEqual([
      "sales",
      "purchases",
      "stock",
      "planning",
      "worklog",
    ]);
  });

  it("administrator tetap melihat aksi finance, report, dan payroll", () => {
    expect(actionKeys(ROLES.ADMINISTRATOR)).toEqual(expect.arrayContaining([
      "stock-report",
      "payroll",
      "cash-in",
      "cash-out",
    ]));
  });

  it("role tidak dikenal tidak memperoleh quick action", () => {
    expect(actionKeys("legacy-admin")).toEqual([]);
  });
});

describe("Dashboard role-aware summary", () => {
  it("user melihat ringkasan operasional tanpa KPI keuangan Administrator", async () => {
    const now = new Date().toISOString();
    mockDashboardResult({
      sales: [{ id: "sale-1", date: now, status: "Selesai", amount: 125000 }],
    });

    renderDashboard();

    expect(await screen.findByText("NILAI PENJUALAN HARI INI")).toBeTruthy();
    expect(screen.queryByText("NET KAS OPERASIONAL")).toBeNull();
    expect(screen.queryByText("Kas masuk")).toBeNull();
    expect(screen.getByText("Aktivitas Stok Terbaru")).toBeTruthy();
    expect(mockReadDashboardData).toHaveBeenCalledWith(expect.objectContaining({
      role: ROLES.USER,
    }));
  });

  it("nilai nol pada mini trend memakai bar netral, bukan bar positif", async () => {
    const { container } = renderDashboard();

    expect(await screen.findByText("NILAI PENJUALAN HARI INI")).toBeTruthy();
    expect(container.querySelectorAll(".dashboard-hero-trend-bars > .is-zero")).toHaveLength(7);
    expect(container.querySelectorAll(".dashboard-hero-trend-bars > .is-positive")).toHaveLength(0);
  });

  it("administrator tetap melihat ringkasan kas operasional", async () => {
    const now = new Date().toISOString();
    mockUseAuth.mockReturnValue({
      profile: { role: ROLES.ADMINISTRATOR },
    });
    mockDashboardResult({
      incomes: [{ id: "income-1", date: now, amount: 500000 }],
      expenses: [{ id: "expense-1", date: now, amount: 125000 }],
    });

    renderDashboard();

    expect(await screen.findByText("NET KAS OPERASIONAL")).toBeTruthy();
    expect(screen.getByText("Kas masuk")).toBeTruthy();
    expect(screen.getByText("Kas keluar")).toBeTruthy();
    expect(screen.queryByText("NILAI PENJUALAN HARI INI")).toBeNull();
  });

  it("menampilkan level prioritas dari dampak, bukan urutan render", async () => {
    mockDashboardResult({
      stockAuditRows: [{
        key: "stock-1",
        name: "Benang Merah",
        isNegativeStock: true,
        isReservedOverrun: false,
        to: "/inventory/stock-management",
      }],
      planningSummary: {
        ...createEmptyDashboardDataFixture().planningSummary,
        behindTargetCount: 1,
      },
    });

    renderDashboard();

    expect((await screen.findAllByText("Stok minus")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("P0").length).toBeGreaterThan(0);
    expect(screen.getAllByText("P2").length).toBeGreaterThan(0);
  });
});

describe("Dashboard priority and warning helpers", () => {
  it("mengurutkan P0 sebelum P1 dan P2", () => {
    const rows = sortDashboardAlertItems([
      { label: "Normal", count: 9, priority: DASHBOARD_PRIORITY.NORMAL },
      { label: "Kritis", count: 1, priority: DASHBOARD_PRIORITY.CRITICAL },
      { label: "Tinggi", count: 4, priority: DASHBOARD_PRIORITY.HIGH },
    ]);

    expect(rows.map((item) => item.priority.label)).toEqual(["P0", "P1", "P2"]);
  });

  it("memberi instruksi sesuai hak akses pengguna", () => {
    expect(formatDashboardLoadWarning(["stock_issues"], ROLES.USER))
      .toContain("hubungi Administrator");
    expect(formatDashboardLoadWarning(["stock_issues"], ROLES.USER))
      .not.toContain("buka Database Center");
    expect(formatDashboardLoadWarning(["stock_issues"], ROLES.ADMINISTRATOR))
      .toContain("buka Database Center");
  });

  it("tetap menampilkan warning parsial tanpa mengosongkan Dashboard", async () => {
    mockDashboardResult({}, ["stock_issues"]);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/hubungi Administrator/i)).toBeTruthy();
    });
    expect(screen.getByText("NILAI PENJUALAN HARI INI")).toBeTruthy();
  });
});


describe("Dashboard sales insights", () => {
  it("membangun tren penjualan harian tanpa memasukkan transaksi dibatalkan", () => {
    const referenceDate = new Date(2026, 5, 23, 12, 0, 0);
    const rows = buildSalesTrendSeries([
      {
        id: "sale-valid",
        date: new Date(2026, 5, 23, 9, 0, 0),
        status: "Selesai",
        totalAmount: 150000,
      },
      {
        id: "sale-cancelled",
        date: new Date(2026, 5, 23, 10, 0, 0),
        status: "Dibatalkan",
        totalAmount: 900000,
      },
    ], {
      days: 3,
      referenceDate,
    });

    expect(rows).toHaveLength(3);
    expect(rows[2].amount).toBe(150000);
    expect(rows[2].count).toBe(1);
  });

  it("menghitung tren kas harian sebagai pemasukan dikurangi pengeluaran", () => {
    const referenceDate = new Date(2026, 5, 23, 12, 0, 0);
    const rows = buildCashTrendSeries(
      [{ date: new Date(2026, 5, 23, 8, 0, 0), amount: 500000 }],
      [{ date: new Date(2026, 5, 23, 9, 0, 0), amount: 125000 }],
      { days: 2, referenceDate },
    );

    expect(rows[1].amount).toBe(375000);
    expect(rows[1].count).toBe(2);
  });

  it("mengurutkan produk terlaris bulan berjalan berdasarkan jumlah item", () => {
    const referenceDate = new Date(2026, 5, 23, 12, 0, 0);
    const rows = buildTopSellingProducts([
      {
        id: "sale-1",
        date: new Date(2026, 5, 20, 9, 0, 0),
        status: "Selesai",
        items: [
          { itemId: "product-a", itemName: "Mawar Flanel", quantity: 4, unit: "pcs" },
          { itemId: "product-b", itemName: "Buket Wisuda", quantity: 2, unit: "pcs" },
        ],
      },
      {
        id: "sale-2",
        date: new Date(2026, 5, 22, 9, 0, 0),
        status: "Dikirim",
        items: [
          { itemId: "product-a", itemName: "Mawar Flanel", quantity: 3, unit: "pcs" },
        ],
      },
    ], {
      limit: 5,
      referenceDate,
    });

    expect(rows.map((item) => item.name)).toEqual(["Mawar Flanel", "Buket Wisuda"]);
    expect(rows[0]).toEqual(expect.objectContaining({
      quantity: 7,
      rank: 1,
      sharePercent: 100,
    }));
  });

  it("membedakan varian produk dengan nama master yang sama", () => {
    const referenceDate = new Date(2026, 5, 23, 12, 0, 0);
    const rows = buildTopSellingProducts([
      {
        id: "sale-variant",
        date: new Date(2026, 5, 23, 9, 0, 0),
        status: "Selesai",
        items: [
          {
            itemId: "product-a",
            itemName: "Mawar Flanel",
            variantKey: "red",
            variantLabel: "Merah",
            quantity: 3,
            unit: "pcs",
          },
          {
            itemId: "product-a",
            itemName: "Mawar Flanel",
            variantKey: "blue",
            variantLabel: "Biru",
            quantity: 2,
            unit: "pcs",
          },
        ],
      },
    ], {
      limit: 5,
      referenceDate,
    });

    expect(rows.map((item) => item.name)).toEqual([
      "Mawar Flanel · Merah",
      "Mawar Flanel · Biru",
    ]);
  });

  it("menampilkan insight penjualan dari data Sales tanpa endpoint baru", async () => {
    const now = new Date().toISOString();
    mockDashboardResult({
      sales: [{
        id: "sale-insight",
        date: now,
        status: "Selesai",
        totalAmount: 225000,
        items: [{
          itemId: "product-1",
          itemName: "Bunga Flanel Mawar",
          quantity: 5,
          unit: "pcs",
        }],
      }],
    });

    renderDashboard();

    expect(await screen.findByText("Tren Penjualan 30 Hari")).toBeTruthy();
    expect(screen.getByText("Produk Terlaris")).toBeTruthy();
    expect(screen.getByText("Bunga Flanel Mawar")).toBeTruthy();
  });
});
