# BUSINESS RULES — IMS Bunga Flanel

Dokumen ini merangkum aturan bisnis yang terlihat langsung dari implementasi aplikasi saat diaudit.

## 1. Rule Pembelian

### 1.1 Scope item pembelian
Pembelian bisa dilakukan untuk:
- bahan baku
- produk jadi

### 1.2 Konversi unit bahan baku
Untuk bahan baku, quantity pembelian bisa memakai unit beli yang dikonversi ke unit stok.

Rumus yang dipakai:
- `totalStockIn = quantity × conversionValue`

### 1.3 Actual purchase dan actual unit cost
Total pembelian aktual dihitung dari:
- subtotal item
- ongkir
- diskon ongkir
- voucher
- service fee

Actual unit cost per stock unit dihitung dari:
- `actualUnitCost = totalActualPurchase / totalStockIn`

### 1.4 Reference purchase dan saving
Pembelian bahan baku membandingkan biaya aktual dengan harga referensi restock.

Rumus:
- `totalReferencePurchase = totalStockIn × restockReferencePrice`
- `purchaseSaving = totalReferencePurchase - totalActualPurchase`

Status saving:
- `hemat` jika positif
- `lebih_mahal` jika negatif
- `normal` jika nol

### 1.5 Efek pembelian
Saat pembelian disimpan:
- simpan transaksi ke `purchases`
- tambah stok item
- untuk bahan baku tertentu update `averageActualUnitCost` dan `restockReferencePrice`
- catat `inventory_logs` dengan type `purchase_in`
- buat pengeluaran otomatis ke `expenses`

### 1.6 Catatan penting pengeluaran pembelian
Saving pembelian **ditampilkan sebagai informasi efisiensi**, bukan pengurang langsung nilai kas keluar. Nilai kas keluar tetap `totalActualPurchase`.

## 2. Rule Penjualan

### 2.1 Scope item penjualan
Penjualan bisa menjual:
- produk jadi
- bahan baku

### 2.2 Validasi stok
Sebelum penjualan disimpan, stok item harus cukup.

### 2.3 Efek saat penjualan dibuat
Saat transaksi penjualan disimpan:
- simpan transaksi ke `sales`
- stok langsung dikurangi
- catat `inventory_logs` dengan type `sale`

### 2.4 Pengakuan pemasukan kas
Pemasukan kas **tidak selalu dicatat saat sale dibuat**.

Rule yang terlihat:
- pemasukan ke `incomes` hanya dibuat jika status transaksi adalah `Selesai`
- jika transaksi dibuat dengan status selain `Selesai`, income belum dicatat
- jika nanti status diubah ke `Selesai`, income dibuat jika belum ada

### 2.5 Pembatalan penjualan
Jika status diubah ke `Dibatalkan`:
- stok item dikembalikan
- catat `inventory_logs` dengan type `sale_cancel_revert`

### 2.6 Hapus penjualan
Jika penjualan dihapus:
- jika status belum `Dibatalkan`, stok dikembalikan lagi lewat `sale_revert`
- jika status sudah `Dibatalkan`, stok tidak dikembalikan lagi agar tidak double revert
- income terkait sale juga dihapus

## 3. Rule Retur
Saat retur disimpan:
- transaksi masuk ke `returns`
- stok item bertambah
- catat `inventory_logs` dengan type `return_in`

## 4. Rule Kas Masuk
Modul Cash In membaca dua sumber:
- `revenues` untuk pemasukan manual
- `incomes` untuk pemasukan yang berasal dari penjualan selesai

Pemasukan manual baru disimpan ke `revenues` agar kompatibel dengan laporan lama.

## 5. Rule Kas Keluar
Modul Cash Out membaca `expenses`.

Sumber pengeluaran:
- pembelian otomatis dari modul purchases
- pengeluaran manual dari halaman cash out

## 6. Rule Laporan Pembelian
Laporan pembelian membaca `expenses`, bukan `purchases` langsung.

Implikasi:
- laporan pembelian mengikuti aliran pengeluaran yang benar-benar diakui
- pembelian yang tidak membuat expense tidak akan muncul di laporan ini

## 7. Rule Laporan Laba Rugi
Laporan laba rugi menggabungkan:
- `revenues`
- `incomes`
- `expenses`

Perhitungan:
- semua `revenues` + `incomes` dianggap pemasukan
- semua `expenses` dianggap pengeluaran
- laba kotor = total pemasukan - total pengeluaran

## 8. Rule Stok

### 8.1 Field stok aktif
Codebase memperlihatkan dua lapis field stok:
- lama: `stock`
- baru: `currentStock`, `reservedStock`, `availableStock`

### 8.2 Helper update stok umum
`inventoryService.updateStock()` mengupdate:
- `currentStock`
- `stock`

### 8.3 Konsekuensi penting
Kalau ada modul yang mengubah hanya `stock`, ada risiko sinkronisasi tidak penuh terhadap modul baru yang membaca `currentStock` dan `availableStock`.

## 9. Rule Produksi Umum
Flow produksi final yang terlihat di codebase adalah:
- BOM
- Production Order
- Work Log
- Payroll
- HPP Analysis

Catatan service bahkan menyebut:
- flow aktif: `BOM -> PO -> Start Production -> Work Log -> Complete`
- reserve/release dipertahankan untuk kompatibilitas lama, bukan flow utama

## 10. Rule BOM
- target BOM bisa `product` atau `semi_finished_material`
- bila target BOM adalah `product`, semua material wajib berasal dari `semi_finished_material`
- BOM menyimpan material lines dan step lines

## 11. Rule Production Order
- PO dibentuk dari BOM
- PO menghitung requirement bahan otomatis
- status utama yang terlihat: `shortage`, `ready`, `in_production`
- ada dukungan strategi varian material: `inherit`, `fixed`, `none`

## 12. Rule Work Log
Work Log adalah realisasi kerja produksi.

Data inti yang direkam:
- material usage
- outputs
- worker
- step
- target
- planned qty dan actual qty
- good / reject / rework / scrap
- labor cost / overhead / total cost
- monitoring miss dan output teoretis

## 12A. Rule Guarded Logic Produksi
Setelah flow produksi aktif tervalidasi, area berikut harus dianggap locked / guarded:
- status flow utama: `ready` / `shortage` / `in_production` / `completed`
- contract 1 PO = 1 Work Log
- Start Production memotong stok bahan dari snapshot requirement PO
- Complete Work Log menambah stok output dan menutup PO
- Work Log completed tidak boleh diedit sembarangan tanpa evaluasi khusus

Implikasi:
- patch UI tidak boleh mengubah field inti work log / PO setelah flow aktif berjalan
- perubahan helper shared / refactor presentational tidak boleh mengubah sourceType, link PO, target, step, material usage yang sudah ter-posting, atau output yang sudah ter-posting

## 13. Rule Payroll Produksi
Payroll produksi dibangun dari work log completed.

Rule final yang sekarang harus dianggap resmi:
- source of truth payroll adalah rule payroll pada `production_steps`
- saat work log dibuat / diupdate, rule payroll step disnapshot ke work log
- saat payroll draft dibuat, service membaca snapshot rule payroll pada work log completed
- payroll v1 final memakai target **1 payroll line = 1 orang + 1 step + 1 batch/work log**
- jika work log lama belum punya snapshot, service boleh fallback sekali ke master step dan harus menandainya sebagai legacy/deprecated fallback
- custom payroll di master karyawan tidak lagi menjadi jalur hitung aktif
- line payroll aktif dijaga per kombinasi `workLogId + workerLineKey`; line yang cancelled boleh dibuat ulang
- payroll support / fulfillment tetap boleh dibayar, tetapi klasifikasinya harus dibedakan dari direct labor inti
- payroll baru harus melewati status `draft` -> `confirmed` -> `paid` / `cancelled`

Rumus final:
- `per_batch` memakai `plannedQty` / qty batch work log sebagai worked qty
- `per_qty` memakai `good_qty` atau `actual_output_qty` sesuai basis output rule step
- `fixed` dihitung 1x per line payroll
- line support / fulfillment default tidak masuk HPP inti kecuali rule step menyatakan sebaliknya

## 14. Rule Reset Data Uji
Reset utilitas mendukung mode:
- reset transaksi saja
- reset + nolkan semua stok
- reset + restore baseline testing

Utilitas ini juga menyinkronkan kembali field stok agar konsisten.
