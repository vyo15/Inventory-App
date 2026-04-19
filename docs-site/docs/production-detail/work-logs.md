---
title: Work Log Produksi
sidebar_label: Work Log Produksi
---

# Fungsi Menu

Menu **Work Log Produksi** dipakai untuk mencatat realisasi aktual dari pekerjaan produksi yang berasal dari Production Order.

## Data yang Dikelola

Work Log menyimpan:
- nomor work log,
- tanggal,
- target dan step,
- qty plan,
- qty aktual,
- biaya aktual,
- source PO,
- status.

### Material Usage
- item,
- planned qty,
- actual qty,
- total cost.

### Output Lines
- output,
- qty,
- good,
- reject,
- rework.

## Peran Dalam Flow Aktif
Work Log adalah pusat realisasi produksi dari PO.

Flow aktif Work Log:
- dibuat otomatis dari PO saat **Start Production**,
- tidak dibuat manual pada flow utama,
- mencatat realisasi good / reject / rework,
- menyimpan biaya aktual,
- saat **Complete** menambah output stock,
- saat **Complete** menutup linked production order.

## Status Utama
- **draft**
- **in_progress**
- **completed**

## Rule Penting
- Source type difokuskan ke `production_order`.
- Tidak ada mode manual Work Log pada flow utama.
- Material usage harus mengikuti planned vs actual dari PO.
- Bahan input **sudah dipotong saat Start Production**, sehingga complete tidak boleh memotong input lagi.
- Complete hanya boleh:
  - menyimpan realisasi,
  - menambah output,
  - menutup linked order.
- Tidak ada konsep reserve atau release pada flow aktif.
