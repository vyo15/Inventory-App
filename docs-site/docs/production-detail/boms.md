---
title: BOM Produksi
sidebar_label: BOM Produksi
---

# Peran Menu

Production BOMs dipakai untuk mendefinisikan formula produksi.

## Update Rule dari Service Terbaru

Service terbaru menegaskan rule final berikut:

### Target Product
Jika target BOM adalah `product`, material yang boleh dipakai hanya:
- `semi_finished_material`

### Target Semi Finished Material
Jika target BOM adalah `semi_finished_material`, material yang boleh dipakai:
- `raw_material`
- `semi_finished_material`

## Reference Data

Service terbaru mengambil active reference data dari master yang aktif dan menormalkan reference item agar fallback code, name, unit tetap stabil.

## Variant Awareness

Service memakai helper `inferHasVariants`, yang berarti BOM sudah sadar apakah reference item memakai variant atau tidak.

## Implikasi Bisnis

Rule ini menegaskan bahwa produk jadi adalah tahap assembly dari semi finished, sedangkan semi finished bisa dibentuk dari raw material atau semi finished lain.
