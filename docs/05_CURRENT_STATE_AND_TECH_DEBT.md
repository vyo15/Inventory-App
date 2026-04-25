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

### 2. Customer collection inkonsisten
Temuan:
- halaman Customers membaca `Customers`
- halaman Customers menambah data ke `customers`
- halaman Sales membaca `customers`

Risiko:
- data customer bisa terpencar di dua collection
- halaman customer dan halaman sales bisa tidak sepenuhnya sinkron

### 3. Stock Adjustment hanya update `stock`
Temuan:
- `StockAdjustment.jsx` melakukan `updateDoc(..., { stock: increment(...) })`
- tidak ikut update `currentStock`

Risiko:
- item yang dibaca modul baru berbasis `currentStock` bisa tidak konsisten setelah adjustment manual

### 4. Revert sale juga hanya update `stock`
Temuan:
- saat cancel / delete sale, revert stok dilakukan dengan `stock: increment(...)`
- tidak ikut update `currentStock`

Risiko:
- sinkronisasi stok bisa tidak penuh

### 5. Laporan stok masih sederhana
Temuan:
- `StockReport.jsx` memakai threshold tetap `10`
- membaca `stock` dan bukan pendekatan stok baru yang lebih lengkap
- belum terlihat mempertimbangkan varian/reserved stock secara penuh

Risiko:
- laporan stok bisa berbeda dengan kebutuhan operasional produksi yang lebih detail

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
Untuk baseline UI table/action, current state yang sekarang paling aman dianggap resmi adalah:
- semua main table harus menaruh kolom `Aksi` di paling kanan
- main table lebar atau yang memakai `scroll.x` wajib memakai `fixed: "right"` pada kolom aksi
- jika ada kolom `Status` pada table lebar, kolom itu boleh ikut sticky di kanan sebelum `Aksi`
- halaman detail-capable wajib punya tombol `Detail`
- halaman simple config page tidak wajib punya `Detail` dan cukup memakai `Edit + Aktif/Nonaktif` atau `Edit + Hapus`
- nested/subtable tidak wajib sticky kecuali ada bug nyata di area itu

Legacy UI yang masih boleh tersisa sementara:
- halaman di luar daftar prioritas yang masih menulis action column manual tetapi belum menimbulkan bug usability
- nested/subtable lama yang belum memakai marker semantic baru selama belum punya masalah horizontal scroll

Untuk dokumentasi saat ini, flow aktif yang paling aman dianggap resmi adalah:
- master data modern
- transaksi pembelian/penjualan/retur
- cash in & cash out
- inventory logs
- pricing rules
- produksi final: BOM → Production Order → Work Log → Payroll → Analisis HPP
- reset utilitas dengan baseline

## Prioritas Tech Debt yang Paling Layak Dibereskan Dulu
1. satukan semua mutasi stok agar selalu update `currentStock`, `stock`, dan bila perlu `availableStock`
2. rapikan `Customers` vs `customers`
3. audit ulang Firebase Functions apakah masih dipakai atau sebaiknya dipensiunkan
4. dokumentasikan resmi bahwa `productions` adalah legacy flow
5. rapikan laporan stok agar membaca field stok aktif dan mendukung varian lebih baik

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


## Update Current State: Global UI Normalization Batch
Baseline UI final yang sekarang paling aman dianggap resmi:
- semua main table dengan kolom `Aksi` harus menaruh aksi di paling kanan
- semua main table lebar atau yang memakai `scroll.x` wajib membuat kolom aksi `fixed: "right"`
- bila ada kolom `Status` pada table lebar, status boleh ikut sticky di kanan sebelum `Aksi`
- detail-capable page wajib punya tombol `Detail`
- simple config page tetap ringan tanpa dipaksa punya `Detail`
- khusus `ProductionSteps`, baseline terbaru mengubah halaman ini menjadi detail-capable page ringan karena konfigurasi step sudah terlalu kaya untuk dipadatkan di tabel utama
- ledger/simple action page boleh tanpa `Detail`, tetapi action column tetap wajib konsisten bila ada aksi per row
- read-only data table page tidak perlu action column, tetapi surface table harus tetap memakai class baseline global

Migration matrix singkat setelah batch global ini:

### Sudah sesuai baseline
- Products
- RawMaterials
- SemiFinishedMaterials
- ProductionBoms
- ProductionEmployees
- ProductionOrders
- ProductionWorkLogs
- ProductionPayrolls
- ProductionSteps *(detail-capable page ringan: tabel ringkas + drawer Detail read-only)*
- ProductionProfiles
- CashIn
- CashOut
- Categories
- Customers
- Sales
- SupplierPurchases
- PricingRules
- Purchases
- Returns
- StockAdjustment
- StockManagement
- StockReport
- PurchasesReport
- SalesReport
- ProfitLossReport
- ProductionHppAnalysis

### Hampir sesuai / transisi sementara
- ResetTestData
  - tabel preview sudah migrasi ke baseline global
  - page shell utility masih manual dan aman dirapikan nanti jika utility page ikut distandardisasi penuh

### Belum sesuai / legacy yang masih tersisa
- tidak ada lagi main table operasional utama yang sengaja dibiarkan memakai action column manual di batch ini
- sisa legacy terbesar sekarang ada pada utility shell tertentu dan helper/CSS lama yang hanya relevan untuk halaman yang belum ikut shared page wrapper penuh

Area yang aman dibersihkan setelah migrasi ini stabil:
- trigger detail manual yang mengandalkan klik nama row tanpa tombol `Detail` eksplisit
- group tombol aksi lama berbasis `type="link"` yang hanya dipertahankan untuk halaman di luar baseline final
- wrapper table manual pada utility page yang belum dipindah ke shared page foundation

## Update Current State: Cleanup File Legacy / Wrapper Tipis

Audit import tree terbaru menemukan beberapa file yang tidak lagi diimport oleh route, page, service, helper, atau CSS aktif.

### Final / Aktif
- `src/services/MasterData/productsService.js` menjadi source form/payload produk aktif.
- `src/utils/variants/variantHelpers.js` menjadi helper varian warna/produk aktif.
- `src/pages/Transaksi/Sales.jsx` masih menjadi source aktif status penjualan sampai status option dipisah dalam task khusus.
- Flow produksi final tetap berada di `productionBomsService.js`, `productionOrdersService.js`, `productionWorkLogsService.js`, `productionPayrollsService.js`, dan halaman produksi terkait.

### Legacy / Aman Dihapus Manual
- `src/components/Layout/Display/StatusBadge.jsx` dan `.css`: file kosong, tidak diimport.
- `src/constants/productOptions.js`: tidak diimport; logic final produk sudah di service produk dan helper varian.
- `src/constants/salesStatusOptions.js`: tidak diimport; belum menjadi source aktif status sales.
- `src/hooks/useAppRole.js`: tidak diimport; role aktif masih memakai util akses langsung.
- `src/services/Produksi/productionService.js`: tidak diimport; flow `productions` lama sudah legacy dan tidak boleh dipakai sebagai flow produksi final.

### Transisi yang Masih Perlu Dipantau
- route lama `/utilities/reset-test-data` sudah menjadi redirect; entry final adalah `/utilities/reset-maintenance-data` dan `ResetMaintenanceData.jsx` masih dipertahankan agar navigasi tidak rusak, meskipun label menu sudah mengarah ke reset/maintenance.
- data legacy collection `productions` masih bisa ada di Firestore dan harus dibersihkan lewat reset terarah, bukan lewat import service lama.

### Catatan Cleanup
Penghapusan file di atas aman terhadap runtime karena tidak ada import aktif. Jika file dihapus secara manual, jalankan dev server dan pastikan route utama tetap terbuka. Jika ada data lama yang perlu disesuaikan, gunakan Reset & Maintenance Data untuk dry run / repair aman / reset terarah, bukan delete database manual.

## Update Current State: Cleanup Structure Batch 2

### Final / Aktif
- `src/pages/Utilities/ResetMaintenanceData.jsx` menjadi entry page final untuk menu Reset & Maintenance Data.
- `src/services/Maintenance/resetMaintenanceDataService.js` menjadi service final untuk reset destructive, preview reset, baseline, dan sync stok.
- `src/services/Maintenance/productionVariantMaintenanceService.js`, `inventoryMaintenanceService.js`, dan `maintenanceLogService.js` tetap menjadi service maintenance non-operasional.
- Sidebar sekarang mengarah ke `/utilities/reset-maintenance-data`.

### Wrapper / Redirect Transisi
- Route lama `/utilities/reset-test-data` masih dipertahankan sebagai redirect ke `/utilities/reset-maintenance-data` agar bookmark lama tidak blank.
- Redirect ini aman dihapus setelah semua dokumentasi, bookmark, dan referensi internal sudah memakai path baru.

### Aman Dihapus Setelah Patch Divalidasi
- `src/pages/Utilities/ResetTestData.jsx`
- `src/services/Utilities/resetTestDataService.js`

Kedua file tersebut sudah tidak menjadi entry/import aktif setelah route dan page final dipindahkan.

## Update Batch 3: Legacy Data Cleanup Status
- `Reset & Maintenance Data` sekarang memiliki dry run khusus `Audit Data Legacy Batch 3`.
- Area yang dipetakan: `productions` legacy, PO/Work Log stale, orphan inventory log, sales/returns/adjustments/purchases lama tanpa variant snapshot, serta income/expense tanpa source reference yang cukup.
- `productions` tetap legacy dan target utamanya adalah reset produksi scoped, bukan migrasi ke flow final.
- Transaksi lama item bervarian tanpa `variantKey/variantLabel` tidak aman ditebak otomatis. Untuk data testing, gunakan reset scoped; untuk data final historical, lakukan manual review.
- Cleanup code berikutnya boleh dilakukan setelah audit legacy menunjukkan tidak ada data lama yang masih menahan source of truth final.

## Update Current State: Finalisasi Handoff Work Log -> Payroll
- Flow payroll final tidak boleh berhenti di Work Log completed sebagai candidate manual.
- Handoff resmi sekarang adalah: Work Log completed -> auto-create payroll draft per operator -> review di menu Payroll -> confirmed -> paid/cancelled.
- Menu Payroll bukan lagi tempat generate manual dari completed Work Log; candidate manual lama harus dianggap transisi yang sudah ditutup.
- Jika completed Work Log lama belum punya draft payroll, rekonsiliasi boleh dilakukan sekali saat load menu Payroll tanpa membuka jalur manual baru.
- Custom payroll employee tetap legacy/deprecated dan tidak boleh dihidupkan lagi sebagai source utama.
