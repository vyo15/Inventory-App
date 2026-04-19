---
title: BOM Produksi
sidebar_label: BOM Produksi
---

# BOM Produksi

## Tujuan
Dipakai untuk mendefinisikan resep produksi, baik untuk target semi finished maupun produk jadi.

## Field Form Utama
- **Kode BOM**
- **Nama BOM**
- **Deskripsi**
- **Target Type**
- **Target Item**
- **Hasil per Produksi**
- **Status Aktif**
- estimasi biaya material, tenaga kerja, dan overhead,
- **Catatan Internal**.

## Line Bahan
Setiap baris bahan minimal memuat:
- jenis bahan,
- item bahan,
- kebutuhan per produksi,
- satuan bahan,
- catatan,
- strategi varian: ikut target, fixed, atau tanpa varian.

## Line Step
Setiap baris step memuat:
- step produksi,
- urutan langkah,
- qty / batch atau aturan output sesuai flow yang dipakai.

## Tombol Aksi
- **Tambah BOM**
- **Detail**
- **Edit**
- **Aktifkan / Nonaktifkan**
- **Edit** bahan
- **Edit** step

## Contoh Skenario
Buat BOM **Pola Mawar** yang memakai Kain Flanel sebagai bahan, atur hasil per produksi, lalu tambahkan step **Potong Bahan Dasar**.
