---
sidebar_position: 1
title: Intro
description: Pengantar dokumentasi IMS Bunga Flanel.
---

# Intro

Dokumentasi ini disusun agar user dan tim internal bisa memahami **cara kerja sistem terbaru** tanpa harus membaca source code satu per satu.

Fokus dokumentasi ini adalah:

- menjelaskan **fungsi tiap menu**,
- memperjelas **alur stok dan produksi**,
- merangkum **rule penting** seperti varian, costing, HPP, dan pricing,
- serta memberi catatan **maintenance** supaya sistem tetap rapi dan mudah dikembangkan.

## Arsitektur utama yang sedang aktif

Untuk modul produksi, alur final yang dipakai di project ini adalah:

**BOM Produksi → Production Order → Work Log Produksi → Payroll Produksi → Analisis HPP**

Alur ini dipakai untuk menjaga supaya:

- kebutuhan material dibaca dulu dari BOM,
- stok bahan dipotong saat mulai produksi,
- hasil produksi diposting saat work log selesai,
- biaya tenaga kerja bisa diposting terpisah,
- lalu biaya total bisa dianalisa per work log.

## Cakupan dokumentasi

Dokumentasi dibagi menjadi beberapa bagian:

- **Overview** untuk gambaran project.
- **Business Flow** untuk alur stok, pembelian, penjualan, dan produksi.
- **System Logic** untuk aturan sistem yang penting.
- **Menu Documentation** untuk penjelasan per menu.
- **Maintenance** untuk catatan perbaikan dan roadmap.

## Cara membaca dokumentasi ini

Agar mudah dipahami, bacanya paling enak dengan urutan berikut:

1. **Overview Project**
2. **Stock Flow**
3. **Production Flow**
4. **Stock Rules & Variant Logic**
5. **Menu Documentation**

Urutan itu membantu user memahami sistem dari sudut pandang operasional dulu, baru masuk ke detail menu.
