import {
  buildReadableBusinessCode,
  buildReadableCodeParts,
  generateUniqueReadableCode,
  isBusinessCodeExists,
} from "./businessCodeGenerator";

/* =====================================================
SECTION: Production code generator compatibility wrapper — LEGACY-COMPAT
Fungsi:
- Menjaga import lama productionCodeGenerator tetap berjalan.
- Mendelegasikan semua algoritma readable dan collision check ke businessCodeGenerator sebagai source of truth.

Dipakai oleh:
- semiFinishedMaterialsService.js
- productionBomsService.js
- productionStepsService.js

Alasan perubahan:
- Standar IMS melarang generator/dictionary duplikat lintas modul produksi.

Catatan cleanup:
- Import service produksi bisa dipindah langsung ke businessCodeGenerator setelah validasi regresi.

Risiko:
- Menambah logic baru di wrapper ini akan membuat standar kode produksi kembali bercabang.
===================================================== */
export const buildProductionReadableCodeParts = (text = "", options = {}) =>
  buildReadableCodeParts(text, options);

export const buildProductionReadableCode = (options = {}) =>
  buildReadableBusinessCode(options);

export const isProductionBusinessCodeExists = (options = {}) =>
  isBusinessCodeExists(options);

export const generateUniqueProductionReadableCode = (options = {}) =>
  generateUniqueReadableCode(options);
