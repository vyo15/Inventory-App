# IMS SQLite Local Backend

Backend ini adalah perantara lokal untuk IMS web full-offline LAN berbasis SQLite. React tidak boleh mengakses file SQLite langsung; semua akses harus lewat HTTP API backend ini.

Status saat ini: runtime pilot aktif untuk auth lokal, user management lokal, `customers`, `categories`, dan Supplier master-only. Modul guarded seperti stock mutation, purchase/sales final, returns, finance, production, payroll, HPP, dan reset destructive belum boleh diarahkan ke SQLite tanpa audit khusus.

## Jalankan

```bash
cd backend
npm install
npm run dev
```

Backend default berjalan di:

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
GET    /health
GET    /api
GET    /api/settings
GET    /api/auth/status
POST   /api/auth/bootstrap-admin
POST   /api/auth/login
GET    /api/auth/me
POST   /api/auth/logout
GET    /api/auth/users
POST   /api/auth/users
PUT    /api/auth/users/:id
DELETE /api/auth/users/:id
GET    /api/customers
GET    /api/customers/generate-code
GET    /api/customers/:id
POST   /api/customers
PUT    /api/customers/:id
DELETE /api/customers/:id
GET    /api/categories
GET    /api/categories/:id
POST   /api/categories
PUT    /api/categories/:id
DELETE /api/categories/:id
POST   /api/maintenance/backup
GET    /api/maintenance/backups
GET    /api/maintenance/status
GET    /api/audit-logs
```

## Runtime data

```txt
data/ims-sqlite-sidecar.sqlite
backups/sqlite/
```

Folder/file runtime tidak boleh masuk git atau patch.

## Guardrail

- Jangan arahkan stock/sales/purchase/finance/production/payroll/HPP ke SQLite sebelum audit khusus.
- Jangan hapus Firebase total sebelum semua migrasi terbukti aman.
- Jangan React langsung akses file SQLite.
- Jangan restore destructive tanpa preview, confirm guard, backup otomatis, dan audit log.
- Semua akses SQLite wajib lewat backend ini.
