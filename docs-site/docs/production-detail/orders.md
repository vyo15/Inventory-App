---
title: Production Orders
sidebar_label: Production Orders
---

# Fungsi Menu

Menu **Production Orders** dipakai untuk membuat order kerja produksi berdasarkan BOM aktif.

## Data yang Dikelola

Order menyimpan:
- kode order,
- target type,
- target,
- qty,
- requirement,
- status,
- linked work log.

Di bagian detail requirement, sistem membaca:
- item,
- tipe,
- sumber stok,
- need,
- current,
- available,
- shortage,
- status.

## Peran Dalam Flow Aktif
Production Order adalah titik transisi dari struktur BOM ke order kerja nyata yang akan dijalankan di Work Log.

## Rule Penting
- PO **wajib membaca BOM aktif** sesuai target type yang dipilih.
- Dropdown BOM **tidak boleh kosong** bila BOM aktif tersedia untuk target type tersebut.
- PO **wajib auto generate kode order** bila field kode dibiarkan kosong.
- Format kode harus konsisten:
  - Semi Finished: `PO-SFP-YYYYMMDD-XXXX`
  - Product: `PO-PRD-YYYYMMDD-XXXX`
- Requirement material harus sinkron dengan BOM yang dipilih.
- Saat PO dibuat, stok **belum berubah**.
- Status PO minimal harus jelas: `draft`, `ready`, `shortage`, `in_production`, `completed`, `cancelled`.
- Satu PO hanya boleh terhubung ke satu Work Log.
- Start Production dari PO harus membuat Work Log otomatis dan memotong bahan input satu kali.
