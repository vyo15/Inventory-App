---
title: Status dan Transisi Produksi
sidebar_label: Status & Transisi
---


# Tujuan

Halaman ini menjelaskan status utama dan transisi yang sebaiknya terjadi di modul produksi.

## 1. Status Tahapan Produksi
Tahapan Produksi lebih dekat ke master data, sehingga status utamanya biasanya:
- **active**
- **inactive**

Transisi:
- active → inactive
- inactive → active

## 2. Status Profil Produksi
Status utama:
- **active**
- **inactive**
- **default / non-default**

Transisi:
- active ↔ inactive
- non-default → default
- default → non-default

## 3. Status Semi Finished Materials
Semi finished lebih banyak berhubungan dengan status stok daripada status workflow.

Komponen status yang relevan:
- current stock
- reserved stock
- available stock
- active / inactive

## 4. Status BOM Produksi
Status utama:
- **active**
- **inactive**
- **default / non-default**

Transisi:
- BOM draft data selesai → active
- active ↔ inactive
- non-default → default

## 5. Status Production Orders
Status utama yang sebaiknya dibaca user:
- **draft**
- **ready**
- **in_progress**
- **completed**
- **cancelled**

Makna:
- **draft**: order baru dibuat, masih review.
- **ready**: requirement sudah terbaca dan siap dijalankan.
- **in_progress**: order sudah mulai dijalankan.
- **completed**: order selesai.
- **cancelled**: order dibatalkan.

## 6. Status Work Log Produksi
Status inti:
- **draft**
- **in_progress**
- **completed**
- **cancelled** jika nanti dipakai

Makna:
- **draft**: log baru dibuat, belum final.
- **in_progress**: produksi sedang jalan.
- **completed**: realisasi sudah final.
- **cancelled**: log dibatalkan dan harus ada rule rollback yang jelas.

## 7. Status Payroll Produksi
Status utama:
- **draft**
- **approved**
- **paid**
- **cancelled**

Jika implementasi sekarang belum lengkap, dokumentasi ini tetap bisa dipakai sebagai arah target jangka panjang.

## Rule Penting
- status completed pada work log tidak boleh diberikan jika output dan biaya belum valid,
- status cancelled harus punya dampak stok / biaya yang jelas jika nantinya dipakai,
- status order dan status work log tidak boleh saling bertabrakan.
