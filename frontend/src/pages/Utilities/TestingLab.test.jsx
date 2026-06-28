import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = fs.readFileSync(path.resolve("src/pages/Utilities/TestingLab.jsx"), "utf8");
const serviceSource = fs.readFileSync(path.resolve("src/services/System/testingLabService.js"), "utf8");
const headerTagSource = fs.readFileSync(path.resolve("src/components/Layout/Header/TestingModeTag.jsx"), "utf8");
const routesSource = fs.readFileSync(path.resolve("src/router/AppRoutes.jsx"), "utf8");
const sidebarSource = fs.readFileSync(path.resolve("src/config/sidebarMenu.js"), "utf8");

const testingLabEndpoints = [
  "/api/testing-lab/runtime",
  "/api/testing-lab/status",
  "/api/testing-lab/operational-source/preview",
  "/api/testing-lab/operational-source/clone",
  "/api/testing-lab/baseline",
  "/api/testing-lab/baseline/select",
  "/api/testing-lab/reset",
  "/api/testing-lab/sessions",
  "/api/testing-lab/sessions/complete",
  "/api/testing-lab/sessions/cancel",
  "/api/testing-lab/validate",
  "/api/testing-lab/result-export",
];

describe("Testing Lab frontend contract", () => {
  it("menyediakan route dan menu admin terpisah dari Maintenance Center", () => {
    expect(routesSource).toContain('path="/utilities/testing-lab"');
    expect(routesSource).toContain("ROUTE_ACCESS_KEYS.TESTING_LAB");
    expect(sidebarSource).toContain('label: "Lab Pengujian"');
    expect(sidebarSource).toContain('path: "/utilities/testing-lab"');
  });

  it("menggunakan seluruh endpoint guarded tanpa direct database access", () => {
    testingLabEndpoints.forEach((endpoint) => expect(serviceSource).toContain(endpoint));
    expect(serviceSource).not.toContain("sqlite3");
    expect(serviceSource).not.toContain("indexedDB");
    expect(pageSource).not.toContain("INSERT INTO");
    expect(pageSource).not.toContain("DELETE FROM");
  });

  it("menampilkan sandbox guard, baseline, guided scenario, validasi, diff, dan riwayat", () => {
    expect(pageSource).toContain("MODE TESTING — BUKAN DATA TOKO ASLI");
    expect(pageSource).toContain("Baseline Sandbox");
    expect(pageSource).toContain("Ambil Data Operasional");
    expect(pageSource).toContain("login ulang");
    expect(pageSource).toContain("Skenario Pengujian");
    expect(pageSource).toContain("Validasi & Hasil");
    expect(pageSource).toContain("Diff Sesi Terakhir");
    expect(pageSource).toContain("Riwayat Sesi");
    expect(pageSource).toContain("Reset Sandbox ke Baseline");
    expect(pageSource).toContain("pre-reset");
  });

  it("badge mode testing berasal dari runtime backend, bukan flag frontend", () => {
    expect(headerTagSource).toContain("getTestingLabRuntimeStatus");
    expect(headerTagSource).toContain("guard?.isSandbox");
    expect(headerTagSource).toContain("guard.available === true");
    expect(headerTagSource).toContain("MODE TESTING");
    expect(headerTagSource).toContain("SANDBOX TIDAK AMAN");
    expect(headerTagSource).not.toContain("import.meta.env");
  });
});
