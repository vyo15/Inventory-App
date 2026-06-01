const crypto = require("crypto");

const PBKDF2_ITERATIONS = 210000;
const PBKDF2_KEY_LENGTH = 64;
const PBKDF2_DIGEST = "sha512";
const PASSWORD_HASH_PREFIX = "pbkdf2";

const createPasswordHash = (password = "") => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(String(password), salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, PBKDF2_DIGEST)
    .toString("hex");

  return `${PASSWORD_HASH_PREFIX}$${PBKDF2_ITERATIONS}$${salt}$${hash}`;
};

const verifyPasswordHash = (password = "", storedHash = "") => {
  const [prefix, iterationsRaw, salt, expectedHash] = String(storedHash || "").split("$");
  const iterations = Number(iterationsRaw);

  if (prefix !== PASSWORD_HASH_PREFIX || !Number.isFinite(iterations) || !salt || !expectedHash) {
    return false;
  }

  const actualHash = crypto
    .pbkdf2Sync(String(password), salt, iterations, PBKDF2_KEY_LENGTH, PBKDF2_DIGEST)
    .toString("hex");

  const actualBuffer = Buffer.from(actualHash, "hex");
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  if (actualBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
};

const validatePasswordStrength = (password = "") => {
  const value = String(password || "");
  if (value.length < 8) {
    return "Password minimal 8 karakter.";
  }
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return "Password wajib memakai huruf dan angka.";
  }
  return "";
};

module.exports = {
  createPasswordHash,
  verifyPasswordHash,
  validatePasswordStrength,
};
