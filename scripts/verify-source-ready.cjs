#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { capture } = require("./run-command.cjs");

const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP64_SENTINEL_16 = 0xffff;
const ZIP64_SENTINEL_32 = 0xffffffff;

function fail(message) {
  console.error(`\n[verify] ERROR: ${message}`);
  process.exit(1);
}

function normalizeArchiveEntry(entryName = "") {
  return String(entryName)
    .replace(/\0/g, "")
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/\/{2,}/g, "/");
}

function findTrackedRuntimeArtifacts(trackedFiles = []) {
  return trackedFiles.filter((file) => {
    const normalized = normalizeArchiveEntry(file).trim();
    if (!normalized) return false;
    if (
      normalized.endsWith("/.gitkeep") ||
      normalized === "data/.gitkeep" ||
      normalized === "backups/.gitkeep"
    ) {
      return false;
    }
    return (
      normalized.startsWith("data/")
      || normalized.startsWith("backups/")
      || normalized.startsWith("logs/")
    );
  });
}

function getTrackedRuntimeArtifacts() {
  const trackedFiles = capture("git", ["ls-files"])
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);

  return findTrackedRuntimeArtifacts(trackedFiles);
}

function findZipEndOfCentralDirectory(buffer) {
  const minimumOffset = Math.max(0, buffer.length - 0xffff - 22);

  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === ZIP_EOCD_SIGNATURE) {
      return offset;
    }
  }

  throw new Error("End of central directory ZIP tidak ditemukan.");
}

function listZipEntries(archivePath) {
  const resolvedPath = path.resolve(archivePath);
  const buffer = fs.readFileSync(resolvedPath);

  if (buffer.length < 22) {
    throw new Error("File terlalu kecil untuk menjadi ZIP yang valid.");
  }

  const eocdOffset = findZipEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (
    entryCount === ZIP64_SENTINEL_16 ||
    centralDirectorySize === ZIP64_SENTINEL_32 ||
    centralDirectoryOffset === ZIP64_SENTINEL_32
  ) {
    throw new Error("ZIP64 belum didukung oleh verifier source IMS.");
  }

  if (centralDirectoryOffset + centralDirectorySize > buffer.length) {
    throw new Error("Central directory ZIP berada di luar ukuran file.");
  }

  const entries = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > buffer.length) {
      throw new Error("Header central directory ZIP terpotong.");
    }

    if (buffer.readUInt32LE(offset) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error(`Signature central directory ZIP tidak valid pada entry ${index + 1}.`);
    }

    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;

    if (fileNameEnd > buffer.length) {
      throw new Error(`Nama entry ZIP terpotong pada entry ${index + 1}.`);
    }

    entries.push(buffer.subarray(fileNameStart, fileNameEnd).toString("utf8"));
    offset = fileNameEnd + extraLength + commentLength;
  }

  return entries;
}

function getArchiveRelativeEntries(rawEntries = []) {
  const normalizedEntries = rawEntries
    .map(normalizeArchiveEntry)
    .filter(Boolean);
  const fileEntries = normalizedEntries.filter((entry) => !entry.endsWith("/"));
  const firstSegment = fileEntries[0]?.split("/")[0] || "";
  const hasCommonPrefix = Boolean(firstSegment) && normalizedEntries.every(
    (entry) => entry === `${firstSegment}/` || entry.startsWith(`${firstSegment}/`),
  );
  const prefix = hasCommonPrefix ? firstSegment : "";
  const relativeEntries = normalizedEntries
    .map((entry) => (prefix ? entry.slice(prefix.length + 1) : entry))
    .filter(Boolean);

  return { prefix, relativeEntries };
}

function findUnsafeArchiveEntries(rawEntries = []) {
  const backslashEntries = rawEntries.filter((entry) => String(entry).includes("\\"));
  const { relativeEntries } = getArchiveRelativeEntries(rawEntries);
  const unsafeEntries = relativeEntries.filter((entry) => {
    const normalized = entry.replace(/\/$/, "");
    if (!normalized) return false;

    if (
      normalized.startsWith("/") ||
      normalized === ".." ||
      normalized.startsWith("../") ||
      normalized.includes("/../") ||
      /^[A-Za-z]:\//.test(normalized)
    ) {
      return true;
    }

    if (
      normalized === "data" ||
      normalized.startsWith("data/") ||
      normalized === "backups" ||
      normalized.startsWith("backups/") ||
      normalized === "logs" ||
      normalized.startsWith("logs/")
    ) {
      return true;
    }

    const segments = normalized.split("/");
    if (
      segments.some((segment) => [
        ".git",
        "node_modules",
        "dist",
        "build",
        "coverage",
        ".artifacts",
        ".cache",
        ".vite",
      ].includes(segment))
    ) {
      return true;
    }

    if (/^_IMS_(?:DELETE_FILES|PATCH_INFO)\.txt$/i.test(normalized)) {
      return true;
    }

    return /(?:\.(?:sqlite(?:-wal|-shm)?|imsbackup(?:\.manifest\.json)?|bak|tmp)|\.imsbak\.zip)$/i.test(normalized);
  });

  return [...new Set([
    ...backslashEntries.map(normalizeArchiveEntry),
    ...unsafeEntries,
  ])].sort();
}

function formatEntryList(entries = [], limit = 25) {
  const visibleEntries = entries.slice(0, limit);
  const remainingCount = entries.length - visibleEntries.length;
  const lines = visibleEntries.map((entry) => `  - ${entry}`);

  if (remainingCount > 0) {
    lines.push(`  - ... dan ${remainingCount} entry lainnya`);
  }

  return lines.join("\n");
}

function verifySourceArchive(archivePath, options = {}) {
  const resolvedPath = path.resolve(archivePath || "");
  const log = options.log || console.log;

  if (!archivePath) {
    throw new Error("Path ZIP wajib diberikan.");
  }

  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
    throw new Error(`File ZIP tidak ditemukan: ${resolvedPath}`);
  }

  const rawEntries = listZipEntries(resolvedPath);
  const { prefix, relativeEntries } = getArchiveRelativeEntries(rawEntries);
  const unsafeEntries = findUnsafeArchiveEntries(rawEntries);
  const duplicateEntries = relativeEntries.filter(
    (entry, index) => relativeEntries.indexOf(entry) !== index,
  );
  const requiredEntries = [
    ".gitattributes",
    "package.json",
    "backend/package.json",
    "frontend/package.json",
  ];
  const missingRequiredEntries = requiredEntries.filter(
    (requiredEntry) => !relativeEntries.includes(requiredEntry),
  );

  if (unsafeEntries.length > 0) {
    throw new Error(
      `ZIP membawa runtime/generated artifact atau path tidak portabel (${unsafeEntries.length} entry):\n${formatEntryList(unsafeEntries)}`,
    );
  }

  if (duplicateEntries.length > 0) {
    throw new Error(
      `ZIP membawa entry duplikat:\n${formatEntryList([...new Set(duplicateEntries)])}`,
    );
  }

  if (missingRequiredEntries.length > 0) {
    throw new Error(
      `Struktur source ZIP tidak lengkap. Entry wajib tidak ditemukan:\n${formatEntryList(missingRequiredEntries)}`,
    );
  }

  log("[verify] Source ZIP artifact");
  log(`[verify] File    : ${resolvedPath}`);
  log(`[verify] Prefix  : ${prefix || "(tanpa prefix)"}`);
  log(`[verify] Entries : ${relativeEntries.length}`);
  log("[verify] Runtime/generated artifact tidak ditemukan di ZIP.");

  return {
    archivePath: resolvedPath,
    entryCount: relativeEntries.length,
    prefix,
    relativeEntries,
  };
}

function verifyRepositoryReady({ allowDirty = false } = {}) {
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
          "atau pakai npm run git:push -- \"pesan commit\" agar perubahan ikut ter-push.",
      );
    }
  } else {
    console.log("[verify] Working tree bersih.");
  }

  const trackedRuntimeArtifacts = getTrackedRuntimeArtifacts();
  if (trackedRuntimeArtifacts.length > 0) {
    console.log("\n[verify] Runtime data/backup masih ter-track:");
    trackedRuntimeArtifacts.forEach((file) => console.log(`  - ${file}`));
    fail(
      "Runtime database atau backup tidak boleh ter-track. Gunakan git rm --cached pada file tersebut; " +
        "jangan hapus backup lokal yang masih dibutuhkan.",
    );
  }
  console.log("[verify] Runtime data/backup tidak ter-track.");

  if (!upstream) {
    console.log("[verify] Catatan: upstream belum diset. Push pertama akan perlu -u origin <branch>.");
  }
}

function main() {
  const args = process.argv.slice(2);
  const archiveOnlyIndex = args.indexOf("--archive-only");

  if (archiveOnlyIndex >= 0) {
    const archivePath = args[archiveOnlyIndex + 1];
    try {
      verifySourceArchive(archivePath);
    } catch (error) {
      fail(error.message);
    }
    return;
  }

  verifyRepositoryReady({ allowDirty: args.includes("--allow-dirty") });
}

if (require.main === module) {
  main();
}

module.exports = {
  findTrackedRuntimeArtifacts,
  findUnsafeArchiveEntries,
  getArchiveRelativeEntries,
  getTrackedRuntimeArtifacts,
  listZipEntries,
  normalizeArchiveEntry,
  verifyRepositoryReady,
  verifySourceArchive,
  main,
};
