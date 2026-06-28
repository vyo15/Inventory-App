import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ActionResultModalHost,
  showActionSuccess,
} from "./actionResultFeedback";

describe("actionResultFeedback", () => {
  it("mengantrikan feedback yang dipicu sebelum host mount", async () => {
    showActionSuccess({ title: "Export selesai", content: "File berhasil dibuat." });
    render(<ActionResultModalHost />);

    expect(await screen.findByText("Export selesai")).toBeTruthy();
    expect(screen.getByText("File berhasil dibuat.")).toBeTruthy();
  });
});
