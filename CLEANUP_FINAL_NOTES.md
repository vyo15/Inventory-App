# Cleanup Final Notes

Perapihan yang sudah dilakukan:

- Source of truth stok aktif dipusatkan ke `currentStock`.
- Field `stock` hanya dipertahankan sebagai mirror compatibility saat payload disimpan.
- Wrapper lama `src/utils/stockService.js` dihapus.
- Service legacy `src/services/Produksi/productionService.js` dihapus.
- Raw Materials form/service dipindahkan ke `currentStock` sebagai field stok aktif.
- Produk dan helper varian tidak lagi membaca fallback `stock` lama.
- Flow produksi dirapikan:
  - tidak ada reserve/release di UI utama PO
  - `Mulai Produksi` dari PO langsung membuat 1 work log
  - stok bahan dikurangi saat mulai produksi
  - complete work log hanya menambah output dan menutup PO
- Work Log difokuskan ke source `production_order`.
- `npm run build` berhasil setelah cleanup.

Catatan operasional:
- Project zip final ini disiapkan tanpa `.git` dan tanpa `node_modules` agar lebih ringan.
- Jalankan `npm install` lalu `npm run dev` atau `npm run build` di lokal.
