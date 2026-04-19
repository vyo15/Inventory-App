---
sidebar_position: 1
title: Intro
description: Pengantar dokumentasi IMS Bunga Flanel.
---

# Intro

Dokumentasi ini dipakai sebagai panduan kerja untuk user operasional dan tim internal saat memakai, mengecek, dan merapikan sistem.

## Fokus dokumentasi

- menjelaskan fungsi tiap menu
- merangkum rule penting yang memengaruhi stok dan produksi
- memudahkan testing setelah perubahan
- menjadi acuan saat bersih-bersih code dan dokumentasi

## Arsitektur utama yang aktif

Alur produksi yang dipakai saat ini:

**BOM Produksi → Order Produksi → Work Log Produksi → Payroll Produksi → Analisis HPP**

Alur stok yang dijaga sistem:

- stok bahan dibaca dari master item dan varian
- requirement bahan dibentuk dari BOM ke Order Produksi
- stok bahan dipotong saat mulai produksi
- output masuk saat work log selesai
- payroll dan analisis HPP dibaca setelah realisasi kerja tersedia

## Struktur menu yang dipakai

- **Dashboard**
- **Master Data**
- **Inventaris**
- **Produksi**
- **Transaksi**
- **Kas & Biaya**
- **Laporan**
- **Sistem**

## Urutan membaca dokumentasi

Urutan paling aman untuk user baru:

1. Overview Project
2. Alur Stok
3. Logika Varian
4. Aturan Produksi
5. Dokumentasi per Menu
6. Detail Produksi
