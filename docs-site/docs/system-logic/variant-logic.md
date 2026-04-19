---
sidebar_position: 3
title: Variant Logic
description: Aturan pemakaian varian di bahan baku, semi finished, produk, BOM, PO, dan work log.
---

# Variant Logic

## Kapan varian dipakai

Varian dipakai jika item memang punya turunan seperti:

- warna,
- ukuran,
- spesifikasi.

Jika item tidak butuh turunan seperti itu, lebih rapi menggunakan **tanpa varian**.

## Prinsip dasar

Item yang memakai varian akan menyimpan stok per varian.

Artinya:

- stok total tetap bisa ditampilkan,
- tetapi sumber stok aktual yang dipakai operasional adalah stok pada varian terkait.

## Tampilan tabel stok

Di halaman master data, stok varian ditampilkan langsung agar user bisa melihat semua varian tanpa harus membuka detail dulu.

Ini mempermudah audit cepat, terutama untuk bahan baku kain, semi finished warna, dan produk jadi varian warna.

## Varian di BOM

Pada material line BOM, varian material bisa berjalan dengan strategi:

- **inherit**: mengikuti varian target,
- **fixed**: memakai varian tertentu yang ditentukan di BOM,
- **none**: memakai stok master.

## Varian di Production Order

Saat PO dibuat, sistem membentuk requirement material dan mencoba menentukan source stoknya:

- **variant** jika mapping varian cocok,
- **master** jika item tidak bervarian atau mapping memang none.

## Inherit variant lintas item

Sistem terbaru tidak hanya mengandalkan **variant key** internal.

Saat mewariskan varian dari target ke bahan, sistem juga mencoba mencocokkan berdasarkan:

- label varian,
- nama,
- warna,
- kode,
- SKU,
- token teks yang dinormalisasi.

Tujuannya agar kasus seperti **target ungu** bisa tetap menemukan **bahan baku ungu** walaupun key internal antar item berbeda.

## Varian di Work Log

- material di work log membaca source stok dari requirement PO,
- output di work log diposting ke target yang benar,
- jika target punya varian, output akan masuk ke **varian target**.

## Rule penting untuk user

Jika ingin hasil stok benar:

- pastikan master item memang punya varian yang aktif,
- pastikan BOM line bahan dipilih dari data yang terbaru,
- buat PO baru setelah perubahan penting pada BOM atau mapping varian.
