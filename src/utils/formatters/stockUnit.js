import { formatNumberId } from "./numberId";

/* =====================================================
SECTION: Stock With Unit Formatter — AKTIF
Fungsi:
- Menyatukan tampilan jumlah stok dan satuan untuk halaman master/read-only display.

Dipakai oleh:
- Products.jsx, RawMaterials.jsx, SemiFinishedMaterials.jsx, dan StockDisplayBlock.jsx.

Alasan perubahan:
- Mengganti helper lokal yang sama agar format stok + unit konsisten tanpa menyentuh kalkulasi stok.

Catatan cleanup:
- Belum ada. Jangan pakai helper ini untuk mutasi stok atau parsing input.

Risiko:
- Jika logic ini diubah sembarangan, tampilan stok lintas halaman master bisa tidak konsisten.
===================================================== */
export const formatStockWithUnitId = (value, unit = "pcs") => `${formatNumberId(value)} ${unit}`;

export default formatStockWithUnitId;
