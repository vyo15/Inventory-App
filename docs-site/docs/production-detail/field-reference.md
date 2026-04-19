---
title: Referensi Field Produksi
sidebar_label: Referensi Field
---


# Tujuan

Halaman ini dipakai sebagai referensi cepat untuk field dan blok data yang sering muncul di modul produksi. Fokusnya bukan persis nama setiap property internal, tetapi **arti bisnis** dari field yang muncul di form dan tabel.

## 1. Tahapan Produksi

### Field Inti
- **name / stepName**  
  Nama tahapan kerja.

- **description**  
  Penjelasan singkat fungsi step.

- **processType**  
  Jenis proses yang dilakukan pada step tersebut.

- **basisType**  
  Dasar pengukuran step. Biasanya dipakai untuk menentukan pola hitung.

- **monitoringMode**  
  Menentukan cara step dipantau di proses produksi.

- **payrollMode**  
  Menentukan cara step masuk ke logika payroll.

- **outputBasisPayroll**  
  Menentukan apakah payroll berbasis output tertentu.

- **isActive**  
  Menentukan apakah step masih dipakai.

## 2. Profil Produksi

### Field Inti
- **name / profileName**  
  Nama profil produksi.

- **productId / productName**  
  Produk yang terkait dengan profil.

- **profileType**  
  Kategori atau tipe profil.

- **isActive**  
  Status aktif.

- **isDefault**  
  Menandai profil default.

- **yield / parameter hasil**  
  Nilai dasar hasil produksi.

## 3. Semi Finished Materials

### Field Inti
- **code**  
  Kode item semi finished.

- **name**  
  Nama item.

- **category**  
  Kategori internal item.

- **variantColor / variantKey**  
  Varian item, terutama warna atau tipe.

- **currentStock**  
  Stok aktif saat ini.

- **reservedStock**  
  Stok yang sudah dipesan untuk order tertentu.

- **availableStock**  
  Stok yang tersedia untuk dipakai. Arah jangka panjangnya adalah `currentStock - reservedStock`.

- **averageCost / averageCostPerUnit**  
  Biaya rata-rata per unit.

- **isActive**  
  Status aktif item.

## 4. BOM Produksi

### Field Inti Header
- **bomNumber / code**  
  Nomor atau kode BOM.

- **name**  
  Nama BOM.

- **targetType**  
  Menentukan target output: `semi_finished_material` atau `product`.

- **targetItemId**  
  Item output yang menjadi target BOM.

- **profileId**  
  Profil produksi yang terkait.

- **isActive**  
  Status aktif.

- **isDefault**  
  Status default.

### Field Material Line
- **itemType**  
  Jenis material: raw material atau semi finished.

- **itemId**  
  Item yang dipakai.

- **qtyPerBatch / qty**  
  Kebutuhan material.

- **uom**  
  Satuan.

- **variantMode / variantKey**  
  Strategi varian input.

- **unitCostSnapshot**  
  Snapshot biaya per unit.

- **totalCostSnapshot**  
  Snapshot total biaya line.

### Field Step Line
- **sequenceNo**  
  Urutan step.

- **stepId**  
  Tahapan produksi yang dipakai.

- **notes**  
  Catatan tambahan jika ada.

## 5. Production Orders

### Field Inti
- **orderNumber**  
  Nomor order produksi.

- **sourceBomId**  
  BOM yang dipakai sebagai dasar.

- **targetType**  
  Tipe target output.

- **targetItemId**  
  Item target.

- **plannedQty**  
  Qty rencana produksi.

- **materialRequirements**  
  Ringkasan kebutuhan material.

- **shortageStatus / hasShortage**  
  Status kekurangan material.

- **reserveStatus**  
  Status reservasi stok input.

- **status**  
  Status order produksi.

## 6. Work Log Produksi

### Field Inti Header
- **workLogNumber**  
  Nomor work log.

- **sourceType**  
  Sumber work log, arah finalnya `production_order`.

- **sourceId**  
  Order produksi yang menjadi sumber.

- **targetType**  
  Tipe target output.

- **targetItemId**  
  Item target aktual.

- **stepId / stepName**  
  Step yang dikerjakan.

- **status**  
  Draft, in progress, atau completed.

### Field Material Usage
- **itemType**
- **itemId**
- **plannedQty**
- **actualQty**
- **unitCostActual**
- **totalCostActual**
- **stockConsumeStatus**

### Field Output Line
- **outputType**
- **outputItemId**
- **goodQty**
- **rejectQty**
- **reworkQty**
- **stockOutputStatus**
- **averageCostOutput**

## 7. Payroll Produksi

### Field Inti
- **payrollNumber**
- **workLogId**
- **employeeId / employeeName**
- **payrollDate**
- **amount**
- **finalAmount**
- **paymentStatus**
- **status**

## 8. Analisis HPP

### Field Inti
- **workLogNumber**
- **goodQty**
- **materialCostActual**
- **directLaborCost**
- **overheadCostActual**
- **totalCost**
- **hppPerUnit**
