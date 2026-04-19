---
sidebar_position: 2
title: Production Flow
description: Alur final produksi dari BOM sampai hasil produksi diposting ke stok.
---

# Production Flow

## Arsitektur final yang aktif

Flow produksi yang dipakai sekarang adalah:

**BOM Produksi → Production Order → Work Log Produksi → Payroll Produksi → Analisis HPP**

Flow ini dipakai supaya proses perencanaan, realisasi, biaya, dan analisis tetap terpisah dan mudah diaudit.

## 1. BOM Produksi

BOM adalah definisi resep dan kebutuhan material untuk menghasilkan target tertentu.

### Rule penting BOM

- Jika target BOM adalah **product**, material yang dipakai harus berasal dari **semi finished material**.
- Jika target BOM adalah **semi_finished_material**, material boleh berasal dari **raw material** atau **semi finished material**.
- Setiap BOM punya **batch output qty**, yaitu hasil per 1 batch.

### Arti batch output qty

Contoh:

- batch output qty = **100 pcs**
- qty batch di PO = **350**
- estimasi output = **35.000 pcs**

## 2. Production Order

Production Order dibuat dari BOM sebagai dokumen rencana produksi.

Di PO, sistem menyimpan:

- target produksi,
- varian target jika ada,
- qty batch,
- estimasi output,
- requirement material,
- shortage dan status kesiapan material.

### Requirement material

Requirement material menunjukkan:

- bahan apa yang dibutuhkan,
- kebutuhannya berapa,
- source stoknya dari **master** atau **variant**,
- stok saat ini,
- apakah ada shortage atau tidak.

### Inherit variant

Jika target PO memakai varian, sistem akan mencoba mewariskan varian itu ke bahan yang relevan.

Contoh:

- target varian = **ungu**,
- bahan baku yang punya varian warna juga akan dicari ke **ungu**,
- jika mapping ditemukan, requirement material akan membaca source **variant**, bukan master.

## 3. Mulai Produksi

Saat user menekan **Mulai Produksi** pada PO:

- stok material dipotong sesuai requirement PO,
- sumber stok yang dipakai mengikuti hasil resolve **master** atau **variant**,
- sistem membuat **Work Log Produksi**,
- status PO berubah ke **In Production**.

## 4. Work Log Produksi

Work Log adalah catatan realisasi kerja produksi.

Data penting di work log:

- nomor work log,
- target dan step,
- qty batch,
- estimasi output,
- pemakaian material,
- hasil output,
- operator produksi,
- catatan,
- biaya aktual.

### Saat menyelesaikan work log

User mengisi:

- Qty Bagus,
- Qty Reject,
- Qty Rework,
- operator produksi,
- catatan penyelesaian.

Lalu sistem:

- menambah stok output,
- menandai status work log completed,
- menyelesaikan production order terkait.

## 5. Payroll Produksi

Payroll produksi mengambil draft dari work log yang sudah completed.

Tujuannya adalah memisahkan:

- realisasi output produksi,
- dan biaya tenaga kerja yang dibayarkan ke operator.

## 6. Analisis HPP

Analisis HPP membaca:

- work log completed,
- payroll produksi,
- biaya material,
- biaya tenaga kerja,
- overhead,

lalu menghitung **HPP per unit** berdasarkan **good qty**.
