import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
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

describe("AppRoutes hub compatibility", () => {
  it("mengarahkan /stock ke canonical inventory melalui guard yang sama", async () => {
    renderRoute("/stock");

    await waitFor(() => {
      expect(screen.getByTestId("location-path").textContent).toBe("/inventory");
    });
    expect(screen.getByTestId("route-guard").dataset.routeKey).toBe(
      ROUTE_ACCESS_KEYS.INVENTORY_HUB,
    );
    expect(screen.getByTestId("module-hub").textContent).toBe("inventory");
  });

  it("mengarahkan /produksi ke canonical production melalui guard yang sama", async () => {
    renderRoute("/produksi");

    await waitFor(() => {
      expect(screen.getByTestId("location-path").textContent).toBe("/production");
    });
    expect(screen.getByTestId("route-guard").dataset.routeKey).toBe(
      ROUTE_ACCESS_KEYS.PRODUCTION_HUB,
    );
    expect(screen.getByTestId("module-hub").textContent).toBe("productions");
  });
});
