#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_MAX_JS_BYTES = 1_100_000;

function listJavaScriptAssets(distDir) {
  const assetsDir = path.join(distDir, "assets");
  if (!fs.existsSync(assetsDir)) {
    throw new Error(`Folder hasil build tidak ditemukan: ${assetsDir}`);
  }

  return fs.readdirSync(assetsDir)
    .filter((filename) => filename.endsWith(".js"))
    .map((filename) => {
      const filePath = path.join(assetsDir, filename);
      return { filename, filePath, sizeBytes: fs.statSync(filePath).size };
    })
    .sort((left, right) => right.sizeBytes - left.sizeBytes);
}

function evaluateBundleBudget(assets, maxJsBytes = DEFAULT_MAX_JS_BYTES) {
  const oversized = assets.filter((asset) => asset.sizeBytes > maxJsBytes);
  return {
    maxJsBytes,
    oversized,
    passed: oversized.length === 0,
  };
}

function formatBytes(bytes) {
  return `${(Number(bytes || 0) / 1024).toFixed(1)} KiB`;
}

function resolveMaxJsBytes(value = process.env.IMS_FRONTEND_MAX_JS_BYTES) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return DEFAULT_MAX_JS_BYTES;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    throw new Error("IMS_FRONTEND_MAX_JS_BYTES wajib berupa integer positif dalam satuan byte.");
  }

  return parsed;
}

function main() {
  const rootDir = path.resolve(__dirname, "..");
  const distDir = process.env.IMS_FRONTEND_DIST_DIR
    ? path.resolve(process.env.IMS_FRONTEND_DIST_DIR)
    : path.join(rootDir, "frontend", "dist");
  const maxJsBytes = resolveMaxJsBytes();
  const assets = listJavaScriptAssets(distDir);
  const result = evaluateBundleBudget(assets, maxJsBytes);

  console.log(`[bundle] Memeriksa ${assets.length} asset JavaScript.`);
  assets.slice(0, 5).forEach((asset) => {
    console.log(`[bundle] ${asset.filename}: ${formatBytes(asset.sizeBytes)}`);
  });

  if (!result.passed) {
    console.error(`[bundle] ERROR: ${result.oversized.length} asset melebihi budget ${formatBytes(maxJsBytes)}.`);
    result.oversized.forEach((asset) => console.error(`[bundle] - ${asset.filename}: ${formatBytes(asset.sizeBytes)}`));
    process.exit(1);
  }

  console.log(`[bundle] OK. Semua asset JavaScript <= ${formatBytes(maxJsBytes)}.`);
}

if (require.main === module) main();

module.exports = {
  DEFAULT_MAX_JS_BYTES,
  evaluateBundleBudget,
  listJavaScriptAssets,
  resolveMaxJsBytes,
};
