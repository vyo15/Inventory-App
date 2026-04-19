---
title: Project Overview
sidebar_label: Project Overview
---

IMS Bunga Flanel adalah aplikasi inventory dan operasional untuk usaha bunga flanel yang menggabungkan **master data**, **inventory**, **produksi**, **transaksi**, **keuangan**, dan **laporan** dalam satu sistem.

## Ringkasan Project
Sistem ini dibangun untuk mengelola:
- bahan baku,
- semi finished materials,
- produk jadi,
- pembelian,
- penjualan,
- kas dan biaya,
- proses produksi bertahap,
- laporan operasional dan laba rugi.

## Fokus Utama Sistem
Fokus utama aplikasi saat ini adalah:
1. membuat alur stok lebih konsisten,
2. merapikan arsitektur produksi,
3. menghubungkan pembelian, penjualan, biaya, dan laporan,
4. mendukung variasi produk / bahan berbasis varian.

## Struktur Besar Menu
Menu utama aplikasi terbagi menjadi beberapa domain:
- Dashboard
- Data Utama
- Inventaris
- Produksi
- Transaksi
- Kas & Biaya
- Laporan

## Arsitektur Produksi yang Aktif
Arsitektur produksi saat ini diarahkan ke alur final berikut:
- **Tahapan Produksi** untuk master step,
- **Profil Produksi** untuk referensi yield / parameter kerja,
- **Semi Finished Materials** untuk stok komponen semi jadi,
- **BOM Produksi** untuk formula produksi,
- **Production Orders** untuk order produksi,
- **Work Log Produksi** untuk eksekusi produksi,
- **Payroll Produksi** untuk biaya tenaga kerja,
- **Analisis HPP** untuk pembacaan biaya produksi.

## Entitas Data Utama
Entitas yang paling penting di project:
- products
- raw_materials
- suppliers
- customers
- purchases
- sales
- pricing_rules
- production_steps
- production_profiles
- semi_finished_materials
- production_boms
- production_orders
- production_work_logs
- payroll related data
- laporan / agregasi transaksi

## Keluaran yang Diharapkan dari Sistem
Sistem diharapkan bisa:
- menunjukkan stok aktual,
- membantu kontrol pembelian,
- menelusuri biaya produksi,
- memisahkan bahan baku, semi jadi, dan produk jadi,
- mendukung keputusan harga jual,
- mendukung evaluasi laba rugi.
