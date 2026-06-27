import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useAuth from "../../hooks/useAuth";
import { ROLES } from "../../utils/auth/roleAccess";
import ModuleHub from "./ModuleHub";

vi.mock("../../hooks/useAuth", () => ({
  default: vi.fn(),
}));

const renderModuleHub = (moduleKey) => render(
  <MemoryRouter>
    <ModuleHub moduleKey={moduleKey} />
  </MemoryRouter>,
);

describe("ModuleHub sections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("menampilkan section dan urutan card Master Data", () => {
    useAuth.mockReturnValue({
      profile: { role: ROLES.ADMINISTRATOR },
    });

    renderModuleHub("master-data");

    expect(screen.getByRole("heading", { name: "Produk & Material" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Mitra & Harga" })).toBeTruthy();
    expect(
      screen.getAllByRole("button").map((button) => button.getAttribute("aria-label")),
    ).toEqual([
      "Buka Produk Jadi",
      "Buka Bahan Baku",
      "Buka Kategori & Kelompok",
      "Buka Supplier",
      "Buka Customer",
      "Buka Aturan Harga",
    ]);
  });

  it("tetap menghormati role filter pada Production Workspace", () => {
    useAuth.mockReturnValue({
      profile: { role: ROLES.USER },
    });

    renderModuleHub("productions");

    expect(
      screen.getByRole("heading", { name: "Operasional Produksi" }),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Pengaturan Produksi" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Biaya & Analisis" })).toBeNull();
  });
});
