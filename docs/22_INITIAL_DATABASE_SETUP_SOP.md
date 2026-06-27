# SOP Setup Database Awal — IMS Bunga Flanel

Dokumen ini menjadi urutan resmi saat database IMS masih kosong atau baru selesai di-restore ke kondisi awal. Tujuannya menjaga agar master data, stok, produksi, finance, dan laporan tidak diisi dengan urutan yang salah.

## 1. Prinsip utama

1. Isi data berdasarkan dependensi sistem, bukan urutan sidebar.
2. Jangan membuat transaksi fiktif hanya untuk mengisi laporan atau saldo.
3. Stok fisik existing harus masuk melalui flow stok resmi agar ada histori audit.
4. Pembelian baru dilakukan setelah item, supplier, dan katalog supplier tersedia.
5. Produksi baru dilakukan setelah tahapan, operator, komponen, dan BOM siap.
6. Pricing Rule baru dipakai setelah harga modal/HPP sudah valid.
7. Setelah setup selesai, buat backup baseline verified sebelum transaksi harian dimulai.

## 2. Checklist otomatis di Dashboard

Dashboard Administrator menampilkan tombol compact **Setup Awal** selama langkah wajib belum lengkap. Tombol tersebut membuka panel mengambang yang bersifat read-only, menampilkan progress, menandai langkah berikutnya, dan dapat disembunyikan sementara. Tombol serta panel otomatis hilang setelah seluruh setup siap.

Urutan resmi pada panel:

### Fase 1 · Fondasi

1. Kategori & Kelompok.
2. Tahapan Produksi.
3. Karyawan Produksi.

### Fase 2 · Master Operasional

4. Master Produk dan Bahan.
5. Supplier & Katalog Restock.
6. BOM / Resep Produksi.

### Fase 3 · Go-Live

7. Stok Awal Tercatat.
8. Backup Baseline Setup.

Panel dapat ditutup menggunakan **Sembunyikan sementara** dan dibuka kembali dari tombol Setup Awal pada Dashboard. Sistem tidak membuat kategori, item, stok, transaksi, atau backup secara otomatis.

## 3. Tahap 0 — Sistem dan akses

1. Jalankan aplikasi melalui `npm run dev`.
2. Buat Administrator pertama menggunakan kode setup lokal dari terminal backend.
3. Buat akun role `User` hanya jika ada operator harian tambahan.
4. Pastikan tanggal dan waktu komputer utama benar.
5. Buka Maintenance Center dan pastikan database dapat dibaca tanpa error.

## 4. Tahap 1 — Kategori & Kelompok

Buka **Master Data → Kategori & Kelompok**.

Data minimum yang disarankan untuk kondisi produksi saat ini:

### Bentuk Produk

- Bunga Tangkai
- Bouquet

### Jenis Bunga

- Mawar

### Kelompok Bahan

- Kain Flanel
- Kawat
- Perekat
- Kemasan
- Pita & Tali

### Kelompok Komponen

Opsional pada tahap awal. Contoh:

- Bagian Bunga
- Bunga Rakitan
- Komponen Pendukung

Jangan menjadikan warna, ukuran, jumlah tangkai, roll, meter, atau satuan beli sebagai kategori.

## 5. Tahap 2 — Referensi produksi dan pihak terkait

### Supplier dasar

Isi identitas toko, kontak, alamat, link toko, dan catatan. Katalog barang diisi setelah master item tersedia.

### Tahapan Produksi

Contoh:

- Potong Pola
- Potong Kelopak
- Rakit Bunga
- Finishing
- Packing Bouquet

Pastikan basis kerja dan tarif payroll sesuai proses nyata. Step yang dipakai menghitung upah tidak boleh dibiarkan dengan tarif nol.

### Karyawan Produksi

Buat minimal satu operator aktif jika Work Log dan payroll akan digunakan.

### Customer

Opsional. Penjualan tetap dapat memakai pembeli umum, tetapi Customer disarankan untuk pelanggan tetap dan histori transaksi.

## 6. Tahap 3 — Master item

### Bahan Baku

Masukkan bahan yang benar-benar digunakan, misalnya:

- Kain Flanel Merah
- Kawat Bunga
- Isi Lem Tembak
- Floral Tape
- Kertas Bouquet
- Pita Satin

Aturan awal:

- Kelompok Bahan wajib dipilih.
- Satuan stok menggunakan satuan dasar seperti meter, lembar, pcs, atau batang.
- Stok awal disarankan `0` pada saat master dibuat.
- Minimum stok disesuaikan kebutuhan nyata.
- Modal aktual tetap `0` sebelum ada Pembelian atau Stock Adjustment resmi.

### Komponen Produksi

Contoh:

- Kelopak Mawar
- Daun Mawar
- Mawar Rakitan 1 Tangkai

`Jenis Komponen` tetap digunakan oleh logic produksi. `Kelompok Komponen` hanya metadata pengelompokan.

### Produk Jadi

Contoh:

- Bunga Mawar Flanel 1 Tangkai
- Bouquet Mawar Flanel 1 Tangkai

Aturan awal:

- Bentuk Produk wajib dipilih.
- Jenis Bunga dipilih sesuai produk.
- Stok awal disarankan `0`.
- HPP boleh `0` sebelum produksi pertama.
- Harga jual dapat diisi manual.
- Jangan mengaktifkan Pricing Rule berbasis HPP ketika HPP belum valid.

## 7. Tahap 4 — Katalog Supplier

Setelah Bahan Baku dan Produk tersedia, buka Supplier lalu isi katalog restock.

Setiap penawaran minimal memuat:

- item yang disediakan;
- link atau nama listing;
- satuan beli;
- qty per pembelian;
- nilai konversi ke satuan stok;
- harga paket;
- status ketersediaan.

Contoh:

```text
Barang            : Kain Flanel Merah
Satuan beli       : Roll
Qty pembelian     : 1 roll
Konversi          : 25 meter
Satuan stok       : Meter
```

Konversi hanya ditampilkan pada Supplier, Pembelian, dan histori transaksi. Tabel stok utama tetap memakai satuan dasar.

## 8. Tahap 5 — BOM / Resep Produksi

BOM dibuat setelah target, material, dan Tahapan Produksi tersedia.

Urutan yang disarankan:

```text
Bahan Baku
→ Komponen Produksi
→ Bunga Rakitan
→ Produk Jadi
```

Contoh:

### Mawar Rakitan 1 Tangkai

- Kelopak Mawar
- Daun Mawar
- Kawat Bunga
- Floral Tape
- Lem

### Bouquet Mawar 1 Tangkai

- 1 Mawar Rakitan 1 Tangkai
- Kertas Bouquet
- Pita Satin

Jangan membuat Planning atau Production Order sebelum BOM target aktif dan lengkap.

## 9. Tahap 6 — Stok awal

### Bisnis benar-benar mulai dari nol

Biarkan stok master tetap `0`. Stok masuk pertama berasal dari Pembelian resmi.

### Sudah ada stok fisik sebelum IMS digunakan

1. Lakukan stock opname fisik.
2. Buka **Stock Control → Stock Management**.
3. Gunakan Stock Adjustment tipe masuk.
4. Gunakan alasan `Stok Awal`.
5. Isi modal per unit bila cost item masih nol.

Jangan:

- mengedit stok langsung dari master;
- membuat Pembelian palsu;
- memasukkan stok tanpa modal ketika nilai persediaan diperlukan;
- mencampur satuan pembelian dan satuan stok.

Checklist Dashboard menganggap stok awal aman jika seluruh stok masih nol, atau stok positif sudah mempunyai histori inventory resmi.

## 10. Tahap 7 — Mulai operasional

### Pembelian

```text
Supplier + Katalog
→ Verifikasi Harga
→ Simpan Pembelian
→ Stok Masuk
→ Modal Aktual
→ Pengeluaran dan Ledger
```

### Produksi

```text
Planning
→ Production Order
→ Work Log
→ Complete
→ Payroll
→ HPP
→ Stok Output
```

Sebelum menyelesaikan Work Log, pastikan operator, tarif, material aktual, dan Good Qty sudah benar.

### Penjualan

```text
Produk tersedia
→ Penjualan
→ Stok Keluar
→ Status Selesai
→ Pemasukan
```

### Retur

Retur hanya dibuat dari Penjualan terkait dan tidak pernah digunakan sebagai data setup awal.

## 11. Tahap 8 — Backup baseline

Setelah seluruh master dan stok awal benar:

1. Buka **Maintenance Center → Backup & Restore**.
2. Klik **Buat Backup Sekarang**.
3. Pastikan status `verified`.
4. Pastikan ukuran file bukan `0 B`.
5. Download satu copy ke media eksternal.

Backup baseline dianggap siap jika dibuat setelah perubahan setup master terakhir. Jika kategori, supplier, item, step, operator, atau BOM diubah lagi, buat backup baseline baru.

## 12. Data wajib dan opsional

| Data | Status |
|---|---|
| Administrator pertama | Wajib |
| Bentuk Produk | Wajib sebelum Produk |
| Jenis Bunga | Wajib untuk flow bunga/komponen |
| Kelompok Bahan | Wajib sebelum Bahan Baku |
| Produk Jadi | Wajib sebelum Penjualan |
| Bahan Baku | Wajib sebelum Pembelian/BOM |
| Supplier + katalog | Wajib sebelum Pembelian |
| Tahapan Produksi | Wajib sebelum BOM/Work Log |
| Karyawan Produksi | Wajib jika Work Log/payroll digunakan |
| BOM | Wajib sebelum produksi |
| Kelompok Komponen | Opsional |
| Customer | Opsional |
| Production Profile | Opsional |
| Pricing Rule | Opsional setelah cost/HPP valid |
| Retur | Hanya setelah Penjualan |
| Cash In/Out manual | Hanya transaksi nyata |

## 13. Kriteria siap digunakan

IMS dianggap siap untuk operasional harian jika:

- kategori minimum tersedia;
- minimal satu Produk dan satu Bahan Baku aktif;
- supplier memiliki minimal satu katalog aktif;
- Tahapan Produksi, operator, dan BOM tersedia;
- stok awal nol atau tercatat melalui histori resmi;
- backup baseline verified dibuat setelah setup terakhir.

Jika salah satu langkah belum selesai, buka panel melalui tombol Setup Awal pada Dashboard Administrator lalu gunakan tautan pada langkah terkait.
