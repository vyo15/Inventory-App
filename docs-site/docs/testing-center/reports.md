---
title: Checklist Laporan
sidebar_label: Checklist Laporan
---

# Checklist Laporan

Checklist ini disusun dari modul laporan aktif:
- Stock Report
- Purchases Report
- Sales Report
- Profit Loss Report

## Stock Report
- [ ] Data stok tampil
- [ ] Filter berjalan
- [ ] Nilai stok sinkron dengan inventory

## Purchases Report
- [ ] Data purchases tampil
- [ ] Filter berjalan
- [ ] Total sinkron dengan transaksi purchases

## Sales Report
- [ ] Data sales tampil
- [ ] Filter berjalan
- [ ] Total sinkron dengan transaksi sales

## Profit Loss Report
Dari `ProfitLossReport.jsx`, laporan ini membaca tiga collection:
- `revenues`
- `incomes`
- `expenses`

Lalu menggabungkan semuanya menjadi:
- flow pemasukan,
- flow pengeluaran,
- gross profit = totalRevenue - totalCost.

### Checklist
- [ ] Revenues terbaca
- [ ] Incomes terbaca
- [ ] Expenses terbaca
- [ ] Merge dan sort tanggal normal
- [ ] Tag Pemasukan tampil hijau
- [ ] Tag Pengeluaran tampil merah
- [ ] Summary Total Pendapatan benar
- [ ] Summary Total Biaya benar
- [ ] Summary Laba Kotor benar
- [ ] Export Excel berjalan normal

## Catatan Temuan
Tulis temuan manual di bawah ini.
