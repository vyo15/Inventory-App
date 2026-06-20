<!--
PATCH A-B NOTE — 2026-06-02:
Dokumen ini adalah arsip historis Batch offline database browser arsip. Source aktif sekarang memakai SQLite sidecar lewat backend Node.js lokal/LAN. Jangan mengikuti instruksi runtime database browser arsip, sync queue arsip, conflict resolver, atau backup JSON storage browser arsip dari dokumen arsip ini. Kontrak terbaru ada di docs/10_OFFLINE_DATABASE_CONTRACT.md dan docs/17_SQLITE_OFFLINE_WEB_ROADMAP.md.
-->

<!--
PATCH CLEANUP NOTE — 2026-06-08:
Referensi source aktif diselaraskan ke arsitektur SQLite sidecar. Path storage browser lama dihapus dari daftar validasi agar tidak dianggap runtime aktif.
-->

# Offline Production, Payroll, dan HPP Contract

Status: **ARSIP HISTORIS / SUPERSEDED BY SQLITE RUNTIME / JANGAN DIPAKAI SEBAGAI INSTRUKSI AKTIF**.

Dokumen ini adalah hasil re-audit arsitektur Production, Payroll, dan HPP untuk persiapan offline database. Source aktual tetap menjadi bukti utama. Jika dokumen lama berbeda dengan source, source aktual menang.

## 1. Validasi source aktual

ZIP yang divalidasi: `Inventory-App-clean.zip`.

File aktual yang dicek untuk Batch 41-44:

- `src/services/Produksi/productionPlanningService.js`
- `src/services/Produksi/productionOrdersService.js`
- `src/services/Produksi/productionWorkLogsService.js`
- `src/services/Produksi/productionBomsService.js`
- `src/services/Produksi/semiFinishedMaterialsService.js`
- `src/services/Produksi/productionPayrollsService.js`
- `src/utils/produksi/productionPayrollRuleHelpers.js`
- `src/pages/Produksi/ProductionHppAnalysis.jsx`
- `backend/src/db/schema.js`
- `backend/src/db/migrate.js`
- `src/data/sync/runtime-arsipToLocalMasterDataSyncService.js`
- `src/pages/Utilities/components/OfflineDatabaseCenter.jsx`
- `docs/03_BUSINESS_RULES.md`
- `docs/04_PRODUCTION_ARCHITECTURE.md`
- `docs/08_INTEGRATION_MAP.md`
- `docs/10_OFFLINE_DATABASE_CONTRACT.md`

File relevan yang tidak ditemukan sebagai service terpisah:

- Tidak ada service khusus bernama `hppService.js`. HPP saat ini dihitung dari Work Log completed + payroll + helper `productionPayrollRuleHelpers` dan dibaca di `ProductionHppAnalysis.jsx`.
- Tidak ada offline production draft runtime terpisah. Batch 43 masih concept/contract, bukan UI create/edit draft.

Batasan validasi:

- database arsip rules/index di repo dicek sebagai file repo, tetapi konfigurasi produksi runtime arsip Console tetap perlu diverifikasi manual.
- Patch ini tidak membaca data runtime arsip live; validasi hanya dari source ZIP.

## 2. Business rule produksi yang harus tetap

Rule domain yang tidak boleh berubah saat persiapan offline:

- 1 bunga mawar = 10 petals + 1 leaf + 1 stem.
- 1 meter bahan petal = sekitar 480 petals.
- 1 meter bahan leaf = sekitar 256 leaves.
- 1 wire/stem 40 cm = sekitar 2 stems.
- Labor yang tampil di UI boleh memakai estimasi step agar user tidak melihat 0 yang menyesatkan.
- HPP final tetap hanya dari payroll final/confirmed/paid atau step yang memang tidak masuk HPP.
- Lem tembak/glue adalah material usage assembly, bukan overhead utama.
- Scrap/QC belum menjadi workflow utama kecuali ada batch khusus.

## 3. Source of truth production

| Area | Source utama | Offline Batch 41-44 |
|---|---|---|
| Production Planning | runtime arsip `production_plans` via `productionPlanningService` | Snapshot read-only |
| Production Orders | runtime arsip `production_orders` via `productionOrdersService` | Snapshot read-only |
| Work Logs | runtime arsip `production_work_logs` via `productionWorkLogsService` | Snapshot read-only |
| BOM | runtime arsip `production_boms` via `productionBomsService` | Snapshot read-only |
| Semi Finished | runtime arsip `semiFinishedMaterials` via service produksi | Tidak dimutasi offline |
| Raw Material usage | Ditentukan saat Work Log/consume material online | Tidak boleh consume offline |
| Payroll | runtime arsip `production_payrolls` via `productionPayrollsService` | Snapshot read-only |
| HPP | Derived dari Work Log completed + Payroll + helper HPP | Snapshot derived read-only |
| Overhead | Work Log actual/estimation sesuai source aktif | Snapshot read-only |
| Glue usage | Material usage, bukan overhead | Tidak boleh consume offline |

## 4. Batch 41 — Production Architecture Re-Audit

Kesimpulan audit:

- Production bukan kandidat offline write awal karena menyentuh stock, raw material usage, semi finished output, payroll, HPP, dan finance expense dari payroll paid.
- Work Log completed dapat memicu payroll generation dan HPP reconcile di service online. Flow ini tidak boleh dipindah ke UI/offline.
- Payroll paid membuat expense otomatis secara guarded dan idempotent. Offline write payroll bisa menyebabkan cash out double jika belum ada conflict/idempotency contract khusus.
- HPP final sudah tergantung helper `resolveWorkLogLaborCostDisplay` dan status payroll final. Offline tidak boleh membuat final HPP sendiri.

Risiko utama bila production dibuat offline write terlalu cepat:

1. Double consume raw material.
2. Stock semi finished/product tidak sinkron.
3. Payroll line double.
4. HPP final salah karena memakai draft/estimasi sebagai final.
5. Expense payroll paid double.
6. Inventory log/audit log tidak lengkap.
7. BOM bertingkat membaca average cost lama.

## 5. Batch 42 — Production Offline Read-Only Snapshot

Implementasi yang disetujui untuk batch ini:

- Local storage browser arsip schema naik ke versi 2 untuk menambahkan table snapshot produksi.
- Snapshot production bersifat read-only dan tidak masuk `sync queue arsip`.
- Pull snapshot membutuhkan keyword:

```txt
PULL PRODUCTION SNAPSHOT READ ONLY
```

Table snapshot lokal:

| Local table | Isi |
|---|---|
| `production_plans` | Planning snapshot |
| `production_orders` | Order snapshot |
| `production_work_logs` | Work Log snapshot |
| `production_boms` | BOM snapshot |
| `production_payrolls` | Payroll snapshot read-only |
| `production_hpp_snapshots` | HPP snapshot derived read-only |

Guard snapshot:

- `readOnlySnapshot = true`
- `offlineMutationAllowed = false`
- `syncStatus = synced`
- `syncMetadata.scope = production_readonly_snapshot`
- audit lokal ditulis ke `audit_logs` module `local_db_production_snapshot`

Yang tetap tidak boleh:

- Start production offline.
- Finish production offline.
- Consume raw material offline.
- Add/update Work Log final offline.
- Create payroll offline.
- Mark payroll paid offline.
- Finalize HPP offline.
- Push production snapshot ke runtime arsip.

## 6. Batch 43 — Production Draft Concept

Konsep aman, belum runtime aktif:

- Offline production note/draft hanya boleh menjadi catatan lokal untuk persiapan input saat online.
- Draft tidak boleh mengubah stock, reserved stock, available stock, inventory log, production order status, work log status, payroll, finance, atau HPP.
- Saat online, user wajib review ulang lalu commit lewat flow runtime arsip resmi.

Field contract draft yang disarankan bila nanti dibuat batch terpisah:

| Field | Fungsi |
|---|---|
| `id` | Local draft id |
| `draftType` | `production_note`, `planning_note`, atau `work_log_note` |
| `relatedPlanId` | Opsional, referensi planning runtime arsip jika ada |
| `relatedOrderId` | Opsional, referensi order runtime arsip jika ada |
| `relatedWorkLogId` | Opsional, referensi Work Log runtime arsip jika ada |
| `title` | Judul catatan user |
| `notes` | Isi draft/note |
| `attachmentsLocalOnly` | Opsional, metadata attachment lokal bila nanti disetujui |
| `createdAt` | Timestamp lokal |
| `updatedAt` | Timestamp lokal |
| `createdBy` | Actor lokal |
| `reviewStatus` | `draft`, `ready_for_online_review`, `discarded` |

Batch ini belum menambahkan table draft runtime untuk menghindari persepsi bahwa production offline write sudah aktif.

## 7. Batch 44 — Payroll & HPP Guard Contract

Payroll/HPP tetap online/runtime arsip-primary.

Rule guard:

- Draft payroll boleh muncul sebagai preview UI/read-only, tetapi tidak boleh menjadi HPP final.
- Payroll final untuk HPP hanya status `confirmed`, `paid`, atau `paymentStatus = paid`, dengan compatibility data historis untuk data historis yang sudah punya final amount valid.
- Payroll paid tetap membuat cash out/expense dari service online dengan idempotency guard.
- Work Log relation wajib memakai `workLogId` dan/atau `workNumber`.
- HPP final per unit hanya valid jika goodQty > 0 dan labor source final siap.
- Overhead mengikuti `overheadCostActual` Work Log; glue/lem tetap material usage, bukan overhead utama.

Offline yang boleh:

- Baca payroll snapshot.
- Baca HPP snapshot derived.
- Menampilkan status apakah HPP final ready atau masih preview.

Offline yang tidak boleh:

- Create/update/delete payroll.
- Confirm payroll.
- Mark payroll paid.
- Membuat expense payroll.
- Menulis `laborCostActual`, `totalCostActual`, `costPerGoodUnit`, atau output HPP ke runtime arsip.

## 8. UI contract

`Offline Database Center` memiliki tab `Snapshot Produksi` untuk:

1. Preview Production Snapshot.
2. Pull Production Snapshot dengan keyword guarded.
3. Menampilkan daftar action yang diblokir.
4. Membaca data local snapshot melalui tab `Data Local`.

UX harus jelas bahwa ini bukan production offline runtime. Label yang dipakai: **read-only**, **runtime arsip-primary**, dan **tidak bisa push balik ke runtime arsip**.

## 9. Test checklist

Manual test minimal:

1. Buka Testing & Reset Center.
2. Buka Offline Database Center.
3. Klik `Siapkan Local DB`.
4. Pastikan schema local menjadi versi 2.
5. Buka tab `Snapshot Produksi`.
6. Preview `Planning snapshot`.
7. Isi keyword `PULL PRODUCTION SNAPSHOT READ ONLY`.
8. Pull snapshot dan pastikan berhasil tanpa membuat `sync queue arsip`.
9. Ulangi untuk `Production Order`, `Work Log`, `BOM`, `Payroll`, dan `HPP` snapshot.
10. Buka tab `Data Local`, pilih table production, pastikan data tampil read-only.
11. Pastikan tab Offline → runtime arsip tetap hanya berisi Categories/Customers.
12. Pastikan tidak ada tombol start/finish production, consume material, create payroll, atau finalize HPP di offline center.
13. Jalankan lint/build.

## 10. Keputusan

Keputusan Batch 41-44: **aman lanjut hanya sebagai read-only snapshot dan contract**.

Belum disarankan:

- Offline production mutation.
- Offline payroll mutation.
- Offline HPP finalization.
- Offline raw material consumption.
- Offline stock mutation dari production.
- Runtime production draft UI sebelum ada batch UI/field approval terpisah.

## Update C8 SQLite Production Foundation

Endpoint foundation baru:

```text
/api/production/steps
/api/production/employees
/api/production/profiles
/api/production/boms
/api/production/planning
/api/production/orders
/api/production/work-logs
/api/production/payrolls
```

Status awal: storage/foundation guarded. Bagian P4 di bawah menggantikan batasan runtime yang sudah selesai diaudit dan dipindahkan ke backend atomic.

Access guard source aktual:

- `/api/production/planning`, `/api/production/orders`, dan `/api/production/work-logs` tetap dapat dibaca role operasional `administrator + user`.
- `/api/production/payrolls` memakai authenticated session + Administrator read guard.
- Tidak ada endpoint HPP terpisah. HPP Analysis di frontend derived dari Work Log completed dan Payroll; route analisis tetap Administrator-only.

Batasan yang tetap berlaku:

- Draft/generic CRUD tidak boleh melakukan material consume, output posting, payroll paid, finance posting, atau HPP reconcile.
- Work log final, payroll final/paid, dan HPP final tetap mengikuti rule material actual + accrued labor saat Complete + final payroll adjustment.
- Jangan memblokir read Work Log operasional hanya karena payload membawa snapshot biaya; pembatasan halaman Payroll/HPP dan dataset Payroll tetap guard utama tanpa merusak flow produksi harian.

## P4 SQLite Production Atomic Contract — 2026-06-20

Source aktual menetapkan backend sebagai satu-satunya writer lifecycle produksi. Frontend hanya mengirim perintah/payload operasional ke endpoint commit berikut:

```text
POST /api/production/orders/commit
POST /api/production/planning/:id/create-order
POST /api/production/planning/:id/cancel
POST /api/production/orders/:id/refresh-requirements
POST /api/production/orders/:id/start
POST /api/production/work-logs/:id/complete
POST /api/production/work-logs/:id/generate-payrolls
POST /api/production/payrolls/:id/finalize
POST /api/production/payrolls/:id/mark-paid
```

### Atomic boundary

- Planning → PO: insert PO, update `productionOrderId/orderId`, status `ordered`, dan audit berada dalam satu SQLite transaction.
- Start Production: semua material-out, master stock, stock read model, inventory log, snapshot cost, Work Log, status PO, dan audit berada dalam satu transaction.
- Complete Work Log: legacy material fallback bila diperlukan, output-in, payroll draft per operator, accrued HPP, status Work Log/PO, master output cost, dan audit berada dalam satu transaction.
- Payroll Paid: expense, money movement ledger, status/payment status payroll, HPP reconcile, output master cost reconcile, dan audit berada dalam satu transaction.
- Jika salah satu write gagal, seluruh write dalam boundary tersebut rollback. Material yang sudah sah dipotong pada transaction Start sebelumnya tidak dipotong ulang saat retry Complete.

### Source of truth dan anti-tamper

- `bomId` adalah source of truth target dan requirement PO. Payload frontend tidak boleh mengganti target item/type dari BOM.
- Step Start Production harus ada pada `stepLines` BOM.
- Material usages, outputs, target, cost snapshot, stock flags, payroll flags, dan relation IDs yang sudah terbentuk dari Start tidak boleh dioverride melalui payload Complete atau generic update.
- Complete hanya menerima field penyelesaian operasional seperti Good Qty, actual output compatibility, operator, reject/rework/scrap compatibility, dan catatan.
- Payroll generic create hanya boleh `draft/unpaid`; confirmed/paid dan field finance wajib lewat endpoint resmi Administrator.
- Manual payroll tetap wajib terkait Work Log completed dan kombinasi Work Log + Step + Operator yang sama tidak boleh dibuat dua kali.
- Expense Payroll memakai source payroll dan deterministic current ID; compatibility expense legacy dengan source payroll yang sama juga dianggap sudah ada.

### HPP

- Complete Work Log memakai material snapshot actual dari Start dan accrued labor dari rule Tahapan Produksi agar output master siap dipakai produksi bertingkat.
- Payroll draft otomatis bukan source final approval, tetapi accrued amount-nya menjadi HPP sementara/operasional sesuai rule Tahapan Produksi.
- Payroll `confirmed/paid` menjadi final adjustment bila `finalAmount` berbeda; reconcile HPP tidak menambah qty output ulang.
- Work Log completed menyimpan `materialCostActual`, `laborCostActual`, `overheadCostActual`, `totalCostActual`, dan `costPerGoodUnit`.

### Access dan compatibility

- Planning, Orders, dan Work Logs tetap dapat ditulis role operasional melalui endpoint resmi.
- Payroll read/finalize/paid tetap Administrator-only sesuai role guard aktif.
- Endpoint `generate-payrolls` dipertahankan sebagai compatibility/idempotent repair; Work Log Complete sudah membuat payroll dalam transaction yang sama.
- Generic CRUD master produksi tetap tersedia, tetapi direct lifecycle write Planning/PO/Work Log/Payroll ditolak backend.
- Tidak ada perubahan schema/collection/database pada P4.
