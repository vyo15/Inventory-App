---
title: Checklist Inventory
sidebar_label: Checklist Inventory
---

# Checklist Inventory

Checklist ini dibuat berdasarkan dua modul inventaris aktif:
- Manajemen Stok
- Penyesuaian Stok

## Manajemen Stok
Dari halaman `StockManagement.jsx`, modul ini membaca inventory log dan menampilkan:
- tanggal,
- tipe mutasi,
- item,
- jenis item,
- jumlah,
- catatan.

Tipe mutasi yang sudah dikenali antara lain:
- purchase_in
- sale
- sale_revert / sale_cancel_revert
- stock_adjustment
- production_out_pending
- production_in_completed

### Checklist
- [ ] Tabel riwayat stok tampil normal
- [ ] Kolom tanggal tampil benar
- [ ] Label tipe mutasi tampil benar
- [ ] Purchase masuk terbaca sebagai Pembelian
- [ ] Sale terbaca sebagai Terjual
- [ ] Sale revert terbaca sebagai Batal / Hapus Jual
- [ ] Stock adjustment tampil sebagai penyesuaian plus / minus
- [ ] Produksi pending bahan keluar tampil benar
- [ ] Produksi selesai produk masuk tampil benar
- [ ] Item name tampil benar
- [ ] Collection `products` terbaca sebagai Produk Jadi
- [ ] Collection `raw_materials` terbaca sebagai Bahan Baku
- [ ] QuantityChange tampil sebagai angka absolut yang mudah dibaca
- [ ] Note / reason tampil dengan fallback yang benar

## Penyesuaian Stok
### Checklist
- [ ] Adjustment tambah stok berhasil
- [ ] Adjustment kurang stok berhasil
- [ ] Log mutasi stok tercatat
- [ ] Adjustment tidak merusak variant stock
- [ ] currentStock final berubah sesuai penyesuaian

## Variant Stock
- [ ] Total variant sinkron dengan total currentStock
- [ ] Pengurangan variant mengurangi total dengan benar
- [ ] Penambahan variant menambah total dengan benar
- [ ] Variant stock helper tidak menghasilkan selisih aneh

## Integrasi Inventory Dengan Modul Lain
- [ ] Purchase menambah stok raw material
- [ ] Sales completed mengurangi stok product
- [ ] Produksi mengurangi input sesuai titik flow final
- [ ] Produksi menambah output sesuai titik flow final

## Catatan Temuan
Tulis temuan manual di bawah ini.
