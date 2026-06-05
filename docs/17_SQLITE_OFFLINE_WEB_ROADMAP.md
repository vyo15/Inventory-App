# IMS SQLite Offline Web Roadmap

Status: **selesai untuk full SQLite runtime**.

## Arsitektur final

```text
React Web UI
-> Node.js backend lokal/LAN
-> SQLite database file lokal
```

## Modul yang sudah menggunakan SQLite

- Auth lokal dan user management.
- Master data: categories, customers, suppliers, pricing rules, products, raw materials, semi finished.
- Stock: read model, adjustment, inventory log.
- Transactions: purchases, sales, returns.
- Finance: cash in, cash out, money movement ledger.
- Production: steps, employees, profiles, BOM, planning, orders, work logs.
- Payroll dan HPP.
- Reports dan dashboard data baru.
- Backup resmi `.imsbak.zip`, restore guarded, maintenance, migration status, audit log.

## Backup dan restore final

Backup adalah bagian wajib arsitektur SQLite offline, bukan fitur tambahan.

Format backup resmi:

```text
IMS-BF-BACKUP-YYYYMMDD-HHMMSS-SV{schemaVersion}-{type}.imsbak.zip
```

Isi paket:

```text
database.sqlite
manifest.json
checksum.sha256
README_RESTORE.txt
```

Jenis backup aktif:

- `daily`: dibuat otomatis saat backend start jika hari itu belum ada backup.
- `manual`: dibuat user dari SQLite Local DB Center.
- `pre-restore`: dibuat otomatis sebelum restore guarded berjalan.
- `pre-update`, `pre-reset`, `pre-import`: disiapkan sebagai pola untuk aksi berisiko berikutnya.

Aturan aman:

1. Backup hanya lewat backend/UI resmi.
2. Jangan copy file database aktif saat backend berjalan.
3. Backup harus punya manifest, checksum SHA-256, dan integrity check.
4. Restore wajib preview, validasi backup, dan keyword `RESTORE SQLITE`.
5. Backend wajib membuat backup `pre-restore` sebelum overwrite database aktif.
6. Backup lokal wajib dicopy rutin ke flashdisk/harddisk eksternal.

## Maintenance & Backup Center

Menu reset lama dirapikan menjadi `Maintenance & Backup Center`. Backup & Restore menjadi tab utama karena SQLite offline bergantung pada backup resmi. Reset destructive diposisikan sebagai `Reset Testing`, berada paling akhir, dan nonaktif pada mode full SQLite sampai ada backend reset resmi dengan preview, backup otomatis, keyword, serta audit log SQLite.

Tab aktif:

- Ringkasan.
- Backup & Restore.
- Audit Data.
- Repair Aman.
- Data Tools.
- Checklist.
- Riwayat.
- Reset Testing.

Tab `Data Tools` menampung preview/hapus data test bermarker dan export master/checklist agar tidak bercampur dengan reset destructive. Tab `Checklist` menggabungkan status otomatis dan konfirmasi manual. Checklist otomatis membaca backend SQLite, backup logs, manifest, policy backup, restore guard, dan module migration status. Checklist manual dipakai untuk hal yang tidak bisa dibuktikan sistem seperti copy backup ke flashdisk atau memastikan user lain sudah berhenti input sebelum restore. Tab `Riwayat` menampilkan backup dan restore resmi dari backend SQLite agar admin bisa melihat kapan backup/restore dilakukan dan file mana yang digunakan.

## Checklist operasional

1. Jalankan backend dan frontend dari root project dengan `npm run dev`.
2. Login memakai akun lokal SQLite.
3. Test master data, stock adjustment, purchase, sales, returns, finance, production, payroll, HPP, dan reports.
4. Cek SQLite Local DB Center.
5. Buka Maintenance & Backup Center -> Checklist.
6. Pastikan checklist auto utama hijau: backend aktif, backup verified hari ini, format backup resmi, restore guarded, dan status modul terbaca.
7. Copy backup verified ke flashdisk/harddisk eksternal minimal mingguan lalu tandai checklist manual.
8. Jalankan audit strict sebelum release.

## Yang tidak boleh diubah tanpa approval

- Schema/table SQLite penting.
- Stock engine atomic.
- Purchase/sales/returns side effect.
- Finance ledger.
- Production material usage, payroll final, dan HPP final.
- Reset/restore destructive.
- Route/menu/role guard.

## Command verifikasi final

```bash
npm --prefix backend run check
npm --prefix backend run audit:sqlite-cutover -- --strict
npm --prefix frontend run build
```
