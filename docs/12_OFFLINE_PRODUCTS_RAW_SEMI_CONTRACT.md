# Offline Products / Raw Materials / Semi Finished Contract — Batch 20

Status: **CONTRACT / AUDIT ONLY / BELUM RUNTIME MIGRATION**

Produk, raw material, dan semi finished adalah area master data yang terhubung langsung ke stok, pembelian, produksi, HPP, payroll, dan histori transaksi. Karena itu Batch 20 hanya membuat kontrak dan batasan. Tidak ada runtime migration untuk area ini.

## Area source yang wajib divalidasi sebelum patch lanjutan

- `src/pages/MasterData/Products.jsx`
- `src/pages/MasterData/RawMaterials.jsx`
- `src/pages/Produksi/SemiFinishedMaterials.jsx`
- `src/services/MasterData/productsService.js`
- `src/services/MasterData/rawMaterialsService.js`
- `src/services/Produksi/semiFinishedMaterialsService.js`
- `src/services/Produksi/productionWorkLogsService.js`
- `src/services/Transaksi/purchasesService.js`
- stock/read model/audit services yang melakukan mutasi stok.

## Keputusan batch

- Products, Raw Materials, dan Semi Finished **belum masuk** `LOCAL_SYNC_COLLECTIONS`.
- Tidak ada adapter Dexie/Firebase runtime untuk area ini pada Batch 20.
- Tidak ada page aktif yang dipindahkan ke offline DB.
- Tidak ada sync ke Firebase untuk area ini.
- Tidak ada perubahan schema Firestore atau IndexedDB untuk item stock/production.

## Alasan guard

Area ini mempengaruhi:

- `currentStock`, `reservedStock`, `availableStock`;
- `inventory_logs`;
- purchases/expenses;
- sales/returns stock mutation;
- production BOM/work log/output stock;
- payroll/HPP calculation;
- dashboard dan report.

Perubahan offline runtime tanpa kontrak stok bisa menyebabkan selisih stock, transaksi tidak sinkron, HPP salah, atau audit history putus.

## Syarat sebelum boleh masuk pilot

1. Pisahkan read-only reference data dari data stock mutable.
2. Tentukan identity/reference code yang tidak menampilkan Firestore random ID.
3. Tentukan conflict policy untuk product/raw/semi yang sudah dipakai transaksi.
4. Tentukan policy rename/delete: default harus blocked atau tombstone, bukan hard delete.
5. Pastikan semua report dan transaction snapshot tetap stabil.
6. Buat test khusus untuk purchase stock-in, sales stock-out, return, production output, payroll, dan HPP.

## Explicit blocked scope

- Stock mutation offline.
- Purchase runtime offline.
- Sales transaction runtime offline.
- Production Work Log runtime offline.
- Payroll/HPP runtime offline.
- Auto-sync Firebase.
- Destructive reset/migration.
- Firestore collection/schema baru tanpa approval.

## Test checklist saat audit lanjutan

- [ ] Produk/raw/semi existing tetap tampil normal.
- [ ] Tidak ada local DB write untuk produk/raw/semi dari page aktif.
- [ ] Tidak ada sync queue untuk produk/raw/semi.
- [ ] Stock Management dan Dashboard tidak berubah karena Batch 20.
- [ ] Purchase/Sales/Production/Payroll/HPP tidak berubah.
- [ ] Docs dan source tetap menyebut area ini sebagai guarded.
