---
title: Project Overview
sidebar_label: Project Overview
---

# Project Overview

IMS Bunga Flanel adalah sistem inventory dan produksi yang dipakai untuk mengelola bahan baku, bahan setengah jadi, produk jadi, transaksi, kas, laporan, dan alur produksi.

## Tujuan sistem

- menjaga stok tetap sinkron
- memisahkan data master dan operasional
- membuat alur produksi lebih terstruktur
- membantu audit biaya dan hasil produksi

## Modul utama

### Master Data
Menyimpan data referensi seperti produk jadi, bahan baku, supplier, pelanggan, kategori, dan aturan harga.

### Inventaris
Menampilkan mutasi stok dan penyesuaian stok bila ada selisih fisik.

### Produksi
Menangani setup produksi, pembuatan BOM, order produksi, work log, payroll, dan analisis HPP.

### Transaksi
Menangani pembelian, penjualan, dan retur.

### Kas & Biaya
Menyimpan pemasukan dan pengeluaran di luar transaksi stok.

### Laporan
Menyajikan laporan stok, pembelian, penjualan, dan laba rugi.

### Sistem
Menyediakan utilitas maintenance seperti reset data uji.

## Prinsip kerja penting

- varian dipakai hanya jika item memang punya turunan seperti warna atau ukuran
- harga restock disimpan per item master
- biaya aktual pembelian dibaca dari transaksi pembelian
- stok tidak boleh berubah dua kali untuk transaksi yang sama
- output produksi masuk saat work log selesai, bukan saat order dibuat
