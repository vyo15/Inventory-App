# OFFLINE DATABASE CONTRACT — IMS Bunga Flanel

Status terbaru: **SQLite local sidecar adalah runtime offline utama untuk pilot Categories, Customers, dan Supplier master-only. Dexie/IndexedDB sudah dihapus dari source runtime aktif.**

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
- Firebase tetap dipertahankan sebagai fallback/legacy sampai migrasi semua modul selesai dan aman.

## 2. Runtime aktif per area

| Area | Runtime aktif | Catatan |
|---|---|---|
| Auth lokal pilot | SQLite backend opt-in/SQLite-first env example | Firebase Auth masih fallback legacy |
| Categories | SQLite sidecar | CRUD pilot lewat backend |
| Customers | SQLite sidecar | CRUD pilot lewat backend |
| Suppliers | SQLite sidecar master-only | UI Supplier memakai repository/backend SQLite untuk master; katalog raw material dan histori purchase tetap guarded/read-only legacy |
| Products/Raw/Semi | Firebase-primary | Belum dimigrasi |
| Stock | Firebase/read model existing | Mutation stock guarded; belum SQLite |
| Sales/Purchases/Returns | Firebase-primary | Tidak boleh offline mutation langsung |
| Finance/Reports | Firebase-primary | Ledger/report final tidak boleh dihitung dari data lokal belum final |
| Production/Payroll/HPP | Firebase-primary | Guarded; perlu audit khusus sebelum migrasi |
| Backup/Restore SQLite | Backend guarded | Restore destructive wajib admin lokal, file eksplisit, backup otomatis, dan keyword guard |

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
- Fallback manual ke Firebase jika SQLite backend belum siap.

Tidak boleh tanpa audit/approval terpisah:

- Menghapus Firebase dependency/config final.
- Mengubah route/menu/role guard.
- Mengarahkan Supplier frontend ke SQLite untuk operasional final.
- Mengubah stock mutation, purchase receive, sales stock out, returns stock in/refund, finance ledger, production material usage, payroll final, atau HPP final ke SQLite.
- Membuat sync otomatis Firebase ↔ SQLite untuk transaksi.
- Membuat restore destructive tanpa guard admin lokal, preview, keyword, file backup eksplisit, dan backup otomatis.

## 5. Env lokal pilot

Contoh `.env.local` yang aman untuk pilot SQLite lokal:

```env
VITE_AUTH_MODE=sqlite
# VITE_SQLITE_API_BASE_URL=http://localhost:3001
VITE_SUPPLIERS_REPOSITORY_MODE=sqlite
```

Jika frontend dibuka dari HP satu WiFi dan backend berjalan di laptop:

```env
VITE_AUTH_MODE=sqlite
VITE_SQLITE_API_BASE_URL=http://IP-LAPTOP:3001
VITE_SUPPLIERS_REPOSITORY_MODE=sqlite
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
[ ] Supplier master-only boleh memakai SQLite, tetapi relasi purchase/raw/history tetap guarded dan tidak ikut transaksi final SQLite
[ ] Stock/Sales/Purchases/Returns/Finance/Production/Payroll/HPP tidak berubah perilaku runtime
[ ] Reset destructive tetap memakai preview dan keyword guard existing
```

## 7. Catatan legacy docs

Dokumen lama Batch offline Dexie/IndexedDB sebelum SQLite dianggap **arsip historis**. Jika ada konflik antara arsip lama dan kontrak ini, gunakan kontrak SQLite terbaru dan source aktual sebagai acuan.


## Update C1 Supplier SQLite Master-Only

Kontrak aktif:

- Supplier create/update/delete pada mode SQLite wajib lewat backend `/api/suppliers`.
- Delete Supplier SQLite adalah soft-delete/status nonaktif, bukan hard delete.
- Supplier SQLite C1 hanya master data dasar: kode, nama/toko, link, kontak/alamat/catatan jika tersedia.
- Katalog `materialDetails`, purchase history, raw material supplier snapshot, stock, cash/expense, dan report final belum boleh dimutasi dari Supplier SQLite.
- Firebase masih dipertahankan sebagai legacy fallback sampai Products/Raw/Stock/Transactions/Finance/Production selesai dimigrasi dan dites.

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
VITE_SEMI_FINISHED_REPOSITORY_MODE=firebase_primary
VITE_FINANCE_REPOSITORY_MODE=firebase_primary
VITE_PRODUCTION_REPOSITORY_MODE=firebase_primary
VITE_REPORTS_REPOSITORY_MODE=firebase_primary
```

Kontrak aman:

- Product dan Raw Material master boleh SQLite.
- Stock Read Model adalah snapshot SQLite yang disinkronkan dari master/stock engine.
- Stock Adjustment wajib lewat `POST /api/stock/adjustments/commit`, bukan direct write table.
- Purchase/Sales/Returns SQLite commit hanya membuka Product/Raw stock mutation. Finance/income/ledger final tetap batch terpisah.
- Semi Finished, Production, Payroll, HPP, Finance final, dan Reports final tetap guarded sampai ada audit khusus.

## 9. Kontrak D6: Semi Finished, Finance, Reports

Env aktif untuk batch D6:

```env
VITE_SEMI_FINISHED_REPOSITORY_MODE=sqlite
VITE_FINANCE_REPOSITORY_MODE=sqlite
VITE_REPORTS_REPOSITORY_MODE=sqlite
VITE_PRODUCTION_REPOSITORY_MODE=firebase_primary
```

Kontrak aman:

- Semi Finished adalah master stock SQLite dan boleh dipakai Stock Adjustment SQLite.
- Finance commit wajib atomic: cash movement dan `money_movement_ledger` harus ditulis dalam satu transaction backend.
- Purchase/Sales/Returns transaksi baru boleh membuat finance side effect di SQLite, tetapi data legacy Firestore tetap memerlukan migrasi/backfill terpisah.
- Reports membaca data SQLite baru. Jika data lama belum dimigrasi, hasil report hanya mewakili data SQLite yang sudah ada.
- Production/Payroll/HPP tidak boleh dipaksa final sampai audit khusus selesai.
