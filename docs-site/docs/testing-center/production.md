---
title: Checklist Produksi
sidebar_label: Checklist Produksi
---

# Checklist Produksi

Checklist ini disusun dari modul produksi aktif:
- Production Steps
- Production Employees
- Production Profiles
- Semi Finished Materials
- Production Boms
- Production Orders
- Production Work Logs
- Production Payrolls
- Production HPP Analysis

## Tahapan Produksi
- [ ] Tambah step normal
- [ ] Edit step normal
- [ ] Toggle active normal
- [ ] Summary total steps logis
- [ ] Relasi step ke BOM terbaca

## Karyawan Produksi
- [ ] Tambah karyawan produksi normal
- [ ] Edit karyawan normal
- [ ] Relasi karyawan ke step normal
- [ ] Status aktif normal

## Profil Produksi
- [ ] Tambah profile normal
- [ ] Edit profile normal
- [ ] Product lookup muncul
- [ ] Set default normal
- [ ] Toggle active normal

## Semi Finished Materials
- [ ] Tambah item normal
- [ ] Edit item normal
- [ ] `currentStock` tampil benar
- [ ] Variant semi finished tersimpan benar
- [ ] Average cost tampil benar

## BOM Produksi
- [ ] Tambah BOM berhasil
- [ ] Edit BOM berhasil
- [ ] Target item tampil benar
- [ ] Target type product berjalan
- [ ] Target type semi finished berjalan
- [ ] Material lines tersimpan benar
- [ ] Step lines tersimpan benar
- [ ] Snapshot cost material tersimpan
- [ ] Toggle active normal
- [ ] Toggle default normal
- [ ] Variant input mengikuti rule yang dipakai

## Production Orders
- [ ] PO bisa dibuat dari BOM aktif
- [ ] Dropdown BOM tampil sesuai target type
- [ ] Kode PO auto generate saat field kode kosong
- [ ] Requirement material tampil
- [ ] Shortage check tampil
- [ ] Status order terbaca benar
- [ ] Start Production membuat 1 Work Log yang benar
- [ ] Start Production memotong bahan input sekali
- [ ] Flow final mengikuti **BOM → Production Orders → Start Production → Work Log → Complete**

## Work Log Produksi
- [ ] Work Log dari order terbaca benar
- [ ] 1 PO hanya punya 1 Work Log
- [ ] Tidak ada mode manual Work Log pada flow utama
- [ ] Material usage planned vs actual normal
- [ ] Output line normal
- [ ] good / reject / rework tersimpan benar
- [ ] Complete work log tidak double consume
- [ ] Output stock masuk sekali
- [ ] Linked order tertutup benar
- [ ] Source type `production_order` terbaca benar

## Payroll Produksi
- [ ] Draft payroll dari work log completed normal
- [ ] Edit payroll normal
- [ ] Payment status normal
- [ ] Payroll cancelled tidak ikut analisis HPP

## Analisis HPP
- [ ] Material cost actual terbaca
- [ ] Direct labor cost terbaca
- [ ] Overhead terbaca
- [ ] Total cost terbaca
- [ ] HPP per unit terbaca benar

## Known Risk Saat Testing Produksi
- [ ] Variant semua skenario sudah diuji
- [ ] Rollback dan cancel sudah diuji
- [ ] Tidak ada sisa flow legacy aktif
- [ ] Helper produksi sinkron dengan constants terbaru

## Catatan Temuan
Tulis temuan manual di bawah ini.
