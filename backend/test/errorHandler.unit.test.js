const assert = require("node:assert/strict");
const { test } = require("node:test");
const { errorHandler } = require("../src/middlewares/errorHandler");
const logger = require("../src/utils/logger");
const { createHttpError } = require("../src/utils/httpError");

const createResponse = ({ headersSent = false } = {}) => ({
  headersSent,
  statusCode: null,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.payload = payload;
    return this;
  },
});

const createRequest = () => ({
  method: "POST",
  path: "/api/test",
  localAuth: { user: { username: "tester" } },
});

const withLoggerSpy = async (callback) => {
  const originalWarn = logger.warn;
  const originalError = logger.error;
  const calls = [];
  logger.warn = (message, metadata) => calls.push({ level: "warn", message, metadata });
  logger.error = (message, metadata) => calls.push({ level: "error", message, metadata });
  try {
    await callback(calls);
  } finally {
    logger.warn = originalWarn;
    logger.error = originalError;
  }
};

test("AppError 4xx mengirim pesan publik, kode, safe details, dan log warn", async () => {
  await withLoggerSpy((calls) => {
    const error = createHttpError("Input tidak valid.", "TEST_INVALID", 400, {
      details: { field: "name" },
      exposeDetails: true,
    });
    const res = createResponse();

    errorHandler(error, createRequest(), res, () => {});

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.payload, {
      ok: false,
      message: "Input tidak valid.",
      errorCode: "TEST_INVALID",
      details: { field: "name" },
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].level, "warn");
    assert.equal(calls[0].message, "http_request_rejected");
  });
});

test("legacy code dan statusCode tetap kompatibel tanpa menjadi INTERNAL_SERVER_ERROR", async () => {
  await withLoggerSpy(() => {
    const error = new Error("Referensi sudah dipakai.");
    error.code = "DUPLICATE_REFERENCE";
    error.statusCode = 409;
    const res = createResponse();

    errorHandler(error, createRequest(), res, () => {});

    assert.equal(res.statusCode, 409);
    assert.equal(res.payload.message, "Referensi sudah dipakai.");
    assert.equal(res.payload.errorCode, "DUPLICATE_REFERENCE");
  });
});

test("plain Error tetap disamarkan sebagai 500 dan dicatat sebagai error", async () => {
  await withLoggerSpy((calls) => {
    const res = createResponse();
    errorHandler(new Error("SQL dan path internal tidak boleh bocor"), createRequest(), res, () => {});

    assert.equal(res.statusCode, 500);
    assert.equal(res.payload.message, "Terjadi error pada server layanan database lokal");
    assert.equal(res.payload.errorCode, "INTERNAL_SERVER_ERROR");
    assert.equal("details" in res.payload, false);
    assert.equal(calls[0].level, "error");
    assert.equal(calls[0].message, "http_request_error");
  });
});

test("details tidak dikirim tanpa exposeDetails eksplisit", async () => {
  await withLoggerSpy(() => {
    const error = createHttpError("Operasi diblokir.", "BLOCKED", 409, {
      details: { internalPath: "C:/secret" },
    });
    const res = createResponse();

    errorHandler(error, createRequest(), res, () => {});

    assert.equal(res.statusCode, 409);
    assert.equal("details" in res.payload, false);
  });
});

test("headersSent meneruskan error ke middleware berikutnya", () => {
  const error = new Error("late error");
  const res = createResponse({ headersSent: true });
  let forwarded = null;

  errorHandler(error, createRequest(), res, (value) => {
    forwarded = value;
  });

  assert.equal(forwarded, error);
  assert.equal(res.payload, null);
});
