import { App as AntdApp } from "antd";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MobileActionMenu from "./MobileActionMenu";

const renderMenu = (props) => render(
  <AntdApp>
    <MobileActionMenu {...props} />
  </AntdApp>,
);

describe("MobileActionMenu", () => {
  it("menjalankan aksi utama dan aksi tambahan biasa", () => {
    const onDetail = vi.fn();
    const onEdit = vi.fn();

    renderMenu({
      primaryActions: [{ key: "detail", label: "Detail", onClick: onDetail }],
      moreActions: [{ key: "edit", label: "Edit", onClick: onEdit }],
    });

    fireEvent.click(screen.getByRole("button", { name: "Detail" }));
    fireEvent.click(screen.getByRole("button", { name: "Aksi lainnya" }));
    fireEvent.click(screen.getByText("Edit"));

    expect(onDetail).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("menjaga aksi destructive di belakang konfirmasi", async () => {
    const onDeactivate = vi.fn();

    renderMenu({
      primaryActions: [{ key: "detail", label: "Detail", onClick: vi.fn() }],
      moreActions: [{
        key: "deactivate",
        label: "Nonaktifkan",
        danger: true,
        confirm: {
          title: "Nonaktifkan data ini?",
          description: "Data lama tetap tersimpan.",
          okText: "Ya",
          cancelText: "Batal",
        },
        onClick: onDeactivate,
      }],
    });

    fireEvent.click(screen.getByRole("button", { name: "Aksi lainnya" }));
    fireEvent.click(screen.getByText("Nonaktifkan"));

    expect(onDeactivate).not.toHaveBeenCalled();
    expect((await screen.findAllByText("Nonaktifkan data ini?")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Ya" }));

    await waitFor(() => expect(onDeactivate).toHaveBeenCalledTimes(1));
  });
});
