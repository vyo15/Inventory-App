---
sidebar_position: 1
title: Stock Rules
description: Aturan inti stok, log, dan status data yang harus dijaga.
---

# Stock Rules

## Empat field stok yang perlu dipahami

Untuk banyak item, sistem menyimpan beberapa field stok berikut:

- **currentStock**: stok utama saat ini,
- **stock**: representasi stok total untuk kompatibilitas dan tampilan,
- **reservedStock**: stok yang pernah dipakai di flow reservasi lama atau kebutuhan khusus,
- **availableStock**: stok siap pakai setelah dikurangi reserve.

Secara praktik, angka yang paling penting untuk operasional adalah **currentStock** dan **availableStock**.

## Sumber mutasi stok

Mutasi stok normal datang dari:

- pembelian,
- penjualan,
- retur,
- produksi,
- penyesuaian stok.

Agar histori tetap rapi, setiap perubahan stok sebaiknya lewat menu transaksi yang benar, bukan edit angka manual langsung di database.

## Manajemen Stok

Menu **Manajemen Stok** adalah tempat audit log keluar-masuk stok.

Log dipakai untuk melihat:

- tanggal mutasi,
- arah masuk / keluar,
- sumber mutasi,
- item,
- qty,
- referensi PO, work log, sale, supplier, atau customer.

## Penyesuaian stok

Menu **Penyesuaian Stok** dipakai untuk koreksi manual ketika stok fisik tidak sama dengan stok sistem.

Gunakan penyesuaian dengan hati-hati karena menu ini bukan pengganti transaksi normal.

## Nonaktif lebih aman daripada hapus

Untuk beberapa master data, terutama yang sudah pernah dipakai di transaksi atau produksi, pendekatan yang lebih aman adalah:

- **nonaktifkan data**,
- jangan langsung hapus.

Ini penting supaya histori log dan referensi lama tidak rusak.
