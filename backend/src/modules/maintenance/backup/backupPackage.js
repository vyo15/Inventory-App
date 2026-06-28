const fs = require("fs");
const crypto = require("crypto");
const zlib = require("zlib");
const {
  ZIP_COMPRESSION_DEFLATE,
  ZIP_COMPRESSION_STORE,
  ZIP32_MAX_ENTRIES,
  ZIP32_MAX_ENTRY_BYTES,
} = require("./backupConstants");

const crcTable = (() => {
  const table = new Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const sha256File = (filePath) => new Promise((resolve, reject) => {
  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream(filePath);
  stream.on("data", (chunk) => hash.update(chunk));
  stream.on("error", reject);
  stream.on("end", () => resolve(hash.digest("hex")));
});

const getDosDateTime = (date = new Date()) => {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
};

const assertZip32EntrySize = (sizeBytes, entryName = "entry") => {
  const normalizedSize = Number(sizeBytes);
  if (!Number.isSafeInteger(normalizedSize) || normalizedSize < 0) {
    throw new Error(`Ukuran ${entryName} tidak valid.`);
  }
  if (normalizedSize > ZIP32_MAX_ENTRY_BYTES) {
    const error = new Error(
      `Ukuran ${entryName} melebihi batas format backup ZIP klasik. `
      + "ZIP64 belum didukung; gunakan database di bawah 4 GB per entry.",
    );
    error.code = "BACKUP_ZIP64_REQUIRED";
    throw error;
  }
  return normalizedSize;
};

const assertBufferRange = (buffer, start, length, label) => {
  if (!Number.isInteger(start) || !Number.isInteger(length) || start < 0 || length < 0 || start + length > buffer.length) {
    throw new Error(`Format backup tidak valid: batas ${label} berada di luar file.`);
  }
};

const getZipEntryBuffers = (entry, compressionMethod) => {
  const dataBuffer = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data || ""), "utf8");
  assertZip32EntrySize(dataBuffer.length, entry.name || "entry");
  const compressedBuffer = compressionMethod === ZIP_COMPRESSION_DEFLATE
    ? zlib.deflateRawSync(dataBuffer, { level: 9 })
    : dataBuffer;
  assertZip32EntrySize(compressedBuffer.length, `${entry.name || "entry"} terkompresi`);

  return {
    dataBuffer,
    compressedBuffer,
    crc: crc32(dataBuffer),
    uncompressedSize: dataBuffer.length,
    compressedSize: compressedBuffer.length,
  };
};

const createBackupPackage = (entries, outputPath, options = {}) => {
  const compressionMethod = options.compressionMethod ?? ZIP_COMPRESSION_DEFLATE;
  if (![ZIP_COMPRESSION_STORE, ZIP_COMPRESSION_DEFLATE].includes(compressionMethod)) {
    throw new Error("Metode kompresi backup tidak didukung.");
  }
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > ZIP32_MAX_ENTRIES) {
    throw new Error("Jumlah entry paket backup tidak valid atau membutuhkan ZIP64.");
  }

  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosTime, dosDate } = getDosDateTime();

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, "utf8");
    if (nameBuffer.length > ZIP32_MAX_ENTRIES) {
      throw new Error("Nama entry paket backup terlalu panjang.");
    }
    const { compressedBuffer, crc, uncompressedSize, compressedSize } = getZipEntryBuffers(entry, compressionMethod);
    assertZip32EntrySize(offset, "offset paket backup");

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(compressionMethod, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuffer, compressedBuffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(compressionMethod, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressedSize, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + compressedBuffer.length;
    assertZip32EntrySize(offset, "ukuran paket backup");
  }

  const centralOffset = offset;
  const centralBuffer = Buffer.concat(centralParts);
  assertZip32EntrySize(centralBuffer.length, "central directory paket backup");
  assertZip32EntrySize(centralOffset, "offset central directory paket backup");
  const endHeader = Buffer.alloc(22);
  endHeader.writeUInt32LE(0x06054b50, 0);
  endHeader.writeUInt16LE(0, 4);
  endHeader.writeUInt16LE(0, 6);
  endHeader.writeUInt16LE(entries.length, 8);
  endHeader.writeUInt16LE(entries.length, 10);
  endHeader.writeUInt32LE(centralBuffer.length, 12);
  endHeader.writeUInt32LE(centralOffset, 16);
  endHeader.writeUInt16LE(0, 20);

  fs.writeFileSync(outputPath, Buffer.concat([...localParts, centralBuffer, endHeader]));
};

const readBackupPackageEntry = (zipPath, targetName) => {
  const packageSize = fs.statSync(zipPath).size;
  assertZip32EntrySize(packageSize, "paket backup");
  const buffer = fs.readFileSync(zipPath);
  if (buffer.length < 22) throw new Error("Format backup tidak valid: package terlalu kecil.");
  const minEndOffset = Math.max(0, buffer.length - 22 - 65535);
  let endOffset = -1;
  for (let index = buffer.length - 22; index >= minEndOffset; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      endOffset = index;
      break;
    }
  }
  if (endOffset < 0) throw new Error("Format backup tidak valid: EOCD package tidak ditemukan.");

  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralSize = buffer.readUInt32LE(endOffset + 12);
  const centralOffset = buffer.readUInt32LE(endOffset + 16);
  if (entryCount === ZIP32_MAX_ENTRIES || centralSize === ZIP32_MAX_ENTRY_BYTES || centralOffset === ZIP32_MAX_ENTRY_BYTES) {
    const error = new Error("Format backup ZIP64 belum didukung oleh IMS.");
    error.code = "BACKUP_ZIP64_UNSUPPORTED";
    throw error;
  }
  assertBufferRange(buffer, centralOffset, centralSize, "central directory");
  if (centralOffset + centralSize > endOffset) {
    throw new Error("Format backup tidak valid: central directory bertabrakan dengan EOCD.");
  }
  let pointer = centralOffset;
  const centralEnd = centralOffset + centralSize;

  for (let i = 0; i < entryCount; i += 1) {
    assertBufferRange(buffer, pointer, 46, "central header");
    if (pointer + 46 > centralEnd) throw new Error("Format backup tidak valid: central directory terpotong.");
    if (buffer.readUInt32LE(pointer) !== 0x02014b50) throw new Error("Format backup tidak valid: central directory rusak.");
    const compression = buffer.readUInt16LE(pointer + 10);
    const expectedCrc = buffer.readUInt32LE(pointer + 16);
    const compressedSize = buffer.readUInt32LE(pointer + 20);
    const uncompressedSize = buffer.readUInt32LE(pointer + 24);
    const fileNameLength = buffer.readUInt16LE(pointer + 28);
    const extraLength = buffer.readUInt16LE(pointer + 30);
    const commentLength = buffer.readUInt16LE(pointer + 32);
    const localOffset = buffer.readUInt32LE(pointer + 42);
    const centralEntryLength = 46 + fileNameLength + extraLength + commentLength;
    assertBufferRange(buffer, pointer, centralEntryLength, "central entry");
    if (pointer + centralEntryLength > centralEnd) throw new Error("Format backup tidak valid: central entry melewati directory.");
    const entryName = buffer.slice(pointer + 46, pointer + 46 + fileNameLength).toString("utf8");

    if (entryName === targetName) {
      if (![ZIP_COMPRESSION_STORE, ZIP_COMPRESSION_DEFLATE].includes(compression)) {
        throw new Error("Format backup tidak didukung: metode kompresi package belum didukung.");
      }
      assertBufferRange(buffer, localOffset, 30, "local header");
      if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("Format backup tidak valid: local header rusak.");
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      assertBufferRange(buffer, dataOffset, compressedSize, "data entry");
      const compressedBuffer = buffer.slice(dataOffset, dataOffset + compressedSize);
      const dataBuffer = compression === ZIP_COMPRESSION_DEFLATE
        ? zlib.inflateRawSync(compressedBuffer)
        : compressedBuffer;

      if (dataBuffer.length !== uncompressedSize) {
        throw new Error("Format backup tidak valid: ukuran entry tidak sesuai.");
      }
      if (crc32(dataBuffer) !== expectedCrc) {
        throw new Error("Format backup tidak valid: CRC entry tidak sesuai.");
      }
      return dataBuffer;
    }

    pointer += centralEntryLength;
  }

  return null;
};

const buildReadme = (manifest) => [
  "Backup IMS Bunga Flanel",
  "",
  `Tanggal backup: ${manifest.createdAt}`,
  `Jenis backup: ${manifest.backupType}`,
  `Schema version: ${manifest.schemaVersion}`,
  `Format backup: ${manifest.backupFormat} v${manifest.backupFormatVersion}`,
  `Kompresi: ${manifest.compression || "deflate"}`,
  "",
  "Restore hanya boleh dilakukan lewat UI resmi IMS.",
  "Jangan copy file database langsung ke folder data saat aplikasi aktif.",
  "Sebelum restore, aplikasi akan membuat pre-restore backup otomatis.",
  "Pembuatan backup memeriksa ruang kosong sebelum snapshot dan packaging.",
  "Batas format: paket memakai ZIP klasik tanpa ZIP64; satu entry database harus di bawah 4 GB.",
  "",
].join("\n");

module.exports = {
  assertZip32EntrySize,
  buildReadme,
  createBackupPackage,
  readBackupPackageEntry,
  sha256File,
};
