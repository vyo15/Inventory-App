#!/usr/bin/env node
const { spawn } = require("node:child_process");
const path = require("node:path");
const { assertSupportedNodeVersion } = require("./check-node-version.cjs");

try {
  assertSupportedNodeVersion();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const rootDir = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";
const npmCmd = "npm";
const children = new Map();
let shuttingDown = false;
let shutdownExitCode = 0;
let shutdownTimer = null;
const SHUTDOWN_TIMEOUT_MS = 10_000;

const commands = [
  {
    name: "backend",
    args: ["--prefix", "backend", "run", "dev"],
  },
  {
    name: "frontend",
    args: ["--prefix", "frontend", "run", "dev", "--", "--host", "0.0.0.0"],
  },
];

const createSafeEnv = () => {
  const safeEnv = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (!key || key.startsWith("=") || key.includes("\0")) continue;
    if (value === undefined || String(value).includes("\0")) continue;
    safeEnv[key] = value;
  }

  return safeEnv;
};

const prefixStream = (name, stream, output) => {
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      output.write(`[${name}] ${line}\n`);
    }
  });

  stream.on("end", () => {
    if (buffer) output.write(`[${name}] ${buffer}\n`);
  });
};

const finishShutdownIfReady = () => {
  if (!shuttingDown || children.size > 0) return;
  if (shutdownTimer) clearTimeout(shutdownTimer);
  process.exit(shutdownExitCode);
};

const stopAll = (exitCode = 0, signal = "SIGTERM") => {
  shutdownExitCode = Math.max(shutdownExitCode, exitCode);
  if (shuttingDown) return;
  shuttingDown = true;

  for (const [name, child] of children) {
    if (child.killed) continue;
    console.log(`[dev] stop ${name}`);

    // Ctrl+C pada Windows dikirim oleh console ke seluruh process group.
    // Memanggil child.kill() justru melakukan terminate paksa dan melewati
    // graceful shutdown SQLite pada backend.
    if (!(isWindows && ["SIGINT", "SIGHUP", "SIGBREAK"].includes(signal))) {
      child.kill(signal);
    }
  }

  finishShutdownIfReady();
  shutdownTimer = setTimeout(() => {
    const remaining = [...children.entries()];
    if (remaining.length === 0) return finishShutdownIfReady();

    console.error(`[dev] ${remaining.length} proses belum berhenti setelah ${SHUTDOWN_TIMEOUT_MS} ms. Force stop dijalankan.`);
    shutdownExitCode = Math.max(shutdownExitCode, 1);
    for (const [name, child] of remaining) {
      console.error(`[dev] force stop ${name}`);
      if (!child.killed) child.kill("SIGKILL");
    }

    setTimeout(() => process.exit(shutdownExitCode), 1_000).unref();
  }, SHUTDOWN_TIMEOUT_MS);
  shutdownTimer.unref();
};

const spawnDevProcess = (command) => {
  const child = spawn(npmCmd, command.args, {
    cwd: rootDir,
    env: createSafeEnv(),
    shell: isWindows,
    windowsHide: false,
    stdio: ["inherit", "pipe", "pipe"],
  });

  children.set(command.name, child);
  prefixStream(command.name, child.stdout, process.stdout);
  prefixStream(command.name, child.stderr, process.stderr);

  child.on("error", (error) => {
    console.error(`[${command.name}] gagal jalan: ${error.message}`);
    stopAll(1);
  });

  child.on("exit", (code, signal) => {
    children.delete(command.name);
    if (shuttingDown) {
      finishShutdownIfReady();
      return;
    }

    if (code === 0 || signal) {
      console.log(`[${command.name}] selesai.`);
      return;
    }

    console.error(`[${command.name}] berhenti dengan kode ${code}. Dev server lain akan dihentikan.`);
    stopAll(code || 1);
  });
};

console.log("[dev] Menjalankan layanan lokal dan frontend IMS...");
console.log("[dev] Layanan lokal : http://localhost:3001");
console.log("[dev] Frontend: http://localhost:5173/Inventory-App/");
console.log("[dev] Tekan Ctrl+C untuk menghentikan keduanya.\n");

for (const command of commands) {
  spawnDevProcess(command);
}

process.on("SIGINT", () => stopAll(0, "SIGINT"));
process.on("SIGTERM", () => stopAll(0, "SIGTERM"));
process.on("SIGHUP", () => stopAll(0, "SIGHUP"));
if (isWindows) process.on("SIGBREAK", () => stopAll(0, "SIGBREAK"));
