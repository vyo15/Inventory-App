---
title: Overview Testing
sidebar_label: Overview Testing
---

# Tujuan

Menu **Testing Center** dipakai sebagai pusat ceklis test manual berdasarkan struktur project aktual. Menu ini dipisahkan dari `Maintenance` agar histori bug dan roadmap tidak bercampur dengan aktivitas test.

## Dasar Penyusunan Checklist
Checklist di menu ini disusun dari struktur menu dan route project aktif:
- Dashboard
- Data Utama
- Inventaris
- Produksi
- Transaksi
- Kas & Biaya
- Laporan

Sidebar dan route aktif project juga menegaskan bahwa modul produksi final dipusatkan ke:
**BOM Produksi → Production Orders → Work Log Produksi**.

## Cara Pakai
- Gunakan `[ ]` untuk item yang belum dicek.
- Gunakan `[x]` untuk item yang sudah lolos.
- Tambahkan catatan singkat untuk kasus gagal.
- Jika menemukan bug baru, pindahkan ringkasannya ke `Bug Fix Log` atau `Known Issues`.

## Urutan Testing yang Disarankan
1. Master Data
2. Inventory
3. Produksi
4. Transaksi
5. Laporan
6. UAT Final
7. Regression Log

## Catatan Penting
Sebelum test, pastikan:
- `intro.mdx` yang bentrok dengan `intro.md` sudah tidak dipakai lagi agar docs tidak error,
- data test yang dipakai konsisten,
- perubahan stok dicek dari hasil akhir modul dan bukan hanya dari tampilan UI.
