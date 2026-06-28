import { describe, expect, it } from "vitest";
import { formatFileSizeId } from "./fileSizeId";

describe("formatFileSizeId", () => {
  it("memformat byte, KB, dan MB secara konsisten", () => {
    expect(formatFileSizeId(0)).toBe("0 B");
    expect(formatFileSizeId(1024)).toBe("1 KB");
    expect(formatFileSizeId(1024 * 1024 * 1.5)).toBe("1,5 MB");
  });
});
