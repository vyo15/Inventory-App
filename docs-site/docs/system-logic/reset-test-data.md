---
sidebar_position: 4
title: Reset Data Uji
description: Fungsi reset transaksi, baseline stok, dan sinkronisasi stok untuk testing.
---

# Reset Data Uji

## Tujuan menu ini

Menu **Reset Data Uji** dibuat untuk membantu testing berulang tanpa harus membersihkan database secara manual.

## Fungsi utama

Menu ini dipakai untuk:

- melihat preview jumlah data yang akan dibersihkan,
- reset transaksi berdasarkan modul,
- menyimpan baseline stok saat ini,
- restore baseline stok yang sudah disimpan,
- menolkan stok untuk skenario test dari nol,
- menjalankan sinkronisasi field stok.

## Modul reset yang tercakup

Secara umum, reset bisa mencakup:

- penjualan,
- pembelian,
- retur,
- produksi,
- kas & biaya,
- stock adjustment & inventory logs,
- pricing logs.

## Pilihan mode reset

### 1. Reset Transaksi

Menghapus transaksi dan log, tetapi stok master tetap seperti sekarang.

### 2. Reset + Nolkan Semua Stok

Menghapus transaksi lalu mengatur stok bahan baku, semi finished, dan produk jadi ke nol.

### 3. Reset + Baseline Testing

Menghapus transaksi lalu mengembalikan stok ke baseline yang sudah disimpan sebelumnya.

## Sinkronkan Stok

Fitur **Sinkronkan Stok** dipakai untuk merapikan kembali field stok seperti:

- currentStock,
- stock,
- reservedStock,
- availableStock.

Fitur ini membantu saat data sudah melalui banyak percobaan testing dan perlu dirapikan.

## Batasan menu reset

Reset dan sync stock **tidak mengganti logic requirement PO** yang sudah terlanjur tersimpan.

Artinya, jika PO lama sudah membawa mapping source yang salah, solusinya tetap:

- refresh requirement,
- atau buat PO baru,
- lalu test ulang.
