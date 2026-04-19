---
title: Stock Management
sidebar_label: Stock Management
---

# Tujuan Menu

Menu **Stock Management** dipakai untuk membaca riwayat mutasi stok lintas modul.

## Fungsi Utama

Source terbaru menunjukkan halaman ini membaca collection inventory log lalu menampilkan:
- tanggal,
- tipe mutasi,
- nama item,
- jenis item,
- jumlah,
- catatan.

## Tipe Mutasi yang Sudah Dikenali

- `purchase_in`
- `sale`
- `sale_revert`
- `sale_cancel_revert`
- `stock_adjustment`
- `production_out_pending`
- `production_in_completed`

## Kegunaan Praktis

Menu ini sangat penting untuk:
- audit stok,
- cek rollback,
- cek apakah produksi dan sales meninggalkan log mutasi yang benar.

## Titik Perhatian

Jika stok akhir salah, modul ini harus dicek lebih dulu untuk melihat:
- mutasi apa saja yang sudah terjadi,
- apakah ada mutasi ganda,
- apakah rollback tercatat.
