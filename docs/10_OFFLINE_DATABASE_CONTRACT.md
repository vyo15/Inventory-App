# OFFLINE DATABASE CONTRACT — IMS Bunga Flanel

Status: **AKTIF / SOURCE-VERIFIED / SQLITE-FIRST**.

Source aktual memakai backend Node.js + SQLite sebagai runtime utama. Dokumen ini adalah kontrak aktif untuk database lokal/LAN IMS.

## Prinsip utama

1. Backend adalah satu-satunya akses database.
2. Frontend hanya memanggil API HTTP backend.
3. File `.sqlite` tidak boleh dibaca/ditulis langsung dari frontend.
4. Modul guarded wajib lewat endpoint/service resmi.
5. Backup dan restore wajib lewat Database Center/backend maintenance.
6. Runtime lama tidak boleh dihidupkan kembali tanpa approval eksplisit.
7. Docs lama yang bertentangan dianggap arsip historis.

## Scope SQLite aktif

- Auth dan role guard.
- Master data.
- Stock engine dan read model.
- Purchases, sales, returns.
- Finance ledger.
- Production, payroll, HPP.
- Reports dan dashboard.
- Maintenance, backup, restore.
- Module Runtime Status.

## Guard mutation

Mutation berikut wajib atomic/guarded di backend:

- Stock adjustment.
- Purchase stock-in.
- Sales stock-out.
- Return stock restore.
- Production material usage/output.
- Payroll paid expense posting.
- Backup/restore/reset maintenance.

## Backup contract

Backup resmi harus:

- Dibuat dari backend.
- Memiliki manifest/checksum.
- Dicatat di backup logs.
- Bisa diverifikasi sebelum restore.
- Disalin keluar laptop/server secara berkala oleh user.

## Restore contract

Restore resmi harus:

- Memakai backup yang terdaftar.
- Menampilkan preview.
- Memvalidasi integrity/checksum.
- Membuat pre-restore backup.
- Meminta keyword confirm.
- Mencatat restore log.
- Menolak restore jika backup tidak valid.

## Dashboard/report contract

- Read-only.
- Boleh partial fallback bila section gagal.
- Tidak boleh white screen total karena satu data gagal.
- Tidak boleh melakukan repair/reset/mutation otomatis.
- Tidak boleh menampilkan technical ID sebagai data utama user-facing.

## Test minimum

- [ ] `GET /health` sukses dan hanya menampilkan status minimal.
- [ ] `GET /api/maintenance/status` tanpa token ditolak; token administrator sukses.
- [ ] `GET /api/module-runtime-status` tanpa token ditolak; token administrator sukses.
- [ ] Login lokal sukses.
- [ ] CRUD master data pilot sukses.
- [ ] Stock adjustment commit sukses dan audit log tercatat.
- [ ] Backup manual sukses.
- [ ] Restore preview sukses.
- [ ] Restore execute butuh keyword confirm.
- [ ] Dashboard/report tidak white screen.
