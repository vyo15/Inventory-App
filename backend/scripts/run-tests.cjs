#!/usr/bin/env node
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const TEST_ROOT = path.resolve(__dirname, "../test");
const REPOSITORY_ROOT = path.resolve(__dirname, "../..");

const isPathAtOrInside = (candidatePath, parentPath) => {
  const candidate = path.resolve(candidatePath);
  const parent = path.resolve(parentPath);
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`)
    && relative !== ".."
    && !path.isAbsolute(relative));
};

const assertSafeSuiteRoot = (suiteRoot) => {
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

const testFiles = collectTestFiles(TEST_ROOT).sort((left, right) => left.localeCompare(right));
if (testFiles.length === 0) {
  console.error("[test] Tidak ada file *.test.js yang ditemukan.");
  process.exit(1);
}

const createdSuiteRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ims-backend-test-suite-"));
let suiteRoot;
try {
  suiteRoot = assertSafeSuiteRoot(createdSuiteRoot);
} catch (error) {
  fs.rmSync(createdSuiteRoot, { recursive: true, force: true });
  console.error("[test] Folder temporary test tidak aman.");
  console.error(error.message);
  process.exit(1);
}

const suiteMarker = path.join(suiteRoot, ".ims-test-suite");
const runnerDbPath = path.join(suiteRoot, "runner-safety.sqlite");
const runnerBackupDir = path.join(suiteRoot, "backups");
const runnerLogDir = path.join(suiteRoot, "logs");
fs.writeFileSync(suiteMarker, `${suiteRoot}\n`, "utf8");

const childEnv = {
  ...process.env,
  NODE_ENV: "test",
  IMS_LOG_TO_FILE: "false",
  IMS_LOG_DIR: runnerLogDir,
  IMS_SQLITE_BACKUP_DIR: runnerBackupDir,
  IMS_SQLITE_DB_PATH: runnerDbPath,
  IMS_TEST_SUITE_ROOT: suiteRoot,
};

console.log(`[test] Menjalankan ${testFiles.length} file automated test backend...`);
console.log(`[test] Runtime test diisolasi di folder temporary: ${suiteRoot}`);

let result;
let cleanupFailed = false;
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
  try {
    const markerValid = fs.existsSync(suiteMarker)
      && fs.readFileSync(suiteMarker, "utf8") === `${suiteRoot}\n`;
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

if (cleanupFailed) process.exit(1);

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
