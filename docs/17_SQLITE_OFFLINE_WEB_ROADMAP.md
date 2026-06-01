# IMS SQLite Offline Web Roadmap

Status: **SQLite-C1 foundation safety / runtime pilot Categories & Customers / Dexie tidak lagi aktif di UI utama**

## 1. Keputusan arsitektur

Target arsitektur aktif untuk pilot:

```text
React Web UI -> Node.js Backend lokal -> SQLite database file lokal
```

Untuk akses HP/laptop lain satu jaringan:

```text
Laptop/PC utama menjalankan backend + frontend
HP/laptop kedua membuka http://IP-LAPTOP:5173/Inventory-App/
React otomatis memanggil http://IP-LAPTOP:3001 untuk API SQLite
```

## 2. Status patch saat ini

Yang aktif:

- Backend SQLite local di folder `backend/`.
- Health check: `GET /health`.
- Status database: `GET /api/maintenance/status`.
- Backup database: `POST /api/maintenance/backup`.
- Audit log: `GET /api/audit-logs`.
- CRUD SQLite untuk `customers` dan `categories`.
- Adapter frontend SQLite untuk halaman Customer dan Kategori.
- Repository mode default diarahkan ke `sqlite_sidecar`.
- Offline Database Center diganti menjadi **SQLite Local DB Center**.
- Dependency `dexie` dihapus dari package root dan tidak lagi dipakai runtime aktif.

Yang belum dimigrasi:

- Supplier masih Firebase-primary karena terkait purchase/raw/history.
- Stock, sales, purchase, returns, finance, production, payroll, HPP belum boleh diarahkan ke SQLite tanpa audit khusus.
- Restore database SQLite production belum dibuat karena destructive dan perlu guard terpisah.
- Firebase belum dihapus agar legacy/fallback dan migrasi bertahap tetap aman.


## 2A. C1 Foundation Safety sudah ditambahkan

C1 menambahkan guard migrasi sebelum full offline:

- Tabel `module_migration_status` untuk menandai modul `sqlite_active`, `firebase_only`, `firebase_auth`, `firebase_primary_snapshot_pending`, dan `guarded`.
- Tabel `restore_logs` untuk mencatat preview restore.
- Tabel `business_code_counters` sebagai reserved foundation untuk counter SQLite, belum dipakai mengganti generator guarded.
- Endpoint `GET /api/migration-status`.
- Endpoint `POST /api/maintenance/restore-plan` yang **preview-only** dan tidak mengubah database.
- Endpoint `GET /api/maintenance/restore-logs`.
- SQLite Local DB Center menampilkan tab Migrasi Modul dan Restore Plan.

C1 belum memigrasi stock, purchase, sales, returns, finance, production, payroll, HPP, auth, atau report final.

## 3. Cara menjalankan

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

Buka dari laptop:

```text
http://localhost:5173/Inventory-App/
```

Buka dari HP satu WiFi/LAN:

```text
http://IP-LAPTOP:5173/Inventory-App/
```

Jika perlu override API backend:

```text
VITE_SQLITE_API_BASE_URL=http://IP-LAPTOP:3001
```

## 4. Runtime data

```text
data/ims-sqlite-sidecar.sqlite
backups/sqlite/
```

Folder runtime tidak boleh masuk git/patch.

## 4A. Membuat ZIP bersih

Gunakan `git archive` dari root repository agar file runtime SQLite, backup, `node_modules`, dan `dist` tidak ikut masuk ZIP:

```bash
git archive --format=zip --prefix=Inventory-App/ --output ../Inventory-App-clean.zip HEAD
```

Atau gunakan helper:

```bash
bash scripts/create-clean-zip.sh
```

PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/create-clean-zip.ps1
```

Sebelum membuat ZIP, pastikan perubahan sudah di-commit jika ingin ikut masuk ke ZIP. `git archive HEAD` hanya mengambil isi commit terakhir.

## 5. Guardrail migrasi

Jangan lakukan tanpa audit dan approval terpisah:

- Menghapus Firebase secara total.
- Mengarahkan transaksi final ke SQLite.
- Mengubah stock mutation, sales, purchase, returns, finance, production, payroll, HPP.
- Membuat restore destructive tanpa preview, confirm guard, dan backup otomatis.
- Membuka akses langsung React ke file SQLite.
- Mengakses file SQLite lewat shared folder dari HP/laptop lain.

Semua write SQLite wajib lewat backend.

## 6. Roadmap lanjut

### SQLite-D — Backup/Restore Guarded

- Preview restore.
- Keyword confirm.
- Backup otomatis sebelum restore.
- Restore log.
- Lock agar restore tidak menyentuh file lain.

### SQLite-E — Supplier audit sebelum migrasi

- Audit relasi supplier dengan purchase/raw/history.
- Desain soft delete dan audit log.
- Tentukan apakah supplier boleh SQLite-first.

### SQLite-F dan seterusnya

Audit satu-satu untuk stock engine, purchase, sales, returns, finance ledger, production, payroll, dan HPP.

## 7. Test checklist runtime SQLite pilot

```text
[ ] cd backend
[ ] npm install
[ ] npm run check
[ ] npm run dev
[ ] buka http://localhost:3001/health
[ ] buka http://localhost:3001/api/maintenance/status
[ ] POST /api/maintenance/backup berhasil
[ ] buka IMS frontend laptop
[ ] buka IMS frontend dari HP lewat http://IP-LAPTOP:5173/Inventory-App/
[ ] Tambah kategori dari laptop, refresh HP, data muncul
[ ] Tambah customer dari HP, refresh laptop, data muncul
[ ] Restart backend, data SQLite masih ada
[ ] cd frontend
[ ] npm install
[ ] npm run lint
[ ] npm run build
[ ] cd ../backend
[ ] npm run check
```

## 8. Catatan legacy cleanup

File Dexie/IndexedDB lama yang sudah tidak diimpor runtime aktif boleh diaudit sebagai cleanup candidate. Penghapusan fisik file lama sebaiknya dilakukan sebagai patch cleanup terpisah karena banyak dokumen lama masih menyebut batch Dexie dan user sedang migrasi bertahap.
