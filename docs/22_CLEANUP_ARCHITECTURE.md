# CLEANUP ARCHITECTURE — IMS Bunga Flanel

Status: **AKTIF / SOURCE-VERIFIED / BEHAVIOR-PRESERVING**  
Tanggal validasi: **2026-06-28**

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
