---
title: Production
sidebar_label: Production
---

# Tujuan Menu

Menu **Production** menaungi seluruh workflow produksi dari master step sampai pembacaan HPP.

## Submenu Aktif

Berdasarkan source terbaru, submenu aktif produksi adalah:
- Production Steps
- Production Employees
- Production Profiles
- Semi Finished Materials
- Production Boms
- Production Orders
- Production Work Logs
- Production Payrolls
- Production HPP Analysis

## Flow Inti

Flow resmi produksi tetap diarahkan ke:
**BOM Produksi → Production Orders → Work Log Produksi**

## Update Penting dari Source Terbaru

### BOM Produksi
Service terbaru menegaskan:
- target `product` hanya boleh memakai material `semi_finished_material`,
- target `semi_finished_material` boleh memakai `raw_material` atau `semi_finished_material`.

### Production Orders
Service terbaru sudah mendukung:
- planning dari BOM,
- kebutuhan material,
- shortage check,
- strategi varian `inherit / fixed / none`,
- reserve dan release stock.

### Work Logs
Service terbaru menjelaskan bahwa completion work log mengelola mutasi stok end-to-end:
- consume input,
- release reserve,
- add output,
- close linked PO.

### Payroll dan HPP
Payroll membaca work log completed, lalu Analisis HPP membaca material cost + labor cost + overhead cost.

## Implikasi
Dokumentasi produksi dan testing harus selalu berpatokan pada flow final ini, bukan pada flow lama.
