---
title: Alur Aksi Produksi
sidebar_label: Alur Aksi
---


# Tujuan

Halaman ini menjelaskan efek tiap aksi utama user di modul produksi.

## 1. Saat User Membuat BOM

### Input User
- pilih target type,
- pilih target item,
- isi material lines,
- isi step lines,
- simpan BOM.

### Efek Sistem
- BOM tersimpan sebagai resep kerja,
- belum ada perubahan stok,
- belum ada payroll,
- belum ada output.

## 2. Saat User Membuat Production Order

### Input User
- pilih BOM,
- tentukan qty rencana,
- simpan order.

### Efek Sistem
- requirement material dihitung,
- shortage check bisa dibaca,
- order tercatat sebagai planning produksi,
- jika flow reservasi aktif, sistem bisa reserve material.

## 3. Saat User Mulai Produksi dari Order

### Tujuan
Membuat jembatan dari planning ke realisasi.

### Efek Sistem yang Diinginkan
- satu work log dibuat dari order,
- sourceType diarahkan ke `production_order`,
- jika flow final memang menetapkan konsumsi atau reserve di tahap ini, sistem menjalankan satu titik perubahan stok yang jelas.

## 4. Saat User Isi Material Usage di Work Log

### Input User
- review material line,
- sesuaikan actual qty jika perlu,
- simpan work log.

### Efek Sistem
- biaya aktual material mulai terbaca,
- selisih antara planned dan actual bisa dievaluasi,
- stok tidak boleh berubah dua kali dari aksi yang sama.

## 5. Saat User Isi Output Line di Work Log

### Input User
- isi good qty,
- isi reject qty,
- isi rework qty.

### Efek Sistem
- sistem bisa membaca hasil aktual,
- biaya per output mulai bisa dihitung,
- analisis proses menjadi lebih akurat.

## 6. Saat User Complete Work Log

### Efek Sistem yang Menjadi Arah Final
- consume stock input,
- release reserved stock yang relevan,
- add output stock,
- update cost output,
- close linked production order,
- work log menjadi completed.

## 7. Saat Payroll Dibuat dari Work Log

### Efek Sistem
- draft payroll terbentuk dari pekerjaan yang benar-benar selesai,
- direct labor cost bisa dibaca oleh analisis HPP.

## 8. Saat HPP Dibaca

### Efek Sistem
- material cost actual dibaca,
- labor cost dibaca,
- overhead dibaca,
- total cost dan hpp per unit dihitung.
