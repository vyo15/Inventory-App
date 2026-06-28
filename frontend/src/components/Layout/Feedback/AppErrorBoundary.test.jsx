import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppErrorBoundary from "./AppErrorBoundary";

let shouldThrow = true;

const GuardedChild = () => {
  if (shouldThrow) throw new Error("Render gagal");
  return <div>Konten aman</div>;
};

describe("AppErrorBoundary", () => {
  beforeEach(() => {
    shouldThrow = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("menahan white screen dan dapat mencoba render ulang", () => {
    render(
      <AppErrorBoundary resetKey="route-a">
        <GuardedChild />
      </AppErrorBoundary>,
    );

    expect(screen.getByText("Halaman gagal ditampilkan")).toBeTruthy();
    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: /Coba tampilkan lagi/ }));
    expect(screen.getByText("Konten aman")).toBeTruthy();
  });
});
