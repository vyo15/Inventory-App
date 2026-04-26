# CURRENT STATE & TECH DEBT — IMS Bunga Flanel

Dokumen ini tidak berisi tebakan. Semua poin di bawah berasal dari temuan audit source code saat ini.

## Bagian yang Sudah Terlihat Matang
- struktur route utama sudah cukup rapi
- service layer sudah mulai dipisah untuk master data, pricing, inventory, produksi, dan utilitas
- modul produksi final sudah jauh lebih matang daripada flow legacy
- pricing rules sudah punya fondasi logika yang jelas
- reset data uji sudah cukup canggih karena mendukung baseline dan sinkronisasi field stok
- inventory log sudah menjadi audit trail lintas modul

## Bagian yang Masih Terlihat Transisional

### 1. Field stok lama vs field stok baru
Temuan:
- beberapa service baru sudah menganggap `currentStock` sebagai source of truth aktif
- tetapi masih banyak logic lama yang langsung mengubah `stock`

Risiko:
- tampilan atau logic modul baru dan modul lama bisa berbeda hasil

### 2. Customer collection sudah disatukan
Temuan terkini:
- collection final customer adalah `customers` lowercase
- Master Customer dan Sales membaca sumber yang sama
- `Customers` uppercase harus dianggap legacy/test data, bukan source aktif baru

Risiko tersisa:
- jika masih ada data lama di `Customers` uppercase, data tersebut tidak otomatis dimigrasi
- migrasi customer lama harus menjadi task terpisah dengan preview agar tidak merusak relasi Sales

### 3. Stock Adjustment final sudah memakai helper stok
Temuan terkini:
- form adjustment aktif berada di `StockAdjustmentPanel.jsx`
- submit adjustment memakai `updateInventoryStock()`, bukan `updateDoc(... stock ...)` langsung dari page
- item bervarian wajib memilih varian sebelum submit
- adjustment keluar divalidasi terhadap `availableStock` agar tidak menggerus stok yang sudah reserved

Risiko tersisa:
- log/data adjustment lama yang dibuat sebelum patch bisa belum punya snapshot `availableStockBefore/After`
- route lama atau file lama jangan dihidupkan lagi agar logic adjustment tidak bercabang

### 4. Sales stock safety sudah di-hardening
Temuan terkini:
- create sale memvalidasi `availableStock` master/varian sebelum transaksi disimpan
- kebutuhan item yang sama digabung dulu agar multi-line tidak melewati stok tersedia
- mutasi stok Sales memakai helper stok aktif dan mencegah stok negatif
- jika mutasi stok gagal setelah dokumen sale dibuat, flow melakukan rollback/delete sale baru agar tidak ada sale orphan

Risiko tersisa:
- flow ini masih client-side/best-effort, belum Cloud Function transaction end-to-end
- cancel/delete tetap area guarded karena berhubungan dengan stock revert dan income cleanup

### 5. Laporan/export sudah lebih siap data real
Temuan terkini:
- Stock Report sudah membaca bahan baku, semi-finished, dan produk jadi
- HPP Analysis sudah memiliki export XLSX dengan header manusiawi dan kolom validasi cost
- Payroll Report XLSX memakai filter operator aktif; CSV lama tetap compatibility/legacy

Risiko tersisa:
- laporan stok masih belum menjadi kartu analitik varian/reserved stock yang sangat detail
- export harus tetap dijaga agar tidak kembali menjadi data mentah/object teknis

### 6. Firebase Functions tampak legacy
Temuan:
- `functions/index.js` masih punya trigger lama yang update stok pada `products`
- purchase function bahkan masih mengarah ke `products` saat purchase item dibuat
- tidak terlihat sinkron dengan logic aplikasi aktif yang banyak berjalan di client/service layer dan memakai `raw_materials`

Risiko:
- bila function ini aktif di environment production, ada potensi logic dobel atau salah target

### 7. Flow legacy produksi masih tersisa
Temuan:
- `productionService.js` masih ada
- collection `productions` masih dibersihkan oleh utilitas reset
- route utama saat ini berpusat pada BOM/PO/Work Log, bukan `productions`

Risiko:
- developer baru bisa bingung membedakan flow aktif dan flow lama

## Current State yang Sebaiknya Dianggap Resmi
Untuk dokumentasi saat ini, flow aktif yang paling aman dianggap resmi adalah:
- master data modern
- transaksi pembelian/penjualan/retur
- cash in & cash out
- inventory logs
- pricing rules
- produksi final: BOM → Production Order → Work Log → Payroll → Analisis HPP
- reset utilitas dengan baseline

## Prioritas Tech Debt yang Paling Layak Dibereskan Dulu
1. audit ulang Firebase Functions apakah masih dipakai atau sebaiknya dipensiunkan
2. dokumentasikan resmi bahwa `productions` adalah legacy flow bila masih ditemukan di source lama
3. pertimbangkan Cloud Function/transaction untuk Sales stock safety jika data real sudah besar dan multi-user aktif
4. buat keputusan business rule rollback untuk payroll paid yang sudah membuat expense
5. tingkatkan laporan stok varian/reserved stock jika owner membutuhkan analisis lebih detail

## Definition of Done untuk Perubahan Besar Berikutnya
## Update Current State: Guard Logic Work Log Produksi
Perbaikan terbaru di area produksi menegaskan:
- Work Log load dibuat lebih tahan gangguan jika salah satu referensi produksi gagal dimuat
- query Work Log completed punya fallback agar payroll / HPP tidak mudah ikut gagal karena index/query
- filter referensi PO untuk Work Log sekarang hanya menampilkan PO yang benar-benar masih eligible diproses
- Work Log completed dianggap locked agar patch lain tidak mengubah hasil produksi yang sudah ter-posting

Status current state yang sekarang paling aman dianggap resmi:
- logic inti produksi adalah area sensitif / guarded
- refactor UI lintas modul tidak boleh mengubah contract flow produksi tanpa task khusus produksi

Sebuah task dianggap aman selesai bila:
- route/halaman target berhasil jalan
- stock mutation sinkron
- inventory log tetap tercatat
- collection sumber laporan tetap benar
- flow produksi final tidak rusak
- tidak menambah inkonsistensi schema baru


## Tambahan Current State Batch Prioritas
- `StockReport.jsx` sekarang sebaiknya dianggap kandidat upgrade ke ekspor XLSX profesional, karena CSV mentah terlalu sederhana untuk kebutuhan owner/admin
- `CashOut.jsx` sekarang menerima expense payroll otomatis dari payroll paid dengan guard `sourceModule/sourceId`; rollback otomatis expense payroll masih belum dibuat dan harus diputuskan terpisah
- detail Payroll Produksi dan Work Log masih butuh microcopy agar user tidak salah paham terhadap arti field biaya dan status pembayaran

## Update Cleanup Architecture — 2026-04-25

### Sudah dibereskan pada batch ini
- `StockAdjustmentPanel.jsx` tidak lagi melakukan `updateDoc(... stock: increment(...))` langsung dari page.
- Adjustment keluar sekarang divalidasi terhadap `availableStock`, sehingga reserved stock tidak ikut terpakai oleh koreksi manual.
- Stock Adjustment sekarang memakai `updateInventoryStock()` dan mendukung item bervarian dengan `variantKey` wajib.
- Collection customer sudah disatukan ke `customers` lowercase di Master Customer agar sinkron dengan Sales.
- `inventory_logs` baru memiliki `referenceId`, `referenceType`, dan `details` untuk memudahkan audit trail.
- Stock Management membaca reference dari `details` dan fallback top-level agar log lama tetap tampil.
- File kandidat cleanup yang terbukti tidak di-import sudah ditandai/dihapus dari source patch.

### Status tech debt yang masih perlu diperhatikan
- `StockReport.jsx` masih kandidat upgrade tahap lanjut agar membaca varian/reserved stock lebih detail.
- `updateStock()` dan `updateMasterStockLegacy()` di `inventoryService.js` masih dipertahankan sebagai compatibility wrapper, bukan jalur final baru.
- Flow produksi final tetap guarded dan tidak ikut direfactor pada cleanup stok umum.
- Audit Firebase Functions tidak bisa diverifikasi dari upload `src.zip` dan `docs.zip` ini karena folder functions tidak disertakan.

### Koreksi dokumen lama
Poin lama yang menyebut revert sale masih hanya update `stock` sudah tidak sesuai dengan source terbaru. Sales sekarang memakai `updateInventoryStock()` untuk create sale dan revert cancel/delete.

## Update Karyawan Produksi — 2026-04-25

### Kode karyawan produksi sudah otomatis
Temuan/fix:
- form tambah Karyawan Produksi tidak lagi memakai input manual placeholder `EMP-...`;
- preview kode dibuat otomatis dengan format `DDMMYYYY-XXX`;
- service `productionEmployeesService.js` generate ulang kode saat create untuk menjaga uniqueness;
- counter teknis `production_employee_code_sequences` dipakai untuk mengurangi risiko kode dobel saat ada create paralel.

Risiko tersisa:
- data lama dengan kode `EMP-...` tetap dipertahankan sebagai legacy agar Work Log/Payroll lama tidak rusak;
- edit karyawan tidak melakukan regenerate kode;
- bila ada kebutuhan migrasi kode lama, harus dibuat task migrasi terpisah dan tidak boleh mengubah relasi Work Log/Payroll existing.


## Update Bug Karyawan Produksi Tidak Tampil — 2026-04-25

### Employee tetap data utama halaman
Temuan/fix:
- data karyawan produksi tetap berada di collection `production_employees`;
- halaman Karyawan Produksi sebelumnya rawan kosong bila query pendukung steps/payroll/worklog gagal karena Firestore composite index;
- `ProductionEmployees.jsx` sekarang memuat employee sebagai data utama terlebih dahulu, lalu memuat data pendukung dengan guard `Promise.allSettled()`;
- jika data pendukung gagal, tabel employee tetap tampil dan user mendapat warning bahwa ringkasan pendukung belum lengkap;
- `productionPayrollsService.js` memiliki fallback plain collection untuk query payroll dua `orderBy` yang bisa membutuhkan composite index;
- `productionEmployeesService.js` memiliki fallback plain collection untuk memastikan list employee lama tetap tampil bila order query bermasalah.

Risiko tersisa:
- summary payroll/worklog/assignment bisa terbatas jika data pendukung gagal dimuat;
- composite index Firestore tetap sebaiknya dibuat sesuai link error Firebase agar query utama lebih efisien ketika data sudah besar;
- kode lama seperti `11042026-01` atau `EMP-...` tetap dipertahankan sebagai legacy display code dan tidak dimigrasi otomatis.

## Update UI Regression Produksi — 2026-04-25

- Tabel utama `Production Orders` dan `Work Log Produksi` harus tetap compact agar tombol aksi tidak terdorong ke kanan pada desktop/laptop normal.
- `scroll x` besar pada tabel produksi adalah tech debt UI karena membuat aksi seperti Detail, Refresh Need, Mulai Produksi, Edit, dan Selesaikan sulit dijangkau user.
- Modal `Selesaikan Work Log Produksi` wajib menampilkan konteks estimasi output/hasil sebelum user mengisi Good Qty, Reject Qty, dan Rework Qty.
- Patch UI produksi tidak boleh mengubah handler produksi, status lifecycle, posting stok, payroll, HPP, atau completed guard.

## Update Regression Auto Payroll Produksi — 2026-04-25

Temuan/fix:
- regression sebelumnya membuat Work Log bisa completed tetapi line Payroll Produksi tidak otomatis terbentuk;
- akar masalahnya flow complete hanya posting output/status Work Log, belum memanggil generator payroll;
- `ProductionWorkLogs.jsx` sekarang memanggil auto payroll setelah `completeProductionWorkLog()` sukses;
- `productionPayrollsService.js` menyediakan `generatePayrollLinesFromCompletedWorkLog()` dengan guard idempotent per Work Log + Step + Operator;
- Operator Produksi di modal Selesaikan Work Log sekarang wajib dipilih agar payroll tidak kehilangan relasi employee;
- payroll otomatis tetap memakai status awal `draft` + `unpaid`; saat line payroll ditandai paid, expense/Cash Out otomatis dibuat lewat guard `sourceModule/sourceId`.

Risiko tersisa:
- Work Log lama yang sudah completed sebelum patch tidak otomatis di-backfill pada bug ini;
- jika butuh backfill payroll lama, buat task terpisah dengan preview/audit terlebih dahulu;
- jika master Tahapan Produksi memiliki payroll rate 0, line payroll tetap bisa dibuat dengan nominal 0 untuk audit.

## Update Integrasi IMS — 2026-04-25
Yang sudah dirapikan:
- Auto payroll dari Work Log completed sudah menjadi bagian flow aktif.
- Payroll paid sekarang membuat expense payroll otomatis dengan guard idempotent `sourceModule/sourceId`.
- Cash Out menampilkan source Payroll Produksi dan `sourceRef` agar audit mudah.
- Profit Loss tetap memakai source final `expenses`, sehingga payroll paid masuk laporan melalui expense.
- Payroll Report tetap membaca `production_payrolls` dan hanya menampilkan referensi Cash Out sebagai audit.

Tech debt tersisa:
- Backfill untuk Work Log completed lama yang belum punya payroll/cost belum dijalankan otomatis.
- Rollback otomatis expense payroll saat payroll paid dibatalkan belum dibuat karena butuh business rule terpisah.
- Jika master material tidak punya cost source, material cost bisa tetap 0 dan harus diperbaiki di master data/purchase flow, bukan diisi manual asal.


## Final Cleanup Status Task 1–5 — 2026-04-25

### Status aktif yang sudah dikunci
- Stock Management menjadi satu entry point inventory; Stock Adjustment berada di panel halaman tersebut.
- Kolom Referensi Audit tetap aktif sebagai audit source dan harus tampil manusiawi.
- Format angka inventory memakai format Indonesia tanpa trailing `.00` untuk angka bulat.
- Riwayat adjustment terbaru di atas berdasarkan `createdAt` dengan fallback `date`.
- Production Order create drawer memakai preview compact read-only untuk stok target dan kebutuhan material.
- Completed Work Log menyimpan cost actual untuk HPP: material, labor, total, dan cost per good unit.
- Work Log completed membuat payroll line otomatis dengan guard Work Log + Step + Operator.
- Payroll paid membuat expense payroll otomatis dengan guard `sourceModule/sourceId`.
- Profit Loss membaca expense payroll dari `expenses`, bukan langsung dari `production_payrolls`.
- Export laporan final diarahkan ke XLSX rapi dan siap baca.

### Legacy / kandidat cleanup
- Route `/stock-adjustment` bila masih ada hanya legacy redirect, bukan entry point aktif.
- Payroll preference/custom payroll di employee adalah legacy/compatibility.
- CSV payroll export boleh dipertahankan sebagai compatibility, tetapi XLSX adalah export final utama.
- Data lama yang belum punya `sourceModule/sourceId` tetap dibaca fallback; jangan backfill otomatis tanpa preview.

### Guarded / belum boleh diubah sembarangan
- Completed Work Log, posting output, material usage, cost actual, auto payroll, dan HPP adalah guarded.
- Auto expense payroll tidak boleh dibuat tanpa source reference idempotent.
- Rollback otomatis expense payroll saat payroll paid dibatalkan belum punya rule final.
- Jika material cost tetap 0 karena master item tidak punya source cost, perbaiki master data/purchase cost; jangan isi angka asal.

## Update State — Production Planning / Planning Schedule

### Aktif
- Menu baru `Production Planning` aktif di grup Produksi.
- Route baru `/produksi/production-planning` aktif.
- Service baru `productionPlanningService.js` aktif membaca/menulis `production_plans`.
- Dashboard aktif membaca summary planning minggu/bulan secara read-only.
- Production Order aktif menyimpan optional reference `planningId`, `planningCode`, dan `planningTitle` saat dibuat dari planning.

### Guarded
- Planning tidak boleh memotong stok.
- Planning tidak boleh membuat payroll atau expense.
- Progress tidak boleh dihitung dari PO yang baru dibuat saja; progress harus berasal dari Work Log completed.
- Create PO dari planning tetap wajib lewat BOM dan helper `createProductionOrder()` existing.
- Work Log complete/payroll/HPP tetap guarded dan tidak disentuh oleh fitur planning.

### Legacy / Compatibility
- PO manual tanpa planning tetap valid.
- Work Log lama tanpa planning tetap valid.
- Field `linkedProductionOrderIds` di planning menjadi link tambahan; jika array tidak lengkap, service juga membaca PO yang memiliki `planningId`.

### Potensi Tech Debt Berikutnya
- Dashboard summary planning saat ini agregat unit sebagai `pcs`; jika nanti ada unit target berbeda, perlu grouping per unit.
- Belum ada calendar view kompleks; sengaja ditunda karena list/card sudah cukup untuk scope aman.
- Belum ada migration/backfill planning untuk PO lama; jika perlu harus task terpisah dengan preview.


## Final Current State Hardening Fase A-G - 2026-04-26

### Status Fase A-F berdasarkan source terbaru
- Fase A Sales stock safety: sudah tercermin di source melalui validasi `availableStock`, agregasi kebutuhan item, dan rollback sale jika mutasi stok gagal.
- Fase B Purchase expense metadata: sudah tercermin di source melalui metadata expense otomatis pembelian `sourceId`, `sourceRef`, `sourceType`, `createdByAutomation`, dan kompatibilitas `relatedPurchaseId`.
- Fase C HPP/Work Log cost 0 warning: sudah tercermin di source melalui warning validasi cost di HPP Analysis dan detail Work Log.
- Fase D Dashboard cleanup: sudah tercermin di source dengan Dashboard read-only 5 section, last updated, refresh, list compact, dan tanpa table besar sebagai layout utama.
- Fase E Report/export gap: sudah tercermin di source melalui Stock Report yang membaca semi-finished stock, export HPP XLSX, dan fix filter export Payroll Report.
- Fase F legacy duplicate cleanup: status bersih pada upload terbaru karena folder `src/src/**` tidak ditemukan lagi dan grep reference `src/src` tidak menemukan import aktif.
- Fase G docs/checklist: fase dokumentasi; tidak mengubah source aplikasi.

### Tech debt yang masih terbuka setelah hardening
- Sales stock safety masih client-side/best-effort; untuk multi-user padat, pertimbangkan transaction/cloud function khusus.
- Payroll paid reversal belum diputuskan: expense payroll tidak dihapus otomatis saat status paid dibatalkan.
- HPP cost 0 sekarang diberi warning, tetapi data lama tidak di-backfill otomatis.
- Firebase Functions legacy tidak bisa dipastikan dari upload ini bila folder functions tidak disertakan.
- Analisis stok varian/reserved stock di report masih bisa ditingkatkan jika dibutuhkan, tetapi source data laporan sudah lebih lengkap.

### Area yang sekarang guarded
- `src/pages/Transaksi/Sales.jsx`: jangan ubah urutan safety create sale tanpa audit stok/income.
- `src/pages/Transaksi/Purchases.jsx`: jangan hapus metadata expense otomatis pembelian.
- `src/pages/Produksi/ProductionHppAnalysis.jsx`: jangan hilangkan warning cost 0 atau export HPP tanpa pengganti.
- `src/pages/Produksi/ProductionWorkLogs.jsx`: jangan proses ulang completed Work Log hanya untuk memperbaiki tampilan cost.
- `src/pages/Dashboard/Dashboard.jsx` dan `.css`: Dashboard harus tetap read-only dan compact.
- `src/pages/Laporan/StockReport.jsx`: jangan hilangkan semi-finished stock dari laporan.
- `src/services/Produksi/productionPayrollsService.js`: guard anti double payroll expense wajib dipertahankan.

### 13. Supplier Restock Catalog manual dengan cascade snapshot terbatas
Temuan terkini:
- halaman Supplier dipakai sebagai master/katalog vendor dan daftar barang restock;
- auto-pasang Supplier ke `raw_materials` berdasarkan `materialDetails` sudah bukan flow aktif;
- tombol “Sinkronkan Bahan” tidak boleh ada lagi di halaman Supplier;
- Raw Material tetap memilih supplier secara manual dan menyimpan snapshot `supplierId`, `supplierName`, `supplierLink`;
- saat master Supplier diedit, snapshot `supplierName` dan `supplierLink` boleh diperbarui hanya pada Raw Material yang sudah menunjuk `supplierId` yang sama;
- saat master Supplier dihapus, snapshot supplier boleh dibersihkan hanya pada Raw Material yang masih menunjuk `supplierId` tersebut;
- `materialDetails` di Supplier tetap dipakai sebagai katalog restock/reference-only.

Risiko tersisa:
- data raw material lama bisa masih memiliki snapshot supplier dari flow lama;
- snapshot lama tetap dibaca agar data historis aman;
- cascade snapshot terbatas hanya menjaga konsistensi nama/link supplier yang sudah dipilih manual, bukan memasang supplier baru ke bahan;
- jika ingin membersihkan data lama di luar supplierId yang cocok, perlu task migrasi/backfill terpisah dengan preview, bukan patch UI biasa.

## Restock Assistant - Current State

Temuan terkini:
- Detail Raw Material menampilkan informasi restock ringkas di tabel utama, bukan list semua supplier.
- Dashboard Stok Kritis dapat memberi action restock cepat untuk bahan baku menipis/kritis.
- Purchases mendukung prefill dari query Restock Assistant, tetapi transaksi tetap wajib disimpan manual oleh user.

Guard tersisa:
- data purchase lama mungkin belum memiliki `productLink`, sehingga tombol link produk tidak selalu tampil;
- action Dashboard tidak boleh berubah menjadi auto-purchase atau auto-expense;
- link toko supplier hanya fallback informasi, bukan link produk utama restock.

## Update Stok Varian - Helper Pusat

Status terkini:
- logic bentuk final stok varian dipusatkan di `src/utils/variants/variantStockNormalizer.js`;
- helper lama Raw Material, Product/Semi, dan mutasi stok umum tetap ada untuk compatibility import, tetapi stok finalnya didelegasikan ke helper pusat;
- standar final: `variant.stock === variant.currentStock` dan master `stock === currentStock`;
- Reset/Maintenance tetap dipakai sebagai audit/repair data lama, bukan solusi flow harian.

Risiko tersisa:
- data lama yang sudah telanjur mismatch masih perlu repair satu kali;
- flow baru setelah patch harus diuji lewat edit varian, purchase, adjustment, sales/return, dan produksi agar mismatch tidak muncul lagi.

## Reset & Maintenance - Supplier Protected

Status terkini:
- collection `supplierPurchases` sudah diperlakukan sebagai protected master data;
- reset transaksi/default tidak lagi menargetkan Supplier;
- preview reset menampilkan master protected agar developer tahu Supplier tidak ikut dihapus;
- fitur Hapus Data Test Saja hanya menghapus dokumen bermarker `isTestData=true`, `sourceModule=dev_test_seed`, dan `createdBy=dev_seed`.

Risiko tersisa:
- jika suatu saat diperlukan reset Supplier, harus dibuat task destructive khusus dengan konfirmasi terpisah;
- seed test transaksi masih perlu task khusus jika ingin dibuat otomatis, karena seed yang mengubah stok/kas harus mengikuti flow Purchases/Sales resmi.

## Purchases - Supplier Restock Prefill

Status source terbaru:
- Purchases membaca supplier dari katalog `supplierPurchases`.
- Untuk pembelian bahan baku, dropdown Supplier difilter berdasarkan `supportedMaterialIds` atau `materialDetails[].materialId`.
- Setelah supplier dipilih, Link Produk dan Harga Supplier Tercatat diprefill dari `materialDetails` supplier yang cocok dengan bahan tersebut.
- Harga Supplier Tercatat bersifat read-only di Purchases dan hanya dipakai sebagai pembanding efisiensi.
- Harga aktual, `actualUnitCost`, stock mutation, expense, dan saving tetap mengikuti flow transaksi Purchases existing.

Tech debt yang tetap perlu dijaga:
- Data supplier lama mungkin belum memiliki `materialDetails`, `productLink`, atau `referencePrice`.
- UI harus tetap aman ketika tidak ada supplier relevan atau harga/link supplier kosong.
- Jangan mengembalikan auto-sync Supplier ke Raw Material.

## Supplier - Katalog Restock Lebih Lengkap

Status source terbaru:
- Menu Supplier difokuskan sebagai katalog vendor/restock dan pembanding harga.
- Field kategori/keterangan supplier lama tidak lagi menjadi input utama UI, tetapi data lama tetap aman dibaca sebagai legacy.
- `materialDetails` supplier kini mendukung konteks satuan dan biaya estimasi: tipe pembelian, satuan beli, qty per pembelian, konversi ke satuan stok, harga barang, ongkir, biaya admin, diskon, total estimasi, dan harga estimasi per satuan stok.
- Purchases membaca katalog ini secara read-only untuk prefill Link Produk, Satuan Beli, Konversi, dan Harga Supplier Tercatat.

Tech debt / guard:
- Data supplier lama mungkin hanya memiliki `productLink` dan `referencePrice`; UI dan helper harus tetap null-safe.
- Perbandingan dengan Purchases terakhir di Supplier bersifat read-only dan tidak boleh membuat purchase otomatis.
- Harga supplier tetap estimasi/pembanding; harga aktual tetap dari Purchases.

## Purchases - Stok Masuk Total dan Pembanding Supplier

Status source terbaru:
- Form Purchases menampilkan Stok Masuk total sebagai field utama pada area jumlah barang.
- Konversi ke Stok tetap disimpan di form sebagai data read-only dari katalog Supplier dan dipakai untuk hitung `totalStockIn`.
- Effect item/type change tidak boleh bergantung pada Qty Beli agar perubahan Qty tidak mereset Supplier, Link Produk, purchaseType, atau Harga Supplier Tercatat.
- Total Pembanding Supplier memakai komponen katalog supplier agar ongkir/admin/diskon default tidak terlihat ikut dikali per satuan stok saat Qty Beli lebih dari 1.

Guard tersisa:
- Supplier lama yang belum punya `conversionValue` harus memunculkan warning dan tidak boleh menghasilkan purchase dengan Stok Masuk 0.
- Jangan membuat input konversi manual di Purchases; koreksi reject/selisih tetap lewat Penyesuaian Stok.
- Jangan membuat shipping tier / ongkir bertingkat di Purchases; ongkir, voucher, diskon ongkir, dan biaya layanan aktual tetap editable saat checkout.

## Update UI/Performance Ringan - 2026-04-26

### Supplier table cleanup
- Tabel utama Supplier dirapikan agar tidak bergantung pada horizontal scroll paksa untuk membuka tombol aksi.
- Kolom aksi Supplier tidak boleh memakai fixed/sticky right jika membuat efek transparan atau menumpuk.
- Detail katalog restock lengkap tetap berada di drawer Detail Supplier; tabel utama hanya menampilkan ringkasan katalog, paket/konversi, tipe, dan harga estimasi.
- Flow Supplier tetap reference-only: tidak membuat purchase, tidak mengubah stok/kas, dan tidak memasang Supplier ke Raw Material berdasarkan `materialDetails`.

### Inventory log read limit
- Stock Management membaca riwayat `inventory_logs` terbaru dengan limit performa agar halaman tetap ringan saat data real bertambah.
- Riwayat stok tetap audit log read-only; membuka Stock Management tidak boleh mengubah stok.
- Jika kebutuhan audit penuh dibutuhkan, buat pagination/arsip log sebagai task terpisah, bukan membaca seluruh collection sekaligus.

### Performance tech debt yang masih terbuka
- Lookup purchase terakhir di Raw Material/Supplier/Dashboard masih perlu desain query/index atau read model agar tidak bergantung pada full collection read saat data sudah besar.
- Dashboard summary masih kandidat optimasi range/limit per collection, tetapi tidak boleh mengubah angka summary tanpa regression test.
