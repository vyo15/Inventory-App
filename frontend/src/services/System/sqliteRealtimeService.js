import {
  fetchSqliteJson,
  getSqliteBackendBaseUrl,
  getSqliteClientId,
} from "./sqliteBackendStatusService";

const REALTIME_FALLBACK_INTERVAL_MS = 60_000;
const listeners = new Set();
const statusListeners = new Set();
let eventSource = null;
let fallbackTimer = null;
let fallbackVisibilityListenerAttached = false;
let fallbackRequestInFlight = false;
let lastKnownRevision = null;
let status = {
  state: "idle",
  connected: false,
  transport: "server_sent_events",
  lastConnectedAt: null,
  lastEventAt: null,
  lastErrorAt: null,
};

const emitStatus = (patch = {}) => {
  status = { ...status, ...patch };
  for (const listener of statusListeners) listener(status);
};

const emitEvent = (event) => {
  const revision = Number(event?.revision);
  if (Number.isFinite(revision)) lastKnownRevision = revision;
  status = { ...status, lastEventAt: new Date().toISOString() };
  for (const listener of listeners) listener(event);
};

const parsePayload = (event, eventName) => {
  try {
    return { ...JSON.parse(event.data || "{}"), type: eventName };
  } catch {
    return { type: eventName, occurredAt: new Date().toISOString() };
  }
};

const stopFallbackTimer = () => {
  if (fallbackTimer) {
    window.clearInterval(fallbackTimer);
    fallbackTimer = null;
  }
  if (fallbackVisibilityListenerAttached) {
    document.removeEventListener("visibilitychange", handleFallbackVisibilityChange);
    fallbackVisibilityListenerAttached = false;
  }
};

const checkFallbackRevision = async () => {
  if (
    status.connected
    || document.visibilityState === "hidden"
    || fallbackRequestInFlight
  ) return;

  fallbackRequestInFlight = true;
  try {
    const response = await fetchSqliteJson("/api/realtime/status");
    const revision = Number(response?.data?.revision);
    if (!Number.isFinite(revision)) return;
    if (lastKnownRevision === null) {
      lastKnownRevision = revision;
      return;
    }
    if (revision === lastKnownRevision) return;
    emitEvent({
      type: "fallback_tick",
      revision,
      tables: [],
      scopes: ["*"],
      occurredAt: new Date().toISOString(),
      transport: "polling_fallback",
    });
  } catch {
    // EventSource tetap melakukan reconnect native; fallback mencoba lagi pada interval berikutnya.
  } finally {
    fallbackRequestInFlight = false;
  }
};

const ensureFallbackTimer = () => {
  if (fallbackTimer || typeof window === "undefined") return;
  fallbackTimer = window.setInterval(checkFallbackRevision, REALTIME_FALLBACK_INTERVAL_MS);
  if (!fallbackVisibilityListenerAttached) {
    document.addEventListener("visibilitychange", handleFallbackVisibilityChange);
    fallbackVisibilityListenerAttached = true;
  }
  checkFallbackRevision();
};

function handleFallbackVisibilityChange() {
  if (document.visibilityState === "visible") checkFallbackRevision();
}

const handleConnected = (event) => {
  stopFallbackTimer();
  emitStatus({
    state: "connected",
    connected: true,
    lastConnectedAt: new Date().toISOString(),
  });
  emitEvent(parsePayload(event, "connected"));
};

const handleDataEvent = (eventName) => (event) => {
  const payload = parsePayload(event, eventName);
  emitEvent({
    ...payload,
    isLocalOrigin: eventName === "data_changed"
      && Boolean(payload.originClientId)
      && payload.originClientId === getSqliteClientId(),
  });
};

const startSqliteRealtime = () => {
  if (typeof window === "undefined" || typeof window.EventSource !== "function") {
    emitStatus({ state: "unsupported", connected: false });
    ensureFallbackTimer();
    return;
  }
  if (eventSource) return;

  const query = new URLSearchParams({ clientId: getSqliteClientId() });
  const url = `${getSqliteBackendBaseUrl()}/api/realtime/events?${query.toString()}`;
  emitStatus({ state: "connecting", connected: false });
  eventSource = new window.EventSource(url, { withCredentials: true });
  eventSource.addEventListener("connected", handleConnected);
  eventSource.addEventListener("data_changed", handleDataEvent("data_changed"));
  eventSource.addEventListener("database_replaced", handleDataEvent("database_replaced"));
  eventSource.addEventListener("session_expired", handleDataEvent("session_expired"));
  eventSource.addEventListener("heartbeat", handleDataEvent("heartbeat"));
  eventSource.addEventListener("server_shutdown", handleDataEvent("server_shutdown"));
  eventSource.onerror = () => {
    emitStatus({
      state: "reconnecting",
      connected: false,
      lastErrorAt: new Date().toISOString(),
    });
    ensureFallbackTimer();
  };
};

const stopSqliteRealtime = () => {
  if (eventSource) eventSource.close();
  eventSource = null;
  stopFallbackTimer();
  fallbackRequestInFlight = false;
  lastKnownRevision = null;
  emitStatus({ state: "idle", connected: false });
};

export const restartSqliteRealtime = () => {
  const hasSubscribers = listeners.size > 0 || statusListeners.size > 0;
  stopSqliteRealtime();
  if (hasSubscribers) startSqliteRealtime();
};

export const subscribeSqliteRealtime = (listener) => {
  listeners.add(listener);
  startSqliteRealtime();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && statusListeners.size === 0) stopSqliteRealtime();
  };
};

export const subscribeSqliteRealtimeStatus = (listener) => {
  statusListeners.add(listener);
  listener(status);
  startSqliteRealtime();
  return () => {
    statusListeners.delete(listener);
    if (listeners.size === 0 && statusListeners.size === 0) stopSqliteRealtime();
  };
};

export const getSqliteRealtimeStatus = () => ({ ...status });
export const SQLITE_REALTIME_FALLBACK_INTERVAL_MS = REALTIME_FALLBACK_INTERVAL_MS;
