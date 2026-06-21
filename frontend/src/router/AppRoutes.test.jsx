import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { APP_ROUTES } from "../config/appRoutes";
import { ROUTE_ACCESS_KEYS } from "../utils/auth/roleAccess";
import AppRoutes from "./AppRoutes";

vi.mock("../components/Auth/ProtectedRoute", () => ({
  default: ({ routeKey, children }) => (
    <div data-testid="route-guard" data-route-key={routeKey}>
      {children}
    </div>
  ),
}));

vi.mock("../pages/Navigation/ModuleHub", () => ({
  default: ({ moduleKey }) => <div data-testid="module-hub">{moduleKey}</div>,
}));

vi.mock("../pages/Inventory/StockManagement", () => ({
  default: () => <div data-testid="stock-management-page">stock-management</div>,
}));

vi.mock("../pages/Produksi/ProductionWorkLogs", () => ({
  default: () => <div data-testid="production-work-logs-page">work-logs</div>,
}));

vi.mock("../pages/ErrorPage/WeLost", () => ({
  default: () => <div data-testid="not-found-page">not-found</div>,
}));

const LocationProbe = () => {
  const location = useLocation();
  return <span data-testid="location-path">{location.pathname}</span>;
};

const renderRoute = (initialPath) => render(
  <MemoryRouter initialEntries={[initialPath]}>
    <AppRoutes darkTheme={false} />
    <LocationProbe />
  </MemoryRouter>,
);

const expectGuard = (routeKey) => {
  expect(screen.getByTestId("route-guard").dataset.routeKey).toBe(routeKey);
};

describe("AppRoutes canonical navigation", () => {
  it("membuka canonical Inventory Hub melalui guard inventory", async () => {
    renderRoute(APP_ROUTES.INVENTORY.HUB);

    expect((await screen.findByTestId("module-hub")).textContent).toBe(
      "inventory",
    );
    expectGuard(ROUTE_ACCESS_KEYS.INVENTORY_HUB);
  });

  it("membuka canonical Production Hub melalui guard production", async () => {
    renderRoute(APP_ROUTES.PRODUCTION.HUB);

    expect((await screen.findByTestId("module-hub")).textContent).toBe(
      "productions",
    );
    expectGuard(ROUTE_ACCESS_KEYS.PRODUCTION_HUB);
  });

  it("membuka canonical child route Inventory dan Production", async () => {
    const inventoryView = renderRoute(APP_ROUTES.INVENTORY.STOCK_MANAGEMENT);

    expect(await screen.findByTestId("stock-management-page")).toBeTruthy();
    expectGuard(ROUTE_ACCESS_KEYS.STOCK_MANAGEMENT);
    inventoryView.unmount();

    renderRoute(APP_ROUTES.PRODUCTION.WORK_LOGS);

    expect(await screen.findByTestId("production-work-logs-page")).toBeTruthy();
    expectGuard(ROUTE_ACCESS_KEYS.PRODUCTION_WORK_LOGS);
  });

  it.each([
    ["/stock-management", APP_ROUTES.INVENTORY.STOCK_MANAGEMENT, ROUTE_ACCESS_KEYS.STOCK_MANAGEMENT],
    ["/produksi/work-log-produksi", APP_ROUTES.PRODUCTION.WORK_LOGS, ROUTE_ACCESS_KEYS.PRODUCTION_WORK_LOGS],
  ])("mengarahkan compatibility child %s ke canonical route", async (legacyPath, canonicalPath, routeKey) => {
    renderRoute(legacyPath);

    await waitFor(() => {
      expect(screen.getByTestId("location-path").textContent).toBe(canonicalPath);
    });
    expectGuard(routeKey);
  });

  it.each(["/stock", "/produksi"])(
    "tidak menghidupkan kembali exact legacy hub %s",
    async (legacyHubPath) => {
      renderRoute(legacyHubPath);

      expect(await screen.findByTestId("not-found-page")).toBeTruthy();
      expect(screen.getByTestId("location-path").textContent).toBe(
        legacyHubPath,
      );
    },
  );
});
