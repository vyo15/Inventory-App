<!--
PATCH A-B NOTE — 2026-06-02:
Dokumen ini adalah arsip historis Batch offline database browser arsip. Source aktif sekarang memakai SQLite sidecar lewat backend Node.js lokal/LAN. Jangan mengikuti instruksi runtime database browser arsip, sync queue arsip, conflict resolver, atau backup JSON storage browser arsip dari dokumen arsip ini. Kontrak terbaru ada di docs/10_OFFLINE_DATABASE_CONTRACT.md dan docs/17_SQLITE_OFFLINE_WEB_ROADMAP.md.
-->

<!--
PATCH CLEANUP NOTE — 2026-06-08:
Referensi source aktif diselaraskan ke arsitektur SQLite sidecar. Path storage browser lama dihapus dari daftar validasi agar tidak dianggap runtime aktif.
-->

# 13 Offline Returns, Finance, dan Reports Contract

Status: **ARSIP HISTORIS / SUPERSEDED BY SQLITE RUNTIME / JANGAN DIPAKAI SEBAGAI INSTRUKSI AKTIF**.

Dokumen ini mengunci hasil Fase 5 Batch 38–40 untuk persiapan offline database. Tidak ada runtime migration, tidak ada perubahan schema database arsip, tidak ada perubahan schema SQLite sidecar, dan tidak ada offline mutation untuk Return, Finance, atau Report final.

## 1. Validasi source aktual

File ZIP yang divalidasi: `Inventory-App-clean.zip`.

File source yang dicek:

- `src/services/Transaksi/returnsService.js`
- `src/pages/Transaksi/Returns.jsx`
- `src/services/Transaksi/salesService.js`
- `src/services/Transaksi/purchasesService.js`
- `src/pages/Finance/CashIn.jsx`
- `src/pages/Finance/CashOut.jsx`
- `src/services/Finance/moneyMovementLedgerService.js`
- `src/services/Laporan/reportsService.js`
- `src/services/Laporan/stockReportService.js`
- `src/services/Dashboard/dashboardService.js`
- `src/pages/Laporan/SalesReport.jsx`
- `src/pages/Laporan/PurchasesReport.jsx`
- `src/pages/Laporan/ProfitLossReport.jsx`
- `src/pages/Laporan/StockReport.jsx`
- `src/pages/Laporan/PayrollReport.jsx`
- `backend/src/db/schema.js`
- `backend/src/db/migrate.js`
- `frontend/src/data/adapters/sqlite/sqliteApiClient.js`
- `src/data/sync/runtime-arsipToLocalMasterDataSyncService.js`
- `src/pages/Utilities/components/OfflineDatabaseCenter.jsx`
- `docs/03_BUSINESS_RULES.md`
- `docs/08_INTEGRATION_MAP.md`
- `docs/10_OFFLINE_DATABASE_CONTRACT.md`
- `docs/12_OFFLINE_PRODUCTS_RAW_SEMI_CONTRACT.md`

File relevan yang tidak ditemukan:

- Tidak ditemukan service khusus `returnRefundService`, `returnFinanceService`, atau `returnSalesRelationService`.
- Tidak ditemukan repository/offline adapter untuk `returns`, `revenues`, `incomes`, `expenses`, `reports`, atau `dashboard_snapshots`.
- Tidak ditemukan table local khusus report snapshot pada `LOCAL_DB_TABLES`.

Batasan validasi:

- Validasi hanya berdasarkan source dan docs di ZIP ini.
- database arsip rules, composite index, dan data produksi tidak tersedia di ZIP, sehingga kontrak ini tidak mengklaim validasi security rules di runtime arsip Console.
- Tidak ada pengujian runtime browser/runtime arsip karena patch ini docs-only.

## 2. Batch 38 — Returns Audit

### 2.1 Returns integration map aktual

```text
Returns.jsx
-> createReturnTransaction(values, allItems)
-> returnsService.js
-> transaksi database arsip
   -> reserve/generate RET-DDMMYYYY-001
   -> read latest item from products/raw_materials
   -> validate item + variant
   -> set returns/{returnNumber}
   -> update products/raw_materials currentStock/availableStock via variant helper
   -> set stock_item_read_models via setStockItemReadModelInTransaction()
   -> set inventory_logs/{autoId} type return_in
```

Return aktif adalah **stock-only correction**. Source aktual menulis `returns`, stok item, `stock_item_read_models`, dan `inventory_logs`. Source aktual tidak menulis `sales`, `incomes`, `revenues`, `expenses`, refund, atau ledger.

### 2.2 Risiko double return

Risiko yang ditemukan:

- Return belum punya relasi wajib ke `sales` atau sale line, sehingga sistem belum bisa membatasi total return terhadap qty yang pernah terjual.
- Return yang sama bisa dibuat dua kali secara operasional jika user memilih item/varian/qty/catatan yang sama dua kali. Guard UI `isSubmittingReturn` hanya mencegah double click dalam satu submit, bukan duplikasi bisnis lintas waktu.
- Tidak ada idempotency key seperti `returnIntentId`, `sourceSaleId`, `sourceSaleLineId`, atau `sourceInventoryLogId`.
- Karena Return tidak membuat refund, finance tidak double saat ini. Risiko double yang paling aktif adalah stok masuk dan `inventory_logs return_in` dobel.

Keputusan aman:

- Return **tidak boleh** menjadi offline mutation pada fase ini.
- Return offline hanya boleh berupa draft read-only/unsynced concept pada batch terpisah, dan draft itu tidak boleh menambah stok, tidak boleh masuk finance, dan tidak boleh masuk final report.
- Sebelum Return final offline, wajib ada desain idempotency dan relasi sumber yang jelas.

### 2.3 Refund rule

Rule aktif:

- Return tidak membuat refund otomatis.
- Return tidak membuat `incomes`, `revenues`, atau `expenses`.
- Buku Besar Kas dan Profit/Loss tidak membaca `returns` sebagai sumber nominal uang.

Rule future yang wajib approval:

- Refund harus menjadi flow finance terpisah, bukan efek otomatis dari Return stock correction.
- Refund wajib punya reference ke Return dan Sales jika tersedia.
- Refund tidak boleh menghapus income Sales lama secara diam-diam; koreksi kas harus menjadi dokumen finance/audit terpisah.
- Refund wajib idempotent agar retry/offline sync tidak membuat uang keluar dua kali.

### 2.4 Stock restore rule

Rule aktif:

- Return menambah `currentStock` item/varian sesuai `quantity`.
- Item bervarian wajib memilih `variantKey`; jika varian tidak ditemukan, transaction dibatalkan.
- `reservedStock` tidak diubah oleh Return.
- `availableStockAfter = currentStockAfter - reservedStockBefore`.
- `inventory_logs` wajib memiliki `type: return_in`, reference return, snapshot stok sebelum/sesudah, unit, dan metadata varian.

Rule guarded:

- Jangan restore stok dari offline/local draft.
- Jangan restore stok tanpa `inventory_logs`.
- Jangan restore stok dengan update UI saja; update stok, read model, dan log harus commit bersama.
- Jangan mengubah status Sales atau income Sales dari Return aktif.

## 3. Batch 39 — Finance Offline Contract

### 3.1 Finance source of truth aktual

```text
Cash In manual
-> revenues

Sales Selesai
-> incomes

Cash Out manual
-> expenses

Purchases committed
-> expenses sourceModule purchases

Payroll paid
-> expenses sourceModule production_payroll

MoneyMovementLedger
-> reads incomes + revenues + expenses only

ProfitLossReport
-> reads revenues + incomes + expenses only
```

Keputusan: Finance tetap **runtime arsip-primary**. Offline untuk finance hanya boleh read-only report snapshot, bukan ledger final yang bisa ditulis dari local.

### 3.2 Collection dan kontrak field finance

#### `revenues`

Sumber: Cash In manual / data historis income.

Field penting yang terlihat dari source:

- `cashInNumber`, `code`, `referenceNumber`, `sourceRef`
- `amount`
- `description`
- `date`
- `type`
- `sourceModule: cash_in_manual`
- `createdAt`

#### `incomes`

Sumber: Sales status `Selesai`.

Field penting yang terlihat dari source:

- `incomeNumber`, `code`, `sourceRef`, `referenceNumber`
- `relatedId` berisi `saleId`
- `description`
- `amount`
- `salesChannel`
- `sourceModule: sales`
- `date`, `createdAt`

#### `expenses`

Sumber: Cash Out manual, Purchase committed, Payroll paid.

Field penting yang terlihat dari source:

- `cashOutNumber` atau source reference turunan
- `code`, `referenceNumber`, `sourceRef`
- `amount`
- `description`
- `date`
- `type`
- `sourceModule`
- Purchase expense memakai `sourceModule: purchases`, `relatedPurchaseId`, `sourceId`, `sourceCollection: purchases`, supplier, saving metadata, dan stock metadata.
- Payroll expense memakai `sourceModule: production_payroll` dari flow payroll paid.

### 3.3 Risiko double finance

Risiko utama:

- Profit/Loss atau ledger akan double count jika membaca `sales` dan `incomes` sekaligus sebagai nominal utama.
- Profit/Loss atau ledger akan double count jika membaca `purchases` dan `expenses` sekaligus sebagai nominal utama.
- Payroll akan double count jika membaca `production_payrolls` dan `expenses` payroll paid sekaligus sebagai nominal utama.
- Return refund future bisa double jika refund ditulis lebih dari sekali tanpa idempotency key.
- Offline retry bisa membuat `income_ORD...`, `purchases__PUR...`, atau expense payroll dobel bila document ID dan source reference tidak dikunci.

Guard:

- Finance offline **tidak boleh** menulis `revenues`, `incomes`, atau `expenses`.
- Finance offline **tidak boleh** masuk `sync queue arsip`.
- Offline report snapshot **tidak boleh** dipakai sebagai sumber posting ledger baru.
- Report snapshot hanya cache baca, bukan sumber truth.

### 3.4 Finance read-only snapshot contract

Jika nanti dibuat runtime snapshot offline, minimal field snapshot:

| Field | Fungsi |
|---|---|
| `snapshotId` | ID snapshot lokal, bukan ID ledger final |
| `snapshotType` | `finance_summary`, `cash_in`, `cash_out`, `profit_loss` |
| `periodStart` | Awal periode snapshot |
| `periodEndExclusive` | Akhir periode eksklusif |
| `sourceCollections` | Contoh: `revenues,incomes,expenses` |
| `generatedFrom` | `sqlite_backend` |
| `pulledAt` | Waktu snapshot ditarik ke local |
| `isReadOnly` | Harus `true` |
| `summary` | Total pemasukan, pengeluaran, laba/rugi sesuai sumber final runtime arsip |
| `rows` | Optional row cache yang sudah dinormalisasi untuk display |
| `failedReads` | Collection yang gagal dibaca saat snapshot dibuat |

Larangan:

- Jangan menyimpan snapshot finance sebagai `revenues`, `incomes`, atau `expenses` local yang bisa di-sync balik.
- Jangan menghitung ulang finance final dari draft offline yang belum tersync.
- Jangan membuat tombol edit/delete ledger dari snapshot.

## 4. Batch 40 — Report Offline Snapshot

### 4.1 Report source aktual

```text
Dashboard summary
-> dashboardService reads stock_item_read_models, inventory_logs, production, payroll, expenses, incomes, revenues, sales, planning summary

Stock Report
-> stockReportService reads stock_item_read_models primary, fallback master stock

Sales Report
-> reportsService reads sales

Purchase Report
-> reportsService reads expenses filtered sourceModule purchases/type Pembelian

Profit/Loss Report
-> reportsService reads revenues + incomes + expenses
```

### 4.2 Snapshot yang boleh offline

Scope aman snapshot read-only:

- Dashboard summary snapshot.
- Stock report snapshot.
- Sales report snapshot.
- Purchase report snapshot.
- Finance summary / profit-loss snapshot.

Snapshot boleh digunakan untuk melihat data terakhir saat offline, tetapi harus menampilkan informasi waktu `pulledAt/generatedAt` dan status bahwa data adalah cache.

### 4.3 Yang tidak boleh

- Tidak boleh menghitung ulang transaksi final dari data offline yang belum sync.
- Tidak boleh menjadikan draft offline sebagai laporan final.
- Tidak boleh mengubah ledger dari offline.
- Tidak boleh membuat report snapshot menulis balik ke collection transaksi.
- Tidak boleh memakai snapshot untuk stock mutation, purchase receive, sales income, return stock restore, payroll payment, atau HPP final.

### 4.4 Field contract report snapshot

| Field | Fungsi |
|---|---|
| `snapshotId` | ID lokal snapshot |
| `reportType` | `dashboard_summary`, `stock_report`, `sales_report`, `purchase_report`, `finance_summary` |
| `periodStart` | Awal periode jika report periodik |
| `periodEndExclusive` | Akhir periode eksklusif jika report periodik |
| `filters` | Filter report saat snapshot dibuat |
| `sourceCollections` | Table/view SQLite backend yang dibaca |
| `sourceReadModel` | Contoh: `stock_item_read_models` untuk Stock Report |
| `pulledAt` | Waktu snapshot dibuat/ditarik |
| `generatedFrom` | Harus `sqlite_backend` untuk fase ini |
| `isFinalReport` | Harus `false` jika hanya cache offline |
| `isReadOnly` | Harus `true` |
| `summary` | Ringkasan KPI yang tampil |
| `rows` | Row report yang sudah dinormalisasi untuk display/export read-only |
| `failedReads` | Collection/query yang gagal dibaca |
| `warning` | Pesan stale/offline cache bila ada |

### 4.5 Offline report UX rule

UI snapshot offline harus jelas membedakan:

- **Data runtime arsip terbaru**: ketika online dan read langsung dari runtime arsip.
- **Snapshot offline**: ketika offline/cache, tampilkan badge `Snapshot Offline`, `pulledAt`, dan warning bahwa data tidak mencakup draft lokal yang belum tersync.

Report snapshot tidak boleh menampilkan tombol `Simpan`, `Posting`, `Sync ke Ledger`, `Ubah Stok`, atau aksi destructive.

## 5. Keputusan Fase 5

Keputusan resmi setelah audit source:

1. Returns belum aman untuk offline mutation karena belum punya relasi sale-line/idempotency/refund rule.
2. Finance tetap runtime arsip-primary; offline hanya read-only snapshot.
3. Report offline boleh dirancang sebagai snapshot read-only, bukan report final baru.
4. Tidak ada perubahan runtime, schema, route, menu, role guard, collection lama, schema SQLite sidecar, atau sync queue pada batch ini.
5. Fase berikutnya yang aman adalah desain table snapshot lokal secara eksplisit, tetapi itu termasuk schema local baru dan perlu approval terpisah.

## Update C7 SQLite Finance/Report Foundation

Endpoint foundation baru:

```text
/api/finance/incomes
/api/finance/expenses
/api/finance/ledger
/api/reports
```

Status: storage/snapshot foundation.

Access guard source aktual:

- `/api/finance/incomes`, `/api/finance/expenses`, dan `/api/finance/ledger` memakai authenticated session + Administrator read guard.
- `/api/reports` memakai authenticated session + Administrator read guard.
- Role `user` tidak boleh menggunakan endpoint tersebut untuk membangun finance/report Dashboard.

Batasan:

- Ledger/profit-loss final belum boleh dihitung ulang dari draft lokal.
- Report snapshot boleh disimpan sebagai data pendamping, bukan sumber final transaksi.
- Finance final tetap perlu audit idempotency, rollback, source reference, dan conflict rule.
