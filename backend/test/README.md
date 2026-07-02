# Backend Test Convention — IMS Bunga Flanel

Status: **AKTIF / SOURCE-VERIFIED**
Scope: test backend `node:test` pada database temporary yang dikonfigurasi sebelum source database di-import.

## Penamaan file

Gunakan suffix berdasarkan tujuan test, bukan memaksa satu test untuk satu file source:

- `*.unit.test.js`: pure helper, mapper, error contract, atau service tanpa database/network nyata.
- `*.integration.test.js`: route/middleware/HTTP boundary atau beberapa module yang berjalan bersama.
- `*.atomic.test.js`: transaction, rollback, idempotency, stock/finance/production side effect.
- `*.guard.test.js`: access guard, lifecycle guard, destructive guard, source-policy guard.
- `*.runtime.test.js`: scheduler, SSE, shutdown, queue, atau behavior process/runtime.
- `*.test.js`: compatibility untuk test existing yang belum diklasifikasikan; file baru sebaiknya memakai suffix di atas.

Jangan rename massal test existing hanya demi suffix. Rename dilakukan ketika file memang disentuh dan seluruh command/README/reference ikut diaudit.

## Coverage map domain

| Domain | Test utama |
|---|---|
| Auth/session/user | `auth.routes.integration.test.js`, `auth.service.test.js`, `authConcurrency.test.js` |
| Error HTTP | `errorHandler.unit.test.js`, `domainError.routes.integration.test.js` |
| Stock/inventory | `stockMutation.test.js`, `stockVariantDomain.test.js`, `inventoryMasterGuard.integration.test.js`, `domainError.routes.integration.test.js` |
| Purchase/Sales/Return | `transactions.atomic.test.js`, `returns.guard.test.js` |
| Finance/ledger | `financeLedger.test.js`, `sqliteConcurrentWrites.test.js`, `domainError.routes.integration.test.js` |
| Production/Work Log | `productionOrder.atomic.test.js`, `productionWorkLog.atomic.test.js`, `productionLifecycleGuards.test.js` |
| Payroll/HPP | `productionPayroll.atomic.test.js`, production calculation tests |
| Backup/restore/maintenance | `maintenanceBackupRestore.test.js`, `maintenanceDataTools.test.js`, destructive guard tests |
| Testing Lab | `testingLab.test.js` |
| Realtime | realtime runtime/database/origin propagation tests |
| Source/tooling | `sourceHygiene.test.js`, test isolation policy tests |

## Guard test database

- Setiap integration test wajib memanggil `configureTestDatabase()` sebelum mengimpor module yang membuka SQLite.
- Runtime test wajib berada pada folder temporary sistem.
- Dilarang memakai database `data/`, backup operasional, atau log operasional.
- `npm test` memeriksa fingerprint sebelum/sesudah suite dan revalidasi cleanup.

## Kontrak minimum

Untuk mutation guarded, test ideal harus membuktikan:

1. response/status HTTP benar;
2. error code domain benar;
3. commit sukses menyimpan seluruh side effect;
4. failure me-rollback seluruh side effect;
5. audit/realtime hanya terbit setelah commit;
6. retry/idempotency tidak membuat record ganda.
