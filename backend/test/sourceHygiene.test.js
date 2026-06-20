const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { test } = require("node:test");
const {
  findTrackedRuntimeArtifacts,
  findUnsafeArchiveEntries,
  verifySourceArchive,
} = require("../../scripts/verify-source-ready.cjs");

const ROOT_DIR = path.resolve(__dirname, "../..");

const readRootFile = (relativePath) => fs.readFileSync(path.join(ROOT_DIR, relativePath), "utf8");

test("source readiness menolak runtime database dan backup yang ter-track", () => {
  const trackedFiles = [
    "data/.gitkeep",
    "backups/.gitkeep",
    "backups/sqlite/.gitkeep",
    "data/ims.sqlite",
    "data\\ims.sqlite-wal",
    "backups/sqlite/daily/IMS-BF-BACKUP.imsbackup",
    "backups\\sqlite\\daily\\IMS-BF-BACKUP.imsbackup.manifest.json",
    "frontend/src/main.jsx",
  ];

  assert.deepEqual(findTrackedRuntimeArtifacts(trackedFiles), [
    "data/ims.sqlite",
    "data\\ims.sqlite-wal",
    "backups/sqlite/daily/IMS-BF-BACKUP.imsbackup",
    "backups\\sqlite\\daily\\IMS-BF-BACKUP.imsbackup.manifest.json",
  ]);
});


test("backend test runner memakai discovery otomatis dan lockfile registry publik", () => {
  const backendPackage = JSON.parse(readRootFile("backend/package.json"));
  const backendLock = readRootFile("backend/package-lock.json");
  const frontendLock = readRootFile("frontend/package-lock.json");

  assert.equal(backendPackage.scripts.test, "node scripts/run-tests.cjs");
  assert.doesNotMatch(backendLock, /packages\.applied-caas-gateway/i);
  assert.doesNotMatch(frontendLock, /packages\.applied-caas-gateway/i);
  assert.doesNotMatch(frontendLock, /node_modules\/@ant-design\/charts/);
});

test("git archive mengecualikan seluruh folder data dan backups", () => {
  const attributes = readRootFile(".gitattributes");

  assert.match(attributes, /^\/data export-ignore$/m);
  assert.match(attributes, /^\/backups export-ignore$/m);
});

test("script clean ZIP selalu memakai git archive HEAD", () => {
  const powershellScript = readRootFile("scripts/create-clean-zip.ps1");
  const shellScript = readRootFile("scripts/create-clean-zip.sh");

  assert.match(powershellScript, /verify-source-ready\.cjs/);
  assert.match(shellScript, /verify-source-ready\.cjs/);
  assert.match(powershellScript, /git archive --format=zip[\s\S]*HEAD/);
  assert.match(shellScript, /git archive --format=zip[\s\S]*HEAD/);
  assert.doesNotMatch(powershellScript, /Compress-Archive/i);
  assert.doesNotMatch(shellScript, /zip\s+-r/i);
  assert.match(powershellScript, /Assert-NativeCommandSucceeded/);
  assert.match(powershellScript, /Validasi source readiness/);
  assert.match(powershellScript, /Membuat ZIP dari commit HEAD/);
  assert.match(powershellScript, /--archive-only/);
  assert.match(shellScript, /--archive-only/);
});


test("source ZIP verifier menolak runtime, generated output, dan path backslash", () => {
  const unsafeEntries = findUnsafeArchiveEntries([
    "Inventory-App/package.json",
    "Inventory-App/frontend/src/data/adapters/sqlite/adapter.js",
    "Inventory-App/backups/sqlite/daily/IMS.imsbackup",
    "Inventory-App/data/ims.sqlite-wal",
    "Inventory-App/frontend/dist/index.js",
    "Inventory-App\\backend\\package.json",
  ]);

  assert.deepEqual(unsafeEntries, [
    "Inventory-App/backend/package.json",
    "backups/sqlite/daily/IMS.imsbackup",
    "data/ims.sqlite-wal",
    "frontend/dist/index.js",
  ]);
});


test("source ZIP verifier menolak artifact runtime dari ZIP aktual", () => {
  const tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), "ims-unsafe-zip-"));

  try {
    fs.mkdirSync(path.join(tempRepo, "backend"), { recursive: true });
    fs.mkdirSync(path.join(tempRepo, "frontend"), { recursive: true });
    fs.mkdirSync(path.join(tempRepo, "backups", "sqlite", "daily"), { recursive: true });
    fs.writeFileSync(path.join(tempRepo, ".gitattributes"), "* text=auto\n");
    fs.writeFileSync(path.join(tempRepo, "package.json"), "{}\n");
    fs.writeFileSync(path.join(tempRepo, "backend", "package.json"), "{}\n");
    fs.writeFileSync(path.join(tempRepo, "frontend", "package.json"), "{}\n");
    fs.writeFileSync(
      path.join(tempRepo, "backups", "sqlite", "daily", "IMS-UNSAFE.imsbackup"),
      "runtime-backup",
    );

    const runGit = (args) => execFileSync("git", args, {
      cwd: tempRepo,
      stdio: "ignore",
    });

    runGit(["init", "-q"]);
    runGit(["config", "user.email", "ims-test@example.invalid"]);
    runGit(["config", "user.name", "IMS Test"]);
    runGit(["add", "."]);
    runGit(["commit", "-qm", "unsafe source fixture"]);

    const zipPath = path.join(tempRepo, "unsafe-source.zip");
    runGit([
      "archive",
      "--format=zip",
      "--prefix=Inventory-App/",
      `--output=${zipPath}`,
      "HEAD",
    ]);

    assert.throws(
      () => verifySourceArchive(zipPath, { log: () => {} }),
      /backups\/sqlite\/daily\/IMS-UNSAFE\.imsbackup/,
    );
  } finally {
    fs.rmSync(tempRepo, { recursive: true, force: true });
  }
});


const listTarEntries = (archiveBuffer) => {
  const entries = [];
  let offset = 0;

  while (offset + 512 <= archiveBuffer.length) {
    const header = archiveBuffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;

    const readField = (start, length) => header
      .subarray(start, start + length)
      .toString("utf8")
      .replace(/\0.*$/, "")
      .trim();

    const name = readField(0, 100);
    const prefix = readField(345, 155);
    const size = Number.parseInt(readField(124, 12) || "0", 8) || 0;
    entries.push(prefix ? `${prefix}/${name}` : name);
    offset += 512 + Math.ceil(size / 512) * 512;
  }

  return entries;
};

test("git archive aktual tidak membawa data dan backup runtime", () => {
  const tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), "ims-source-hygiene-"));

  try {
    fs.mkdirSync(path.join(tempRepo, "data"), { recursive: true });
    fs.mkdirSync(path.join(tempRepo, "backups", "sqlite", "daily"), { recursive: true });
    fs.mkdirSync(path.join(tempRepo, "frontend", "src"), { recursive: true });

    fs.copyFileSync(path.join(ROOT_DIR, ".gitattributes"), path.join(tempRepo, ".gitattributes"));
    fs.writeFileSync(path.join(tempRepo, "data", ".gitkeep"), "");
    fs.writeFileSync(path.join(tempRepo, "data", "ims.sqlite"), "runtime-db");
    fs.writeFileSync(path.join(tempRepo, "backups", ".gitkeep"), "");
    fs.writeFileSync(
      path.join(tempRepo, "backups", "sqlite", "daily", "IMS-TEST.imsbackup"),
      "runtime-backup",
    );
    fs.writeFileSync(path.join(tempRepo, "frontend", "src", "main.jsx"), "export default true;\n");

    const runGit = (args, options = {}) => execFileSync("git", args, {
      cwd: tempRepo,
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "ignore",
      ...options,
    });

    runGit(["init", "-q"]);
    runGit(["config", "user.email", "ims-test@example.invalid"]);
    runGit(["config", "user.name", "IMS Test"]);
    runGit(["add", "."]);
    runGit(["commit", "-qm", "source hygiene fixture"]);

    const archiveBuffer = runGit(["archive", "--format=tar", "HEAD"], { capture: true });
    const entries = listTarEntries(archiveBuffer);

    assert.equal(entries.includes("frontend/src/main.jsx"), true);
    assert.equal(entries.some((entry) => entry === "data" || entry.startsWith("data/")), false);
    assert.equal(entries.some((entry) => entry === "backups" || entry.startsWith("backups/")), false);

    fs.writeFileSync(path.join(tempRepo, "package.json"), "{}\n");
    fs.mkdirSync(path.join(tempRepo, "backend"), { recursive: true });
    fs.writeFileSync(path.join(tempRepo, "backend", "package.json"), "{}\n");
    fs.writeFileSync(path.join(tempRepo, "frontend", "package.json"), "{}\n");
    runGit(["add", "package.json", "backend/package.json", "frontend/package.json"]);
    runGit(["commit", "-qm", "add required source files"]);

    const zipPath = path.join(tempRepo, "Inventory-App-clean.zip");
    runGit([
      "archive",
      "--format=zip",
      "--prefix=Inventory-App/",
      `--output=${zipPath}`,
      "HEAD",
    ]);

    const verification = verifySourceArchive(zipPath, { log: () => {} });
    assert.equal(verification.prefix, "Inventory-App");
    assert.equal(verification.relativeEntries.includes("package.json"), true);
  } finally {
    fs.rmSync(tempRepo, { recursive: true, force: true });
  }
});
