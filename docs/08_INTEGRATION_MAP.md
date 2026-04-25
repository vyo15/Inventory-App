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
| Pembelian selesai | purchases | stock masuk + expenses | purchase id / source purchase |
| Penjualan selesai | sales | stock keluar + incomes | sale id / status selesai |
| Stock Adjustment | stock_adjustments | inventory_logs | adjustment id/reference |
| Work Log completed | production_work_logs | output stock + payroll line | Work Log completed guard |
| Payroll dari Work Log | production_payrolls | labor cost ke Work Log | Work Log + Step + Operator |
| Payroll paid | production_payrolls | expenses / Cash Out | sourceModule + sourceId |
| Profit Loss | revenues + incomes + expenses | laporan laba rugi | jangan baca payroll langsung jika sudah jadi expense |
| HPP Analysis | completed Work Logs | material + labor + total cost | completed Work Log only |

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
