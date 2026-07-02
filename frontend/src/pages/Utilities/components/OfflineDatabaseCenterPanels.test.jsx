import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RestorePreviewPanel } from "./OfflineDatabaseCenterPanels";

describe("OfflineDatabaseCenterPanels", () => {
  it("menampilkan guard akun ketika backup valid teknis tetapi tidak aman", () => {
    render(
      <RestorePreviewPanel
        restoreComparisonGroups={[]}
        restorePlan={{
          validForRestore: true,
          safeForRestore: false,
          validation: { integrityCheck: "ok" },
          accountSummary: {
            totalUsers: 2,
            activeUsers: 1,
            administratorUsers: 1,
            activeAdministrators: 0,
          },
        }}
      />,
    );

    expect(screen.getByText("Restore normal diblokir")).toBeTruthy();
    expect(screen.getByText("Administrator Aktif")).toBeTruthy();
    expect(screen.getByText("Diblokir")).toBeTruthy();
  });

  it("menampilkan instruksi read-only sebelum preview tersedia", () => {
    render(<RestorePreviewPanel restoreComparisonGroups={[]} restorePlan={null} />);

    expect(screen.getByText(/Pilih backup lalu klik Preview Restore/)).toBeTruthy();
  });

  it("menjaga service call dan confirm destructive di orchestrator parent", () => {
    const parentSource = fs.readFileSync(
      path.resolve("src/pages/Utilities/components/OfflineDatabaseCenter.jsx"),
      "utf8",
    );
    const panelsSource = fs.readFileSync(
      path.resolve("src/pages/Utilities/components/OfflineDatabaseCenterPanels.jsx"),
      "utf8",
    );

    expect(parentSource).toContain("executeSqliteRestore");
    expect(parentSource).toContain("modal.confirm");
    expect(parentSource).toContain("restoreReady");
    expect(panelsSource).not.toContain("sqliteBackendStatusService");
    expect(panelsSource).not.toContain("executeSqliteRestore");
  });
});
