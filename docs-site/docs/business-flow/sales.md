---
title: Sales
sidebar_label: Sales
---

## Tujuan
Flow penjualan dipakai untuk mencatat transaksi penjualan produk jadi dan mengurangi stok jika status transaksi memenuhi rule sistem.

## Rule Penting
- Penjualan **completed** harus mengurangi stok.
- Cancel atau delete penjualan harus mengembalikan stok bila sebelumnya sudah dipotong.
- Penjualan harus sinkron dengan laporan penjualan dan laba rugi.
