<!--
PATCH A-B NOTE — 2026-06-02:
Dokumen ini adalah arsip historis Batch offline database browser arsip. Source aktif sekarang memakai SQLite sidecar lewat backend Node.js lokal/LAN. Jangan mengikuti instruksi runtime database browser arsip, sync queue arsip, conflict resolver, atau backup JSON storage browser arsip dari dokumen arsip ini. Kontrak terbaru ada di docs/10_OFFLINE_DATABASE_CONTRACT.md dan docs/17_SQLITE_OFFLINE_WEB_ROADMAP.md.
-->

# Offline Supplier Flow Audit — Batch 18/19 + Decision Batch 28

Status: **ARSIP HISTORIS / SUPERSEDED BY SQLITE RUNTIME / JANGAN DIPAKAI SEBAGAI INSTRUKSI AKTIF**.

Dokumen ini mencatat hasil audit dan keputusan final Batch 28 untuk supplier sebelum supplier boleh masuk runtime offline DB. Source aktual masih memperlakukan supplier sebagai area guarded karena terhubung ke pembelian, raw material, restock, dan histori transaksi.

## Validasi source aktual

File relevan yang harus dicek sebelum mengubah supplier:

- `src/pages/MasterData/SupplierPurchases.jsx`
- `src/services/MasterData/suppliersService.js`
- `src/services/Transaksi/purchasesService.js`
- `src/services/MasterData/rawMaterialsService.js`
- `src/data/repositories/suppliersRepository.js`
- `src/data/adapters/runtime-arsip/runtime-arsipSuppliersAdapter.js`
- `src/data/adapters/database-browser-arsip/database-browser-arsipSuppliersAdapter.js`

## Keputusan final Batch 28

Pilihan yang disetujui: **Supplier offline read-only snapshot**. Supplier tidak menjadi runtime arsip-only murni karena snapshot dibutuhkan untuk preview/offline foundation, tetapi supplier juga tidak boleh offline write.

- Supplier boleh ada di local DB sebagai read-only snapshot agar backup/restore dan preview local lengkap.
- Supplier boleh dibaca melalui repository pilot untuk audit/dev preview.
- Supplier boleh dipull dari runtime arsip ke local DB sebagai snapshot read-only.
- Offline Database Center wajib menampilkan supplier sebagai read-only snapshot, bukan data write pilot.
- Supplier **belum boleh** masuk `sync queue arsip` atau disync otomatis/manual ke runtime arsip.
- Supplier runtime arsip dan database browser arsip adapter tetap read-only/write blocked sampai flow supplier diekstrak dan diverifikasi.
- Page `SupplierPurchases.jsx` belum boleh dipindahkan ke offline runtime.
- Tidak boleh ada tombol create/edit/delete supplier offline.

## Alasan guard

Supplier bukan master data isolasi. Data supplier dapat dipakai oleh:

- pembelian/purchase history;
- raw material source/restock relation;
- OCR/nota pembelian;
- audit dan laporan pembelian;
- reset/maintenance protected data.

Jika supplier local-only dipakai transaksi runtime arsip sebelum sync benar, transaksi bisa mengarah ke dokumen supplier yang belum ada di runtime arsip.

## Rule wajib sebelum supplier runtime migration

1. Audit semua read/write supplier di page dan service aktual.
2. Pastikan collection aktif benar. Source saat ini memakai konteks `supplierPurchases` untuk supplier purchase master.
3. Jangan membuat collection baru seperti `suppliers` tanpa approval schema/database eksplisit.
4. Jangan mengubah Purchase flow, Raw Materials flow, stock, inventory log, finance, atau reset.
5. Jika ada write supplier dari repository, harus punya guard duplicate code/name dan audit local, lalu butuh approval terpisah sebelum aktif.
6. Manual sync supplier ke runtime arsip hanya boleh setelah kontrak supplier sync disetujui.
7. Mulai Batch 27/28, supplier local hanya boleh berasal dari runtime arsip → Offline pull dan tidak boleh diedit dari offline runtime.

## Test checklist

- [ ] SupplierPurchases masih berjalan normal di runtime arsip mode.
- [ ] Purchases masih bisa memakai supplier existing.
- [ ] Raw Materials tidak kehilangan label supplier/source.
- [ ] `suppliersRepository` tidak dipakai transaksi aktif.
- [ ] Manual runtime arsip → Offline boleh pull supplier sebagai snapshot read-only.
- [ ] Manual Offline → runtime arsip tetap hanya `categories/customers`.
- [ ] Queue supplier local tidak bisa dibuat dan tidak menulis runtime arsip.
- [ ] `suppliersRepository.createSupplier/updateSupplier/deleteSupplier` tetap melempar error pada mode runtime arsip maupun offline.
- [ ] Reset destructive flow tidak berubah.
