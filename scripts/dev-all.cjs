#!/usr/bin/env node
const { spawn } = require("node:child_process");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const children = new Map();
let shuttingDown = false;

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

const stopAll = (exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const [name, child] of children) {
    if (!child.killed) {
      console.log(`[dev] stop ${name}`);
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => process.exit(exitCode), 300).unref();
};

console.log("[dev] Menjalankan backend dan frontend IMS...");
console.log("[dev] Backend : http://localhost:3001");
console.log("[dev] Frontend: http://localhost:5173/Inventory-App/");
console.log("[dev] Tekan Ctrl+C untuk menghentikan keduanya.\n");

for (const command of commands) {
  const child = spawn(npmCmd, command.args, {
    cwd: rootDir,
    env: process.env,
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
    if (shuttingDown) return;

    if (code === 0 || signal) {
      console.log(`[${command.name}] selesai.`);
      return;
    }

    console.error(`[${command.name}] berhenti dengan kode ${code}. Dev server lain akan dihentikan.`);
    stopAll(code || 1);
  });
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
