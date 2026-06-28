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

Alignment source aktual:

- `roleAccess.js` menjadi matrix route/menu/Dashboard frontend.
- Generic JSON router menerima `readGuard`; default tetap authenticated read untuk data referensi yang memang dibutuhkan operasi.
- Finance (`incomes`, `expenses`, `ledger`), report snapshots, dan production payroll memakai administrator read guard.
- Planning, Production Orders, dan Work Logs tetap menerima role `administrator + user` untuk flow operasional harian.
- Hidden menu bukan security control; request backend tetap harus lolos guard endpoint.

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
- Deteksi mode varian tidak boleh memakai keberadaan array kosong; resolver memilih `variants` non-empty lalu `variantOptions` non-empty.
- Master/varian nonaktif ditolak untuk mutation normal. Return historis memakai override internal ter-audit, bukan flag dari request client.
- Inventory log wajib memakai referensi bisnis manusiawi.
- Technical database ID tidak boleh menjadi display audit utama.

## Supplier, katalog toko, dan histori per toko

```text
Daftar Supplier
→ GET /api/suppliers
→ pilih satu toko
→ reusable Supplier Detail Drawer
   ├─ Ringkasan
   ├─ Katalog barang/link aktif
   └─ GET /api/suppliers/:id/history
```

- Katalog terstruktur disimpan di `supplier_catalog_offers` dan dapat menghubungkan satu supplier ke banyak Produk/Bahan Baku serta banyak link/paket untuk item yang sama.
- Histori disimpan di `supplier_catalog_history` dan selalu difilter memakai `supplier_id`; drawer Toko A tidak boleh memuat histori toko lain.
- Pengecekan manual memakai `POST /api/suppliers/:id/catalog/:offerId/verify` dan hanya tersedia untuk administrator.
- Harga lama, waktu pengecekan, waktu perubahan, dan pelaku perubahan hanya ditampilkan pada tab Histori Toko. Tabel katalog utama hanya menampilkan kondisi terbaru.
- Kode supplier, ID supplier, ID item, dan ID penawaran tetap backend-only; UI menggunakan nama toko, nama barang, listing, channel, dan status operasional.

## Raw Material master dan sumber restock

```text
Raw Materials
→ create/edit metadata dan struktur stok
→ backend validasi kategori, unit, nama unik, stok/modal awal, dan guard nonaktif
→ source restock dibaca dari supplier_catalog_offers
→ detail bahan menampilkan ringkasan jumlah toko/link
→ buka Supplier dengan filter item untuk mengelola atau membandingkan sumber restock
```

- Master Raw Material tidak menyimpan satu Supplier sebagai source utama. Field supplier snapshot lama hanya compatibility data dan tidak ditampilkan pada UI utama.
- Bahan tanpa varian memakai minimum stok master. Bahan bervarian memakai `variants[].minStockAlert`; read model aggregate menyimpan total minimum varian aktif untuk ringkasan.
- `averageActualUnitCost` bersifat transaction-derived dan read-only pada master. Pembelian menghitung weighted average di backend dalam transaction yang sama dengan stock-in dan finance.
- Penonaktifan ditolak jika masih ada current/reserved stock, BOM aktif, atau proses produksi aktif yang bergantung pada bahan tersebut.

## Purchases

```text
Purchase form
→ pilih item + supplier + satu penawaran katalog
→ buka link dan verifikasi harga aktual
→ POST /api/transactions/purchases/commit
→ backend cocokkan supplier/item/varian/penawaran
→ backend normalisasi status Purchase menjadi `Selesai` dan menolak draft/cancel/deleted
→ update harga katalog + histori toko bila berubah
→ stock-in Product/Raw Material
→ expense/finance side effect
→ purchase + inventory log + audit
```

- Supplier, penawaran katalog, dan verifikasi harga wajib untuk setiap Pembelian baru.
- Jika qty, subtotal, supplier, atau penawaran berubah setelah verifikasi, verifikasi dianggap stale dan harus diulang.
- Update harga katalog, histori toko, purchase, stock-in, inventory log, dan finance berada dalam transaction SQLite yang sama agar tidak terjadi partial write.
- Harga aktual tetap disimpan sebagai snapshot Pembelian; edit katalog berikutnya tidak mengubah histori transaksi lama.
- Purchase tidak boleh menulis stok atau finance lewat helper terpisah yang tidak idempotent.

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
→ pilih Sales
→ item Return hanya dari item Sales tersebut
→ POST /api/transactions/returns/commit
→ backend validasi relatedSaleId
→ backend validasi item ada pada Sales
→ backend validasi qty <= qty terjual - qty sudah diretur
→ stock restore
→ status Return dipaksa `Selesai` oleh backend
→ refund payload ditolak; tidak ada expense/ledger otomatis dari Return
→ audit log
→ return/report update
```

Return bukan sales cancel tersembunyi. Return adalah jalur resmi barang kembali dan wajib memiliki relasi Sales.

## Pricing Rule batch

```text
Pricing Rules preview
→ POST /api/pricing-rules/:id/apply
→ validasi rule + target + expectedVersion seluruh item
→ BEGIN IMMEDIATE TRANSACTION
→ update harga minimal Product/Raw Material
→ preserve stok/HPP + sync stock read model
→ audit item + audit batch
→ COMMIT seluruh batch atau ROLLBACK seluruhnya
```

Frontend tidak boleh menerapkan Pricing Rule massal melalui loop direct update master. Satu item stale/gagal harus membatalkan seluruh batch agar harga tidak berubah sebagian.

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
- Read `/api/finance/incomes`, `/api/finance/expenses`, dan `/api/finance/ledger` hanya untuk Administrator; role `user` tidak boleh mendapat ringkasan finance dari Dashboard.

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
- `/api/production/payrolls` hanya boleh dibaca Administrator.
- HPP Analysis adalah halaman derived, bukan endpoint HPP terpisah. Route HPP Analysis tetap Administrator-only; Planning/Orders/Work Logs tetap operasional.

## Reports dan dashboard

```text
Backend report service
→ data SQLite/read model
→ response aman dengan fallback section
→ UI report/dashboard
```

Dashboard/report harus read-only. Jika satu section gagal, tampilkan partial warning/empty state, bukan white screen total.

Dashboard juga harus role-aware: loader hanya memanggil dataset yang diizinkan, kartu/aksi menggunakan route key yang sama dengan ProtectedRoute, dan role `user` tidak boleh diarahkan ke halaman Administrator-only.

## Maintenance, backup, restore

```text
Database Center UI
→ login administrator
→ /api/maintenance/status
→ /api/module-runtime-status
→ backup/restore endpoint guarded
→ audit log maintenance
```

Backup lifecycle:

```text
backend start
→ runBackupLifecycleMaintenance() satu kali sebelum layanan siap
→ startBackupLifecycleScheduler() setelah HTTP server aktif
→ pemeriksaan ulang setiap 1 jam selama backend hidup
→ promote daily terakhir bulan sebelumnya menjadi monthly
→ cleanup daily > 60 hari jika monthly bulan terkait tersedia
→ ensure daily verified maksimal satu per hari
→ verify package/checksum/integrity
→ simpan maksimal 12 monthly
→ audit log setiap promosi/cleanup
```

Ketiga fase monthly, retention, dan daily ditangani terpisah. Kegagalan satu fase tidak boleh menghentikan fase lain. Status scheduler aktual, waktu run terakhir, run berikutnya, error terakhir, dan ringkasan hasil tersedia di `/api/maintenance/status`; UI tidak boleh menyimpulkan lifecycle aktif hanya dari kebijakan statis.

`/api/maintenance/status` memakai kontrak versi eksplisit dan capability flag untuk `sqliteOnlyRuntime`, `tableCounts`, live refresh, dan pemeriksaan konsistensi tabel. Frontend memvalidasi kontrak tersebut sebelum menampilkan count. Count yang hilang atau response backend lama harus ditampilkan sebagai `belum tersedia`, bukan `0`. Database Center melakukan refresh status setiap 15 detik ketika halaman terlihat serta saat window kembali fokus.

Semua modul runtime menggunakan satu backend Express dan satu koneksi SQLite dari `backend/src/db/connection.js`. Environment repository mode lama tidak boleh mengalihkan Finance, Pricing, Stock Adjustment, atau modul lain ke sumber data berbeda. Audit strict harus memeriksa seluruh tabel pada `backend/src/db/schema.js`, seluruh route utama pada `backend/src/server.js`, sisa runtime Firebase/Firestore/IndexedDB, dan override mode non-SQLite pada file environment frontend.

Sebelum snapshot, packaging, import, atau ekstraksi preview/restore, backend memeriksa ruang kosong pada filesystem target. Operasi dibatalkan dengan error yang jelas jika kapasitas tidak cukup. Paket `.imsbackup` memakai ZIP klasik tanpa ZIP64; satu entry database harus di bawah 4 GB.

Folder aktif hanya `daily`, `monthly`, dan `manual`. Backup manual, import, pre-repair, serta pre-restore masuk storage class `manual`; jenis aslinya tetap dicatat di manifest.

Restore wajib:

- pilih backup eksplisit,
- preview,
- validasi checksum/integrity,
- pre-restore backup yang disimpan di folder manual,
- keyword confirm,
- audit log.

## Module Runtime Status

```text
module_migration_status
→ GET /api/module-runtime-status dengan token administrator
→ Database Center / Maintenance Checklist
→ summary modul aktif/guarded/data historis/unknown
```

Status modul adalah alat bantu audit administrator. Patch fitur tetap wajib membaca file source aktual yang menangani modul tersebut.

## Anti-regression

Dilarang:

- Menghidupkan runtime arsip.
- Direct database access dari frontend.
- Direct write generic ke tabel guarded.
- Menampilkan technical database ID sebagai referensi audit UI.
- Mengubah route/menu/role guard tanpa approval.
- Mengubah stock, sales, purchase, return, finance, production, payroll, HPP, backup/restore, reset, atau audit flow tanpa audit dan approval eksplisit.

## Canonical architecture path setelah cleanup C0–C16

```text
Stock/Purchase/Sales/Return/Production
→ backend/src/modules/stock/engine
→ inventory log + stock read model + audit

Finance side effect
→ backend/src/modules/finance/finance.engine.js
→ income/expense + ledger + audit

Backup/Maintenance
→ backend/src/modules/maintenance/backup
→ package/validation/lifecycle
→ guarded restore service

Generic JSON endpoint
→ backend/src/infrastructure/http/sqliteJsonRecordRouter
→ domain guard/service
```

File lama pada `backend/src/utils/sqlite*` dan `backend/src/shared/sqliteJsonRecordRoutes.js` hanya compatibility facade. Internal module tidak boleh melewati canonical path atau domain guard.

Shared cross-runtime contract aktif:

- auth, category, dan business-code JSON contract;
- canonical password core;
- canonical Supplier pricing core.

Frontend boleh memakai shared pure contract untuk konsistensi tampilan/validasi awal, tetapi backend tetap melakukan enforcement final.

## Audit kualitas data dan reconciliation — 2026-06-28

```text
Maintenance Center → Audit & Health
→ GET /api/maintenance/data-audit
→ integrity/foreign key/invariant/read-model/backup/finance checks
→ total issue penuh + sample terbatas
→ audit_logs.data_quality_audit
```

- Audit tidak mengubah data bisnis, tetapi mencatat actor dan ringkasan run ke audit log existing.
- Finance reconciliation memeriksa pasangan hilang/terhapus/duplikat, nominal, direction, debit-credit, source ID/type, orphan ledger, dan status movement.
- Finance tetap manual-review; Transaction Side-Effect Repair otomatis belum tersedia.
- Audit dijalankan on-demand. Scheduler otomatis tidak aktif agar tidak overlap dengan transaksi, backup, restore, atau maintenance lain sebelum review performa terpisah.

## Realtime SQLite lintas perangkat — 2026-06-28

```text
Client A POST/PUT/DELETE
→ fetchSqliteJson mengirim X-IMS-Client-ID
→ requestContextMiddleware
→ service/domain transaction SQLite
→ COMMIT berhasil
→ connection.js mengumpulkan tabel yang berubah
→ realtime.service broadcast data_changed via SSE
→ Client B LiveRouteRefresh mencocokkan scope route
→ refetch/remount page saat aman
```

Kontrak aktif:
- Endpoint: `GET /api/realtime/events`, protected oleh cookie session dan origin guard existing.
- Transport: native Server-Sent Events, satu koneksi per tab melalui `SqliteRealtimeProvider`.
- Payload hanya metadata: `revision`, `tables`, `scopes`, `originClientId`, dan timestamp.
- Client identity: browser ID persisten + page-instance ID in-memory. Identitas legacy `sessionStorage ims.sqlite.clientId` dibersihkan agar duplicate tab tidak berbagi origin ID.
- `database_replaced` dari restore memaksa reload seluruh client; event normal hanya me-refresh route terkait.
- Event scope `auth` dari perubahan `users/roles` diproses global sebelum route filtering dan memicu validasi ulang session. Mutation `local_user_sessions` memakai scope terpisah `auth_session` agar login/logout biasa tidak mereload client lain.
- Session expiry: `registerRealtimeClient` memakai `req.localAuth.expiresAt`, mengirim event `session_expired`, lalu menutup stream. Frontend memperlakukan event ini sebagai global reload untuk kembali ke auth gate.
- Jika editor/modal/input sedang aktif, refresh ditunda dan user diberi tombol `Muat Ulang Data`.
- Fallback: satu polling revision global 60 detik hanya saat SSE disconnected dan tab terlihat, memakai in-flight guard serta catch-up saat visibility kembali aktif. Subscription adapter lama hanya melakukan initial load dan tidak membuat `setInterval` masing-masing.
- Revision fallback dikembalikan sesuai role. Administrator melihat revision global; user operasional hanya melihat revision event yang lolos filter scope user.
- Resource guard: maksimal 100 koneksi total, 12 per user, dan 30 per IP. Backpressure menutup stream agar native reconnect/fallback melakukan resync.
- Tabel-to-scope berada terpusat pada `backend/src/modules/realtime/realtime.service.js`; route-to-scope berada pada `frontend/src/config/realtimeRouteScopes.js`.

## Data Nonaktif dan purge guarded — 2026-06-28

```text
Maintenance Center → Data Nonaktif
→ GET /api/maintenance/inactive-data
→ preview active dependency blockers
→ admin memilih candidate safe
→ keyword + exact target confirmation
→ backup pre-repair
→ transaction DELETE allowlisted record
→ audit_logs.inactive_record_purge + sanitized snapshot
```

Allowlist purge eksekusi hanya Customer, Kategori, Supplier, dan Aturan Harga yang sudah nonaktif serta lolos dependency check. User tetap dapat muncul pada preview, tetapi hard purge User selalu diblokir agar username/identitas histori audit tidak ambigu. Dependency check mencakup direct reference, nested JSON alias yang dikenal, hierarchy/katalog/history, dan `migration_identity_map`. Semua transaksi/stok/finance/production/payroll/backup/restore/audit tetap protected. Runtime hard-delete di luar Maintenance dianggap blocker oleh `backend/scripts/audit-sqlite-cutover-readiness.cjs --strict`.
