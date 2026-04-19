---
title: Order Produksi
sidebar_label: Order Produksi
---

# Order Produksi

Menu ini dipakai untuk membuat order kerja berdasarkan BOM aktif.

## Data penting

- nomor order
- target type
- target
- varian target
- BOM
- qty batch
- estimasi output
- requirement material
- status order

## Rule penting

- order belum mengubah stok saat dibuat
- requirement dibentuk dari BOM
- varian bahan dicoba dibaca dari strategi BOM dan label varian yang cocok
- jika status `shortage`, cek bahan atau BOM lebih dulu
- mulai produksi akan membuat work log dan memotong bahan

## Tombol yang umum

- Tambah Order
- Detail
- Edit
- Mulai Produksi
- Refresh Requirement

## Skenario umum

1. pilih target
2. pilih BOM
3. isi qty batch
4. cek requirement
5. simpan
6. mulai produksi jika bahan cukup
