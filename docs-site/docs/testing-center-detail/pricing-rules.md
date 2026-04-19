---
title: Testing Pricing Rules
sidebar_label: Testing Pricing Rules
---

# Testing Pricing Rules — Update Source Terbaru

## Target Type
- [ ] `raw_materials` bisa dipilih
- [ ] `products` bisa dipilih

## Base Cost Source
- [ ] `averageActualUnitCost` terbaca untuk raw materials
- [ ] `restockReferencePrice` terbaca untuk raw materials
- [ ] `hppPerUnit` terbaca untuk products

## Preview Status
- [ ] `ready` tampil
- [ ] `skipped_manual` tampil saat mode manual
- [ ] `invalid_base_cost` muncul saat base cost kosong
- [ ] `inactive_rule` tampil untuk rule nonaktif

## Apply Rule
- [ ] Rule bisa diterapkan ke item target
- [ ] Harga target berubah sesuai preview
- [ ] Update harga tidak merusak field lain
