# IMS Database Lokal

Layanan ini menjadi perantara database lokal untuk IMS web full-offline. Frontend tidak boleh mengakses file database langsung; semua akses harus lewat HTTP API layanan lokal.

Status saat ini: database lokal menjadi runtime utama untuk modul operasional. Modul guarded seperti stock mutation, purchase/sales final, returns, finance, production, payroll, HPP, backup, dan restore tetap wajib lewat service resmi dan audit source aktual.

## Jalankan

```bash
cd backend
npm install
npm run dev
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
POST   /api/auth/bootstrap-admin       # hanya jika belum ada administrator aktif
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

## Runtime data

```txt
data/ims-sqlite-sidecar.sqlite
backups/sqlite/
```

Folder/file runtime tidak boleh masuk git atau patch.

## Guardrail

- Jangan mengubah jalur stock/sales/purchase/finance/production/payroll/HPP tanpa audit khusus.
- Jangan hapus compatibility data historis total sebelum semua migrasi terbukti aman dan tidak ada runtime arsip aktif.
- Jangan frontend langsung akses file database.
- Jangan restore destructive tanpa preview, confirm guard, backup otomatis, dan audit log.
- Semua akses database wajib lewat layanan lokal ini.

## Public endpoint hardening

Endpoint public hanya boleh menampilkan status minimal untuk cek layanan dan kebutuhan login/bootstrap. Detail operasional seperti path database, folder backup, jumlah data, backup policy, audit count, dan status modul aplikasi hanya boleh dibuka setelah login administrator.
