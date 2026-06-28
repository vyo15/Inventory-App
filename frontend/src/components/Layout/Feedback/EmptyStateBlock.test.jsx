import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EmptyStateBlock from "./EmptyStateBlock";

describe("EmptyStateBlock", () => {
  it("menampilkan title, description, dan action", () => {
    const onAction = vi.fn();
    render(
      <EmptyStateBlock
        title="Belum ada transaksi"
        description="Tambahkan transaksi pertama."
        actionLabel="Tambah"
        onAction={onAction}
      />,
    );

    expect(screen.getByText("Belum ada transaksi")).toBeTruthy();
    expect(screen.getByText("Tambahkan transaksi pertama.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tambah" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
