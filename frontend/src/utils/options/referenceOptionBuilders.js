const safeTrim = (value) => String(value || '').trim();

export const buildReferenceLabel = (item = {}) => {
  /*
  =====================================================
  SECTION: Reference option label display — AKTIF
  Fungsi:
  - Menampilkan nama operasional pada dropdown referensi master/config tanpa kode internal.

  Dipakai oleh:
  - Select reference helper produksi yang memakai buildReferenceOptions.

  Alasan perubahan:
  - Kode PRD/RAW/SFP/BOM/STP dipakai sebagai ID/backstage; user memilih dari nama dan konteks varian.

  Catatan cleanup:
  - Fallback label dipertahankan untuk data lama yang belum lengkap namanya.

  Risiko:
  - Value option tetap item.id; label ini hanya presentasi dan tidak boleh dipakai sebagai relasi Firestore.
  =====================================================
  */
  return (
    safeTrim(item.label) ||
    safeTrim(item.name) ||
    safeTrim(item.itemName) ||
    safeTrim(item.productName) ||
    safeTrim(item.title) ||
    '-'
  );
};

export const buildReferenceOptions = (items = []) =>
  (items || []).map((item) => ({
    value: item.id,
    label: buildReferenceLabel(item),
    raw: item,
  }));
