import {
  generateUniqueSequentialCode,
  isBusinessCodeExists,
  prepareSequentialCodeInTransaction,
} from "./businessCodeGenerator";

/* =====================================================
SECTION: Production code generator compatibility wrapper — COMPATIBILITY
Fungsi:
- Menjaga import lama productionCodeGenerator tetap berjalan.
- Mendelegasikan algoritma kode internal sequence dan collision check ke businessCodeGenerator sebagai source of truth.

Dipakai oleh:
- semiFinishedMaterialsService.js
- productionBomsService.js

Alasan perubahan:
- Standar IMS melarang generator/dictionary duplikat lintas modul produksi.

Catatan cleanup:
- Generator readable lama sudah dihapus dari flow aktif; data historis tetap dibaca sebagai data biasa.

Risiko:
- Menambah logic baru di wrapper ini akan membuat standar kode produksi kembali bercabang.
===================================================== */
export const isProductionBusinessCodeExists = (options = {}) =>
  isBusinessCodeExists(options);

export const generateUniqueProductionSequentialCode = (options = {}) =>
  generateUniqueSequentialCode(options);

export const prepareUniqueProductionSequentialCodeInTransaction = (options = {}) =>
  prepareSequentialCodeInTransaction(options);
