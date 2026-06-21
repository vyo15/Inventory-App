const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  getBusinessCodePreview,
  reserveBusinessCode,
  resolveBusinessCode,
} = require("../src/utils/businessCodeCounter");

const createFakeDb = ({ maxSequence = 0, existingCodes = [] } = {}) => {
  const state = {
    counter: null,
    existingCodes: new Set(existingCodes.map((value) => String(value).toUpperCase())),
    maxScans: 0,
  };

  return {
    state,
    async get(sql, params = []) {
      const statement = String(sql);
      if (statement.includes("MAX(CAST(SUBSTR")) {
        state.maxScans += 1;
        return { max_sequence: maxSequence };
      }
      if (statement.includes("FROM business_code_counters")) {
        return state.counter ? { ...state.counter } : undefined;
      }
      if (statement.includes("SELECT 1 AS found")) {
        return state.existingCodes.has(String(params[0] || "").toUpperCase())
          ? { found: 1 }
          : undefined;
      }
      throw new Error(`Query get tidak dikenali: ${statement}`);
    },
    async run(sql, params = []) {
      const statement = String(sql);
      if (statement.includes("INSERT INTO business_code_counters")) {
        const [counterKey, prefix, baseline] = params;
        state.counter = {
          counter_key: counterKey,
          prefix,
          last_number: Math.max(Number(state.counter?.last_number || 0), Number(baseline || 0)),
        };
        return { changes: 1 };
      }
      if (statement.includes("last_number = last_number + 1")) {
        state.counter.last_number += 1;
        return { changes: 1 };
      }
      if (statement.includes("last_number = MAX(last_number")) {
        state.counter.last_number = Math.max(state.counter.last_number, Number(params[0] || 0));
        return { changes: 1 };
      }
      throw new Error(`Query run tidak dikenali: ${statement}`);
    },
  };
};

const options = (suffix) => ({
  counterKey: `customers:CUS-21062026:${suffix}`,
  prefix: `CUS-21062026-${suffix}`,
  tableName: "customers",
  columnName: "customer_code",
  minWidth: 3,
  notes: "unit test",
});

test("preview memverifikasi baseline historis sekali lalu memakai counter O(1)", async () => {
  const db = createFakeDb({ maxSequence: 7 });
  const config = options("BASELINE");

  assert.equal(await getBusinessCodePreview(db, config), "CUS-21062026-BASELINE-008");
  assert.equal(await getBusinessCodePreview(db, config), "CUS-21062026-BASELINE-008");
  assert.equal(db.state.maxScans, 1);
});

test("reserve menaikkan counter unik tanpa scan ulang tabel sumber", async () => {
  const db = createFakeDb({ maxSequence: 2 });
  const config = options("RESERVE");

  assert.equal(await reserveBusinessCode(db, config), "CUS-21062026-RESERVE-003");
  assert.equal(await reserveBusinessCode(db, config), "CUS-21062026-RESERVE-004");
  assert.equal(db.state.maxScans, 1);
});

test("managed code lama di bawah counter dialihkan ke sequence berikutnya", async () => {
  const db = createFakeDb({ maxSequence: 5 });
  const config = options("GAP");

  const resolved = await resolveBusinessCode(db, "CUS-21062026-GAP-003", config);
  assert.equal(resolved, "CUS-21062026-GAP-006");
});
