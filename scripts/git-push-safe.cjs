#!/usr/bin/env node
const { run, capture } = require("./run-command.cjs");

function parseArgs(argv) {
  const flags = new Set();
  const parts = [];

  for (const arg of argv) {
    if (arg === "--full" || arg === "--no-verify") {
      flags.add(arg);
    } else {
      parts.push(arg);
    }
  }

  return {
    full: flags.has("--full"),
    noVerify: flags.has("--no-verify"),
    message: parts.join(" ").trim(),
  };
}

function fail(message) {
  console.error(`\n[git:push] ERROR: ${message}`);
  process.exit(1);
}

function main() {
  const { full, noVerify, message } = parseArgs(process.argv.slice(2));
  const root = capture("git", ["rev-parse", "--show-toplevel"]);

  if (!root) {
    fail("Command ini harus dijalankan di dalam repository Git IMS.");
  }

  const branch = capture("git", ["branch", "--show-current"]);
  if (!branch) {
    fail("Branch aktif tidak terbaca atau sedang detached HEAD.");
  }

  const status = capture("git", ["status", "--short"]);

  if (status && !message) {
    console.log("[git:push] Ada perubahan belum commit:");
    console.log(status);
    fail('Berikan pesan commit, contoh: npm run git:push -- "Refactor backend routes"');
  }

  if (!noVerify) {
    console.log("[git:push] Menjalankan check sebelum commit/push...");
    run("npm", ["run", full ? "git:check:full" : "git:check", "--", "--allow-dirty"]);
  }

  if (status) {
    console.log("\n[git:push] Menambahkan perubahan ke commit...");
    run("git", ["add", "-A"]);
    run("git", ["commit", "-m", message]);
  } else {
    console.log("[git:push] Tidak ada perubahan baru untuk di-commit.");
  }

  const upstream = capture("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
  console.log("\n[git:push] Push ke GitHub...");

  if (upstream) {
    run("git", ["push"]);
  } else {
    run("git", ["push", "-u", "origin", branch]);
  }

  console.log("\n[git:push] Selesai. Source sudah commit dan push.");
}

main();
