const crypto = require("crypto");
const logger = require("../../utils/logger");

const REALTIME_HEARTBEAT_INTERVAL_MS = 25_000;
const REALTIME_MUTATION_DEBOUNCE_MS = 35;
const REALTIME_CONTRACT_VERSION = 1;
const REALTIME_MAX_CLIENTS_TOTAL = 100;
const REALTIME_MAX_CLIENTS_PER_USER = 12;
const REALTIME_MAX_CLIENTS_PER_IP = 30;

const TABLE_SCOPE_MAP = Object.freeze({
  schema_meta: ["maintenance"],
  app_settings: ["settings", "maintenance"],
  audit_logs: ["audit", "maintenance"],
  backup_logs: ["backup_restore", "maintenance"],
  restore_logs: ["backup_restore", "maintenance"],
  module_migration_status: ["maintenance"],
  business_code_counters: ["maintenance"],
  roles: ["auth", "maintenance"],
  users: ["auth", "user_management", "maintenance"],
  local_user_sessions: ["auth_session"],
  customers: ["customers", "master_data", "transactions", "dashboard", "reports", "maintenance"],
  categories: ["categories", "master_data", "products", "raw_materials", "semi_finished_materials", "maintenance"],
  suppliers: ["suppliers", "master_data", "purchases", "maintenance"],
  supplier_catalog_offers: ["suppliers", "supplier_catalog", "purchases", "maintenance"],
  supplier_catalog_history: ["suppliers", "supplier_catalog", "maintenance"],
  pricing_rules: ["pricing_rules", "master_data", "products", "raw_materials", "maintenance"],
  products: ["products", "master_data", "stock", "transactions", "production", "dashboard", "reports", "maintenance"],
  raw_materials: ["raw_materials", "master_data", "stock", "transactions", "production", "dashboard", "reports", "maintenance"],
  semi_finished_materials: ["semi_finished_materials", "master_data", "stock", "production", "dashboard", "reports", "maintenance"],
  stock_read_models: ["stock", "dashboard", "reports", "maintenance"],
  stock_adjustments: ["stock", "dashboard", "reports", "maintenance"],
  inventory_logs: ["stock", "transactions", "production", "dashboard", "reports", "maintenance"],
  purchases: ["purchases", "transactions", "stock", "finance", "dashboard", "reports", "maintenance"],
  sales: ["sales", "transactions", "stock", "finance", "dashboard", "reports", "maintenance"],
  returns: ["returns", "transactions", "stock", "finance", "dashboard", "reports", "maintenance"],
  incomes: ["finance", "cash_in", "dashboard", "reports", "maintenance"],
  expenses: ["finance", "cash_out", "dashboard", "reports", "maintenance"],
  money_movement_ledger: ["finance", "ledger", "dashboard", "reports", "maintenance"],
  production_steps: ["production", "production_steps", "maintenance"],
  production_employees: ["production", "production_employees", "maintenance"],
  production_profiles: ["production", "production_profiles", "maintenance"],
  production_boms: ["production", "production_boms", "stock", "maintenance"],
  production_planning: ["production", "production_planning", "dashboard", "reports", "maintenance"],
  production_orders: ["production", "production_orders", "stock", "dashboard", "reports", "maintenance"],
  production_work_logs: ["production", "production_work_logs", "stock", "finance", "dashboard", "reports", "maintenance"],
  production_payrolls: ["production", "production_payrolls", "finance", "dashboard", "reports", "maintenance"],
  report_snapshots: ["reports", "dashboard", "maintenance"],
  migration_identity_map: ["maintenance"],
});


const OPERATIONAL_USER_REALTIME_SCOPES = new Set([
  "auth",
  "dashboard",
  "stock",
  "transactions",
  "purchases",
  "sales",
  "returns",
  "production",
  "production_planning",
  "production_orders",
  "production_work_logs",
  "products",
  "raw_materials",
  "semi_finished_materials",
  "suppliers",
  "supplier_catalog",
  "customers",
  "categories",
  "pricing_rules",
]);

const buildClientEventPayload = (client = {}, eventName = "data_changed", payload = {}) => {
  if (client.role === "administrator") return payload;
  if (eventName !== "data_changed") return payload;
  if (client.role !== "user") return null;

  const allowedScopes = (payload.scopes || []).filter((scope) => (
    OPERATIONAL_USER_REALTIME_SCOPES.has(scope)
  ));
  if (allowedScopes.length === 0) return null;

  return {
    ...payload,
    tables: [],
    scopes: allowedScopes,
    metadata: null,
  };
};

const clients = new Map();
let heartbeatTimer = null;
let mutationFlushTimer = null;
let revision = 0;
const roleRevisions = {
  user: 0,
};
let pendingMutationTables = new Set();
let pendingOriginClientIds = new Set();
let pendingMutationHasMissingOrigin = false;
let lastEvent = null;

const normalizeTableName = (value = "") => String(value || "")
  .trim()
  .replace(/^[`"\[]|[`"\]]$/g, "")
  .toLowerCase();

const normalizeTables = (tables = []) => [...new Set(
  (Array.isArray(tables) ? tables : [tables])
    .map(normalizeTableName)
    .filter(Boolean)
)];

const buildScopesForTables = (tables = []) => {
  const scopes = new Set(["database"]);
  for (const tableName of normalizeTables(tables)) {
    scopes.add(tableName);
    for (const scope of TABLE_SCOPE_MAP[tableName] || []) scopes.add(scope);
  }
  return [...scopes].sort();
};

const writeSseEvent = (client, eventName, payload) => {
  if (!client?.res || client.closed) return false;
  try {
    const accepted = client.res.write(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`);
    if (!accepted) {
      client.closed = true;
      if (client.expiryTimer) clearTimeout(client.expiryTimer);
      clients.delete(client.id);
      stopHeartbeatIfIdle();
      client.res.end();
      logger.warn("sqlite_realtime_client_backpressure_closed", {
        clientId: client.clientId || null,
        connectionId: client.id,
      });
      return false;
    }
    return true;
  } catch (error) {
    client.closed = true;
    if (client.expiryTimer) clearTimeout(client.expiryTimer);
    clients.delete(client.id);
    stopHeartbeatIfIdle();
    logger.warn("sqlite_realtime_client_write_failed", {
      clientId: client.clientId || null,
      connectionId: client.id,
      error,
    });
    return false;
  }
};

const getRealtimeRevisionForRole = (role = "") => (
  role === "user" ? roleRevisions.user : revision
);

const getRealtimeRuntimeStatus = ({ role = "" } = {}) => ({
  contractVersion: REALTIME_CONTRACT_VERSION,
  enabled: true,
  transport: "server_sent_events",
  connectedClients: clients.size,
  revision: getRealtimeRevisionForRole(role),
  heartbeatIntervalMs: REALTIME_HEARTBEAT_INTERVAL_MS,
  mutationDebounceMs: REALTIME_MUTATION_DEBOUNCE_MS,
  lastEvent,
});

const broadcastRealtimeEvent = ({
  eventName = "data_changed",
  tables = [],
  scopes = [],
  originClientId = "",
  metadata = null,
} = {}) => {
  revision += 1;
  const normalizedTables = normalizeTables(tables);
  const normalizedScopes = [...new Set([
    ...buildScopesForTables(normalizedTables),
    ...(Array.isArray(scopes) ? scopes : [scopes]).filter(Boolean),
  ])].sort();
  const payload = {
    contractVersion: REALTIME_CONTRACT_VERSION,
    type: eventName,
    revision,
    tables: normalizedTables,
    scopes: normalizedScopes,
    originClientId: originClientId || null,
    occurredAt: new Date().toISOString(),
    metadata: metadata || null,
  };

  lastEvent = {
    type: payload.type,
    revision: payload.revision,
    tables: payload.tables,
    scopes: payload.scopes,
    occurredAt: payload.occurredAt,
  };

  if (buildClientEventPayload({ role: "user" }, eventName, payload)) {
    roleRevisions.user = revision;
  }

  for (const client of clients.values()) {
    if (
      eventName === "data_changed"
      && originClientId
      && client.clientId
      && client.clientId === originClientId
    ) {
      continue;
    }
    const clientPayload = buildClientEventPayload(client, eventName, payload);
    if (clientPayload) writeSseEvent(client, eventName, clientPayload);
  }

  return payload;
};

const flushQueuedDatabaseMutations = () => {
  mutationFlushTimer = null;
  if (!pendingMutationTables.size) return null;

  const tables = [...pendingMutationTables];
  const originClientId = !pendingMutationHasMissingOrigin && pendingOriginClientIds.size === 1
    ? [...pendingOriginClientIds][0]
    : "";
  pendingMutationTables = new Set();
  pendingOriginClientIds = new Set();
  pendingMutationHasMissingOrigin = false;

  return broadcastRealtimeEvent({
    eventName: "data_changed",
    tables,
    originClientId,
  });
};

const queueDatabaseMutation = ({ tables = [], originClientId = "" } = {}) => {
  for (const tableName of normalizeTables(tables)) pendingMutationTables.add(tableName);
  if (originClientId) pendingOriginClientIds.add(String(originClientId));
  else pendingMutationHasMissingOrigin = true;
  if (!pendingMutationTables.size || mutationFlushTimer) return;

  mutationFlushTimer = setTimeout(flushQueuedDatabaseMutations, REALTIME_MUTATION_DEBOUNCE_MS);
  mutationFlushTimer.unref?.();
};

const broadcastDatabaseReplacement = ({ originClientId = "", reason = "restore" } = {}) => {
  if (mutationFlushTimer) {
    clearTimeout(mutationFlushTimer);
    mutationFlushTimer = null;
  }
  pendingMutationTables = new Set();
  pendingOriginClientIds = new Set();
  pendingMutationHasMissingOrigin = false;
  return broadcastRealtimeEvent({
    eventName: "database_replaced",
    tables: [],
    scopes: ["database", "auth", "maintenance", "dashboard", "reports"],
    originClientId: "",
    metadata: { reason, requestedByClientId: originClientId || null },
  });
};

const ensureHeartbeatTimer = () => {
  if (heartbeatTimer || clients.size === 0) return;
  heartbeatTimer = setInterval(() => {
    const payload = {
      contractVersion: REALTIME_CONTRACT_VERSION,
      serverTime: new Date().toISOString(),
    };
    for (const client of clients.values()) {
      writeSseEvent(client, "heartbeat", {
        ...payload,
        revision: getRealtimeRevisionForRole(client.role),
      });
    }
  }, REALTIME_HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref?.();
};

const stopHeartbeatIfIdle = () => {
  if (clients.size > 0 || !heartbeatTimer) return;
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
};

const registerRealtimeClient = (req, res) => {
  const connectionId = crypto.randomUUID();
  const clientId = String(req.query?.clientId || req.get("x-ims-client-id") || "").trim().slice(0, 128);
  const userId = req.localAuth?.user?.id || null;
  const ipAddress = String(req.ip || req.socket?.remoteAddress || "unknown").trim().slice(0, 128);
  const userConnectionCount = [...clients.values()].filter((client) => (
    userId && Number(client.userId) === Number(userId)
  )).length;
  const ipConnectionCount = [...clients.values()].filter((client) => (
    client.ipAddress === ipAddress
  )).length;

  if (
    clients.size >= REALTIME_MAX_CLIENTS_TOTAL
    || userConnectionCount >= REALTIME_MAX_CLIENTS_PER_USER
    || ipConnectionCount >= REALTIME_MAX_CLIENTS_PER_IP
  ) {
    res.setHeader("Retry-After", "15");
    return res.status(429).json({
      ok: false,
      code: "REALTIME_CONNECTION_LIMITED",
      message: "Terlalu banyak koneksi realtime aktif. Tutup tab IMS yang tidak digunakan lalu coba lagi.",
    });
  }

  const client = {
    id: connectionId,
    clientId,
    userId,
    username: req.localAuth?.user?.username || null,
    role: req.localAuth?.user?.role || null,
    ipAddress,
    expiresAt: req.localAuth?.expiresAt || null,
    expiryTimer: null,
    connectedAt: new Date().toISOString(),
    closed: false,
    res,
  };

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  req.socket.setKeepAlive?.(true);
  req.socket.setTimeout?.(0);

  clients.set(connectionId, client);
  ensureHeartbeatTimer();

  res.write("retry: 5000\n");
  writeSseEvent(client, "connected", {
    contractVersion: REALTIME_CONTRACT_VERSION,
    revision: getRealtimeRevisionForRole(client.role),
    connectionId,
    clientId: clientId || null,
    connectedAt: client.connectedAt,
    transport: "server_sent_events",
  });

  const sessionExpiresAt = Date.parse(client.expiresAt || "");
  if (Number.isFinite(sessionExpiresAt)) {
    const expiresInMs = Math.max(0, sessionExpiresAt - Date.now());
    client.expiryTimer = setTimeout(() => {
      if (client.closed) return;
      writeSseEvent(client, "session_expired", {
        contractVersion: REALTIME_CONTRACT_VERSION,
        revision: getRealtimeRevisionForRole(client.role),
        occurredAt: new Date().toISOString(),
      });
      if (!client.closed) {
        client.closed = true;
        clients.delete(connectionId);
        stopHeartbeatIfIdle();
        client.res.end();
      }
    }, expiresInMs);
    client.expiryTimer.unref?.();
  }

  const close = () => {
    if (client.closed) return;
    client.closed = true;
    if (client.expiryTimer) clearTimeout(client.expiryTimer);
    clients.delete(connectionId);
    stopHeartbeatIfIdle();
  };

  req.on("close", close);
  req.on("aborted", close);
  res.on("close", close);
};

const stopRealtimeService = () => {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
  if (mutationFlushTimer) clearTimeout(mutationFlushTimer);
  mutationFlushTimer = null;
  pendingMutationTables = new Set();
  pendingOriginClientIds = new Set();
  pendingMutationHasMissingOrigin = false;

  for (const client of clients.values()) {
    try {
      writeSseEvent(client, "server_shutdown", {
        contractVersion: REALTIME_CONTRACT_VERSION,
        revision,
        occurredAt: new Date().toISOString(),
      });
      client.res.end();
    } catch (_error) {
      // Best effort saat shutdown.
    }
    if (client.expiryTimer) clearTimeout(client.expiryTimer);
    client.closed = true;
  }
  clients.clear();
};

module.exports = {
  REALTIME_CONTRACT_VERSION,
  REALTIME_MAX_CLIENTS_PER_IP,
  REALTIME_MAX_CLIENTS_PER_USER,
  REALTIME_MAX_CLIENTS_TOTAL,
  OPERATIONAL_USER_REALTIME_SCOPES,
  TABLE_SCOPE_MAP,
  broadcastDatabaseReplacement,
  broadcastRealtimeEvent,
  buildClientEventPayload,
  buildScopesForTables,
  flushQueuedDatabaseMutations,
  getRealtimeRevisionForRole,
  getRealtimeRuntimeStatus,
  normalizeTables,
  queueDatabaseMutation,
  registerRealtimeClient,
  stopRealtimeService,
};
