const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const {
  DEFAULT_MAX_JS_BYTES,
  evaluateBundleBudget,
  listJavaScriptAssets,
  resolveMaxJsBytes,
} = require("./check-frontend-bundle.cjs");

const tempDirs = [];
const createDist = (files = {}) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ims-bundle-"));
  tempDirs.push(tempDir);
  const assetsDir = path.join(tempDir, "assets");
  fs.mkdirSync(assetsDir, { recursive: true });
  Object.entries(files).forEach(([filename, size]) => {
    fs.writeFileSync(path.join(assetsDir, filename), Buffer.alloc(size));
  });
  return tempDir;
};

afterEach(() => {
  while (tempDirs.length) fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
});

test("bundle budget membaca hanya asset JavaScript dan mengurutkan ukuran terbesar", () => {
  const distDir = createDist({ "small.js": 10, "large.js": 100, "style.css": 1000 });
  const assets = listJavaScriptAssets(distDir);

  assert.deepEqual(assets.map((asset) => asset.filename), ["large.js", "small.js"]);
  assert.equal(evaluateBundleBudget(assets, 100).passed, true);
});

test("bundle budget menolak asset yang melebihi batas", () => {
  const result = evaluateBundleBudget([{ filename: "index.js", sizeBytes: 101 }], 100);
  assert.equal(result.passed, false);
  assert.equal(result.oversized[0].filename, "index.js");
});

test("bundle budget memakai default dan menerima integer positif", () => {
  assert.equal(resolveMaxJsBytes(), DEFAULT_MAX_JS_BYTES);
  assert.equal(resolveMaxJsBytes("1200000"), 1_200_000);
});

test("bundle budget menolak nilai environment yang tidak valid", () => {
  assert.throws(() => resolveMaxJsBytes("abc"), /integer positif/);
  assert.throws(() => resolveMaxJsBytes("0"), /integer positif/);
  assert.throws(() => resolveMaxJsBytes("100.5"), /integer positif/);
});
