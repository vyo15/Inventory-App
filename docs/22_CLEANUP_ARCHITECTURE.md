# CLEANUP ARCHITECTURE — IMS Bunga Flanel

Status: **AKTIF / SOURCE-VERIFIED / BEHAVIOR-PRESERVING**  
Tanggal validasi: **2026-07-01**

Dokumen ini mengunci hasil cleanup C0–C16. Cleanup merapikan authority, folder, facade, duplikasi, dan komponen UI tanpa mengubah schema, route, role guard, atau flow bisnis guarded.

## Prinsip authority

- Backend tetap satu-satunya authority mutation SQLite.
- Stock mutation berada di `backend/src/modules/stock/engine/`.
- Finance movement berada di `backend/src/modules/finance/finance.engine.js`.
- Backup package/lifecycle berada di `backend/src/modules/maintenance/backup/`.
- Generic SQLite JSON HTTP router berada di `backend/src/infrastructure/http/sqliteJsonRecordRouter/`.
- HPP commit/reconcile tetap authority backend Production; frontend hanya membentuk input, validasi UI, dan tampilan.
- Formula katalog Supplier memakai canonical pure ESM core di `shared/supplierCatalogPricing.core.js`; file `.cjs` hanya compatibility facade untuk backend CommonJS.
- Password validator memakai canonical ESM core di `shared/passwordPolicy.core.js`; backend CommonJS memakainya melalui dukungan `require(ESM)` Node 22.12+, sedangkan `passwordPolicy.core.cjs` hanya facade kompatibilitas.

## Compatibility facade

Path berikut tetap dipertahankan sebagai re-export tipis agar compatibility import lama tidak putus:

- `backend/src/utils/sqliteStockEngine.js`
- `backend/src/utils/sqliteFinanceEngine.js`
- `backend/src/utils/sqliteBackup.js`
- `backend/src/shared/sqliteJsonRecordRoutes.js`

Internal backend baru wajib memakai canonical module path. Facade tidak boleh kembali berisi business logic.

## Struktur backend aktif

```text
backend/src/modules/stock/engine/
├── stockSourceRegistry.js
├── stockVariantDomain.js
├── stockPersistence.js
├── inventoryMasterGuards.js
├── stockMutationEngine.js
└── index.js

backend/src/modules/maintenance/backup/
├── backupConstants.js
├── backupPath.js
├── backupPackage.js
├── backupValidation.js
├── backupCreate.js
├── backupLifecycle.js
└── index.js

backend/src/infrastructure/http/sqliteJsonRecordRouter/
├── operationResult.js
├── recordMapper.js
├── businessCodeAdapter.js
├── writeOperation.js
├── createSqliteJsonRecordRouter.js
└── index.js
```

Service besar memakai facade public dan modul internal berdasarkan tanggung jawab:

- Supplier: identity, catalog, shared primitives.
- Transactions: purchase/sale commit, returns, sales status, valuation, finance, validation, router definitions.
- Production: order, Work Log, Payroll, cost/payroll shared, guards.
- Maintenance: data quality, backup transfer, restore, catalog, setup.

## Shared contract lintas frontend/backend

- `shared/authContract.json`: role aktif, status user, username pattern, session duration.
- `shared/categoryContract.json`: category type, alias, prefix, default type.
- `shared/businessCodeContract.json`: pola kode Customer dan Supplier.
- `shared/passwordPolicy.config.json`: konfigurasi kebijakan password.

Backend tetap enforcement utama. Shared contract tidak boleh digunakan untuk melonggarkan route atau role guard.

## Frontend shared UI dan orchestration

- `CompactCell` dan `CompactCellText` menjadi primitive resmi untuk cell tabel bertingkat, ellipsis, tooltip, dan fallback.
- Cash In dan Cash Out berbagi `CashFlowPageShell` untuk struktur presentational (header, summary, filter, table, dan modal), tetapi service call, source classification, delete guard, serta business page tetap terpisah.
- Purchase memakai satu default builder, satu quantity field, dan helper mutation-result bersama Return.
- Detail drawer Produk, Bahan Baku, Supplier, Penjualan, dan channel Penjualan dipisahkan dari page orchestration.
- Page tetap memanggil service existing; business mutation tidak dipindahkan ke komponen presentasi.
- Repository-mode switcher frontend yang hanya memiliki satu mode SQLite sudah dihapus; repository domain tipis tetap dipertahankan agar page tidak mengikat langsung ke transport.
- Form/detail/modal anak dipisahkan dari page Produksi, Sales, Purchases, Products, Raw Materials, Supplier Purchase, Pricing Rules, Stock Adjustment, Stock Management, Dashboard, Database Center, dan User Management.
- `OfflineDatabaseCenter.jsx` mempertahankan handler guarded backup/restore, sementara coverage, technical/runtime status, dan restore preview berada pada komponen presentational terpisah.
- Komponen form besar menerima contract props terkelompok (`formState`, `referenceData`, `selectionState`, `actions`, dan kelompok domain terkait), bukan puluhan prop datar. Grouping hanya mengurangi coupling presentational; mutation dan derived business state tetap dimiliki page/service.
- Close/reset drawer yang sebelumnya menyebarkan setter individual dipusatkan pada callback parent seperti `closeFormDrawer`, sehingga child tidak mengatur lifecycle page secara langsung.
- Konfigurasi tabel, mobile card, dan detail column yang murni presentational ditempatkan pada helper/list component domain existing untuk Production Order, BOM, Work Log, Sales, dan Purchase. Handler mutation tetap diinjeksi dari page; helper tidak mengakses service atau menulis data.
- Seluruh page entry produksi dan transaksi utama kini berada di bawah 1.000 baris. `Purchases.jsx` tetap menjadi orchestration boundary guarded untuk OCR, supplier catalog, stock-in, expense, dan commit atomic; subscription reference data dan form snapshot berada pada hook lokal read-only, sementara authority write tetap di page/service resmi.
- Form hasil ekstraksi wajib memiliki behavioral test minimal untuk close guard, loading/disabled guard, atau callback submit yang relevan; source-string test tetap boleh dipakai sebagai architecture guard, tetapi bukan pengganti interaction contract.
- Dashboard visual, quick action, dan checklist setup berada pada komponen/helper domain Dashboard; restore guard dan auth mutation tetap di page/service pemiliknya.
- Cleanup CSS dilakukan scoped. `!important` tidak boleh dihapus massal tanpa visual regression light/dark, desktop/mobile, modal, table, dan Ant Design override.
- Export XLSX/CSV menetralkan string yang dapat dieksekusi sebagai formula spreadsheet. Data sumber tidak diubah; sanitasi hanya berlaku pada file export.
- Sales, Purchases, dan Profit/Loss Report berbagi `ReportPeriodFilterSection` untuk layout/filter tanggal; query, mapping, summary, dan export tetap domain-specific.

## Source hygiene guard

Automated test wajib menjaga:

- facade engine tetap tipis;
- internal backend tidak kembali mengimpor legacy facade path;
- password dan formula Supplier tidak kembali di-copy-paste;
- frontend tidak mengambil authority HPP;
- runtime database, backup, log, build output, dan generated artifact tidak masuk source ZIP;
- line ending JavaScript, CSS, JSON, dan Markdown tetap LF.
- normalizer text/integer tetap memakai utility canonical dan tidak kembali didefinisikan per module.
- source-runtime test menolak unused PascalCase import yang dapat terlewat oleh konfigurasi ESLint legacy.

### Shared safety dan audit metadata

- Path containment, realpath ancestor, dan perbandingan path Windows case-insensitive memakai `backend/src/utils/pathSafety.js`. Maintenance backup, environment sandbox, logger, dan test database tidak boleh mendefinisikan ulang guard path.
- Actor audit request memakai `backend/src/utils/requestActor.js`; fallback tetap `system` dan controller domain tetap menentukan kapan audit ditulis.
- Metadata actor/timestamp frontend Produksi memakai `productionAuditMetadata.js`; helper tidak memiliki authority mutation, Payroll, atau HPP.
- `scripts/verify-source-ready.cjs` menolak runtime artifacts sekaligus metadata paket patch (`_PATCH_*`, `_IMS_*`, dan folder `*changed-files*`).

### Normalisasi text dan integer

- Frontend memakai `frontend/src/utils/text/textNormalization.js`. `normalizeText` mempertahankan primitive falsy valid, sedangkan `normalizeTruthyText` hanya dipakai untuk compatibility caller lama yang memang menganggap `0`/`false` sebagai kosong.
- Backend memakai `backend/src/utils/textNormalization.js`; integer legacy yang sebelumnya bernama `toInteger` dipusatkan sebagai `toRoundedInteger` agar perilaku `Math.round` terlihat eksplisit.
- Migrasi tidak boleh mengganti semantics `??` menjadi `||` atau sebaliknya tanpa test matrix `undefined`, `null`, string, `0`, `false`, decimal, `Infinity`, dan `NaN`.
- `suppliers.shared.js` memakai integer helper canonical dari `shared/supplierCatalogPricing` dan tidak mendefinisikan ulang helper yang sama.
- Frontend numeric conversion memakai `frontend/src/utils/number/numberNormalization.js`; utility dibedakan menjadi finite number dan rounded integer. Clamp minimum/positive tetap menjadi keputusan domain caller.
- Adapter read-only Stock/Finance/Pricing menetralkan nilai legacy non-finite, tetapi mutation authority, stock formula, ledger, dan pricing calculation tetap di service/backend resmi.
- Presentasi saving lintas Cash Out dan Purchases Report memakai `frontend/src/utils/finance/savingPresentation.js`; helper hanya menghasilkan label/status/color dan tidak memengaruhi ledger atau expense.

### Residual guarded yang belum dipecah

- `productionWorkLogsServiceHelpers.js` tetap menjadi cleanup candidate karena mencakup draft builder, payload normalization, compatibility, Payroll, dan HPP explanation. File ini tidak boleh dipecah dalam cleanup umum sebelum characterization test Work Log/Payroll/HPP lengkap.
- `xlsx` dan `esbuild` tetap residual dependency. Jangan mengubah package/lockfile tanpa tarball resmi, install Windows, export regression, dan build offline yang terverifikasi.

## Area yang sengaja tidak berubah

- Schema dan versi database.
- Route, sidebar, menu, serta role access matrix.
- Formula stok, lifecycle Sales/Return, Purchase verification, Production, Payroll, dan HPP.
- Format `.imsbackup`, manifest, checksum, retention, dan confirm guard restore.
- Audit-log semantics dan kode bisnis user-facing.

## Aturan cleanup lanjutan

1. Jangan menghapus facade sebelum import audit membuktikan seluruh consumer lama sudah aman.
2. Jangan menggabungkan architecture refactor dengan perubahan business rule.
3. Jangan membuat generic CRUD/business engine yang melewati domain service.
4. Page besar hanya dipecah berdasarkan tanggung jawab nyata; jangan memindahkan business logic ke UI.
5. Setiap cleanup guarded wajib melewati full backend test, frontend lint/test/build, dan manual regression domain terkait.

## Convention konsistensi aktif — 2026-06-29

### Error backend

- Error domain memakai `backend/src/utils/httpError.js`; validasi pengguna tidak boleh memakai plain `Error` yang jatuh menjadi HTTP 500.
- Controller baru meneruskan error ke global handler. Local responder lama hanya compatibility dan tidak boleh disalin ke module baru.
- Detail error hanya boleh dikirim jika sudah disanitasi dan memakai `exposeDetails: true`.
- Kontrak lengkap berada di `docs/23_BACKEND_ERROR_CONTRACT.md`.

### Naming teknis

- Folder/file teknis baru memakai English.
- Label, title, helper text, dan copy UI tetap Bahasa Indonesia.
- Folder legacy `Produksi`, `Transaksi`, dan `Laporan` dipertahankan untuk compatibility; jangan dijadikan contoh naming module baru dan jangan di-rename tanpa audit import/dynamic import/route/test/casing lintas Windows-Linux.

### Shared UI

- Status visual memakai `StatusTag` dan resolver domain; jangan membuat satu `getStatusColor()` universal lintas domain.
- Empty state utama memakai `EmptyStateBlock`; `DataTableView` memakai contract `loading/error/empty/data` dan retry terpisah.
- Feedback Ant Design dari component memakai `App.useApp()`. Static `message`/`Modal.*` tidak boleh ditambahkan kembali.
- Mobile card yang clickable wajib keyboard-accessible melalui shared `DataTableView`.

### CSS dan source hygiene

- JavaScript, CSS, JSON, serta Markdown wajib LF melalui `.editorconfig`, `.gitattributes`, dan `sourceHygiene.test.js`.
- Warna brand pada component memakai semantic CSS token, bukan menyalin literal hex dari `index.css`.
- Normalisasi EOL tidak boleh dicampur dengan perubahan business rule guarded.

### Dokumentasi inline backend

`// SECTION:` diprioritaskan saat file backend kompleks sedang disentuh, terutama Maintenance, Testing Lab, Realtime, Auth, Stock Engine, dan Production lifecycle. Komentar harus menjelaskan invariant, transaction boundary, destructive side effect, atau audit behavior—bukan mengulang nama fungsi. Jangan menambahkan komentar massal tanpa review logic.
