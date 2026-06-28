import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ImsNotice from "./ImsNotice";

describe("ImsNotice", () => {
  it("menampilkan variant, ringkasan, dan action yang konsisten", () => {
    const onAction = vi.fn();
    render(
      <ImsNotice
        variant="warning"
        title="Perlu perhatian"
        description="Periksa data sebelum melanjutkan."
        sideItems={[{ key: "issues", label: "Temuan", value: 2, tone: "warning" }]}
        actions={[{ key: "review", label: "Periksa", onClick: onAction }]}
      />,
    );

    const notice = screen.getByText("Perlu perhatian").closest("section");
    expect(notice.className).toContain("ims-notice--warning");
    expect(screen.getByLabelText("Ringkasan notice").textContent).toContain("Temuan");
    fireEvent.click(screen.getByRole("button", { name: "Periksa" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
