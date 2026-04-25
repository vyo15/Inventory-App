# 08 Integration Map IMS Bunga Flanel

Dokumen ini mengunci alur integrasi IMS final agar modul tidak berjalan sendiri-sendiri.

## Alur utama

```text
Master Data
→ Transaksi
→ Stok
→ Produksi
→ Payroll
→ Kas & Biaya
→ HPP
→ Laporan
```

## Flow aktif per modul

| Flow | Source aktif | Output otomatis | Guard anti-double |
|---|---|---|---|
| Pembelian selesai | purchases | stock masuk + expenses | purchase id + metadata source expense |
| Penjualan dibuat / selesai | sales | stock keluar saat create + income saat selesai | availableStock guard + sale id / status selesai |
| Stock Adjustment | stock_adjustments | inventory_logs | adjustment id/reference |
| Work Log completed | production_work_logs | output stock + payroll line | Work Log completed guard |
| Payroll dari Work Log | production_payrolls | labor cost ke Work Log | Work Log + Step + Operator |
| Payroll paid | production_payrolls | expenses / Cash Out | sourceModule + sourceId |
| Profit Loss | revenues + incomes + expenses | laporan laba rugi | jangan baca payroll langsung jika sudah jadi expense |
| HPP Analysis | completed Work Logs | material + labor + total cost + warning cost 0 | completed Work Log only + payroll final only |

## Source reference wajib

Semua data otomatis harus menyimpan referensi:

- `sourceModule`
- `sourceId`
- `sourceRef`
- `sourceType` jika perlu
- `createdByAutomation` jika dibuat sistem

## Guard penting

1. Work Log completed tidak boleh diproses dua kali.
2. Payroll line tidak boleh dobel untuk Work Log + Step + Operator yang sama.
3. Payroll paid tidak boleh membuat expense dobel.
4. Profit Loss tidak boleh menghitung payroll dari dua sumber sekaligus.
5. Backfill data lama tidak boleh otomatis tanpa preview.

## Catatan legacy

- Data lama yang belum punya `sourceModule/sourceId` tetap dibaca sebagai fallback.
- Work Log lama yang cost/payroll-nya masih kosong perlu task backfill terpisah.
- Expense payroll yang dibuat otomatis tidak boleh dihapus otomatis saat payroll dibatalkan sampai rule rollback disepakati.

## Flow Production Planning

```text
Production Planning
→ user action: Buat PO
→ Production Order berbasis BOM
→ user action: Mulai Produksi
→ Work Log in_progress
→ user action: Complete Work Log
→ output stock + payroll/HPP existing
→ Dashboard membaca progress planning
```

| Flow | Source aktif | Output otomatis | Guard anti-double |
|---|---|---|---|
| Planning dibuat | production_plans | target monitoring | tidak ada mutasi stok |
| PO dari Planning | production_plans + production_boms | production_orders dengan planning reference | user action wajib, tetap lewat BOM |
| Progress Planning | completed production_work_logs | actual/remaining/progress read model realtime | hitung Work Log completed sekali per id |
| Dashboard Planning | production_plans + PO + Work Log completed | summary target minggu/bulan | read-only, tidak update data |

## Source reference Planning ke PO
PO yang dibuat dari planning wajib menyimpan:
- `planningId`
- `planningCode`
- `planningTitle`

Planning dapat menyimpan:
- `linkedProductionOrderIds`
- `linkedProductionOrderCodes`

Jika array link planning belum lengkap, service tetap bisa membaca PO berdasarkan `planningId`.

## Guard Tambahan
1. Planning tidak mengubah stok.
2. Planning tidak menggantikan BOM.
3. PO dari planning tetap harus memakai requirement helper existing.
4. Progress tidak boleh dihitung dari PO created saja.
5. Work Log selain `completed` tidak dihitung.
6. Dashboard planning tidak boleh menjadi tempat edit/update data.


## Final Integration Lock Fase A-G - 2026-04-26

### Sales Stock Safety
```text
Sales Form
-> validasi line item
-> agregasi kebutuhan item/varian
-> validasi final availableStock dari Firestore
-> create sale
-> mutasi stok keluar
-> inventory log sale
-> income hanya jika status Selesai
```

Guard:
- sale tidak boleh tersimpan jika stok tersedia tidak cukup;
- item bervarian wajib validasi varian yang benar;
- jika mutasi stok gagal setelah sale dibuat, sale baru harus rollback/delete agar tidak orphan;
- cancel/delete tetap revert stok satu kali dan tidak membuat income dobel.

### Purchase Expense Metadata
```text
Purchase saved
-> stock masuk
-> inventory_logs purchase_in
-> expenses auto-generated
-> Cash Out / Profit Loss membaca expenses
```

Expense pembelian wajib membawa:
- `sourceModule: purchases` mengikuti schema aktif project;
- `sourceId: purchaseId`;
- `sourceRef` reference pembelian;
- `sourceType: auto_generated`;
- `createdByAutomation: true`.

### HPP / Work Log Cost Visibility
```text
Completed Work Log
-> materialCostActual / laborCostActual / totalCostActual / costPerGoodUnit
-> HPP Analysis
-> warning jika cost 0
-> Export HPP XLSX membawa kolom Validasi Cost
```

Guard:
- jangan isi cost asal;
- draft payroll tidak dihitung sebagai final;
- Work Log completed tidak diproses ulang hanya untuk display warning.

### Dashboard Read-only Map
```text
Dashboard
-> reads only: stock, planning, PO, work log, payroll, expenses/incomes, inventory logs
-> 5 section compact
-> no write
-> last updated + refresh summary only
```

Dashboard tidak boleh menjadi sumber transaksi. Semua action Dashboard hanya navigasi ke modul terkait.

### Report / Export Map
```text
Stock Report
-> raw_materials + semi_finished_materials + products
-> XLSX siap baca

HPP Analysis
-> completed Work Logs + payroll final
-> XLSX HPP + Validasi Cost

Payroll Report
-> production_payrolls
-> XLSX utama, CSV legacy compatibility
```

### Legacy Duplicate Cleanup Map
- Folder `src/src/**` tidak boleh menjadi target patch aktif.
- Jika muncul lagi, lakukan grep/import/route check sebelum hapus.
- Route aktif Dashboard tetap `src/pages/Dashboard/Dashboard.jsx`.
- Service aktif Planning tetap `src/services/Produksi/productionPlanningService.js`.

### Profit Loss dan Payroll Anti Double Count
```text
Payroll paid
-> expense otomatis sourceModule=production_payroll sourceId=payrollId
-> Profit Loss membaca expenses
```

Profit Loss tidak boleh membaca payroll langsung dari `production_payrolls` jika payroll paid sudah menjadi expense, karena akan double counting.
