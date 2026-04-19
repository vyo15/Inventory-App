---
title: Regression Log
sidebar_label: Regression Log
---

# Regression Log

Halaman ini dipakai untuk mencatat test ulang setelah perbaikan bug atau perubahan logic.

## Format Catatan

## YYYY-MM-DD — Modul / Perubahan
- Perubahan yang dites ulang:
- Area yang dicek:
- Hasil:
  - Lolos / Gagal / Monitoring
- Catatan:

## Contoh 1
## 2026-04-18 — Dokumentasi / Intro Docs
- Perubahan yang dites ulang:
  - bentrok duplicate id intro
- Area yang dicek:
  - start docs site
  - route docs intro
- Hasil:
  - Lolos
- Catatan:
  - hanya `intro.md` yang dipakai, `intro.mdx` tidak dipakai lagi

## Contoh 2
## 2026-04-18 — Produksi / Flow Final
- Perubahan yang dites ulang:
  - BOM → Production Orders → Work Log
- Area yang dicek:
  - create BOM
  - create order
  - create work log
  - complete work log
- Hasil:
  - Monitoring
- Catatan:
  - variant dan rollback masih perlu uji tambahan
