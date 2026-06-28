import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSqliteRealtimeStatus,
  subscribeSqliteRealtime,
  subscribeSqliteRealtimeStatus,
  SQLITE_REALTIME_FALLBACK_INTERVAL_MS,
} from "./sqliteRealtimeService";
import { getSqliteClientId } from "./sqliteBackendStatusService";

class FakeEventSource {
  static instances = [];

  constructor(url, options = {}) {
    this.url = url;
    this.options = options;
    this.listeners = new Map();
    this.closed = false;
    this.onerror = null;
    FakeEventSource.instances.push(this);
  }

  addEventListener(eventName, listener) {
    this.listeners.set(eventName, listener);
  }

  emit(eventName, payload = {}) {
    this.listeners.get(eventName)?.({ data: JSON.stringify(payload) });
  }

  close() {
    this.closed = true;
  }
}

beforeEach(() => {
  FakeEventSource.instances = [];
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.sessionStorage.setItem("ims.sqlite.clientId", "legacy-duplicated-client");
  Object.defineProperty(window, "EventSource", {
    configurable: true,
    writable: true,
    value: FakeEventSource,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("sqliteRealtimeService", () => {
  it("membuka satu SSE ber-cookie, menerima perubahan client lain, dan mengabaikan echo sendiri", () => {
    const events = [];
    const statuses = [];
    const unsubscribeEvent = subscribeSqliteRealtime((event) => events.push(event));
    const unsubscribeStatus = subscribeSqliteRealtimeStatus((nextStatus) => statuses.push(nextStatus));

    expect(FakeEventSource.instances).toHaveLength(1);
    const source = FakeEventSource.instances[0];
    const clientId = getSqliteClientId();
    expect(source.url).toContain(`/api/realtime/events?clientId=${encodeURIComponent(clientId)}`);
    expect(clientId).toContain(":page-");
    expect(clientId).not.toContain("legacy-duplicated-client");
    expect(source.options).toEqual({ withCredentials: true });

    source.emit("connected", { revision: 3 });
    source.emit("data_changed", {
      revision: 4,
      originClientId: "client-b",
      tables: ["customers"],
      scopes: ["customers"],
    });
    source.emit("data_changed", {
      revision: 5,
      originClientId: clientId,
      tables: ["customers"],
      scopes: ["customers"],
    });
    source.emit("session_expired", { revision: 5 });

    expect(events.map((event) => event.type)).toEqual(["connected", "data_changed", "session_expired"]);
    expect(events[1]).toMatchObject({ revision: 4, scopes: ["customers"] });
    expect(statuses.some((item) => item.connected === true)).toBe(true);
    expect(getSqliteRealtimeStatus()).toMatchObject({ connected: true, transport: "server_sent_events" });

    unsubscribeEvent();
    unsubscribeStatus();
    expect(source.closed).toBe(true);
  });

  it("fallback polling hanya mengirim refresh ketika revision backend berubah", async () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "EventSource", {
      configurable: true,
      writable: true,
      value: undefined,
    });

    const fetchMock = vi.spyOn(window, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, data: { revision: 7 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, data: { revision: 7 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, data: { revision: 8 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));

    const events = [];
    const unsubscribe = subscribeSqliteRealtime((event) => events.push(event));

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(events).toEqual([]);

    await vi.advanceTimersByTimeAsync(SQLITE_REALTIME_FALLBACK_INTERVAL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(events).toEqual([]);

    await vi.advanceTimersByTimeAsync(SQLITE_REALTIME_FALLBACK_INTERVAL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "fallback_tick",
      revision: 8,
      scopes: ["*"],
      transport: "polling_fallback",
    });

    unsubscribe();
  });
});
