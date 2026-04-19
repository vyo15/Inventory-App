---
title: Penjualan
sidebar_label: Penjualan
---

# Penjualan

## Tujuan
Dipakai untuk mencatat penjualan produk jadi atau bahan.

## Field Form Utama
- **Pelanggan**
- **Items**:
  - pilih produk / bahan,
  - jumlah,
  - harga satuan.
- **Channel Penjualan**
- **Status**
- **No. Resi / No. Order / Referensi**
- **Tanggal**
- **Catatan**

## Tombol Aksi di Tabel
- **Dikirim**
- **Selesai**
- **Batalkan**
- hapus transaksi bila memang diizinkan flow saat itu.

## Rule Penting
- stok berkurang saat transaksi dibuat sesuai flow aktif,
- status online dan offline perlu dibaca benar karena berpengaruh ke pengakuan kas dan progres order.

## Contoh Skenario
Input penjualan bunga mawar melalui marketplace, isi nomor order, set status sesuai tahap proses, lalu cek stok produk berkurang.
