---
title: Semi Finished Materials
sidebar_label: Semi Finished Materials
---

# Fungsi Menu

Menu **Semi Finished Materials** dipakai untuk menyimpan komponen setengah jadi hasil proses antara yang belum menjadi produk akhir.

## Data yang Dikelola

Semi finished materials menyimpan:
- kode item,
- nama item,
- kategori,
- varian warna,
- stok total,
- biaya rata-rata,
- status aktif.

Pada level varian juga ada data:
- warna,
- kode variant,
- current,
- reserved,
- available,
- min alert,
- average cost,
- status.

## Peran Dalam Flow Produksi

Semi finished bisa berperan sebagai:
- **output** dari satu tahap produksi,
- lalu menjadi **input** untuk tahap produksi berikutnya.

## Rule Penting

- reserved stock tidak boleh diubah manual sembarangan jika flow final sudah mengaturnya.
- current, reserved, dan available harus konsisten.
- jika memakai varian, penambahan atau pengurangan stok harus mengikuti variant key yang benar.
