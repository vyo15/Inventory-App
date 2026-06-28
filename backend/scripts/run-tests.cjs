#!/usr/bin/env node
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const BACKEND_ROOT = path.resolve(__dirname, "..");
const TEST_ROOT = path.resolve(BACKEND_ROOT, "test");
const REPOSITORY_ROOT = path.resolve(BACKEND_ROOT, "..");

const isPathAtOrInside = (candidatePath, parentPath) => {
  const candidate = path.resolve(candidatePath);
  const parent = path.resolve(parentPath);
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`)
    && relative !== ".."
    && !path.isAbsolute(relative));
};

const resolveFromBackend = (value, fallback) => {
  const rawValue = value || fallback;
  return path.isAbsolute(rawValue) ? rawValue : path.resolve(BACKEND_ROOT, rawValue);
};

const assertSafeSuiteRoot = (suiteRoot) => {
  const suiteStat = fs.lstatSync(suiteRoot);
  if (!suiteStat.isDirectory() || suiteStat.isSymbolicLink()) {
    throw new Error("Folder suite test harus berupa directory fisik, bukan symlink/junction.");
  }

  const realSuiteRoot = fs.realpathSync(suiteRoot);
  const realTempRoot = fs.realpathSync(os.tmpdir());
  const realRepositoryRoot = fs.realpathSync(REPOSITORY_ROOT);
  if (!isPathAtOrInside(realSuiteRoot, realTempRoot)
    || isPathAtOrInside(realSuiteRoot, realRepositoryRoot)) {
    throw new Error(
      `Folder suite test tidak aman: ${realSuiteRoot}. Test dibatalkan sebelum database dibuka.`,
    );
  }
  return realSuiteRoot;
};

const collectTestFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectTestFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".test.js") ? [fullPath] : [];
  });

const hashFileSync = (filePath) => {
  const hash = crypto.createHash("sha256");
  const fd = fs.openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest("hex");
};

const snapshotDirectory = (rootPath) => {
  if (!fs.existsSync(rootPath)) return { exists: false, entries: [] };
  const rootStat = fs.lstatSync(rootPath);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    return {
      exists: true,
      entries: [{ path: ".", type: rootStat.isSymbolicLink() ? "symlink" : "other" }],
    };
  }

  const entries = [];
  const visit = (currentPath, relativeBase = "") => {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.join(relativeBase, entry.name).replaceAll(path.sep, "/");
      const stat = fs.lstatSync(fullPath);
      const type = entry.isSymbolicLink()
        ? "symlink"
        : entry.isDirectory()
          ? "directory"
          : entry.isFile()
            ? "file"
            : "other";
      entries.push({
        path: relativePath,
        type,
        size: stat.size,
        mtimeMs: Math.trunc(stat.mtimeMs),
      });
      if (entry.isDirectory() && !entry.isSymbolicLink()) visit(fullPath, relativePath);
    }
  };
  visit(rootPath);
  return { exists: true, entries };
};

const snapshotDatabase = (dbPath) => [dbPath, `${dbPath}-wal`, `${dbPath}-shm`].map((filePath) => {
  if (!fs.existsSync(filePath)) return { path: filePath, exists: false };
  const stat = fs.lstatSync(filePath);
  return {
    path: filePath,
    exists: true,
    type: stat.isSymbolicLink() ? "symlink" : stat.isFile() ? "file" : "other",
    size: stat.size,
    mtimeMs: Math.trunc(stat.mtimeMs),
    sha256: stat.isFile() && !stat.isSymbolicLink() ? hashFileSync(filePath) : null,
  };
});

const captureRuntimeFingerprint = () => {
  const dbPath = resolveFromBackend(process.env.IMS_SQLITE_DB_PATH, "../data/ims-sqlite-sidecar.sqlite");
  const backupDir = resolveFromBackend(process.env.IMS_SQLITE_BACKUP_DIR, "../backups/sqlite");
  const logDir = resolveFromBackend(process.env.IMS_LOG_DIR, "../logs");
  return {
    dbPath,
    backupDir,
    logDir,
    database: snapshotDatabase(dbPath),
    backups: snapshotDirectory(backupDir),
    logs: snapshotDirectory(logDir),
  };
};

const testFiles = collectTestFiles(TEST_ROOT).sort((left, right) => left.localeCompare(right));
if (testFiles.length === 0) {
  console.error("[test] Tidak ada file *.test.js yang ditemukan.");
  process.exit(1);
}

const runtimeFingerprintBefore = captureRuntimeFingerprint();
const createdSuiteRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ims-backend-test-suite-"));
let suiteRoot;
try {
  suiteRoot = assertSafeSuiteRoot(createdSuiteRoot);
} catch (error) {
  const createdStat = fs.lstatSync(createdSuiteRoot);
  if (createdStat.isDirectory() && !createdStat.isSymbolicLink()) {
    fs.rmSync(createdSuiteRoot, { recursive: true, force: true });
  }
  console.error("[test] Folder temporary test tidak aman.");
  console.error(error.message);
  process.exit(1);
}

const suiteMarker = path.join(suiteRoot, ".ims-test-suite");
const markerValue = JSON.stringify({ suiteRoot, pid: process.pid });
const runnerDbPath = path.join(suiteRoot, "runner-safety.sqlite");
const runnerBackupDir = path.join(suiteRoot, "backups");
const runnerLogDir = path.join(suiteRoot, "logs");
fs.writeFileSync(suiteMarker, markerValue, { encoding: "utf8", flag: "wx" });

const childEnv = {
  ...process.env,
  NODE_ENV: "test",
  IMS_LOG_TO_FILE: "false",
  IMS_LOG_DIR: runnerLogDir,
  IMS_SQLITE_BACKUP_DIR: runnerBackupDir,
  IMS_SQLITE_DB_PATH: runnerDbPath,
  IMS_TEST_SUITE_MARKER: suiteMarker,
  IMS_TEST_SUITE_ROOT: suiteRoot,
};

console.log(`[test] Menjalankan ${testFiles.length} file automated test backend...`);
console.log(`[test] Runtime test diisolasi di folder temporary: ${suiteRoot}`);

let result;
let cleanupFailed = false;
let fingerprintChanged = false;
try {
  result = spawnSync(
    process.execPath,
    ["--test", "--test-concurrency=1", ...testFiles],
    {
      stdio: "inherit",
      shell: false,
      env: childEnv,
    },
  );
} finally {
  const runtimeFingerprintAfter = captureRuntimeFingerprint();
  if (JSON.stringify(runtimeFingerprintAfter) !== JSON.stringify(runtimeFingerprintBefore)) {
    fingerprintChanged = true;
    console.error("[test] TEST_RUNTIME_FINGERPRINT_CHANGED: database, backup, atau log runtime berubah selama test.");
    console.error("[test] Hentikan penggunaan hasil test dan periksa runtime project sebelum melanjutkan.");
  }

  try {
    const currentSuiteRoot = assertSafeSuiteRoot(suiteRoot);
    if (currentSuiteRoot !== suiteRoot) {
      throw new Error("Realpath suite test berubah; cleanup otomatis dibatalkan.");
    }
    const markerStat = fs.lstatSync(suiteMarker);
    const markerValid = markerStat.isFile()
      && !markerStat.isSymbolicLink()
      && fs.readFileSync(suiteMarker, "utf8") === markerValue;
    if (!markerValid) {
      throw new Error("Marker suite test tidak valid; cleanup otomatis dibatalkan.");
    }
    fs.rmSync(suiteRoot, { recursive: true, force: true });
  } catch (error) {
    cleanupFailed = true;
    console.error("[test] Gagal membersihkan folder temporary test secara aman.");
    console.error(error.message);
  }
}

if (cleanupFailed || fingerprintChanged) process.exit(1);

if (result.error) {
  console.error("[test] Gagal menjalankan Node test runner.");
  console.error(result.error.message);
  process.exit(1);
}

if (result.signal || result.status === null) {
  console.error(`[test] Node test runner berhenti tidak normal${result.signal ? ` (${result.signal})` : ""}.`);
  process.exit(1);
}

process.exit(result.status);
