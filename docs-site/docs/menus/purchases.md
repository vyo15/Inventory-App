---
title: Purchases
sidebar_label: Purchases
---

# Tujuan Menu

Menu **Purchases** dipakai untuk mencatat pembelian bahan dan menambah stok bahan baku.

## Fokus Logic pada Source Terbaru

Walau file purchases belum didokumentasikan ulang secara penuh di zip sebelumnya, source terbaru tetap menunjukkan bahwa raw material aktif memakai:
- `currentStock`
- `reservedStock`
- `availableStock`
- `averageActualUnitCost`
- `restockReferencePrice`

Itu berarti transaksi purchase harus dipahami sebagai sumber utama untuk:
- penambahan stok raw material,
- pembentukan biaya aktual,
- pembaruan rata-rata biaya bahan.

## Rule Penting

- actual price tetap menjadi harga beli aktual,
- reference price hanya pembanding efisiensi,
- saving bukan pengurang kas langsung,
- jika item memakai variant, stok harus bertambah pada variant yang tepat.

## Dampak ke Modul Lain

- Raw Materials
- Inventory Log
- Production input cost
- Purchases Report
- Profit & Loss bila ada alur biaya yang dibaca laporan
