# Panduan Pengguna Database Lokal — IMS Bunga Flanel

IMS berjalan dengan database SQLite lokal melalui backend Node.js. Semua data utama disimpan di laptop/server lokal, lalu HP/laptop lain mengakses aplikasi lewat jaringan LAN.

## Menjalankan aplikasi

```bash
npm run dev
```

Default akses:

- Backend: `http://localhost:3001`
- Frontend: `http://localhost:5173/Inventory-App/`

Untuk HP/laptop lain satu jaringan, buka frontend lewat IP laptop server.

## Lokasi data

- Database runtime: `data/ims-sqlite-sidecar.sqlite`
- Backup resmi: `backups/sqlite/`
- Backup harian: `backups/sqlite/daily/`
- Backup manual: `backups/sqlite/manual/`
- Backup sebelum restore: `backups/sqlite/pre-restore/`

Jangan copy database runtime saat backend masih aktif. Backup harus dibuat lewat backend/UI resmi agar konsisten.

## Format backup resmi

Backup IMS memakai format:

```text
IMS-BF-BACKUP-YYYYMMDD-HHMMSS-SV{schemaVersion}-{type}.imsbak.zip
```

Contoh:

```text
IMS-BF-BACKUP-20260604-223015-SV4-manual.imsbak.zip
IMS-BF-BACKUP-20260604-080000-SV4-daily.imsbak.zip
IMS-BF-BACKUP-20260604-225000-SV4-pre-restore.imsbak.zip
```

Isi paket backup:

```text
database.sqlite
manifest.json
checksum.sha256
README_RESTORE.txt
```

`manifest.json` berisi schema version, ukuran database, checksum, hasil integrity check, jenis backup, dan ringkasan jumlah data per tabel. Restore hanya boleh menerima backup yang lolos validasi.


## Maintenance & Backup Center

Menu `Maintenance & Backup` adalah pusat perawatan data lokal. Urutan pakainya:

1. Buka `Ringkasan` untuk melihat status aman/tidak.
2. Gunakan `Backup & Restore` untuk backup resmi dan restore guarded.
3. Gunakan `Audit Data` sebelum menjalankan repair.
4. Gunakan `Repair Aman` hanya untuk perbaikan turunan/display yang sudah dipreview.
5. Gunakan `Data Tools` untuk export master dan checklist data pokok.
6. Gunakan `Checklist` sebelum update, restore, atau maintenance besar.
7. Buka `Riwayat` untuk melihat backup/restore resmi.
8. `Reset Testing` hanya catatan arsip nonaktif pada mode database lokal; pemulihan data utama harus lewat Backup & Restore.

## Backup harian otomatis

Saat backend start, sistem mengecek apakah hari itu sudah ada backup harian. Jika belum ada, backend membuat backup `daily` otomatis.

Aturan:

1. Auto backup harian hanya dibuat satu kali per hari.
2. Backup manual tetap bisa dibuat kapan saja dari `Maintenance & Backup Center`.
3. Sistem otomatis membuat backup `pre-restore` sebelum restore berjalan.
4. Backup harus berstatus `verified` sebelum dianggap aman.

## Backup manual dari UI

Buka:

```text
Utilities -> Maintenance & Backup Center -> Backup & Restore -> Backup
```

Lalu klik:

```text
Buat Backup Sekarang
```

Setelah berhasil, cek:

- status backup: `verified`
- ukuran file tidak 0 B
- schema version muncul
- integrity check: `ok`

## Backup eksternal

Backup lokal masih berada di laptop yang sama dengan database utama. Agar aman dari laptop rusak/hilang, copy backup verified ke flashdisk atau harddisk eksternal.

Rekomendasi operasional:

- Harian: pastikan backup hari ini sudah dibuat.
- Mingguan: copy backup terbaru ke flashdisk/harddisk eksternal.
- Sebelum update aplikasi: buat backup manual lalu copy ke media eksternal.
- Setelah banyak transaksi penting: buat backup manual tambahan.

Di tab Backup atau Checklist, klik:

```text
Saya sudah copy ke flashdisk
```

Tombol ini hanya checklist pengingat user. Proses copy tetap dilakukan manual dari folder backup ke flashdisk/harddisk.

## Restore aman

Restore berada di:

```text
Utilities -> Maintenance & Backup Center -> Backup & Restore -> Restore
```

Alur restore:

1. Pilih backup resmi dari daftar.
2. Klik `Preview Restore`.
3. Pastikan backup valid, checksum cocok, integrity check `ok`, dan ringkasan data sesuai.
4. Ketik keyword:

```text
RESTORE SQLITE
```

5. Klik `Restore Database SQLite`.
6. Sistem otomatis membuat backup `pre-restore` sebelum overwrite database aktif.
7. Setelah restore berhasil, refresh aplikasi dan login ulang bila perlu.

Jangan restore dengan cara copy manual `database.sqlite` ke folder `data/` saat backend aktif.

## Checklist auto/manual Maintenance Center

Maintenance & Backup Center memiliki tab `Checklist` untuk membantu user melihat kesiapan backup dan restore tanpa membaca folder manual.

Checklist otomatis terisi jika sistem bisa membuktikan kondisinya, misalnya:

- backend SQLite aktif;
- format backup resmi aktif;
- backup verified hari ini tersedia;
- auto backup harian tersedia;
- backup terakhir valid untuk pemulihan;
- restore guarded dan keyword aktif;
- status modul SQLite terbaca.

Checklist manual tetap perlu dikonfirmasi user karena sistem tidak bisa membuktikan dari backend, misalnya:

- backup sudah dicopy ke flashdisk/harddisk eksternal;
- user lain sudah berhenti input sebelum restore/maintenance besar;
- user memahami bahwa restore mengganti database aktif.

Prinsipnya: yang bisa dibuktikan sistem akan auto terisi, yang hanya diketahui user tetap manual, dan aksi destructive tetap wajib keyword.

## Checklist harian singkat

1. Login akun lokal.
2. Buka Dashboard.
3. Tambah/edit satu data kecil bila perlu test.
4. Pastikan status backup hijau atau buat backup manual.
5. Cek backup terbaru berstatus `verified`.
6. Copy backup ke flashdisk/harddisk minimal seminggu sekali.

## Checklist sebelum update aplikasi

1. Stop perubahan transaksi sementara.
2. Buat backup manual dari UI.
3. Pastikan backup `verified`.
4. Copy backup terbaru ke flashdisk/harddisk.
5. Jalankan update aplikasi.
6. Start backend/frontend.
7. Cek `/health`, login sebagai administrator, lalu buka Database Center.
8. Buat backup manual setelah update bila aplikasi sudah normal.

## Test restore berkala

Sesekali lakukan preview restore pada backup terbaru. Jangan langsung restore database utama jika hanya ingin menguji file backup.

Minimal cek:

- file backup ditemukan;
- manifest tersedia;
- checksum valid;
- integrity check `ok`;
- jumlah data penting terlihat wajar.

## Troubleshooting

### Backup gagal

Cek:

- backend masih berjalan;
- login sebagai administrator lokal;
- folder `backups/sqlite/` bisa ditulis;
- disk laptop tidak penuh;
- database tidak sedang dikunci proses lain.

### Restore preview tidak valid

Jangan lanjut restore. Buat backup baru atau pilih backup lain yang statusnya `verified`.

### File backup tidak ditemukan

Kemungkinan file backup dipindah/dihapus dari folder `backups/sqlite/`. Kembalikan file backup ke folder semula atau buat backup baru.

### Setelah restore tampilan belum berubah

Refresh browser, logout-login ulang, lalu cek Database Center dan `/health`.
