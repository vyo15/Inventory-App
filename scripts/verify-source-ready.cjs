#!/usr/bin/env node
const { capture } = require("./run-command.cjs");

function fail(message) {
  console.error(`\n[verify] ERROR: ${message}`);
  process.exit(1);
}

function main() {
  const allowDirty = process.argv.includes("--allow-dirty");
  const root = capture("git", ["rev-parse", "--show-toplevel"]);

  if (!root) {
    fail("Command ini harus dijalankan di dalam repository Git IMS.");
  }

  const branch = capture("git", ["branch", "--show-current"]) || "(detached)";
  const head = capture("git", ["log", "--oneline", "-1"]) || "(HEAD tidak terbaca)";
  const upstream = capture("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
  const status = capture("git", ["status", "--short"]);

  console.log("[verify] IMS source readiness");
  console.log(`[verify] Root    : ${root}`);
  console.log(`[verify] Branch  : ${branch}`);
  console.log(`[verify] HEAD    : ${head}`);
  console.log(`[verify] Upstream: ${upstream || "belum diset"}`);

  if (upstream) {
    const counts = capture("git", ["rev-list", "--left-right", "--count", `${upstream}...HEAD`]);
    if (counts) {
      const [behind = "0", ahead = "0"] = counts.split(/\s+/);
      console.log(`[verify] Ahead/behind upstream: ahead ${ahead}, behind ${behind}`);
    }
  }

  if (status) {
    console.log("\n[verify] Working tree belum bersih:");
    console.log(status);

    if (!allowDirty) {
      fail(
        "Masih ada perubahan belum commit. Jalankan git add + git commit dulu, " +
          "atau pakai npm run git:push -- \"pesan commit\" agar perubahan ikut ter-push."
      );
    }
  } else {
    console.log("[verify] Working tree bersih.");
  }

  if (!upstream) {
    console.log("[verify] Catatan: upstream belum diset. Push pertama akan perlu -u origin <branch>.");
  }
}

main();
