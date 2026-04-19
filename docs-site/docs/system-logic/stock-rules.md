---
title: Stock Rules
sidebar_label: Stock Rules
---

## Rule Dasar
1. **currentStock** adalah source of truth utama untuk stok aktif.
2. Field `stock` lama hanya berfungsi sebagai mirror compatibility selama masa transisi.
3. Bila ada varian, total stok harus konsisten dengan penjumlahan stok varian.
4. Mutasi stok wajib meninggalkan jejak log inventory jika modul log aktif.
5. Stok bahan baku, semi finished, dan product tidak boleh dicampur.
6. Semua mutasi stok wajib lewat helper atau service stok pusat.
7. Page, form, atau menu tidak boleh mutasi stok langsung dengan logic masing-masing.
