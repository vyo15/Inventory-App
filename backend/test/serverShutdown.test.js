const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { test } = require("node:test");

const IPC_MESSAGES = Object.freeze({
  READY: "IMS_BACKEND_READY",
  SHUTDOWN_REQUEST: "IMS_SHUTDOWN_REQUEST",
  SHUTDOWN_COMPLETED: "IMS_SHUTDOWN_COMPLETED",
});

const waitForOutput = (child, pattern, timeoutMs = 15_000) => new Promise((resolve, reject) => {
  let output = "";
  const timer = setTimeout(() => {
    cleanup();
    reject(new Error(`Backend tidak mencapai status siap dalam ${timeoutMs} ms. Output: ${output}`));
  }, timeoutMs);

  const handleData = (chunk) => {
    output += chunk.toString();
    if (pattern.test(output)) {
      cleanup();
      resolve(output);
    }
  };
  const handleExit = (code, signal) => {
    cleanup();
    reject(new Error(`Backend berhenti sebelum siap (code=${code}, signal=${signal}). Output: ${output}`));
  };
  const cleanup = () => {
    clearTimeout(timer);
    child.stdout.off("data", handleData);
    child.stderr.off("data", handleData);
    child.off("exit", handleExit);
  };

  child.stdout.on("data", handleData);
  child.stderr.on("data", handleData);
  child.once("exit", handleExit);
});

const waitForExit = async (child, timeoutMs = 15_000) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Backend tidak berhenti dalam ${timeoutMs} ms.`)), timeoutMs);
    timer.unref();
  });

  try {
    return await Promise.race([once(child, "exit"), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const waitForChildMessage = (child, expectedType, timeoutMs = 15_000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    cleanup();
    reject(new Error(`Backend tidak mengirim pesan ${expectedType} dalam ${timeoutMs} ms.`));
  }, timeoutMs);

  const handleMessage = (message) => {
    if (message?.type !== expectedType) return;
    cleanup();
    resolve(message);
  };
  const handleExit = (code, signal) => {
    cleanup();
    reject(new Error(`Backend berhenti sebelum pesan ${expectedType} (code=${code}, signal=${signal}).`));
  };
  const cleanup = () => {
    clearTimeout(timer);
    child.off("message", handleMessage);
    child.off("exit", handleExit);
  };

  child.on("message", handleMessage);
  child.once("exit", handleExit);
});

const verifySignalShutdown = async (t, signal) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `ims-server-${signal.toLowerCase()}-`));
  const dbPath = path.join(tempDir, "data", "ims-test.sqlite");
  const backupDir = path.join(tempDir, "backups");
  const backendRoot = path.resolve(__dirname, "..");
  const child = spawn(process.execPath, [path.join(backendRoot, "src", "server.js")], {
    cwd: backendRoot,
    env: {
      ...process.env,
      NODE_ENV: "test",
      HOST: "127.0.0.1",
      PORT: "0",
      IMS_AUTH_BOOTSTRAP_CODE: "SHUTDOWNTEST8421",
      IMS_LOG_TO_FILE: "false",
      IMS_SQLITE_DB_PATH: dbPath,
      IMS_SQLITE_BACKUP_DIR: backupDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  t.after(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  await waitForOutput(child, /ims_local_server_started/);
  assert.equal(fs.existsSync(dbPath), true);
  assert.equal(fs.existsSync(`${dbPath}-wal`), true);
  assert.equal(fs.existsSync(`${dbPath}-shm`), true);

  assert.equal(child.kill(signal), true);
  const [code, exitSignal] = await waitForExit(child);

  assert.equal(code, 0);
  assert.equal(exitSignal, null);
  assert.equal(fs.existsSync(dbPath), true);
  assert.equal(fs.existsSync(`${dbPath}-wal`), false);
  assert.equal(fs.existsSync(`${dbPath}-shm`), false);
};

const verifyRequestedShutdown = async (t, reason) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `ims-server-${reason.toLowerCase()}-`));
  const dbPath = path.join(tempDir, "data", "ims-test.sqlite");
  const backupDir = path.join(tempDir, "backups");
  const backendRoot = path.resolve(__dirname, "..");
  const child = spawn(process.execPath, [path.join(backendRoot, "src", "server.js")], {
    cwd: backendRoot,
    env: {
      ...process.env,
      NODE_ENV: "test",
      HOST: "127.0.0.1",
      PORT: "0",
      IMS_AUTH_BOOTSTRAP_CODE: "SHUTDOWNTEST8421",
      IMS_LOG_TO_FILE: "false",
      IMS_SQLITE_DB_PATH: dbPath,
      IMS_SQLITE_BACKUP_DIR: backupDir,
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });

  t.after(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  await waitForChildMessage(child, IPC_MESSAGES.READY);
  assert.equal(fs.existsSync(dbPath), true);
  assert.equal(fs.existsSync(`${dbPath}-wal`), true);
  assert.equal(fs.existsSync(`${dbPath}-shm`), true);

  child.send({ type: IPC_MESSAGES.SHUTDOWN_REQUEST, reason });
  const completed = await waitForChildMessage(child, IPC_MESSAGES.SHUTDOWN_COMPLETED);
  const [code, exitSignal] = await waitForExit(child);

  assert.equal(completed.exitCode, 0);
  assert.equal(code, 0);
  assert.equal(exitSignal, null);
  assert.equal(fs.existsSync(dbPath), true);
  assert.equal(fs.existsSync(`${dbPath}-wal`), false);
  assert.equal(fs.existsSync(`${dbPath}-shm`), false);
};

const verifyPlatformShutdown = process.platform === "win32"
  ? verifyRequestedShutdown
  : verifySignalShutdown;
const shutdownTransport = process.platform === "win32"
  ? "permintaan shutdown terkontrol karena child.kill mematikan paksa proses Windows"
  : "sinyal proses";

for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) {
  test(`${signal} melakukan checkpoint WAL dan menutup database sebelum backend keluar melalui ${shutdownTransport}`, async (t) => {
    await verifyPlatformShutdown(t, signal);
  });
}

test("permintaan IPC runner menunggu checkpoint WAL dan penutupan database", async (t) => {
  await verifyRequestedShutdown(t, "runner_ipc_shutdown");
});

test("startup failure menutup database dan tidak meninggalkan WAL/SHM", async (t) => {
  const net = require("node:net");
  const blocker = net.createServer();
  await new Promise((resolve, reject) => {
    blocker.once("error", reject);
    blocker.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => blocker.close());

  const address = blocker.address();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ims-server-startup-failure-"));
  const dbPath = path.join(tempDir, "data", "ims-test.sqlite");
  const backendRoot = path.resolve(__dirname, "..");
  const child = spawn(process.execPath, [path.join(backendRoot, "src", "server.js")], {
    cwd: backendRoot,
    env: {
      ...process.env,
      NODE_ENV: "test",
      HOST: "127.0.0.1",
      PORT: String(address.port),
      IMS_AUTH_BOOTSTRAP_CODE: "STARTUPFAIL8421",
      IMS_LOG_TO_FILE: "false",
      IMS_SQLITE_DB_PATH: dbPath,
      IMS_SQLITE_BACKUP_DIR: path.join(tempDir, "backups"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  t.after(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const [code, exitSignal] = await waitForExit(child);
  assert.equal(code, 1);
  assert.equal(exitSignal, null);
  assert.equal(fs.existsSync(dbPath), true);
  assert.equal(fs.existsSync(`${dbPath}-wal`), false);
  assert.equal(fs.existsSync(`${dbPath}-shm`), false);
});

test("shutdown yang diminta saat startup menunggu startup settle lalu menutup database", async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ims-server-early-shutdown-"));
  const dbPath = path.join(tempDir, "data", "ims-test.sqlite");
  const backendRoot = path.resolve(__dirname, "..");
  const serverPath = path.join(backendRoot, "src", "server.js");
  const script = `
    const { startServer, shutdownServer } = require(${JSON.stringify(serverPath)});
    const startup = startServer();
    const shutdown = shutdownServer({ reason: "test_early_shutdown", exitProcess: false });
    Promise.all([startup, shutdown])
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  `;
  const child = spawn(process.execPath, ["-e", script], {
    cwd: backendRoot,
    env: {
      ...process.env,
      NODE_ENV: "test",
      HOST: "127.0.0.1",
      PORT: "0",
      IMS_AUTH_BOOTSTRAP_CODE: "EARLYSTOP8421",
      IMS_LOG_TO_FILE: "false",
      IMS_SQLITE_DB_PATH: dbPath,
      IMS_SQLITE_BACKUP_DIR: path.join(tempDir, "backups"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  t.after(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const [code, exitSignal] = await waitForExit(child);
  assert.equal(code, 0);
  assert.equal(exitSignal, null);
  assert.equal(fs.existsSync(dbPath), true);
  assert.equal(fs.existsSync(`${dbPath}-wal`), false);
  assert.equal(fs.existsSync(`${dbPath}-shm`), false);
});

test("server mengaktifkan scheduler lifecycle dan menghentikannya saat shutdown", async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ims-server-backup-scheduler-"));
  const dbPath = path.join(tempDir, "data", "ims-test.sqlite");
  const backendRoot = path.resolve(__dirname, "..");
  const serverPath = path.join(backendRoot, "src", "server.js");
  const backupPath = path.join(backendRoot, "src", "modules", "maintenance", "backup");
  const script = `
    const { startServer, shutdownServer } = require(${JSON.stringify(serverPath)});
    const { getBackupLifecycleRuntimeStatus } = require(${JSON.stringify(backupPath)});
    (async () => {
      await startServer();
      console.log("SCHEDULER_ACTIVE=" + getBackupLifecycleRuntimeStatus().schedulerActive);
      await shutdownServer({ reason: "test_backup_scheduler", exitProcess: false });
      console.log("SCHEDULER_STOPPED=" + !getBackupLifecycleRuntimeStatus().schedulerActive);
    })()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  `;
  const child = spawn(process.execPath, ["-e", script], {
    cwd: backendRoot,
    env: {
      ...process.env,
      NODE_ENV: "test",
      HOST: "127.0.0.1",
      PORT: "0",
      IMS_AUTH_BOOTSTRAP_CODE: "SCHEDULERTEST8421",
      IMS_LOG_TO_FILE: "false",
      IMS_SQLITE_DB_PATH: dbPath,
      IMS_SQLITE_BACKUP_DIR: path.join(tempDir, "backups"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });

  t.after(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const [code, exitSignal] = await waitForExit(child);
  assert.equal(code, 0, output);
  assert.equal(exitSignal, null);
  assert.match(output, /SCHEDULER_ACTIVE=true/);
  assert.match(output, /SCHEDULER_STOPPED=true/);
});
