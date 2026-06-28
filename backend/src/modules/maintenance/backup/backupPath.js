const { createHttpError } = require("../../../utils/httpError");
const fs = require("fs");
const path = require("path");
const env = require("../../../config/env");
const {
  BACKUP_DISK_RESERVE_BYTES,
  BACKUP_TYPES,
  SUPPORTED_BACKUP_FILE_SUFFIXES,
} = require("./backupConstants");

const ensureDir = (dirPath) => fs.mkdirSync(dirPath, { recursive: true });

const MANAGED_BACKUP_STORAGE_CLASSES = new Set(["daily", "monthly", "manual"]);
const INTERNAL_BACKUP_STORAGE_CLASSES = new Set([...MANAGED_BACKUP_STORAGE_CLASSES, ".tmp"]);
const SQLITE_FILE_HEADER = Buffer.from("SQLite format 3\0", "utf8");

const isPathAtOrInside = (candidatePath, parentPath) => {
  const candidate = path.resolve(candidatePath);
  const parent = path.resolve(parentPath);
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`)
    && relative !== ".."
    && !path.isAbsolute(relative));
};

const resolveThroughExistingAncestor = (candidatePath) => {
  const resolvedCandidate = path.resolve(candidatePath);
  let existingAncestor = resolvedCandidate;
  while (!fs.existsSync(existingAncestor)) {
    const parent = path.dirname(existingAncestor);
    if (parent === existingAncestor) break;
    existingAncestor = parent;
  }

  const realAncestor = fs.realpathSync(existingAncestor);
  return path.resolve(realAncestor, path.relative(existingAncestor, resolvedCandidate));
};

const createBackupPathError = (code, message, details = {}) => {
  const error = createHttpError(message, code, 400, { details, exposeDetails: false });
  Object.assign(error, details);
  return error;
};

const isSqliteDatabaseFile = (filePath) => {
  const fd = fs.openSync(filePath, "r");
  const header = Buffer.alloc(SQLITE_FILE_HEADER.length);
  try {
    const bytesRead = fs.readSync(fd, header, 0, header.length, 0);
    return bytesRead === SQLITE_FILE_HEADER.length && header.equals(SQLITE_FILE_HEADER);
  } finally {
    fs.closeSync(fd);
  }
};

const assertSafeBackupRuntimeRoot = () => {
  if (env.isTestRuntime) env.assertSafeTestRuntimePath(env.backupDir, "folder backup");
  return resolveThroughExistingAncestor(env.backupDir);
};

const inspectManagedBackupPath = (
  candidatePath,
  {
    allowDirectory = false,
    allowInternalTmp = false,
    mustExist = false,
    requireBackupArtifact = false,
    requireSupportedPackage = false,
  } = {},
) => {
  const backupRoot = assertSafeBackupRuntimeRoot();
  const rawPath = String(candidatePath || "").trim();
  if (!rawPath) {
    throw createBackupPathError(
      "BACKUP_PATH_REQUIRED",
      "Path backup wajib tersedia.",
      { backupRoot },
    );
  }

  const resolvedPath = resolveThroughExistingAncestor(rawPath);
  if (!isPathAtOrInside(resolvedPath, backupRoot) || resolvedPath === backupRoot) {
    throw createBackupPathError(
      "BACKUP_PATH_OUTSIDE_MANAGED_ROOT",
      "File backup berada di luar folder backup resmi. Import file tersebut melalui Maintenance Center sebelum digunakan.",
      { backupRoot, candidatePath: resolvedPath },
    );
  }

  const relativePath = path.relative(backupRoot, resolvedPath);
  const storageClass = relativePath.split(path.sep)[0];
  const allowedStorageClasses = allowInternalTmp
    ? INTERNAL_BACKUP_STORAGE_CLASSES
    : MANAGED_BACKUP_STORAGE_CLASSES;
  if (!allowedStorageClasses.has(storageClass)) {
    throw createBackupPathError(
      "BACKUP_PATH_STORAGE_CLASS_UNSAFE",
      "Path backup tidak berada pada storage class resmi daily, monthly, atau manual.",
      { backupRoot, candidatePath: resolvedPath, storageClass },
    );
  }

  const exists = fs.existsSync(rawPath);
  if (mustExist && !exists) {
    throw createBackupPathError(
      "BACKUP_FILE_NOT_FOUND",
      "File backup tidak ditemukan pada folder backup resmi.",
      { candidatePath: resolvedPath },
    );
  }

  if (exists) {
    const lstat = fs.lstatSync(rawPath);
    if (lstat.isSymbolicLink()) {
      throw createBackupPathError(
        "BACKUP_PATH_SYMLINK_UNSAFE",
        "Symlink file backup tidak diizinkan. Import file fisik ke folder backup resmi.",
        { candidatePath: resolvedPath },
      );
    }
    if (allowDirectory ? !lstat.isDirectory() : !lstat.isFile()) {
      throw createBackupPathError(
        "BACKUP_PATH_TYPE_INVALID",
        allowDirectory ? "Path backup harus berupa folder." : "Path backup harus berupa file biasa.",
        { candidatePath: resolvedPath },
      );
    }
  }

  if (requireBackupArtifact && exists && !allowDirectory
    && !isSupportedBackupPackageName(resolvedPath)
    && !isSqliteDatabaseFile(rawPath)) {
    throw createBackupPathError(
      "BACKUP_PATH_FORMAT_UNSUPPORTED",
      "File pada registry bukan paket backup IMS atau database SQLite legacy yang valid.",
      { candidatePath: resolvedPath },
    );
  }

  if (requireSupportedPackage && !isSupportedBackupPackageName(resolvedPath)) {
    throw createBackupPathError(
      "BACKUP_PATH_FORMAT_UNSUPPORTED",
      "Format file backup tidak didukung.",
      { candidatePath: resolvedPath },
    );
  }

  return {
    backupRoot,
    exists,
    path: resolvedPath,
    relativePath,
    storageClass,
  };
};

const assertManagedBackupFile = (candidatePath, options = {}) => inspectManagedBackupPath(
  candidatePath,
  {
    ...options,
    allowDirectory: false,
  },
).path;

const getManagedBackupPathStatus = (candidatePath, options = {}) => {
  try {
    return {
      managed: true,
      errorCode: null,
      ...inspectManagedBackupPath(candidatePath, options),
    };
  } catch (error) {
    return {
      managed: false,
      exists: false,
      errorCode: error?.code || "BACKUP_PATH_UNSAFE",
      errorMessage: error?.message || "Path backup tidak aman.",
      path: candidatePath ? path.resolve(String(candidatePath)) : "",
      storageClass: null,
    };
  }
};

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
  assertSafeBackupRuntimeRoot();
  ensureDir(targetDir);
  inspectManagedBackupPath(targetDir, { allowDirectory: true, allowInternalTmp: true });
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

const assertManagedBackupRecord = (backup, options = {}) => {
  const expectedFilename = normalizeBackupFilename(backup?.filename);
  if (!expectedFilename) {
    throw createBackupPathError(
      "BACKUP_REGISTRY_FILENAME_REQUIRED",
      "Nama file pada registry backup tidak tersedia.",
    );
  }

  const inspection = inspectManagedBackupPath(backup?.path, {
    ...options,
    requireBackupArtifact: options.requireBackupArtifact !== false,
  });
  const actualFilename = path.basename(inspection.path);
  if (actualFilename.toLowerCase() !== expectedFilename.toLowerCase()) {
    throw createBackupPathError(
      "BACKUP_REGISTRY_FILENAME_MISMATCH",
      "Nama file pada registry tidak sesuai dengan file backup di storage resmi.",
      {
        actualFilename,
        candidatePath: inspection.path,
        expectedFilename,
      },
    );
  }

  return inspection.path;
};

const getManagedBackupRecordStatus = (backup, options = {}) => {
  try {
    const managedPath = assertManagedBackupRecord(backup, options);
    const inspection = inspectManagedBackupPath(managedPath, options);
    return {
      managed: true,
      errorCode: null,
      ...inspection,
    };
  } catch (error) {
    return {
      managed: false,
      exists: false,
      errorCode: error?.code || "BACKUP_PATH_UNSAFE",
      errorMessage: error?.message || "Path backup tidak aman.",
      path: backup?.path ? path.resolve(String(backup.path)) : "",
      storageClass: null,
    };
  }
};

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
  assertSafeBackupRuntimeRoot();
  ensureDir(targetDir);
  inspectManagedBackupPath(targetDir, { allowDirectory: true });
  return targetDir;
};

const getUniquePackagePath = (targetDir, filename) => {
  inspectManagedBackupPath(targetDir, { allowDirectory: true, allowInternalTmp: true, mustExist: true });
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
  assertManagedBackupFile,
  assertManagedBackupRecord,
  assertSafeBackupRuntimeRoot,
  assertSufficientDiskSpace,
  calculateRequiredDiskBytes,
  ensureDir,
  formatBytes,
  getAvailableDiskBytes,
  getBackupCreatedAt,
  getBackupStorageClass,
  getBackupTypeDir,
  getManagedBackupPathStatus,
  getManagedBackupRecordStatus,
  getMonthKey,
  getUniquePackagePath,
  inspectManagedBackupPath,
  isSqliteDatabaseFile,
  isSupportedBackupPackageName,
  isVerifiedBackup,
  normalizeBackupFilename,
  normalizeBackupType,
  parseBackupDate,
  safeCompactTimestamp,
  sanitizeImportedBackupFilename,
  sqliteStringLiteral,
};
