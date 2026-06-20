#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const TEST_ROOT = path.resolve(__dirname, "../test");

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

console.log(`[test] Menjalankan ${testFiles.length} file automated test backend...`);
const result = spawnSync(
  process.execPath,
  ["--test", "--test-concurrency=1", ...testFiles],
  { stdio: "inherit", shell: false }
);

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
