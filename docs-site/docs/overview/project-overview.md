---
sidebar_position: 1
title: Project Overview
description: Gambaran umum project dan modul utama yang aktif.
---

# Project Overview

## Tujuan sistem

IMS Bunga Flanel dipakai untuk mengelola:

- **master data** bahan, produk, supplier, customer, dan kategori,
- **inventaris dan log stok**,
- **produksi bertahap** dari bahan baku menjadi semi finished lalu produk jadi,
- **transaksi pembelian, penjualan, retur, kas masuk, dan kas keluar**,
- **laporan stok, pembelian, penjualan, laba rugi, serta analisis HPP produksi**.

Tujuan utamanya adalah membuat satu sistem yang rapi, saling terhubung, dan mudah diaudit.

## Teknologi utama

Project menggunakan:

- **React** untuk frontend,
- **Firebase / Firestore** untuk penyimpanan data,
- **Ant Design** untuk komponen UI.

## Struktur menu utama

Menu aktif di aplikasi saat ini adalah:

### Data Utama

- Produk Jadi
- Bahan Baku
- Kategori
- Supplier
- Pelanggan
- Pricing Rules

### Inventaris

- Manajemen Stok
- Penyesuaian Stok

### Produksi

- Tahapan Produksi
- Karyawan Produksi
- Profil Produksi
- Semi Finished Materials
- BOM Produksi
- Production Orders
- Work Log Produksi
- Payroll Produksi
- Analisis HPP

### Transaksi

- Penjualan
- Pembelian
- Retur

### Kas & Biaya

- Pemasukan
- Pengeluaran

### Utilities

- Reset Data Uji

### Laporan

- Laporan Stok
- Laporan Pembelian
- Laporan Penjualan
- Laba Rugi

## Konsep stok di sistem

Sistem membedakan stok menjadi 3 kelompok utama:

- **Bahan Baku**
- **Semi Finished Materials**
- **Produk Jadi**

Setiap item bisa:

- **tanpa varian**, atau
- **pakai varian** seperti warna, ukuran, atau spesifikasi lain.

## Konsep produksi di sistem

Produksi dibangun untuk flow bertahap:

- bahan baku diproses menjadi **semi finished material**,
- semi finished material bisa dipakai lagi sebagai bahan untuk proses berikutnya,
- produk jadi idealnya dibangun dari **semi finished material** melalui BOM produksi.

## Prinsip maintainability

Beberapa prinsip penting yang dipakai saat ini:

- data master lebih aman **dinonaktifkan** daripada dihapus jika sudah pernah dipakai,
- stok dan log harus tetap sinkron,
- varian harus diperlakukan konsisten di raw material, semi finished, product, PO, dan work log,
- istilah dan tampilan UI dibuat seragam agar user tidak bingung.
