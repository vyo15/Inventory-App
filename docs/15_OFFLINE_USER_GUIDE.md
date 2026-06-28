# Panduan Pengguna Database Lokal — IMS Bunga Flanel

IMS berjalan dengan database SQLite lokal melalui backend Node.js. Semua data utama disimpan di laptop/server lokal, lalu HP/laptop lain mengakses aplikasi lewat jaringan LAN.

## Menjalankan aplikasi

```bash
npm run dev
```

Perintah tersebut otomatis menjalankan backend dan frontend dalam satu terminal. Tidak perlu membuka dua command terpisah.

Default akses:

- Backend: `http://localhost:3001`
- Frontend: `http://localhost:5173/Inventory-App/`

Untuk HP/laptop lain satu jaringan, buka frontend lewat IP laptop server.

## Setup database awal

Saat database masih kosong, login sebagai Administrator lalu klik tombol compact **Setup Awal** pada header Dashboard. Tombol menampilkan progress, misalnya `3/8`, dan membuka panel mengambang yang dapat disembunyikan sementara tanpa menghapus progress. Launcher dan panel otomatis hilang setelah seluruh langkah wajib selesai.

Urutan pada panel dibagi menjadi tiga fase:

```text
Fase 1 · Fondasi
Kategori & Kelompok
→ Tahapan Produksi
→ Karyawan Produksi

Fase 2 · Master Operasional
Master Produk dan Bahan
→ Supplier & Katalog Restock
→ BOM / Resep Produksi

Fase 3 · Go-Live
Stok Awal Tercatat
→ Backup Baseline Setup
```

Panel menandai langkah berikutnya yang belum selesai dan menyediakan tautan langsung ke menu terkait. Progress tetap dihitung otomatis dari data aktif; panel tidak membuat master, stok, transaksi, atau backup secara otomatis.

SOP lengkap berada di `docs/22_INITIAL_DATABASE_SETUP_SOP.md`.

## Supplier, Katalog Restock, dan Histori Toko

1. Buka menu **Supplier** untuk melihat daftar toko. Kode dan ID internal dibuat otomatis oleh backend dan tidak ditampilkan.
2. Klik **Detail** pada satu toko. Drawer yang sama dipakai ulang untuk setiap supplier dan hanya memuat data toko yang dipilih.
3. Tab **Ringkasan** menampilkan informasi toko; tab **Katalog** menampilkan barang/link dan harga terbaru; tab **Histori Toko** menyimpan harga lama, waktu pengecekan/perubahan, perubahan link/status, dan pelaku aktivitas khusus toko tersebut.
4. Gunakan **Kelola Katalog** untuk menambahkan banyak Produk/Bahan Baku. Satu barang boleh mempunyai beberapa link/paket di toko yang sama dan boleh tersedia pada supplier lain.
5. Gunakan **Cek Harga** setelah membuka link toko. Pilih hasil: harga tersedia, barang habis, atau link tidak tersedia. Harga lama dan detail waktu tidak ditampilkan pada tabel utama; semuanya masuk Histori Toko.
6. Penawaran lama sebaiknya dinonaktifkan atau ditandai tidak tersedia, bukan dihapus, agar histori transaksi tetap utuh.

## Bahan Baku

1. Buka menu **Bahan Baku** untuk membuat atau mengubah identitas bahan, kelompok, satuan stok, varian, minimum stok, dan harga.
2. Supplier tidak dipilih sebagai satu field pada master Bahan Baku. Setelah bahan tersimpan, gunakan **Atur Sumber Restock** atau buka menu Supplier dengan filter bahan untuk menambahkan banyak toko/link.
3. Jika membuat bahan dengan stok awal lebih dari 0, isi **Modal Stok Awal / Satuan**. Tanpa modal awal, data tidak dapat disimpan karena nilai persediaan/HPP akan menjadi nol palsu.
4. Untuk bahan tanpa varian, minimum stok diisi pada master. Untuk bahan bervarian, isi minimum stok pada setiap varian sesuai kebutuhan warna/ukuran.
5. Setelah bahan mempunyai transaksi Pembelian, **Modal Aktual Rata-rata / Satuan** ditampilkan read-only dan diperbarui otomatis dari weighted average Pembelian.
6. Bahan tidak dapat dinonaktifkan selama masih mempunyai stok/reserved, masih dipakai BOM aktif, atau masih menjadi bagian proses produksi aktif.
7. Daftar utama hanya menampilkan ringkasan sumber restock seperti jumlah toko dan link. Harga lama serta histori pengecekan tetap berada di Histori Toko masing-masing Supplier.

## SOP Pembelian dan Verifikasi Harga

1. Pilih Produk/Bahan Baku dan variannya bila ada.
2. Pilih supplier yang menyediakan barang tersebut, lalu pilih satu **Link / Paket Toko**.
3. Klik **Buka Toko**, cek harga, isi paket/konversi, dan ketersediaan aktual.
4. Isi Qty dan Subtotal Barang sesuai kondisi toko, lalu klik **Verifikasi Harga**.
5. Jika harga sama, sistem mencatat pengecekan. Jika berubah, harga katalog diperbarui ketika Pembelian berhasil disimpan dan perubahan masuk Histori Toko.
6. Tombol **Simpan** tetap terkunci sampai harga diverifikasi. Perubahan qty, subtotal, supplier, atau penawaran setelah verifikasi mewajibkan verifikasi ulang.
7. Commit Pembelian menyimpan snapshot harga/link/konversi dan secara atomic menambah stok serta mencatat pengeluaran. Histori Pembelian lama tidak berubah ketika katalog diperbarui kemudian.

## Lokasi data

- Database runtime: `data/ims-sqlite-sidecar.sqlite`
- Saat layanan aktif, file `ims-sqlite-sidecar.sqlite-wal` dan `ims-sqlite-sidecar.sqlite-shm` dapat muncul. Itu normal dan tetap satu database, bukan tiga database berbeda.
- Hentikan aplikasi dengan `Ctrl+C` satu kali. Tunggu log `ims_local_server_shutdown_completed`, `[dev] backend menutup database dengan aman.`, dan `[dev] seluruh layanan berhenti.` Setelah itu WAL/SHM akan dilepas. Jangan menghapus sidecar secara manual.
- Backup resmi: `backups/sqlite/`
- Backup harian: `backups/sqlite/daily/`
- Backup bulanan: `backups/sqlite/monthly/`
- Backup manual/import/sebelum restore: `backups/sqlite/manual/`

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

File `.imsbackup` adalah satu-satunya file yang perlu dipindahkan atau didownload. Manifest dan checksum tidak lagi dibuat sebagai file terpisah. Secara internal package berisi:

```text
database.sqlite
manifest.json
checksum.sha256
README_RESTORE.txt
```

`manifest.json` berisi schema version, ukuran database, checksum, hasil integrity check, jenis backup, dan ringkasan jumlah data per tabel. Restore hanya boleh menerima backup yang lolos validasi.

Backup lama `.imsbak.zip` tetap didukung sebagai legacy restore agar backup yang sudah pernah dibuat tetap bisa dipakai. Jika file masih berada di folder luar, drive lain, atau lokasi komputer lama, gunakan **Import Backup** agar file disalin dan diverifikasi ke storage resmi `manual/`. IMS tidak memakai, mendownload, merestore, mempromosikan, atau menghapus file langsung dari path luar yang hanya tercatat pada registry lama.


## SOP Return dari Sales

1. Buka menu `Return`, lalu pilih `Tambah Retur`.
2. Pilih transaksi Sales terkait. Item tidak dipilih dari master bebas; IMS hanya menampilkan item yang benar-benar ada pada Sales tersebut.
3. Pilih item/varian dengan sisa qty retur yang masih tersedia.
4. Isi qty maksimal sesuai sisa yang ditampilkan dan isi alasan/catatan.
5. Simpan. Backend memvalidasi ulang relasi Sales, item, qty kumulatif, dan stok sebelum commit.
6. Return selalu berstatus final `Selesai`, menambah stok melalui `return_in`, dan tidak membuat refund, expense, atau ledger otomatis. Koreksi kas harus melalui proses finance terpisah yang disetujui.

## Maintenance Center

Menu `Maintenance Center` adalah pusat perawatan data lokal. Urutan pakainya:

1. Buka `Ringkasan` untuk melihat status layanan, backup terverifikasi terakhir, status audit, dan tindakan yang perlu diperiksa.
2. Nilai `Belum diperiksa` berarti audit belum dijalankan. Nilai tersebut tidak disamarkan menjadi `0`.
3. Gunakan `Backup & Restore` untuk membuat backup, preview restore, melihat seluruh cakupan data, dan membuka detail teknis bila diperlukan.
4. Di dalam `Backup & Restore`, gunakan selector compact `Backup`, `Restore`, `Cakupan Data`, dan `Detail Teknis`. Status, kebijakan retensi, serta nama file lengkap tersedia melalui tombol `Informasi`, `Kebijakan`, atau `Detail` agar tidak memenuhi tampilan utama.
5. Buka `Kesehatan Data`, lalu pilih `Audit — Hanya baca` untuk pemeriksaan integrity database, foreign key, invariant stok, data turunan stok, registry backup, dan rekonsiliasi kas-ledger. Angka issue adalah total penuh; kolom contoh dapat menampilkan sebagian dan memberi penanda jumlah contoh. Audit tidak mengubah data bisnis, tetapi ringkasannya dicatat pada audit log.
6. Pada area yang sama, pilih `Perbaikan — Dengan pengaman` untuk rebuild missing/stale `stock_read_models` atau cleanup orphan. Sistem membuat backup `pre-repair`; cleanup membutuhkan keyword `BERSIHKAN DATA STOK`.
7. Repair stok utama, transaksi, finance, production, payroll, HPP, dan reset data tidak tersedia dari menu ini. Temuan finance harus direview manual; tidak ada Repair Side-Effect Transaksi otomatis.
8. Buka `Alat Admin` untuk `Export Data Master` atau `Checklist`. File export JSON bukan paket restore.
9. Gunakan `Data Nonaktif` untuk melihat data yang aman dihapus dan data yang masih dilindungi histori.
10. Buka `Riwayat` untuk melihat backup, restore, import, repair, cleanup, purge, dan lifecycle backup resmi dengan filter serta pagination.

Tombol `Panduan & Status` pada header membuka informasi urutan aman dan status pemeriksaan. Informasi tersebut tidak ditampilkan sebagai banner permanen supaya workspace tetap ringkas.

## Cakupan data backup

Tab `Cakupan Data` menampilkan seluruh kelompok data yang berada di database aktif:

- Master Data: produk, bahan baku, produk setengah jadi, kategori, supplier, customer, dan aturan harga.
- Katalog Supplier: penawaran restock dan histori katalog/harga per supplier.
- Stok: posisi stok, penyesuaian stok, dan histori mutasi persediaan.
- Transaksi: pembelian, penjualan, dan retur.
- Produksi: tahap, pekerja, template, BOM, planning, order, work log, dan payroll produksi.
- Keuangan: pemasukan, pengeluaran, dan ledger.
- Sistem & Histori: user, audit log, riwayat backup/restore, dan snapshot laporan.
- Data Teknis: metadata schema, pengaturan aplikasi, status modul, counter kode, role, sesi login, dan peta migrasi.

Jumlah yang tampil adalah jumlah record fisik yang masih tersimpan, sehingga dapat mencakup histori atau record lama. Semua tabel tersebut ikut dalam backup resmi karena backup mengambil database SQLite secara utuh.

Ringkasan membaca `/api/maintenance/status` secara otomatis setiap 15 detik saat halaman terlihat dan juga ketika tab/browser kembali aktif. Frontend hanya menerima angka jika backend mengirim kontrak status SQLite yang sesuai. Jika frontend sudah diperbarui tetapi backend masih proses lama, UI menampilkan `Frontend dan backend belum satu versi` dan tidak mengubah data yang belum tersedia menjadi angka `0`. Hentikan aplikasi dengan `Ctrl+C`, tunggu shutdown selesai, lalu jalankan kembali `npm run dev` dari folder project.

Runtime final hanya memakai SQLite lokal. Variabel lama seperti `VITE_*_REPOSITORY_MODE` tidak lagi memilih sumber data dan tidak boleh dipakai untuk mengaktifkan Firebase/Firestore atau database browser. Data historis dari sistem lama hanya boleh dipindahkan melalui migrasi satu kali yang diaudit, bukan sinkronisasi dua arah.

## Backup otomatis dan retensi

Backend menjalankan siklus backup saat start dan memeriksa ulang secara berkala selama layanan hidup. Karena itu daily berikutnya tetap dapat dibuat ketika aplikasi melewati pergantian hari tanpa restart.

Scheduler lifecycle dijalankan setiap 1 jam setelah backend siap. Status aktual dapat dilihat pada:

```text
Utilities -> Maintenance Center -> Backup & Restore -> Status & Detail Teknis
```

Pastikan `Lifecycle Otomatis` berstatus `Aktif`, waktu `Lifecycle Terakhir` terisi, dan `Pemeriksaan Berikutnya` memiliki jadwal. Jika scheduler tidak aktif, UI menandai auto monthly dan retensi sebagai belum berjalan; status tersebut tidak lagi hanya berdasarkan konfigurasi statis.

Aturan:

1. Auto backup `daily` hanya dibuat satu kali per hari dan disimpan di `backups/sqlite/daily/`.
2. Daily disimpan selama 60 hari. Daily yang lebih tua hanya dihapus jika monthly verified untuk bulan yang sama sudah tersedia.
3. Pada awal bulan berikutnya, sistem mengambil daily verified terakhir bulan sebelumnya berdasarkan kalender lokal komputer utama, lalu membuat satu backup `monthly` di `backups/sqlite/monthly/`. Sumber daily disalin, diverifikasi, lalu dipromosikan; bukan dipindahkan sebelum validasi.
4. Monthly dipertahankan maksimal 12 bulan.
5. Backup manual tetap bisa dibuat kapan saja dan tidak dihapus otomatis.
6. Sistem otomatis membuat backup `pre-restore` sebelum restore dan `pre-repair` sebelum repair data turunan stok; file disimpan di folder `manual/` dengan jenis tetap tercatat pada manifest.
7. Import backup dari flashdisk juga disimpan pada folder `manual/`.
8. Setelah restore selesai, backup `pre-restore` otomatis didaftarkan ulang agar tetap muncul di daftar backup untuk rollback jika restore ternyata salah. Backup sumber restore juga dipastikan tetap tercatat agar riwayat restore mudah dilacak.
9. Backup harus berstatus `verified` sebelum dianggap aman.
10. Setiap promosi monthly dan cleanup retention dicatat pada audit log maintenance.
11. Kegagalan salah satu fase monthly, retention, atau daily tidak menghentikan fase lain. Error terakhir ditampilkan di detail teknis dan dicoba lagi pada interval berikutnya.
12. Sebelum membuat atau mengekstrak backup, sistem memeriksa ruang kosong agar proses tidak berhenti di tengah karena disk penuh.

## Backup manual dari UI

Buka:

```text
Utilities -> Maintenance Center -> Backup & Restore -> Backup
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

## Batas format backup

- File `.imsbackup` memakai ZIP klasik tanpa ZIP64.
- Satu entry `database.sqlite` harus berukuran di bawah 4 GB.
- Sistem menolak ukuran yang membutuhkan ZIP64 dengan pesan eksplisit; paket tidak dibuat setengah jadi.
- Pembuatan backup, promosi monthly, import, dan ekstraksi preview/restore memakai preflight ruang disk dengan cadangan minimum agar file lama tidak dirusak saat kapasitas tidak cukup.
- Implementasi saat ini memproses paket di memory dan import UI dibatasi 200 MB. Untuk database yang mendekati batas tersebut, lakukan evaluasi arsitektur streaming sebelum menaikkan batas import; jangan hanya menaikkan limit HTTP.


## Filter dan download backup

Pada tab Backup, daftar dapat difilter tanpa membuat folder weekly tambahan:

- Jenis: Semua, Harian, Bulanan, Manual.
- Periode: Semua periode, Hari ini, Minggu ini, Bulan ini, Bulan lalu.

Filter hanya mengubah daftar yang terlihat. File tetap berada pada tiga folder `daily`, `monthly`, dan `manual`. Klik `Download` pada backup yang dipilih untuk menyimpan satu file `.imsbackup`.

## Backup eksternal

Backup lokal masih berada di laptop yang sama dengan database utama. Agar aman dari laptop rusak/hilang, copy backup verified ke flashdisk atau harddisk eksternal.

Rekomendasi operasional:

- Harian: pastikan backup daily hari ini sudah dibuat.
- Mingguan: gunakan filter `Minggu ini`, lalu copy backup verified terbaru ke flashdisk/harddisk eksternal.
- Bulanan: pastikan satu backup monthly bulan sebelumnya tersedia.
- Sebelum update aplikasi: buat backup manual lalu copy ke media eksternal.
- Setelah banyak transaksi penting: buat backup manual tambahan.

Di tab Backup atau `Alat Admin → Checklist`, klik:

```text
Saya sudah copy ke flashdisk
```

Tombol ini hanya checklist pengingat user. Proses copy tetap dilakukan manual dari folder backup ke flashdisk/harddisk.

## Restore aman

Restore berada di:

```text
Utilities -> Maintenance Center -> Backup & Restore -> Restore
```

Alur restore:

1. Pilih backup resmi dari daftar.
2. Klik `Preview Restore`.
3. Pastikan backup valid, checksum cocok, integrity check `ok`, dan guard akun menyatakan aman.
4. Periksa perbandingan `Database Saat Ini` dan `Isi Backup`. Nilai negatif berarti jumlah record akan berkurang setelah full restore; detail seluruh tabel dapat dibuka per kelompok data.
5. Ketik keyword:

```text
RESTORE DATABASE
```

6. Klik `Restore Database`.
7. Sistem otomatis membuat backup `pre-restore` lalu mengganti database melalui file candidate/swap.
8. Jika migrasi, validasi, atau audit restore gagal, database sebelum restore dikembalikan otomatis. Setelah restore berhasil, refresh aplikasi dan login ulang bila perlu.

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

Checklist tersedia di `Maintenance Center → Alat Admin → Checklist` untuk membantu user melihat kesiapan backup dan restore tanpa membaca folder manual.

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
- pesan `ruang penyimpanan tidak cukup` tidak muncul; jika muncul, kosongkan disk tanpa menghapus backup verified secara sembarang;
- database tidak sedang dikunci proses lain.

### Lifecycle otomatis tidak aktif

Periksa tab `Status & Detail Teknis`. Jika `Lifecycle Otomatis` berstatus `Tidak aktif`, restart backend melalui root runner dan tunggu sampai log `backup_lifecycle_scheduler_started` muncul. Jangan menganggap monthly dan retensi sudah berjalan sebelum status scheduler aktif dan waktu pemeriksaan berikutnya terlihat.

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

Script resmi memvalidasi source readiness, membuat ZIP dari commit `HEAD`, lalu membaca kembali central directory ZIP. Artifact otomatis ditolak dan dihapus bila membawa `data/`, `backups/`, database, backup, `node_modules`, `dist`, path backslash, atau struktur source yang tidak lengkap.

Validasi ulang ZIP yang sudah dibuat:

```bash
npm run verify:zip -- ../Inventory-App-clean.zip
```

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

### Membaca status queue dan log

Status Maintenance menampilkan antrean database aktif, jumlah request menunggu, operasi lambat, dan error terakhir. Jika queue menunggu lama:

1. Jangan menutup paksa aplikasi ketika backup/restore/repair sedang aktif.
2. Tunggu operasi selesai dan cek file log JSONL di folder `logs/`.
3. Log dirotasi berdasarkan ukuran dan dibersihkan sesuai retention; log tidak menyimpan body request atau password.
   Folder `logs/` adalah runtime-only dan tidak ikut clean source ZIP/Git archive.
4. Jika queue tidak bergerak, hentikan transaksi baru, buat salinan backup terbaru bila memungkinkan, lalu restart backend secara terkontrol.

## Sinkronisasi realtime antar laptop dan HP

IMS sekarang memakai SSE agar perubahan dari perangkat lain terlihat tanpa menekan Muat Ulang pada setiap halaman.

1. Pastikan laptop backend dan perangkat lain berada di jaringan yang sama serta user sudah login.
2. Saat perangkat lain menambah/mengubah/menonaktifkan data, halaman yang relevan akan memuat ulang otomatis.
3. Jika Anda sedang mengetik atau membuka modal/drawer, IMS tidak langsung mengganti halaman. Pesan `Data baru tersedia` akan muncul; simpan/batalkan form lalu tekan `Muat Ulang Data`.
4. Setiap tab browser memiliki koneksi sendiri. Tab hasil duplicate tetap menerima perubahan karena IMS membuat identitas halaman baru pada setiap page load.
5. Jika koneksi realtime terputus, IMS mencoba menyambung ulang dan memakai satu refresh fallback saat tab terlihat. Halaman tidak lagi menjalankan polling 15 detik masing-masing.
6. Jika administrator mengubah role atau menonaktifkan akun yang sedang dipakai, tab user akan reload dan memvalidasi session kembali. Login/logout user lain tidak memaksa semua perangkat reload.
7. Jika masa session habis, koneksi realtime ditutup otomatis dan halaman reload ke pemeriksaan login.
8. Setelah restore database, semua perangkat akan reload agar tidak menampilkan state database lama.

Untuk mencegah terlalu banyak koneksi, tutup tab IMS yang tidak digunakan. Jika batas koneksi tercapai, sistem meminta user menutup tab lama lalu EventSource akan mencoba tersambung kembali.

Status koneksi SSE, jumlah client, revision, dan event terakhir dapat dilihat di:

```text
Utilities → Maintenance Center → Backup & Restore → Status & Detail Teknis
```

## Memahami aktif, nonaktif, dan total tersimpan

Halaman operasional hanya menampilkan record aktif. Cakupan Data Maintenance tetap menghitung histori yang dipertahankan. Contoh setelah dua Customer dinonaktifkan:

- Aktif: `0`
- Nonaktif/deleted logis: `2`
- Total tersimpan: `2`

Ini bukan database tidak sinkron. Record dipertahankan agar transaksi dan audit lama tetap aman.

## Menghapus permanen data nonaktif

Menu operasional hanya menyediakan `Nonaktifkan` atau `Arsipkan`. Hapus permanen tersedia khusus administrator pada:

```text
Utilities → Maintenance Center → Data Nonaktif
```

Flow aman:
1. Refresh preview kandidat.
2. Gunakan filter `Aman dihapus` atau `Dilindungi histori` bila daftar banyak.
3. Pilih record berstatus `Aman dihapus permanen`. Record dengan dependency/histori protected akan diblokir. User tidak dapat dipurge permanen walaupun nonaktif karena identitasnya dipertahankan untuk histori audit.
4. Baca blocker dan target dengan teliti.
5. Ketik `HAPUS PERMANEN`.
6. Ketik ulang kode/nama/id target.
7. Jalankan purge.

Sebelum menghapus, IMS membuat backup otomatis. Record dihapus dalam transaction dan snapshot tersanitasi tetap disimpan pada Riwayat/Audit Maintenance. Pemeriksaan dependency mencakup kolom langsung, nested payload yang dikenal, hierarchy/katalog/history, dan mapping legacy. Data User, stok, transaksi, keuangan, produksi, payroll, backup, restore, dan audit tidak dapat dihapus dari tab ini.

## Lab Pengujian (Database Sandbox)

Lab Pengujian adalah menu Administrator yang terpisah dari Maintenance Center. Fitur ini tidak menghapus transaksi pada database toko asli. Reset dilakukan dengan mengembalikan **database sandbox** ke backup baseline verified.

### Menjalankan aplikasi dalam mode sandbox

Dari root project, jalankan satu command:

```bash
npm run lab
```

Runner otomatis menggunakan lokasi terpisah:

- database: `data/ims-testing-sandbox.sqlite`;
- backup: `backups/testing-sandbox`;
- log: `logs/testing-sandbox`.

Environment sandbox hanya diberikan kepada proses backend/frontend yang dijalankan command tersebut. Nilainya tidak disimpan permanen ke PowerShell, Windows Environment Variables, atau file `.env`. Header aplikasi menampilkan badge **MODE TESTING** ketika guard sandbox valid.

Untuk menghentikan Lab dan kembali ke data operasional:

```bash
Ctrl+C
npm run dev
```

Tunggu log `[dev] seluruh layanan berhenti.` sebelum menjalankan mode berikutnya. `npm run dev` membersihkan environment sandbox lama dari child process dan kembali ke database operasional default. `npm test` tetap khusus untuk automated test suite dan tidak dipakai sebagai launcher Lab.

### Alur penggunaan

1. Siapkan master, stok awal, modal/HPP, katalog Supplier, BOM, pekerja, dan akun testing melalui menu normal.
2. Buka `Utilities -> Lab Pengujian` dan klik **Buat Baseline Baru**.
3. Ketik `BUAT BASELINE TESTING`. Sistem membuat backup tipe `test`, memvalidasi checksum/integrity, dan menyimpannya sebagai baseline aktif.
4. Pilih skenario, lalu lakukan langkah melalui menu operasional resmi. Lab hanya mencatat snapshot; Lab tidak menyisipkan transaksi langsung ke tabel.
5. Klik **Selesaikan & Validasi** untuk melihat diff serta hasil integrity, foreign key, projection stok, saldo stok, dan ledger.
6. Gunakan **Export Hasil** untuk menyimpan laporan JSON sesi.
7. Untuk mengulang testing, klik **Reset ke Baseline** dan ketik `RESET SANDBOX`.

Saat reset, backend menolak mutation baru, memastikan tidak ada request write yang masih berjalan, membuat backup `pre-reset`, menjalankan restore guarded, mencatat audit, lalu meminta seluruh perangkat memuat ulang database. Jika ada transaksi yang masih diproses, reset ditolak dan harus dicoba kembali setelah operasi selesai.

### Skenario tersedia

- Pembelian → Stok
- Penjualan → Pemasukan → Retur
- Produksi → Work Log → Payroll → HPP
- Realtime Laptop ↔ HP
- Concurrency & Double Submit

Skenario bersifat guided. Record tetap dibuat menggunakan form, route, validation, stock engine, finance posting, production flow, dan audit log yang sama dengan operasional. Simulasi kegagalan OS, test clock, dan pembuatan akun/password otomatis tidak diaktifkan agar tidak menambah jalur bypass baru.
