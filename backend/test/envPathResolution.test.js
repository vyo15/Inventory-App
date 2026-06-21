const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

const backendRoot = path.resolve(__dirname, "..");
const repositoryRoot = path.resolve(backendRoot, "..");
const envModulePath = path.join(backendRoot, "src", "config", "env.js");

const probeEnvPaths = (cwd, overrides = {}) => {
  const childEnv = { ...process.env, NODE_ENV: "test", ...overrides };
  delete childEnv.IMS_SQLITE_DB_PATH;
  delete childEnv.IMS_SQLITE_BACKUP_DIR;
  delete childEnv.IMS_LOG_DIR;
  Object.assign(childEnv, overrides);

  const result = spawnSync(process.execPath, [
    "-e",
    `const env = require(${JSON.stringify(envModulePath)}); process.stdout.write(JSON.stringify({ dbPath: env.dbPath, backupDir: env.backupDir, logDir: env.logDir }));`,
  ], {
    cwd,
    env: childEnv,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
};

test("path runtime default tetap sama saat backend dijalankan dari root atau folder backend", () => {
  const fromRepository = probeEnvPaths(repositoryRoot);
  const fromBackend = probeEnvPaths(backendRoot);
  const expected = {
    dbPath: path.join(repositoryRoot, "data", "ims-sqlite-sidecar.sqlite"),
    backupDir: path.join(repositoryRoot, "backups", "sqlite"),
    logDir: path.join(repositoryRoot, "logs"),
  };

  assert.deepEqual(fromRepository, expected);
  assert.deepEqual(fromBackend, expected);
  assert.notEqual(
    fromRepository.dbPath,
    path.join(path.dirname(repositoryRoot), "data", "ims-sqlite-sidecar.sqlite"),
  );
});

test("path environment absolut tetap dipakai tanpa perubahan", () => {
  const customRoot = path.join(repositoryRoot, "runtime-test-absolute");
  const result = probeEnvPaths(repositoryRoot, {
    IMS_SQLITE_DB_PATH: path.join(customRoot, "data.sqlite"),
    IMS_SQLITE_BACKUP_DIR: path.join(customRoot, "backups"),
    IMS_LOG_DIR: path.join(customRoot, "logs"),
  });

  assert.deepEqual(result, {
    dbPath: path.join(customRoot, "data.sqlite"),
    backupDir: path.join(customRoot, "backups"),
    logDir: path.join(customRoot, "logs"),
  });
});

test("path environment relatif dihitung konsisten dari folder backend", () => {
  const result = probeEnvPaths(repositoryRoot, {
    IMS_SQLITE_DB_PATH: "runtime/custom.sqlite",
    IMS_SQLITE_BACKUP_DIR: "runtime/backups",
    IMS_LOG_DIR: "runtime/logs",
  });

  assert.deepEqual(result, {
    dbPath: path.join(backendRoot, "runtime", "custom.sqlite"),
    backupDir: path.join(backendRoot, "runtime", "backups"),
    logDir: path.join(backendRoot, "runtime", "logs"),
  });
});
