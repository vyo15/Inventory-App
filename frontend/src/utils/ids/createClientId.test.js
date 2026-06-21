import { describe, expect, it, vi } from "vitest";
import { createClientId } from "./createClientId";

describe("createClientId", () => {
  it("menggunakan crypto.randomUUID ketika tersedia", () => {
    const randomUuid = vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("uuid-test");
    expect(createClientId("line")).toBe("line-uuid-test");
    randomUuid.mockRestore();
  });

  it("menghasilkan ID berbeda untuk pemanggilan berdekatan", () => {
    const first = createClientId("line");
    const second = createClientId("line");
    expect(first).not.toBe(second);
  });
});
