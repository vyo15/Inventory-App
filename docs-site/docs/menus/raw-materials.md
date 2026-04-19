---
title: Bahan Baku
sidebar_label: Bahan Baku
---

# Bahan Baku

## Tujuan
Menu ini dipakai untuk membuat dan mengelola master bahan baku yang dipakai di pembelian, produksi, penjualan bahan, dan laporan stok.

## Informasi di Tabel
- nama bahan baku dan supplier,
- badge **Pakai Varian** atau **Tanpa Varian**,
- stok total dan stok per varian langsung di tabel,
- harga referensi restock, modal aktual rata-rata, dan harga jual,
- status stok seperti **Kosong**, **Stok Rendah**, atau **Aman**,
- aksi **Detail**, **Edit**, dan **Aktifkan/Nonaktifkan**.

## Field Form Utama
- **Nama Bahan Baku**: nama item.
- **Supplier**: pemasok utama.
- **Satuan Stok**: satuan dasar stok, misalnya meter atau pcs.
- **Pakai Varian**: aktifkan jika bahan punya turunan seperti warna.
- **Label Varian**: label kelompok varian, misalnya Warna.
- **Minimum Stok Master**: alert stok minimum untuk item non-varian.
- **Mode Pricing**: manual atau mengikuti pricing rule.
- **Harga Referensi Restock / Satuan**: harga acuan pembelian.
- **Modal Aktual Rata-rata / Satuan**: rata-rata modal aktual.
- **Pricing Rule**: rule yang dipakai bila mode pricing otomatis.
- **Harga Jual / Satuan**: harga jual bahan.
- **Varian**:
  - Label Varian,
  - Kode / SKU Varian,
  - Aktif,
  - Stok Varian,
  - Reserved Stock.

## Tombol Aksi
- **Tambah Bahan Baku**: buat master baru.
- **Detail**: lihat ringkasan item dan stok.
- **Edit**: ubah master data.
- **Aktifkan / Nonaktifkan**: menyalakan atau mematikan item tanpa merusak histori.

## Rule Penting
- jika item punya varian, stok operasional dibaca dari varian,
- nama varian sebaiknya konsisten, misalnya Merah, Putih, Ungu,
- bahan baku tidak dianjurkan dihapus jika sudah pernah dipakai transaksi atau BOM.

## Contoh Skenario
**Tambah kain flanel warna**
1. Klik **Tambah Bahan Baku**.
2. Isi nama, supplier, satuan stok = meter.
3. Aktifkan **Pakai Varian**.
4. Tambahkan varian Merah, Putih, Ungu, dan stok awal masing-masing.
5. Simpan.
6. Cek tabel; stok total dan stok tiap warna harus langsung terlihat.
