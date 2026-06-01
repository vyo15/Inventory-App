# IMS Offline Web

IMS Offline Web adalah project Inventory Management System Bunga Flanel dengan struktur frontend/backend terpisah. Root project sekarang punya runner ringan tanpa dependency tambahan agar backend dan frontend bisa dijalankan sekali command.

## Struktur folder

```text
Inventory-App/
├── frontend/      # React + Vite UI
├── backend/       # Node.js SQLite sidecar backend
├── data/          # Runtime database lokal, tidak masuk source ZIP bersih
├── backups/       # Runtime backup SQLite, tidak masuk source ZIP bersih
├── scripts/       # Helper command lokal
└── docs/          # Dokumentasi project
```


## Menjalankan backend dan frontend sekali command

Cara harian yang disarankan setelah dependency `frontend/` dan `backend/` sudah terpasang:

```bash
npm run dev
```

Command ini menjalankan backend SQLite di port `3001` dan frontend Vite di port `5173` dalam satu terminal. Tekan `Ctrl+C` untuk menghentikan keduanya.

Install dependency pertama kali atau setelah `package-lock.json` berubah:

```bash
npm run install:all
```

Validasi cepat dari root:

```bash
npm run check:backend
npm run build:frontend
```

Jika ingin log frontend dan backend terpisah, tetap boleh pakai dua terminal seperti bagian di bawah.

## Menjalankan frontend

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

Buka dari laptop:

```text
http://localhost:5173/Inventory-App/
```

Buka dari HP/laptop lain satu jaringan:

```text
http://IP-LAPTOP:5173/Inventory-App/
```

## Menjalankan backend SQLite

```bash
cd backend
npm install
npm run check
npm run dev
```

Cek backend:

```bash
curl http://localhost:3001/health
curl http://localhost:3001/api/maintenance/status
```

## Build dan validasi

Frontend:

```bash
cd frontend
npm install
npm run lint
npm run build
```

Backend:

```bash
cd backend
npm install
npm run check
```

## Membuat ZIP bersih

Gunakan `git archive` agar ZIP hanya berisi file yang tracked di Git dan tidak membawa runtime database, backup, `node_modules`, atau `dist`.

Git Bash:

```bash
bash scripts/create-clean-zip.sh
```

PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/create-clean-zip.ps1
```

Manual:

```bash
git archive --format=zip --prefix=Inventory-App/ --output ../Inventory-App-clean.zip HEAD
```

## Catatan runtime data

File berikut dibuat saat aplikasi berjalan dan tidak boleh ikut commit/ZIP distribusi source:

```text
data/*.sqlite
data/*.sqlite-wal
data/*.sqlite-shm
backups/sqlite/*.sqlite
frontend/node_modules/
backend/node_modules/
frontend/dist/
```

Jika database lokal perlu dipindah, lakukan backup/restore secara terpisah. Jangan menjadikan file SQLite runtime sebagai bagian dari source patch.

## Auth lokal SQLite opt-in

Default frontend tetap memakai Firebase Auth agar flow lama tidak rusak.
Untuk pilot auth lokal SQLite, buat file `frontend/.env.local`:

```env
VITE_AUTH_MODE=sqlite
```

Buat administrator lokal pertama dari backend setelah `npm run dev` aktif:

```bash
curl -X POST http://localhost:3001/api/auth/bootstrap-admin \
  -H "Content-Type: application/json" \
  -d '{"confirmKeyword":"CREATE LOCAL ADMIN","username":"admin","displayName":"Administrator Lokal","password":"Admin12345"}'
```

Login frontend tetap memakai field Username dan Password. Dalam mode SQLite, session disimpan di backend pada tabel `local_user_sessions` dan token disimpan di `localStorage` browser.

## Restore SQLite guarded

Restore destructive tidak berjalan dari preview. Restore sungguhan wajib:

1. Login auth lokal sebagai `administrator`.
2. Pilih backup yang valid dari `backups/sqlite/`.
3. Kirim keyword konfirmasi `RESTORE SQLITE` ke endpoint restore execute.
4. Backend membuat backup otomatis sebelum overwrite database aktif.

Endpoint guarded:

```text
POST /api/maintenance/restore-execute
Authorization: Bearer <local-session-token>
```

Flow ini tetap harus dipakai hati-hati. Jangan restore saat transaksi penting sedang berjalan.


## Guard admin lokal untuk maintenance dan master data SQLite

Endpoint maintenance yang membuat/list backup, membuat restore plan, membaca restore logs, dan menjalankan restore wajib memakai session lokal role `administrator`. Endpoint write master data SQLite pilot juga wajib session administrator:

```text
POST/PUT/DELETE /api/categories
POST/PUT/DELETE /api/customers
POST/PUT/DELETE /api/suppliers
```

Endpoint read/status seperti `/health`, `/api/maintenance/status`, `/api/auth/status`, `GET /api/categories`, `GET /api/customers`, dan `GET /api/suppliers` tetap public sementara untuk status/dev compatibility. Frontend SQLite adapter otomatis mengirim `Authorization: Bearer <local-session-token>` dari auth lokal saat token tersedia.

Contoh pakai token admin lokal:

```bash
curl -X POST http://localhost:3001/api/maintenance/backup \
  -H "Authorization: Bearer <local-session-token>"
```


Catatan guard restore: Restore execute wajib memilih `filename` backup secara eksplisit. Backend juga menerima alias `backupFileName`, tetapi tidak akan restore otomatis dari backup terbaru tanpa nama file yang jelas.
