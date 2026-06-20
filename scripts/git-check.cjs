#!/usr/bin/env node
const { run } = require("./run-command.cjs");

function hasArg(name) {
  return process.argv.includes(name);
}

function main() {
  const runFull = hasArg("--full");
  const allowDirty = hasArg("--allow-dirty");
  const skipSource = hasArg("--skip-source");

  if (skipSource) {
    console.log("[git:check] Source Git dilewati untuk quality check lokal.");
  } else {
    console.log("[git:check] Cek status source Git...");
    run("node", ["scripts/verify-source-ready.cjs", ...(allowDirty ? ["--allow-dirty"] : [])]);
  }

  console.log("\n[git:check] Cek backend...");
  run("npm", ["--prefix", "backend", "run", "check"]);

  console.log("\n[git:check] Lint frontend...");
  run("npm", ["--prefix", "frontend", "run", "lint"]);

  if (runFull) {
    console.log("\n[git:check] Build frontend...");
    run("npm", ["--prefix", "frontend", "run", "build"]);
    console.log("\n[git:check] Cek budget bundle frontend...");
    run("npm", ["run", "check:bundle"]);
  } else {
    console.log("\n[git:check] Frontend build dilewati. Pakai: git check --full atau npm run git:check:full");
  }

  console.log("\n[git:check] Jalankan automated test backend dan frontend...");
  run("npm", ["test"]);

  console.log("\n[git:check] OK. Source siap dicek/push.");
}

main();
