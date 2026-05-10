import { resolveDisplayReference } from "../references/displayReferenceResolver";

const safeTrim = (value) => String(value || '').trim();

export const buildReferenceLabel = (item = {}) => {
  /*
  =====================================================
  SECTION: Reference option label display — AKTIF / LEGACY-COMPAT
  Fungsi:
  - Menampilkan label option memakai kode manusiawi jika tersedia.

  Dipakai oleh:
  - Select reference master data dan helper produksi yang memakai buildReferenceOptions.

  Alasan perubahan:
  - Dropdown tidak boleh mengutamakan Firestore ID ketika record sudah punya kode bisnis.

  Catatan cleanup:
  - Fallback nama tetap dipertahankan untuk master data lama yang belum punya kode.

  Risiko:
  - Resolver ini hanya untuk label display, bukan value relasi. Value option tetap item.id.
  =====================================================
  */
  const code = resolveDisplayReference(item, { fallback: "" });
  const name =
    safeTrim(item.name) ||
    safeTrim(item.itemName) ||
    safeTrim(item.productName) ||
    safeTrim(item.title);

  return code ? `${code} - ${name || '-'}` : name || '-';
};

export const buildReferenceOptions = (items = []) =>
  (items || []).map((item) => ({
    value: item.id,
    label: buildReferenceLabel(item),
    raw: item,
  }));
