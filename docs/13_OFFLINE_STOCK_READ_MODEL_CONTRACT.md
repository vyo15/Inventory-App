<!--
PATCH A-B NOTE — 2026-06-02:
Dokumen ini adalah arsip historis Batch offline database browser arsip. Source aktif sekarang memakai SQLite sidecar lewat backend Node.js lokal/LAN. Jangan mengikuti instruksi runtime database browser arsip, sync queue arsip, conflict resolver, atau backup JSON storage browser arsip dari dokumen arsip ini. Kontrak terbaru ada di docs/10_OFFLINE_DATABASE_CONTRACT.md dan docs/17_SQLITE_OFFLINE_WEB_ROADMAP.md.
-->

# OFFLINE STOCK READ MODEL CONTRACT — BATCH 31–33

Status: **ARSIP HISTORIS / SUPERSEDED BY SQLITE RUNTIME / JANGAN DIPAKAI SEBAGAI INSTRUKSI AKTIF**.

Tujuan batch:
1. Mengaudit arsitektur stok sebagai read model, bukan mutation offline.
2. Menambahkan local stock snapshot read-only agar user bisa melihat stok terakhir saat offline.
3. Mengunci aturan sync/validation supaya stock mutation tidak rusak oleh offline pilot.

## 1. Validasi source aktual

ZIP yang dicek: `Inventory-App-clean.zip`.

File source yang benar-benar dicek:
- `src/services/Inventory/inventoryService.js`
- `src/services/Inventory/inventoryLogService.js`
- `src/services/Inventory/stockReadModelService.js`
- `src/utils/stock/stockHelpers.js`
- `src/utils/variants/variantStockHelpers.js`
- `src/pages/Inventory/components/StockAdjustmentPanel.jsx`
- `src/services/Transaksi/purchasesService.js`
- `src/services/Transaksi/salesService.js`
- `src/services/Transaksi/returnsService.js`
- `src/services/Produksi/productionOrdersService.js`
- `src/services/Produksi/productionWorkLogsService.js`
- `src/services/Produksi/semiFinishedMaterialsService.js`
- `src/services/Dashboard/dashboardService.js`
- `src/services/Laporan/stockReportService.js`
- `src/data/local/localDbSchema.js`
- `src/data/sync/runtime-arsipToLocalMasterDataSyncService.js`
- `src/pages/Utilities/components/OfflineDatabaseCenter.jsx`
- `docs/10_OFFLINE_DATABASE_CONTRACT.md`
- `docs/12_OFFLINE_PRODUCTS_RAW_SEMI_CONTRACT.md`
- `docs/08_INTEGRATION_MAP.md`

File/area relevan yang tidak ditemukan sebagai komponen terpisah:
- Tidak ditemukan `src/data/adapters/database-browser-arsip/database-browser-arsipStockAdapter.js` atau repository stock offline yang aktif.
- Tidak ditemukan local stock mutation service/offline stock queue khusus; ini memang harus tetap tidak ada untuk batch ini.
- rules database arsip/index runtime di runtime arsip Console tidak bisa divalidasi dari ZIP selain file repo `rules database arsip` dan `data historis-db.indexes.json`.

Batasan validasi:
- Audit ini static source review dari ZIP, bukan dump data database arsip production.
- Tidak mengubah schema database arsip/collection/rules.
- Tidak mengaktifkan stock mutation offline.

## 2. Source of truth stok

| Lapisan | Status | Fungsi | Keputusan |
|---|---|---|---|
| `products`, `raw_materials`, `semi_finished_materials` | Source dokumen stok operasional | Menyimpan `stock/currentStock/reservedStock/availableStock`, variant stock, cost/HPP tertentu | Tetap runtime arsip-only untuk mutation |
| `inventory_logs` | Histori mutasi stok | Audit movement: purchase in, sales out, return in, production material out/output in, adjustment | Tetap runtime arsip-only; wajib ada untuk mutation |
| `stock_adjustments` | Dokumen koreksi stok | Koreksi manual guarded | Tetap runtime arsip-only; tidak boleh offline |
| `stock_item_read_models` | Read model/cache | Dashboard/Stock Report cepat dan konsisten | Boleh dipull local read-only sebagai `stock_snapshots` |
| `stock_snapshots` local database browser arsip | Snapshot baca | Melihat stok terakhir saat offline | Tidak boleh edit, adjustment, transaksi, atau push |

Keputusan awal/final batch ini: **stock mutation tetap runtime arsip-only**. Offline hanya boleh membaca snapshot terakhir.

## 3. Stock integration map aktual

| Flow | File/source utama | Mutation yang terjadi | Read model/log | Status offline |
|---|---|---|---|---|
| Stock management/listen inventory | `inventoryService.js` | Tidak mutation utama; listen `products`/`raw_materials` | Data master stok langsung | Baca online; local snapshot hanya dari read model |
| Stock adjustment | `StockAdjustmentPanel.jsx` | Update `currentStock/reservedStock/availableStock` via transaction | Tulis `stock_adjustments`, `inventory_logs`, `stock_item_read_models` | Tidak boleh offline |
| Purchase receive | `purchasesService.js` | Stok barang/bahan masuk saat purchase disimpan/diterima | Tulis purchase, expense/side effect, inventory log, stock read model | Tidak boleh offline |
| Sales stock out | `salesService.js` | Stok produk keluar dalam transaction | Tulis sale, income/revenue side effect, inventory log, stock read model | Tidak boleh offline |
| Return stock in | `returnsService.js` | Stok produk/bahan masuk untuk koreksi return | Tulis return, inventory log, stock read model | Tidak boleh offline |
| Production reserve/release data historis | `productionOrdersService.js` | Update `reservedStock/availableStock` | Tulis stock read model | Tidak boleh offline |
| Production material usage saat Start/Complete Work Log | `productionWorkLogsService.js` | Mengurangi stok bahan/komponen dan release reserved | Tulis inventory log produksi dan `stock_item_read_models` dalam transaction yang sama | Tidak boleh offline |
| Production output stock in | `productionWorkLogsService.js` | Menambah stok output product/semi-finished dan update cost/HPP | Tulis inventory log produksi dan `stock_item_read_models` dalam transaction yang sama | Tidak boleh offline |
| Semi-finished master create/update/toggle | `semiFinishedMaterialsService.js` | Metadata semi-finished; beberapa flow production mengubah stoknya | Tulis stock read model saat metadata master berubah | Tidak boleh offline mutation |
| Dashboard stock issue | `dashboardService.js` | Read-only | Membaca `stock_item_read_models` | Boleh pakai snapshot local hanya untuk display khusus offline, bukan dashboard runtime aktif |
| Stock report | `stockReportService.js` | Read-only | Membaca `stock_item_read_models`, fallback maintenance/read helpers | Boleh pakai snapshot local hanya untuk display khusus offline, bukan report runtime aktif |

## 4. Field contract stok

Field minimum yang harus dijaga pada source stok dan read model:

| Field | Arti | Rule |
|---|---|---|
| `sourceType` | Jenis sumber: product/material/semi_finished | Wajib untuk membedakan dokumen stok |
| `sourceCollection` | Collection asal | Wajib untuk trace/debug |
| `sourceId` | ID dokumen source | Wajib, tetapi bukan primary key local snapshot tunggal |
| `readModelId` / local `id` | Document ID `stock_item_read_models` | Primary key local snapshot |
| `name`, `code`, `displayReference` | Identitas bisnis | Untuk UI/audit, jangan tampilkan technical ID sebagai label utama |
| `currentStock` | Stok fisik/current | Mutation hanya online/runtime arsip |
| `reservedStock` | Stok tertahan/reserved | Mutation hanya online/runtime arsip |
| `availableStock` | Stok tersedia | Harus konsisten dengan current - reserved |
| `stock` | Data historis alias/master stock | Jangan dihapus tanpa audit data historis |
| `minStock` | Minimum stok | Dipakai status stock issue |
| `stockStatus`, `hasStockIssue` | Status read model | Dipakai dashboard/report/snapshot |
| `variants[]` | Stok varian | Wajib dijaga, jangan fallback ke master jika item punya varian |
| `inventory_logs.*` | Histori mutasi | Wajib ada untuk semua mutation stock |
| `stock_adjustments.*` | Koreksi manual | Guarded, tidak boleh offline |

Local `stock_snapshots` menyalin read model runtime arsip apa adanya dan menambah metadata pull:
- `syncStatus = synced`
- `source = runtime-arsip_pull`
- `lastSyncedAt`
- `remoteUpdatedAt`
- `localUpdatedAt`
- `syncMetadata.scope = stock_read_only_snapshot`

## 5. Risiko double mutation

Risiko terbesar jika stock mutation diaktifkan offline terlalu cepat:

1. **Double stock in/out saat sync retry**: purchase/sales/return/production bisa menambah atau mengurangi stok dua kali jika tidak ada idempotency key per movement.
2. **Partial side effect**: stok berubah, tetapi `inventory_logs`, income/expense, HPP, atau work log gagal tersimpan.
3. **Conflict antar perangkat**: dua device offline mengubah stok item/variant yang sama, lalu push berurutan tanpa merge rule.
4. **Variant fallback salah**: item varian bisa jatuh ke master/default stock jika `variantKey` hilang.
5. **Read model stale**: `stock_item_read_models` hanya cache; jika writer flow tidak sinkron, dashboard/report bisa berbeda dari source stok.
6. **Rollback tidak jelas**: rollback stok harus tahu movement mana yang sudah diterapkan; snapshot tidak cukup untuk rollback aman.
7. **Audit gap**: mutation tanpa `inventory_logs` membuat histori stok tidak bisa dipertanggungjawabkan.

Catatan audit penting dari source aktual:
- Writer purchase, sales, returns, stock adjustment, production reserve/release, semi-finished metadata, dan Production Work Log sudah memanggil stock read model writer.
- `productionWorkLogsService.js` sekarang menyinkronkan `stock_item_read_models` di transaction yang sama saat Start Production material out, Complete Work Log material out fallback data historis, dan Complete Work Log output in.
- Flow complete fallback data historis juga menulis `inventory_logs` `production_material_out` saat benar-benar memotong stok material, sehingga stok tidak berkurang tanpa histori audit baru.
- `stock_item_read_models` tetap derived/cache. Source of truth stok tetap dokumen master `products`/`raw_materials`/`semi_finished_materials` dan histori tetap `inventory_logs`.

## 6. Daftar flow yang tidak boleh offline

Tidak boleh dijalankan offline sampai ada approval kontrak mutation, idempotency, rollback, dan conflict resolver:

- Stock adjustment.
- Purchase receive/restock.
- Sales create/stock out.
- Return stock in/correction.
- Production order reserve/release.
- Production work log start material usage.
- Production work log complete material usage dan output stock in.
- Semi-finished output stock/cost/HPP update.
- HPP reconcile/repair stock cost.
- Data quality repair yang mengubah stok/log.
- Reset/maintenance destructive yang menyentuh stock source/log/read model.

## 7. Sync validation rules Batch 33

### Boleh offline

- Pull `stock_item_read_models` runtime arsip ke local `stock_snapshots`.
- Preview `stock_snapshots` di Offline Database Center.
- Export/import local backup yang mencakup snapshot, hanya sebagai backup local storage browser arsip.

### Tidak boleh offline

- Membuat/mengubah/menghapus stok dari local.
- Menulis `sync queue arsip` untuk stock.
- Push `stock_snapshots` ke runtime arsip.
- Menjalankan adjustment/transaksi/produksi dari snapshot local.

### Audit log wajib

- Pull snapshot menulis audit local `module = local_db_sync`, `action = runtime-arsip_to_local_pull`, dan `metadata.scope = stock_read_only_snapshot`.
- Mutation stock online tetap wajib punya `inventory_logs` dan dokumen transaksi/koreksi terkait.

### Idempotency

Sebelum stock mutation boleh offline, setiap movement harus punya key stabil:
- `sourceModule`
- `sourceId`
- `sourceLineId` atau equivalent line fingerprint
- `variantKey`
- `movementType`
- `appliedAt`
- marker bahwa movement sudah pernah diterapkan

Tanpa kontrak ini, retry sync berisiko double mutation.

### Rollback

Rollback stok tidak boleh menghitung dari snapshot. Rollback harus:
- Menarget movement tertentu.
- Membuat compensating movement/log baru atau transaction reversal yang idempotent.
- Menjaga income/expense/HPP/payroll side effect sesuai sumber transaksi.

### Conflict rule

- Conflict stock tidak boleh auto overwrite.
- Jika dua perubahan menyentuh item/variant sama, harus manual review.
- Local snapshot yang lebih lama tidak boleh menimpa runtime arsip.
- Resolve harus mempertahankan `inventory_logs` sebagai histori, bukan hanya angka akhir.

### Double mutation prevention

- `stock_snapshots` tidak masuk `LOCAL_SYNC_COLLECTIONS`.
- UI Offline Database Center hanya menampilkan snapshot sebagai read-only.
- Tidak ada database browser arsip stock mutation adapter.
- Tidak ada Offline → runtime arsip untuk stock.
- Semua stock mutation tetap melalui runtime arsip transaction/service aktif.

## 8. Patch Batch 32 yang diizinkan

Patch aman batch ini hanya:
- Menambah database browser arsip table `stock_snapshots` di database browser arsip schema v4.
- Menambah runtime arsip adapter read-only untuk `stock_item_read_models`.
- Menambah opsi pull runtime arsip → Offline untuk Stock Snapshot read-only.
- Menampilkan preview local snapshot read-only di Offline Database Center.
- Menulis kontrak docs ini dan update kontrak offline utama.

Patch ini sengaja tidak mengubah:
- `products`, `raw_materials`, `semi_finished_materials` mutation.
- `inventory_logs` writer.
- `stock_adjustments` writer.
- Purchase/sales/returns/production/payroll/HPP runtime.
- Route/menu/role guard.
- database arsip rules/index.

## Update C5 SQLite Stock Read Model Foundation

Source SQLite baru:

```text
/api/stock-read-models
stock_read_models
```

Aturan guard:

- SQLite stock read model adalah snapshot/read model, bukan source of truth mutasi stok.
- `currentStock`, `reservedStock`, dan `availableStock` final tetap harus diubah lewat flow atomic yang mencatat audit log dan inventory log.
- UI/report boleh memakai snapshot untuk tampilan setelah batch terkait siap, tetapi tidak boleh melakukan adjustment langsung dari snapshot.
