import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TableActionMenu from "./TableActionMenu";

describe("TableActionMenu", () => {
  it("menampilkan aksi utama dan menjalankan aksi sekunder dari menu", () => {
    const onDetail = vi.fn();
    const onEdit = vi.fn();

    render(
      <TableActionMenu
        visibleActions={[{ key: "detail", label: "Detail", onClick: onDetail }]}
        moreActions={[{ key: "edit", label: "Edit", onClick: onEdit }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Detail" }));
    expect(onDetail).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Aksi lainnya" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("tidak merender container kosong", () => {
    const { container } = render(<TableActionMenu />);
    expect(container.firstChild).toBeNull();
  });
});
