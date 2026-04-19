---
title: Purchases
sidebar_label: Purchases
---

## Tujuan
Flow pembelian dipakai untuk menambah stok terutama **raw materials**, sekaligus menyimpan nilai beli aktual sebagai dasar biaya.

## Alur Umum
1. User membuat transaksi pembelian.
2. User memilih item yang dibeli.
3. Jika item adalah raw material dengan varian, user bisa memilih varian bahan.
4. Sistem menghitung quantity, conversion, subtotal, dan total stock-in.
5. Saat transaksi disimpan, stok bahan bertambah.
6. Sistem juga menyimpan log inventory agar mutasi stok bisa dilacak.

## Rule Penting
- Pembelian menggunakan **actual price**.
- Nilai saving terhadap harga referensi hanya dipakai sebagai **informasi efisiensi**.
- Saving **bukan** pengurang kas langsung.
- Pembelian raw material harus menambah stok dan jika ada varian, penambahan stok mengikuti varian yang dipilih.
