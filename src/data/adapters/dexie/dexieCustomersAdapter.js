import { getImsLocalDb } from "../../local/imsLocalDb";
import { LOCAL_DB_TABLES } from "../../local/localDbSchema";
import { createDexieMasterDataAdapter } from "./dexieMasterDataAdapterFactory";
import {
  buildCustomerCode,
  getCustomerCodeSequence,
  isValidCustomerCodeFormat,
  normalizeCustomerCode,
} from "../../../utils/references/customerCodeReference";

const adapter = createDexieMasterDataAdapter({
  tableName: LOCAL_DB_TABLES.CUSTOMERS,
  idFields: ["id", "code", "customerCode"],
});

const normalizeCustomerPayload = (values = {}) => {
  const normalizedCode = normalizeCustomerCode(values.code || values.customerCode);
  return {
    ...values,
    ...(normalizedCode
      ? {
          id: values.id || normalizedCode,
          code: normalizedCode,
          customerCode: normalizedCode,
        }
      : {}),
    name: String(values.name || "").trim(),
    contact: String(values.contact || "").trim(),
    address: String(values.address || "").trim(),
    note: String(values.note || "").trim(),
  };
};

const assertValidCustomerPayload = async (payload = {}, editingId = null) => {
  if (!payload.name) {
    throw { type: "validation", errors: { name: "Nama customer wajib diisi" } };
  }
  if (!payload.contact) {
    throw { type: "validation", errors: { contact: "Kontak wajib diisi" } };
  }
  if (!isValidCustomerCodeFormat(payload.code)) {
    throw { type: "validation", errors: { code: "Kode customer wajib format CUS-DDMMYYYY-001" } };
  }

  const db = getImsLocalDb();
  const rows = await db.table(LOCAL_DB_TABLES.CUSTOMERS).toArray();
  const duplicate = rows.find((row) => {
    if (row?._deleted) return false;
    if (editingId && String(row.id) === String(editingId)) return false;
    return [row.id, row.code, row.customerCode]
      .map(normalizeCustomerCode)
      .includes(payload.code);
  });

  if (duplicate) {
    throw { type: "validation", errors: { code: "Kode customer sudah digunakan di local DB" } };
  }
};

export const listCustomers = adapter.list;
export const getCustomerById = adapter.getById;

export const generateCustomerCode = async (_values = {}, excludeId = null) => {
  void _values;
  const db = getImsLocalDb();
  const rows = await db.table(LOCAL_DB_TABLES.CUSTOMERS).toArray();
  const maxSequence = rows.reduce((maxValue, row) => {
    if (excludeId && String(row.id) === String(excludeId)) return maxValue;
    const sequence = Math.max(
      getCustomerCodeSequence(row?.code),
      getCustomerCodeSequence(row?.customerCode),
      getCustomerCodeSequence(row?.id),
    );
    return Math.max(maxValue, sequence);
  }, 0);

  return buildCustomerCode({ sequence: maxSequence + 1 });
};

export const createCustomer = async (values = {}, options = {}) => {
  const generatedCode = values.code || values.customerCode || (await generateCustomerCode(values));
  const payload = normalizeCustomerPayload({ ...values, code: generatedCode, customerCode: generatedCode });
  await assertValidCustomerPayload(payload, null);
  return adapter.create(payload, options);
};

export const updateCustomer = async (customerId, values = {}, options = {}) => {
  const existing = await adapter.getById(customerId);
  const immutableCode = normalizeCustomerCode(
    existing?.code || existing?.customerCode || values.code || values.customerCode || customerId,
  );
  const payload = normalizeCustomerPayload({ ...values, code: immutableCode, customerCode: immutableCode });
  await assertValidCustomerPayload(payload, customerId);
  return adapter.update(customerId, payload, options);
};

export const deleteCustomer = adapter.remove;
