import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import CashFlowPageShell from "./CashFlowPageShell";

describe("CashFlowPageShell", () => {
  it("menerima kontrak presentasi terkelompok tanpa business callback khusus domain", () => {
    const element = CashFlowPageShell({
      header: {
        title: "Pemasukan Kas",
        subtitle: "Pemasukan manual.",
        actionKey: "add",
        actionLabel: "Tambah",
        onAdd: () => {},
      },
      summary: { items: [], columns: {}, highlightKey: "total", extra: null },
      filter: {
        title: "Filter Pemasukan",
        selectedYear: 2026,
        selectedMonth: "all",
        yearOptions: [2026],
        onYearChange: () => {},
        onMonthChange: () => {},
      },
      table: {
        title: "Daftar Pemasukan",
        countTagColor: "blue",
        rows: [],
        loading: false,
        columns: [],
        mobileCardConfig: {},
        emptyText: "Belum ada data.",
      },
      formModal: {
        title: "Tambah Pemasukan",
        open: false,
        onCancel: () => {},
        form: {},
        onFinish: () => {},
        typeLabel: "Tipe",
        typeRequiredMessage: "Wajib",
        typeOptions: [],
        defaultType: "Lain-lain",
      },
    });

    expect(element).toBeTruthy();
  });

  it("menjaga create dan delete authority tetap di halaman domain", () => {
    const shellSource = fs.readFileSync(
      path.resolve("src/pages/Finance/components/CashFlowPageShell.jsx"),
      "utf8",
    );
    const cashOutSource = fs.readFileSync(
      path.resolve("src/pages/Finance/CashOut.jsx"),
      "utf8",
    );

    expect(shellSource).not.toContain("createCashOutTransaction");
    expect(shellSource).not.toContain("deleteCashOutTransaction");
    expect(cashOutSource).toContain("deleteCashOutTransaction");
    expect(cashOutSource).toContain("renderCashOutActions");
  });
});
