---
sidebar_position: 3
title: Variant Logic
description: Aturan pemakaian varian di bahan baku, semi finished, produk, BOM, PO, dan work log.
---

# Logika Varian

## Kapan varian dipakai

Varian dipakai jika item memang punya turunan seperti:

- warna
- ukuran
- spesifikasi

Jika tidak perlu, lebih aman gunakan mode tanpa varian.

## Prinsip dasar

- stok item bervarian disimpan per varian
- tabel menampilkan total stok dan seluruh varian penting
- output produksi harus masuk ke target varian yang benar
- bahan produksi harus membaca sumber stok yang benar, bukan selalu master

## Strategi varian di BOM

Material line pada BOM bisa memakai strategi:

- `inherit` → ikut varian target
- `fixed` → pakai varian tertentu
- `none` → pakai stok master

## Varian lintas item

Sistem terbaru tidak hanya mengandalkan `variantKey`.
Saat mewariskan varian dari target ke bahan, sistem juga mencoba mencocokkan:

- label
- nama
- warna
- kode
- SKU
- token teks yang dinormalisasi

Tujuannya agar target seperti **ungu** tetap bisa menemukan bahan baku **ungu** walaupun key internal item berbeda.

## Rule penting

- buat PO baru setelah perubahan BOM atau mapping varian penting
- jangan andalkan snapshot lama jika master item sudah diganti
- jika requirement masih terbaca `master`, cek strategi BOM dan label varian bahan
