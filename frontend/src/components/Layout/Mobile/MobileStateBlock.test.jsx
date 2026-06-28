import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MobileStateBlock from "./MobileStateBlock";

describe("MobileStateBlock", () => {
  it("memisahkan error dari empty dan menyediakan retry", () => {
    const onRetry = vi.fn();
    render(
      <MobileStateBlock
        type="error"
        title="Gagal memuat"
        description="Layanan lokal tidak tersedia."
        actionLabel="Coba lagi"
        onAction={onRetry}
      />,
    );

    expect(screen.getByText("Gagal memuat")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
