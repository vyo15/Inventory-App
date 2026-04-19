---
sidebar_position: 2
title: Costing & HPP
description: Ringkasan logika biaya pembelian, biaya produksi, dan HPP.
---

# Costing & HPP

## Costing bahan baku

Untuk bahan baku, sistem menyimpan beberapa nilai biaya penting:

- **restockReferencePrice**
- **averageActualUnitCost**
- **sellingPrice**

### Arti tiap field

**Restock Reference Price** adalah harga acuan per satuan stok yang dipakai sebagai pembanding saat pembelian.

**Average Actual Unit Cost** adalah modal aktual rata-rata per satuan stok yang dihitung dari pembelian nyata.

**Selling Price** adalah harga jual bahan baku jika bahan baku memang dijual.

## Costing produk jadi

Untuk produk jadi, field biaya utama saat ini adalah:

- **hppPerUnit**
- **price**

**hppPerUnit** menjadi dasar utama untuk pricing rules produk jadi.

## Pricing Rules

Pricing Rules saat ini mendukung:

- target **raw_materials**,
- target **products**,
- base cost,
- margin,
- marketplace buffer,
- rounding,
- apply ke beberapa item sekaligus.

### Base cost source final

- Untuk **raw materials**, base cost utama adalah **averageActualUnitCost**.
- Untuk **products**, base cost utama adalah **hppPerUnit**.

### Marketplace buffer

Buffer marketplace bisa dipakai untuk menutup fee platform sebelum harga dibulatkan.

### Rounding

Sistem mendukung pembulatan:

- up,
- down,
- nearest.

## HPP produksi

Analisis HPP produksi membaca biaya realisasi dari work log dan payroll, lalu menghitung:

- material cost,
- direct labor,
- overhead,
- total cost,
- HPP per unit.

Perhitungan HPP per unit dilakukan dari:

**total cost / good qty**

Jadi good qty menjadi angka penting untuk akurasi HPP.
