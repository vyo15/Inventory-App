const crypto = require("crypto");
const env = require("../../config/env");

const BOOTSTRAP_CODE_MIN_LENGTH = 8;
const BOOTSTRAP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const generateBootstrapCode = (length = 12) => Array.from(
  crypto.randomBytes(length),
  (value) => BOOTSTRAP_CODE_ALPHABET[value % BOOTSTRAP_CODE_ALPHABET.length]
).join("");

const configuredCode = String(env.authBootstrapCode || "").trim();
if (configuredCode && configuredCode.length < BOOTSTRAP_CODE_MIN_LENGTH) {
  throw new Error(
    `IMS_AUTH_BOOTSTRAP_CODE minimal ${BOOTSTRAP_CODE_MIN_LENGTH} karakter agar aman.`
  );
}

const bootstrapCode = configuredCode || generateBootstrapCode();

const getBootstrapCodeForConsole = () => bootstrapCode;

const isBootstrapCodeValid = (value = "") => {
  const candidate = Buffer.from(String(value || "").trim());
  const expected = Buffer.from(bootstrapCode);
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
};

module.exports = {
  BOOTSTRAP_CODE_MIN_LENGTH,
  getBootstrapCodeForConsole,
  isBootstrapCodeValid,
};
