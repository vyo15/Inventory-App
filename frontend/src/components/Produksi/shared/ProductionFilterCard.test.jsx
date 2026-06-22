import { fireEvent, render, screen } from "@testing-library/react";
import { Col } from "antd";
import { describe, expect, it } from "vitest";
import ProductionFilterCard from "./ProductionFilterCard";

describe("ProductionFilterCard", () => {
  it("mempertahankan surface produksi tanpa membuat surface FilterBar ganda", () => {
    const { container } = render(
      <ProductionFilterCard mobileCompact={false}>
        <Col>Filter utama</Col>
      </ProductionFilterCard>,
    );

    expect(container.querySelector(".ims-production-filter-card")).not.toBeNull();
    expect(container.querySelector(".ims-production-filter-card__bar")).not.toBeNull();
    expect(container.querySelector(".filter-bar-surface")).toBeNull();
  });

  it("membuka drawer lanjutan dengan copy produksi saat child melebihi batas utama", async () => {
    const { container } = render(
      <ProductionFilterCard mobilePrimaryCount={1}>
        <Col>Filter utama</Col>
        <Col>Filter lanjutan</Col>
      </ProductionFilterCard>,
    );

    const trigger = container.querySelector(".filter-bar-mobile-trigger button");
    expect(trigger).not.toBeNull();
    fireEvent.click(trigger);

    expect(await screen.findByText("Filter produksi")).toBeTruthy();
    expect(screen.getByText(/Filter tambahan dipindahkan ke panel mobile/i)).toBeTruthy();
  });
});
