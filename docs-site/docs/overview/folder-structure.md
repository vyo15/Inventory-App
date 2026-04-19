---
title: Folder Structure
sidebar_label: Folder Structure
---

## Struktur Root Project
Secara umum project dibagi menjadi:
- `src/` untuk source code utama aplikasi,
- `functions/` untuk Firebase Functions,
- `docs-site/` untuk dokumentasi Docusaurus,
- `dist/` untuk hasil build,
- file konfigurasi seperti `firebase.json`, `vite.config.js`, dan package files.

## Struktur Penting di Dalam src
### `src/pages`
Berisi halaman utama per domain bisnis:
- Dashboard
- MasterData
- Inventory
- Produksi
- Transaksi
- Finance
- Laporan
- Utilities

### `src/services`
Berisi operasi data per domain.

### `src/constants`
Berisi enum, default form, dan helper config.

### `src/utils`
Berisi helper lintas modul, terutama formatter, stock helper, variant helper, pricing helper, dan helper produksi.

### `src/config`
Berisi konfigurasi menu sidebar.

### `src/router`
Berisi definisi route aplikasi.
