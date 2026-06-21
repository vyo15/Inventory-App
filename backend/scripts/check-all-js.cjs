#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const targetDirectories = ["src", "test", "scripts"]
  .map((directory) => path.join(root, directory))
  .filter((directory) => fs.existsSync(directory));
const supportedExtensions = new Set([".js", ".cjs", ".mjs"]);

function collectJavaScriptFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJavaScriptFiles(fullPath));
    } else if (
      entry.isFile()
      && supportedExtensions.has(path.extname(entry.name).toLowerCase())
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

const files = targetDirectories
  .flatMap(collectJavaScriptFiles)
  .sort();

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`[backend:check] Gagal cek ${file}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log(`Backend syntax check OK (${files.length} JS/CJS/MJS files).`);
