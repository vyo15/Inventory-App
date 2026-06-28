import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PageContentCanvas from "./PageContentCanvas";

describe("PageContentCanvas", () => {
  it("merender children dalam satu canvas isi halaman", () => {
    const { container } = render(
      <PageContentCanvas className="custom-canvas">
        <div>Ringkasan</div>
        <div>Daftar data</div>
      </PageContentCanvas>,
    );

    const canvas = container.querySelector(".page-content-canvas");
    expect(canvas).not.toBeNull();
    expect(canvas.classList.contains("page-content-canvas--default")).toBe(true);
    expect(canvas.classList.contains("custom-canvas")).toBe(true);
    expect(screen.getByText("Ringkasan")).toBeTruthy();
    expect(screen.getByText("Daftar data")).toBeTruthy();
  });
});
