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

### 2.2A UX pemilihan item dan referensi channel
- Form Penjualan tetap boleh menjual produk jadi dan bahan baku, tetapi UI wajib memisahkan pilihan Jenis Item agar dua sumber item tidak tercampur dalam satu dropdown panjang.
- Pilihan Jenis Item hanya untuk filter UI; payload final sale tetap menyimpan `collectionName`, `itemId`, `itemName`, `typeLabel`, `variantKey`, `variantLabel`, dan `stockSourceType` sesuai flow aktif.
- `referenceNumber` bersifat opsional dan relevan untuk channel online/marketplace seperti Shopee, Tokopedia, TikTok Shop, Lazada, Instagram, dan Lainnya.
- Offline dan WhatsApp tidak wajib memakai resi/order/reference; saat channel berubah ke Offline/WhatsApp, field reference harus dikosongkan dan tidak aktif.
- WhatsApp hanya dianggap non-reference channel; jangan otomatis mengubah status/income timing WhatsApp menjadi Offline tanpa keputusan business rule terpisah.

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
- memilih item dari `raw_materials`, `semi_finished_materials`, atau `products`;
- memilih varian jika item bervarian, termasuk Semi Finished bervarian agar stok masuk ke bucket `variantKey` dan tidak fallback ke master/default;
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
- Selector item Sales boleh difilter per Jenis Item, tetapi filter UI tidak boleh mengubah payload final atau source stok (`collectionName` + `itemId`).
- Field reference/resi wajib tetap opsional dan hanya aktif untuk channel yang relevan; Offline/WhatsApp tidak boleh memaksa reference tersimpan.
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

### 15.1 Variant conversion aman

- Edit master biasa tetap tidak boleh menjadi jalur mutasi stok.
- Data lama non-varian boleh mulai memakai varian hanya jika `stock/currentStock`, `reservedStock`, dan `availableStock` semuanya 0.
- Varian baru pada item existing wajib dibuat dengan `stock/currentStock/reservedStock/availableStock = 0`.
- Item lama yang masih punya stok master atau reserved stock tidak boleh dikonversi otomatis ke varian; user harus memakai Stock Management / Stock Adjustment / transaksi resmi bila stok perlu dialihkan.
- `variantKey` existing tidak boleh berubah saat nama/label varian diganti karena itu adalah identitas bucket stok/reference transaksi.
- Hapus varian wajib ditolak jika varian masih punya `stock`, `currentStock`, `reservedStock`, atau `availableStock` yang belum aman.

### 15.2 Pricing Rules optional

- Pricing Rules adalah fitur harga opsional, bukan blocker create master Product/Raw Material.
- Mode create default adalah `manual`.
- `pricingRuleId` hanya wajib jika user memilih `pricingMode = rule`.
- Jika `pricingMode = manual`, `pricingRuleId` boleh kosong/null dan harga manual tetap valid.

## 17. Rule Reset & Maintenance Data Aman

- Supplier adalah protected master data dan collection `supplierPurchases` tidak boleh ikut reset default.
- Reset/Maintenance hanya untuk admin/development/testing, bukan flow harian user.
- Reset transaksi boleh menghapus data transaksi/testing sesuai scope, tetapi tidak boleh menghapus Supplier, Raw Material, Product, Customer, BOM/setup, atau master penting lain secara default.
- Reset Supplier hanya boleh dibuat sebagai opsi destructive developer terpisah dengan preview, warning, dan konfirmasi eksplisit; tidak boleh menjadi bagian dari reset default.
- Preview reset wajib menampilkan collection yang akan dihapus dan master yang dilindungi.
- Data test wajib memakai marker `isTestData: true`, `sourceModule: "dev_test_seed"`, dan `createdBy: "dev_seed"`.
- Hapus Data Test hanya boleh menghapus dokumen bermarker test; data normal tanpa marker tidak boleh ikut terhapus.
- Repair stok tetap hanya menyamakan field turunan dan tidak boleh membuat inventory log palsu.
- Reset destructive wajib membuat audit log awal sebelum delete; jika log awal gagal karena rules/permission, reset tidak boleh dijalankan.
- Reset destructive wajib melakukan preflight sebelum write pertama: validasi mode, module, allowlist collection rules, protected master data, baseline restore, keberadaan item baseline, dan estimasi jumlah operasi.
- Reset destructive dari client hanya boleh berjalan jika seluruh delete transaksi dan update stok bisa masuk satu batch aman; jika melebihi batas aman client, reset wajib diblokir agar tidak partial delete.
- Jika reset berhasil tetapi update audit log akhir gagal, UI harus memisahkan error audit dari hasil reset dan tidak boleh menampilkan reset seolah gagal.

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

## 21.1 Rule UI Preview Stok Aktual dan Breakdown Purchases

Status: **AKTIF + GUARDED**.

- Modal Purchases wajib menampilkan preview stok aktual sebelum restock setelah user memilih item dan/atau varian.
- Untuk item non-varian, preview stok membaca stok master: `currentStock`, `reservedStock`, dan `availableStock`.
- Untuk item bervarian, preview stok wajib memakai stok varian yang dipilih, bukan total master yang menjumlah semua varian.
- Jika item bervarian belum memilih varian, UI wajib meminta user memilih varian terlebih dahulu sebelum menampilkan stok aktual varian.
- Preview stok hanya read-only untuk membantu keputusan restock dan tidak boleh menjadi sumber mutasi stok, expense, inventory log, supplier catalog, atau payload submit.
- Ringkasan perbandingan supplier boleh menampilkan breakdown `subtotalItems`, `shippingCost`, `serviceFee`, `shippingDiscount`, `voucherDiscount`, `totalActualPurchase`, `totalReferencePurchase`, `actualUnitCost`, dan `purchaseSaving`, tetapi tidak boleh memindahkan atau mengubah formula kalkulasi existing.
- `totalActualPurchase` tetap dasar expense/cash-out; `purchaseSaving` tetap informasi efisiensi dan bukan pengurang kas.

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

## 24. Rule Final Auth, Role, dan Manajemen User — 2026-05-01

Status: **AKTIF + GUARDED**. Section ini menggantikan catatan desain/migrasi lama setelah login internal stabil di domain `@ziyocraft.com`.

### 24.1 Prinsip Auth final

- Firebase Authentication adalah source of truth untuk password dan session.
- Firestore `system_users/{uid}` adalah source of truth untuk profile internal, role, status, dan metadata user IMS.
- Auth email internal aktif wajib memakai format `username@ziyocraft.com`.
- Login IMS tetap memakai username di UI; mapping ke email internal dilakukan oleh Auth layer.
- User tanpa dokumen `system_users/{firebaseAuthUid}` wajib ditolak masuk aplikasi utama.
- User dengan `status = inactive` wajib ditolak masuk aplikasi utama.
- Role tidak dikenal wajib default deny.

### 24.2 Role aktif final

| Role | Status | Akses utama | Batasan wajib |
|---|---|---|---|
| `administrator` | **AKTIF / GUARDED** | Admin utama aplikasi. Mengakses menu sistem, Manajemen User, Reset & Maintenance, dan menu operasional sesuai route guard. | Tetap wajib mengikuti business rules stok, kas, pembelian, penjualan, produksi, payroll, HPP, dan laporan. Tidak boleh mengubah role/status dirinya sendiri dari Manajemen User. |
| `user` | **AKTIF / GUARDED** | User operasional terbatas sesuai access matrix. | Tidak boleh membuka Manajemen User, Reset & Maintenance, route sistem sensitif, atau melakukan manajemen role/profile user lain. |

Role `super_admin` adalah **LEGACY / REMOVED FROM ACTIVE FLOW**. Role ini tidak boleh dibuat, dipilih, disimpan sebagai target profile baru, atau dipakai sebagai compatibility aktif setelah cleanup data selesai.

### 24.2.1 Access matrix menu final

Status: **AKTIF / GUARDED**. Matrix ini menyelaraskan `roleAccess.js`, `sidebarMenu.js`, dan route guard. Perubahan matrix hanya membatasi visibilitas/akses menu; tidak mengubah business rules, kalkulasi, schema, atau flow transaksi.

| Area menu | Administrator | User | Catatan guard |
|---|---:|---:|---|
| Dashboard | Ya | Ya | Shared read/summary sesuai route aktif. |
| Master Data | Ya | Tidak | Admin-only karena dapat mengubah referensi bisnis seperti produk, raw materials, kategori, supplier, customer, dan pricing. |
| Pricing Rules | Ya | Tidak | Admin-only karena memengaruhi harga/margin. |
| Stock Control | Ya | Ya | Operasional harian untuk cek/kelola stok sesuai flow aktif. |
| Production Operation | Ya | Ya | Meliputi Production Planning, Order Produksi, dan Work Log Produksi. |
| Production Setup | Ya | Tidak | Admin-only karena mengubah setup produksi, BOM, semi product, karyawan, dan template. |
| Cost & Analysis | Ya | Tidak | Admin-only karena berhubungan dengan payroll, HPP, dan analisis biaya. |
| Transaksi | Ya | Ya | Operasional harian Purchases, Sales, dan Returns. |
| Kas & Biaya | Ya | Tidak | Admin-only karena data finance sensitif. |
| Sistem | Ya | Tidak | Manajemen User dan Reset & Maintenance selalu admin-only. |
| Laporan | Ya | Tidak | Admin-only karena laporan dapat memuat finance, payroll, HPP, dan laba/rugi. |

User biasa tidak boleh melihat menu sensitif di sidebar dan tidak boleh membuka route sensitif lewat URL langsung. Route guard tetap wajib selaras dengan sidebar guard.

### 24.3 Flow create profile user aktif

```text
Firebase Console > Authentication
-> administrator membuat Auth user manual
-> email Auth wajib username@ziyocraft.com
-> administrator copy UID Firebase Auth
-> IMS > Sistem > Manajemen User > Tambah Profile User
-> administrator tempel UID ke field Auth UID
-> userService.createManualUserProfile()
-> Firestore membuat system_users/{authUid}
-> tabel Manajemen User reload
-> AuthProvider membaca system_users/{uid} saat user login
```

Halaman Manajemen User hanya membuat/mengelola profile Firestore. Frontend tidak membuat Firebase Auth user, tidak mengubah password Firebase Auth, dan tidak menghapus Firebase Auth user.

### 24.4 Field profile user aktif

Field profile yang disimpan di `system_users/{uid}`:

- `authUid`
- `username`
- `usernameLower`
- `displayName`
- `role`: hanya `administrator` atau `user`
- `status`: `active` atau `inactive`
- `createdAt`
- `updatedAt`
- `createdBy`
- `updatedBy`
- `lastLoginAt` bila tersedia

Field yang tidak boleh disimpan di Firestore:

- password sementara
- password plaintext
- password hash buatan frontend
- token rahasia
- credential Admin SDK
- service account

### 24.5 Guard Manajemen User

- Username wajib unik melalui `usernameLower`.
- Auth UID wajib unik karena path profile adalah `system_users/{authUid}`.
- `administrator` boleh membuat/mengelola profile role aktif `administrator` dan `user`.
- `user` tidak boleh membuka Manajemen User dan tidak boleh membuat/mengelola profile user.
- User tidak boleh mengubah role/status dirinya sendiri dari Manajemen User.
- Tombol **Hapus Profile** hanya menghapus dokumen Firestore `system_users/{uid}`.
- Tombol **Hapus Profile** tidak menghapus Firebase Authentication user.
- Hapus profile diri sendiri wajib ditolak.
- Hapus administrator aktif terakhir wajib ditolak oleh service/UI.
- Jika profile Firestore dihapus tetapi Firebase Auth user masih ada, user tersebut tidak bisa masuk IMS sampai profile dibuat lagi.

### 24.6 Firestore Rules final/staged-final

- Firestore Rules wajib berbasis `request.auth != null`.
- Actor profile wajib dibaca dari `system_users/{request.auth.uid}`.
- Role aktif Rules hanya `administrator` dan `user`.
- `system_users` wajib guarded:
  - user login boleh membaca profile sendiri;
  - administrator boleh membaca daftar user;
  - administrator boleh create/update/delete profile user lain;
  - user biasa tidak boleh mengelola profile user lain;
  - delete profile sendiri diblok oleh rules dan service.
- Collection bisnis utama boleh diakses oleh profile aktif sesuai staged-final rules agar modul utama tidak langsung permission denied.
- Fallback untuk collection tidak dikenal harus deny.
- Rules tidak boleh memakai cleanup sementara seperti `allow read, write: if true` atau expiry date sementara sebagai rules final.

### 24.7 Legacy dan cleanup final

- Domain lama `@ims-bunga-flanel.local` adalah **LEGACY** dan tidak boleh menjadi flow aktif baru.
- Profile lama/orphan seperti `admin_legacy` dan `user_legacy` adalah data cleanup lama yang seharusnya sudah tidak ada setelah migrasi selesai.
- Role lama `super_admin` adalah **LEGACY / REMOVED FROM ACTIVE FLOW** dan tidak boleh diaktifkan kembali tanpa task migrasi khusus.
- Flow migrasi UID/domain lama adalah **CLEANUP CANDIDATE** dan tidak boleh menjadi jalur utama setelah akun `admin@ziyocraft.com` dan `user@ziyocraft.com` stabil.

### 24.8 Boundary yang tidak berubah

Patch Auth/User Management dan Rules tidak boleh mengubah rumus stok, Purchases, Returns, Sales, Stock Management / Stock Adjustment, Supplier sebagai katalog restock, Production, Payroll, HPP, Reports/export, Dashboard read-only, Pricing Rules, atau Reset & Maintenance business flow.

## 11. Rule Batch Fix Bug Merge — 2026-05-03

### 11.1 Format angka tanpa desimal
- Tampilan angka, qty, stok, Rupiah, summary, report, dan input UI aktif diarahkan tanpa decimal.
- `formatNumberId`, `formatQuantityId`, `formatPercentId`, dan parser input integer menjadi standar UI.
- Perubahan ini tidak mengubah rumus transaksi, schema Firestore, atau migrasi/backfill data lama.
- Jika suatu hari ada satuan yang wajib decimal secara bisnis, pengecualian harus dibahas eksplisit sebagai business rule baru.

### 11.2 Production Order dan material variant strict
- Jika target/BOM/material memakai varian, preview kebutuhan PO wajib membaca bucket stok varian yang dipilih/terselesaikan.
- Material bervarian tidak boleh fallback diam-diam ke master/default ketika varian tidak ditemukan.
- Start Production dari PO memakai `materialRequirementLines` sebagai kontrak final ke `materialUsages` Work Log.
- Jika kontrak varian PO tidak valid, user harus refresh need/perbaiki BOM sebelum produksi dimulai.

### 11.3 Work Log output stock audit
- Complete Work Log tetap menjaga guard agar output stock tidak diposting dobel.
- Inventory log `production_output_in` baru menyimpan metadata Work Log, PO, step, varian, dan worker/operator jika tersedia.
- Log lama tanpa worker metadata tetap valid dan tidak di-backfill otomatis.

### 11.4 Generic variant label and rename
- Edit nama/label varian existing hanya mengganti label tampilan/metadata.
- `variantKey` tetap menjadi identitas bucket stok/reference.
- `stock`, `currentStock`, `reservedStock`, dan `availableStock` varian tetap dipreserve dari data existing/latest.
- Rename nama/label varian tidak membuat inventory log palsu, tidak memigrasi PO/Work Log lama, dan tidak membuka edit stok langsung dari master.

### 11.5 UI non-business-flow cleanup
- Sidebar nested accordion dan Login UI copy cleanup adalah perubahan UI; keduanya tidak mengubah stok, transaksi, produksi, laporan, AuthContext, role access, Firestore rules, atau schema.

## Update Business Rules — Cash In delete lock dan Sales status tab — 2026-05-03

### Cash In / Pemasukan sebagai ledger aman
- Halaman Pemasukan membaca gabungan `revenues` dan `incomes` sebagai tampilan ledger pemasukan aktif.
- `revenues` tetap menjadi sumber pemasukan manual/lama, sedangkan `incomes` tetap menjadi pemasukan otomatis dari Sales berstatus `Selesai`.
- Menu Pemasukan tidak menyediakan tombol Hapus untuk mengurangi risiko penyalahgunaan dan menjaga audit kas.
- Penghapusan pemasukan tidak boleh dilakukan dari UI Pemasukan biasa tanpa task khusus, audit, dan approval eksplisit.
- Perubahan ini tidak menghapus data lama, tidak mengubah `revenues`, tidak mengubah `incomes`, dan tidak mengubah Profit Loss yang membaca `revenues + incomes + expenses`.

### Sales status tab
- Tabel Sales wajib menampilkan row sesuai tab status aktif.
- Tab `Semua Penjualan` boleh menampilkan semua status.
- Tab `Diproses`, `Dikirim`, `Selesai`, dan `Dibatalkan` hanya boleh menampilkan row dengan status yang sama.
- Search resi/order/reference harus tetap bekerja di dalam batas status tab aktif.
- Guard tab status adalah guard tampilan; tidak boleh mengubah status transition, mutasi stok, income timing, cancel/delete, retur, dashboard, atau reports.


## Update Business Rules — Sales pending income, no-delete Sales, dan selector stok ringkas — 2026-05-03

### Sales pending income display-only
- Sales berstatus `Diproses` dan `Dikirim` boleh dihitung sebagai **Pemasukan Pending** hanya untuk monitoring di halaman Sales.
- Pemasukan Pending adalah estimasi/potensi uang yang belum masuk resmi; nilai ini **tidak boleh** ditulis ke `revenues`, `incomes`, atau collection baru.
- Pemasukan Pending **tidak boleh** tampil sebagai pemasukan resmi di menu Pemasukan / Cash In dan **tidak boleh** masuk Profit Loss.
- Sales berstatus `Selesai` tetap menjadi dasar income resmi sesuai flow aktif.
- Sales berstatus `Dibatalkan` tidak boleh masuk pending income maupun income resmi.
- Offline tetap mengikuti flow aktif yang biasanya otomatis `Selesai`; WhatsApp boleh masuk pending jika statusnya `Diproses`/`Dikirim`, tetapi WhatsApp tidak boleh otomatis dianggap Offline tanpa keputusan business rule terpisah.

### Sales no-delete user action
- Tabel Sales tidak menyediakan tombol **Delete/Hapus** sebagai aksi operasional biasa.
- Jika penjualan tidak jadi, user wajib memakai **Batalkan** agar record transaksi tetap ada dan stok bisa diaudit.
- Row `Diproses` boleh menampilkan aksi `Dikirim` dan `Batalkan`.
- Row `Dikirim` boleh menampilkan aksi `Selesai` dan `Batalkan`.
- Row `Selesai` dan `Dibatalkan` tidak boleh menampilkan aksi Delete/Hapus biasa.
- Hard delete Sales, jika suatu hari dibutuhkan, harus menjadi maintenance flow guarded dengan approval dan audit trail, bukan tombol tabel reguler.

### Sales selector dan info stok
- Selector item Sales boleh memisahkan Produk Jadi dan Bahan Baku melalui field UI **Jenis Item**, tetapi payload akhir tetap memakai `collectionName`, `itemId`, `variantKey`, dan `stockSourceType`.
- Dropdown item/varian cukup menampilkan nama item/varian dan jenis item; detail stok tersedia cukup tampil di panel read-only stok.
- Panel stok read-only hanya informasi snapshot; validasi dan mutasi stok tetap memakai guard `availableStock` dan helper stok aktif.
