---
title: Production Rules
sidebar_label: Production Rules
---

## Arsitektur Aktif
Flow resmi produksi adalah **BOM → Production Orders → Start Production → Work Log → Complete**.

## Rule BOM
- target output harus jelas,
- material lines menyimpan qty per batch dan biaya snapshot,
- material dapat berupa raw material atau semi finished,
- strategy varian bahan harus jelas: inherit, fixed, atau none.

## Rule Production Order
- satu pekerjaan wajib dimulai dari Production Order,
- PO wajib membaca BOM aktif sesuai target type,
- PO wajib auto generate kode order bila field kode kosong,
- pembuatan PO tidak mengubah stok,
- satu PO hanya boleh memiliki satu Work Log,
- Start Production dari PO adalah titik resmi pemotongan bahan input.

## Rule Work Log
- Work Log adalah catatan produksi aktual dari PO,
- Work Log pada flow utama tidak dibuat manual,
- material usage dihitung dengan planned vs actual,
- output line menyimpan good, reject, dan rework,
- Complete Work Log adalah titik resmi penambahan output,
- Complete tidak boleh memotong input lagi bila bahan sudah dipotong saat start.

## Rule Cancel
- cancel dari status `ready` tidak mengubah stok,
- cancel dari status `in_production` harus melalui pengembalian bahan via adjustment atau flow pengembalian resmi.
