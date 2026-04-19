---
title: Reset Test Data
sidebar_label: Reset Data Uji
---

# Reset Data Uji

Menu ini dipakai untuk membersihkan data testing tanpa harus menghapus file project.

## Fungsi utama

- menghapus data transaksi uji
- menyimpan baseline stok saat ini
- merestore baseline yang pernah disimpan
- menjalankan sinkronisasi stok

## Kapan dipakai

- sebelum UAT ulang
- setelah testing produksi yang banyak
- saat data transaksi uji sudah terlalu bercampur

## Catatan penting

- reset data **tidak** memperbaiki logic yang salah
- reset data **tidak** otomatis memperbaiki requirement PO lama
- jika ada perubahan besar BOM atau varian, buat PO baru setelah reset

## Rekomendasi penggunaan

1. pastikan master data sudah benar
2. reset transaksi uji yang tidak dipakai
3. sinkronkan stok
4. lanjut testing ulang dari order baru
