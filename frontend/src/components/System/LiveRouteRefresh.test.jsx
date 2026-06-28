import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useEffect } from "react";
import SqliteRealtimeContext from "../../context/sqliteRealtimeContext.js";
import LiveRouteRefresh from "./LiveRouteRefresh";

let mountCount = 0;
const MountedChild = () => {
  useEffect(() => {
    mountCount += 1;
  }, []);
  return <div>Isi route</div>;
};

const renderWithRealtime = (lastEvent) => render(
  <SqliteRealtimeContext.Provider
    value={{
      lastEvent,
      status: { connected: true, state: "connected" },
    }}
  >
    <LiveRouteRefresh scopes={["customers"]}>
      <MountedChild />
    </LiveRouteRefresh>
  </SqliteRealtimeContext.Provider>,
);

beforeEach(() => {
  mountCount = 0;
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
});

afterEach(() => {
  document.querySelectorAll(".ant-modal-wrap").forEach((element) => element.remove());
});

describe("LiveRouteRefresh", () => {
  it("me-refresh route untuk event dari tab pengirim", async () => {
    renderWithRealtime({
      type: "data_changed",
      revision: 21,
      scopes: ["customers"],
      isLocalOrigin: true,
    });

    expect(mountCount).toBe(1);
    await waitFor(() => expect(mountCount).toBe(2), { timeout: 1000 });
  });

  it("menahan refresh saat modal aktif lalu menjalankannya otomatis setelah modal ditutup", async () => {
    const modal = document.createElement("div");
    modal.className = "ant-modal-wrap";
    modal.style.display = "block";
    modal.getClientRects = () => [{ width: 100, height: 100 }];
    document.body.appendChild(modal);

    renderWithRealtime({
      type: "data_changed",
      revision: 22,
      scopes: ["customers"],
      isLocalOrigin: false,
    });

    expect(await screen.findByText("Data baru tersedia")).toBeTruthy();
    expect(mountCount).toBe(1);

    modal.remove();
    await waitFor(() => expect(mountCount).toBe(2), { timeout: 1200 });
    await waitFor(() => expect(screen.queryByText("Data baru tersedia")).toBeNull());
  });
});
