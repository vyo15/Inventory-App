---
title: Checklist Validasi Produksi
sidebar_label: Checklist Validasi
---


# Checklist Validasi Produksi

Gunakan halaman ini untuk ceklis manual setiap modul produksi.

## Tahapan Produksi
- [ ] Tambah step normal
- [ ] Edit step normal
- [ ] Toggle active normal
- [ ] Relasi step ke BOM terbaca

## Profil Produksi
- [ ] Tambah profile normal
- [ ] Edit profile normal
- [ ] Toggle active normal
- [ ] Set default normal
- [ ] Relasi profile ke product terbaca

## Semi Finished Materials
- [ ] Tambah item normal
- [ ] Edit item normal
- [ ] currentStock tampil benar
- [ ] reservedStock tidak membingungkan user
- [ ] availableStock otomatis
- [ ] variant stock sinkron

## BOM Produksi
- [ ] Target item muncul benar
- [ ] BOM semi finished menerima material yang benar
- [ ] BOM product hanya menerima semi finished sesuai rule final
- [ ] Material lines tersimpan benar
- [ ] Step lines tersimpan benar
- [ ] Toggle active normal

## Production Orders
- [ ] Order bisa dibuat dari BOM
- [ ] Requirement terbaca
- [ ] Shortage check terbaca
- [ ] Status order normal
- [ ] Flow start produksi membuat work log yang benar

## Work Log Produksi
- [ ] Work log dari order terbaca benar
- [ ] Material usage planned vs actual normal
- [ ] Output line normal
- [ ] Complete work log tidak double consume
- [ ] Output stock masuk sekali
- [ ] Linked order tertutup benar

## Payroll Produksi
- [ ] Draft payroll dari work log completed normal
- [ ] Edit payroll normal
- [ ] Payment status normal
- [ ] Payroll cancelled tidak ikut analisis HPP

## Analisis HPP
- [ ] Material cost actual terbaca
- [ ] Direct labor cost terbaca
- [ ] Overhead terbaca
- [ ] Total cost terbaca
- [ ] HPP per unit terbaca benar
