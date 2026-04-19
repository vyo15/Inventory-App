---
title: Production
sidebar_label: Production
---

## Tujuan
Flow produksi dipakai untuk mengubah bahan baku atau semi finished menjadi output produksi yang bisa berupa semi finished material atau produk jadi.

## Arsitektur Produksi Resmi
Flow resmi produksi adalah:
1. **Tahapan Produksi**
2. **Profil Produksi**
3. **Semi Finished Materials**
4. **BOM Produksi**
5. **Production Orders**
6. **Start Production**
7. **Work Log Produksi**
8. **Complete Work Log**
9. **Payroll Produksi**
10. **Analisis HPP**

## Flow Resmi
**BOM → Production Orders → Start Production → Work Log → Complete**

Penjelasan titik penting:
- **BOM** menyimpan resep dan struktur kebutuhan produksi.
- **Production Order** membaca BOM aktif, menghitung requirement, dan menyiapkan order kerja.
- **Start Production** adalah titik resmi pemotongan bahan input.
- **Work Log** adalah catatan realisasi kerja yang dibuat dari PO.
- **Complete** adalah titik resmi penambahan output dan penutupan PO.

## Rule Penting
- Jalur lama produksi dipensiunkan.
- Flow aktif **tanpa reserve / release**.
- **1 PO hanya boleh memiliki 1 Work Log**.
- **Tidak ada mode manual untuk Work Log** pada flow utama.
- Pembuatan PO **tidak mengurangi stok**.
- **Bahan input dikurangi saat Start Production**.
- **Output ditambahkan saat Complete Work Log**.
- Pengurangan bahan tidak boleh double.
- Completion work log tidak boleh memotong bahan lagi bila bahan sudah dipotong saat start.
