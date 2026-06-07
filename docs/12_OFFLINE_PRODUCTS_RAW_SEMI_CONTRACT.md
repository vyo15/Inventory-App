<!--
PATCH A-B NOTE — 2026-06-02:
Dokumen ini adalah arsip historis Batch offline database browser lama. Source aktif sekarang memakai SQLite sidecar lewat backend Node.js lokal/LAN. Jangan mengikuti instruksi runtime database browser lama, sync queue lama, conflict resolver, atau backup JSON storage browser lama dari dokumen arsip ini. Kontrak terbaru ada di docs/10_OFFLINE_DATABASE_CONTRACT.md dan docs/17_SQLITE_OFFLINE_WEB_ROADMAP.md.
-->

# Offline Product / Raw Material / Semi Finished Contract — Batch 29–30

Status: **ARSIP HISTORIS / SUPERSEDED BY SQLITE RUNTIME / JANGAN DIPAKAI SEBAGAI INSTRUKSI AKTIF**.

Dokumen ini menggantikan kontrak Batch 20 yang masih audit-only. Batch 29 memetakan kontrak field dari source aktual, sedangkan Batch 30 hanya mengizinkan **runtime lama ke local pull read-only** untuk Product, Raw Material, dan Semi Finished. Tidak ada edit local, tidak ada stock mutation, tidak ada purchase/production mutation, dan tidak ada HPP recalculation dari data local.

## Validasi source aktual

ZIP yang divalidasi: `Inventory-App-clean.zip`.

File source yang dicek:

- `src/services/MasterData/productsService.js`
- `src/services/MasterData/rawMaterialsService.js`
- `src/services/Produksi/semiFinishedMaterialsService.js`
- `src/constants/variantOptions.js`
- `src/constants/semiFinishedMaterialOptions.js`
- `src/services/Produksi/productionWorkLogsService.js`
- `src/services/Transaksi/purchasesService.js`
- `src/pages/Produksi/ProductionBoms.jsx`
- `src/pages/Produksi/ProductionWorkLogs.jsx`
- `src/pages/Transaksi/Purchases.jsx`
- `src/data/local/localDbSchema.js`
- `src/data/sync/runtime-lamaToLocalMasterDataSyncService.js`
- `src/data/sync/runtime-lamaMasterDataSyncService.js`
- `src/pages/Utilities/components/OfflineDatabaseCenter.jsx`

File relevan yang tidak ditemukan pada ZIP ini:

- `src/services/Produksi/productionService.js`
- `src/pages/Inventory/StockAdjustment.jsx`

Batasan validasi:

- Audit ini static source audit, bukan dump database runtime.
- rules database lama/index tetap harus dicek manual di runtime lama Console.
- Snapshot local tidak membuktikan data lama sudah bersih; data lama shape tetap harus diasumsikan ada.

## Keputusan Batch 29–30

| Area | Keputusan |
|---|---|
| Product | Boleh pull runtime lama ke local sebagai snapshot read-only. |
| Raw Material | Boleh pull runtime lama ke local sebagai snapshot read-only. |
| Semi Finished | Boleh pull runtime lama ke local sebagai snapshot read-only. |
| Offline write | Tetap blocked. Tidak ada create/edit/delete offline. |
| `sync queue lama` | Tetap hanya `categories` dan `customers`. Product/raw/semi tidak masuk queue. |
| Offline → runtime lama | Tetap hanya `categories` dan `customers`. Product/raw/semi diblokir. |
| Runtime page | `Products`, `RawMaterials`, `SemiFinishedMaterials`, `Purchases`, `ProductionBoms`, dan `ProductionWorkLogs` tetap runtime lama/service aktif. |
| Stock/HPP | Tidak dihitung ulang dari storage browser lama local. |

## Kontrak field Product

Source utama: `src/services/MasterData/productsService.js`.

| Field | Status | Catatan |
|---|---|---|
| `id` | identity | Data baru memakai document ID = kode `PRD-xxx`; data lama random ID tetap data-lama-compatible. |
| `code`, `productCode` | identity internal | Service auto-generate dan menjaga immutable saat update. UI utama tidak boleh bergantung pada input manual. |
| `name` | wajib | Duplicate name dicek di service. |
| `categoryId`, `category` | metadata | `category` disnapshot dari selected category, fallback `Produk Jadi`. |
| `price`, `hppPerUnit` | finance/valuation | Tidak boleh negatif; HPP product output bisa dipengaruhi flow produksi, bukan snapshot local. |
| `pricingMode`, `pricingRuleId`, `lastPricingUpdatedAt` | pricing | Mode default manual. Rule wajib hanya saat mode `rule`. |
| `description`, `isActive` | metadata | `isActive` default true kecuali false eksplisit. |
| `hasVariants`, `variantLabel`, `variants`, `archivedVariants`, `variantModeHistory` | variant | Variant aktif dihitung lewat helper; archive/history dipertahankan untuk guard data lama. |
| `currentStock`, `stock`, `reservedStock`, `availableStock` | stock guarded | `stock` masih alias lama `currentStock`. Tidak boleh diubah dari offline snapshot. |
| `minStockAlert` | alert master | Threshold master, bukan agregat variant. |
| `variantCount`, `activeVariantCount` | derived | Hasil perhitungan helper, bukan field input utama. |
| `createdAt`, `updatedAt` | audit timestamp | runtime lama timestamp; saat snapshot local disimpan sebagai data remote apa adanya. |

Guard penting Product:

- Create/update memakai transaction dan menyentuh `stock_item_read_models`.
- Rename/edit metadata tidak boleh menimpa stock hasil transaksi lain.
- Variant dengan stock/reserved tidak boleh hilang diam-diam.
- Karena terkait Sales, Return, Stock Report, Dashboard, dan HPP, Product belum boleh offline write.

## Kontrak field Raw Material

Source utama: `src/services/MasterData/rawMaterialsService.js`.

| Field | Status | Catatan |
|---|---|---|
| `id` | identity | Data baru memakai document ID = kode `RAW-xxx`; data lama `RM`/random ID tetap data-lama-compatible. |
| `code`, `materialCode` | identity internal | Auto-generated, immutable saat update. |
| `name` | wajib | Duplicate name dicek di service. |
| `supplierId`, `supplierName`, `supplierLink` | supplier snapshot | Di-resolve dari supplier aktif lewat helper supplier. Inilah alasan supplier tidak boleh offline write dulu. |
| `stockUnit` | unit | Wajib; default `pcs`. Dipakai purchase dan production usage. |
| `stock`, `currentStock`, `reservedStock`, `availableStock` | stock guarded | `stock` alias lama `currentStock`. Tidak boleh dimutasi dari snapshot local. |
| `minStock` | alert master | Tidak boleh negatif. |
| `restockReferencePrice`, `averageActualUnitCost`, `sellingPrice` | cost/pricing | Terkait purchase/restock/HPP. Tidak boleh dihitung ulang dari local snapshot. |
| `pricingMode`, `pricingRuleId`, `lastPricingUpdatedAt` | pricing | Default manual. Rule wajib hanya saat mode `rule`. |
| `hasVariants`, `hasVariantOptions`, `variantLabel`, `variants`, `variantOptions`, `archivedVariants`, `variantModeHistory` | variant | `variantOptions` dipertahankan sebagai alias lama. |
| `variantCount`, `activeVariantCount` | derived | Diambil dari helper variant raw material. |
| `isActive`, `createdAt`, `updatedAt` | metadata | `isActive` default true kecuali false eksplisit. |

Guard penting Raw Material:

- Create/update memakai transaction dan menyentuh `stock_item_read_models`.
- Purchase stock-in memakai raw material, variant key, dan `stockUnit`.
- Production BOM/work log memakai bahan dan bisa memotong stock.
- Remove raw material masih ada di service dan menyentuh read model; offline write/delete raw material belum aman.

## Kontrak field Semi Finished

Source utama: `src/services/Produksi/semiFinishedMaterialsService.js` dan `src/constants/semiFinishedMaterialOptions.js`.

| Field | Status | Catatan |
|---|---|---|
| `id` | identity | Data baru memakai document ID = kode `SFP-xxx`; data lama/manual code tetap data-lama-compatible. |
| `code`, `itemCode` | identity internal | Service membuat kode final saat create; update menjaga kode existing. |
| `name` | wajib | Nama semi finished wajib ada. |
| `description` | metadata | Teks bebas. |
| `category` | production category | Default form `pola`; pilihan: `pola`, `kelopak`, `daun`, `kawat`, `lainnya`. |
| `flowerGroup` | wajib eksplisit | Tidak ada fallback diam-diam ke `mawar`. Ini guard penting untuk ekspansi jenis bunga. |
| `type` | fixed | `semi_finished`. |
| `unit` | unit | Default `pcs`. |
| `relatedProductIds`, `relatedProductNames` | relation snapshot | Snapshot relasi ke product. |
| `stock`, `currentStock`, `reservedStock`, `availableStock` | stock guarded | Alias data lama tetap dipertahankan. Tidak boleh dimutasi dari snapshot local. |
| `minStockAlert` | alert master | Threshold master, bukan agregat variant. |
| `averageCostPerUnit` | HPP/valuation | Bisa dipengaruhi production output/payroll/HPP; tidak boleh recalculation dari local snapshot. |
| `isActive`, `isSellable` | metadata | `isSellable` false. |
| `hasVariants`, `variantLabel`, `variants`, `archivedVariants`, `variantModeHistory` | variant | Variant aktif dihitung helper. |
| `variantCount`, `activeVariantCount` | derived | Derived helper. |
| `updatedBy`, `createdBy`, `createdAt`, `updatedAt` | audit metadata | Diisi dari current user/service. |

Guard penting Semi Finished:

- `flowerGroup` wajib eksplisit; hardcoded/silent default `mawar` tidak boleh kembali.
- Create/update memakai transaction dan menyentuh `stock_item_read_models`.
- Production Work Log dapat memengaruhi `averageCostPerUnit` dan HPP output.
- Semi Finished terkait BOM bertingkat dan output produksi, sehingga offline write belum aman.

## Variant dan hardcoded mawar

Source: `src/constants/variantOptions.js` dan `src/constants/semiFinishedMaterialOptions.js`.

- `FLOWER_GROUP_OPTIONS` masih menyediakan opsi `mawar`, `tulip`, `lily`, `daisy`, `universal`, dan `lainnya`.
- `DEFAULT_SEMI_FINISHED_FORM.flowerGroup` sudah kosong, bukan `mawar`.
- `semiFinishedMaterialsService` memvalidasi `flowerGroup` wajib dan memberi catatan `no-silent-mawar-default`.
- Batch ini tidak mengubah opsi bunga dan tidak membuat migrasi data lama.

Keputusan:

- `mawar` sebagai opsi valid tetap boleh ada.
- `mawar` sebagai default otomatis tidak boleh ada.
- Perlu batch terpisah jika nanti ingin product family/flower group dinamis dari master data, karena itu menyentuh schema/route/UI dan relasi produksi.

## Unit conversion dan stock relation

Hal yang terdeteksi dari source:

- Product memakai unit implicit `pcs` pada stock jadi, dan stock bucket utama `currentStock/reservedStock/availableStock`.
- Raw Material memakai `stockUnit`, dipakai purchase dan production usage.
- Semi Finished memakai `unit`, default `pcs`.
- Purchase service membawa `stockUnit`, item type, `variantKey`, dan source collection untuk stock-in.
- Production Work Log membaca `raw_materials`, `semi_finished_materials`, dan `products` untuk consumption/output/valuation.

Keputusan:

- Tidak ada unit conversion baru di Batch 30.
- Snapshot local menyimpan data sebagaimana runtime lama, tidak melakukan konversi unit.
- Semua konversi/normalisasi stock harus tetap lewat service aktif sampai ada kontrak stock offline.

## Local DB Batch 30

Local table yang aktif sebagai read-only snapshot:

| Local table | runtime lama collection | Arah yang boleh | Arah yang blocked |
|---|---|---|---|
| `products` | `products` | runtime lama ke local | Local → runtime lama, sync queue, local write |
| `raw_materials` | `raw_materials` | runtime lama ke local | Local → runtime lama, sync queue, local write |
| `semi_finished_materials` | `semi_finished_materials` | runtime lama ke local | Local → runtime lama, sync queue, local write |

Metadata snapshot local:

- `syncStatus: synced`
- `source: runtime-lama_pull`
- `syncMetadata.scope: read_only_snapshot`
- `syncMetadata.readOnlySnapshot: true`

Batasan runtime:

- Table ini hanya bisa dilihat di tab `Data Local` pada Offline Database Center.
- Pull tidak membuat `sync queue lama` baru.
- Push UI tetap hanya Categories/Customers.
- Guard push service tetap menolak Product/Raw/Semi jika suatu saat ada queue nyasar.

## Risiko yang masih ada

1. Data lama mungkin punya shape field berbeda (`stock`, `currentStock`, `variantOptions`, random ID). Snapshot harus tetap compatibility.
2. Product/raw/semi menyentuh `stock_item_read_models`; offline write tanpa kontrak read model akan berisiko beda stok.
3. Purchase/Production/HPP bisa memakai cost/stock terbaru; snapshot local bisa stale jika runtime lama berubah setelah pull.
4. Supplier linkage di raw material memakai snapshot supplier. Karena itu supplier tetap read-only.
5. Semi Finished `averageCostPerUnit` terkait HPP produksi; local snapshot tidak boleh menjadi sumber final valuation.

## Test checklist Batch 29–30

- [ ] Jalankan `Siapkan Local DB`, pastikan schema version menjadi `2`.
- [ ] Preview runtime lama → Offline untuk `Products (read-only)`.
- [ ] Pull `Products (read-only)`, lalu cek tab `Data Local > Products (read-only)`.
- [ ] Preview dan pull `Raw Materials (read-only)`.
- [ ] Preview dan pull `Semi Finished (read-only)`.
- [ ] Pastikan `Offline → runtime lama` hanya menampilkan Categories dan Customers.
- [ ] Pastikan tidak ada `sync queue lama` untuk suppliers/products/raw_materials/semi_finished_materials.
- [ ] Pastikan halaman `Products`, `RawMaterials`, `SemiFinishedMaterials`, `Purchases`, `ProductionBoms`, dan `ProductionWorkLogs` tetap membaca source aktif seperti sebelumnya.
- [ ] Pastikan tidak ada perubahan stok, inventory logs, purchase, production work log, payroll, atau HPP setelah pull snapshot.

## Addendum Batch 31–33 — Stock Snapshot Tidak Membuka Mutation Item

Stock read model snapshot telah dipisahkan dari master item mutation:
- `stock_item_read_models` boleh dipull ke local `stock_snapshots` sebagai read-only display.
- Products/Raw/Semi tetap tidak boleh masuk offline write runtime hanya karena snapshot stok sudah tersedia.
- Mutation yang menyentuh `currentStock`, `reservedStock`, `availableStock`, variant stock, cost/HPP, purchase, sales, returns, production, dan adjustment tetap runtime lama-only.
- Detail kontrak stok: `docs/13_OFFLINE_STOCK_READ_MODEL_CONTRACT.md`.

## Update C2-C4 SQLite Foundation

Products dan Raw Materials kini memiliki foundation SQLite lewat backend sidecar:

```text
/api/products
/api/raw-materials
/api/pricing-rules
/api/semi-finished-materials
```

Kontrak aman:

- Master create/update/toggle Product dan Raw Material boleh memakai SQLite saat repository mode `sqlite_sidecar`.
- Stok awal master tetap field pasif pada master. Mutasi stok operasional tetap wajib lewat transaction engine/audit log pada batch berikutnya.
- Relasi sales, purchase, BOM, production usage, HPP, dan report final belum boleh dianggap selesai hanya karena table foundation sudah ada.
- Pricing rule SQLite boleh dibaca UI sebagai data pendamping; data kosong harus graceful dan tidak memblok master form.
- Semi Finished masih foundation/snapshot; production flow final tetap guarded.
