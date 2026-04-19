---
title: Bahan Baku
sidebar_label: Bahan Baku
---

# Bahan Baku

Menu ini dipakai untuk menyimpan master bahan baku, stok, supplier default, harga referensi restock, dan varian bila perlu.

## Field penting

- Nama bahan
- Kode
- Satuan
- Kategori
- Supplier
- Min. stok
- Harga referensi restock
- Mode varian
- Daftar varian bila item bervarian

## Yang tampil di tabel

- nama bahan
- supplier
- status varian
- total stok
- rincian stok varian
- harga referensi dan modal rata-rata
- aksi detail, edit, aktif/nonaktif

## Rule penting

- item yang punya histori lebih aman dinonaktifkan
- stok total harus sinkron dengan rincian varian
- dark mode dan light mode memakai chip stok yang sama agar audit cepat tetap mudah

## Skenario umum

1. buat bahan baru
2. tentukan apakah pakai varian
3. isi supplier dan min. stok
4. simpan
5. cek di tabel apakah stok dan status sudah benar
