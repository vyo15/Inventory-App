import { describe, expect, it } from "vitest";
import { getSavingPresentation } from "./savingPresentation";

describe("getSavingPresentation", () => {
  it("membedakan hemat, lebih mahal, dan nilai normal", () => {
    expect(getSavingPresentation(1500)).toMatchObject({ status: "hemat", color: "green" });
    expect(getSavingPresentation(-1500)).toMatchObject({ status: "lebih_mahal", color: "red" });
    expect(getSavingPresentation("tidak-valid")).toEqual({
      status: "normal",
      label: "Sesuai Referensi",
      color: "default",
    });
  });
});
