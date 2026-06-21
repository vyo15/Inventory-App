import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { APP_ROUTES, LEGACY_ROUTE_REDIRECTS } from "./appRoutes";

const canonicalRoutes = Object.values(APP_ROUTES).flatMap((routeGroup) =>
  Object.values(routeGroup),
);

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_SRC_DIR = path.resolve(TEST_DIR, "..");

const readFrontendSource = (relativePath) =>
  fs.readFileSync(path.join(FRONTEND_SRC_DIR, relativePath), "utf8");

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

  it("memastikan internal navigation utama tidak kembali memakai child route legacy", () => {
    const sourceFiles = [
      "pages/Dashboard/Dashboard.jsx",
      "services/Dashboard/dashboardService.js",
      "utils/stock/stockHelpers.js",
    ];

    sourceFiles.forEach((relativePath) => {
      const source = readFrontendSource(relativePath);
      expect(source).not.toContain('"/stock-management"');
      expect(source).not.toContain("'/stock-management'");
      expect(source).not.toContain('"/produksi/');
      expect(source).not.toContain("'/produksi/");
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
