---
title: Sales
sidebar_label: Sales
---

# Tujuan Menu

Menu **Sales** dipakai untuk mencatat penjualan produk jadi dan mengelola dampaknya ke stok dan laporan.

## Fokus Logic pada Source Terbaru

Source terbaru di inventory log menunjukkan tipe mutasi yang sudah dikenali untuk penjualan:
- `sale`
- `sale_revert`
- `sale_cancel_revert`

Ini menunjukkan flow sales terbaru sudah memperhitungkan rollback / cancel secara eksplisit.

## Rule Penting

- status final / completed harus mengurangi stok product,
- rollback harus mengembalikan stok dengan tipe log yang jelas,
- jika memakai varian, pengurangan atau pengembalian harus mengikuti varian yang benar.

## Dampak ke Modul Lain

- Products
- Inventory / Stock Management
- Sales Report
- Profit & Loss
- Cash In bila dipisah

## Titik Validasi Penting

- status tidak memotong stok terlalu cepat,
- complete memotong stok sekali,
- cancel / delete mengembalikan stok sekali,
- variant stock sinkron setelah transaksi.
