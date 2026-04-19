---
sidebar_position: 1
title: Improvements
description: Ringkasan perbaikan penting yang sudah tercermin di file terbaru.
---

# Improvements

Dokumen ini merangkum perubahan penting yang perlu diketahui user dan tim saat membaca sistem terbaru.

## 1. UI master data dibuat lebih seragam

Tampilan **Bahan Baku**, **Produk Jadi**, dan **Semi Finished Materials** sudah diarahkan ke satu bahasa desain yang lebih konsisten.

Perbaikan yang terasa di UI:

- spacing tabel lebih rapi,
- card filter lebih seragam,
- tombol aksi lebih konsisten,
- drawer detail lebih searah,
- stok varian tampil lebih bersih dan informatif.

## 2. Stok varian ditampilkan langsung di tabel

Untuk item yang memakai varian, stok varian sekarang ditampilkan langsung di tabel agar user tidak perlu membuka detail hanya untuk mengecek warna atau spesifikasi tertentu.

## 3. Raw material lebih aman dinonaktifkan daripada dihapus

Flow master data bahan baku diarahkan ke **aktif / nonaktif** supaya histori transaksi dan log sistem tetap aman.

## 4. Complete work log sudah kembali memakai modal penyelesaian

Di halaman Work Log Produksi, user kembali bisa menyelesaikan work log dengan mengisi:

- qty bagus,
- qty reject,
- qty rework,
- operator produksi,
- catatan penyelesaian.

## 5. Output varian work log sudah diposting lebih aman

Posting output produksi untuk target yang memakai varian sudah diarahkan agar masuk ke varian yang benar, bukan hanya ke stok master.

## 6. Inherit variant lintas item sudah diperbaiki

Requirement material pada PO sekarang lebih aman mewariskan varian berdasarkan makna variannya, bukan hanya key internal.

Ini penting untuk kasus seperti:

- target semi finished **ungu**,
- bahan baku **ungu**,
- tetapi key internal varian kedua item berbeda.

## 7. Dokumentasi diarahkan ke bahasa user

Dokumentasi terbaru dibuat supaya lebih mudah dipahami user operasional, bukan hanya tim teknis.
