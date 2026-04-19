---
title: Pricing Rules
sidebar_label: Pricing Rules
---

# Tujuan Menu

Menu **Pricing Rules** dipakai untuk membuat aturan harga otomatis untuk raw materials dan products.

## Fungsi Utama

Dari source terbaru, halaman ini mendukung:
- create rule,
- update rule,
- delete rule,
- preview harga,
- apply rule ke item target,
- statistik rule aktif / nonaktif.

## Target Type

Rule saat ini mendukung dua target:
- `raw_materials`
- `products`

## Base Cost Source

Base cost source yang sudah dipakai di service terbaru:
- `averageActualUnitCost`
- `restockReferencePrice`
- `hppPerUnit`

## Komponen Formula

Rule dapat memuat:
- margin,
- marketplace buffer,
- rounding type,
- rounding unit.

## Status Preview

Source terbaru mengenali beberapa status preview seperti:
- `ready`
- `skipped_manual`
- `invalid_base_cost`
- `invalid_marketplace_buffer`
- `inactive_rule`

## Dampak ke Modul Lain

- Products
- Raw Materials
- pricingMode item target
- update harga jual / selling price item target
