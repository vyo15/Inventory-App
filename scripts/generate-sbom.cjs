#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { buildSpawnInvocation } = require("./run-command.cjs");

const rootDir = path.resolve(__dirname, "..");
const outputDir = path.resolve(rootDir, process.argv[2] || ".artifacts/sbom");
const targets = ["backend", "frontend"];

fs.mkdirSync(outputDir, { recursive: true });

for (const target of targets) {
  const invocation = buildSpawnInvocation("npm", [
    "sbom",
    "--prefix",
    target,
    "--package-lock-only",
    "--sbom-format",
    "cyclonedx",
  ]);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: rootDir,
    encoding: "utf8",
    shell: invocation.shell,
  });

  if (result.error || result.status !== 0) {
    const detail = String(result.stderr || result.error?.message || "").trim();
    throw new Error(`Gagal membuat SBOM ${target}${detail ? `: ${detail}` : "."}`);
  }

  const parsed = JSON.parse(String(result.stdout || "{}"));
  if (parsed.bomFormat !== "CycloneDX" || !Array.isArray(parsed.components)) {
    throw new Error(`Output SBOM ${target} tidak valid.`);
  }

  const outputPath = path.join(outputDir, `${target}-sbom.cdx.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  console.log(`[sbom] ${target}: ${parsed.components.length} komponen -> ${outputPath}`);
}
