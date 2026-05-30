# Offline Supplier Flow Audit — Batch 18/19

Status: **AUDIT / GUARDED / TIDAK MIGRASI RUNTIME**

Dokumen ini mencatat hasil audit supplier sebelum supplier boleh masuk runtime offline DB. Source aktual masih memperlakukan supplier sebagai area guarded karena terhubung ke pembelian, raw material, restock, dan histori transaksi.

## Validasi source aktual

File relevan yang harus dicek sebelum mengubah supplier:

- `src/pages/MasterData/SupplierPurchases.jsx`
- `src/services/MasterData/suppliersService.js`
- `src/services/Transaksi/purchasesService.js`
- `src/services/MasterData/rawMaterialsService.js`
- `src/data/repositories/suppliersRepository.js`
- `src/data/adapters/firebase/firebaseSuppliersAdapter.js`
- `src/data/adapters/dexie/dexieSuppliersAdapter.js`

## Keputusan batch

- Supplier boleh ada di local DB foundation agar backup/restore dan queue contract lengkap.
- Supplier boleh dibaca melalui repository pilot untuk audit/dev preview.
- Supplier **belum boleh** disync otomatis/manual ke Firebase.
- Supplier Firebase adapter tetap read-only/write blocked sampai flow supplier diekstrak dan diverifikasi.
- Page `SupplierPurchases.jsx` belum boleh dipindahkan ke offline runtime.

## Alasan guard

Supplier bukan master data isolasi. Data supplier dapat dipakai oleh:

- pembelian/purchase history;
- raw material source/restock relation;
- OCR/nota pembelian;
- audit dan laporan pembelian;
- reset/maintenance protected data.

Jika supplier local-only dipakai transaksi Firebase sebelum sync benar, transaksi bisa mengarah ke dokumen supplier yang belum ada di Firebase.

## Rule wajib sebelum supplier runtime migration

1. Audit semua read/write supplier di page dan service aktual.
2. Pastikan collection aktif benar. Source saat ini memakai konteks `supplierPurchases` untuk supplier purchase master.
3. Jangan membuat collection baru seperti `suppliers` tanpa approval schema/database eksplisit.
4. Jangan mengubah Purchase flow, Raw Materials flow, stock, inventory log, finance, atau reset.
5. Jika ada write supplier dari repository, harus punya guard duplicate code/name dan audit local.
6. Manual sync supplier ke Firebase hanya boleh setelah kontrak supplier sync disetujui.

## Test checklist

- [ ] SupplierPurchases masih berjalan normal di Firebase mode.
- [ ] Purchases masih bisa memakai supplier existing.
- [ ] Raw Materials tidak kehilangan label supplier/source.
- [ ] `suppliersRepository` tidak dipakai transaksi aktif.
- [ ] Manual Firebase sync tetap hanya `categories/customers`.
- [ ] Queue supplier local tidak menulis Firebase.
- [ ] Reset destructive flow tidak berubah.
