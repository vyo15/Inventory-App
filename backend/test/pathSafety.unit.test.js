const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const {
  isPathAtOrInside,
  normalizePathIdentity,
  resolveThroughExistingAncestor,
} = require("../src/utils/pathSafety");

test("path safety membedakan child, sibling, dan traversal", () => {
  const root = path.join(os.tmpdir(), "ims-path-root");
  assert.equal(isPathAtOrInside(path.join(root, "daily", "backup.imsbackup"), root), true);
  assert.equal(isPathAtOrInside(root, root), true);
  assert.equal(isPathAtOrInside(path.join(root, "..", "ims-path-root-other"), root), false);
});

test("path safety memakai identity case-insensitive pada Windows", () => {
  const options = { platform: "win32", pathApi: path.win32 };
  assert.equal(
    isPathAtOrInside(String.raw`C:\IMS\Backups\Daily\A.imsbackup`, String.raw`c:\ims\backups`, options),
    true,
  );
  assert.equal(
    isPathAtOrInside(String.raw`D:\IMS\Backups`, String.raw`c:\ims\backups`, options),
    false,
  );
  assert.equal(normalizePathIdentity(String.raw`C:\IMS\BACKUPS`, options), String.raw`c:\ims\backups`);
});

test("resolveThroughExistingAncestor mempertahankan suffix path yang belum dibuat", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ims-path-safe-"));
  try {
    const candidate = path.join(root, "daily", "missing", "backup.imsbackup");
    assert.equal(resolveThroughExistingAncestor(candidate), path.resolve(candidate));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("resolveThroughExistingAncestor mengikuti realpath ancestor symlink", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ims-path-link-"));
  const actual = path.join(root, "actual");
  const link = path.join(root, "link");
  fs.mkdirSync(actual);
  try {
    fs.symlinkSync(actual, link, process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    fs.rmSync(root, { recursive: true, force: true });
    t.skip(`Symlink tidak tersedia: ${error.code || error.message}`);
    return;
  }

  try {
    const resolved = resolveThroughExistingAncestor(path.join(link, "daily", "backup.imsbackup"));
    assert.equal(resolved, path.join(fs.realpathSync(actual), "daily", "backup.imsbackup"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
