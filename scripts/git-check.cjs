#!/usr/bin/env node
const { run } = require("./run-command.cjs");

function hasArg(name) {
  return process.argv.includes(name);
}

function main() {
  const runFull = hasArg("--full");
  const allowDirty = hasArg("--allow-dirty");

  console.log("[git:check] Cek status source Git...");
  run("node", ["scripts/verify-source-ready.cjs", ...(allowDirty ? ["--allow-dirty"] : [])]);

  console.log("\n[git:check] Cek backend...");
  run("npm", ["--prefix", "backend", "run", "check"]);

  if (runFull) {
    console.log("\n[git:check] Build frontend...");
    run("npm", ["--prefix", "frontend", "run", "build"]);
  } else {
    console.log("\n[git:check] Frontend build dilewati. Pakai: git check --full atau npm run git:check:full");
  }

  console.log("\n[git:check] OK. Source siap dicek/push.");
}

main();
