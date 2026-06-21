import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestSqliteApi } from "../../data/adapters/sqlite/sqliteApiClient";
import { getDataQualityAudit } from "./dataQualityAuditService";
import {
  deleteOrphanStockReadModelsMaintenance,
  getStockReadModelMaintenanceAudit,
  rebuildStockReadModelMaintenance,
} from "./stockReadModelMaintenanceService";
import {
  MAINTENANCE_DATA_TOOLS_AVAILABLE,
  MAINTENANCE_DATA_TOOLS_MODE,
} from "./resetMaintenanceDataService";

vi.mock("../../data/adapters/sqlite/sqliteApiClient", () => ({
  requestSqliteApi: vi.fn(),
}));

describe("maintenance data tools SQLite", () => {
  beforeEach(() => {
    requestSqliteApi.mockReset();
  });

  it("mengaktifkan hanya safe subset maintenance", () => {
    expect(MAINTENANCE_DATA_TOOLS_AVAILABLE).toBe(true);
    expect(MAINTENANCE_DATA_TOOLS_MODE).toBe("safe_subset");
  });

  it("memuat audit kualitas dan stock read model dari endpoint admin", async () => {
    requestSqliteApi
      .mockResolvedValueOnce({ data: { summary: { issueCount: 2 } } })
      .mockResolvedValueOnce({ data: { summary: { missingCount: 1 } } });

    await expect(getDataQualityAudit()).resolves.toEqual({ summary: { issueCount: 2 } });
    await expect(getStockReadModelMaintenanceAudit()).resolves.toEqual({ summary: { missingCount: 1 } });
    expect(requestSqliteApi).toHaveBeenNthCalledWith(1, "/api/maintenance/data-audit");
    expect(requestSqliteApi).toHaveBeenNthCalledWith(2, "/api/maintenance/stock-read-model-audit");
  });

  it("rebuild projection memakai POST tanpa payload bisnis", async () => {
    requestSqliteApi.mockResolvedValue({ data: { updatedCount: 1 } });

    await expect(rebuildStockReadModelMaintenance()).resolves.toEqual({ updatedCount: 1 });
    expect(requestSqliteApi).toHaveBeenCalledWith(
      "/api/maintenance/stock-read-model-rebuild",
      { method: "POST", body: "{}" },
    );
  });

  it("cleanup orphan meneruskan keyword eksplisit", async () => {
    requestSqliteApi.mockResolvedValue({ data: { deletedCount: 1 } });

    await expect(deleteOrphanStockReadModelsMaintenance({
      confirmKeyword: "BERSIHKAN DATA STOK",
    })).resolves.toEqual({ deletedCount: 1 });
    expect(requestSqliteApi).toHaveBeenCalledWith(
      "/api/maintenance/stock-read-model-orphan-cleanup",
      {
        method: "POST",
        body: JSON.stringify({ confirmKeyword: "BERSIHKAN DATA STOK" }),
      },
    );
  });
});
