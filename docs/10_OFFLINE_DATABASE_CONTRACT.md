# OFFLINE DATABASE CONTRACT — IMS Bunga Flanel

Status terbaru: **SQLite local sidecar menjadi runtime offline utama untuk pilot Categories & Customers. Dexie/IndexedDB sudah tidak menjadi runtime aktif.**

Update 2026-06-01 — Source aktual menunjukkan arah baru:

```text
React Web UI
-> Repository/adapter IMS
-> Node.js backend lokal/LAN
-> SQLite file database lokal
```

Kontrak aktif:
- Customers dan Categories boleh read/write ke SQLite local sidecar.
- Firebase tetap dipertahankan sebagai fallback/legacy sampai migrasi selesai.
- Dexie/IndexedDB tidak boleh dipakai lagi sebagai runtime aktif.
- Stock, sales, purchase, returns, finance, production, payroll, HPP, auth, dan restore destructive tetap guarded.
- Restore SQLite pada tahap C1 hanya **preview-only restore plan**, bukan overwrite database.
- Laporan/ledger/profit-loss tidak boleh dihitung ulang dari draft/local yang belum final.

---


## Arsip kontrak lama IndexedDB

Bagian di bawah ini adalah catatan historis Batch 3 lama. Jika bertentangan dengan status terbaru di atas, gunakan kontrak SQLite terbaru sebagai acuan.

Status legacy: **BATCH 3 / DATABASE CONTRACT / REVIEWED FROM SOURCE / BELUM MIGRASI RUNTIME**

Tanggal audit: 2026-05-27

Dokumen ini menjadi kontrak awal untuk migrasi IMS dari Firebase-first menjadi offline-first web app:

```text
React UI
-> IMS service/repository
-> Dexie / IndexedDB local database
-> sync_queue
-> Firebase mirror / backup / sync
```

## 1. Validasi source aktual

ZIP yang divalidasi: `Inventory-App.zip`.

Hasil scan source:
- Dependency `dexie` sudah ada di `package.json`.
- File Batch 1/2 `src/data/local/*` belum ada pada ZIP terbaru, sehingga patch Batch 3 wajib membawa ulang foundation + backup foundation.
- Ditemukan `52` file source yang masih import `firebase/firestore`.
- Ditemukan `30` istilah collection/table IMS yang aktif/terdeteksi di source.

File direct Firestore yang terdeteksi:

- `src/context/AuthContext.jsx`
- `src/firebase.js`
- `src/pages/Finance/CashIn.jsx`
- `src/pages/Finance/CashOut.jsx`
- `src/pages/Inventory/components/StockAdjustmentPanel.jsx`
- `src/pages/MasterData/Categories.jsx`
- `src/pages/MasterData/PricingRules.jsx`
- `src/pages/MasterData/Products.jsx`
- `src/pages/MasterData/RawMaterials.jsx`
- `src/pages/MasterData/SupplierPurchases.jsx`
- `src/pages/Produksi/ProductionProfiles.jsx`
- `src/services/Dashboard/dashboardService.js`
- `src/services/Finance/moneyMovementLedgerService.js`
- `src/services/Inventory/inventoryLogService.js`
- `src/services/Inventory/inventoryService.js`
- `src/services/Inventory/stockReadModelService.js`
- `src/services/Laporan/reportsService.js`
- `src/services/Laporan/stockReportService.js`
- `src/services/Maintenance/dataQualityAuditService.js`
- `src/services/Maintenance/hppReconcileMaintenanceService.js`
- `src/services/Maintenance/inventoryMaintenanceService.js`
- `src/services/Maintenance/legacyDataMaintenanceService.js`
- `src/services/Maintenance/maintenanceLogService.js`
- `src/services/Maintenance/masterCodeMaintenanceService.js`
- `src/services/Maintenance/payrollMaintenanceService.js`
- `src/services/Maintenance/productionVariantMaintenanceService.js`
- `src/services/Maintenance/resetMaintenanceDataService.js`
- `src/services/Maintenance/stockReadModelMaintenanceService.js`
- `src/services/Maintenance/transactionSideEffectRepairService.js`
- `src/services/Maintenance/transactionVariantMaintenanceService.js`
- `src/services/MasterData/customersService.js`
- `src/services/MasterData/productsService.js`
- `src/services/MasterData/rawMaterialsService.js`
- `src/services/MasterData/suppliersService.js`
- `src/services/Pricing/pricingService.js`
- `src/services/Produksi/helpers/productionWorkLogsServiceHelpers.js`
- `src/services/Produksi/productionBomsService.js`
- `src/services/Produksi/productionEmployeesService.js`
- `src/services/Produksi/productionOrdersService.js`
- `src/services/Produksi/productionPayrollsService.js`
- `src/services/Produksi/productionPlanningService.js`
- `src/services/Produksi/productionProfilesService.js`
- `src/services/Produksi/productionStepsService.js`
- `src/services/Produksi/productionWorkLogsService.js`
- `src/services/Produksi/semiFinishedMaterialsService.js`
- `src/services/System/userService.js`
- `src/services/Transaksi/purchasesService.js`
- `src/services/Transaksi/returnsService.js`
- `src/services/Transaksi/salesService.js`
- `src/utils/references/businessCodeCounterService.js`
- `src/utils/references/businessCodeGenerator.js`
- `src/utils/reports/reportDateRange.js`

Collection/table term usage yang terdeteksi:

- `business_code_counters`: 2 file
- `categories`: 14 file
- `customers`: 8 file
- `expenses`: 20 file
- `incomes`: 18 file
- `inventory_logs`: 22 file
- `maintenance_logs`: 3 file
- `pricing_logs`: 4 file
- `pricing_rules`: 4 file
- `production_boms`: 10 file
- `production_employees`: 5 file
- `production_orders`: 10 file
- `production_payrolls`: 9 file
- `production_plans`: 4 file
- `production_profiles`: 3 file
- `production_steps`: 9 file
- `production_work_logs`: 14 file
- `products`: 48 file
- `purchases`: 30 file
- `raw_materials`: 34 file
- `returns`: 17 file
- `revenues`: 11 file
- `sales`: 30 file
- `semi_finished_materials`: 24 file
- `stock_adjustments`: 9 file
- `stock_item_read_models`: 7 file
- `supplierPurchases`: 6 file
- `suppliers`: 13 file
- `system_users`: 5 file
- `testing_baselines`: 2 file

Batasan:
- Scan ini static source scan, bukan runtime database dump.
- Firestore Rules/index deploy tetap harus divalidasi manual di Firebase Console.
- Database contract ini belum berarti semua table langsung dibuat di Dexie runtime.

## 2. Prinsip source of truth

Target final:

| Area | Target final |
|---|---|
| Operasional harian | Dexie / IndexedDB local DB |
| Firebase | Mirror, backup, dan sinkronisasi |
| UI | Tetap React web app |
| Write penting | Wajib lewat service/repository |
| Sync | Wajib lewat `sync_queue` |
| Conflict | Wajib masuk `sync_conflicts`, jangan overwrite otomatis untuk area sensitif |
| Audit | Wajib masuk `audit_logs` untuk write penting |
| Backup | Wajib tersedia sebelum data offline dipakai serius |

Status saat Batch 3:
- Firebase masih runtime utama.
- Local DB baru foundation + backup foundation.
- Belum ada page/service utama yang boleh dipindah ke Dexie.
- Belum ada sync otomatis ke Firebase.

## 3. Runtime mode contract

| Mode | Arti | Status |
|---|---|---|
| `firebase_primary` | Source utama Firebase seperti aplikasi saat ini | Aktif/default |
| `offline_local` | Source utama Dexie/IndexedDB | Belum aktif |
| `hybrid_sync` | Offline local utama + Firebase sync mirror | Belum aktif |

Rule:
- Mode default harus tetap `firebase_primary` sampai repository pilot lolos QA.
- Mode switch user-facing belum boleh dibuat sebelum backup/restore, sync queue, dan conflict rule tersedia.
- Mode `hybrid_sync` tidak boleh aktif otomatis untuk transaksi/stock/production/payroll.

## 4. Table foundation Batch 1/2

Table berikut boleh ada di Dexie schema v1:

| Table | Primary key | Status | Fungsi |
|---|---|---|---|
| `app_meta` | `key` | Aktif foundation | Metadata schema, mode, backup/restore |
| `local_profiles` | `uid` | Foundation | Cache profile login, belum offline auth penuh |
| `sync_queue` | `id` | Foundation | Kontrak queue, belum push otomatis |
| `sync_conflicts` | `id` | Foundation | Kontrak konflik, belum resolver UI |
| `audit_logs` | `id` | Foundation | Audit local operation |
| `categories` | `id` | Pilot candidate | Master data rendah risiko |
| `customers` | `id` | Pilot candidate | Master data rendah risiko |
| `suppliers` | `id` | Pilot candidate | Master data rendah risiko |

Backup/restore Batch 2 hanya boleh untuk table foundation allowlist di atas.

## 5. Database contract per module

### 5.1 System/Auth

| Table/Collection | Source sekarang | Offline status | Risiko | Catatan |
|---|---|---|---|---|
| `system_users` | Firebase Auth + Firestore profile | Future cache only | Tinggi | Jangan buat password lokal dulu |
| `local_profiles` | Dexie foundation | Foundation | Medium | Cache profile setelah login online |
| `app_meta` | Dexie foundation | Foundation | Rendah | Simpan mode, schema version, timestamp backup |

Rule:
- Offline auth awal hanya boleh untuk user yang sudah pernah login online dan punya cached profile.
- Edit user/role tetap online/admin-only sampai ada security review.

### 5.2 Master data rendah risiko

| Table/Collection | Prioritas | Offline status | Side effect | Catatan |
|---|---:|---|---|---|
| `categories` | P1 | Pilot candidate | Rendah | Cocok untuk repository pilot pertama |
| `customers` | P1 | Pilot candidate | Rendah | Cocok untuk repository pilot pertama |
| `suppliers` | P1 | Pilot candidate | Rendah | Cocok untuk repository pilot pertama |

Rule:
- Pilot offline pertama hanya untuk create/update/read master data ini.
- Delete sebaiknya soft-delete/tombstone, bukan hard delete, saat sync mulai aktif.

### 5.3 Master item dan pricing

| Table/Collection | Prioritas | Risiko | Side effect | Catatan |
|---|---:|---|---|---|
| `products` | P2 | Medium-Tinggi | Stock/report/sales | Jangan migrasi sebelum master pilot stabil |
| `raw_materials` | P2 | Medium-Tinggi | Purchase/production/BOM | Variant dan min stock harus dijaga |
| `semi_finished_materials` | P2 | Medium-Tinggi | Production/HPP/stock | Jaga legacy data shape |
| `pricing_rules` | P2 | Medium | Sales/pricing | Jangan ubah rule pricing di batch offline awal |
| `pricing_logs` | P3 | Medium | Audit pricing | Migrasi setelah pricing rules jelas |
| `supplierPurchases` | P3 | Medium | Supplier history | Perlu mapping ke purchase/source ref |

Rule:
- Master item boleh offline setelah repository pilot selesai.
- Jangan ubah format code/reference ID tanpa approval.
- Jangan hilangkan legacy compatibility variant.

### 5.4 Stock

| Table/Collection | Prioritas | Risiko | Contract |
|---|---:|---|---|
| `inventory_logs` | P4 | Tinggi | Sumber histori mutasi stok |
| `stock_item_read_models` | P4 | Tinggi | Cache cepat Dashboard/Stock Report |
| `stock_adjustments` | P5 | Tinggi | Koreksi stok guarded + audit |

Rule:
- `inventory_logs` adalah histori utama.
- `stock_item_read_models` adalah read model/cache, bukan sumber audit utama.
- Jangan hanya mengandalkan `currentStock`.
- Semua mutasi stok wajib punya `referenceId`, `sourceModule`, `sourceId`, dan audit trail.
- Sync conflict untuk stock tidak boleh auto overwrite.

### 5.5 Transactions

| Table/Collection | Prioritas | Risiko | Side effect wajib |
|---|---:|---|---|
| `purchases` | P5 | Tinggi | Expense + inventory log + stock read model |
| `sales` | P6 | Tinggi | Stock out + income/revenue + audit |
| `returns` | P6 | Tinggi | Stock correction + audit + finance adjustment bila perlu |

Rule:
- Purchase tidak boleh sync tanpa inventory log.
- Sales tetap no-cancel user-facing; koreksi lewat Return.
- Return tidak boleh membuat stock/income dobel.
- Semua transaksi wajib idempotent saat sync retry.

### 5.6 Finance

| Table/Collection | Prioritas | Risiko | Catatan |
|---|---:|---|---|
| `expenses` | P7 | Tinggi | Terkait purchases/payroll/cash out |
| `incomes` | P7 | Tinggi | Terkait sales/cash in |
| `revenues` | P7 | Tinggi | Untuk reporting/profit loss |

Rule:
- Finance jangan dimigrasi sebelum purchase/sales/returns offline stabil.
- Jangan duplikasi expense/income saat sync retry.
- Ledger/report harus baca sumber yang sudah disepakati.

### 5.7 Production

| Table/Collection | Prioritas | Risiko | Catatan |
|---|---:|---|---|
| `production_plans` | P8 | Tinggi | Cancel hanya jika belum punya PO |
| `production_orders` | P8 | Tinggi | Mengarah ke Work Log dan stock |
| `production_work_logs` | P9 | Sangat tinggi | Material usage, output, payroll, HPP |
| `production_boms` | P9 | Tinggi | Material recipe |
| `production_steps` | P9 | Tinggi | Estimasi labor/step |
| `production_profiles` | P9 | Tinggi | Konfigurasi produksi |
| `production_employees` | P9 | Medium-Tinggi | Payroll relation |
| `production_payrolls` | P10 | Sangat tinggi | HPP aktual dari final/paid payroll |

Rule:
- Production paling akhir setelah stock/transaksi stabil.
- Labor UI boleh dari estimasi step, tetapi HPP final harus dari payroll final/paid.
- Glue/lem tembak tetap material usage, bukan overhead utama.
- Scrap/QC belum menjadi workflow utama kecuali disetujui nanti.

### 5.8 Reset/Maintenance

| Table/Collection | Prioritas | Risiko | Catatan |
|---|---:|---|---|
| `maintenance_logs` | P11 | Sangat tinggi | Audit maintenance/reset |
| `testing_baselines` | P11 | Sangat tinggi | Baseline/testing guarded |

Rule:
- Reset destructive offline tidak boleh otomatis sync delete ke Firebase.
- Export backup wajib sebelum destructive local restore/reset.
- Restore local DB foundation bukan pengganti reset bisnis utama.

## 6. Field standard untuk offline/sync

Semua table bisnis yang nanti masuk offline sync sebaiknya punya field berikut:

| Field | Fungsi |
|---|---|
| `id` | Primary key stabil, sebaiknya business-readable jika sudah menjadi rule modul |
| `referenceId` | Kode audit manusiawi jika berbeda dari id |
| `createdAt` | Timestamp create |
| `updatedAt` | Timestamp update terakhir |
| `createdBy` | User/profile pembuat |
| `updatedBy` | User/profile terakhir |
| `syncStatus` | `local`, `pending`, `syncing`, `synced`, `failed`, `conflict` |
| `lastSyncedAt` | Timestamp sync sukses |
| `localUpdatedAt` | Timestamp update lokal |
| `remoteUpdatedAt` | Timestamp remote terakhir jika pull sync aktif |
| `deviceId` | Dibutuhkan sebelum multi-device offline |
| `_deleted` | Tombstone delete |
| `deletedAt` | Timestamp soft delete |
| `deletedBy` | Actor soft delete |

Catatan:
- Untuk Batch 3, field ini adalah contract, belum semua table harus diubah.
- Jangan ubah schema Firestore lama tanpa batch migrasi khusus.

## 7. Sync queue contract

`sync_queue` wajib menyimpan minimal:

| Field | Fungsi |
|---|---|
| `id` | Queue id |
| `collectionName` | Nama table/collection target |
| `documentId` | ID dokumen |
| `operation` | `create`, `update`, `delete` |
| `payload` | Data yang akan disync |
| `baseVersion` | Versi data saat perubahan dibuat |
| `localUpdatedAt` | Timestamp perubahan lokal |
| `syncStatus` | `pending`, `syncing`, `synced`, `failed`, `conflict` |
| `retryCount` | Jumlah retry |
| `errorMessage` | Error terakhir |
| `createdAt` | Queue created |
| `updatedAt` | Queue updated |

Rule:
- Batch awal sync hanya untuk `categories`, `customers`, `suppliers`.
- Transaksi/stock/production/payroll tidak boleh masuk sync queue aktif sampai batch-nya disetujui.

## 8. Conflict contract

`sync_conflicts` minimal:

| Field | Fungsi |
|---|---|
| `id` | Conflict id |
| `collectionName` | Table/collection |
| `documentId` | Dokumen konflik |
| `conflictType` | Jenis konflik |
| `localPayload` | Data lokal |
| `remotePayload` | Data Firebase |
| `detectedAt` | Tanggal deteksi |
| `resolvedAt` | Tanggal selesai |
| `resolution` | `local_wins`, `remote_wins`, `manual_merge`, `skipped` |

Rule:
- Untuk stock, purchase, sales, returns, finance, production, payroll, HPP: tidak boleh auto overwrite.
- V1 strategi: single-device offline-first, local wins hanya untuk master data rendah risiko.
- Multi-device offline aktif perlu approval arsitektur terpisah.

## 9. Repository migration order

Urutan yang disetujui untuk batch berikutnya:

1. Backup/restore foundation.
2. Database Contract.
3. Repository pilot untuk `categories`, `customers`, `suppliers`.
4. Repository mode: `firebase_primary`, `offline_local`, `hybrid_sync`.
5. Sync queue dasar untuk master data.
6. Firebase sync manual untuk master data.
7. UI pilot master data.
8. Products/raw/semi-finished.
9. Stock read model local.
10. Purchases.
11. Sales.
12. Returns.
13. Finance.
14. Production planning/order/work log.
15. Payroll/HPP.
16. Dashboard/report offline.
17. Pull sync/conflict resolver.
18. Offline profile cache.
19. Reset/Maintenance offline.

## 10. Dilarang pada Batch 3

Batch 3 tidak boleh:
- Mengubah runtime Firebase utama.
- Mengubah route/menu/role guard.
- Mengubah Firestore rules/index.
- Mengubah schema transaksi/stock/production/payroll/HPP.
- Mengaktifkan sync otomatis.
- Mengubah document ID/reference ID.
- Mengubah reset destructive.
- Mengubah auth/login.
- Menghapus service/helper legacy.

## 11. QA gate sebelum Batch 4

Sebelum repository pilot:
- `cd frontend && npm run lint` harus bersih.
- `cd frontend && npm run build` harus bersih.
- `cd backend && npm run check` harus bersih.
- App tetap berjalan sebagai Firebase-first.
- Local DB foundation bisa dibuat di IndexedDB.
- Backup export/preview/restore foundation bisa diuji manual/dev.
- Docs ini sudah menjadi rujukan semua batch offline berikutnya.


## 12. Batch 4 repository pilot contract — 2026-05

Status: **PILOT / FIREBASE PRIMARY DEFAULT / NON-RUNTIME SWITCH**.

Repository pilot menambahkan boundary untuk master data rendah risiko:

| Repository | Firebase adapter | Dexie adapter | Runtime aktif |
|---|---|---|---|
| `categoriesRepository` | `firebaseCategoriesAdapter` | `dexieCategoriesAdapter` | Belum dipakai page aktif |
| `customersRepository` | `firebaseCustomersAdapter` memakai `customersService` | `dexieCustomersAdapter` | Belum dipakai page aktif |
| `suppliersRepository` | `firebaseSuppliersAdapter` read/list + write blocked | `dexieSuppliersAdapter` | Belum dipakai page aktif |

Rule tambahan:
- Default mode repository adalah `firebase_primary`.
- Mode `offline_local` hanya dipakai jika caller eksplisit mengirim option mode.
- Tidak ada UI mode switch pada Batch 4.
- Dexie adapter memakai `syncStatus = pending` untuk create/update/delete lokal.
- Delete lokal memakai tombstone `_deleted` secara default.
- Supplier Firebase write belum aktif karena flow create/update/delete supplier masih ada di `SupplierPurchases.jsx`; ekstraksi supplier harus menjadi batch tersendiri.
- Page aktif tidak boleh dimigrasi ke repository sebelum QA repository pilot selesai.

QA gate sebelum Batch 5:
- Repository import tidak menyebabkan circular dependency.
- App tetap Firebase-first.
- Manual/dev test repository list untuk categories/customers/suppliers sukses.
- Tidak ada perubahan runtime stock/transaksi/production/payroll/HPP.


## 12. Batch 6 update — Sync Queue pilot

Status: **LOCAL QUEUE ONLY / MASTER DATA PILOT / FIREBASE PRIMARY MASIH AKTIF**.

Tambahan kontrak Batch 6:
- `sync_queue` sudah memiliki service lokal di `src/data/sync/syncQueueService.js`.
- Queue hanya menerima collection pilot: `categories`, `customers`, `suppliers`.
- Operation yang diterima: `create`, `update`, `delete`.
- Status yang valid: `pending`, `syncing`, `synced`, `failed`, `conflict`.
- Dexie master data adapter mencatat queue saat write lokal pilot, tetapi belum push ke Firebase.
- Mode `hybrid_sync` masih tidak boleh aktif.
- `repositoryModeService` hanya guard dev/internal, bukan UI user-facing.

Dilarang setelah Batch 6:
- Menambahkan stock/purchase/sales/returns/finance/production/payroll/HPP ke queue tanpa batch kontrak khusus.
- Membuat auto sync Firebase.
- Membuat conflict resolver otomatis untuk area sensitif.
- Mengaktifkan mode offline-local untuk page aktif tanpa pilot QA.

Gate sebelum Batch 7:
- Queue create/update/delete pilot terbukti mencatat item pending dengan benar.
- Queue menolak collection/operation di luar allowlist.
- App tetap Firebase-first dan tidak ada perubahan runtime user-facing.


## 12. Batch 7 Manual Firebase Sync Contract

Status: **MANUAL / GUARDED / MASTER DATA PILOT ONLY**.

File sync:
- `src/data/sync/syncQueueService.js`
- `src/data/sync/syncConflictService.js`
- `src/data/sync/firebaseMasterDataSyncService.js`

Manual Firebase sync hanya boleh dijalankan dengan confirmation:

```text
SYNC MASTER DATA PILOT TO FIREBASE
```

Supported push awal:
- `categories` create/update.
- `customers` create/update dengan kode valid `CUS-DDMMYYYY-001`.

Blocked/guarded:
- `suppliers` belum push ke Firebase karena source aktual memakai collection `supplierPurchases` dan write flow masih terkait SupplierPurchases/raw material/purchase linkage.
- `delete` ke Firebase default blocked; perlu `allowDeletes=true` dan backup/review impact.
- Stock, purchase, sales, returns, finance, production, payroll, HPP, reset, dan audit bisnis utama tidak boleh masuk manual sync Batch 7.

Conflict rule awal:
- Jika queue operation `create` menemukan dokumen Firebase dengan ID yang sama, status queue menjadi `conflict`.
- Detail konflik ditulis ke `sync_conflicts`.
- Tidak ada overwrite diam-diam kecuali caller eksplisit memberi `allowOverwriteExistingCreate=true` dalam konteks dev/test yang sudah direview.

Runtime:
- Tidak ada auto-sync.
- Tidak ada UI user-facing.
- Firebase tetap source utama aplikasi.
- Setiap hasil manual sync menulis audit lokal `module = local_db_sync` supaya percobaan sync bisa ditelusuri.


## 13. Batch 8–9 Dev Panel dan Conflict Resolver Contract

Status: **GUARDED / MASTER DATA PILOT ONLY / FIREBASE PRIMARY MASIH AKTIF**.

Panel:
- Panel berada di `src/pages/Utilities/components/OfflineSyncDevPanel.jsx`.
- Panel dipasang di `src/pages/Utilities/ResetMaintenanceData.jsx` tanpa mengubah reset destructive flow.
- Panel hanya untuk dev/admin preview dan manual action guarded.

Confirmation keyword:
- Repository mode pilot: `ENABLE OFFLINE REPOSITORY PILOT`.
- Manual Firebase sync: `SYNC MASTER DATA PILOT TO FIREBASE`.
- Conflict resolver: `RESOLVE MASTER DATA CONFLICT`.

Resolver allowed collection:
- `categories`.
- `customers`.

Resolver mode:
- `local_wins`: payload local DB ditulis ke Firebase lalu local record/queue/conflict ditandai synced/resolved.
- `remote_wins`: payload Firebase dipakai untuk local DB lalu queue/conflict ditandai synced/resolved.
- `mark_skipped`: conflict ditandai reviewed/skipped, queue menjadi failed, dan tidak ada write Firebase.

Blocked:
- `suppliers` sampai supplier write flow diekstrak dari `SupplierPurchases` dan diaudit.
- `delete` conflict selain mark skipped.
- stock, purchase, sales, returns, finance, production, payroll, HPP, reset destructive, route/menu/role guard, dan Firestore rules/index.

Audit:
- Manual sync menulis audit lokal `module = local_db_sync`.
- Conflict resolver menulis audit lokal `module = local_db_sync_conflict`.

## Batch 11/12 Addendum — Dev Pilot UI and White Screen Guard

Batch 11/12 allowed additions:
- Dev-only local CRUD pilot untuk `categories` dan `customers`.
- Runtime error boundary khusus panel offline dev.
- Compatibility export alias untuk mencegah named export mismatch pada route Utilities.
- Collection filter pada preview/manual sync agar admin bisa membatasi sync pilot.

Still forbidden without explicit approval:
- Mengganti halaman aktif `Categories.jsx` atau `Customers.jsx` menjadi offline-first.
- Mengaktifkan supplier Firebase sync.
- Mengaktifkan auto-sync.
- Mengubah schema Firestore, route/menu/role guard, stock/transaksi/production/payroll/HPP, reset destructive flow, atau business code counter.

Customer offline rule:
- Pilot customer local wajib memakai document ID/kode `CUS-DDMMYYYY-001`.
- Data customer dengan kode local/random tidak boleh masuk manual sync Firebase.

## Batch 14 contract addition — Categories/Customers runtime pilot

Runtime migration may start only from low-risk master data:
1. `categories`
2. `customers`

Rules:
- Repository mode must be resolved before page read/write.
- Page default must remain `firebase_primary`.
- `offline_local` writes must enqueue local sync operations.
- Customer local code must be deterministic enough for single-device pilot and must follow `CUS-DDMMYYYY-001`.
- Customer code field remains disabled/read-only in UI.
- Local delete remains tombstone until conflict/sync policy is finalized.
- No supplier runtime write migration before supplier flow is extracted from `SupplierPurchases`.
- No stock, purchase, sales, return, finance, production, payroll, HPP, reset destructive, or audit-log migration in this batch.

## Batch 14–16 Contract Addendum

- Runtime page aktif kedua yang boleh memakai repository boundary adalah `Customers.jsx`.
- `customersRepository.generateCustomerCode()` wajib tersedia agar UI tidak perlu tahu adapter Firebase/Dexie yang aktif.
- Dexie customer adapter wajib menolak kode di luar format `CUS-DDMMYYYY-001`, menolak duplicate local code, dan menjaga kode immutable saat edit.
- Sales belum menjadi offline transaction runtime; Sales wajib membaca customer dari `firebase_primary` sampai stock/income/inventory-log offline contract disetujui.
- Customer local-only tidak boleh dipakai untuk membuat transaksi Sales Firebase karena bisa membuat `customerId` mengarah ke dokumen yang belum ada di Firebase.
- Setiap perluasan offline ke transaksi wajib punya kontrak terpisah untuk stock mutation, inventory log, income/expense, conflict, dan rollback/idempotency.


## Batch 17–20 Completion Contract

Batch 17 completed scope:
- `OfflineLocalDbBackupPanel.jsx` is the only UI entry for local DB backup/restore.
- Export creates a JSON backup using `exportLocalDbBackup()`.
- Import uses `parseLocalDbBackupJson()` and `previewLocalDbBackupRestore()` before restore.
- Restore uses `restoreLocalDbBackupWithGuard()` and requires `RESTORE LOCAL DB BACKUP`.
- Restore is local IndexedDB only and does not sync Firebase.

Batch 18/19 supplier decision:
- Supplier local table may exist as foundation, but supplier Firebase sync remains blocked.
- Supplier runtime migration requires a separate supplier flow extraction plan and approval.
- Detailed audit: `docs/11_OFFLINE_SUPPLIER_FLOW_AUDIT.md`.

Batch 20 products/raw/semi decision:
- Products, Raw Materials, and Semi Finished remain outside local runtime/sync queue.
- They require stock/production/payroll/HPP contracts before any migration.
- Detailed contract: `docs/12_OFFLINE_PRODUCTS_RAW_SEMI_CONTRACT.md`.

## Batch 21 — Offline Sync UX Simplification + Firebase → Local Pull

Status: AKTIF untuk pilot Categories dan Customers saja.

Tujuan batch ini adalah membuat alur offline database lebih mudah dipahami oleh user. Panel lama yang panjang di Reset Maintenance digantikan oleh `Offline Database Center` berbasis tab:

- **Status**: melihat mode aktif, kesiapan Local DB, jumlah queue pending, dan conflict.
- **Sinkronisasi**: memisahkan dua arah sync secara eksplisit:
  - Firebase → Offline: mengambil data Firebase ke IndexedDB local agar offline mode tidak kosong.
  - Offline → Firebase: meng-upload perubahan local yang masih pending ke Firebase.
- **Backup & Restore**: export/import/restore backup local DB tetap guarded.
- **Konflik**: conflict resolver tetap manual dan guarded.
- **Data Local**: preview isi IndexedDB dengan pilihan `Categories` atau `Customers`, bukan banyak tabel panjang.

Keyword baru untuk menarik data Firebase ke local:

```txt
PULL FIREBASE MASTER DATA TO LOCAL
```

Guard penting:

- Pull Firebase → Offline hanya untuk `categories` dan `customers`.
- Pull tidak membuat `sync_queue` baru.
- Pull tidak menghapus record local yang tidak ada di Firebase.
- Pull tidak overwrite local record yang masih `pending`, `syncing`, `failed`, atau `conflict`.
- Pull tidak menyentuh `suppliers`, `products`, `rawMaterials`, `semiFinishedMaterials`, stock, purchase, sales transaction, finance, production, payroll, HPP, atau reset destructive.

Alur pakai yang disarankan:

1. Buka `Testing & Reset Center`.
2. Masuk `Offline Database Center` tab `Status`.
3. Klik `Siapkan Local DB`.
4. Masuk tab `Sinkronisasi`.
5. Jalankan `Preview Firebase → Offline` untuk Categories/Customers.
6. Isi keyword `PULL FIREBASE MASTER DATA TO LOCAL` lalu sync Firebase → Offline.
7. Aktifkan `Offline Mode` dengan keyword `ENABLE OFFLINE REPOSITORY PILOT`.
8. Edit/tambah Categories/Customers.
9. Preview dan sync `Offline → Firebase` dengan keyword `SYNC MASTER DATA PILOT TO FIREBASE`.
10. Jika selesai, kembali ke `Firebase Mode`.

## Batch 23–25 — Offline UX Guard Contract

Scope batch ini adalah UX dan observability untuk master data pilot, bukan perluasan runtime offline.

Komponen/halaman aktif:
- `src/pages/MasterData/Categories.jsx`
- `src/pages/MasterData/Customers.jsx`
- `src/components/Layout/Feedback/OfflineRepositoryStatus.jsx`
- `src/data/sync/syncQueueService.js` read-only helper `getPendingSyncQueueCount()`

Kontrak UX:
- Page pilot harus selalu menunjukkan mode repository aktif.
- Page pilot harus memberi arahan saat Offline Mode kosong karena data Firebase belum dipull ke Local.
- Queue pending boleh ditampilkan sebagai indikator, tetapi penyelesaian sync tetap melalui `Offline Database Center`.

Batasan guarded:
- Tidak ada auto-pull atau auto-push saat page dibuka.
- Tidak ada sync destructive otomatis.
- Tidak ada perluasan allowlist ke supplier/product/raw/semi/stock/purchase/sales transaction/finance/production/payroll/HPP.
- Tidak ada perubahan route/menu/role guard atau Firestore schema/rules.

---

## Appendix — SQLite Local Runtime Pilot Update

Status terbaru: **SQLite local menjadi target runtime pilot untuk Categories dan Customers.**

Perubahan penting:

- Offline Database Center aktif sekarang adalah **SQLite Local DB Center**.
- `Dexie/IndexedDB` tidak lagi dipakai oleh UI utama SQLite Center dan master data pilot aktif.
- Dependency root `dexie` dihapus dari `package.json`.
- Repository mode lama `offline_local` dan `hybrid_sync` dipetakan ke `sqlite_sidecar` agar setting lama tidak membuat UI crash.
- `sync_queue` dan `sync_conflicts` Dexie tidak lagi menjadi jalur runtime aktif.
- `customers` dan `categories` memakai backend SQLite lewat HTTP API.

Batasan:

- File Dexie/IndexedDB legacy masih boleh ada sebagai cleanup candidate sampai audit delete file selesai.
- Supplier belum diarahkan ke SQLite.
- Stock, purchase, sales final, returns, finance, production, payroll, HPP, dan reset destructive belum boleh dimutasi offline.
- Restore SQLite belum dibuat dalam runtime aktif karena perlu guard destructive terpisah.
