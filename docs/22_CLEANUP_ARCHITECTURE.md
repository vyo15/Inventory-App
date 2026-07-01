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
- Cash In dan Cash Out berbagi filter periode, tetapi business page tetap terpisah.
- Purchase memakai satu default builder, satu quantity field, dan helper mutation-result bersama Return.
- Detail drawer Produk, Bahan Baku, Supplier, Penjualan, dan channel Penjualan dipisahkan dari page orchestration.
- Page tetap memanggil service existing; business mutation tidak dipindahkan ke komponen presentasi.
- Repository-mode switcher frontend yang hanya memiliki satu mode SQLite sudah dihapus; repository domain tipis tetap dipertahankan agar page tidak mengikat langsung ke transport.
- Form/detail/modal anak dipisahkan dari page Produksi, Sales, Purchases, Products, Raw Materials, Supplier Purchase, Pricing Rules, Stock Adjustment, Stock Management, Dashboard, Database Center, dan User Management.
- Komponen form besar menerima contract props terkelompok (`formState`, `referenceData`, `selectionState`, `actions`, dan kelompok domain terkait), bukan puluhan prop datar. Grouping hanya mengurangi coupling presentational; mutation dan derived business state tetap dimiliki page/service.
- Close/reset drawer yang sebelumnya menyebarkan setter individual dipusatkan pada callback parent seperti `closeFormDrawer`, sehingga child tidak mengatur lifecycle page secara langsung.
- Konfigurasi tabel, mobile card, dan detail column yang murni presentational ditempatkan pada helper/list component domain existing untuk Production Order, BOM, Work Log, Sales, dan Purchase. Handler mutation tetap diinjeksi dari page; helper tidak mengakses service atau menulis data.
- Page entry produksi yang sebelumnya di atas 1.000 baris sudah turun di bawah batas tersebut. `Purchases.jsx` tetap lebih besar karena menjadi orchestration boundary guarded untuk OCR, supplier catalog, stock-in, expense, dan commit atomic; pemecahan business flow ditunda sampai tersedia characterization test yang lebih lengkap.
- Form hasil ekstraksi wajib memiliki behavioral test minimal untuk close guard, loading/disabled guard, atau callback submit yang relevan; source-string test tetap boleh dipakai sebagai architecture guard, tetapi bukan pengganti interaction contract.
- Dashboard visual, quick action, dan checklist setup berada pada komponen/helper domain Dashboard; restore guard dan auth mutation tetap di page/service pemiliknya.
- Cleanup CSS dilakukan scoped. `!important` tidak boleh dihapus massal tanpa visual regression light/dark, desktop/mobile, modal, table, dan Ant Design override.
- Export XLSX/CSV menetralkan string yang dapat dieksekusi sebagai formula spreadsheet. Data sumber tidak diubah; sanitasi hanya berlaku pada file export.

## Source hygiene guard

Automated test wajib menjaga:

- facade engine tetap tipis;
- internal backend tidak kembali mengimpor legacy facade path;
- password dan formula Supplier tidak kembali di-copy-paste;
- frontend tidak mengambil authority HPP;
- runtime database, backup, log, build output, dan generated artifact tidak masuk source ZIP;
- line ending JavaScript tetap LF.

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

- JavaScript serta CSS wajib LF melalui `.editorconfig`, `.gitattributes`, dan `sourceHygiene.test.js`.
- Warna brand pada component memakai semantic CSS token, bukan menyalin literal hex dari `index.css`.
- Normalisasi EOL tidak boleh dicampur dengan perubahan business rule guarded.

### Dokumentasi inline backend

`// SECTION:` diprioritaskan saat file backend kompleks sedang disentuh, terutama Maintenance, Testing Lab, Realtime, Auth, Stock Engine, dan Production lifecycle. Komentar harus menjelaskan invariant, transaction boundary, destructive side effect, atau audit behavior—bukan mengulang nama fungsi. Jangan menambahkan komentar massal tanpa review logic.
