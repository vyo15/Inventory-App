import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App as AntdApp } from "antd";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MaintenanceInactiveDataPanel from "./MaintenanceInactiveDataPanel";

const { mockGetSqliteInactiveData } = vi.hoisted(() => ({
  mockGetSqliteInactiveData: vi.fn(),
}));

vi.mock("../../../services/System/sqliteBackendStatusService", () => ({
  getSqliteInactiveData: mockGetSqliteInactiveData,
  purgeSqliteInactiveData: vi.fn(),
}));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockGetSqliteInactiveData.mockReset();
});

describe("MaintenanceInactiveDataPanel", () => {
  it("tetap dapat dirender ketika belum ada kandidat terpilih", async () => {
    mockGetSqliteInactiveData.mockResolvedValue({
      data: {
        confirmKeyword: "HAPUS PERMANEN",
        summary: { total: 0, safe: 0, blocked: 0 },
        groups: [],
      },
    });

    render(
      <AntdApp>
        <MaintenanceInactiveDataPanel />
      </AntdApp>,
    );

    expect(screen.getByText("Data Nonaktif & Purge Guarded")).toBeTruthy();
    await waitFor(() => expect(mockGetSqliteInactiveData).toHaveBeenCalledTimes(1));
  });

  it("mengabaikan kandidat null agar panel tidak white screen", async () => {
    const user = userEvent.setup();
    mockGetSqliteInactiveData.mockResolvedValue({
      data: {
        confirmKeyword: "HAPUS PERMANEN",
        summary: { total: 1, safe: 1, blocked: 0 },
        groups: [
          {
            entityType: "customer",
            entityLabel: "Customer",
            count: 1,
            safeCount: 1,
            blockedCount: 0,
            candidates: [
              null,
              {
                entityType: "customer",
                entityLabel: "Customer",
                id: "7",
                code: "CUS-007",
                name: "Customer Nonaktif",
                status: "deleted",
                safeToDelete: true,
                blockers: [],
              },
            ],
          },
        ],
      },
    });

    render(
      <AntdApp>
        <MaintenanceInactiveDataPanel />
      </AntdApp>,
    );

    await user.click(await screen.findByText("Customer"));
    expect(await screen.findAllByText("Customer Nonaktif")).not.toHaveLength(0);
    expect(screen.getAllByText("CUS-007")).not.toHaveLength(0);
  });
});
