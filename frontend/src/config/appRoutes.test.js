import { describe, expect, it } from "vitest";
import { APP_ROUTES, LEGACY_ROUTE_REDIRECTS } from "./appRoutes";

const canonicalRoutes = Object.values(APP_ROUTES).flatMap((routeGroup) =>
  Object.values(routeGroup),
);

describe("canonical frontend routes", () => {
  it("menjaga seluruh canonical route unik", () => {
    expect(new Set(canonicalRoutes).size).toBe(canonicalRoutes.length);
  });

  it("memakai namespace inventory dan production yang konsisten", () => {
    expect(APP_ROUTES.INVENTORY.HUB).toBe("/inventory");
    expect(APP_ROUTES.INVENTORY.STOCK_MANAGEMENT).toBe(
      "/inventory/stock-management",
    );

    Object.values(APP_ROUTES.PRODUCTION).forEach((path) => {
      expect(path === "/production" || path.startsWith("/production/")).toBe(
        true,
      );
      expect(path).not.toContain("/produksi");
      expect(path).not.toMatch(/^\/production\/production-/);
    });
  });

  it("mengisolasi compatibility child route tanpa menghidupkan kembali hub lama", () => {
    const legacySources = LEGACY_ROUTE_REDIRECTS.map(({ from }) => from);

    expect(new Set(legacySources).size).toBe(legacySources.length);
    expect(legacySources).not.toContain("/stock");
    expect(legacySources).not.toContain("/produksi");
    LEGACY_ROUTE_REDIRECTS.forEach(({ to }) => {
      expect(canonicalRoutes).toContain(to);
    });
  });
});
