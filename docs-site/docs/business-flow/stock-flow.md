---
title: Stock Flow
sidebar_label: Stock Flow
---

## Kategori Stok
- Raw Materials
- Semi Finished Materials
- Finished Goods / Products

## Alur Perubahan Stok
- Pembelian menambah stok raw material.
- Start Production mengurangi stok input produksi.
- Complete Work Log menambah stok output produksi.
- Penjualan mengurangi stok product.
- Stock adjustment dipakai untuk koreksi manual.

## Prinsip Penting
- Source of truth stok aktif dipusatkan ke **currentStock**.
- Field `stock` lama hanya dipertahankan sebagai **mirror compatibility** bila masih diperlukan.
- Semua mutasi stok wajib lewat helper atau service stok pusat.
- Page atau form tidak boleh mutasi stok langsung dengan logic masing-masing.
- Stok varian harus mengikuti helper varian, bukan hanya angka stock total.
- Stok bahan baku, semi finished, dan product tidak boleh dicampur.
