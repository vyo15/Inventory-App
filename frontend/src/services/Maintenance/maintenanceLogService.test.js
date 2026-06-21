import { beforeEach, describe, expect, it } from "vitest";
import {
  MAINTENANCE_LOG_EVIDENCE_SCOPE,
  createMaintenanceLog,
  getLatestMaintenanceLogs,
  updateMaintenanceLogStatus,
} from "./maintenanceLogService";

const STORAGE_KEY = "ims.maintenance.session-log.v1";

describe("maintenance session log", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("bertahan setelah module state dibaca ulang melalui sessionStorage", async () => {
    const id = await createMaintenanceLog({
      actionType: "preview_test",
      status: "started",
      executedBy: "admin-test",
    });

    expect(window.sessionStorage.getItem(STORAGE_KEY)).toContain(id);

    await updateMaintenanceLogStatus(id, { status: "success" });
    const logs = await getLatestMaintenanceLogs(10);

    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      id,
      status: "success",
      executedBy: "admin-test",
      evidenceScope: MAINTENANCE_LOG_EVIDENCE_SCOPE,
    });
  });

  it("membatasi hasil sesuai maxItems", async () => {
    await createMaintenanceLog({ actionType: "first" });
    await createMaintenanceLog({ actionType: "second" });

    const logs = await getLatestMaintenanceLogs(1);
    expect(logs).toHaveLength(1);
    expect(logs[0].actionType).toBe("second");
  });
});
