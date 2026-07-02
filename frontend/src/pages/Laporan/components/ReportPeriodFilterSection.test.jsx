import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ReportPeriodFilterSection from "./ReportPeriodFilterSection";

vi.mock("antd", () => ({
  Col: ({ children }) => <div>{children}</div>,
  DatePicker: {
    RangePicker: ({ onChange }) => (
      <button type="button" onClick={() => onChange(null)}>Reset periode</button>
    ),
  },
}));

vi.mock("../../../components/Layout/Filters/FilterBar", () => ({
  default: ({ children }) => <div>{children}</div>,
}));

vi.mock("../../../components/Layout/Page/PageSection", () => ({
  default: ({ title, subtitle, children }) => (
    <section><h2>{title}</h2><p>{subtitle}</p>{children}</section>
  ),
}));

describe("ReportPeriodFilterSection", () => {
  it("menampilkan subtitle domain dan memakai default range saat value dibersihkan", () => {
    const onChange = vi.fn();
    render(
      <ReportPeriodFilterSection
        value={[]}
        onChange={onChange}
        subtitle="Periode laporan transaksi."
      />,
    );

    expect(screen.getByText("Filter Periode")).toBeTruthy();
    expect(screen.getByText("Periode laporan transaksi.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset periode" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatchObject({
      startDate: expect.any(Object),
      endDate: expect.any(Object),
      endDateExclusive: expect.any(Object),
    });
  });
});
