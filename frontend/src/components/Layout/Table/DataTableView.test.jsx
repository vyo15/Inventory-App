import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DataTableView from "./DataTableView";

const columns = [{ title: "Nama", dataIndex: "name", key: "name" }];

describe("DataTableView", () => {
  it("menampilkan error terpisah dari empty state dan retry", () => {
    const onRetry = vi.fn();
    render(
      <DataTableView
        columns={columns}
        dataSource={[]}
        error={new Error("Backend terputus")}
        onRetry={onRetry}
        pagination={false}
        showRefreshIndicator={false}
      />,
    );

    expect(screen.getAllByText("Data belum bisa dimuat").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Coba lagi" })[0]);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("clickable mobile card dapat dibuka dengan keyboard", () => {
    const onCardClick = vi.fn();
    render(
      <DataTableView
        columns={columns}
        dataSource={[{ id: "1", name: "Bunga Mawar" }]}
        rowKey="id"
        pagination={false}
        showRefreshIndicator={false}
        mobileCardConfig={{
          title: "name",
          onCardClick,
          ariaLabel: (record) => `Buka ${record.name}`,
        }}
      />,
    );

    const card = document.querySelector('[aria-label="Buka Bunga Mawar"]');
    expect(card).not.toBeNull();
    expect(card.getAttribute("role")).toBe("button");
    expect(card.getAttribute("tabindex")).toBe("0");
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });
    expect(onCardClick).toHaveBeenCalledTimes(2);
  });
});
