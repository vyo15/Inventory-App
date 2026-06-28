#!/usr/bin/env node
const { spawn } = require("node:child_process");
const path = require("node:path");
const { assertSupportedNodeVersion } = require("./check-node-version.cjs");

const IPC_MESSAGES = Object.freeze({
  READY: "IMS_BACKEND_READY",
  SHUTDOWN_REQUEST: "IMS_SHUTDOWN_REQUEST",
  SHUTDOWN_COMPLETED: "IMS_SHUTDOWN_COMPLETED",
});
const SHUTDOWN_TIMEOUT_MS = 10_000;
const TESTING_LAB_FLAG = "--testing-lab";

try {
  assertSupportedNodeVersion();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const rootDir = path.resolve(__dirname, "..");
const backendDir = path.join(rootDir, "backend");
const frontendDir = path.join(rootDir, "frontend");
const backendEntry = path.join(backendDir, "src", "server.js");
const frontendEntry = path.join(frontendDir, "node_modules", "vite", "bin", "vite.js");

const parseRunnerMode = (argv = []) => ({
  testingLab: argv.includes(TESTING_LAB_FLAG),
});

const resolveBackendRuntimePath = (value, fallbackRelativePath, projectRoot = rootDir) => {
  const projectBackendDir = path.join(projectRoot, "backend");
  const rawValue = value || fallbackRelativePath;
  return path.isAbsolute(rawValue)
    ? path.resolve(rawValue)
    : path.resolve(projectBackendDir, rawValue);
};

const normalizePathIdentity = (candidatePath) => {
  const resolved = path.resolve(candidatePath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
};

const assertSeparatedPath = (candidatePath, operationalPath, label) => {
  if (normalizePathIdentity(candidatePath) !== normalizePathIdentity(operationalPath)) return;
  throw new Error(`${label} sandbox tidak boleh sama dengan lokasi operasional.`);
};

const buildRuntimeConfiguration = ({
  testingLab = false,
  projectRoot = rootDir,
  baseEnv = process.env,
} = {}) => {
  const inheritedPurpose = String(baseEnv.IMS_DATABASE_PURPOSE || "").trim().toLowerCase();
  const inheritedDbPath = inheritedPurpose === "sandbox" ? "" : baseEnv.IMS_SQLITE_DB_PATH;
  const operational = {
    databasePath: resolveBackendRuntimePath(
      baseEnv.IMS_OPERATIONAL_SOURCE_DB_PATH || inheritedDbPath,
      "../data/ims-sqlite-sidecar.sqlite",
      projectRoot,
    ),
    backupDir: resolveBackendRuntimePath(null, "../backups/sqlite", projectRoot),
    logDir: resolveBackendRuntimePath(null, "../logs", projectRoot),
  };

  if (testingLab) {
    const sandbox = {
      databasePath: path.join(projectRoot, "data", "ims-testing-sandbox.sqlite"),
      backupDir: path.join(projectRoot, "backups", "testing-sandbox"),
      logDir: path.join(projectRoot, "logs", "testing-sandbox"),
    };

    assertSeparatedPath(sandbox.databasePath, operational.databasePath, "Database");
    assertSeparatedPath(sandbox.backupDir, operational.backupDir, "Folder backup");
    assertSeparatedPath(sandbox.logDir, operational.logDir, "Folder log");

    return {
      mode: "testing-lab",
      label: "MODE TESTING / SANDBOX",
      databasePath: sandbox.databasePath,
      backupDir: sandbox.backupDir,
      logDir: sandbox.logDir,
      envOverrides: {
        IMS_ENABLE_TESTING_LAB: "true",
        IMS_DATABASE_PURPOSE: "sandbox",
        IMS_SQLITE_DB_PATH: sandbox.databasePath,
        IMS_SQLITE_BACKUP_DIR: sandbox.backupDir,
        IMS_LOG_DIR: sandbox.logDir,
        IMS_OPERATIONAL_SOURCE_DB_PATH: operational.databasePath,
      },
      envRemovals: [],
    };
  }

  const inheritedSandboxMode = String(baseEnv.IMS_DATABASE_PURPOSE || "").trim().toLowerCase() === "sandbox"
    || ["1", "true", "yes", "on"].includes(
      String(baseEnv.IMS_ENABLE_TESTING_LAB || "").trim().toLowerCase(),
    );
  const envRemovals = ["IMS_ENABLE_TESTING_LAB", "IMS_DATABASE_PURPOSE", "IMS_OPERATIONAL_SOURCE_DB_PATH"];
  if (inheritedSandboxMode) {
    envRemovals.push("IMS_SQLITE_DB_PATH", "IMS_SQLITE_BACKUP_DIR", "IMS_LOG_DIR");
  }

  return {
    mode: "operational",
    label: "MODE OPERASIONAL",
    databasePath: inheritedSandboxMode
      ? operational.databasePath
      : resolveBackendRuntimePath(baseEnv.IMS_SQLITE_DB_PATH, "../data/ims-sqlite-sidecar.sqlite", projectRoot),
    backupDir: inheritedSandboxMode
      ? operational.backupDir
      : resolveBackendRuntimePath(baseEnv.IMS_SQLITE_BACKUP_DIR, "../backups/sqlite", projectRoot),
    logDir: inheritedSandboxMode
      ? operational.logDir
      : resolveBackendRuntimePath(baseEnv.IMS_LOG_DIR, "../logs", projectRoot),
    envOverrides: {
      IMS_ENABLE_TESTING_LAB: "false",
      IMS_DATABASE_PURPOSE: "operational",
      ...(inheritedSandboxMode
        ? {
          IMS_SQLITE_DB_PATH: operational.databasePath,
          IMS_SQLITE_BACKUP_DIR: operational.backupDir,
          IMS_LOG_DIR: operational.logDir,
        }
        : {}),
    },
    envRemovals,
  };
};

const runnerMode = parseRunnerMode(process.argv.slice(2));
const runtimeConfiguration = buildRuntimeConfiguration({
  testingLab: runnerMode.testingLab,
  projectRoot: rootDir,
  baseEnv: process.env,
});

const children = new Map();
let shuttingDown = false;
let shutdownExitCode = 0;
let shutdownTimer = null;
let backendShutdownRequested = false;
let frontendStopRequested = false;

const createSafeEnv = ({ baseEnv = process.env, runtime = runtimeConfiguration } = {}) => {
  const safeEnv = {};

  for (const [key, value] of Object.entries(baseEnv)) {
    if (!key || key.startsWith("=") || key.includes("\0")) continue;
    if (value === undefined || String(value).includes("\0")) continue;
    safeEnv[key] = value;
  }

  for (const key of runtime.envRemovals) delete safeEnv[key];
  for (const [key, value] of Object.entries(runtime.envOverrides)) safeEnv[key] = String(value);

  return safeEnv;
};

const prefixStream = (name, stream, output) => {
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) output.write(`[${name}] ${line}\n`);
  });

  stream.on("end", () => {
    if (buffer) output.write(`[${name}] ${buffer}\n`);
  });
};

const finishShutdownIfReady = () => {
  if (!shuttingDown || children.size > 0) return;
  if (shutdownTimer) clearTimeout(shutdownTimer);
  console.log("[dev] seluruh layanan berhenti.");
  process.exit(shutdownExitCode);
};

const stopFrontend = () => {
  if (frontendStopRequested) return;
  frontendStopRequested = true;

  const child = children.get("frontend");
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    finishShutdownIfReady();
    return;
  }

  console.log("[dev] stop frontend");
  child.kill("SIGTERM");
};

const requestBackendShutdown = (reason) => {
  if (backendShutdownRequested) return;
  backendShutdownRequested = true;

  const child = children.get("backend");
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    stopFrontend();
    return;
  }

  if (child.connected && typeof child.send === "function") {
    console.log("[dev] meminta backend menutup database dengan aman...");
    try {
      child.send({
        type: IPC_MESSAGES.SHUTDOWN_REQUEST,
        reason,
      }, (error) => {
        if (error && child.exitCode === null && child.signalCode === null) {
          console.error(`[dev] permintaan shutdown backend gagal dikirim: ${error.message}`);
        }
      });
      return;
    } catch (error) {
      console.error(`[dev] channel shutdown backend gagal: ${error.message}`);
    }
  }

  if (process.platform !== "win32") child.kill("SIGTERM");
};

const forceStopRemaining = () => {
  const remaining = [...children.entries()];
  if (remaining.length === 0) return finishShutdownIfReady();

  console.error(`[dev] ${remaining.length} proses belum berhenti setelah ${SHUTDOWN_TIMEOUT_MS} ms. Force stop dijalankan.`);
  shutdownExitCode = Math.max(shutdownExitCode, 1);
  for (const [name, child] of remaining) {
    console.error(`[dev] force stop ${name}`);
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }

  setTimeout(() => process.exit(shutdownExitCode), 1_000).unref();
};

const stopAll = (exitCode = 0, reason = "manual") => {
  shutdownExitCode = Math.max(shutdownExitCode, exitCode);
  if (shuttingDown) return;
  shuttingDown = true;

  requestBackendShutdown(reason);
  if (!children.has("backend")) stopFrontend();

  finishShutdownIfReady();
  shutdownTimer = setTimeout(forceStopRemaining, SHUTDOWN_TIMEOUT_MS);
  shutdownTimer.unref();
};

const handleBackendMessage = (message) => {
  if (message?.type === IPC_MESSAGES.READY) {
    console.log(`[dev] backend siap: ${message.address || "http://localhost:3001"}`);
    return;
  }

  if (message?.type !== IPC_MESSAGES.SHUTDOWN_COMPLETED) return;

  shutdownExitCode = Math.max(shutdownExitCode, Number(message.exitCode) || 0);
  console.log("[dev] backend menutup database dengan aman.");
  stopFrontend();
};

const handleChildExit = (name, code, signal) => {
  children.delete(name);

  if (name === "backend") {
    if (shuttingDown) {
      stopFrontend();
    } else {
      const exitCode = Number.isInteger(code) ? code : (signal ? 0 : 1);
      console.error(`[backend] berhenti${signal ? ` karena ${signal}` : ` dengan kode ${exitCode}`}. Frontend akan dihentikan.`);
      stopAll(exitCode, "backend_exit");
    }
  } else if (!shuttingDown) {
    const exitCode = Number.isInteger(code) ? code : (signal ? 0 : 1);
    if (exitCode === 0 || signal) console.log("[frontend] selesai. Backend akan dihentikan dengan aman.");
    else console.error(`[frontend] berhenti dengan kode ${exitCode}. Backend akan dihentikan dengan aman.`);
    stopAll(exitCode, "frontend_exit");
  }

  finishShutdownIfReady();
};

const spawnService = ({ name, entry, args = [], cwd, ipc = false }) => {
  const stdio = ipc
    ? ["inherit", "pipe", "pipe", "ipc"]
    : ["inherit", "pipe", "pipe"];
  const child = spawn(process.execPath, [entry, ...args], {
    cwd,
    env: createSafeEnv(),
    shell: false,
    windowsHide: false,
    stdio,
  });

  children.set(name, child);
  prefixStream(name, child.stdout, process.stdout);
  prefixStream(name, child.stderr, process.stderr);

  if (ipc) child.on("message", handleBackendMessage);

  child.on("error", (error) => {
    console.error(`[${name}] gagal jalan: ${error.message}`);
    stopAll(1, `${name}_spawn_error`);
  });

  child.on("exit", (code, signal) => handleChildExit(name, code, signal));
};

if (require.main === module) {
  console.log("[dev] Menjalankan backend dan frontend IMS dari satu terminal...");
  console.log(`[dev] ${runtimeConfiguration.label}`);
  console.log(`[dev] Database : ${runtimeConfiguration.databasePath}`);
  console.log(`[dev] Backup   : ${runtimeConfiguration.backupDir}`);
  console.log(`[dev] Log      : ${runtimeConfiguration.logDir}`);
  if (runtimeConfiguration.mode === "testing-lab") {
    console.log(`[dev] Sumber clone operasional (read-only): ${runtimeConfiguration.envOverrides.IMS_OPERATIONAL_SOURCE_DB_PATH}`);
    console.log("[dev] Data operasional tidak digunakan sebagai database aktif.");
  }
  console.log("[dev] Backend : http://localhost:3001");
  console.log("[dev] Frontend: http://localhost:5173/Inventory-App/");
  console.log("[dev] Tekan Ctrl+C satu kali. Backend akan menutup SQLite lebih dahulu.\n");

  spawnService({
    name: "backend",
    entry: backendEntry,
    cwd: backendDir,
    ipc: true,
  });
  spawnService({
    name: "frontend",
    entry: frontendEntry,
    args: ["--host", "0.0.0.0"],
    cwd: frontendDir,
  });

  process.on("SIGINT", () => stopAll(0, "SIGINT"));
  process.on("SIGTERM", () => stopAll(0, "SIGTERM"));
  process.on("SIGHUP", () => stopAll(0, "SIGHUP"));
  if (process.platform === "win32") process.on("SIGBREAK", () => stopAll(0, "SIGBREAK"));
}

module.exports = {
  IPC_MESSAGES,
  SHUTDOWN_TIMEOUT_MS,
  TESTING_LAB_FLAG,
  buildRuntimeConfiguration,
  createSafeEnv,
  parseRunnerMode,
};
