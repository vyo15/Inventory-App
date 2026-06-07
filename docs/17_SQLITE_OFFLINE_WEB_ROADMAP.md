
## Anti-regression source guard — 2026-06-05

Source ZIP terbaru menetapkan SQLite backend sebagai runtime utama. Roadmap lama yang masih menyebut Firebase/Dexie harus dibaca sebagai catatan sejarah, bukan target runtime aktif. Guard yang wajib dicek sebelum merge patch berikutnya:

- Tidak ada patch yang mengubah repository mode kembali ke Firebase/Dexie/IndexedDB.
- Tidak ada direct write generic ke tabel transaksi, finance ledger, atau stock adjustment.
- Sales tidak boleh memiliki cancel/delete user-facing maupun backend generic delete.
- Return tetap menjadi jalur resmi barang kembali.
- User Management harus memakai localAuth SQLite dan role guard backend.
- Dashboard/report harus tetap punya fallback data kosong dan tidak boleh white screen saat backend/section gagal.
- UI Enterprise Clean tidak boleh mengembalikan wrapper card bertumpuk atau shadow global AntD Card.

# IMS SQLite Offline Web Roadmap

Status: **SQLite runtime aktif berdasarkan source aktual, dengan catatan setiap klaim modul tetap harus diverifikasi dari file source terbaru sebelum patch. Patch 2026-06-05 menambahkan guard Dashboard anti white screen dan global page error boundary.**

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
- Reports dan dashboard data baru. Dashboard wajib memakai kontrak `{ dashboardData, failedReads }` dan fallback section agar tidak white screen.
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
3. Test master data, stock adjustment, purchase, sales, returns, finance, production, payroll, HPP, reports, dan Dashboard.
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
# Manual wajib: buka /dashboard dan pastikan tidak white screen saat backend/section gagal.
```


## Catatan anti white screen

Source aktual pernah mengalami white screen Dashboard karena `Dashboard.jsx` mengharapkan `{ dashboardData, failedReads }`, sedangkan service mengembalikan bentuk lama seperti `summary`, `lowStockItems`, dan `recentSales`. Mulai patch 2026-06-05, Dashboard service harus menjaga kontrak data lengkap dan `AppErrorBoundary` harus tetap membungkus route page di `AppLayout.jsx`.
