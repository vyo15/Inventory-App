---
title: Work Log Produksi
sidebar_label: Work Log Produksi
---

# Work Log Produksi

## Tujuan
Dipakai untuk mencatat realisasi produksi yang berasal dari Production Order.

## Ringkasan Informasi
Tabel utama menampilkan:
- no. work log,
- tanggal,
- target / step,
- qty batch, estimasi output, good output,
- biaya aktual,
- source,
- status,
- aksi.

Drawer detail menampilkan:
- qty batch,
- estimasi output,
- good output,
- total biaya,
- ringkasan work log,
- tim & catatan,
- biaya aktual,
- pemakaian material,
- hasil produksi.

## Field Form Utama
- **No. Work Log**
- **Tanggal**
- **Source Type**
- **Production Order** atau **Production BOM**
- **Target Type**
- **Target Item**
- **Profil Produksi**
- **Production Step**
- **Sequence No**
- **Qty Batch**
- **Qty Input Dasar**
- **Sisa Daun Aktual**
- **Sisa Kawat Aktual**
- **Good Qty**
- **Reject Qty**
- **Rework Qty**
- **Worker**
- **Labor Cost**
- **Overhead Cost**
- **Scrap Qty**
- **Catatan**

## Tombol Aksi
- **Detail**
- **Edit**
- **Selesaikan**
- **Apply Draft PO**
- **Apply Draft BOM**

## Modal Selesaikan Work Log
Field penting:
- **Qty Bagus**
- **Qty Reject**
- **Qty Rework**
- **Operator Produksi**
- **Catatan Penyelesaian**

## Rule Penting
- work log utama dibuat dari PO,
- bahan input sudah dipotong saat **Mulai Produksi**,
- tombol **Selesaikan** hanya menambah output dan menutup pekerjaan,
- estimasi output berasal dari **hasil per produksi di BOM x qty batch**.

## Contoh Skenario
1. Buka work log dari PO.
2. Cek pemakaian bahan dan target output.
3. Saat selesai, isi qty bagus, reject, rework, dan operator.
4. Simpan; output semi finished atau produk akan bertambah sesuai target dan varian.
