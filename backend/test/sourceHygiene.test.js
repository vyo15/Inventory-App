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

test("source engineering minimum tersedia dan dead compatibility files tidak kembali", () => {
  const requiredFiles = [
    "README.md",
    ".github/workflows/quality-gate.yml",
  ];
  const removedFiles = [
    "frontend/src/components/Layout/Feedback/OfflineRepositoryStatus.jsx",
    "frontend/src/components/Layout/Mobile/ResponsiveDataView.jsx",
    "frontend/src/services/Maintenance/helpers/dataQualityAuditHelpers.js",
    "frontend/src/utils/references/businessCodeCounterService.js",
    "frontend/src/utils/references/businessCodeGenerator.js",
  ];

  requiredFiles.forEach((relativePath) => {
    assert.equal(fs.existsSync(path.join(ROOT_DIR, relativePath)), true, `${relativePath} wajib tersedia`);
  });
  removedFiles.forEach((relativePath) => {
    assert.equal(fs.existsSync(path.join(ROOT_DIR, relativePath)), false, `${relativePath} tidak boleh kembali tanpa usage audit`);
  });
});

test("source readiness menolak runtime database, backup, dan log yang ter-track", () => {
  const trackedFiles = [
    "data/.gitkeep",
    "backups/.gitkeep",
    "backups/sqlite/.gitkeep",
    "data/ims.sqlite",
    "data\\ims.sqlite-wal",
    "backups/sqlite/daily/IMS-BF-BACKUP.imsbackup",
    "backups\\sqlite\\daily\\IMS-BF-BACKUP.imsbackup.manifest.json",
    "logs/ims-backend.log",
    "frontend/src/main.jsx",
  ];

  assert.deepEqual(findTrackedRuntimeArtifacts(trackedFiles), [
    "data/ims.sqlite",
    "data\\ims.sqlite-wal",
    "backups/sqlite/daily/IMS-BF-BACKUP.imsbackup",
    "backups\\sqlite\\daily\\IMS-BF-BACKUP.imsbackup.manifest.json",
    "logs/ims-backend.log",
  ]);
});


test("backend test runner memakai discovery otomatis dan lockfile registry publik", () => {
  const backendPackage = JSON.parse(readRootFile("backend/package.json"));
  const backendLock = readRootFile("backend/package-lock.json");
  const frontendLock = readRootFile("frontend/package-lock.json");

  assert.match(backendPackage.scripts.test, /check:runtime/);
  assert.match(backendPackage.scripts.test, /node scripts\/run-tests\.cjs$/);
  assert.doesNotMatch(backendLock, /packages\.applied-caas-gateway/i);
  assert.doesNotMatch(frontendLock, /packages\.applied-caas-gateway/i);
  assert.doesNotMatch(frontendLock, /node_modules\/@ant-design\/charts/);
});

test("git archive mengecualikan seluruh folder runtime data, backups, dan logs", () => {
  const attributes = readRootFile(".gitattributes");

  assert.match(attributes, /^\/data export-ignore$/m);
  assert.match(attributes, /^\/backups export-ignore$/m);
  assert.match(attributes, /^\/logs export-ignore$/m);
});

test("JavaScript source memakai kebijakan LF yang konsisten", () => {
  const attributes = readRootFile(".gitattributes");
  const editorConfig = readRootFile(".editorconfig");

  for (const extension of ["js", "jsx", "cjs", "mjs"]) {
    assert.match(attributes, new RegExp(`^\\*\\.${extension} text eol=lf$`, "m"));
  }

  assert.match(editorConfig, /^root = true$/m);
  assert.match(editorConfig, /^\[\*\.\{js,jsx,cjs,mjs\}\]$/m);
  assert.match(editorConfig, /^end_of_line = lf$/m);

  const ignoredDirectoryNames = new Set([
    ".git",
    "node_modules",
    "dist",
    "build",
    "coverage",
    ".artifacts",
  ]);
  const ignoredRootDirectories = new Set(["data", "backups", "logs"]);
  const supportedExtensions = new Set([".js", ".jsx", ".cjs", ".mjs"]);
  const pendingDirectories = [ROOT_DIR];
  const invalidFiles = [];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();
    for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
      const fullPath = path.join(currentDirectory, entry.name);
      const relativeParts = path.relative(ROOT_DIR, fullPath).split(path.sep);

      if (
        entry.isDirectory()
        && (
          ignoredDirectoryNames.has(entry.name)
          || ignoredRootDirectories.has(relativeParts[0])
        )
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        pendingDirectories.push(fullPath);
        continue;
      }

      if (!entry.isFile() || !supportedExtensions.has(path.extname(entry.name))) continue;
      const buffer = fs.readFileSync(fullPath);
      if (buffer.includes(13)) {
        invalidFiles.push(path.relative(ROOT_DIR, fullPath).replaceAll("\\", "/"));
      }
    }
  }

  assert.deepEqual(invalidFiles.sort(), []);
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
    "Inventory-App/.artifacts/sbom/backend-sbom.cdx.json",
    "Inventory-App/logs/ims-backend.log",
    "Inventory-App\\backend\\package.json",
  ]);

  assert.deepEqual(unsafeEntries, [
    ".artifacts/sbom/backend-sbom.cdx.json",
    "Inventory-App/backend/package.json",
    "backups/sqlite/daily/IMS.imsbackup",
    "data/ims.sqlite-wal",
    "frontend/dist/index.js",
    "logs/ims-backend.log",
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

test("git archive aktual tidak membawa data, backup, dan log runtime", () => {
  const tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), "ims-source-hygiene-"));

  try {
    fs.mkdirSync(path.join(tempRepo, "data"), { recursive: true });
    fs.mkdirSync(path.join(tempRepo, "backups", "sqlite", "daily"), { recursive: true });
    fs.mkdirSync(path.join(tempRepo, "frontend", "src"), { recursive: true });
    fs.mkdirSync(path.join(tempRepo, "logs"), { recursive: true });

    fs.copyFileSync(path.join(ROOT_DIR, ".gitattributes"), path.join(tempRepo, ".gitattributes"));
    fs.writeFileSync(path.join(tempRepo, "data", ".gitkeep"), "");
    fs.writeFileSync(path.join(tempRepo, "data", "ims.sqlite"), "runtime-db");
    fs.writeFileSync(path.join(tempRepo, "backups", ".gitkeep"), "");
    fs.writeFileSync(
      path.join(tempRepo, "backups", "sqlite", "daily", "IMS-TEST.imsbackup"),
      "runtime-backup",
    );
    fs.writeFileSync(path.join(tempRepo, "frontend", "src", "main.jsx"), "export default true;\n");
    fs.writeFileSync(path.join(tempRepo, "logs", "ims-backend.log"), "runtime-log\n");

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
    assert.equal(entries.some((entry) => entry === "logs" || entry.startsWith("logs/")), false);

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

test("core engine tidak kembali diimplementasikan di utils dan internal backend memakai canonical path", () => {
  const facadeFiles = new Set([
    "backend/src/utils/sqliteStockEngine.js",
    "backend/src/utils/sqliteFinanceEngine.js",
    "backend/src/utils/sqliteBackup.js",
    "backend/src/shared/sqliteJsonRecordRoutes.js",
  ]);
  const forbiddenLegacyImports = [
    "utils/sqliteStockEngine",
    "utils/sqliteFinanceEngine",
    "utils/sqliteBackup",
    "shared/sqliteJsonRecordRoutes",
  ];
  const violations = [];

  const backendSourceRoot = path.join(ROOT_DIR, "backend", "src");
  const pending = [backendSourceRoot];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(fullPath);
        continue;
      }
      if (!entry.isFile() || path.extname(entry.name) !== ".js") continue;
      const relativePath = path.relative(ROOT_DIR, fullPath).replaceAll("\\", "/");
      if (facadeFiles.has(relativePath)) continue;
      const source = fs.readFileSync(fullPath, "utf8");
      forbiddenLegacyImports.forEach((legacyImport) => {
        if (source.includes(legacyImport)) violations.push(`${relativePath}: ${legacyImport}`);
      });
    }
  }

  assert.deepEqual(violations, []);

  for (const relativePath of facadeFiles) {
    const source = readRootFile(relativePath);
    const nonBlankLines = source.split(/\r?\n/).filter((line) => line.trim()).length;
    assert.ok(nonBlankLines <= 6, `${relativePath} harus tetap compatibility facade tipis`);
  }
});

test("canonical security dan pricing wrapper tidak kembali menyalin business rule", () => {
  const passwordEsm = readRootFile("shared/passwordPolicy.js");
  const passwordCjs = readRootFile("shared/passwordPolicy.cjs");
  const supplierEsm = readRootFile("shared/supplierCatalogPricing.js");
  const supplierCjs = readRootFile("shared/supplierCatalogPricing.cjs");

  assert.match(passwordEsm, /passwordPolicy\.core\.js/);
  assert.match(passwordCjs, /passwordPolicy\.core\.js/);
  assert.doesNotMatch(passwordEsm, /\.cjs["']/);
  assert.doesNotMatch(passwordEsm, /commonPasswords\.includes/);
  assert.doesNotMatch(passwordCjs, /commonPasswords\.includes/);
  assert.match(supplierEsm, /supplierCatalogPricing\.core\.js/);
  assert.match(supplierCjs, /supplierCatalogPricing\.core\.js/);
  assert.doesNotMatch(supplierEsm, /\.cjs["']/);
  assert.doesNotMatch(supplierEsm, /estimatedShippingCost\s*\+/);
  assert.doesNotMatch(supplierCjs, /estimatedShippingCost\s*\+/);
});

test("frontend production helper tidak mengambil kembali authority commit HPP", () => {
  const helperSource = readRootFile("frontend/src/services/Produksi/helpers/productionWorkLogsServiceHelpers.js");
  [
    "buildOutputHppReconcilePayload",
    "reconcileAverageUnitCost",
    "calculateWeightedVariantUnitCost",
  ].forEach((symbol) => assert.equal(helperSource.includes(symbol), false, `${symbol} tidak boleh kembali`));
});
