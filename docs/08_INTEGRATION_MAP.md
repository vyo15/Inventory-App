# 08 Integration Map IMS Bunga Flanel

Status: **AKTIF / SQLITE-FIRST / SOURCE-VERIFIED**.

Dokumen ini mengunci alur integrasi IMS agar modul tidak berjalan sendiri-sendiri. Runtime utama source aktual adalah frontend React/Vite + backend Node.js Express + SQLite lokal/LAN.

## Prinsip integrasi utama

```text
Frontend React/Vite
→ service/adapter frontend
→ endpoint backend resmi
→ transaksi SQLite/backend service
→ audit log
→ read model/report/dashboard
```

Frontend tidak boleh direct access file SQLite dan tidak boleh melakukan mutation guarded tanpa endpoint backend resmi.

## Backend endpoint map aktif

Endpoint utama yang terlihat di `backend/src/server.js`:

- `/api/auth/**`
- `/api/customers/**`
- `/api/categories/**`
- `/api/suppliers/**`
- `/api/pricing-rules/**`
- `/api/products/**`
- `/api/raw-materials/**`
- `/api/semi-finished-materials/**`
- `/api/stock-read-models/**`
- `/api/stock/adjustments/commit`
- `/api/stock-adjustments/**`
- `/api/transactions/purchases/**`
- `/api/transactions/sales/**`
- `/api/transactions/returns/**`
- `/api/finance/**`
- `/api/production/**`
- `/api/reports/**`
- `/api/maintenance/**`
- `/api/module-runtime-status`
- `/api/migration-status`
- `/api/audit-logs/**`

## Auth dan role guard

```text
Login UI
→ localAuthService
→ POST /api/auth/login
→ backend validasi username/password lokal
→ token/session lokal
→ ProtectedRoute + role guard frontend
→ backend endpoint guard untuk action sensitif
```

Guard aktif berada di backend SQLite route/service dan protected UI route. Jangan membuat flow auth baru tanpa audit source.

## Master data

```text
Master page
→ service frontend
→ endpoint backend master data
→ table SQLite terkait
→ audit log bila action mutation
→ UI refresh/read model
```

Master data boleh CRUD sesuai role, tetapi tidak boleh langsung mengubah stock/finance/production side effect kecuali lewat endpoint resmi yang memang dirancang untuk itu.

## Stock engine

```text
Stock adjustment / transaction / production
→ endpoint commit resmi
→ validasi item + varian + available stock
→ atomic commit SQLite
→ stock row update
→ inventory log
→ read model/report update
```

Aturan:

- Stock mutation tidak boleh dibuat di UI.
- Item bervarian wajib membawa `variantKey`.
- Adjustment keluar wajib validasi available stock.
- Inventory log wajib memakai referensi bisnis manusiawi.
- Technical database ID tidak boleh menjadi display audit utama.

## Purchases

```text
Purchase form
→ POST /api/transactions/purchases/commit
→ validasi supplier + item target
→ stock-in Product/Raw Material
→ expense/finance side effect sesuai rule backend
→ audit log
→ purchase report
```

Purchase tidak boleh menulis stok atau finance lewat helper terpisah yang tidak idempotent.

## Sales

```text
Sales form
→ POST /api/transactions/sales/commit
→ gabungkan kebutuhan item yang sama
→ validasi available stock
→ stock-out
→ simpan sales
→ posting income bila status final sesuai rule
→ audit log
→ sales report
```

Aturan terkunci:

- Sales cancel/delete user-facing dilarang.
- Status aktif hanya `Diproses`, `Dikirim`, dan `Selesai`.
- Barang kembali harus lewat Return.

## Returns

```text
Return form
→ POST /api/transactions/returns/commit
→ validasi sale/item/qty
→ stock restore
→ refund/finance guard sesuai backend
→ audit log
→ return/report update
```

Return bukan sales cancel tersembunyi. Return adalah jalur resmi barang kembali.

## Finance

```text
Cash In/Cash Out manual atau side effect transaksi
→ endpoint finance/backend service
→ ledger SQLite
→ audit log
→ Profit/Loss report
```

Aturan:

- Posting otomatis harus idempotent.
- Profit/Loss membaca data final.
- Draft/preview tidak boleh dihitung sebagai final.

## Production, payroll, dan HPP

```text
Production Planning
→ Production Order
→ Work Log completed
→ material actual
→ Payroll final/paid
→ labor actual
→ HPP final
→ finance expense payroll bila paid
→ reports/dashboard
```

Aturan:

- Planning tidak mengubah stok/payroll/HPP langsung.
- Work Log completed harus menjaga material actual.
- Payroll paid harus idempotent saat posting expense.
- HPP final tidak boleh memakai payroll draft.

## Reports dan dashboard

```text
Backend report service
→ data SQLite/read model
→ response aman dengan fallback section
→ UI report/dashboard
```

Dashboard/report harus read-only. Jika satu section gagal, tampilkan partial warning/empty state, bukan white screen total.

## Maintenance, backup, restore

```text
Database Center UI
→ /api/maintenance/status
→ /api/module-runtime-status
→ backup/restore endpoint guarded
→ audit log maintenance
```

Restore wajib:

- pilih backup eksplisit,
- preview,
- validasi checksum/integrity,
- pre-restore backup,
- keyword confirm,
- audit log.

## Module Runtime Status

```text
module_migration_status
→ GET /api/module-runtime-status
→ Database Center / Maintenance Checklist
→ summary modul aktif/guarded/legacy/unknown
```

Status modul adalah alat bantu audit. Patch fitur tetap wajib membaca file source aktual yang menangani modul tersebut.

## Anti-regression

Dilarang:

- Menghidupkan runtime lama.
- Direct database access dari frontend.
- Direct write generic ke tabel guarded.
- Menampilkan technical database ID sebagai referensi audit UI.
- Mengubah route/menu/role guard tanpa approval.
- Mengubah stock, sales, purchase, return, finance, production, payroll, HPP, backup/restore, reset, atau audit flow tanpa audit dan approval eksplisit.
