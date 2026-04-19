---
title: Checklist Master Data
sidebar_label: Checklist Master Data
---

# Checklist Master Data

Checklist ini dibuat berdasarkan modul aktif:
- Products
- Raw Materials
- Categories
- Suppliers
- Customers
- Pricing Rules

## Products
Dari halaman `Products.jsx`, modul ini mendukung:
- create product,
- update product,
- toggle active,
- detail drawer,
- variant product,
- pricing mode manual / rule.

### Checklist
- [ ] Tambah product baru berhasil disimpan
- [ ] Edit product berhasil disimpan
- [ ] Toggle active / non-active berjalan normal
- [ ] Detail product bisa dibuka
- [ ] `hasVariants` mengubah perilaku form dengan benar
- [ ] Variants minimal satu item saat mode varian aktif
- [ ] `currentStock`, `reservedStock`, `minStockAlert` tersimpan benar
- [ ] Pricing mode manual tampil benar
- [ ] Pricing mode rule tampil benar
- [ ] Pricing rule product yang targetType `products` muncul di pilihan
- [ ] Category lookup tampil benar
- [ ] Variant count dan summary card logis

## Raw Materials
Dari halaman `RawMaterials.jsx`, modul ini mendukung:
- create raw material,
- update raw material,
- remove raw material,
- supplier lookup,
- pricing rules untuk target `raw_materials`,
- variant raw material.

### Checklist
- [ ] Tambah bahan baku berhasil
- [ ] Edit bahan baku berhasil
- [ ] Hapus bahan baku mengikuti rule yang aman
- [ ] Supplier tampil di pilihan
- [ ] Pricing rule raw material tampil di pilihan
- [ ] `hasVariants` mengubah form dengan benar
- [ ] Variants raw material tersimpan benar
- [ ] Unit tampil sesuai opsi yang dipakai (`pcs`, `meter`, `yard`, `kg`, dan seterusnya)
- [ ] current stock / biaya dasar tampil logis
- [ ] Summary total material, with variants, no variants terbaca benar

## Categories
- [ ] Tambah kategori berhasil
- [ ] Edit kategori berhasil
- [ ] Data kategori tampil di product yang relevan

## Suppliers
- [ ] Tambah supplier berhasil
- [ ] Edit supplier berhasil
- [ ] Supplier bisa dipakai di Purchases dan Raw Materials

## Customers
- [ ] Tambah customer berhasil
- [ ] Edit customer berhasil
- [ ] Customer bisa dipakai di Sales

## Pricing Rules
Dari struktur menu project, Pricing Rules memang menjadi menu master data aktif.

### Checklist
- [ ] Rule baru berhasil dibuat
- [ ] Target `raw_materials` berjalan
- [ ] Target `products` berjalan
- [ ] Preview harga tampil
- [ ] Harga hasil rule bisa dibaca di item target
- [ ] Rule aktif / nonaktif terbaca benar

## Catatan Temuan
Tulis temuan manual di bawah ini.
