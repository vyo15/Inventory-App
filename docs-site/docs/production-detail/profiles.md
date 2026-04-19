---
title: Profil Produksi
sidebar_label: Profil Produksi
---

# Fungsi Menu

Menu **Profil Produksi** dipakai untuk menyimpan referensi parameter dasar hasil produksi. Profil ini lebih dekat ke level aturan dasar proses dibanding level transaksi.

## Data yang Dikelola

Profil produksi menyimpan data seperti:
- profile name,
- product yang terkait,
- profile type,
- status aktif,
- status default,
- metrik hasil yang dihitung dari parameter input form.

## Kegunaan Praktis

Profil produksi bisa dipakai untuk:
- menjadi acuan pembuatan BOM,
- menyimpan parameter standar hasil,
- mengurangi input manual berulang,
- membantu konsistensi antar produk yang sejenis.

## Fungsi Utama Halaman

- tambah profil,
- edit profil,
- toggle aktif / nonaktif,
- melihat statistik total profil, profil aktif, profil default, dan jumlah produk yang sudah terhubung.

## Relasi Dengan Product

Halaman ini memuat daftar produk aktif lalu membuat lookup produk. Artinya profil memang dirancang untuk bisa dihubungkan langsung ke produk tertentu.

## Catatan Operasional

- Hanya satu atau sedikit profil default yang benar-benar relevan sebaiknya dijadikan standar.
- Jika profil terlalu banyak dan mirip, maintenance akan sulit.
- Profil tidak menggantikan BOM, tetapi menjadi referensi sebelum BOM disusun.
