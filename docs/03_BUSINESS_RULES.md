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

Sumber pengeluaran aktif:
- pembelian otomatis dari modul purchases
- payroll produksi otomatis saat line payroll ditandai `paid`
- pengeluaran manual dari halaman cash out

Expense otomatis wajib memiliki source reference agar tidak double:
- `sourceModule`
- `sourceId`
- `sourceRef` jika tersedia
- `sourceType` jika auto-generated
- `createdByAutomation` jika dibuat sistem

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
`inventoryService.updateInventoryStock()` adalah helper aktif untuk mutasi stok umum. Helper ini wajib menjaga sinkronisasi:
- `stock`
- `currentStock`
- `reservedStock`
- `availableStock`
- `variants[]` untuk item bervarian

### 8.3 Konsekuensi penting
Kalau ada modul yang mengubah hanya `stock`, ada risiko sinkronisasi tidak penuh terhadap modul baru yang membaca `currentStock`, `reservedStock`, `availableStock`, dan `variants[]`.

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

## 14. Rule Reset Data Uji
Reset utilitas mendukung mode:
- reset transaksi saja
- reset + nolkan semua stok
- reset + restore baseline testing

Utilitas ini juga menyinkronkan kembali field stok agar konsisten.


## Tambahan Rule Terkini (Batch Prioritas)

### Work Log Costing saat Complete
- saat Work Log diselesaikan, summary costing final harus dihitung ulang dari snapshot material terbaru
- `materialCostActual`, `totalCostActual`, dan `costPerGoodUnit` tidak boleh dibiarkan hanya mengikuti draft awal jika snapshot material berubah saat complete
- sinkronisasi payroll ke Work Log boleh memperbarui `laborCostActual` sebagai ringkasan display, tetapi tidak mengubah source of truth payroll line

### Payroll Paid vs Cash Out
- status `paid` pada payroll produksi sekarang adalah trigger integrasi ke Cash Out/Expense.
- Saat payroll berubah menjadi `paid` dan `paymentStatus` menjadi `paid`, sistem membuat expense otomatis dengan guard idempotent.
- Guard wajib memakai `sourceModule: production_payroll` dan `sourceId: payrollId`; jika expense dengan source yang sama sudah ada, sistem tidak boleh membuat expense baru.
- Jika payroll `finalAmount <= 0`, expense otomatis boleh dilewati dan status sync dicatat agar audit tetap jelas.

### Export Laporan
- laporan stok aktif sebaiknya memakai ekspor XLSX yang lebih rapi, bukan CSV mentah
- helper export reusable boleh dipakai lintas laporan selama tidak mengubah source data laporan

## Update Rule Stok & Audit Log — 2026-04-25

### 8.4 Source of truth mutasi stok umum
Mutasi stok umum wajib lewat `updateInventoryStock()` agar field berikut tetap sinkron:
- `stock`
- `currentStock`
- `reservedStock`
- `availableStock`
- `variants[]` untuk item bervarian

Pengecualian yang dijaga adalah flow produksi final karena `productionWorkLogsService` membutuhkan transaction atomic untuk konsumsi material dan posting output.

### 8.5 Stock Adjustment
Stock Adjustment tidak boleh lagi update field `stock` secara langsung dari page. Adjustment harus:
- memakai Firestore transaction agar update stok, record `stock_adjustments`, dan `inventory_logs` tidak commit setengah jalan;
- memakai helper stok varian aktif seperti `applyStockMutationToItem()` agar `stock/currentStock/reservedStock/availableStock/variants[]` tetap sinkron;
- memilih item dari `raw_materials` atau `products`;
- memilih varian jika item bervarian;
- mencegah adjustment keluar melebihi `availableStock`, bukan hanya mengecek `currentStock`;
- membuat record `stock_adjustments`;
- membuat `inventory_logs` dengan `adjustmentId`, `referenceId`, `referenceType`, dan snapshot stok sebelum/sesudah;
- tidak mengubah stok jika record adjustment atau inventory log gagal dibuat.

### 8.6 Inventory Log Reference
Inventory log baru wajib menyimpan reference audit di field standar:
- `referenceId`
- `referenceType`
- `details`

Field lama di top-level tetap boleh dipertahankan untuk kompatibilitas reader lama.

### 2.7 Customer Collection
Collection customer final adalah `customers` lowercase. Modul Master Customer dan Sales harus membaca sumber yang sama agar data pelanggan tidak terpencar.

## Update Rule Karyawan Produksi — 2026-04-25

### Kode karyawan produksi otomatis
- Karyawan produksi baru wajib memakai kode otomatis format `DDMMYYYY-XXX`.
- Prefix `DDMMYYYY` memakai tanggal lokal saat data karyawan dibuat.
- Nomor urut `XXX` selalu 3 digit dan naik per tanggal pembuatan.
- User tidak boleh mengetik kode karyawan manual saat tambah data baru.
- Service karyawan produksi wajib generate ulang kode saat submit agar preview di form tidak menjadi source final bila ada input paralel.
- Field `code` tetap dipakai sebagai display reference di Work Log/Payroll, tetapi Firestore document id tetap menjadi relasi utama.
- Kode lama seperti `EMP-...` dianggap legacy data dan tidak dimigrasi otomatis saat edit.

## Update Rule Auto Payroll Work Log Completed — 2026-04-25

- Work Log Produksi yang berubah ke status `completed` wajib membuat line Payroll Produksi otomatis.
- Source of truth payroll baru tetap mengikuti rule pada Tahapan Produksi: `payrollMode`, `payrollRate`, `payrollQtyBase`, `payrollOutputBasis`, `payrollClassification`, dan `includePayrollInHpp`.
- Operator Produksi wajib dipilih saat menyelesaikan Work Log agar payroll line bisa dibuat per operator.
- Guard idempotent wajib memakai kombinasi Work Log + Step + Operator agar klik Selesaikan berulang tidak membuat payroll dobel.
- Status awal line payroll otomatis adalah `draft` dan `paymentStatus` awal adalah `unpaid`.
- Payroll paid membuat Cash Out/Expense otomatis hanya lewat guard `sourceModule/sourceId` agar tidak double expense.
- Work Log completed tetap guarded: posting stok output dan material tidak boleh diproses ulang hanya karena payroll line dibuat atau payroll dibayar.

## Business Rule Final — Integrasi Payroll Paid ke Cash Out
- Work Log completed otomatis membuat payroll line per operator berdasarkan rule Tahapan Produksi.
- Payroll line otomatis tetap memakai guard idempotent Work Log + Step + Operator agar tidak double payroll.
- Saat payroll ditandai `paid` dan `paymentStatus` menjadi `paid`, sistem otomatis membuat Cash Out/Expense.
- Expense payroll wajib memakai `sourceModule: production_payroll`, `sourceId: payrollId`, dan `sourceRef: payrollNumber`.
- Expense payroll tidak boleh dibuat ulang jika source payroll yang sama sudah punya expense.
- Payroll dengan `finalAmount <= 0` boleh ditandai paid, tetapi Cash Out otomatis dilewati dan dicatat sebagai `skipped_zero_amount`.
- Profit Loss membaca biaya payroll dari collection `expenses`, bukan dari `production_payrolls`, agar tidak double counting.
- Jika payroll paid dibatalkan/diubah ulang, expense tidak dihapus otomatis sebelum ada business rule rollback yang jelas.


## Final Lock Cleanup Task 1–5 — 2026-04-25

### Inventory / Stock Management
- Kolom Referensi Audit adalah audit source untuk menjelaskan asal mutasi stok: Penyesuaian Stok, Pembelian, Penjualan, Retur, Produksi / Work Log, atau Production Order.
- Referensi harus tampil manusiawi; ID teknis boleh ada sebagai detail kecil/tooltip, bukan teks utama.
- Stock Adjustment aktif hanya melalui halaman Manajemen Stok; route lama bila ada hanya legacy redirect.
- Angka pada Stock Adjustment wajib memakai format Indonesia tanpa trailing `.00` untuk angka bulat, dan maksimal 2 desimal untuk pecahan.
- Riwayat adjustment harus terbaru di atas, prioritas `createdAt` lalu fallback `date` untuk data lama.

### Production Order Preview
- Drawer Buat Production Order wajib menampilkan preview compact read-only: stok target, varian target jika ada, qty batch, estimasi output, kebutuhan material, stok material, dan status cukup/kurang.
- Preview tidak boleh mengubah stok, status PO, BOM, Work Log, payroll, atau HPP.
- Production Order final tetap dihitung ulang dari BOM/helper requirement final saat submit.

### Work Log Actual Cost / HPP
- Completed Work Log wajib menyimpan `materialCostActual`, `laborCostActual`, `overheadCostActual`, `totalCostActual`, dan `costPerGoodUnit`.
- Biaya tidak boleh diisi asal; material cost harus berasal dari cost snapshot atau source cost item yang aman, bukan harga jual.
- `totalCostActual = materialCostActual + laborCostActual + overheadCostActual`.
- `costPerGoodUnit = totalCostActual / goodQty` hanya jika `goodQty > 0`; jangan membagi 0.
- HPP Analysis membaca completed Work Log sebagai source cost final.

### Payroll Produksi
- Work Log completed wajib membuat payroll line otomatis berdasarkan rule Tahapan Produksi.
- Guard payroll wajib mencegah duplikasi per kombinasi Work Log + Step + Operator.
- Status payroll yang dipakai: `draft`, `confirmed` jika flow approval dipakai, dan `paid`.
- `paymentStatus` menjelaskan status pembayaran internal line payroll; saat paid, sistem membuat expense otomatis dengan guard.
- Payroll preference/custom payroll di master karyawan adalah legacy/compatibility, bukan source utama payroll baru.

### Cash Out / Expense Payroll
- Payroll paid otomatis membuat expense di Cash Out dengan `sourceModule=production_payroll`, `sourceId=payrollId`, dan `sourceRef=payrollNumber`.
- Expense payroll tidak boleh dibuat dobel ketika user klik Paid ulang, reload, atau update status berulang.
- Jika payroll paid dibatalkan, expense tidak dihapus otomatis sebelum ada business rule rollback yang jelas.

### Export Laporan
- Export final laporan harus XLSX rapi dengan title, filter/periode, header manusiawi, format Rupiah, format tanggal Indonesia, format angka Indonesia, sheet name jelas, dan auto width.
- Jangan export object mentah, JSON string panjang, atau field teknis yang tidak dibutuhkan user.

## 9. Rule Production Planning / Planning Schedule

### 9.1 Scope Production Planning
Production Planning adalah layer rencana sebelum Production Order. Data aktif disimpan di collection `production_plans`.

Planning boleh menyimpan:
- kode planning;
- periode mingguan, bulanan, atau custom;
- deadline;
- target type `product` atau `semi_finished_material`;
- target item;
- target varian jika item punya varian;
- target qty;
- priority;
- catatan;
- referensi PO terkait.

### 9.2 Efek Planning
Production Planning **tidak boleh**:
- mengubah stok;
- memotong bahan;
- menambah output;
- membuat payroll;
- membuat expense/cash out;
- mengubah HPP;
- otomatis membuat PO tanpa aksi user.

### 9.3 Link Planning ke PO
PO yang dibuat dari planning wajib menyimpan:
- `planningId`;
- `planningCode`;
- `planningTitle`.

PO manual tanpa planning tetap valid.

### 9.4 Progress Planning
Progress planning wajib dihitung dari data aktual:
- sumber utama: Work Log `completed` milik PO yang terhubung ke planning;
- jika Work Log punya output line, gunakan `outputs[].goodQty` yang cocok dengan target item;
- fallback hanya untuk data lama: `workLog.goodQty` jika target Work Log cocok;
- Work Log `draft`, `in_progress`, `cancelled`, atau status lain tidak dihitung.

Jika target punya varian, progress wajib cocok dengan `targetVariantKey`. Jika target tidak punya varian, progress cukup cocok dengan item master.

### 9.5 Status Planning
Status planning final:
- `draft`: periode belum mulai dan target belum tercapai;
- `active`: periode berjalan / belum overdue dan target belum tercapai;
- `completed`: actual completed qty >= target qty;
- `overdue`: due date lewat dan target belum tercapai;
- `cancelled`: dibatalkan manual.

Planning `completed` atau `cancelled` tidak boleh menghapus PO/Work Log yang sudah ada.

### 9.6 Dashboard Planning
Dashboard hanya membaca summary planning:
- target minggu ini;
- progress minggu ini;
- target bulan ini;
- progress bulan ini;
- jumlah overdue;
- jumlah kurang target.

Dashboard tidak boleh mengubah data planning, PO, Work Log, stok, payroll, atau HPP.


## Final Lock Hardening Fase A-G - 2026-04-26

Bagian ini mengunci hasil hardening bertahap Fase A sampai F dan menjadi acuan utama untuk patch berikutnya. Fase G hanya dokumentasi, tidak mengubah source aplikasi.

### Fase A - Sales Stock Safety
- Penjualan wajib melakukan validasi stok sebelum transaksi disimpan.
- Validasi penjualan wajib memakai `availableStock` master atau varian, bukan hanya `currentStock` atau snapshot UI lama.
- Jika item yang sama muncul lebih dari satu baris, kebutuhan qty wajib dihitung total sebelum create sale agar stok tidak minus.
- Item bervarian wajib memvalidasi `variantKey` dan stok varian yang benar.
- Sale tidak boleh tersimpan jika stok tersedia tidak cukup.
- Jika mutasi stok gagal setelah sale dibuat, sale baru wajib dibatalkan/rollback agar tidak ada transaksi orphan tanpa stok keluar.
- Income rule tidak berubah: income hanya dibuat saat sale berstatus `Selesai` dan tidak boleh dobel.
- Cancel/delete sale tetap guarded: cancel revert stok satu kali, delete sale yang sudah `Dibatalkan` tidak revert ulang.

### Fase B - Metadata Expense Pembelian
- Pembelian tetap membuat expense otomatis dengan amount mengikuti logic existing pembelian.
- Saving pembelian tetap hanya informasi efisiensi dan bukan pengurang kas.
- Expense otomatis pembelian wajib menyimpan reference audit:
  - `sourceModule` mengikuti schema aktif project, yaitu `purchases`;
  - `sourceId` berisi purchase id;
  - `sourceRef` berisi nomor/reference pembelian yang tersedia;
  - `sourceType: auto_generated`;
  - `createdByAutomation: true`;
  - field kompatibilitas lama seperti `relatedPurchaseId` tetap boleh dipertahankan.
- Expense pembelian tidak boleh dibuat dobel untuk transaksi purchase yang sama.

### Fase C - HPP dan Work Log Cost 0 Visibility
- HPP tidak boleh mengisi angka cost asal jika sumber cost belum valid.
- `materialCostActual = 0` wajib diberi penjelasan: cek cost bahan atau snapshot material.
- `laborCostActual = 0` wajib diberi penjelasan: cek payroll Work Log.
- `totalCostActual = 0` wajib diberi penjelasan bahwa HPP belum valid untuk analisis.
- Jika `costPerGoodUnit = 0` sementara `goodQty > 0`, tampilkan warning agar user tidak membaca HPP/unit sebagai valid.
- Draft payroll tidak boleh dihitung sebagai biaya tenaga kerja final untuk HPP.
- Work Log completed tetap tidak boleh diproses ulang hanya untuk memperbaiki display cost.

### Fase D - Dashboard Read-only Control Center
- Dashboard adalah read-only operational control center.
- Dashboard tidak boleh menulis/mengubah stok, sales, PO, Work Log, payroll, expense, income, HPP, planning, atau laporan.
- Struktur Dashboard final maksimal 5 section: Prioritas Hari Ini, Fokus Produksi, Stok Kritis, Keuangan Ringkas, dan Aktivitas Terbaru.
- Dashboard tidak boleh memakai table besar atau horizontal scroll sebagai layout utama.
- List Dashboard maksimal 5 item, kecuali planning prioritas maksimal 3 item.
- Keuangan Dashboard hanya ringkasan monitoring; Profit Loss tetap source final laporan laba/rugi.
- Dashboard wajib punya last updated dan refresh yang hanya reload data summary.
- Jika payroll paid sudah masuk expense atau ada cost 0, Dashboard hanya menampilkan catatan/warning, bukan angka final yang misleading.

### Fase E - Report dan Export Standard
- Export final laporan harus XLSX, bukan data mentah.
- Header harus manusiawi, sheet name jelas, tanggal rapi, Rupiah rapi, dan angka memakai format Indonesia.
- Stock Report wajib mencakup sumber stok aktif yang relevan: bahan baku, semi-finished, dan produk jadi.
- HPP Analysis boleh diekspor ke XLSX tanpa mengubah rumus HPP.
- Export HPP wajib membawa kolom validasi cost agar warning cost 0 tetap terlihat saat file dibuka.
- Payroll Report boleh mempertahankan CSV legacy untuk compatibility, tetapi XLSX adalah output final yang lebih rapi.

### Fase F - Legacy Duplicate Cleanup
- Folder/file duplicate seperti `src/src/**` tidak boleh diedit untuk patch baru.
- File duplicate legacy hanya boleh dihapus setelah grep/import/route check membuktikan tidak dipakai runtime.
- Route aktif Dashboard harus tetap memakai `src/pages/Dashboard/*`.
- Service aktif Planning harus tetap memakai `src/services/Produksi/productionPlanningService.js`.
- Jika ada penghapusan legacy, wajib ada catatan `DELETE_LIST.md` atau dokumentasi setara yang menjelaskan bukti dan file yang dihapus.

### Final Guard Anti Double Payroll / Expense
- Work Log completed wajib membuat payroll line secara idempotent per Work Log + Step + Operator.
- Payroll paid wajib membuat expense secara idempotent dengan `sourceModule=production_payroll` dan `sourceId=payrollId`.
- Profit Loss membaca payroll lewat `expenses`, bukan langsung dari `production_payrolls`, agar tidak double count.
- Expense payroll tidak boleh dihapus otomatis saat payroll paid dibatalkan sebelum business rule rollback disepakati.

## 15. Rule Supplier & Raw Material

### 15.1 Supplier sebagai katalog vendor/restock
- Supplier adalah master/katalog vendor untuk referensi restock.
- Supplier boleh menyimpan daftar material yang dijual melalui `materialDetails`.
- `materialDetails.productLink`, `materialDetails.referencePrice`, dan `materialDetails.note` hanya informasi restock.
- Supplier tidak boleh memasang supplier baru ke Raw Material berdasarkan katalog `materialDetails`.
- Saat master Supplier diedit, sistem boleh memperbarui snapshot `supplierName` dan `supplierLink` hanya pada Raw Material yang sudah memiliki `supplierId` sama.
- Saat master Supplier dihapus, sistem boleh mengosongkan snapshot supplier hanya pada Raw Material yang masih menunjuk `supplierId` tersebut.
- Tidak ada tombol atau flow aktif “Sinkronkan Bahan” dari Supplier ke Raw Material.

### 15.2 Raw Material memilih supplier manual
- Raw Material tetap source utama stok bahan.
- Supplier pada Raw Material dipilih manual dari form Raw Material.
- Snapshot manual yang boleh disimpan di raw material:
  - `supplierId`
  - `supplierName`
  - `supplierLink`
- Data lama dengan snapshot supplier tetap aman dibaca; snapshot boleh ikut diperbarui/dibersihkan hanya melalui cascade berdasarkan `supplierId` yang sudah dipilih manual.

### 15.3 Batas ke Purchases
- Purchases boleh memakai supplier sebagai referensi vendor.
- Harga aktual pembelian tetap berasal dari transaksi pembelian.
- Harga referensi supplier tidak boleh menggantikan `actualUnitCost` atau harga aktual pembelian.
- Klik link supplier/product restock tidak membuat purchase dan tidak mengubah stok.

## 16. Rule Restock Assistant

- Restock Assistant hanya membantu navigasi dan prefill data, bukan membuat transaksi otomatis.
- Dashboard boleh menampilkan action cepat untuk bahan baku stok menipis/kritis:
  - buka link produk terakhir dari Purchases terakhir;
  - buka form Purchases dengan material/supplier/link produk terisi awal;
  - buka menu Supplier dengan filter material untuk membandingkan supplier.
- Klik action Restock Assistant tidak boleh mengubah stok, kas, expense, saving, laporan, atau supplier.
- Stok/kas/expense hanya berubah setelah user menyimpan transaksi di halaman Purchases.
- Supplier terakhir dibeli dan link produk terakhir wajib berasal dari transaksi Purchases terakhir untuk bahan tersebut.
- Jika belum ada purchase/link produk, UI harus menampilkan fallback/empty state aman dan tidak boleh memakai link toko supplier sebagai link produk utama.
- Menu Supplier tetap menjadi tempat melihat semua supplier, harga referensi, link produk katalog, dan catatan supplier.

## 15. Rule Final Stok Varian

- `currentStock` adalah stok utama yang dipakai per varian.
- `stock` tetap wajib disimpan sebagai alias kompatibilitas dan nilainya harus sama dengan `currentStock`.
- `reservedStock` wajib angka aman dan tidak boleh membuat available negatif.
- `availableStock` wajib dihitung dari `currentStock - reservedStock` dengan batas minimum 0.
- Semua writer varian wajib memakai helper pusat `variantStockNormalizer` atau helper lama yang sudah delegasi ke helper pusat.
- Master item bervarian wajib menyimpan `currentStock`, `stock`, `reservedStock`, dan `availableStock` berdasarkan total varian.
- Reset/Maintenance hanya alat audit/repair/development, bukan flow harian user untuk menjaga stok tetap sinkron.

## 17. Rule Reset & Maintenance Data Aman

- Supplier adalah protected master data dan collection `supplierPurchases` tidak boleh ikut reset default.
- Reset/Maintenance hanya untuk admin/development/testing, bukan flow harian user.
- Reset transaksi boleh menghapus data transaksi/testing sesuai scope, tetapi tidak boleh menghapus Supplier, Raw Material, Product, Customer, BOM/setup, atau master penting lain secara default.
- Reset Supplier hanya boleh dibuat sebagai opsi destructive developer terpisah dengan preview, warning, dan konfirmasi eksplisit; tidak boleh menjadi bagian dari reset default.
- Preview reset wajib menampilkan collection yang akan dihapus dan master yang dilindungi.
- Data test wajib memakai marker `isTestData: true`, `sourceModule: "dev_test_seed"`, dan `createdBy: "dev_seed"`.
- Hapus Data Test hanya boleh menghapus dokumen bermarker test; data normal tanpa marker tidak boleh ikut terhapus.
- Repair stok tetap hanya menyamakan field turunan dan tidak boleh membuat inventory log palsu.

## 19. Rule Purchases Supplier Restock Prefill

- Form Purchases boleh membaca katalog Supplier `materialDetails` secara read-only untuk mengisi awal Link Produk dan Harga Supplier Tercatat.
- Link Produk di Purchases berasal dari `materialDetails[].productLink` supplier yang dipilih dan materialId yang cocok; link produk bahan lain tidak boleh dipakai.
- Harga Supplier Tercatat berasal dari katalog Supplier yang dipilih dan hanya menjadi harga pembanding per satuan stok.
- Harga Supplier Tercatat tidak boleh menjadi harga aktual pembelian, tidak boleh menjadi `actualUnitCost`, dan tidak boleh mengubah kas/expense secara langsung.
- Harga aktual pembelian tetap berasal dari subtotal transaksi, ongkir, diskon ongkir, voucher/potongan, dan biaya layanan.
- `totalStockIn` tetap dihitung dari `Qty Beli × Konversi Supplier` untuk bahan baku.
- Total Pembanding Supplier di Purchases memakai komponen katalog supplier: `Qty Beli × Harga Barang Supplier + Ongkir Default Supplier + Biaya Layanan Default Supplier - Diskon Default Supplier`; jangan menggandakan ongkir/admin dengan mengalikan harga per satuan stok saat Qty Beli lebih dari 1.
- Supplier dropdown pada pembelian bahan baku harus memprioritaskan supplier yang menyediakan material tersebut; jangan fallback diam-diam ke semua supplier.
- Supplier tetap katalog vendor/restock dan tidak otomatis menulis ke Raw Material.

## 20. Rule Katalog Restock Supplier

- Supplier adalah katalog vendor/restock, bukan transaksi pembelian.
- Field kategori/keterangan supplier lama hanya legacy read-only dan bukan input utama flow restock.
- Setiap `materialDetails` supplier boleh menyimpan konteks restock: link produk, tipe pembelian, satuan beli, qty per pembelian, konversi ke satuan stok, satuan stok, harga barang supplier, ongkir estimasi, biaya admin, diskon, dan catatan.
- Harga Estimasi Supplier / Satuan Stok dihitung dari katalog supplier sebagai pembanding: `(harga barang + ongkir + biaya admin - diskon) / total stok hasil konversi`.
- Harga Estimasi Supplier bukan harga aktual pembelian, bukan `actualUnitCost`, dan tidak boleh membuat kas/expense/laporan berubah.
- Purchases boleh memakai katalog Supplier untuk prefill Link Produk, Satuan Beli, Konversi, dan Harga Supplier Tercatat, tetapi user tetap wajib mengisi transaksi aktual dan klik Simpan.
- Supplier tetap tidak boleh otomatis memasang supplier ke Raw Material berdasarkan `materialDetails`.

## 21. Rule Stok Masuk Purchases dari Konversi Supplier

- Purchases wajib menampilkan **Stok Masuk total** sebagai informasi utama, bukan menjadikan **Konversi Supplier** sebagai input utama/editable.
- Untuk bahan baku, rumus final tetap: `Stok Masuk = Qty Beli × Konversi Supplier`.
- Konversi Supplier berasal dari katalog Supplier `materialDetails.conversionValue`, bersifat read-only di Purchases, dan hanya menjadi sumber hitung stok masuk.
- Qty Beli boleh diubah user dan hanya boleh mengubah Stok Masuk, subtotal default jika belum diedit manual, dan ringkasan pembanding.
- Perubahan Qty Beli tidak boleh mereset Supplier, Link Produk Restock, purchaseType, biaya supplier, atau Harga Supplier Tercatat.
- Reject/selisih barang setelah diterima ditangani lewat Penyesuaian Stok agar audit stok tetap jelas, bukan dengan mengubah konversi di Purchases.
- Selisih Hemat tetap dihitung dari `Total Pembanding Supplier - Total Aktual Pembelian` dan hanya menjadi informasi efisiensi, bukan pengurang kas.

## 22. Rule Atomic Save Pembelian

Status: **AKTIF + GUARDED**.

Saat user klik **Simpan Pembelian**, flow aktif wajib menjaga purchase, stok masuk, inventory log, dan expense/cash out sebagai satu rangkaian konsisten.

Ketentuan wajib:
- validasi item, supplier, varian, tanggal, Qty Beli, Stok Masuk, dan Total Aktual dilakukan sebelum write pertama;
- Stok Masuk tetap memakai rule final `Qty Beli × Konversi Supplier`;
- Total Aktual tetap memakai `Subtotal Barang + Ongkir + Biaya Layanan - Diskon Ongkir - Voucher/Potongan`;
- `actualUnitCost = Total Aktual / Stok Masuk`;
- saving/selisih hemat tetap hanya metadata efisiensi dan tidak mengurangi cash out;
- expense pembelian wajib memakai source reference `sourceModule: purchases` dan `sourceId: purchaseId` agar tidak double;
- inventory log pembelian wajib punya `referenceType: purchase` dan `referenceId` dari purchase yang sama;
- jika transaksi gagal sebelum commit, data tidak boleh tersimpan sebagian.

Catatan legacy:
- flow lama yang menyimpan purchase terlebih dahulu lalu update stok/log/expense satu per satu dianggap rawan partial write;
- flow tersebut tidak boleh dihidupkan kembali tanpa alasan teknis kuat dan test regression.

## 23. Rule Stock Management & Adjustment Guarded — 2026-04-26

Status: **AKTIF + GUARDED**.

- Stock Management adalah halaman audit log + Penyesuaian Stok resmi.
- Membuka Stock Management tidak boleh membuat mutasi stok apa pun.
- Tabel Riwayat Pergerakan Stok wajib fokus pada: Tanggal, Arah, Sumber, Item, Qty, Referensi Audit, dan Catatan.
- Kolom generik `Stok` tidak boleh ditampilkan jika snapshot before/after belum reliable untuk semua log.
- Jangan mengisi kolom stok historis memakai stok saat ini, karena itu bukan audit history.
- Jika semua writer inventory log nanti sudah konsisten menyimpan snapshot, kolom boleh kembali dengan label eksplisit seperti `Stok Setelah` atau `Stok Sebelum/Sesudah`.
- Catatan log harus ringkas di tabel; catatan lengkap boleh tersedia lewat tooltip/detail.
- Submit Penyesuaian Stok wajib menjaga stock adjustment, mutasi stok, dan inventory log sebagai satu rangkaian konsisten.
- Area ini tidak boleh dipakai untuk hitung ulang stok dari semua transaksi saat halaman dibuka.

## 24. Rule Login, Role, dan Manajemen User Internal - Fase A

Status: **DESAIN DOKUMENTASI + GUARDED**. Source code login, route guard, sidebar guard, User Management, dan Firestore Rules belum diubah pada fase ini.

### 24.1 Prinsip akses pengguna

- Login/role hanya mengatur akses aplikasi; tidak boleh mengubah rumus stok, kas, pembelian, retur, penjualan, produksi, payroll, HPP, atau laporan.
- Dashboard tetap read-only untuk semua role yang diizinkan masuk.
- Supplier tetap katalog restock/vendor, bukan transaksi dan tidak boleh membuat purchase otomatis.
- Reset & Maintenance adalah area destructive/repair dan hanya boleh untuk `super_admin`.
- User biasa tidak boleh membuka halaman admin lewat URL langsung; hide menu saja tidak cukup.
- User inactive tidak boleh masuk aplikasi.
- Administrator tidak boleh menaikkan role dirinya sendiri menjadi `super_admin` dan tidak boleh mengubah user `super_admin`.
- Firestore Rules production wajib mengikuti Auth/Role; UI guard saja tidak cukup untuk keamanan data real.

### 24.2 Role awal

| Role | Scope utama | Batasan wajib |
|---|---|---|
| `super_admin` | Akses semua menu, semua fitur, semua master, semua laporan, Reset & Maintenance, dan Manajemen User. | Tetap wajib mengikuti business rules transaksi/stok/kas/produksi. |
| `administrator` | Akses operasional dan laporan sesuai matrix; boleh membuat/mengelola user biasa. | Tidak boleh membuat/mengubah `super_admin`, tidak boleh akses Reset & Maintenance, tidak boleh menghapus data sistem sensitif. |
| `user` | Akses operasional harian sesuai matrix. | Tidak boleh Manajemen User, Reset & Maintenance, pengaturan role, atau akses admin langsung dari URL. |

### 24.3 Konsep akun internal

- User tidak login dengan Google.
- User tidak perlu memakai email asli sebagai identitas utama.
- Akun dibuat dari dalam sistem oleh `super_admin` atau `administrator` melalui menu Manajemen User pada fase implementasi berikutnya.
- User login memakai username dan password internal sistem.
- Password tidak boleh disimpan plaintext di Firestore.
- Password tidak boleh divalidasi langsung dari frontend untuk production.
- Strategi teknis yang direkomendasikan untuk fase coding berikutnya adalah Firebase Auth Email/Password dengan identifier internal tersembunyi, misalnya `username@ims.local`, ditambah profile role di Firestore `system_users/{uid}`.
- Jika nanti create user dari aplikasi butuh backend trusted, gunakan Cloud Functions callable/Admin SDK pada fase terpisah; jangan memakai `functions/index.js` lama tanpa audit karena file tersebut berisi trigger stok legacy.

### 24.4 Access matrix awal menu/route

Matrix ini adalah desain awal sebelum implementasi. Jika ada kebutuhan operasional berbeda, ubah dokumen ini dulu sebelum coding.

| Area menu/route | `super_admin` | `administrator` | `user` | Catatan guard |
|---|---|---|---|---|
| Dashboard | Read | Read | Read | Tetap read-only, tidak menulis Firestore. |
| Master Data - Products | Full CRUD | Create/Edit/Read | Read / limited edit | Delete destructive sebaiknya `super_admin`. |
| Master Data - Raw Materials | Full CRUD | Create/Edit/Read | Read | Stok/cost rawan regression; delete guarded. |
| Master Data - Categories | Full CRUD | Create/Edit/Read | Read | Delete guarded. |
| Master Data - Supplier | Full CRUD | Create/Edit/Read | Read | Supplier tetap katalog restock, bukan transaksi. |
| Master Data - Customers | Full CRUD | Create/Edit/Read | Create/Edit/Read | User operasional boleh input customer. |
| Pricing Rules | Full CRUD | Read only / no access | No access | Berpengaruh ke harga; guarded. |
| Stock Management | Full access | Read | Read | Audit log, tidak boleh mutasi saat dibuka. |
| Stock Adjustment | Allowed | Optional setelah disetujui | No access | Awal paling aman: `super_admin` only. |
| Purchases | Full CRUD | Create/Edit/Read | Create/Edit/Read | Delete/cancel destructive harus guarded. |
| Sales | Full CRUD | Create/Edit/Read | Create/Edit/Read | Delete/cancel destructive harus guarded. |
| Returns | Full CRUD | Create/Edit/Read | Create/Edit/Read terbatas | Retur mengubah stok/log; destructive guarded. |
| Cash In | Full CRUD | Create manual + Read | Create manual + Read terbatas | Income otomatis dari sales tidak boleh dihapus manual oleh user biasa. |
| Cash Out | Full CRUD | Create manual + Read | Create manual + Read terbatas | Expense otomatis dari purchases/payroll guarded. |
| Production Planning | Full CRUD | Create/Edit/Read | Read / input terbatas | Planning tidak mutasi stok. |
| Production Orders | Full CRUD | Create/Edit/Read | Create/Edit/Read terbatas | Lifecycle produksi tetap mengikuti rule existing. |
| Work Log Produksi | Full CRUD | Create/Edit/Read | Create/Edit/Read | Complete Work Log tetap guarded anti-double. |
| Production Setup/BOM/Step | Full CRUD | Read / limited edit | No access | Setup memengaruhi produksi dan HPP. |
| Payroll Produksi | Full CRUD | Read only / no access | No access | Payroll memengaruhi expense/HPP. |
| HPP Analysis | Full access | Read only / no access | No access | Cost sensitif dan harus final payroll only. |
| Reports | Full access | Read sesuai modul | Read terbatas | Laba rugi/payroll/HPP sebaiknya admin guarded. |
| Reset & Maintenance | Full access | No access | No access | `super_admin` only; bukan flow harian. |
| Manajemen User | Full access | Kelola user biasa | No access | Administrator tidak boleh ubah `super_admin` atau dirinya menjadi `super_admin`. |

### 24.5 Field profile user yang disarankan

Collection yang disarankan untuk fase berikutnya: `system_users/{uid}`.

Field minimal:
- `authUid`
- `username`
- `usernameLower`
- `displayName`
- `role`: `super_admin`, `administrator`, atau `user`
- `status`: `active` atau `inactive`
- `createdAt`
- `updatedAt`
- `createdBy`
- `updatedBy`
- `lastLoginAt`
- `mustChangePassword` jika diperlukan

Field yang tidak boleh disimpan:
- password plaintext
- password hash yang dibuat/divalidasi frontend
- token rahasia
- secret Firebase/Admin SDK

### 24.6 Seed super_admin pertama

Sebelum route guard dan Firestore Rules final diaktifkan, `super_admin` pertama wajib dibuat dulu agar owner tidak terkunci.

Urutan desain:
1. Aktifkan strategi Auth yang dipilih pada fase coding.
2. Buat akun Auth internal pertama untuk owner.
3. Buat dokumen `system_users/{uid}` untuk UID tersebut.
4. Set `role = "super_admin"` dan `status = "active"`.
5. Baru aktifkan route/menu guard dan Firestore Rules berbasis role.


---

## 25. Final Lock Login, Role, dan Manajemen User Internal - Fase E sampai H

Status: **AKTIF + GUARDED**. Source Auth/Role/User Management sudah memiliki pondasi aktif, tetapi tetap tidak mengubah flow stok, kas, pembelian, retur, produksi, payroll, HPP, dashboard, atau laporan.

### 25.1 Role final awal

| Role | Akses utama | Batasan wajib |
|---|---|---|
| `super_admin` | Semua menu, semua route, Reset & Maintenance, dan Manajemen User. | Tidak boleh mengabaikan business rules transaksi/stok/kas/produksi. Tidak boleh menonaktifkan dirinya sendiri lewat Manajemen User. |
| `administrator` | Operasional, laporan sesuai matrix, dan Manajemen User untuk user biasa. | Tidak boleh membuat/mengubah `super_admin`, tidak boleh mengubah administrator lain, tidak boleh akses Reset & Maintenance. |
| `user` | Operasional dasar sesuai matrix. | Tidak boleh Manajemen User, Reset & Maintenance, route admin/sistem sensitif, finance/report sensitif sesuai matrix awal. |

### 25.2 Manajemen User internal

- Manajemen User memakai collection `system_users/{uid}` sebagai profile internal.
- Firebase Auth tetap menjadi sumber session/password.
- Halaman Manajemen User pada Fase E mengelola **profile, role, dan status**, bukan membuat password Auth secara langsung.
- Untuk sementara, Auth user baru masih dibuat manual di Firebase Console lalu UID-nya dimasukkan ke profile `system_users`.
- Password tidak boleh disimpan plaintext di Firestore.
- Password tidak boleh divalidasi langsung dari Firestore/frontend.
- User inactive tidak boleh masuk aplikasi utama.
- User tanpa profile atau role valid tidak boleh masuk aplikasi utama.
- Role tidak dikenal harus default deny.

### 25.3 Guard role yang wajib dipertahankan

- Reset & Maintenance hanya `super_admin`.
- User Management hanya `super_admin` dan `administrator`.
- Administrator hanya boleh membuat/mengelola user biasa.
- Administrator tidak boleh membuat/mengubah `super_admin`.
- Administrator tidak boleh menaikkan dirinya sendiri menjadi `super_admin`.
- Tidak ada role yang boleh mengubah role/status dirinya sendiri lewat Manajemen User.
- Delete user tidak dibuat pada fase ini; gunakan status `inactive` agar audit profile tetap ada.

### 25.4 Firestore Rules/Auth alignment

- Firestore Rules final harus membaca `request.auth.uid` dan profile `system_users/{uid}`.
- User harus punya profile `system_users/{uid}` dengan `status = active` agar bisa read/write data aplikasi.
- `system_users` harus guarded: user tidak boleh menaikkan role sendiri, administrator tidak boleh mengubah `super_admin`, dan delete profile user harus diblok.
- Rules baseline Fase F boleh mengizinkan read/create/update data aplikasi untuk user aktif agar flow existing tidak langsung rusak, tetapi delete destructive sebaiknya hanya `super_admin`.
- Role guard UI tidak menggantikan Firestore Rules.
- Rules tetap perlu dipublish manual melalui Firebase Console atau Firebase CLI setelah diverifikasi.

### 25.5 Boundary yang tidak berubah

Patch Auth/Role/User Management tidak boleh mengubah:
- rumus stok;
- Purchases;
- Returns;
- Sales;
- Stock Management / Stock Adjustment;
- Supplier sebagai katalog restock;
- Production;
- Payroll;
- HPP;
- Reports/export;
- Dashboard read-only.

### 25.6 Legacy / cleanup candidate

- `functions/index.js` lama tetap **LEGACY/GUARDED** sampai diaudit karena berpotensi berisi trigger stok lama.
- Input manual Auth UID pada Manajemen User adalah **CLEANUP CANDIDATE** setelah Cloud Functions/Admin SDK create-user aman dibuat.
- Action-level permission per tombol create/edit/delete masih bisa diperketat sebagai task terpisah.
