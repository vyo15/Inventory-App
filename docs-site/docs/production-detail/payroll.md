---
title: Payroll Produksi
sidebar_label: Payroll Produksi
---

# Peran Menu

Production Payrolls dipakai untuk membaca dan menyimpan biaya tenaga kerja produksi.

## Update dari Service Terbaru

Service terbaru menunjukkan payload payroll mencakup:
- relasi ke work log,
- relasi ke BOM,
- target output,
- step,
- worker,
- payroll mode,
- payroll rate,
- payable qty factor,
- amount calculated,
- bonus,
- deduction,
- final amount,
- paymentStatus,
- status.

## Draft Payroll

Draft payroll tetap diambil dari work log completed.

## Kegunaan Praktis

Dengan payload yang lebih kaya, payroll bisa dipakai untuk:
- membaca biaya tenaga kerja per pekerjaan,
- menghubungkan biaya ke step dan target,
- menjadi sumber direct labor cost di analisis HPP.

## Titik Validasi

- payrollNumber terbentuk benar,
- worker terkait benar,
- finalAmount mengikuti formula payroll,
- paymentStatus dan status sinkron.
