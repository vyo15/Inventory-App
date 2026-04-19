---
sidebar_position: 1
title: Stock Rules
description: Aturan stok utama yang dipakai di master data, transaksi, inventaris, dan produksi.
---

# Aturan Stok

## Prinsip umum

- stok harus bisa diaudit dari log
- item bervarian menyimpan stok per varian
- total stok adalah ringkasan dari stok item atau stok varian
- perubahan stok hanya boleh terjadi di titik transaksi yang memang sah

## Titik perubahan stok

### Pembelian
Menambah stok bahan atau barang yang dibeli.

### Penjualan
Mengurangi stok saat transaksi valid diposting.

### Retur
Menambah atau mengurangi stok tergantung jenis retur.

### Penyesuaian Stok
Dipakai untuk koreksi selisih stok fisik.

### Produksi
- bahan dipotong saat mulai produksi
- output masuk saat work log selesai

## Aturan item tanpa varian

Item tanpa varian cukup membaca stok dari master item.

## Aturan item dengan varian

Item bervarian membaca stok dari daftar `variants`.
Tabel master menampilkan total stok dan rincian varian agar audit cepat lebih mudah.

## Mutasi stok produksi

Saat produksi berjalan, log stok harus menunjukkan:

- item yang dipakai sebagai bahan
- jumlah yang keluar
- item hasil produksi
- jumlah yang masuk
- referensi PO dan work log

## Rule aman untuk user

- jangan hapus master item yang sudah punya histori
- pakai status aktif/nonaktif untuk menutup item
- buat transaksi baru jika ingin testing ulang, jangan edit histori sembarangan
- jika data tampak tidak sinkron, cek log stok lebih dulu
