---
title: Overview Produksi
sidebar_label: Overview Produksi
---

# Tujuan

Halaman ini menjadi pintu masuk untuk memahami modul produksi secara menyeluruh. Fokusnya bukan hanya daftar menu, tetapi hubungan antar menu, titik pengurangan stok, titik penambahan output, dan bagaimana biaya dibaca di sepanjang proses produksi.

## Struktur Modul Produksi

Modul produksi saat ini dibagi menjadi delapan bagian utama:

1. **Tahapan Produksi**
2. **Karyawan Produksi**
3. **Profil Produksi**
4. **Semi Finished Materials**
5. **BOM Produksi**
6. **Production Orders**
7. **Work Log Produksi**
8. **Payroll Produksi**
9. **Analisis HPP**

## Alur Produksi yang Dipakai Saat Ini

Arsitektur final diarahkan ke alur berikut:

**BOM Produksi → Production Orders → Work Log Produksi**

## Prinsip Sistem Produksi

### 1. Tidak Ada Double Tracking
Sistem diarahkan agar pengurangan bahan, reserve, release, dan penambahan output tidak dilakukan ganda oleh dua menu yang berbeda.

### 2. Current Stock Menjadi Patokan Aktif
Pembacaan stok aktif dipusatkan ke `currentStock`. Jika ada field legacy seperti `stock`, field itu hanya kompatibilitas mirror, bukan patokan utama.

### 3. Semi Finished Menjadi Penghubung
Semi finished materials dipakai sebagai jembatan antara tahap bahan baku dan produk jadi.

### 4. Work Log Menjadi Titik Realisasi
Work log adalah catatan realisasi aktual, bukan sekadar rencana.

## Hubungan Antar Menu Produksi

### Tahapan Produksi
Dipakai sebagai referensi step di BOM dan untuk relasi ke tenaga kerja.

### Profil Produksi
Dipakai sebagai referensi parameter hasil, yield, dan nilai dasar proses.

### Semi Finished Materials
Dipakai untuk menyimpan stok komponen hasil antara.

### BOM Produksi
Dipakai untuk menyusun formula kerja dan material requirement.

### Production Orders
Dipakai untuk membuat order eksekusi dari BOM.

### Work Log Produksi
Dipakai untuk mencatat material usage, output aktual, biaya aktual, dan status eksekusi.

### Payroll Produksi
Dipakai untuk biaya tenaga kerja yang terkait produksi.

### Analisis HPP
Dipakai untuk membaca total cost dan HPP per output berdasarkan work log completed dan payroll.

## Checklist Baca Modul Produksi

Kalau ingin memahami modul ini secara bertahap, urutannya paling enak:
1. Tahapan Produksi
2. Profil Produksi
3. Semi Finished Materials
4. BOM Produksi
5. Production Orders
6. Work Log Produksi
7. Payroll Produksi
8. Analisis HPP
