---
title: Testing Stock Management
sidebar_label: Testing Stock Management
---

# Testing Stock Management

## Inventory Log
- [ ] Data inventory log tampil
- [ ] Tanggal tampil benar
- [ ] Item name tampil benar
- [ ] Collection type tampil benar

## Mutation Types
- [ ] `purchase_in` tampil sebagai Pembelian
- [ ] `sale` tampil sebagai Terjual
- [ ] `sale_revert` tampil sebagai rollback penjualan
- [ ] `sale_cancel_revert` tampil sebagai batal / hapus jual
- [ ] `stock_adjustment` tampil benar
- [ ] `production_out_pending` tampil benar
- [ ] `production_in_completed` tampil benar

## Data Integrity
- [ ] quantityChange tidak tertukar tanda plus / minus
- [ ] note / reason tampil
- [ ] tidak ada log duplikat dari satu aksi

## Catatan Temuan
Tuliskan bug atau mismatch di bawah ini.
