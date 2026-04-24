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
- ProductionSteps
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

## Update Current State: Finalisasi Propagasi Varian Produksi
Patch terbaru mengunci propagasi varian produksi dari Production Order sampai output hasil.

Yang sekarang dianggap resmi / guarded:
- Production Order `targetVariantKey` dan `targetVariantLabel` adalah source of truth varian target.
- Work Log dari PO harus membawa snapshot varian target yang sama.
- Output hasil produksi dari PO harus memakai varian yang sama dengan target PO.
- Stock mutation dan `inventory_logs` harus mencatat `variantKey` dan `variantLabel` yang sama.
- Helper resolve varian tidak boleh silent fallback ke master untuk flow final PO variant.

Tech debt yang masih boleh tersisa sementara:
- jalur planned/manual dari BOM belum punya target variant PO, sehingga tetap dianggap transisi;
- fallback master masih boleh untuk item non-varian dan data manual/legacy;
- `productionService.js` tetap legacy/deprecated dan tidak boleh dipakai sebagai flow produksi final.

Area yang aman dibersihkan setelah reset data:
- data Work Log lama yang linked PO tetapi output-nya masih master;
- data PO lama yang targetHasVariants stale akibat snapshot BOM lama;
- helper/fallback lama yang hanya dipakai untuk mempertahankan data sebelum reset.

## Update Current State: Sinkronisasi Display Varian Produksi
Patch display terbaru memperbaiki inkonsistensi UI setelah logic stok varian sudah benar.

Yang sekarang dianggap resmi / guarded:
- helper display varian membaca key/label final lebih dulu, bukan hanya `stockSourceType`;
- PO detail requirement memakai `resolvedVariantKey` / `resolvedVariantLabel`;
- Work Log detail memakai target snapshot, material resolved variant, dan output variant;
- modal Selesaikan Work Log menampilkan target, varian, step, qty batch, estimasi output, dan selisih Good Qty terhadap estimasi;
- Stock Management membaca `variantLabel` dan fallback `variantKey` untuk log produksi.

Tech debt yang masih boleh tersisa sementara:
- data lama yang sudah terlanjur menyimpan `stockSourceType: master` padahal linked ke PO variant;
- flow planned/manual dari BOM yang tidak punya PO target variant;
- label master untuk item non-varian tetap valid.

## Update Current State: Reset & Maintenance Data
Menu reset lama sudah dirapikan menjadi `Reset & Maintenance Data`.

Status saat ini:
- Maintenance produksi varian tersedia untuk dry run dan repair aman.
- Service maintenance sudah dipisahkan dari service produksi operasional.
- Reset data masih memakai service utility lama, tetapi UI sudah membedakan reset destructive dengan maintenance non-delete.

Tech debt tersisa:
- Maintenance baru tahap awal untuk produksi varian; modul transaksi, finance, laporan, dan inventory masih bisa ditambahkan bertahap.
- Flow manual/planned Work Log tetap transisi dan tidak menjadi sumber final untuk PO variant.
- Collection legacy `productions` masih ditangani di reset sebagai jejak flow lama.
