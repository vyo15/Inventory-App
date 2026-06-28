import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthRealtimeSync } from "./AppLayout";

const {
  realtimeState,
  mockReloadProfile,
  mockRestartSqliteRealtime,
} = vi.hoisted(() => ({
  realtimeState: { lastEvent: null },
  mockReloadProfile: vi.fn(),
  mockRestartSqliteRealtime: vi.fn(),
}));

vi.mock("../hooks/useSqliteRealtime", () => ({
  default: () => realtimeState,
}));

vi.mock("../hooks/useAuth", () => ({
  default: () => ({ reloadProfile: mockReloadProfile }),
}));

vi.mock("../services/System/sqliteRealtimeService", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    restartSqliteRealtime: mockRestartSqliteRealtime,
  };
});

beforeEach(() => {
  realtimeState.lastEvent = null;
  mockReloadProfile.mockReset().mockResolvedValue(null);
  mockRestartSqliteRealtime.mockReset();
});

describe("AuthRealtimeSync", () => {
  it("memuat ulang profile dan menyambung ulang SSE saat scope auth berubah", async () => {
    realtimeState.lastEvent = {
      type: "data_changed",
      revision: 31,
      scopes: ["auth", "user_management"],
    };

    render(<AuthRealtimeSync />);

    await waitFor(() => expect(mockReloadProfile).toHaveBeenCalledTimes(1));
    expect(mockRestartSqliteRealtime).toHaveBeenCalledTimes(1);
  });

  it("mengabaikan mutation non-auth", async () => {
    realtimeState.lastEvent = {
      type: "data_changed",
      revision: 32,
      scopes: ["stock"],
    };

    render(<AuthRealtimeSync />);

    await Promise.resolve();
    expect(mockReloadProfile).not.toHaveBeenCalled();
    expect(mockRestartSqliteRealtime).not.toHaveBeenCalled();
  });
});
