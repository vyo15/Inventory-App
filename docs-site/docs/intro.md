---
title: Dokumentasi IMS Bunga Flanel
sidebar_label: Dokumentasi IMS Bunga Flanel
---

Dokumentasi ini dipakai sebagai **source of truth operasional** untuk project IMS Bunga Flanel. Tujuannya bukan hanya menjelaskan menu, tetapi juga menyimpan keputusan logic, alur data, bug fix, known issues, dan checklist validasi.

## Tujuan Dokumentasi
1. menjelaskan arsitektur sistem inventory dan produksi,
2. menyimpan keputusan logic yang sudah dipakai di project,
3. memudahkan audit saat ada bug atau perubahan flow,
4. menjadi patokan saat membuka chat baru atau melanjutkan pekerjaan,
5. memisahkan dokumentasi stabil dari percakapan yang sifatnya sementara.

## Cara Membaca Dokumentasi
- **Overview** berisi gambaran besar sistem.
- **Business Flow** berisi alur pembelian, produksi, penjualan, dan stok.
- **System Logic** berisi aturan penting yang harus tetap konsisten.
- **Menus** berisi fungsi tiap menu.
- **Maintenance** berisi perubahan, bug fix, roadmap, dan checklist validasi.

## Prinsip Umum Project
- Sistem inventory memakai pendekatan **stock aktif di currentStock**.
- Produksi diarahkan ke alur final **BOM → Production Orders → Work Log**.
- Stok bahan, semi finished, dan output harus terhubung tanpa double tracking.
- Dokumentasi harus diupdate jika ada perubahan logic inti.
