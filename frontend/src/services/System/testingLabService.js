import {
  fetchSqliteJson,
  getStoredSqliteAuthHeaders,
} from "./sqliteBackendStatusService";

const authHeaders = () => getStoredSqliteAuthHeaders();

export const getTestingLabRuntimeStatus = async () => {
  const response = await fetchSqliteJson("/api/testing-lab/runtime", {
    headers: authHeaders(),
  });
  return response?.data || null;
};

export const getTestingLabStatus = async () => {
  const response = await fetchSqliteJson("/api/testing-lab/status", {
    headers: authHeaders(),
  });
  return response?.data || null;
};


export const getTestingLabOperationalSourcePreview = async () => {
  const response = await fetchSqliteJson("/api/testing-lab/operational-source/preview", {
    headers: authHeaders(),
  });
  return response?.data || null;
};

export const cloneTestingLabOperationalSource = async (confirmKeyword) => {
  const response = await fetchSqliteJson("/api/testing-lab/operational-source/clone", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ confirmKeyword }),
  });
  return response?.data || null;
};

export const createTestingBaseline = async (confirmKeyword) => {
  const response = await fetchSqliteJson("/api/testing-lab/baseline", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ confirmKeyword }),
  });
  return response?.data || null;
};

export const selectTestingBaseline = async (filename) => {
  const response = await fetchSqliteJson("/api/testing-lab/baseline/select", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ filename }),
  });
  return response?.data || null;
};

export const resetTestingSandbox = async (confirmKeyword) => {
  const response = await fetchSqliteJson("/api/testing-lab/reset", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ confirmKeyword }),
  });
  return response?.data || null;
};

export const startTestingSession = async (scenarioKey) => {
  const response = await fetchSqliteJson("/api/testing-lab/sessions", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ scenarioKey }),
  });
  return response?.data || null;
};

export const completeTestingSession = async (notes = "") => {
  const response = await fetchSqliteJson("/api/testing-lab/sessions/complete", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ notes }),
  });
  return response?.data || null;
};

export const cancelTestingSession = async () => {
  const response = await fetchSqliteJson("/api/testing-lab/sessions/cancel", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  return response?.data || null;
};

export const runTestingLabValidation = async () => {
  const response = await fetchSqliteJson("/api/testing-lab/validate", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  return response?.data || null;
};

export const getTestingResultExport = async () => {
  const response = await fetchSqliteJson("/api/testing-lab/result-export", {
    headers: authHeaders(),
  });
  return response?.data || null;
};
