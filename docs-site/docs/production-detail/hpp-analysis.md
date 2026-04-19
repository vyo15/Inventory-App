---
title: Analisis HPP
sidebar_label: Analisis HPP
---

# Peran Menu

Analisis HPP membaca work log completed dan payroll produksi untuk menghitung biaya aktual per output.

## Update dari Source Terbaru

Source terbaru masih memakai rumus:
- `materialCostActual`
- `directLaborCost`
- `overheadCostActual`
- `totalCost = material + labor + overhead`
- `hppPerUnit = totalCost / goodQty`

## Rule Penting

- payroll dengan status `cancelled` tidak ikut dibaca,
- jika payroll tidak ada, direct labor bisa fallback ke `laborCostActual` di work log,
- `goodQty` harus benar karena sangat memengaruhi HPP per unit.

## Nilai yang Ditampilkan

- work log number,
- target / step,
- good qty,
- material cost,
- direct labor cost,
- overhead cost,
- total cost,
- HPP per unit.
