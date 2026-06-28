import { describe, expect, it } from "vitest";
import {
  isGlobalRealtimeReloadEvent,
  REALTIME_ROUTE_SCOPES,
  realtimeEventMatchesScopes,
} from "./realtimeRouteScopes";
import { ROUTE_ACCESS_KEYS } from "../utils/auth/roleAccess";

describe("realtime route scope coverage", () => {
  it("memberi scope realtime pada seluruh route protected aktif", () => {
    const routeKeys = Object.values(ROUTE_ACCESS_KEYS);
    const missing = routeKeys.filter((routeKey) => !Array.isArray(REALTIME_ROUTE_SCOPES[routeKey]) || REALTIME_ROUTE_SCOPES[routeKey].length === 0);

    expect(missing).toEqual([]);
  });

  it("memproses perubahan auth secara global sebelum filter route", () => {
    const event = {
      type: "data_changed",
      revision: 12,
      scopes: ["auth", "user_management"],
    };

    expect(isGlobalRealtimeReloadEvent(event)).toBe(true);
    expect(realtimeEventMatchesScopes(event, ["sales", "stock"])).toBe(true);
  });

  it("memisahkan event session biasa dari reload auth global", () => {
    const event = {
      type: "data_changed",
      revision: 13,
      scopes: ["auth_session"],
    };

    expect(isGlobalRealtimeReloadEvent(event)).toBe(false);
    expect(realtimeEventMatchesScopes(event, ["sales", "stock"])).toBe(false);
  });

  it("tetap mencocokkan scope route dan fallback global", () => {
    expect(realtimeEventMatchesScopes({ type: "data_changed", scopes: ["stock"] }, ["stock"])).toBe(true);
    expect(realtimeEventMatchesScopes({ type: "data_changed", scopes: ["finance"] }, ["stock"])).toBe(false);
    expect(realtimeEventMatchesScopes({ type: "fallback_tick", scopes: ["*"] }, ["stock"])).toBe(true);
    expect(realtimeEventMatchesScopes({ type: "session_expired" }, ["stock"])).toBe(true);
  });
});
