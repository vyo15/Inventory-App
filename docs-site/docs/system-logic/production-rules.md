---
sidebar_position: 4
title: Production Rules
description: Rule utama pada modul produksi dari BOM sampai payroll.
---

# Aturan Produksi

## Alur utama

1. siapkan data setup produksi
2. buat BOM
3. buat Order Produksi
4. mulai produksi untuk membuat Work Log
5. selesaikan Work Log
6. proses Payroll Produksi
7. analisis HPP

## Rule penting

### BOM
- BOM menentukan bahan, output, dan aturan varian
- perubahan BOM hanya berlaku aman untuk order baru atau order yang direfresh

### Order Produksi
- order belum mengubah stok saat dibuat
- status order bisa `ready`, `shortage`, `in_production`, `completed`, atau `cancelled`
- satu order dipakai sebagai dasar work log

### Work Log
- bahan dipotong saat mulai produksi
- output masuk saat work log selesai
- qty bagus, reject, dan rework dicatat di tahap penyelesaian

### Payroll Produksi
- payroll membaca hasil kerja yang sudah tersedia
- payroll tidak boleh diposting sebelum work log valid

### Analisis HPP
- HPP membaca biaya material dan tenaga kerja yang sudah tercatat
- analisis dipakai untuk audit, bukan untuk mengubah histori stok
