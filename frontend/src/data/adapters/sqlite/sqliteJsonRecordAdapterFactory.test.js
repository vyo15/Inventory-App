import { afterEach, describe, expect, it, vi } from "vitest";
import { createSqliteInitialLoadSubscription } from "./sqliteJsonRecordAdapterFactory";

describe("sqlite adapter initial-load subscription", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("melakukan initial load tanpa membuat polling interval per-adapter", async () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const callback = vi.fn();
    const loadRecords = vi.fn().mockResolvedValue([{ id: "one" }]);

    const unsubscribe = createSqliteInitialLoadSubscription({
      loadRecords,
      callback,
      onError: vi.fn(),
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(loadRecords).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith([{ id: "one" }]);
    expect(setIntervalSpy).not.toHaveBeenCalled();

    unsubscribe();
  });

  it("tidak mengirim callback setelah subscription dibatalkan", async () => {
    let resolveRequest;
    const loadRecords = vi.fn().mockReturnValue(new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    const callback = vi.fn();

    const unsubscribe = createSqliteInitialLoadSubscription({
      loadRecords,
      callback,
      onError: vi.fn(),
    });
    unsubscribe();
    resolveRequest([{ id: "late" }]);
    await Promise.resolve();
    await Promise.resolve();

    expect(callback).not.toHaveBeenCalled();
  });
});
