# IMS Database Lokal

Layanan ini menjadi perantara database lokal untuk IMS web full-offline. Frontend tidak boleh mengakses file database langsung; semua akses harus lewat HTTP API layanan lokal.

Status saat ini: database lokal menjadi runtime utama untuk modul operasional. Modul guarded seperti stock mutation, purchase/sales final, returns, finance, production, payroll, HPP, backup, dan restore tetap wajib lewat service resmi dan audit source aktual.

## Jalankan

Mode utama yang direkomendasikan menjalankan backend dan frontend dari root project:

```bash
npm run dev
```

Untuk backend saja tanpa auto-reload:

```bash
cd backend
npm install
npm run dev
```

Auto-reload Nodemon tetap tersedia sebagai mode pengembangan opsional:

```bash
npm run dev:watch
```

Layanan lokal default berjalan di:

```txt
http://localhost:3001
```

Jika laptop memiliki IP statis, HP/laptop lain satu WiFi bisa test:

```txt
http://IP-LAPTOP:3001/health
```

Frontend dapat dibuka dari HP melalui:

```txt
http://IP-LAPTOP:5173/Inventory-App/
```

## Endpoint aktif

```txt
GET    /health                         # public minimal
GET    /api                            # public minimal
GET    /api/auth/status                # public minimal untuk bootstrap/login
POST   /api/auth/bootstrap-admin       # hanya jika belum ada admin + kode setup terminal
POST   /api/auth/login
GET    /api/settings                   # administrator
GET    /api/auth/me                    # login
POST   /api/auth/logout                # login
GET    /api/auth/users                 # administrator
POST   /api/auth/users                 # administrator
PUT    /api/auth/users/:id             # administrator
DELETE /api/auth/users/:id             # administrator
GET    /api/customers                  # login
GET    /api/customers/generate-code    # login
GET    /api/customers/:id              # login
POST   /api/customers                  # administrator
PUT    /api/customers/:id              # administrator
DELETE /api/customers/:id              # administrator
GET    /api/categories                 # login
GET    /api/categories/:id             # login
POST   /api/categories                 # administrator
PUT    /api/categories/:id             # administrator
DELETE /api/categories/:id             # administrator
GET    /api/module-runtime-status      # administrator
GET    /api/maintenance/status         # administrator
POST   /api/maintenance/backup         # administrator
GET    /api/maintenance/backups        # administrator
GET    /api/audit-logs                 # administrator
```

## Auth lokal

- Login browser memakai cookie `ims_session` dengan `HttpOnly` dan `SameSite=Lax`; raw token tidak dikirim di JSON, endpoint auth tidak boleh di-cache, dan header `X-Powered-By` dinonaktifkan.
- Frontend harus mengirim request dengan `credentials: "include"`.
- Bearer token lama ditolak secara default. Aktifkan sementara `IMS_AUTH_ALLOW_LEGACY_BEARER=true` hanya jika perangkat lama perlu dimigrasikan melalui `/api/auth/me`, lalu kembalikan ke `false`.
- Origin frontend dengan hostname yang sama seperti backend otomatis diizinkan. Origin tambahan dapat diisi lewat `IMS_SQLITE_CORS_ORIGIN` sebagai daftar dipisahkan koma; jangan gunakan wildcard.
- Pada database baru, kode setup administrator pertama dicetak di terminal backend. Endpoint `/api/auth/status` hanya menyatakan bahwa bootstrap diperlukan dan tidak mengirim kodenya.
- `IMS_AUTH_BOOTSTRAP_CODE` boleh diisi untuk kode setup stabil minimal 8 karakter. Jika kosong, kode acak berubah setiap backend restart.
- `IMS_AUTH_COOKIE_SECURE` tetap `false` untuk HTTP LAN dan hanya boleh `true` pada HTTPS.

## Quality gate

```bash
npm test
npm run check
```

Runner test menemukan seluruh file `backend/test/**/*.test.js`. Root check menjalankan test, syntax check backend, dan production build frontend. `git check`/pre-push juga menjalankan automated test.

## Runtime data

```txt
data/ims-sqlite-sidecar.sqlite
backups/sqlite/
```

Saat backend aktif dalam mode WAL, SQLite dapat membuat `ims-sqlite-sidecar.sqlite-wal` dan `ims-sqlite-sidecar.sqlite-shm`. Ketiga file tersebut adalah satu database logis. Root runner menjalankan backend sebagai child Node langsung dan memakai IPC internal untuk meminta checkpoint WAL serta penutupan koneksi sebelum frontend dihentikan. Backend standalone tetap menangani `SIGINT`/`SIGTERM`/`SIGHUP` dan `SIGBREAK` di Windows. Setelah shutdown normal, WAL/SHM harus dilepas. Jangan menghapus sidecar secara manual ketika layanan masih aktif.

Path database, backup, dan log relatif dihitung dari folder `backend/`, bukan `process.cwd()`. Menjalankan backend dari root repository maupun dari folder `backend/` tetap menunjuk runtime `data/`, `backups/`, dan `logs/` yang sama.

Folder/file runtime tidak boleh masuk git atau patch.

## Guardrail

- Jangan mengubah jalur stock/sales/purchase/finance/production/payroll/HPP tanpa audit khusus.
- Jangan hapus compatibility data historis total sebelum semua migrasi terbukti aman dan tidak ada runtime arsip aktif.
- Jangan frontend langsung akses file database.
- Jangan restore destructive tanpa preview, confirm guard, backup otomatis, dan audit log.
- Semua akses database wajib lewat layanan lokal ini.

## Public endpoint hardening

Endpoint public hanya boleh menampilkan status minimal untuk cek layanan dan kebutuhan login/bootstrap. Detail operasional seperti path database, folder backup, jumlah data, backup policy, audit count, dan status modul aplikasi hanya boleh dibuka setelah login administrator.
