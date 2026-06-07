# OFFLINE DATABASE CONTRACT — IMS Bunga Flanel

Status terbaru: **SQLite local sidecar adalah runtime offline utama untuk source aktual. Dexie/IndexedDB sudah dihapus dari source runtime aktif. Dashboard wajib membaca data lewat service SQLite/read-only dan harus tetap tampil walaupun sebagian section gagal dimuat.**


## Update Clean Professional Guard — 2026-06-05

Kontrak runtime yang wajib dipertahankan setelah patch ini:

1. **Backend adalah satu-satunya akses database.** Frontend hanya boleh memanggil API HTTP backend SQLite melalui adapter/service, tidak boleh membaca file `.sqlite` langsung.
2. **Read data bisnis memerlukan session lokal.** Generic JSON router dan master data read sudah memakai `requireLocalAuth`; auth status/login/bootstrap tetap boleh diakses tanpa token sesuai kebutuhan login.
3. **Transaksi wajib lewat endpoint commit resmi.** Direct create/update/delete generic untuk `purchases`, `sales`, `returns`, `finance`, dan `stock_adjustments` diblokir.
4. **Sales cancel/delete tetap dilarang.** Status sales hanya `Diproses`, `Dikirim`, dan `Selesai`. Barang kembali wajib lewat Return.
5. **Stock mutation tidak boleh dobel.** Purchase/Sales/Return/Stock Adjustment wajib lewat stock engine backend agar stock read model, inventory log, dan audit log konsisten.
6. **Finance ledger tidak boleh ditulis langsung.** Cash-in/cash-out dan ledger wajib lewat finance commit/delete resmi agar ledger tetap atomic.
7. **Mode lama tidak boleh hidup kembali.** Alias `firebase_primary`, `offline_local`, dan `hybrid_sync` diarahkan ke SQLite sidecar, bukan mengaktifkan Firebase/Dexie/IndexedDB runtime.
8. **Backup/restore tetap guarded.** Restore harus melalui preview, keyword, pre-restore backup, checksum, dan audit log backend.

Update Patch A-B — 2026-06-02:

- Frontend `.env.example` dibuat SQLite-first untuk pilot lokal: `VITE_AUTH_MODE=sqlite`.
- `VITE_SUPPLIERS_REPOSITORY_MODE` menjadi `sqlite` untuk C1 Supplier master-only; relasi purchase/raw/history tetap guarded dan tidak ikut dimutasi.
- Folder legacy `frontend/src/data/adapters/dexie/`, `frontend/src/data/local/`, dan `frontend/src/data/sync/` dihapus dari source aktif.
- Panel legacy Dexie/IndexedDB yang tidak diimpor route aktif dihapus: `OfflineLocalDbBackupPanel.jsx`, `OfflineMasterDataPilotPanel.jsx`, `OfflineQaExecutionPanel.jsx`, dan `OfflineSyncDevPanel.jsx`.
- SQLite Local DB Center tetap menjadi satu-satunya UI aktif untuk database lokal/offline.

## 1. Arsitektur aktif

```text
React Web UI
-> repository/adapter IMS
-> Node.js backend lokal/LAN
-> SQLite file database lokal
```

Untuk akses HP/laptop lain satu jaringan:

```text
Laptop/PC utama menjalankan backend + frontend
HP/laptop kedua membuka http://IP-LAPTOP:5173/Inventory-App/
React otomatis memanggil http://IP-LAPTOP:3001 untuk API SQLite
```

Rule wajib:

- React tidak boleh membaca file `.sqlite` langsung.
- Semua write SQLite wajib lewat backend Node.js.
- File runtime `data/*.sqlite`, WAL/SHM, dan backup SQLite tidak boleh masuk git/patch.
- Firebase/Firestore yang masih muncul di komentar atau compatibility helper lama tidak boleh dianggap runtime aktif tanpa validasi source aktual. Runtime utama ZIP ini adalah SQLite sidecar lewat backend Node.js.

## 2. Runtime aktif per area

| Area | Runtime aktif | Catatan |
|---|---|---|
| Auth lokal | SQLite backend | `VITE_AUTH_MODE=sqlite`; user management lokal lewat backend. |
| Categories | SQLite sidecar | CRUD lewat backend. |
| Customers | SQLite sidecar | CRUD lewat backend. |
| Suppliers | SQLite sidecar | Master supplier lewat backend; relasi purchase/raw/history tetap harus diaudit jika dibuat final. |
| Products/Raw/Semi | SQLite sidecar | Master data dan stock snapshot memakai adapter SQLite. |
| Stock | SQLite sidecar | Stock read model dan adjustment lewat backend/stock engine; jangan direct write table dari UI. |
| Sales/Purchases/Returns | SQLite sidecar | Commit transaksi baru lewat backend transaction adapter. |
| Finance/Reports | SQLite sidecar | Finance movement/ledger/report membaca SQLite; data legacy lama tetap butuh migrasi/backfill terpisah. |
| Production/Payroll/HPP | SQLite sidecar guarded | Service produksi memakai adapter SQLite; material usage, payroll final, dan HPP tetap guarded business flow. |
| Dashboard | SQLite/read-only service | `readDashboardData()` wajib return `{ dashboardData, failedReads }` dan tidak boleh membuat white screen jika satu section gagal. |
| Backup/Restore SQLite | Backend guarded | Restore destructive wajib admin lokal, file eksplisit, backup otomatis, keyword guard, dan audit log. |

## 3. Yang sudah tidak menjadi runtime aktif

Dexie/IndexedDB runtime lama **tidak dipakai lagi**.

Yang sudah dihapus dari source aktif:

```text
frontend/src/data/adapters/dexie/
frontend/src/data/local/
frontend/src/data/sync/
frontend/src/pages/Utilities/components/OfflineLocalDbBackupPanel.jsx
frontend/src/pages/Utilities/components/OfflineMasterDataPilotPanel.jsx
frontend/src/pages/Utilities/components/OfflineQaExecutionPanel.jsx
frontend/src/pages/Utilities/components/OfflineSyncDevPanel.jsx
```

Konsekuensi:

- Tidak ada `sync_queue` IndexedDB runtime.
- Tidak ada conflict resolver Dexie runtime.
- Tidak ada backup/restore JSON IndexedDB runtime.
- Nilai mode legacy `offline_local`/`hybrid_sync` hanya compatibility alias di `repositoryMode.js` dan dinormalisasi ke `sqlite_sidecar` agar setting lama tidak membuat UI crash.

## 4. Kontrak guard SQLite pilot

Boleh:

- Login lokal pilot dengan `VITE_AUTH_MODE=sqlite`, termasuk bootstrap administrator pertama dan Manajemen User lokal melalui backend SQLite.
- CRUD Categories dan Customers lewat adapter SQLite/backend.
- Membuka SQLite Local DB Center untuk status backend, migration status, backup SQLite, dan restore plan.
- Fallback UI aman ketika backend SQLite belum siap: halaman menampilkan warning/empty state, bukan white screen.

Tidak boleh tanpa audit/approval terpisah:

- Mengubah route/menu/role guard.
- Mengubah schema/table SQLite penting.
- Menulis langsung ke table stock, finance ledger, production material usage, payroll final, atau HPP final dari UI tanpa service/backend existing.
- Membuat sync otomatis Firebase ↔ SQLite untuk transaksi.
- Membuat restore destructive tanpa guard admin lokal, preview, keyword, file backup eksplisit, backup otomatis, dan audit log.
- Menghapus compatibility legacy hanya berdasarkan komentar lama tanpa audit import/usage.

## 5. Env lokal pilot

Contoh `.env.local` yang aman untuk pilot SQLite lokal:

```env
VITE_AUTH_MODE=sqlite
# VITE_SQLITE_API_BASE_URL=http://localhost:3001
VITE_SUPPLIERS_REPOSITORY_MODE=sqlite
VITE_PRICING_RULES_REPOSITORY_MODE=sqlite
VITE_PRODUCTS_REPOSITORY_MODE=sqlite
VITE_RAW_MATERIALS_REPOSITORY_MODE=sqlite
VITE_STOCK_READ_MODELS_REPOSITORY_MODE=sqlite
VITE_SEMI_FINISHED_REPOSITORY_MODE=sqlite
VITE_STOCK_ADJUSTMENTS_REPOSITORY_MODE=sqlite
VITE_TRANSACTIONS_REPOSITORY_MODE=sqlite
VITE_FINANCE_REPOSITORY_MODE=sqlite
VITE_PRODUCTION_REPOSITORY_MODE=sqlite
VITE_REPORTS_REPOSITORY_MODE=sqlite
```

Jika frontend dibuka dari HP satu WiFi dan backend berjalan di laptop:

```env
VITE_AUTH_MODE=sqlite
VITE_SQLITE_API_BASE_URL=http://IP-LAPTOP:3001
# Mode modul lain mengikuti frontend/.env.example terbaru.
```

Jangan commit `.env.local`.

## 6. Test minimum setelah perubahan SQLite/Dexie cleanup

```text
[ ] cd backend && npm install && npm run check
[ ] cd backend && npm run dev
[ ] buka http://localhost:3001/health
[ ] buka http://localhost:3001/api/maintenance/status
[ ] cd frontend && npm install
[ ] buat .env.local sesuai contoh SQLite pilot
[ ] npm run lint
[ ] npm run build
[ ] npm run dev -- --host 0.0.0.0
[ ] Login lokal SQLite berhasil
[ ] Categories CRUD berhasil
[ ] Customers CRUD berhasil
[ ] Supplier, Products, Raw, Semi, Stock, Transactions, Finance, Production, Reports membaca SQLite sesuai source aktual
[ ] Dashboard terbuka tanpa white screen walaupun salah satu section gagal dimuat
[ ] Reset destructive tetap memakai preview, backup, keyword guard, dan audit log existing
```

## 7. Catatan legacy docs

Dokumen lama Batch offline Dexie/IndexedDB sebelum SQLite dianggap **arsip historis**. Jika ada konflik antara arsip lama dan kontrak ini, gunakan kontrak SQLite terbaru dan source aktual sebagai acuan.


## Update C1 Supplier SQLite Master-Only

Catatan historis batch C1. Untuk source aktual, Supplier sudah berada pada runtime SQLite sidecar. Kontrak aktif:

- Supplier create/update/delete pada mode SQLite wajib lewat backend `/api/suppliers`.
- Delete Supplier SQLite adalah soft-delete/status nonaktif, bukan hard delete.
- Supplier SQLite C1 hanya master data dasar: kode, nama/toko, link, kontak/alamat/catatan jika tersedia.
- Katalog `materialDetails`, purchase history, raw material supplier snapshot, stock, cash/expense, dan report final belum boleh dimutasi dari Supplier SQLite.
- Catatan lama tentang Firebase fallback hanya berlaku sebagai compatibility historis. Untuk ZIP/source aktual, jangan aktifkan kembali fallback tanpa audit import/usage dan approval eksplisit.

## 8. Kontrak D2-D4: SQLite module guard dan stock engine

Env pilot yang sekarang digunakan:

```env
VITE_AUTH_MODE=sqlite
VITE_SUPPLIERS_REPOSITORY_MODE=sqlite
VITE_PRICING_RULES_REPOSITORY_MODE=sqlite
VITE_PRODUCTS_REPOSITORY_MODE=sqlite
VITE_RAW_MATERIALS_REPOSITORY_MODE=sqlite
VITE_STOCK_READ_MODELS_REPOSITORY_MODE=sqlite
VITE_STOCK_ADJUSTMENTS_REPOSITORY_MODE=sqlite
VITE_TRANSACTIONS_REPOSITORY_MODE=sqlite
VITE_SEMI_FINISHED_REPOSITORY_MODE=sqlite
VITE_FINANCE_REPOSITORY_MODE=sqlite
VITE_PRODUCTION_REPOSITORY_MODE=sqlite
VITE_REPORTS_REPOSITORY_MODE=sqlite
```

Kontrak aman:

- Product dan Raw Material master boleh SQLite.
- Stock Read Model adalah snapshot SQLite yang disinkronkan dari master/stock engine.
- Stock Adjustment wajib lewat `POST /api/stock/adjustments/commit`, bukan direct write table.
- Purchase/Sales/Returns SQLite commit harus tetap lewat backend transaction adapter dan stock engine, bukan direct mutation dari UI.
- Semi Finished, Finance, Production, Payroll, HPP, dan Reports sudah memiliki mode SQLite pada env/source aktual, tetapi business flow guarded tetap tidak boleh diubah tanpa audit khusus.

## 9. Kontrak D6: Semi Finished, Finance, Reports

Env aktif untuk batch D6:

```env
VITE_SEMI_FINISHED_REPOSITORY_MODE=sqlite
VITE_FINANCE_REPOSITORY_MODE=sqlite
VITE_REPORTS_REPOSITORY_MODE=sqlite
VITE_PRODUCTION_REPOSITORY_MODE=sqlite
```

Kontrak aman:

- Semi Finished adalah master stock SQLite dan boleh dipakai Stock Adjustment SQLite.
- Finance commit wajib atomic: cash movement dan `money_movement_ledger` harus ditulis dalam satu transaction backend.
- Purchase/Sales/Returns transaksi baru boleh membuat finance side effect di SQLite, tetapi data legacy Firestore tetap memerlukan migrasi/backfill terpisah.
- Reports membaca data SQLite baru. Jika data lama belum dimigrasi, hasil report hanya mewakili data SQLite yang sudah ada.
- Production/Payroll/HPP memakai service SQLite, tetapi perubahan material usage, payroll paid/final, dan HPP final tetap harus lewat audit khusus dan service existing.


## 10. Kontrak Dashboard Anti White Screen

Kontrak source aktual setelah patch 2026-06-05:

- `frontend/src/services/Dashboard/dashboardService.js` wajib mengembalikan object `{ dashboardData, failedReads }`.
- `dashboardData` wajib selalu memiliki array default untuk `lowStockRows`, `criticalStockPreview`, `recentActivities`, `productionOrders`, `workLogs`, `payrolls`, `expenses`, `incomes`, `revenues`, `sales`, dan `stockAuditRows`.
- `planningSummary` wajib selalu memiliki `weekly`, `monthly`, `overdueCount`, `behindTargetCount`, dan `priorityPlans`.
- Jika section gagal dibaca, masukkan nama section ke `failedReads` dan kembalikan fallback kosong. Jangan throw error sampai membuat page blank.
- `Dashboard.jsx` hanya boleh menampilkan warning dan fallback aman; Dashboard tetap read-only dan tidak boleh melakukan repair, reset, stock mutation, finance mutation, payroll finalization, atau HPP write.
- `AppErrorBoundary` di `AppLayout.jsx` menjadi safety net global agar error render halaman lain tidak berubah menjadi white screen total.
