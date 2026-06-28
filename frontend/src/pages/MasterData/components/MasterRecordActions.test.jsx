import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MasterRecordActions from "./MasterRecordActions";
import { buildMasterRecordMobileActions } from "./masterRecordActionHelpers";

describe("MasterRecordActions", () => {
  it("meneruskan detail/edit dan menyesuaikan label status aktif", () => {
    const record = { id: "P-1", isActive: true };
    const onDetail = vi.fn();
    const onEdit = vi.fn();

    render(
      <MasterRecordActions
        record={record}
        onDetail={onDetail}
        onEdit={onEdit}
        onToggle={vi.fn()}
        toggleTitle="Nonaktifkan data?"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /detail/i }));
    fireEvent.click(screen.getByRole("button", { name: /aksi lainnya/i }));
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    expect(onDetail).toHaveBeenCalledWith(record);
    expect(onEdit).toHaveBeenCalledWith(record);

    fireEvent.click(screen.getByRole("button", { name: /aksi lainnya/i }));
    expect(screen.getByRole("button", { name: "Nonaktifkan" })).toBeTruthy();
  });

  it("membangun aksi mobile dari handler yang sama", () => {
    const record = { id: "R-1", isActive: false };
    const onToggle = vi.fn();
    const actions = buildMasterRecordMobileActions({
      record,
      onDetail: vi.fn(),
      onEdit: vi.fn(),
      onToggle,
    });

    expect(actions.primaryActions[0].label).toBe("Detail");
    expect(actions.moreActions.map((item) => item.label)).toEqual(["Edit", "Aktifkan"]);
    actions.moreActions[1].onClick();
    expect(onToggle).toHaveBeenCalledWith(record);
  });
});
