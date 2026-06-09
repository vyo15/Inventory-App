#!/usr/bin/env node
const { run, capture } = require("./run-command.cjs");

function fail(message) {
  console.error(`\n[git:setup] ERROR: ${message}`);
  process.exit(1);
}

function main() {
  const root = capture("git", ["rev-parse", "--show-toplevel"]);
  if (!root) {
    fail("Command ini harus dijalankan di dalam repository Git IMS.");
  }

  console.log("[git:setup] Mengaktifkan hooks project...");
  run("git", ["config", "core.hooksPath", ".githooks"]);

  console.log("[git:setup] Memasang alias Git lokal project...");
  run("git", ["config", "alias.check", "!node scripts/git-check.cjs"]);
  run("git", ["config", "alias.savepush", "!node scripts/git-push-safe.cjs"]);
  run("git", ["config", "alias.zipclean", "!npm run clean:zip"]);

  console.log("\n[git:setup] Selesai. Shortcut tersedia di repo ini:");
  console.log('  git check');
  console.log('  git check --full');
  console.log('  git savepush "Pesan commit"');
  console.log('  git zipclean');
  console.log("\n[git:setup] Catatan: command bawaan 'git push' tetap bisa dipakai, tapi sekarang akan dicek oleh pre-push hook.");
}

main();
