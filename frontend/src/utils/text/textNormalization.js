/**
 * Normalizes text while preserving valid falsy primitives such as 0 and false.
 */
export const normalizeText = (value) => String(value ?? "").trim();

/**
 * Preserves the historical form-field contract where falsy values are empty.
 */
export const normalizeTruthyText = (value) => (value ? String(value).trim() : "");
