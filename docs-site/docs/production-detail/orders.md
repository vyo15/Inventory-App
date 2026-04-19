---
title: Production Orders
sidebar_label: Production Orders
---

# Production Orders

## Tujuan
Dipakai untuk membuat order kerja berdasarkan BOM aktif.

## Field Form Utama
- **Kode Order**
- **Target Type**
- **BOM**
- **Varian Target**
- **Qty Batch Produksi**
- **Priority**
- **Catatan**

## Informasi Detail
Drawer detail menampilkan:
- target type,
- target,
- varian target,
- BOM / step,
- priority,
- tanggal dibuat,
- mulai produksi,
- catatan,
- panel **Requirement Material** berisi material, tipe, varian atau sumber, kebutuhan, stok saat ini, dan shortage.

## Tombol Aksi
- **Buat Order**
- **Detail**
- **Refresh Need**
- **Mulai Produksi**
- **Refresh**

## Rule Penting
- PO belum mengubah stok saat dibuat,
- stok bahan dipotong saat klik **Mulai Produksi**,
- requirement material harus dibaca dari BOM aktif,
- untuk item bervarian, source stok harus cocok dengan varian target atau strategi fixed.

## Contoh Skenario
1. Buat PO untuk target **Pola Mawar potong** varian Ungu.
2. Cek detail PO dan pastikan **Requirement Material** tidak lagi membaca **Master** jika bahan memang punya varian Ungu.
3. Klik **Mulai Produksi** untuk membuat Work Log dan memotong bahan.
