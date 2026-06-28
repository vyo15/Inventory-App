import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StatusTag from "./StatusTag";

describe("StatusTag", () => {
  it("memasang class shared dan warna semantic", () => {
    render(<StatusTag tone="success">Aktif</StatusTag>);
    const tag = screen.getByText("Aktif");
    expect(tag.className).toContain("ims-status-tag");
    expect(tag.className).toContain("ant-tag-green");
  });

  it("tetap menerima color domain existing", () => {
    render(<StatusTag color="purple">Produksi</StatusTag>);
    expect(screen.getByText("Produksi").className).toContain("ant-tag-purple");
  });
});
