---
title: Change Log
sidebar_label: Change Log
---

## Catatan Utama yang Sudah Ditetapkan
### Patch 2026-04-07
- route / menu lama **Product Compositions** dan **Produksi Dasar** dipensiunkan,
- duplicate route `/productions` dihapus,
- jalur produksi difokuskan ke **BOM → Production Orders → Work Log**,
- work log dari flow utama dipusatkan ke source `production_order`,
- logic reserve / release dipensiunkan dari flow produksi aktif,
- flow stok produksi aktif diarahkan ke:
  - start production = consume input stock,
  - complete work log = add output stock,
  - close linked production order,
- reserved stock pada Semi Finished Materials tidak lagi menjadi bagian flow utama.

### Cleanup Final Notes
- source of truth stok aktif dipusatkan ke `currentStock`,
- field `stock` hanya dipertahankan sebagai mirror compatibility,
- mutasi stok harus melewati helper/service stok pusat,
- flow produksi dirapikan ke PO dan Work Log dengan rule **1 PO = 1 Work Log**.
