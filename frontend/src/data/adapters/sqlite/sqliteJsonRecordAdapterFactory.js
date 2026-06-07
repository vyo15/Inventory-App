import { requestSqliteApi } from "./sqliteApiClient";

const toArray = (result) => (Array.isArray(result?.data) ? result.data : []);

export const createSqliteJsonRecordAdapter = ({ endpoint, normalizeRecord = (record) => record } = {}) => {
  if (!endpoint) {
    throw new Error("Endpoint adapter database lokal wajib tersedia.");
  }

  const list = async (options = {}) => {
    const params = new URLSearchParams();
    if (options.limit) params.set("limit", String(options.limit));
    if (options.status) params.set("status", options.status);
    if (options.sourceType) params.set("sourceType", options.sourceType);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const result = await requestSqliteApi(`${endpoint}${suffix}`);
    return toArray(result).map(normalizeRecord);
  };

  const getById = async (id) => {
    if (!id) return null;
    const result = await requestSqliteApi(`${endpoint}/${encodeURIComponent(id)}`);
    return result?.data ? normalizeRecord(result.data) : null;
  };

  const generateCode = async () => {
    const result = await requestSqliteApi(`${endpoint}/generate-code`);
    return result?.data?.code || result?.data?.referenceNumber || "";
  };

  const create = async (values = {}) => {
    const result = await requestSqliteApi(endpoint, {
      method: "POST",
      body: JSON.stringify(values),
    });
    return result?.data ? normalizeRecord(result.data) : null;
  };

  const update = async (id, values = {}) => {
    if (!id) throw new Error("ID data database lokal yang akan diubah tidak valid.");
    const result = await requestSqliteApi(`${endpoint}/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(values),
    });
    return result?.data ? normalizeRecord(result.data) : null;
  };

  const remove = async (id) => {
    if (!id) throw new Error("ID data database lokal yang akan dihapus tidak valid.");
    const result = await requestSqliteApi(`${endpoint}/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return result?.data || { id, deleted: true };
  };

  const subscribe = (callback, onError, options = {}) => {
    let disposed = false;
    let timer = null;
    const intervalMs = Math.max(Number(options.intervalMs || 15000), 5000);

    const load = async () => {
      try {
        const rows = await list(options);
        if (!disposed) callback(rows);
      } catch (error) {
        if (!disposed && typeof onError === "function") onError(error);
      }
    };

    load();
    timer = window.setInterval(load, intervalMs);

    return () => {
      disposed = true;
      if (timer) window.clearInterval(timer);
    };
  };

  return { list, getById, generateCode, create, update, remove, subscribe };
};
