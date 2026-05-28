import { LOCAL_DB_TABLES } from "../../local/localDbSchema";
import {
  buildCustomerCode,
  isValidCustomerCodeFormat,
  normalizeCustomerCode,
} from "../../../utils/references/customerCodeReference";
import { createDexieMasterDataAdapter } from "./dexieMasterDataAdapterFactory";

const adapter = createDexieMasterDataAdapter({
  tableName: LOCAL_DB_TABLES.CUSTOMERS,
  idFields: ["id", "code", "customerCode"],
});

const normalizeCustomerPayload = (values = {}) => {
  const normalizedCode = normalizeCustomerCode(values.code || values.customerCode);

  return {
    ...values,
    id: normalizedCode || values.id,
    code: normalizedCode,
    customerCode: normalizedCode,
    name: String(values.name || "").trim(),
    contact: String(values.contact || "").trim(),
    address: String(values.address || "").trim(),
    note: String(values.note || "").trim(),
  };
};

const throwValidationError = (fieldName, message) => {
  throw { type: "validation", errors: { [fieldName]: message } };
};

const listAllCustomers = () => adapter.list({ includeDeleted: true });

const assertCustomerCodeAvailable = async (code = "", editingId = null) => {
  const normalizedCode = normalizeCustomerCode(code);
  if (!normalizedCode) return;

  const rows = await listAllCustomers();
  const duplicate = rows.find((customer) => {
    const candidateCodes = [customer.id, customer.code, customer.customerCode]
      .map((value) => normalizeCustomerCode(value))
      .filter(Boolean);

    return candidateCodes.includes(normalizedCode) && customer.id !== editingId;
  });

  if (duplicate) {
    throwValidationError("code", "Kode customer sudah digunakan di offline DB.");
  }
};

export const generateCustomerCode = async (_values = {}, excludeId = null) => {
  void _values;
  const todayPrefix = buildCustomerCode({ date: new Date(), sequence: 1 }).slice(0, -3);
  const rows = await listAllCustomers();
  const usedSequences = rows
    .filter((customer) => customer.id !== excludeId)
    .flatMap((customer) => [customer.id, customer.code, customer.customerCode])
    .map((value) => normalizeCustomerCode(value))
    .filter((code) => code.startsWith(todayPrefix))
    .map((code) => Number(code.split("-").at(-1)))
    .filter((sequence) => Number.isFinite(sequence) && sequence > 0);

  const nextSequence = usedSequences.length ? Math.max(...usedSequences) + 1 : 1;
  return buildCustomerCode({ date: new Date(), sequence: nextSequence });
};

export const listCustomers = adapter.list;
export const getCustomerById = adapter.getById;

export const createCustomer = async (values = {}, options = {}) => {
  const code = normalizeCustomerCode(values.code || values.customerCode) ||
    await generateCustomerCode(values);

  if (!isValidCustomerCodeFormat(code)) {
    throwValidationError("code", "Kode customer offline wajib berformat CUS-DDMMYYYY-001.");
  }

  await assertCustomerCodeAvailable(code, null);

  const payload = normalizeCustomerPayload({ ...values, code, customerCode: code });

  if (!payload.name) {
    throwValidationError("name", "Nama wajib diisi.");
  }

  if (!payload.contact) {
    throwValidationError("contact", "Kontak wajib diisi.");
  }

  return adapter.create(payload, options);
};

export const updateCustomer = async (customerId, values = {}, options = {}) => {
  const existing = await adapter.getById(customerId);

  if (!existing) {
    throw new Error("Customer offline tidak ditemukan.");
  }

  const immutableCode = normalizeCustomerCode(
    existing.code || existing.customerCode || existing.id
  );
  const requestedCode = normalizeCustomerCode(values.code || values.customerCode || immutableCode);

  if (requestedCode && requestedCode !== immutableCode) {
    throwValidationError("code", "Kode customer tidak boleh diubah setelah dibuat.");
  }

  if (!isValidCustomerCodeFormat(immutableCode)) {
    throwValidationError("code", "Kode customer offline existing belum valid.");
  }

  await assertCustomerCodeAvailable(immutableCode, customerId);

  const payload = normalizeCustomerPayload({
    ...values,
    code: immutableCode,
    customerCode: immutableCode,
  });

  if (!payload.name) {
    throwValidationError("name", "Nama wajib diisi.");
  }

  if (!payload.contact) {
    throwValidationError("contact", "Kontak wajib diisi.");
  }

  return adapter.update(customerId, payload, options);
};

export const deleteCustomer = adapter.remove;
