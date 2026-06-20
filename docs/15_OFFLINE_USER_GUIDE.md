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

Backup IMS memakai satu file khusus:

```text
IMS-BF-BACKUP-YYYYMMDD-HHMMSS-SV{schemaVersion}-{type}.imsbackup
```

Contoh:

```text
IMS-BF-BACKUP-20260604-223015-SV4-manual.imsbackup
IMS-BF-BACKUP-20260604-080000-SV4-daily.imsbackup
IMS-BF-BACKUP-20260604-225000-SV4-pre-restore.imsbackup
```

File `.imsbackup` adalah paket compact resmi IMS. Secara internal isinya:

```text
database.sqlite
manifest.json
checksum.sha256
README_RESTORE.txt
```

`manifest.json` berisi schema version, ukuran database, checksum, hasil integrity check, jenis backup, dan ringkasan jumlah data per tabel. Restore hanya boleh menerima backup yang lolos validasi.

Backup lama `.imsbak.zip` tetap didukung sebagai legacy restore agar backup yang sudah pernah dibuat tetap bisa dipakai.


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
4. Setelah restore selesai, backup `pre-restore` otomatis didaftarkan ulang agar tetap muncul di daftar backup untuk rollback jika restore ternyata salah. Backup sumber restore juga dipastikan tetap tercatat agar riwayat restore mudah dilacak.
5. Backup harus berstatus `verified` sebelum dianggap aman.

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
- nama file berakhir `.imsbackup`
- ukuran file tidak 0 B
- schema version muncul
- integrity check: `ok`
- tombol `Download` bisa menyimpan file backup ke folder pilihan user

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
RESTORE DATABASE
```

5. Klik `Restore Database`.
6. Sistem otomatis membuat backup `pre-restore` sebelum overwrite database aktif.
7. Setelah restore berhasil, refresh aplikasi dan login ulang bila perlu.

Jangan restore dengan cara copy manual `database.sqlite` ke folder `data/` saat backend aktif.

## Import backup dari flashdisk

Jika backup berasal dari komputer lama, flashdisk, harddisk eksternal, atau folder download:

1. Buka tab `Restore`.
2. Klik `Pilih File Backup IMS`.
3. Pilih file `.imsbackup`.
4. Klik `Import & Validasi Backup`.
5. Setelah import berhasil, file akan masuk daftar backup resmi.
6. Klik `Preview Restore`.
7. Jika preview valid, ketik `RESTORE DATABASE`, lalu jalankan restore.

Import backup belum mengubah data. Data baru berubah setelah `Restore Database` dijalankan dan berhasil. Restore adalah full replace database aktif, bukan merge/tambah data.


## Checklist auto/manual Maintenance Center

Maintenance & Backup Center memiliki tab `Checklist` untuk membantu user melihat kesiapan backup dan restore tanpa membaca folder manual.

Checklist otomatis terisi jika sistem bisa membuktikan kondisinya, misalnya:

- backend SQLite aktif;
- format backup resmi aktif;
- backup verified hari ini tersedia;
- auto backup harian tersedia;
- backup terakhir valid untuk pemulihan;
- file backup hasil import sudah lolos validasi;
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
- file `.imsbackup` bisa didownload/import;
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

Kemungkinan file backup dipindah/dihapus dari folder `backups/sqlite/`. Gunakan tombol Import File Backup IMS untuk mendaftarkan file `.imsbackup` dari luar folder, kembalikan file backup ke folder semula, atau buat backup baru.

### Setelah restore tampilan belum berubah

Refresh browser, logout-login ulang, lalu cek Database Center dan `/health`.

## Sinkron source lewat GitHub saat pindah PC

Source code IMS dipindahkan lewat GitHub. Database transaksi tidak ikut GitHub dan harus dipindahkan lewat backup `.imsbackup`.

### Setup pertama di PC baru

```bash
npm install
npm run install:all
npm run git:setup
```

`npm run git:setup` memasang shortcut lokal untuk repository ini:

```bash
git check
git check --full
git savepush "Pesan commit"
git zipclean
```

Shortcut Git bersifat lokal per clone/repository. Jika `git check` belum dikenal setelah clone baru, jalankan kembali `npm run git:setup` atau gunakan fallback yang selalu tersedia: `npm run git:check` dan `npm run git:check:full`.

Catatan: `git push` tetap command bawaan Git, tetapi setelah setup, push akan melewati pre-push hook IMS agar perubahan yang belum commit tidak diam-diam tertinggal.

### Cek sebelum push

Gunakan:

```bash
git check
```

Command ini mengecek:

- branch aktif, commit terakhir, dan upstream branch;
- working tree harus bersih;
- runtime database/backup tidak boleh ter-track;
- backend syntax check;
- lint frontend;
- automated test script, backend, dan frontend.

Untuk cek lengkap termasuk frontend production build:

```bash
git check --full
```

atau:

```bash
npm run git:check:full
```

Untuk membuat ZIP source, gunakan command resmi berikut dan jangan memakai `Compress-Archive` manual:

```bash
npm run clean:zip:ps
```

Script resmi memvalidasi source readiness dan membuat ZIP dari commit `HEAD`. Jika validasi atau `git archive` gagal, proses berhenti dan ZIP tidak dianggap berhasil.

### Commit dan push cepat

Jika ada perubahan dan ingin langsung commit + push dari folder project:

```bash
git savepush "Update IMS"
```

Alternatif tanpa Git alias:

```bash
npm run git:push -- "Update IMS"
```

Command ini akan:

1. menjalankan check;
2. `git add -A`;
3. membuat commit dengan pesan yang diberikan;
4. menjalankan `git push` ke branch aktif.

Jika belum ada upstream, command akan memakai:

```bash
git push -u origin <branch>
```

### Membuat ZIP bersih

Gunakan:

```bash
git zipclean
```

atau:

```bash
npm run clean:zip
```

ZIP bersih dibuat dari commit `HEAD`. Karena itu script akan menolak berjalan jika masih ada perubahan belum commit. Ini mencegah patch/source terbaru tidak ikut ZIP.

### Data aplikasi saat pindah PC

Yang ikut GitHub:

- source frontend/backend;
- docs;
- scripts;
- file konfigurasi contoh seperti `.env.example`.

Yang tidak ikut GitHub:

- `data/*.sqlite`;
- `backups/*`;
- `.env`, `backend/.env`, `frontend/.env`, `.env.local`;
- `node_modules`, `dist`, cache build.

Untuk pindah data transaksi ke PC baru, gunakan Backup & Restore resmi dari file `.imsbackup`, bukan GitHub.
