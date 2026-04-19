---
sidebar_position: 1
title: Stock Flow
description: Alur keluar masuk stok dari pembelian, produksi, penjualan, retur, dan adjustment.
---

# Stock Flow

## Gambaran umum

Stok di IMS Bunga Flanel bergerak dari beberapa sumber utama:

- **Pembelian** menambah stok bahan baku.
- **Produksi** mengurangi material dan menambah output.
- **Penjualan** mengurangi stok produk yang dijual.
- **Retur** bisa mengembalikan stok sesuai transaksi.
- **Penyesuaian Stok** dipakai untuk koreksi manual.

Semua mutasi itu dicatat ke **Manajemen Stok** agar mudah diaudit.

## Alur pembelian

Saat user membuat transaksi pembelian:

1. user memilih supplier dan bahan yang dibeli,
2. user mengisi konversi pembelian ke satuan stok,
3. sistem menghitung total stok masuk,
4. stok bahan baku bertambah,
5. sistem mencatat log stok masuk,
6. sistem membuat catatan pengeluaran di modul kas keluar.

### Catatan penting

- Harga pembelian aktual dipakai untuk menghitung **modal aktual rata-rata** bahan.
- **Harga referensi restock** dipakai sebagai patokan pembanding, bukan sebagai biaya kas nyata.
- Nilai hemat / lebih mahal pada pembelian bersifat **informasi efisiensi**, bukan pengurang kas.

## Alur produksi

Saat proses produksi dimulai dari Production Order:

1. sistem membaca kebutuhan material dari requirement PO,
2. sistem mengurangi stok material sesuai source yang dipilih,
3. log keluar stok produksi dicatat,
4. work log masuk status **In Progress**.

Saat work log diselesaikan:

1. user mengisi **Qty Bagus, Qty Reject, Qty Rework, operator, dan catatan**,
2. sistem menambah stok output ke target yang sesuai,
3. jika target memakai varian, output masuk ke **varian yang tepat**,
4. PO ditutup sebagai selesai.

### Rule penting

- **Material keluar saat mulai produksi**, bukan saat work log selesai.
- **Output masuk saat work log selesai**.

## Alur penjualan

Untuk penjualan:

- stok item berkurang saat transaksi dibuat,
- untuk channel online, status transaksi dipantau melalui **Diproses → Dikirim → Selesai → Dibatalkan**,
- pemasukan kas dari penjualan dicatat saat status transaksi **Selesai**.

Jika penjualan dibatalkan atau dihapus sesuai flow yang benar, stok bisa dikembalikan lagi melalui logic transaksi.

## Alur retur

Menu retur dipakai untuk mencatat pengembalian yang memengaruhi histori transaksi dan stok, sesuai data transaksi yang direlasikan.

## Penyesuaian stok

Penyesuaian stok dipakai untuk koreksi manual jika ada selisih fisik.

Catatan untuk user:

- gunakan menu ini hanya bila memang perlu koreksi,
- penyesuaian akan menulis log khusus agar histori tetap terbaca,
- saat ini penyesuaian manual lebih cocok dipakai untuk audit operasional, bukan sebagai pengganti alur transaksi normal.
