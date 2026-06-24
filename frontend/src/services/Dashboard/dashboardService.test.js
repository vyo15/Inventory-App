import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchSalesRecords: vi.fn(),
  getAllProductionOrders: vi.fn(),
  getAllProductionPayrolls: vi.fn(),
  getAllProductionPlans: vi.fn(),
  getAllProductionWorkLogs: vi.fn(),
  getInventoryLogs: vi.fn(),
  getStockIssueReadModels: vi.fn(),
  getStockReadModelRows: vi.fn(),
  listFinanceExpenses: vi.fn(),
  listFinanceIncomes: vi.fn(),
  listenProducts: vi.fn(),
  listenRawMaterials: vi.fn(),
}));

vi.mock("../Finance/financeService", () => ({
  listFinanceExpenses: mocks.listFinanceExpenses,
  listFinanceIncomes: mocks.listFinanceIncomes,
}));

vi.mock("../Inventory/inventoryService", () => ({
  getInventoryLogs: mocks.getInventoryLogs,
}));

vi.mock("../Inventory/stockReadModelService", () => ({
  getStockIssueReadModels: mocks.getStockIssueReadModels,
  getStockReadModelRows: mocks.getStockReadModelRows,
}));

vi.mock("../MasterData/productsService", () => ({
  listenProducts: mocks.listenProducts,
}));

vi.mock("../MasterData/rawMaterialsService", () => ({
  listenRawMaterials: mocks.listenRawMaterials,
}));

vi.mock("../Produksi/productionOrdersService", () => ({
  getAllProductionOrders: mocks.getAllProductionOrders,
}));

vi.mock("../Produksi/productionPayrollsService", () => ({
  getAllProductionPayrolls: mocks.getAllProductionPayrolls,
}));

vi.mock("../Produksi/productionPlanningService", () => ({
  getAllProductionPlans: mocks.getAllProductionPlans,
}));

vi.mock("../Produksi/productionWorkLogsService", () => ({
  getAllProductionWorkLogs: mocks.getAllProductionWorkLogs,
}));

vi.mock("../Transaksi/salesService", () => ({
  fetchSalesRecords: mocks.fetchSalesRecords,
}));

import { ROLES } from "../../utils/auth/roleAccess";
import {
  readDashboardData,
  sortStockIssuesByUrgency,
} from "./dashboardService";

const resetResolvedData = () => {
  mocks.fetchSalesRecords.mockResolvedValue([]);
  mocks.getAllProductionOrders.mockResolvedValue([]);
  mocks.getAllProductionPayrolls.mockResolvedValue([]);
  mocks.getAllProductionPlans.mockResolvedValue([]);
  mocks.getAllProductionWorkLogs.mockResolvedValue([]);
  mocks.getInventoryLogs.mockResolvedValue([]);
  mocks.getStockIssueReadModels.mockResolvedValue({ rows: [], meta: { total: 0 } });
  mocks.getStockReadModelRows.mockResolvedValue([]);
  mocks.listFinanceExpenses.mockResolvedValue([]);
  mocks.listFinanceIncomes.mockResolvedValue([]);
  mocks.listenProducts.mockImplementation((onData) => {
    onData([]);
    return () => {};
  });
  mocks.listenRawMaterials.mockImplementation((onData) => {
    onData([]);
    return () => {};
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  resetResolvedData();
});

describe("Dashboard service orchestration", () => {
  it("mengurutkan stok berdasarkan severity lalu defisit", () => {
    const rows = sortStockIssuesByUrgency([
      {
        name: "Menipis",
        stock: 4,
        minStock: 10,
        severity: { rank: 3 },
      },
      {
        name: "Minus",
        stock: -1,
        minStock: 2,
        severity: { rank: 0 },
      },
      {
        name: "Kosong",
        stock: 0,
        minStock: 5,
        severity: { rank: 1 },
      },
    ]);

    expect(rows.map((item) => item.name)).toEqual(["Minus", "Kosong", "Menipis"]);
  });

  it("user hanya memuat dataset yang diizinkan dan log sesuai jumlah tampilan", async () => {
    mocks.getStockIssueReadModels.mockResolvedValue({
      rows: [
        {
          id: "stock-low",
          sourceType: "product",
          name: "Stok Menipis",
          currentStock: 4,
          availableStock: 4,
          reservedStock: 0,
          minStockAlert: 10,
        },
        {
          id: "stock-reserved",
          sourceType: "product",
          name: "Stok Dipesan",
          currentStock: 5,
          availableStock: 1,
          reservedStock: 6,
          minStockAlert: 10,
        },
        {
          id: "stock-negative",
          sourceType: "product",
          name: "Stok Minus",
          currentStock: -1,
          availableStock: -1,
          reservedStock: 0,
          minStockAlert: 2,
        },
      ],
      meta: { total: 3 },
    });

    const result = await readDashboardData({
      maxListItems: 2,
      role: ROLES.USER,
    });

    expect(result.failedReads).toEqual([]);
    expect(result.dashboardData.lowStockRows.map((item) => item.name)).toEqual([
      "Stok Minus",
      "Stok Dipesan",
      "Stok Menipis",
    ]);
    expect(result.dashboardData.criticalStockPreview).toHaveLength(2);
    expect(result.dashboardData.lowStockRows[0].severity).toEqual(expect.objectContaining({
      label: "Minus",
      rank: 0,
    }));
    expect(result.dashboardData.lowStockRows[1].severity).toEqual(expect.objectContaining({
      label: "Dipesan melebihi stok",
      rank: 2,
    }));
    expect(mocks.getInventoryLogs).toHaveBeenCalledWith({ limit: 2 });
    expect(mocks.listFinanceIncomes).not.toHaveBeenCalled();
    expect(mocks.listFinanceExpenses).not.toHaveBeenCalled();
    expect(mocks.getAllProductionPayrolls).not.toHaveBeenCalled();
  });

  it("administrator tetap memuat finance/payroll tanpa listener master data yang tidak dipakai", async () => {
    await readDashboardData({
      maxListItems: 5,
      role: ROLES.ADMINISTRATOR,
    });

    expect(mocks.listFinanceIncomes).toHaveBeenCalledTimes(1);
    expect(mocks.listFinanceExpenses).toHaveBeenCalledTimes(1);
    expect(mocks.getAllProductionPayrolls).toHaveBeenCalledTimes(1);
    expect(mocks.listenProducts).not.toHaveBeenCalled();
    expect(mocks.listenRawMaterials).not.toHaveBeenCalled();
  });
});
