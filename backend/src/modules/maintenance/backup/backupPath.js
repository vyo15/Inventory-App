const fs = require("fs");
const path = require("path");
const env = require("../../../config/env");
const {
  BACKUP_DISK_RESERVE_BYTES,
  BACKUP_TYPES,
  SUPPORTED_BACKUP_FILE_SUFFIXES,
} = require("./backupConstants");

const ensureDir = (dirPath) => fs.mkdirSync(dirPath, { recursive: true });

const toNonNegativeBigInt = (value, fallback = 0n) => {
  try {
    const normalized = typeof value === "bigint" ? value : BigInt(Math.ceil(Number(value)));
    return normalized >= 0n ? normalized : fallback;
  } catch {
    return fallback;
  }
};

const formatBytes = (value) => {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const amount = bytes / (1024 ** unitIndex);
  return `${amount.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const calculateRequiredDiskBytes = ({
  expectedWriteBytes = 0,
  copyCount = 1,
  reserveBytes = BACKUP_DISK_RESERVE_BYTES,
} = {}) => {
  const expected = toNonNegativeBigInt(expectedWriteBytes);
  const copies = toNonNegativeBigInt(copyCount, 1n) || 1n;
  const reserve = toNonNegativeBigInt(reserveBytes, BigInt(BACKUP_DISK_RESERVE_BYTES));
  return expected * copies + reserve;
};

const getAvailableDiskBytes = (targetDir) => {
  ensureDir(targetDir);
  try {
    const stats = fs.statfsSync(targetDir, { bigint: true });
    const blockSize = stats.bsize || stats.frsize;
    const availableBlocks = stats.bavail ?? stats.bfree;
    if (!blockSize || availableBlocks === undefined) {
      throw new Error("Statistik filesystem tidak menyediakan kapasitas kosong.");
    }
    return availableBlocks * blockSize;
  } catch (cause) {
    const error = new Error("Ruang kosong penyimpanan backup tidak dapat diperiksa. Backup dibatalkan agar tidak gagal di tengah proses.");
    error.code = "BACKUP_DISK_SPACE_CHECK_FAILED";
    error.cause = cause;
    throw error;
  }
};

const assertSufficientDiskSpace = ({
  targetDir,
  expectedWriteBytes,
  copyCount = 1,
  reserveBytes = BACKUP_DISK_RESERVE_BYTES,
  operation = "Operasi backup",
} = {}) => {
  const availableBytes = getAvailableDiskBytes(targetDir);
  const requiredBytes = calculateRequiredDiskBytes({ expectedWriteBytes, copyCount, reserveBytes });
  if (availableBytes < requiredBytes) {
    const error = new Error(
      `${operation} dibatalkan karena ruang penyimpanan tidak cukup. `
      + `Tersedia ${formatBytes(availableBytes)}, minimal ${formatBytes(requiredBytes)} diperlukan.`,
    );
    error.code = "BACKUP_DISK_SPACE_INSUFFICIENT";
    error.availableBytes = Number(availableBytes);
    error.requiredBytes = Number(requiredBytes);
    throw error;
  }
  return {
    availableBytes: Number(availableBytes),
    requiredBytes: Number(requiredBytes),
    reserveBytes: Number(toNonNegativeBigInt(reserveBytes)),
  };
};

const safeCompactTimestamp = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

const sqliteStringLiteral = (value) => `'${String(value).replace(/'/g, "''")}'`;

const normalizeBackupType = (value) => {
  const type = String(value || "manual").trim().toLowerCase();
  return BACKUP_TYPES.has(type) ? type : "manual";
};

const normalizeBackupFilename = (filename) => path.basename(String(filename || "").trim());

const sanitizeImportedBackupFilename = (filename) => {
  const baseName = normalizeBackupFilename(filename).replace(/[^A-Za-z0-9._() -]/g, "-");
  return baseName.replace(/\s+/g, " ").trim();
};

const isSupportedBackupPackageName = (filename = "") => {
  const normalized = String(filename || "").toLowerCase();
  return SUPPORTED_BACKUP_FILE_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
};

const getBackupStorageClass = (type) => {
  const backupType = normalizeBackupType(type);
  if (backupType === "daily") return "daily";
  if (backupType === "monthly") return "monthly";
  return "manual";
};

const getBackupTypeDir = (type) => {
  const storageClass = getBackupStorageClass(type);
  const targetDir = path.join(env.backupDir, storageClass);
  ensureDir(targetDir);
  return targetDir;
};

const getUniquePackagePath = (targetDir, filename) => {
  let candidateFilename = filename;
  let candidatePath = path.join(targetDir, candidateFilename);
  const suffix = SUPPORTED_BACKUP_FILE_SUFFIXES.find((item) => candidateFilename.toLowerCase().endsWith(item)) || path.extname(candidateFilename);
  const basename = suffix ? candidateFilename.slice(0, -suffix.length) : candidateFilename;
  let index = 1;

  while (fs.existsSync(candidatePath)) {
    candidateFilename = `${basename}-${index}${suffix}`;
    candidatePath = path.join(targetDir, candidateFilename);
    index += 1;
  }

  return { filename: candidateFilename, path: candidatePath };
};

const parseBackupDate = (value) => {
  if (!value) return null;
  const raw = String(value);
  const normalized = raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getBackupCreatedAt = (backup) => parseBackupDate(backup?.manifest?.createdAt || backup?.created_at);

const getMonthKey = (value) => {
  const date = value instanceof Date ? value : parseBackupDate(value);
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const isVerifiedBackup = (backup) => ["verified", "success"].includes(String(backup?.status || "").toLowerCase());

module.exports = {
  assertSufficientDiskSpace,
  calculateRequiredDiskBytes,
  ensureDir,
  formatBytes,
  getAvailableDiskBytes,
  getBackupCreatedAt,
  getBackupStorageClass,
  getBackupTypeDir,
  getMonthKey,
  getUniquePackagePath,
  isSupportedBackupPackageName,
  isVerifiedBackup,
  normalizeBackupFilename,
  normalizeBackupType,
  parseBackupDate,
  safeCompactTimestamp,
  sanitizeImportedBackupFilename,
  sqliteStringLiteral,
};
