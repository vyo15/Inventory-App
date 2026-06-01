# CURRENT STATE & TECH DEBT — IMS Bunga Flanel

## Update UI/UX Sales Channel — Patch channel report polish

Status: **AKTIF / UI-DISPLAY ONLY**.

- Patch Firestore Rules untuk `business_code_counters` sengaja **ditunda** karena owner menyatakan arah berikutnya adalah SQLite/offline database, bukan Firebase sebagai target final. File `firestore.rules` tidak diubah pada patch ini.
- Selama source runtime masih memakai service Firebase lama, semua perubahan SQLite/PostgreSQL/local database tetap wajib task migrasi terpisah; patch ini tidak mengubah schema, collection, stock mutation, finance, production, payroll, atau offline mutation.
- Sales channel sekarang punya single source di `src/constants/salesChannelOptions.js` untuk opsi input, label grup, fallback `Belum Dikategorikan`, marketplace set, dan helper summary.
- `Sales.jsx` dan `SalesReport.jsx` memakai helper summary yang sama agar tampilan penjualan per channel tidak beda antara transaksi dan laporan.
- `SalesReport.jsx` menambahkan section `Performa Channel` compact; detail transaksi final tetap di tabel utama dan export XLSX tetap memakai kolom Channel + Order Marketplace/Resi.
- Dashboard duplicate helper activity/planning/cost dipusatkan kembali ke `src/pages/Dashboard/helpers/dashboardPageHelpers.js`; perubahan ini read-only display dan tidak mengubah query/service.


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
- submit adjustment memakai Firestore transaction dan helper stok varian aktif, bukan `updateDoc(... stock ...)` langsung dari page
- item bervarian wajib memilih varian sebelum submit
- adjustment keluar divalidasi terhadap `availableStock` agar tidak menggerus stok yang sudah reserved

Risiko tersisa:
- log/data adjustment lama yang dibuat sebelum patch bisa belum punya snapshot `availableStockBefore/After`
- route lama atau file lama jangan dihidupkan lagi agar logic adjustment tidak bercabang

### 4. Sales stock safety sudah di-hardening
Temuan terkini:
- create sale memvalidasi `availableStock` master/varian sebelum transaksi disimpan
- kebutuhan item yang sama digabung dulu agar multi-line tidak melewati stok tersedia
- create sale menyimpan dokumen Sales, mutasi stok keluar, inventory log, dan income awal `Selesai` dalam Firestore transaction
- Sales tidak menyediakan aksi batal/delete user-facing; status aktif hanya `Diproses`, `Dikirim`, dan `Selesai`, sedangkan barang kembali wajib lewat Return

Risiko tersisa:
- flow masih berjalan dari client; untuk multi-user besar tetap ideal dipindahkan ke backend/Cloud Function agar aturan server-side lebih kuat
- sales lama yang tidak sesuai flow aktif perlu dicek manual lewat Auto Detect Bug Data/Data Quality Audit sebelum dipakai sebagai dasar laporan final

### 5. Laporan/export sudah lebih siap data real
Temuan terkini:
- Stock Report sudah membaca bahan baku, semi-finished, dan produk jadi
- HPP Analysis sudah memiliki export XLSX dengan header manusiawi, kolom Final/Preview, dan kolom validasi cost
- Payroll Report XLSX memakai filter operator aktif; CSV lama tetap compatibility/legacy

Risiko tersisa:
- laporan stok masih belum menjadi kartu analitik varian/reserved stock yang sangat detail
- export harus tetap dijaga agar tidak kembali menjadi data mentah/object teknis

### 6. Firebase Functions custom tidak ditemukan pada ZIP aktual
Temuan aktual 2026-05-06:
- folder custom `functions/` tidak ditemukan pada `Inventory-App.zip`;
- tidak ada source `functions/index.js` yang bisa diverifikasi sebagai bagian project aktif;
- aplikasi aktif berjalan lewat frontend React/Vite dan Firestore client/service layer;
- package-lock dapat memuat package internal Firebase Functions dari SDK Firebase, tetapi itu bukan bukti adanya Cloud Functions custom project.

Risiko:
- docs lama yang menyebut trigger `functions/index.js` dapat menyesatkan developer baru;
- jika suatu saat backend Cloud Functions memang ditambahkan di repository lain, task harus meminta source backend tersebut secara eksplisit.

### 7. Flow legacy produksi masih tersisa di data/maintenance, bukan service aktif
Temuan aktual 2026-05-06:
- file `src/services/Produksi/productionService.js` tidak ditemukan pada ZIP aktual;
- collection `productions` masih muncul sebagai legacy data layer pada reset/maintenance/audit;
- route utama saat ini berpusat pada BOM/PO/Work Log/Payroll/HPP, bukan `productions`;
- service aktif produksi bersifat granular: BOM, Orders, Work Logs, Payrolls, Planning, Profiles, Steps, Employees, dan Semi Finished Materials.

Risiko:
- developer baru bisa bingung bila docs lama masih menyebut `productionService.js` sebagai service aktif;
- cleanup `productions` tetap harus dianggap destructive/maintenance scoped, bukan refactor flow produksi utama.

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
1. jaga docs agar tidak lagi menyebut `functions/index.js` atau `productionService.js` sebagai source aktif tanpa bukti source aktual;
2. dokumentasikan resmi bahwa `productions` adalah legacy data layer/maintenance scope, bukan flow produksi utama;
3. pertimbangkan Cloud Function/transaction baru untuk Sales stock safety jika data real sudah besar dan multi-user aktif;
4. buat keputusan business rule rollback untuk payroll paid yang sudah membuat expense;
5. tingkatkan laporan stok varian/reserved stock jika owner membutuhkan analisis lebih detail.

## Update Sinkronisasi Docs dengan Source Aktual — 2026-05-06

Status hasil audit `Inventory-App.zip` + `docs.zip`:
- `functions/` tidak ditemukan, sehingga docs tidak boleh lagi menyatakan Firebase Functions custom sebagai bagian aktif project;
- `src/services/Produksi/productionService.js` tidak ditemukan, sehingga docs tidak boleh lagi menjadikannya service legacy aktif;
- flow produksi aktif berada pada service granular `src/services/Produksi/*Service.js`;
- collection `productions` masih legacy data layer untuk maintenance/reset/audit dan bukan source of truth operasional;
- route aktual mencakup `production-planning`, `payroll-report`, dan `system/user-management`;
- jika docs dan source konflik, source aktual harus diverifikasi lebih dulu melalui grep/import/route check.

Dampak ke task berikutnya:
- patch produksi harus menargetkan service granular yang benar, bukan `productionService.js`;
- jangan membuat asumsi ada Cloud Functions backend kecuali user mengupload folder/repo backend;
- cleanup docs harus mengirim ZIP berisi file docs yang berubah saja.

## Update Sinkronisasi Docs dengan Source Aktual — 2026-05-22

Audit terbaru memakai `src.zip` dan `docs.zip` yang diupload pada task ini. Hasilnya:

- Daftar file besar/berisiko maintainability perlu dibaca dari source aktual, bukan dari catatan lama. Pada `src.zip` terbaru, `src/pages/Utilities/ResetMaintenanceData.jsx` berisi 2110 baris, bukan 3454 baris. File ini tetap berisiko maintainability karena masih menggabungkan UI orchestration, state, validasi aksi, dan panel maintenance dalam satu page besar.
- File besar lain yang terkonfirmasi dari source aktual setelah rangkaian extraction/cleanup dan P2 split: `src/services/Produksi/productionWorkLogsService.js` 2404 baris + helper 365 baris, `src/pages/Produksi/ProductionWorkLogs.jsx` 1617 baris setelah P2-A/P2-B UI split, `src/pages/Transaksi/Purchases.jsx` 1285 baris setelah P2-D UI split, `src/pages/Utilities/ResetMaintenanceData.jsx` 1335 baris setelah P2-C orchestration split, `src/services/Maintenance/resetMaintenanceDataService.js` 1863 baris + config 282 baris, `src/pages/Produksi/ProductionBoms.jsx` 1798 baris, `src/pages/MasterData/RawMaterials.jsx` 1766 baris, `src/pages/Produksi/ProductionOrders.jsx` 1737 baris, `src/pages/Produksi/SemiFinishedMaterials.jsx` 1720 baris, `src/pages/Dashboard/Dashboard.jsx` 1383 baris, dan `src/pages/Transaksi/Sales.jsx` 1108 baris.
- Ini bukan alasan untuk refactor besar sekaligus. Statusnya **MAINTAINABILITY DEBT / GUARDED REFACTOR CANDIDATE**: pecah bertahap per modul, behavior-preserving, dan wajib menjaga route, role guard, schema, stock flow, production flow, payroll, purchase, reset, audit log, dan histori transaksi.
- Path yang tidak ditemukan dan sudah sesuai status docs sebagai legacy/missing: `functions/`, `functions/index.js`, `src/services/Produksi/productionService.js`, `src/pages/Inventory/StockAdjustment.jsx`, `src/utils/access/accessControl.js`, `src/constants/roleOptions.js`, `src/stock.json`, `src/assets/dark-mode.svg`, dan `src/assets/light-mode.svg`. Jangan menjadikannya target patch aktif tanpa source baru.
- Sync docs aktual: ZIP source terbaru menyertakan `firestore.rules`, `firestore.indexes.json`, dan `firebase.json`. Patch UI/UX dan report ini tetap **tidak mengubah rules** karena owner sudah mengarahkan migrasi berikutnya ke SQLite/offline database. Selama runtime lama masih memakai Firebase, rules backend tetap wajib diverifikasi manual sebelum deployment.
- Import relatif source aktif sudah diaudit ringan: tidak ditemukan import relatif yang mengarah ke file hilang. Sidebar menu juga sinkron dengan route aktif; route yang tidak tampil di menu adalah route redirect/system seperti `/`, `/unauthorized`, `/stock-adjustment`, `/utilities/reset-test-data`, dan `*`.

Dampak ke task berikutnya:

- Setiap review docs/source wajib menyebut ZIP aktual yang dibaca dan path aktual yang dicek.
- Jangan memakai angka line count atau daftar file missing dari chat lama tanpa hitung ulang terhadap ZIP terbaru.
- Jika docs menyebut path file, pastikan path itu benar-benar ada di source atau diberi label eksplisit **legacy/missing/external**.


## Update Current State — P2 Jumbo File Split Behavior-Preserving — 2026-05-23

Patch gabungan P2-A sampai P2-E memecah file jumbo tanpa mengubah behavior bisnis. Statusnya **MAINTAINABILITY REFACTOR / BEHAVIOR-PRESERVING**.

Yang sudah dipisah:
- **P2-A:** detail drawer Work Log dipindah ke `src/pages/Produksi/components/ProductionWorkLogDetailDrawer.jsx`.
- **P2-B:** modal material usage, output, dan complete Work Log dipindah ke `WorkLogMaterialUsageModal.jsx`, `WorkLogOutputModal.jsx`, dan `WorkLogCompleteModal.jsx`.
- **P2-C:** orchestration audit/repair Reset Maintenance dipindah bertahap ke `src/pages/Utilities/hooks/useResetMaintenanceAudits.js`, `src/pages/Utilities/hooks/useResetMaintenanceRepairs.js`, dan helper UI `src/pages/Utilities/utils/resetMaintenanceUiHelpers.jsx`.
- **P2-D:** Purchases UI dipisah ke `PurchaseFormModal.jsx`, `PurchaseStockPreview.jsx`, `PurchaseTableColumns.jsx`, `PurchaseCostSummaryCard.jsx`, dan `purchaseOcrUiConstants.js`.
- **P2-E:** helper pure Work Log service dipindah ke `src/services/Produksi/helpers/productionWorkLogsServiceHelpers.js`, dan konfigurasi reset maintenance dipindah ke `src/services/Maintenance/config/resetMaintenanceDataConfig.js`.

Batas aman yang tetap dijaga:
- tidak mengubah schema, collection, route, menu, atau role guard;
- tidak mengubah stock mutation, inventory log payload, HPP, payroll, purchase average cost, expense, OCR parser, atau reset destructive flow;
- tidak mengubah service transaction Sales/Purchases/Returns;
- komponen UI baru hanya presentational atau orchestration wrapper, bukan tempat business rule baru.

Line count source akhir setelah gabungan P2: `ProductionWorkLogs.jsx` 1617 baris, `Purchases.jsx` 1285 baris, `ResetMaintenanceData.jsx` 1335 baris, `productionWorkLogsService.js` 2404 baris + helper 365 baris, dan `resetMaintenanceDataService.js` 1863 baris + config 282 baris.

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
- detail Payroll Produksi dan Work Log sudah memakai microcopy compact untuk membedakan final vs preview; tetap jaga agar status normal tidak kembali menjadi alert besar

## Update Cleanup Architecture — 2026-04-25

### Sudah dibereskan pada batch ini
- `StockAdjustmentPanel.jsx` tidak lagi melakukan `updateDoc(... stock: increment(...))` langsung dari page dan sekarang mendukung Bahan Baku, Semi Finished, serta Produk Jadi.
- Adjustment keluar sekarang divalidasi terhadap `availableStock`, sehingga reserved stock tidak ikut terpakai oleh koreksi manual.
- Stock Adjustment sekarang memakai Firestore transaction di panel resmi dan helper stok varian aktif, sehingga record adjustment, mutasi stok, dan inventory log tidak mudah partial.
- Collection customer sudah disatukan ke `customers` lowercase di Master Customer agar sinkron dengan Sales.
- `inventory_logs` baru memiliki `referenceId`, `referenceType`, dan `details` untuk memudahkan audit trail.
- Stock Management membaca reference dari `details` dan fallback top-level agar log lama tetap tampil.
- File kandidat cleanup yang terbukti tidak di-import sudah ditandai/dihapus dari source patch.

### Status tech debt yang masih perlu diperhatikan
- `StockReport.jsx` masih kandidat upgrade tahap lanjut agar membaca varian/reserved stock lebih detail.
- Jalur helper stok lama/compatibility masih perlu diaudit sebelum dihapus; jangan hapus helper legacy tanpa grep/import check.
- Flow produksi final tetap guarded dan tidak ikut direfactor pada cleanup stok umum.
- Audit Firebase Functions custom pada 2026-05-06: folder `functions/` tidak ada di `Inventory-App.zip`; jangan menganggap backend Functions aktif tanpa source terpisah.

### Koreksi dokumen lama
Poin lama yang menyebut aksi batal/revert sale sebagai aksi user sudah tidak sesuai dengan source terbaru. Sales create memakai Firestore transaction di `src/pages/Transaksi/Sales.jsx`; aksi batal/delete Sales tidak tampil sebagai aksi operasional. Barang kembali setelah transaksi tercatat wajib lewat Return agar stok, income, dan audit trail tidak bercabang.


## Update Product & Semi Finished Min Stock Master — 2026-05-07

Status: **AKTIF + GUARDED**.

- Product dan Semi Finished sekarang memakai `minStockAlert` master sebagai satu-satunya threshold minimum stok untuk item bervarian dan non-varian.
- Raw Material memakai `minStock` master sebagai threshold minimum stok untuk item bervarian dan non-varian.
- UI Product/Semi Finished/Raw Material tidak menampilkan input minimum stok per varian; varian hanya untuk bucket stok fisik, reserved, available, status, dan metadata relevan.
- Service Product/Semi Finished tetap boleh membawa `variants[].minStockAlert` sebagai legacy-compat field dari helper generic/data lama, tetapi enrich/create/update tidak menjumlahkannya sebagai source master.
- Low-stock summary/status item non-varian membaca stok available-first terhadap threshold master.
- Low-stock summary/status item bervarian membaca setiap varian aktif terhadap threshold master yang sama. Jika ada varian kosong/rendah, item utama ikut kosong/rendah dan UI menampilkan ringkasan varian yang perlu dicek.
- Cleanup data lama `variants[].minStockAlert` bersifat kandidat maintenance terpisah dan tidak dilakukan otomatis dari UI CRUD master.

## Update Karyawan Produksi — 2026-04-25

### Kode karyawan produksi sudah otomatis
Temuan/fix:
- form tambah Karyawan Produksi tidak lagi memakai input manual placeholder `EMP-...`;
- preview kode dibuat otomatis dengan format `DDMMYYYY-XXX`;
- service `productionEmployeesService.js` generate ulang kode saat create untuk menjaga uniqueness;
- Batch 16D memindahkan counter final ke collection bersama `business_code_counters` dengan key `DAILY__EMP__DDMMYYYY`;
- `production_employee_code_sequences` hanya dibaca sebagai legacy baseline agar nomor lama tidak tertabrak;
- format kode tampilan tetap `DDMMYYYY-XXX` untuk menjaga compatibility UI dan Work Log/Payroll lama.

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
- jika master Tahapan Produksi memiliki payroll rate 0/kosong, auto payroll diblokir oleh guard eligibility; perbaiki tarif Step terlebih dahulu, jangan membuat line nominal 0 sebagai flow aktif.

## Update Integrasi IMS — 2026-04-25
Yang sudah dirapikan:
- Auto payroll dari Work Log completed sudah menjadi bagian flow aktif.
- Payroll paid sekarang membuat expense payroll otomatis dengan guard idempotent `sourceModule/sourceId`.
- Cash Out menampilkan source Payroll Produksi dan `sourceRef` agar audit mudah.
- Profit Loss tetap memakai source final `expenses`, sehingga payroll paid masuk laporan melalui expense.
- Payroll Report tetap membaca `production_payrolls` dan hanya menampilkan referensi Cash Out sebagai audit.

Tech debt tersisa:
- Backfill/reconcile untuk Work Log completed lama yang belum punya payroll/cost atau output HPP master yang belum ikut payroll final belum dijalankan otomatis.
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
- UI Work Log Produksi tidak lagi menyediakan tombol tambah manual; Work Log baru harus dibuat dari Production Order melalui action Mulai Produksi. `manual/planned` tetap dipertahankan sebagai legacy compatibility data lama, bukan flow input aktif.
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
- Cancel Planning hanya boleh untuk Planning tanpa PO / linked Production Order dan hanya mengubah status menjadi `cancelled`; bukan hard delete dan tidak menyentuh PO, Work Log, stok, payroll, HPP, atau report.
- Planning yang sudah punya PO tidak boleh dicancel langsung; user harus mengelola PO terkait terlebih dahulu.
- Planning `cancelled` dan `completed` tidak boleh dibuatkan PO, sedangkan Planning `overdue` tanpa PO masih boleh dibuatkan PO atau dicancel.
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
- Fase A Sales stock safety: sudah tercermin di source melalui validasi `availableStock`, agregasi kebutuhan item, dan Firestore transaction untuk create sale agar sales/stok/log/income tidak partial.
- Fase B Purchase expense metadata: sudah tercermin di source melalui metadata expense otomatis pembelian `sourceId`, `sourceRef`, `sourceType`, `createdByAutomation`, dan kompatibilitas `relatedPurchaseId`.
- Fase C HPP/Work Log costing: detail Work Log sekarang compact tanpa alert besar untuk status normal; labor memakai resolver shared dengan HPP Analysis untuk menampilkan payroll final/draft/estimasi step secara read-only, overhead membaca BOM untuk listrik/glue gun, dan HPP Analysis tetap menjaga validasi cost final.
- Fase D Dashboard cleanup: sudah tercermin di source dengan Dashboard read-only compact sebagai control center; update terbaru menambahkan KPI strip, quick actions navigasi-only, dan Data Perlu Dicek tanpa table besar sebagai layout utama.
- Fase E Report/export gap: sudah tercermin di source melalui filter periode server-side pada Sales/Purchases/Profit Loss/Payroll Report, Stock Report yang membaca semi-finished stock, export HPP XLSX, dan fix filter export Payroll Report.
- Fase F legacy duplicate cleanup: status bersih pada upload terbaru karena folder `src/src/**` tidak ditemukan lagi dan grep reference `src/src` tidak menemukan import aktif.
- Fase G docs/checklist: fase dokumentasi; tidak mengubah source aplikasi.

### Tech debt yang masih terbuka setelah hardening
- Sales stock safety sudah memakai Firestore transaction di client untuk create/status selesai; untuk multi-user padat tetap pertimbangkan Cloud Function/server-side guard dan validasi Firestore Rules production.
- Payroll paid reversal belum diputuskan: expense payroll tidak dihapus otomatis saat status paid dibatalkan.
- HPP cost 0 sekarang diberi warning, tetapi data lama tidak di-backfill otomatis.
- Firebase Functions custom tidak ada pada ZIP aktual; bila backend Functions berada di repo/ZIP lain, source tersebut harus diupload sebelum diaudit.
- Analisis stok varian/reserved stock di report masih bisa ditingkatkan jika dibutuhkan, tetapi source data laporan sudah lebih lengkap.

### Area yang sekarang guarded
- `src/pages/Transaksi/Sales.jsx`: jangan ubah urutan safety create sale tanpa audit stok/income.
- `src/pages/Transaksi/Purchases.jsx`: jangan hapus metadata expense otomatis pembelian.
- `src/pages/Produksi/ProductionHppAnalysis.jsx`: jangan hilangkan warning cost 0 atau export HPP tanpa pengganti.
- `src/pages/Produksi/ProductionWorkLogs.jsx`: jangan proses ulang completed Work Log hanya untuk memperbaiki tampilan cost.
- `src/pages/Dashboard/Dashboard.jsx` dan `.css`: Dashboard harus tetap read-only dan compact.
- `src/pages/Laporan/StockReport.jsx`: jangan hilangkan semi-finished stock dari laporan.
- `src/services/Produksi/productionPayrollsService.js`: guard anti double payroll expense wajib dipertahankan.


### 18. Dashboard Business Control Center compact — 2026-05

Status aktif:
- Dashboard tetap read-only dan tidak menjadi sumber transaksi.
- Ringkasan Hari Ini membaca sales, kas, stok, produksi, payroll, dan alert operasional sebagai KPI monitoring.
- Aksi Cepat hanya navigasi ke route existing; tidak membuat Sales, Purchases, PO, Work Log, Payroll, Cash In/Out, expense, income, atau mutasi stok.
- Data Perlu Dicek menampilkan exception stok minus/reserved tidak wajar, stok kritis, PO shortage, planning overdue/behind target, cost/HPP kosong pada Work Log completed, dan payroll pending.
- `Terakhir diperbarui` dan tombol `Muat Ulang` hanya reload snapshot read-only.

Guarded:
- Angka cash resmi tetap berasal dari `revenues` + `incomes` dan `expenses`; Profit Loss tetap laporan final.
- Sales KPI membaca `sales.total` sebagai omzet/monitoring, tidak boleh dijumlahkan ulang sebagai kas resmi.
- Dashboard tidak boleh melakukan auto-create transaction, auto-purchase, auto-PO, auto-payroll, auto-expense, auto-income, atau auto-stock-fix.
- Alert Data Perlu Dicek hanya petunjuk audit; perbaikan tetap dilakukan di modul source of truth.

Tech debt:
- **SUPERSEDED oleh Batch 17N–18G:** Dashboard runtime terbaru memakai `stock_item_read_models` issue query sebagai path normal stok kritis dan fallback guarded ke master stock jika read model kosong/gagal. Risiko tersisa: Firestore Rules/index, kualitas backfill, dan konsistensi writer sync.
- Quick actions belum role-aware per button; route guard tetap pengaman utama.

### 19. Scalability read path report/dashboard/code generator — 2026-05

Status aktif:
- `src/pages/Laporan/SalesReport.jsx`, `PurchasesReport.jsx`, dan `ProfitLossReport.jsx` memakai default periode bulan berjalan dan query Firestore berdasarkan field `date`.
- `src/pages/Laporan/PayrollReport.jsx` memakai service range query `getProductionPayrollsByDateRange` berdasarkan `payrollDate`.
- `src/pages/Dashboard/Dashboard.jsx` tetap read-only, tetapi data sales/finance/payroll/work log monitoring dibatasi ke periode operasional bulan/minggu berjalan.
- `src/utils/references/businessCodeGenerator.js` memakai prefix query pada document ID dan field kode bisnis sebelum fallback legacy full scan.

Guarded / belum diubah:
- Counter atomic `business_code_counters` sudah disetujui dan aktif bertahap sejak Batch 16B/16C/16D. File rules ada di repo ZIP terbaru, tetapi patch rules sengaja ditunda karena arah owner adalah SQLite; selama runtime Firebase lama masih dipakai, `business_code_counters` tetap wajib diverifikasi di backend/deployment rules.
- **SUPERSEDED oleh source aktual:** Stock Report sekarang membaca `stock_item_read_models` sebagai read path utama dengan paging/export dan fallback guarded ke master stock jika read model kosong/gagal. Batch lama 17A–17C tetap historis sebagai foundation/backfill, bukan status runtime terbaru.
- Perubahan schema/read model baru di luar counter kode bisnis tetap wajib approval terpisah.


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
- Konversi Supplier tetap disimpan di form sebagai data read-only dari katalog Supplier dan dipakai untuk hitung `totalStockIn`.
- Effect item/type change tidak boleh bergantung pada Qty Beli agar perubahan Qty tidak mereset Supplier, Link Produk, purchaseType, atau Harga Supplier Tercatat.
- Total Pembanding Supplier memakai komponen katalog supplier agar ongkir/admin/diskon default tidak terlihat ikut dikali per satuan stok saat Qty Beli lebih dari 1.

Guard tersisa:
- Supplier lama yang belum punya `conversionValue` harus memunculkan warning dan tidak boleh menghasilkan purchase dengan Stok Masuk 0.
- Jangan membuat input konversi manual di Purchases; koreksi reject/selisih tetap lewat Penyesuaian Stok.
- Jangan membuat shipping tier / ongkir bertingkat di Purchases; ongkir, voucher, diskon ongkir, dan biaya layanan aktual tetap editable saat checkout.

## Purchases - Preview Stok Aktual dan Breakdown Ringkasan Pembelian

Status source terbaru:
- Modal Purchases menampilkan preview stok aktual sebelum restock setelah item dan/atau varian dipilih.
- Item non-varian menampilkan stok master `currentStock`, `reservedStock`, dan `availableStock`.
- Item bervarian menampilkan stok varian terpilih; jika varian belum dipilih, UI menampilkan pesan agar user memilih varian dulu.
- Alert global `Ada varian kosong...` tidak ditampilkan lagi di card `Stok Aktual Sebelum Restock` karena mengganggu flow restock dan kalah relevan dibanding preview stok item/varian yang sedang dipilih.
- Ringkasan Perbandingan Supplier menampilkan breakdown subtotal barang/harga awal, ongkir, admin/service fee, potongan ongkir, voucher/potongan, total aktual, total pembanding supplier, modal aktual per satuan stok, dan selisih hemat.

Guard tersisa:
- Preview stok hanya read-only dan tidak boleh menjadi sumber mutasi stok.
- `handleSubmitPurchase`, `runTransaction`, stock mutation, inventory log, expense otomatis, rumus `totalStockIn`, `totalActualPurchase`, `actualUnitCost`, dan `purchaseSaving` tetap guarded.
- Helper status Raw Materials seperti `getRawMaterialVariantStockIssueMeta`, `getActiveRawMaterialVariants`, `getRawMaterialStatusMeta`, dan `getRawMaterialStockSummary` tetap dipertahankan untuk status tag, summary/filter, dan detail drawer; yang dihapus hanya render warning duplicate pada table compact.
- Fallback legacy `currentStock ?? stock` masih dipertahankan untuk data lama.
- Ringkasan breakdown tidak boleh mengubah supplier catalog, prefill supplier, atau menjadikan harga supplier sebagai harga aktual wajib.


## Purchases - OCR Shopee UI dan Print Guard

Status source terbaru:
- UI draft OCR Shopee di Purchases sudah dipisah ke `src/pages/Transaksi/components/PurchaseOcrDraftPanel.jsx`.
- Popup/detail struk OCR Shopee sudah dipisah ke `src/pages/Transaksi/components/PurchaseOcrReceiptModal.jsx`.
- CSS receipt OCR sudah keluar dari `src/App.css` dan berada di `PurchaseOcrReceiptModal.css` agar tidak menjadi style global seluruh aplikasi.
- Print popup OCR memakai guard `body.purchase-ocr-print-mode`, sehingga rule print yang menyembunyikan `body *` hanya aktif saat user print receipt OCR.
- Setelah klik Terapkan Qty & Biaya ke Form, UI wajib memberi feedback lokal di panel OCR, bukan hanya toast global.

Guard tersisa:
- Parser OCR tetap di `src/utils/purchases/shopeePurchaseOcrParser.js` dan tidak boleh dipindah ke UI component.
- `purchaseNoteDisplay.js`, purchase payload, stock mutation, expense otomatis, dan inventory log tidak boleh berubah hanya karena cleanup UI OCR.
- OCR Apply hanya mengisi draft form; transaksi tetap hanya terjadi saat user klik Simpan Pembelian.
- Jangan mengembalikan CSS OCR receipt ke `src/App.css` kecuali terbukti harus menjadi shared global style.

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
- Lookup purchase terakhir di Raw Material/Supplier/Dashboard sudah diberi guard ringan, tetapi masih perlu desain query/index atau read model jika data historis makin besar dan butuh presisi penuh.
- Dashboard summary masih kandidat optimasi range/limit per collection, tetapi tidak boleh mengubah angka summary tanpa regression test.

## Update Retur & Inventory Log Guarded — 2026-04-26

### Status source terbaru
- AKTIF: `Returns.jsx` tetap menjadi halaman operasional untuk mencatat retur produk dan bahan baku.
- GUARDED: submit retur sekarang menjalankan dokumen retur, mutasi stok, dan `inventory_logs` dalam satu Firestore transaction.
- AKTIF: item bervarian tetap wajib memilih `variantKey` agar stok retur masuk ke varian yang benar, bukan master/default.
- AKTIF: payload log retur memakai `buildInventoryLogPayload()` agar schema audit sama dengan writer inventory aktif lain.
- LEGACY: flow lama yang mengubah stok lebih dulu lalu membuat dokumen retur/log harus dianggap tidak aman karena bisa membuat stok berubah tanpa audit lengkap.
- CLEANUP CANDIDATE: orkestrasi transaction retur masih berada di page `Returns.jsx`; jika modul Retur makin kompleks, logic ini bisa dipindahkan ke service khusus tanpa mengubah business rule.

### Risiko tersisa
- Retur belum memiliki flow cancel/revert atau hard delete guarded di UI aktif; jika nanti ditambahkan, harus memakai guard idempotent agar tidak double posting stok.
- `addInventoryLog()` di `inventoryService.js` masih dipertahankan untuk caller lain dan masih best-effort; task ini hanya mengunci flow Retur agar audit log tidak silent hilang.
- Multi-user conflict sudah lebih aman karena transaction membaca item terbaru sebelum update, tetapi regression varian tetap wajib diuji setelah patch.

## Update Stock Management Guarded - 2026-04-26

### Status source terbaru
- `StockManagement.jsx` tetap read-only untuk riwayat inventory log dan tidak membuat mutasi stok saat halaman dibuka.
- Kolom generik `Stok` tidak ditampilkan karena snapshot before/after belum reliable untuk semua writer log lama/baru.
- Tabel fokus pada Tanggal, Arah, Sumber, Item, Qty, Referensi Audit, dan Catatan ringkas.
- `StockAdjustmentPanel.jsx` sekarang memakai Firestore transaction untuk menyimpan `stock_adjustments`, update stok master/varian, dan `inventory_logs` bersama.
- Submit adjustment tetap memakai validasi `availableStock` untuk adjustment keluar dan varian wajib untuk item bervarian.

### Tech debt tersisa
- Orkestrasi transaction adjustment masih berada di component, bukan service khusus inventory adjustment. Ini diterima sementara agar patch tidak melebar.
- Pagination server-side inventory log masih kandidat optimasi jika data real sudah besar.
- Kolom `Stok Setelah` baru boleh ditambahkan jika semua writer inventory log sudah punya snapshot before/after konsisten.

## Update Supplier UI dan Query Performance Ringan - 2026-04-26

### Status source terbaru
- AKTIF: tabel utama Supplier sekarang difokuskan ke informasi inti: Nama Supplier, Link Toko, Katalog Restock Ringkas, Harga Estimasi Ringkas, dan Aksi.
- GUARDED: kolom Aksi Supplier tidak memakai fixed/sticky right agar tidak transparan, tidak menumpuk, dan tidak memaksa user scroll kanan hanya untuk klik aksi.
- AKTIF: detail lengkap tetap berada di drawer Supplier, termasuk Qty Beli, Satuan Beli, Konversi Supplier, Harga Barang Supplier, Ongkir Default, Biaya Layanan Default, Voucher Default, dan Harga Supplier Tercatat.
- AKTIF: Supplier tetap katalog restock/pembanding; tidak membuat purchase, tidak mengubah stok, tidak mengubah kas/expense, dan tidak memasang Supplier ke Raw Material berdasarkan `materialDetails`.
- GUARDED: Dashboard tidak lagi membaca seluruh collection `purchases` hanya untuk Restock Assistant; lookup purchase dibatasi ke material stok kritis yang sedang tampil.
- GUARDED: Supplier dan Raw Material membaca histori purchase terbaru dengan batas lookup ringan untuk pembanding/link restock read-only.
- LEGACY: purchase lama yang belum punya `itemId` standar atau berada di luar jendela lookup ringan bisa tidak muncul di ringkasan. Histori lengkap tetap harus dibaca dari laporan/transaksi, bukan dari drawer ringkas.
- CLEANUP CANDIDATE: buat service `latestPurchaseLookup` atau read model khusus jika data purchase sudah besar dan index Firestore final sudah diputuskan.

### Risiko tersisa
- Dashboard masih membaca beberapa collection operasional penuh untuk summary produksi, payroll, income, expense, dan stok. Ini sengaja belum di-limit karena limit yang salah bisa menyembunyikan status penting.
- Raw Material dan Supplier lookup terbaru masih memakai jendela baca ringan, bukan lookup per material yang benar-benar presisi untuk semua data historis.
- Jika nanti muncul error Firestore index pada query baru, buat index sesuai pesan Firebase dan jangan ubah business rule.

## Auth/User Management Final State — 2026-05-01

Status: **AKTIF + GUARDED**. Section ini menggantikan catatan transisi Auth/Role lama setelah migrasi ke `@ziyocraft.com` selesai.

### Status aktif

- Login internal aktif memakai username yang dimapping ke email `username@ziyocraft.com`.
- Firebase Authentication menyimpan password dan session.
- Firestore `system_users/{uid}` menyimpan profile internal, role, status, dan metadata user IMS.
- Role aktif final hanya `administrator` dan `user`.
- Manajemen User mengelola profile Firestore berdasarkan Auth UID manual dari Firebase Console.
- Tombol **Hapus Profile** tetap aktif untuk cleanup profile aman dan hanya menghapus dokumen Firestore.
- Frontend tidak membuat, mengubah password, atau menghapus Firebase Authentication user.

### Data yang harus bersih setelah cleanup

Firestore `system_users` idealnya hanya berisi profile aktif yang benar, misalnya:

- `Admin @admin` dengan `role = administrator`, `status = active`.
- `user @user` dengan `role = user`, `status = active`.

Data berikut adalah **LEGACY** dan seharusnya tidak ada lagi setelah cleanup: profile dengan `role = super_admin`, username `admin_legacy`, username `user_legacy`, atau profile orphan yang UID Firebase Auth-nya sudah tidak ada.

### Guard yang tetap berlaku

- User tanpa profile Firestore ditolak masuk aplikasi utama.
- User inactive ditolak masuk aplikasi utama.
- Role tidak dikenal default deny.
- Duplicate username tetap ditolak via `usernameLower`.
- User biasa tidak boleh membuka Manajemen User.
- User tidak boleh mengubah role/status dirinya sendiri.
- Hapus profile diri sendiri ditolak.
- Hapus administrator aktif terakhir ditolak oleh service/UI.
- Hapus Profile tidak menghapus Firebase Authentication user.

### Firestore Rules current state

=====================================================
SECTION: Firestore Rules external backend setup — AKTIF / GUARDED
Fungsi:
- Menjelaskan bahwa rules backend wajib ada dan aman, tetapi file rules belum menjadi bagian repo ZIP saat ini.

Dipakai oleh:
- AuthContext, ProtectedRoute, User Management, semua service Firestore client, dan checklist deployment.

Alasan perubahan:
- Owner mengonfirmasi rules dikelola langsung di Firebase Console, bukan disimpan sebagai `firestore.rules` pada repo ini.

Catatan cleanup:
- Jika owner ingin rules source-controlled, buat task patch terpisah untuk menambahkan file rules dan menyesuaikan deploy config.

Risiko:
- UI guard tanpa backend rules aman tidak cukup; rules manual yang terlalu longgar atau terlalu sempit bisa membuka data atau memutus flow bisnis.
=====================================================

- Firestore Rules wajib aktif dan aman di backend Firebase.
- Pada repo ZIP aktual, `firestore.rules`, `firestore.indexes.json`, dan `firebase.json` disertakan sebagai source-controlled artifact, tetapi patch ini tidak mengubah rules karena arah owner adalah SQLite/offline database.
- Kondisi ini bukan bug source wajib untuk patch ini, tetapi tetap menjadi dependency deployment/security yang harus diverifikasi di Firebase.
- Rules final/staged-final wajib membaca actor profile dari `system_users/{request.auth.uid}`.
- Rules aktif hanya mengenal role `administrator` dan `user`.
- `system_users` guarded khusus: user baca profile sendiri, administrator mengelola profile user lain.
- Collection bisnis utama diberi akses staged-final untuk profile aktif agar flow utama bisa dites tanpa kembali ke rules cleanup longgar.
- Fallback collection tidak dikenal harus deny.

### Legacy / cleanup candidate

- Domain lama `@ims-bunga-flanel.local` adalah **LEGACY**.
- Role `super_admin` adalah **LEGACY / REMOVED FROM ACTIVE FLOW**.
- Flow migrasi UID/domain lama adalah **CLEANUP CANDIDATE** jika masih ada sisa comment/utility lokal.
- Alias atau comment lama yang menyebut admin/super dalam source non-scope boleh dirapikan pada task kecil terpisah jika tidak mengubah behavior.
- Whitelist rules backend manual/external masih harus diuji runtime untuk Dashboard, Supplier, Purchases, Sales, Produksi, Cashflow, dan Reports.

### Risiko tersisa

- Publish rules backend yang terlalu sempit dapat menimbulkan `Missing or insufficient permissions` pada modul bisnis yang collection-nya belum terdaftar.
- Rules tidak ideal untuk menghitung administrator aktif terakhir; guard agregat itu tetap wajib ada di service/UI.
- Jika data Firestore lama ternyata belum bersih, role/profile legacy akan ditolak oleh flow final dan perlu cleanup manual terbatas.

### Boundary yang tidak disentuh

Cleanup Auth/User Management tidak mengubah business rules stok, pembelian, penjualan, retur, produksi, payroll, HPP, laporan, dashboard, pricing rules, atau reset maintenance.

## Update Current State — Batch Fix Bug Merge 2026-05-03
- **AKTIF:** `src/utils/formatters/numberId.js` menjadi standar no-decimal untuk display dan parser input integer Indonesia.
- **AKTIF:** halaman-halaman transaksi, master, inventory, produksi, finance, dan laporan yang masuk scope patch diarahkan memakai input/display angka bulat.
- **GUARDED:** `src/pages/Produksi/ProductionOrders.jsx` dan `src/services/Produksi/productionOrdersService.js` sudah diperketat agar requirement material bervarian menampilkan/memakai stok varian, bukan fallback master.
- **GUARDED:** `src/services/Produksi/productionWorkLogsService.js` membawa kontrak resolved variant dari PO ke Work Log, dan menambahkan metadata operator pada inventory log output produksi baru.
- **AKTIF:** `src/pages/Inventory/StockManagement.jsx` membaca catatan operator/worker dari metadata inventory log produksi baru dengan fallback aman untuk log lama.
- **GUARDED:** `src/pages/Produksi/SemiFinishedMaterials.jsx` dan `src/services/Produksi/semiFinishedMaterialsService.js` menjaga rename warna varian agar tidak mengganti `variantKey` / bucket stok.
- **AKTIF:** `src/components/Layout/Sidebar/SidebarMenu.jsx` menerapkan accordion nested menu role-aware.
- **AKTIF:** `src/pages/Auth/Login.jsx` dan `Login.css` membersihkan teks teknis internal pada login normal.

### Legacy / cleanup candidate
- **LEGACY:** data angka lama yang sudah decimal tetap mungkin ada di Firestore; patch ini tidak melakukan migrasi/backfill.
- **LEGACY:** inventory log produksi lama tanpa worker metadata tetap tampil dengan fallback.
- **LEGACY:** PO/Work Log lama tanpa kontrak varian lengkap tetap perlu diperlakukan hati-hati; gunakan refresh need/perbaikan BOM untuk data baru.
- **CLEANUP CANDIDATE:** audit actor `currentUser` null/system pada caller Work Log bisa dirapikan pada task terpisah.
- **CLEANUP CANDIDATE:** jika diperlukan, buat backfill manual dengan preview untuk log produksi lama, bukan otomatis.

### 8. Variant generic masih transisi
Temuan terkini:
- Product dan Semi Finished sudah diarahkan memakai nama/label varian generic, bukan hanya warna.
- Field `color` tetap dipertahankan sebagai alias legacy agar modul lama yang masih membaca warna tidak langsung rusak.
- Aktivasi varian untuk data lama sudah guarded: stok/reserved master harus aman terlebih dahulu.

Risiko tersisa:
- Data lama dengan stok master > 0 belum punya flow alokasi stok master ke beberapa varian dengan audit. Itu harus menjadi task terpisah jika dibutuhkan.
- Semi Finished masih area produksi guarded; Stock Adjustment resmi sudah mendukung koreksi stok Semi Finished, tetapi konversi stok lama ke varian tetap tidak boleh dilakukan otomatis tanpa desain audit produksi.

## UI Read-only Panel / Alert Semantics — 2026-05-03

### Status aktif
- Stock Adjustment snapshot stok terpilih memakai panel read-only clean, bukan bubble `Alert`, agar info pasif tidak terlihat seperti warning.
- Sales dan Returns stock snapshot pasif memakai panel read-only clean agar stok master/varian terbaca konsisten tanpa mengubah validasi stok, payload transaksi, atau flow income/retur.
- Raw Material ringkasan varian dan Semi Finished ringkasan stok master memakai panel read-only clean karena keduanya hanya summary pasif, bukan warning.
- Perubahan ini presentational-only: validasi `availableStock`, pilihan `variantKey`, transaction `stock_adjustments`, mutasi stok, `inventory_logs`, Sales stock reduction, income timing, dan Returns stock-in tetap mengikuti flow existing.

### Cleanup candidate
- Beberapa page-level explanation atau detail read-only di Supplier Purchases dan modul produksi masih memakai `Alert` info. Area tersebut boleh dirapikan bertahap jika terbukti pasif, tetapi jangan mengganti warning/error/destructive/security guard.

## Update Current State — Cash In delete lock dan Sales tab guard — 2026-05-03

### Status aktif
- **AKTIF/GUARDED:** `src/pages/Finance/CashIn.jsx` tidak lagi menyediakan tombol/kolom Hapus di tabel Pemasukan.
- **AKTIF:** halaman Pemasukan tetap membaca gabungan `revenues` dan `incomes` serta tetap mendukung create pemasukan manual ke `revenues`.
- **GUARDED:** `incomes` auto Sales income tetap read-only dari sudut UI Pemasukan; flow auto income Sales tidak diubah.
- **AKTIF/GUARDED:** `src/pages/Transaksi/Sales.jsx` menerapkan client-side guard status tab agar tabel tidak menampilkan row dari status lain saat query ulang, fetch gagal, atau state lama masih tertahan.
- **AKTIF:** search `saleNumber`/`referenceNumber`/`sourceRef` dan `externalReferenceNumber` tetap bekerja setelah filter status aktif.

### Legacy / cleanup candidate
- **LEGACY:** data lama di `revenues` dan `incomes` tetap valid dan tidak dimigrasi.
- **LEGACY:** sales lama dengan status/reference lama tetap tampil sesuai status yang tersimpan.
- **CLEANUP CANDIDATE:** jika suatu hari diperlukan delete ledger, harus dibuat flow khusus dengan approval, audit trail, dan alasan bisnis, bukan tombol Hapus biasa di Cash In.
- **AKTIF/GUARDED:** Sales memakai no-cancel/no-delete user action; rollback teknis tidak boleh dijadikan tombol Batalkan/Hapus di tabel Sales.


## Update Current State — Repository root assets cleanup — 2026-05-06

=====================================================
SECTION: Root assets cleanup — CLEANUP CANDIDATE
Fungsi:
- Menandai root `assets/` sebagai sisa build artifact yang tidak dipakai source aktif.

Dipakai oleh:
- Repository hygiene, `.gitignore`, dan patch cleanup changed-files-only.

Alasan perubahan:
- Owner mengonfirmasi root `assets/` lupa terhapus dan hasil grep tidak menemukan referensi runtime aktif ke file build artifact tersebut.

Catatan cleanup:
- Root `/assets/` di-ignore agar artifact serupa tidak ikut masuk repo lagi; `src/assets` tetap tracked.

Risiko:
- Pattern ignore tanpa slash depan dapat ikut mengabaikan `src/assets` dan merusak branding/logo aktif.
=====================================================

### Current state
- **CLEANUP CANDIDATE:** root `assets/` berisi build artifact lama, bukan source aktif.
- **AKTIF:** asset aplikasi yang dipakai source tetap berada di `src/assets`, misalnya logo/branding.
- `.gitignore` harus memakai pattern root-only `/assets/` agar tidak mengabaikan `src/assets`.

## Update Current State — Sales pending income dan no-delete action — 2026-05-03

### Current state
- **AKTIF:** halaman Sales menampilkan summary read-only **Pemasukan Pending** dari sales status `Diproses` dan `Dikirim`.
- **GUARDED:** Pemasukan Pending hanya derived value di UI Sales; tidak menulis `revenues`, tidak menulis `incomes`, tidak masuk Cash In, dan tidak masuk Profit Loss.
- **AKTIF:** tabel Sales membaca satu dataset sales lalu memfilter client-side sesuai `activeTabKey` agar tab status tidak kosong karena query per-status/index Firestore.
- **AKTIF:** tombol Delete/Hapus/Batalkan tidak tampil sebagai aksi user biasa di tabel Sales; barang kembali tetap melalui Return.
- **AKTIF:** dropdown item/varian Sales disederhanakan karena detail stok sudah tampil di panel read-only.
- **GUARDED:** mutasi stok Sales create/status selesai tetap transactional; income timing tetap hanya status `Selesai`, Cash In/Profit Loss tetap membaca `revenues + incomes` resmi.

### Legacy / cleanup candidate
- **LEGACY:** sales lama dengan status/reference lama tetap ditampilkan sesuai data tersimpan; tidak ada migrasi otomatis.
- **CLEANUP CANDIDATE:** hard delete Sales dapat dirancang sebagai maintenance/admin guarded flow terpisah jika benar-benar dibutuhkan.
- **CLEANUP CANDIDATE:** bila data Sales membesar, strategi fetch all + client filter dapat diganti pagination/query server-side yang tetap menjaga fallback aman.

## Update UI Theme Brand — 2026-05-04

### Status theme aktif
- **AKTIF:** theme aplikasi memakai identitas Flanel Karawang Industries dengan kombinasi blue/yellow/white/navy.
- **AKTIF:** pusat token theme berada di `src/index.css` untuk CSS variable global dan `src/theme/antdTheme.js` untuk token Ant Design.
- **AKTIF:** `src/App.css` tetap menjadi guard visual global untuk app shell, table, modal, drawer, dropdown, form, dan portal Ant Design.
- **AKTIF:** `src/main.jsx` melakukan bootstrap `app-theme-light/dark` dan `data-app-theme` sebelum React render untuk mengurangi flash theme pada user yang menyimpan dark mode.
- **AKTIF:** Login, Sidebar, Header, Dashboard, PageHeader, PageSection, SummaryStatCard, FilterBar, dan PageFormModal diarahkan membaca token global agar tidak drift antar halaman.

### Area guarded theme
- **GUARDED:** `AppLayout.jsx` menjaga sinkronisasi `app-theme-light`, `app-theme-dark`, dan `data-app-theme` di `html/body` agar portal Ant Design membaca mode yang benar. Initial state harus membaca bootstrap theme/localStorage, bukan default light lalu diperbaiki di `useEffect`.
- **GUARDED:** override table/modal/drawer/dropdown di `src/App.css` tidak boleh dihapus massal karena menjaga surface solid dan kontras light/dark.
- **GUARDED:** `PageFormModal` harus mempertahankan `rootClassName="page-form-modal-root"` dan `getContainer` agar modal/drawer/dropdown tidak bocor ke surface lama.
- **GUARDED:** `SidebarMenu` role-aware logic, nested accordion, `selectedKeys`, dan `openMenuKeys` tidak boleh diubah saat task hanya visual theme.
- **GUARDED:** Login auth flow (`handleLogin`, profile status, blocked user, logout) dan Dashboard read-only query tidak ikut theme cleanup.

### Legacy dan cleanup candidate
- **LEGACY:** komentar/arah visual lama yang mengarah ke theme decorative lama harus dianggap historis, bukan theme aktif.
- **CLEANUP CANDIDATE:** hardcoded neutral lama yang sudah tertimpa token bisa dirapikan bertahap, tetapi jangan menghapus guard Ant Design bila dependency belum jelas.
- **CLEANUP CANDIDATE:** file luar scope yang masih memakai warna lokal sebaiknya diaudit per modul agar tidak bercampur dengan perubahan business flow.

## Cleanup Theme Aman — 2026-05-04

### Cleanup yang sudah dilakukan
- **AKTIF:** `Login.css` sekarang memakai token brand langsung pada blok utama, sehingga blok override `Login Brand Token Sync` yang duplikatif tidak lagi diperlukan.
- **AKTIF:** `SidebarMenu.css` mobile selected state sudah memakai token `--ims-sidebar-active` dan `--ims-border-color-soft`, bukan warna hardcoded lokal.
- **AKTIF:** `App.css` dibersihkan dari utility `.ims-action-group--inline` yang tidak memiliki pemakai aktif pada snapshot terbaru.
- **AKTIF:** komentar theme di `index.css`, `antdTheme.js`, dan `App.css` dirapikan agar tidak memicu audit legacy theme palsu.
- **AKTIF:** selector CSS top-level untuk table surface di `App.css`, surface `PageSection.css`, state sidebar `SidebarMenu.css`, dan surface `PageFormModal.css` dikonsolidasikan agar token final tidak saling menimpa.
- **AKTIF:** Finance Dock di `SummaryStatGrid` tidak lagi memakai flow strip/bar bawah; Cash In/Cash Out memakai class scoped `cash-flow-summary` agar total utama dominan, metric pendukung tidak dobel, helper tampil di bawah nominal, dan nominal Rupiah tidak terpotong.

### Guard yang tetap dipertahankan
- **GUARDED:** override table/modal/drawer/dropdown/datepicker/popover di `App.css` tetap dipertahankan karena menjaga surface Ant Design tetap solid di light/dark mode.
- **GUARDED:** selector global Ant Design boleh dipakai sebagai guard, tetapi selector top-level yang sama tidak boleh punya dua nilai token final berbeda di bawah file.
- **GUARDED:** `Login.jsx`, `AppLayout.jsx`, `SidebarMenu.jsx`, route guard, AuthContext, Dashboard query, service, transaksi, stok, cashflow, produksi, payroll, HPP, dan reports tidak disentuh oleh cleanup theme ini.

### Cleanup candidate lanjutan
- **CLEANUP CANDIDATE:** konsolidasi `!important` di `App.css` masih perlu visual regression khusus table/modal/drawer/dropdown sebelum dihapus lebih jauh.
- **CLEANUP CANDIDATE:** warna lokal di halaman bisnis tetap perlu audit per modul agar tidak bercampur dengan logic transaksi atau service.

## Update Login visual polish — 2026-05-04

### Status aktif
- **AKTIF:** halaman Login memakai komposisi brand panel dan form card yang lebih seimbang.
- **AKTIF:** logo resmi Flanel Karawang Industries ditampilkan sebagai brand lockup clean tanpa frame/orb besar yang menumpuk visual.
- **AKTIF:** dekorasi background Login dikurangi agar fokus user tetap pada form login.
- **GUARDED:** `Login.jsx` hanya berubah pada struktur visual branding; auth flow `handleLogin`, `loginWithUsername`, `profileStatus`, blocked user, dan logout tidak diubah.

### Cleanup candidate
- **CLEANUP CANDIDATE:** penyesuaian ukuran logo dapat ditinjau ulang jika owner menyediakan versi logo final lain atau standar brandbook resmi.
- **CLEANUP CANDIDATE:** wording brand Login bisa dipoles lagi tanpa menyentuh auth flow.

## Update Login Mode A — Modern Bright Corporate — 2026-05-04

### Status aktif
- **AKTIF:** halaman Login memakai arah visual Mode A: bright corporate dengan brand hero kiri dan form card kanan.
- **AKTIF:** logo Flanel Karawang Industries tampil bebas tanpa frame/showcase berat dan tanpa dekorasi yang menimpa logo.
- **CLEANUP CANDIDATE:** background Login masih memiliki pattern visual lama yang perlu diselaraskan ke standar no-gradient pada batch khusus Login CSS.
- **AKTIF:** mobile Login memakai form-first layout agar user langsung fokus ke login.
- **GUARDED:** perubahan hanya menyentuh struktur/class visual Login; `handleLogin`, `loginWithUsername`, `profileStatus`, blocked user, logout, route guard, role access, dan modul bisnis tidak diubah.

### Cleanup candidate
- **CLEANUP CANDIDATE:** bila brandbook resmi nanti tersedia, ukuran logo, microcopy, dan proporsi hero dapat disesuaikan lagi tanpa menyentuh auth flow.

## Update Login full-page corporate final — 2026-05-04
- **AKTIF:** halaman Login memakai layout full-page corporate sehingga tidak lagi terasa seperti outer wrapper/card besar di tengah viewport.
- **AKTIF:** brand panel kiri memakai aksen geometric minimalis; dekorasi bulat besar tidak lagi menjadi elemen dominan.
- **AKTIF:** logo utama Flanel Karawang Industries diperbesar dan diposisikan lebih presisi dengan whitespace yang lebih baik.
- **AKTIF:** copy deskripsi Login dibuat lebih kecil dan note internal diposisikan sebagai supportive footer note.
- **GUARDED:** perubahan tetap CSS-only; `Login.jsx`, `AuthContext`, route guard, role access, Sidebar, Dashboard, transaksi, stok, cashflow, produksi, HPP, reports, dan service tidak diubah.
- **CLEANUP CANDIDATE:** fine tuning visual Login berikutnya cukup dilakukan di `Login.css`; jangan campur dengan cleanup App.css/AntD portal guard atau business modules.

## Update Login mobile brand-first single card — 2026-06-01
- **AKTIF:** mobile Login memakai satu card menyatu: badge `Inventory Management System` kecil di kiri atas, logo besar tanpa frame/wrap khusus, form tepat di bawah logo, dan note internal setelah form.
- **AKTIF:** heading form `Akses Internal`, `Masuk ke Sistem`, dan deskripsi login disembunyikan pada mobile agar tidak ramai dan logo tetap menjadi fokus visual utama.
- **GUARDED:** perubahan hanya di `Login.css` dan docs; `Login.jsx`, `AuthContext`, route guard, role access, transaksi, stok, produksi, payroll, HPP, finance, report, reset, dan service tidak disentuh.
- **CLEANUP CANDIDATE:** jika nanti desain desktop ingin mengikuti mobile single-card, lakukan batch terpisah karena desktop saat ini tetap mempertahankan layout dua panel existing.

## Update UI Table Compact — 2026-05-06
- Cash In, Stock Adjustment Panel, Pricing Rules, Products, Supplier, Stock Report, dan Semi Finished Materials memakai table utama yang lebih compact tanpa horizontal scroll default pada desktop normal.
- Products, Raw Materials, Stock Report, dan Semi Finished Materials memakai helper presentational `StockDisplayBlock` untuk saldo stok locked: `Total`, `Tersedia`, dan semua variant pill langsung di table jika row membawa `variants[]`.
- Raw Materials table tidak lagi perlu menampilkan warning duplicate seperti `Ada varian kosong...` di bawah stok jika chip/pill stok varian sudah terlihat langsung.
- Preview modal Pricing Rules dan detail drawer Supplier sudah dipadatkan secara UI-only; detail tabular lain tetap boleh memakai scroll bila datanya memang audit/detail, bukan primary table list.
- Cleanup candidate lanjutan: display helper boleh diperluas hanya untuk presentational read-only; jangan campur dengan mutasi stok, service validation, atau report calculation.


## Update Stock Display Alert Cleanup — 2026-05-11
- **AKTIF:** Raw Materials table memakai `StockDisplayBlock` untuk display stok master dan chip/pill varian secara compact.
- **AKTIF:** text tambahan `Ada varian kosong...` tidak ditampilkan lagi di bawah kolom Stok Raw Materials karena chip varian termasuk stok 0 sudah tampil langsung.
- **AKTIF:** Purchases modal tetap menampilkan preview `Current Stock`, `Reserved Stock`, dan `Available Stock`, tetapi tidak lagi menampilkan alert global varian kosong pada card `Stok Aktual Sebelum Restock`.
- **GUARDED:** perubahan ini UI-only; perhitungan stok, stock mutation, inventory log, expense otomatis, supplier catalog, report calculation, route/menu/role guard, schema, dan service/data layer tidak berubah.
- **GUARDED:** helper status Raw Materials tetap dipertahankan untuk status tag `Kosong` / `Stok Rendah`, summary `Perlu Dicek`, filter status, dan alert/rincian detail drawer.

## Update global/auth/route LogoLoadingScreen — 2026-05-07
- **AKTIF:** loading utama aplikasi untuk auth/session gate, ProtectedRoute guard, dan Login auth/profile verification memakai `LogoLoadingScreen`. Lazy route fallback di dalam layout memakai `DataLoadingState` skeleton lokal agar transisi halaman tidak blank tanpa memunculkan logo/fullscreen kedua.
- **AKTIF:** `LogoLoadingScreen` memakai logo mark existing `src/assets/branding/flanel-karawang-mark.png` dengan animasi Elegant micro split dan fallback logo normal jika canvas gagal.
- **AKTIF:** loading dibuat full viewport tanpa card/wrap kecil; `.app-loading-card` dipertahankan sebagai wrapper kompatibilitas tetapi tidak lagi tampil sebagai card.
- **GUARDED:** perubahan ini UI-only; `AuthContext`, `roleAccess`, route definitions, login submit, service, query, transaction, stock, production, payroll, HPP, report, dan reset maintenance tidak berubah.
- **LEGACY-COMPAT:** loading lokal seperti lazy route fallback, table loading, submit button loading, report loading, maintenance preview/loading, dan business process loading tetap boleh memakai komponen lokal/Ant Design sesuai kebutuhan modul.


## Update Header Branding Cleanup — 2026-05-07

Yang sudah dirapikan:
- duplicate app branding di `AppHeader` dibersihkan agar nama aplikasi tidak tampil dobel di sidebar dan top header;
- sidebar/logo menjadi source utama identitas aplikasi `IMS Bunga Flanel`;
- top `AppHeader` sekarang menjadi page-context header yang menampilkan judul halaman aktif dan subtitle ringkas berbasis pathname;
- perubahan dibatasi UI-only pada layout/header/sidebar, tanpa mengubah route/menu/role guard, service, schema, transaksi, stok, produksi, payroll, HPP, report, atau reset destructive flow.

Risiko tersisa:
- mapping title/subtitle masih lokal di `AppHeader.jsx`; jika nanti route bertambah, mapping perlu ditambah agar title tidak memakai fallback generik;
- halaman yang sudah punya page header internal tetap perlu dicek manual agar tidak terasa terlalu repetitif.

## Update Content PageHeader Dedup Cleanup — 2026-05-07

Yang sudah dirapikan:
- **AKTIF:** `AppHeader` global menjadi source utama page title/subtitle agar konteks halaman tidak tampil dobel.
- **AKTIF:** `PageHeader` content berubah fungsi menjadi compact toolbar/action strip; title/subtitle lama tetap diterima untuk kompatibilitas, tetapi tidak ditampilkan default.
- **AKTIF:** `ProductionPageHeader` content berubah fungsi menjadi compact toolbar/action strip; action penting seperti Tambah/Generate/extra tetap dipertahankan.
- **GUARDED:** perubahan dibatasi UI-only pada shared header/toolbar dan spacing global, tanpa menyentuh halaman bisnis satu per satu, route/menu/role guard, service, schema, transaksi, stok, produksi flow, payroll, HPP, report, atau reset destructive flow.

Risiko tersisa:
- mapping title/subtitle masih lokal di `AppHeader.jsx`; jika route baru ditambahkan, mapping top header perlu diperbarui agar fallback tidak terlalu generik;
- beberapa halaman mungkin masih memiliki section title internal yang valid sebagai judul blok, sehingga review visual tetap perlu membedakan page title duplicate vs section title yang memang diperlukan.

## Update UI Shell Header/Page Header — 2026-05-07

Status terbaru:
- sidebar logo/brand tetap menjadi lokasi utama identitas aplikasi `IMS Bunga Flanel`;
- top `AppHeader` dikembalikan menjadi toolbar global ringan, bukan tempat page title besar;
- nama menu/page title dan subtitle dikembalikan ke `PageHeader` di dalam content card agar tidak terasa mengambang di area shell;
- `ProductionPageHeader` kembali menampilkan title/description produksi di content area sambil tetap mempertahankan action `Tambah`/`Generate`/`extra`;
- unified sidebar + header surface light/dark tetap dipertahankan sebagai UI shell;
- perubahan ini UI-only dan tidak menyentuh service/data layer, schema, route guard, role guard, stok, transaksi, produksi logic, payroll, HPP, report calculation, atau reset maintenance flow.

Keputusan UI:
- brand aplikasi hanya di sidebar/logo;
- top header hanya toolbar/workspace + user/action;
- page context berada di content card melalui shared page header.

Risiko tersisa:
- halaman yang tidak memakai `PageHeader`/`ProductionPageHeader` mungkin perlu audit visual terpisah jika page title tidak tampil;
- title/subtitle panjang tetap harus dicek pada laptop 1280px dan mobile agar tidak menyebabkan overflow.


## Update Minimum Stock Read-Only Alignment — 2026-05-07

Status: **AKTIF + GUARDED**.

- Service Product dan Semi Finished terbaru sudah memakai threshold master (`products.minStockAlert` dan `semi_finished_materials.minStockAlert`), sehingga tidak perlu service patch untuk batch alignment ini.
- Raw Material tetap memakai `raw_materials.minStock` sebagai threshold master.
- Dashboard `Stok Kritis` sekarang diselaraskan sebagai consumer read-only untuk Product, Raw Material, dan Semi Finished dengan comparator `availableStock ?? currentStock ?? stock ?? 0`.
- Stock Report sekarang memakai threshold master per entity untuk status `Habis/Kritis/Normal`, bukan threshold statis global `10` sebagai sumber utama.
- `variants[].minStockAlert` Product/Semi Finished tetap legacy-compat untuk data lama/helper generic dan tidak boleh dipakai sebagai source threshold aktif.
- Batch ini tidak mengubah stok fisik, reserved/available calculation, inventory log, transaksi, produksi, payroll, HPP, schema, atau migration data lama.


## Update Brand Theme Alignment — 2026-05-07

Status: **AKTIF + GUARDED UI-ONLY**.

- Theme global/shared diarahkan ke flat corporate minimalist: blue/navy sebagai primary dan muted gold/yellow sebagai accent kecil.
- Brand gold dipisahkan dari semantic warning; warning tetap amber/orange agar status bisnis tidak ambigu.
- Global/shared shell, Ant Design token, sidebar menu, header, sidebar logo, SummaryStatCard, FilterBar, cash summary, Dashboard card terpilih, dan OCR receipt tidak lagi memakai gradient aktif pada source yang sudah disentuh.
- Gold accent dipakai terbatas sebagai marker active menu, ornament kecil header/sidebar, dan accent line kecil shared card/filter.
- Perubahan batch ini tidak menyentuh service, query, schema, route guard, role guard, auth flow, transaksi, stok, produksi, payroll, HPP, report mapper, atau reset destructive flow.
- **CLEANUP CANDIDATE:** `src/pages/Auth/Login.css`, `src/components/Layout/Feedback/DataLoadingState.css`, dan `src/components/Layout/Feedback/LogoLoadingScreen.css` masih memiliki gradient/page-specific atau feedback-specific style lama dan perlu batch cleanup terpisah sesuai allowlist. Dashboard/OCR receipt yang sudah disentuh tidak boleh dikembalikan ke gradient dekoratif.
- **CLEANUP CANDIDATE:** hardcoded color residual di page/component bisnis tetap perlu audit bertahap tanpa refactor logic.

## Update Pricing Mode Shared UI — 2026-05-11

Status: **AKTIF + GUARDED DOCS-SYNC**.

Current state:
- `PricingModeSwitch` sudah menjadi shared UI untuk Product dan Raw Material.
- Source aktual: `Products.jsx` dan `RawMaterials.jsx` mengimpor `PricingModeSwitch`, tetapi registrasi field `pricingMode` tetap local lewat hidden `Form.Item` agar payload form dan validasi service tidak berubah.
- Auto-preview dan warning harga tetap local di `Products.jsx` dan `RawMaterials.jsx` sebagai keputusan aman karena Product memakai base cost/target price berbeda dari Raw Material.
- Handler halaman wajib tetap membersihkan `pricingRuleId` dan `pricingPreviewWarning` saat user kembali ke Manual.
- Formula preview tetap lewat `buildSinglePricingPreview`; docs tidak boleh mengarahkan pembuatan rumus baru di page/component.
- Service validation Product dan Raw Material tetap menjadi guard final untuk kewajiban `pricingRuleId` saat `pricingMode = rule`; mode Manual tetap boleh tanpa `pricingRuleId`.

Cleanup candidate berikutnya:
- shared display helper untuk label/status pricing mode boleh dipertimbangkan jika duplikasi tampilan makin banyak;
- auto-preview hook hanya boleh dibuat jika config kecil, eksplisit, dan tidak membuat logic base cost/target price sulit dibaca;
- jangan mengubah formula pricing, service validation, schema/collection, route/menu, atau role guard dalam cleanup UI pricing.

Legacy compatibility:
- Data lama tanpa `pricingMode` harus divalidasi hati-hati sebelum mengubah fallback behavior karena fallback Manual/Rule yang salah bisa mengubah cara harga lama dibaca.
- Jangan menghapus atau memigrasi `pricingRuleId` lama tanpa audit data dan approval terpisah.

## Update 2026-05-10 — Tahap 1 & 2: Validasi Form + Referensi Display

### Tahap 1 — Popup field wajib
- Status: AKTIF.
- Form yang memakai `PageFormModal` sekarang otomatis menampilkan popup `Data belum lengkap` saat submit gagal validasi AntD.
- Form/drawer custom penting juga diberi feedback yang sama lewat helper `showFormValidationFeedback`.
- Perubahan ini hanya UI feedback: tidak mengubah service create/update, schema, kalkulasi stok, payroll, HPP, finance, atau laporan.
- Catatan cleanup: label field bisa distandarkan lagi per halaman jika semua form sudah punya naming final.

### Tahap 2 — Referensi display manusiawi
- Status: AKTIF / LEGACY-COMPAT.
- `referenceId`, `sourceId`, `relatedId`, dan Firestore document ID tetap dipakai sebagai relasi internal.
- UI tabel/detail/report/ledger mengutamakan kode bisnis seperti `code`, `planCode`, `workNumber`, `payrollNumber`, `sourceRef`, `referenceNumber`, atau `productionOrderCode`.
- Data lama yang hanya punya ID random tidak boleh ditampilkan sebagai fallback audit UI baru; gunakan fallback manusiawi seperti `-` atau `Referensi belum tersedia`, lalu catat kebutuhan backfill/migrasi sebagai cleanup terpisah.
- Karena project masih tahap membangun dan punya menu reset data, tidak perlu migrasi otomatis. Data dummy lama boleh dibuat ulang saat format referensi baru sudah final.
- Risiko yang dijaga: resolver display tidak boleh dipakai untuk write relasi Firestore.

## Current State — Standar Referensi Audit Manusiawi dan Technical ID

- **Docs target baru:** Referensi ID bisnis manusiawi adalah acuan utama audit, pencarian, relasi operasional, table/detail/drawer/report UI, dan export user-facing.
- **Guarded:** Technical ID / Firestore random ID tidak boleh ditampilkan sebagai referensi audit UI, tooltip, detail sekunder, drawer, report UI, atau fallback display.
- **Guarded:** UI yang belum punya referensi bisnis readable harus memakai fallback manusiawi seperti `-` atau `Referensi belum tersedia`.
- **Aktif:** tabel Retur memakai resolver referensi display dan tidak boleh fallback ke `record.id`, `returnId`, atau `referenceId` sebagai teks referensi/tooltip user-facing.
- **Current source mismatch:** source terbaru masih perlu audit karena beberapa helper/generator masih menyimpan mapping manual kata tertentu, terutama `src/utils/references/businessCodeGenerator.js` dan `src/utils/references/productionCodeGenerator.js`.
- **Current source mismatch:** source terbaru masih perlu audit untuk flow create yang masih memakai Firestore auto ID sebagai document ID bisnis, serta flow log yang masih mungkin memakai random ID.
- **Important:** patch ini docs-only. Jangan menulis seolah-olah source generator, service write flow, schema, collection, inventory log writer, atau report/export sudah berubah.

### Cleanup Candidate — Referensi ID dan Generator Kode

- Satukan `businessCodeGenerator`, `productionCodeGenerator`, atau generator kode terkait ke satu shared source of truth.
- Hapus mapping manual/dictionary kata dari generator pada task source terpisah.
- Standarkan algoritma singkatan universal berbasis konsonan lintas modul.
- Ubah flow create setelah reset data agar memakai Referensi ID bisnis sebagai document ID jika collection bersifat 1 dokumen = 1 referensi dan migrasinya aman.
- Ubah inventory log baru agar memakai ID turunan readable seperti `LOG-PUR-YYYYMMDD-0001-001`, bukan random ID, jika satu referensi dapat memiliki banyak log.
- Audit report/export/menu/detail/drawer agar tidak fallback ke Technical ID.
- Stock Management UI harus tidak menampilkan Technical ID/random ID sebagai referensi audit, tooltip, atau fallback display.
- Audit kode audit immutable: edit nama/ref tidak boleh otomatis mengubah kode lama tanpa approval migrasi.

## Current State — Reset & Maintenance Decision Center

- **Aktif:** halaman `src/pages/Utilities/ResetMaintenanceData.jsx` sekarang diarahkan menjadi Maintenance Decision Center: audit dulu, preview dampak, export data pokok, lalu pilih reset/repair.
- **Aktif:** rekomendasi default untuk data development yang belum real adalah simpan master, hapus transaksi/log turunan, lalu nolkan stok jika stok lama tidak dipercaya.
- **Aktif:** panel `Detail Audit / Tools` lama sudah dihapus dari UI utama agar Reset Maintenance tidak menampilkan informasi dan tombol audit yang dobel; akses utama sekarang lewat Auto Detect Bug, Repair Turunan Aman, Reset & Baseline, Data Test Seed & Export, dan HPP Trial ringkas.
- **Aktif:** guide `Cara Pakai Setelah Patch` dipisah ke `src/pages/Utilities/components/ResetUsageGuidePanel.jsx` sebagai UI-only extraction; tidak mengubah reset service, confirmation keyword, scope destructive, atau audit log write.
- **Aktif:** export data pokok JSON bersifat read-only dan hanya untuk backup/checklist; export ini bukan restore otomatis dan bukan import logic.
- **Aktif:** tombol `Reset Semua Testing` menjadi shortcut gabungan untuk semua scope non-protected: delete transaksi/log stok/planning/pricing, zero stock master/variant, dan reset field modal/HPP allowlist dengan keyword `RESET SEMUA`.
- **Guarded:** reset total data bisnis/master belum dibuat karena menyentuh protected master collections dan harus menjadi task destructive terpisah.
- **Guarded:** wizard keputusan hanya menyiapkan mode/module reset; eksekusi tetap harus melewati preview dan confirmation keyword existing. Detail audit teknis yang dihapus tidak boleh dikembalikan tanpa alasan UX/QA yang jelas karena bisa membuat info reset dobel lagi.
- **Cleanup candidate:** export XLSX, import normalized, trial session/correlation id, copy/export audit log, dan server-side reset jika total operasi melewati batas aman client.


---

## FINAL LOCKED REFERENCE CODE STANDARD — IMS Bunga Flanel

Status: **LOCKED / GUARDED**. Prefix dan format di bawah ini tidak boleh diubah lagi tanpa approval arsitektur khusus.

| Modul | Prefix final | Format final | Contoh |
|---|---|---|---|
| Customer | `CUS` | `CUS-DDMMYYYY-001` | `CUS-12052026-001` |
| Supplier | `SUP` | `SUP-DDMMYYYY-001` | `SUP-12052026-001` |
| Produk Jadi | `PRD` | `PRD-001` | `PRD-001` |
| Raw Material | `RAW` | `RAW-001` | `RAW-001` |
| Semi Finished | `SFP` | `SFP-001` | `SFP-001` |
| BOM | `BOM` | `BOM-001` | `BOM-001` |
| Production Step | `STP` | `STP-001` | `STP-001` |
| Purchase | `PUR` | `PUR-DDMMYYYY-001` | `PUR-12052026-001` |
| Sales / Order | `ORD` | `ORD-DDMMYYYY-001` | `ORD-12052026-001` |
| Return | `RET` | `RET-DDMMYYYY-001` | `RET-12052026-001` |
| Production Order | `PO` | `PO-[TYPE]-DDMMYYYY-001` | `PO-PRD-12052026-001` |
| Stock Adjustment | `STK-ADJ` | `STK-ADJ-DDMMYYYY-001` | `STK-ADJ-12052026-001` |
| Cash In | `CSH-IN` | `CSH-IN-DDMMYYYY-001` | `CSH-IN-12052026-001` |
| Cash Out | `CSH-OUT` | `CSH-OUT-DDMMYYYY-001` | `CSH-OUT-12052026-001` |
| Work Log | `JOB` | `JOB-DDMMYYYY-001` | `JOB-12052026-001` |
| Payroll | `PAY` | `PAY-DDMMYYYY-001` | `PAY-12052026-001` |

Catatan lock:
- Gunakan **`CSH-OUT`**, bukan `CSH-OT`, `COUT`, atau variasi lain.
- Sales tetap boleh memakai nama field legacy `saleNumber`, tetapi value data baru wajib ber-prefix `ORD`.
- Date sequence wajib memakai `DDMMYYYY` dan sequence 3 digit (`001`, `002`, `003`).
- Master item/config produksi memakai sequence internal sederhana `PREFIX-001`. Kode ini disimpan untuk relasi/backstage dan tidak menjadi fokus UI.
- Firestore random ID tidak boleh tampil sebagai kode audit/user-facing.
- Data lama dengan prefix legacy tetap compatibility, tetapi bukan standar data baru.


### Current state setelah standardisasi code

- Customer/Supplier sudah memakai `CUS`/`SUP` sebagai standard aktif.
- Data baru harus diarahkan ke prefix final locked di tabel di atas.
- Data lama dengan prefix `SAL`, `RM`, `CIN`, `COUT`, `WL`, `ADJ`, atau `STEP` tetap dibaca sebagai legacy compatibility.
- Tech debt yang masih harus dijaga: jangan menampilkan Firestore random ID sebagai audit reference, dan jangan mengubah formula stok/HPP/payroll/report saat hanya patch kode.


### Current state: master item/config code UI

- UI Product, Raw Material, Semi Finished, BOM, dan Production Step diarahkan lebih user-friendly dengan menyembunyikan kode internal dari form utama.
- Kode internal tetap dibuat otomatis oleh service dan tetap disimpan pada data.
- Cleanup candidate: audit semua table/detail agar technical ID atau kode internal tidak tampil sebagai identitas utama master item.
- Cleanup candidate: standardisasi seluruh generator master/transaksi jika masih ada prefix lama pada data baru.
- Risiko yang harus dijaga: jangan menyamakan rule master item dengan transaksi/audit karena nomor transaksi tetap wajib terlihat untuk pencarian dan bukti audit.

## Current State — Master Code Maintenance

Status: **AKTIF / GUARDED**.

- Reset & Maintenance Data punya section **Normalisasi Kode Master** untuk Product, Raw Material, Semi Finished, BOM, Production Step, dan Supplier.
- Normalisasi hanya menyentuh field `code` dan alias kode aktif (`productCode`, `materialCode`, `itemCode`, `bomCode`, `stepCode`, `supplierCode`).
- Aksi ini tidak rename document ID, tidak menghapus data, dan tidak mengubah transaksi/history seperti Purchases, Inventory Log, Work Log, Payroll, atau Sales.
- Tombol/modal repair kode supplier lama sudah tidak ada di halaman Supplier supaya jalur repair kode lama terpusat di Reset & Maintenance Data.

## Update Current State — Sales no-cancel/no-delete guard — 2026-05-17

Status: **AKTIF + GUARDED**.

- `src/pages/Transaksi/Sales.jsx` tidak menyediakan status batal, tombol Batalkan, tombol Delete, atau tombol Hapus sebagai aksi user.
- Transisi status resmi: `Diproses -> Dikirim`, lalu `Dikirim -> Selesai`. Barang kembali/pembeli batal setelah transaksi tercatat wajib lewat **Return**.
- Form create Sales punya submit guard (`isSavingSale` + ref lock) agar double-click Simpan tidak membuat order dobel.
- Aksi batal/revert Sales tidak boleh dihidupkan kembali sebagai action user-facing; barang kembali wajib memakai Return.
- Data Quality Audit tetap boleh mendeteksi Sales belum selesai yang sudah punya income, Sales selesai yang belum punya income, Sales tanpa inventory log `sale`, dan mismatch side-effect aktif lain secara read-only tanpa write otomatis.
- Search Sales wajib mencakup `externalReferenceNumber` karena nomor marketplace/resi disimpan terpisah dari kode internal `ORD-*`.
- Guard income Sales harus membaca legacy link `relatedId`, `saleId`, `referenceId`, `sourceRef`, `referenceCode`, `referenceNumber`, dan `details.*` agar data lama tidak membuat income dobel.
- Data Quality Audit Sales/income harus mencocokkan sale bukan hanya dari Firestore document id, tetapi juga dari `saleNumber`, `code`, `referenceNumber`, dan `sourceRef`.

## Update Current State — Helper cleanup stock formatter dan safeTrim audit — 2026-05-17

Status: **AKTIF / SCOPED CLEANUP**.

- Formatter stok read-only sekarang memakai source of truth `src/utils/formatters/stockUnit.js` untuk Product, Raw Material, Semi Finished, dan `StockDisplayBlock`; helper lokal `formatStockWithUnit` di halaman boleh hanya menjadi alias ke `formatStockWithUnitId`, bukan implementasi formatter baru.
- `src/utils/stock/stockHelpers.js::toNumber()` sekarang wajib finite-safe: input invalid/NaN fallback ke angka aman agar kalkulasi `currentStock`, `reservedStock`, `availableStock`, weighted average, dan helper varian tidak menampilkan/menyimpan `NaN`.
- Audit `safeTrim` menunjukkan helper lokal masih aktif di service/helper guarded seperti produksi, maintenance, supplier, variant, dan reference resolver. Jangan refactor massal `safeTrim` ke helper global tanpa audit field per file karena beberapa dipakai untuk compatibility data lama.
- Helper `safeTrim` lokal yang hanya satu kali dipakai dan tidak memberi konteks business guard boleh dihapus/inlined, tetapi helper yang banyak dipakai di flow guarded tetap dipertahankan.
- Cleanup lanjutan yang masih kandidat: `toOptionMap` constants dan mapper collection production. Jangan digabung dengan patch stok/helper karena mapper production menyentuh Production Order, Work Log, payroll/HPP, dan histori produksi.


## Update Current State: Produksi/HPP Final vs Preview — 2026-05-17
- Detail Work Log menampilkan labor dari payroll final, draft payroll, atau estimasi Step dengan tag compact read-only.
- HPP Analysis memisahkan angka Final dan Preview agar payroll draft/estimasi tidak terbaca sebagai HPP final.
- Overhead produksi aktif berasal dari BOM untuk listrik/glue gun; field hasil selain Good Qty tetap compatibility data lama dan tidak ditampilkan sebagai workflow aktif.
- Data Quality Audit produksi menandai Work Log legacy status, payroll final pending/mismatch, dan Semi Finished tanpa `flowerGroup`; audit hasil selain Good Qty tidak ditambahkan.
- Reconcile HPP master untuk payroll final baru sudah aktif di service payroll/worklog: output cost dan master HPP/average cost diselaraskan tanpa mutasi qty stok ulang.
- Tech debt yang masih sengaja tidak disentuh: backfill massal Work Log lama yang belum pernah tersentuh sync payroll, karena itu menyentuh stok/HPP history dan perlu task guarded terpisah.

## Update Current State — toOptionMap shared helper cleanup — 2026-05-17

Status: **AKTIF / SCOPED CLEANUP**.

- Source of truth option map sekarang ada di `src/utils/options/optionMap.js::toOptionMap()`.
- Constants produksi/variant yang sebelumnya punya local reduce `toOptionMap` sekarang import helper shared dan tetap re-export `toOptionMap` untuk legacy compatibility import.
- `src/constants/semiFinishedMaterialOptions.js` tidak lagi mengambil `toOptionMap` dari `variantOptions.js`; coupling Semi Finished -> Variant hanya untuk opsi warna/group yang memang dipakai.
- `src/constants/productionProfileOptions.js` juga memakai helper shared untuk `PRODUCTION_PROFILE_TYPE_MAP` agar pola enum map konsisten.
- Jangan hapus export map/status seperti `WORK_LOG_STOCK_STATUS_MAP` / `WORK_LOG_PAYROLL_STATUS_MAP` hanya karena belum terlihat dipakai; tandai sebagai cleanup candidate sampai usage runtime/legacy benar-benar diaudit.
- Cleanup lanjutan yang masih kandidat dan **tidak digabung**: hardening kalkulasi angka produksi (`Number(x || 0)` di BOM/Work Log/Payroll) karena menyentuh BOM, Work Log, payroll/HPP, dan histori produksi.


## Update Produksi/HPP Guarded Reconcile — 2026-05-17

Status aktif dari source terbaru:
- Detail Work Log dan HPP Analysis menampilkan labor lewat resolver shared: payroll final menjadi nilai final, payroll draft/estimasi Step hanya preview read-only.
- Overhead Work Log aktif berasal dari BOM untuk listrik/glue gun; field hasil selain Good Qty tetap compatibility data lama dan tidak ditampilkan sebagai workflow aktif.
- Data Quality Audit tetap read-only dan boleh menandai kandidat `Output HPP perlu reconcile` ketika output cost lama belum ikut payroll final.
- Reconcile otomatis aktif untuk payroll sync baru/yang diedit; backfill massal data historis tetap guarded task terpisah: wajib preview, scope jelas, dan tidak boleh disentuh oleh patch UI/detail biasa.
- `draft`/`cancelled` Work Log hanya legacy data read-only; flow input aktif tetap `in_progress` → `completed`.


## Update Current State — Scalability Read Path & Transaction Service Extraction — 2026-05-22

Patch ini mengurangi coupling UI dengan Firestore orchestration tanpa mengubah schema, route/menu, role guard, atau business status flow.

### Sudah dipindah ke service
- `src/services/Transaksi/salesService.js`
  - fetch sales
  - fetch product/raw material untuk item jual
  - create sale transaction
  - update status Sales ke `Selesai` beserta income otomatis
- `src/services/Transaksi/returnsService.js`
  - listener returns/products/raw materials
  - create return transaction
  - validasi varian final dan inventory log return
- `src/services/Transaksi/purchasesService.js`
  - metadata expense otomatis pembelian
  - normalisasi hitungan purchase
  - create purchase transaction
- `src/services/Dashboard/dashboardService.js`
  - query orchestration Dashboard
  - snapshot mapper read-only
  - targeted purchase lookup untuk Restock Assistant
- `src/services/Laporan/reportsService.js`
  - fetch Sales Report, Purchases Report, dan Profit/Loss
- `src/services/Laporan/stockReportService.js`
  - fetch Stock Report dari raw materials, products, dan semi finished materials
- Reset UI dipecah sebagian ke `ResetDangerZonePanel` dan `ResetExportPanel`; reset service destructive tidak disentuh.

### Yang sengaja belum diubah
- Generator kode bisnis sudah memakai prefix query sebagai baseline legacy. Batch 16B memigrasi Sales/Purchases/Returns ke counter atomic `business_code_counters`; Batch 16C memperluas migrasi ke master data, finance manual, stock adjustment, dan create produksi yang memakai business code otomatis.
- Dashboard dan laporan masih client-side aggregate setelah query terarah. Untuk data besar, tahap berikutnya adalah paging/filter server-side atau read model/report summary.
- Reset destructive service tetap belum di-split karena harus diaudit terpisah.

## Batch 16B - Atomic Counter Transaksi Utama — 2026-05

Status: **GUARDED / AKTIF TERBATAS / TRANSACTION-LEVEL**.

- `src/utils/references/businessCodeCounterService.js` menambahkan service counter atomic untuk collection `business_code_counters`.
- `src/utils/references/businessCodeGenerator.js` menambahkan `getDailyBusinessCodeSequence()` dan `prepareDailySequenceCodeInTransaction()` sebagai helper transaction-level.
- `src/services/Transaksi/salesService.js`, `src/services/Transaksi/purchasesService.js`, dan `src/services/Transaksi/returnsService.js` memakai helper tersebut untuk kode `ORD-*`, `PUR-*`, dan `RET-*`.
- Counter di-commit dalam Firestore transaction yang sama dengan create dokumen bisnis, income/expense terkait, stock mutation, dan inventory log.
- Prefix query lama tetap dipakai sebelum transaction untuk baseline sequence legacy, lalu baseline itu dipakai sebagai minimum counter agar data lama tidak tertabrak.
- Helper prepare menjaga semua transaction read selesai sebelum counter write dilakukan. Ini menghindari read-after-write di Firestore transaction.
- Format kode, document ID readable, stock mutation, inventory log payload, income/expense, purchase average cost, OCR, Return transaction, route/menu/role guard, production, payroll, HPP, dan reset tidak berubah.
- Batch 16C sudah memigrasi caller master data, finance manual, stock adjustment, dan create produksi ke atomic counter. Batch 16D melengkapi sisa Production Planning `PP-*` dan Karyawan Produksi agar create baru juga memakai `business_code_counters`. Cleanup berikutnya tinggal audit generator preview/UI dan data legacy, bukan mengganti source of truth counter.

## Batch 16C - Atomic Counter Master/Finance/Stock/Produksi — 2026-05

Status source terbaru:
- `businessCodeGenerator.js` menambahkan helper `getSequentialBusinessCodeSequence()` dan `prepareSequentialCodeInTransaction()` untuk sequence internal seperti `PRD-001`, `RAW-001`, `BOM-001`, dan `SFP-001`.
- `productionCodeGenerator.js` tetap hanya wrapper compatibility dan mendelegasikan sequence production ke business code generator.
- Create Product, Raw Material, Customer, Supplier, Cash In manual, Cash Out manual, Stock Adjustment, Production Order, Work Log manual/PO, Payroll manual, BOM, dan Semi Finished sudah reserve nomor final di transaction create.
- Prefix query lama masih dipakai sebelum transaction sebagai baseline legacy agar counter baru tidak menabrak data lama.
- Data lama dengan random ID atau format lama tidak di-rename otomatis.

Batasan yang sengaja tidak diubah:
- Tidak ada perubahan route/menu/role guard.
- Tidak ada perubahan status flow Sales/Purchase/Return/Production/Payroll.
- Tidak ada migration massal dokumen lama.
- Auto payroll deterministic per worker/work log tetap dipertahankan; hanya payroll manual `PAY-*` yang memakai counter daily.

Risiko tersisa:
- Jika runtime Firebase lama masih dipakai dan `business_code_counters` belum diizinkan di Firestore Rules production, create kode baru yang memakai counter dapat gagal. File rules ada di ZIP aktual, tetapi tidak dipatch pada batch ini karena rules/Firebase bukan target final owner.
### Batch 17A — Stock Report partial read guard

Status historis:
- Batch 17A menambahkan guard partial read untuk `raw_materials`, `products`, `semi_finished_materials`, dan `categories` supaya salah satu source gagal tidak mengosongkan seluruh laporan.
- **SUPERSEDED oleh Batch 18F untuk path normal:** Stock Report runtime terbaru membaca `stock_item_read_models` dengan paging/load more/full export batch. Guard partial source read tetap dipertahankan sebagai fallback compatibility jika read model kosong/gagal.

Guarded / status aktif terbaru:
- Stock Report tetap read-only; tidak menulis stok, transaksi, inventory log, produksi, atau finance.
- Export XLSX normal mencoba full export batch dari read model sampai batas operasional yang didokumentasikan, lalu memberi disclosure jika fallback/limit terjadi.
- Preview kode UI bisa berbeda dari nomor final saat ada create paralel; ini normal karena final source of truth ada di transaction submit.

### Batch 17B — Dashboard / Stock Report read model design & foundation

Status Batch 17B foundation:
- Source saat ini membedakan dua hal: **Stock Row Mapper** dan **Firestore Stock Read Model**.
- `src/utils/stock/stockHelpers.js` tetap memiliki `buildStockReadModelRow()` sebagai mapper read-only dari master item ke row UI/report. Mapper ini dipakai untuk menyamakan comparator stok, threshold master, variant-aware status, dan display Dashboard/Stock Report.
- `src/utils/stock/stockHelpers.js` menambahkan `buildStockItemReadModelPayload()` sebagai pure builder payload `stock_item_read_models` dari row existing. Builder ini tidak akses Firestore, tidak menulis stok, dan tidak mengubah transaksi.
- `src/services/Inventory/stockReadModelService.js` menambahkan foundation service untuk collection `stock_item_read_models`, document ID `{sourceType}__{sourceId}`, upsert/delete/bulk upsert, query issue/source type, cursor paging, dan full export batch support. Catatan foundation awal sebelum wiring runtime sudah **SUPERSEDED** oleh Batch 17D–18F.

Kontrak awal `stock_item_read_models`:
- Identitas: `sourceType`, `sourceCollection`, `sourceId`, `displayReference`, `name`, `typeLabel`, `route`.
- Stok: `stock`, `currentStock`, `reservedStock`, `availableStock`, `minStockThreshold`, `unitDisplay`.
- Status queryable: `stockStatus`, `stockStatusLabel`, `reportStatus`, `statusRank`, `sortGap`, `hasStockIssue`, `isNegativeStock`, `isReservedOverrun`.
- Varian: `hasVariants`, `variantCount`, `affectedVariantCount`, `affectedVariantSummary`, `affectedVariantEntries`.
- Restock snapshot opsional: `lastPurchaseAt`, `lastPurchasePrice`, `restockSupplierId`, `restockSupplierName`, `restockProductLink`.
- Sync metadata: `isActive`, `searchText`, `sourceUpdatedAt`, `updatedAt`, `lastSyncedFrom`.

Guarded / status aktif terbaru:
- **SUPERSEDED:** Dashboard dan Stock Report tidak lagi full-source sebagai path normal runtime terbaru.
- Dashboard memakai `stock_item_read_models` issue query dengan fallback guarded ke master stock jika read model kosong/gagal.
- Stock Report memakai `stock_item_read_models` dengan paging/load more/full export batch dan fallback guarded ke master source jika read model kosong/gagal.
- Writer sync realtime sudah terpasang pada master data, Purchases, Sales, Returns, Stock Adjustment, Production Work Logs, Production Orders/reservation, generic inventory update, serta maintenance rebuild/backfill/cleanup.
- Firestore Rules dan index untuk collection baru tetap external/manual jika tidak ikut source-controlled deployment.
- `stock_item_read_models` adalah derived read model, bukan source of truth. Source of truth tetap master item stock fields dan `inventory_logs`.

Risiko tersisa:
- **SUPERSEDED oleh source aktual:** Dashboard dan Stock Report sudah memakai `stock_item_read_models` sebagai read path dengan fallback guarded ke master stock. Writer sync utama untuk purchases, sales, returns, stock adjustment, production reserve/release, production work log material/output, dan maintenance rebuild sudah masuk; read model tetap derived/cache, bukan source of truth.
- Query issue seperti `hasStockIssue == true` + `orderBy(statusRank, sortGap)` kemungkinan butuh composite index Firestore. Jangan mengganti ke full scan permanen jika index belum dibuat.
- Export Stock Report harus diputuskan sebelum switch: export semua matching filter dari read model dengan paging batch, bukan hanya page aktif, kecuali UI memberi disclosure jelas.



### Batch 17C — Stock Read Model Backfill/Audit Maintenance

Status Batch 17C:
- `src/services/Maintenance/stockReadModelMaintenanceService.js` menambahkan audit dan rebuild untuk collection turunan `stock_item_read_models`.
- Audit membaca `products`, `raw_materials`, `semi_finished_materials`, dan `stock_item_read_models`, lalu membandingkan payload expected dari `buildStockItemReadModelDocument()`.
- Kategori audit:
  - `ok`: read model sudah sinkron dengan master stok.
  - `missing`: master item belum punya read model.
  - `stale`: read model berbeda dari master stok pada field query/display yang dibandingkan.
  - `orphan`: read model tidak punya master source aktif pada audit saat itu.
- Repair hanya melakukan upsert untuk kategori `missing` dan `stale` ke `stock_item_read_models`.
- Orphan tidak dihapus otomatis; tetap manual review agar tidak salah hapus ketika source read gagal, ada data legacy, atau rules/index belum lengkap.
- Reset Maintenance menampilkan section **Stock Read Model Backfill** di panel Repair Turunan Aman. Section ini punya tombol audit, tombol rebuild guarded, ringkasan missing/stale/orphan, dan preview row issue.

Guard Batch 17C:
- Tidak mengubah Dashboard, Stock Report, writer stok besar, transaksi, master stock, inventory log, produksi, HPP, payroll, finance, route/menu, atau role guard.
- `stock_item_read_models` tetap derived read model. Source of truth tetap master item stock fields dan `inventory_logs`.
- Batch ini hanya backfill/rebuild manual dari master stock saat tombol maintenance dijalankan; belum menjamin realtime sync setelah transaksi baru.
- Firestore Rules dan index collection `stock_item_read_models` tetap harus diverifikasi manual selama runtime Firebase lama masih dipakai. File rules/index ada di ZIP aktual, tetapi tidak diubah pada batch ini karena arah migrasi owner adalah SQLite.

Risiko tersisa Batch 17C:
- Jika user belum menjalankan rebuild setelah perubahan master stock, read model bisa stale.
- Jika production rules belum mengizinkan write ke `stock_item_read_models`, rebuild maintenance bisa gagal.
- **SUPERSEDED oleh source aktual:** Dashboard/Stock Report sudah switch ke read model dengan fallback guarded dan Stock Report sudah memiliki paging/export contract. Tugas tersisa adalah regression test berkala dan verifikasi jika ada flow mutasi stok baru.


## Batch 16D - Atomic Counter Cleanup, Production Planning, dan Karyawan Produksi — 2026-05

Status: **GUARDED / AKTIF / BEHAVIOR-PRESERVING**.

- `src/utils/references/businessCodeGenerator.js` menambahkan fallback tanggal invalid agar kode bisnis tidak menjadi `NaNNaNNaN`.
- Komentar source dan docs yang masih menyebut generator scan-based sudah disinkronkan: prefix query sekarang hanya baseline legacy, final create memakai counter atomic transaction-level.
- `src/services/Produksi/productionPlanningService.js` tidak lagi memakai full scan + `addDoc` sebagai jalur create Planning baru. Create Planning baru memakai counter `business_code_counters` dengan prefix `PP`, format tetap `PP-YYYYMMDD-0001`, dan document ID baru sama dengan `planCode`.
- `src/services/Produksi/productionEmployeesService.js` memakai `business_code_counters` dengan counter key `DAILY__EMP__DDMMYYYY`; format kode karyawan tetap `DDMMYYYY-XXX` agar UI dan relasi Work Log/Payroll lama tidak berubah.
- Counter lama `production_employee_code_sequences` tidak ditulis lagi untuk create baru, tetapi masih dibaca sebagai legacy baseline agar nomor existing tidak tertabrak.

Batasan:
- Tidak ada migrasi/rename dokumen Planning atau Employee lama.
- Tidak mengubah status flow Planning, PO, Work Log, Payroll, HPP, stok, finance, route/menu/role guard, atau reset.
- Firestore Rules untuk `business_code_counters` tetap wajib dicek di Firebase Console.


## Batch merge 1-8 — readpath, reset maintenance, docs/QA sync — 2026-05-23

Status source terbaru setelah rebase patch gabungan:

- **SUPERSEDED oleh batch terbaru:** Dashboard/Stock Report sekarang membaca persisted derived collection `stock_item_read_models` sebagai jalur normal dengan fallback guarded ke master stock. Production Work Log juga sudah sync read model saat Start Production material out, legacy complete material out fallback, dan Complete Work Log output in.
- ResetMaintenanceData sudah memakai `useMasterDataExport`, `useResetMaintenanceAudits`, dan `useResetMaintenanceRepairs`, serta modal/status card split kecil agar page tidak kembali jumbo.
- `useDataQualityAudit.js`, `useLegacyDataAudit.js`, `useMasterCodeMaintenance.js`, `useProductionMaintenance.js`, dan `useResetAuditOverview.js` bukan kontrak aktif setelah hook consolidation; jika masih ada pada working tree lokal, hapus sesuai delete list patch gabungan.
- Repair Side-Effect Transaksi sudah naik dari preview-only ke guarded repair aktual dengan keyword `REPAIR TRANSAKSI`; service hanya membuat side-effect yang hilang dan tidak mengubah stok master/transaksi utama.
- Firestore Rules/index ada di ZIP aktual, tetapi tidak diubah pada batch ini karena owner mengarahkan migrasi berikutnya ke SQLite. Jangan membuat patch rules asumtif tanpa task security/rules terpisah.

Tech debt tersisa:

- Laporan besar masih perlu dipantau performanya saat dataset membesar, tetapi Stock Report sudah memakai read model + paging/export batch. Tugas tersisa: regression test writer sync, audit index/rules selama runtime Firebase lama masih dipakai, dan rencana migrasi SQLite sebagai batch database terpisah.
- `src/services/Maintenance/resetMaintenanceDataService.js` tetap besar dan destructive; split service destructive harus batch terpisah dengan approval eksplisit.
- `src/pages/Transaksi/Purchases.jsx` masih sensitif karena OCR, stock in, expense, supplier reference, dan average cost; lanjut split harus kecil dan behavior-preserving.


## Batch 25–27 — Final QA & Stabilization Sweep — 2026-05

Status: **FINAL STABILIZATION / DOCS-SOURCE SYNC / QA-ONLY RUNTIME GUARD**.

Validasi source aktual pada batch ini menunjukkan helper split dan read model batch sebelumnya sudah masuk di source terbaru. Tidak ditemukan syntax blocker dari pemeriksaan `node --check` untuk file `.js` dan parse JSX untuk file `.jsx` pada ZIP `src/docs` terbaru. Full `npm run lint` dan `npm run build` tetap harus dijalankan di project root lokal karena ZIP ini tidak menyertakan `package.json`/dependency.

Status runtime terbaru yang harus dianggap aktif:
- Dashboard memakai `stock_item_read_models` issue query sebagai path normal stok kritis, dengan fallback guarded ke master stock jika read model kosong/gagal.
- Stock Report memakai `stock_item_read_models` dengan cursor paging, load more, full export batch, dan fallback guarded ke source master jika read model kosong/gagal.
- `stock_item_read_models` tetap derived read model, bukan source of truth stok. Source of truth tetap master item stock fields dan `inventory_logs`.
- Writer sync read model sudah tersebar ke master data, purchase/sales/return, stock adjustment, production orders/reservation, production work logs, generic inventory update, serta maintenance rebuild/backfill/cleanup orphan.
- Service/UI helper split Batch 18–24 bersifat behavior-preserving. Helper tidak boleh dipakai sebagai jalur write/transaction baru.

Large file audit setelah Batch 21–24:
- `src/pages/Produksi/ProductionBoms.jsx` sekitar 1.759 baris — masih kandidat UI split lanjutan, tetapi jangan gabungkan dengan perubahan BOM business logic.
- `src/services/Produksi/productionWorkLogsService.js` sekitar 1.658 baris — sudah split beberapa helper, tetapi transaction stock/HPP/payroll tetap guarded di service utama.
- `src/pages/Produksi/ProductionWorkLogs.jsx` sekitar 1.535 baris — sudah punya helper UI, kandidat split modal/detail lanjutan.
- `src/pages/Produksi/ProductionOrders.jsx` sekitar 1.512 baris — sudah punya helper UI awal, kandidat split panel/table lanjutan.
- `src/pages/Produksi/SemiFinishedMaterials.jsx` sekitar 1.502 baris — sudah punya helper UI awal, kandidat split form/detail lanjutan.
- `src/services/Maintenance/resetMaintenanceDataService.js` sekitar 1.484 baris — tetap guarded/destructive; split lanjutan hanya boleh pure helper, bukan reset execution.
- `src/pages/Produksi/ProductionEmployees.jsx`, `src/pages/MasterData/RawMaterials.jsx`, `src/pages/MasterData/SupplierPurchases.jsx`, `src/pages/Transaksi/Purchases.jsx`, dan `src/pages/Dashboard/Dashboard.jsx` masih besar tetapi sudah memiliki helper split awal.

Guard final:
- Jangan mengubah stock posting, purchase stock-in, sales income, return finance side-effect, production HPP, payroll final/payment, reset destructive target, Firestore schema, route/menu/role guard, atau protected collection hanya demi cleanup.
- Cleanup berikutnya harus tetap changed-files-only, behavior-preserving, dan memprioritaskan source aktual dibanding status historis docs.

## Batch Offline DB 14–16 status — Customers Runtime Pilot + Sales Guard

Status: **PARTIAL PILOT / GUARDED**.

Sudah aktif:
- `Categories.jsx` memakai `categoriesRepository`.
- `Customers.jsx` memakai `customersRepository`.
- `customersRepository` sudah expose `generateCustomerCode()` untuk Firebase adapter dan Dexie adapter.
- `customerCodeReference.js` menjadi helper bersama untuk prefix/format kode customer.
- `salesCustomerReferenceService.js` menjaga Sales tetap membaca customer dari Firebase sampai transaksi offline benar-benar disiapkan.

Tech debt tersisa:
- Sales transaction, stock posting, income creation, dan inventory log masih Firebase-first dan belum punya offline queue. Ini sengaja belum disentuh.
- Customer local yang belum disync tidak boleh dipakai di Sales karena bisa menghasilkan referensi transaksi ke dokumen yang belum ada di Firebase.
- Supplier masih belum boleh diaktifkan ke Firebase sync karena masih terkait `SupplierPurchases`, raw material, dan purchase linkage; supplier local hanya snapshot read-only hasil pull Firebase → Offline.
- Perlu batch audit khusus sebelum dropdown Sales, Purchase, atau modul transaksi lain membaca repository offline.


## Offline DB Batch 17–20 completion — 2026-05

Status terbaru:
- Batch 17 dilengkapi dengan `OfflineLocalDbBackupPanel.jsx` di Testing & Reset Center.
- Restore local DB sekarang punya wrapper guard `restoreLocalDbBackupWithGuard()` dan keyword `RESTORE LOCAL DB BACKUP`.
- `OfflineSyncDevPanel` diperhalus: tombol guarded action disabled sampai keyword tepat agar tidak terlihat seperti error console besar saat keyword belum lengkap.
- Batch 18/19 tetap audit/guard supplier. Supplier runtime/sync Firebase belum diaktifkan.
- Batch 20 tetap contract-only untuk Products/Raw Materials/Semi Finished. Tidak ada runtime migration.

Tech debt tersisa:
- Offline DB masih pilot untuk categories/customers saja.
- Banyak service masih import `firebase/firestore`, ini wajar sampai kontrak offline per modul disetujui.
- Warning AntD React 19 masih perlu batch dependency compatibility terpisah, tidak digabung dengan offline DB batch.

## Batch 21 Note — Offline Database Center UX

Offline DB pilot sekarang memiliki UI utama yang lebih ringkas di Reset Maintenance: `Offline Database Center`. UI ini menggantikan tampilan beberapa panel panjang yang sebelumnya membuat user sulit membedakan mode Firebase, mode Offline, backup, queue, dan conflict.

Kondisi saat ini:

- Categories dan Customers bisa dipakai sebagai pilot offline.
- Ada pull sync Firebase → Local agar data offline tidak kosong saat mode offline aktif.
- Ada push sync Local → Firebase untuk queue pending Categories/Customers.
- Supplier boleh dipull sebagai snapshot read-only, tetapi tidak boleh masuk write runtime/sync queue.
- Product/Raw/Semi/Stock/Purchase/Sales transaction/Production/Payroll/HPP tetap guarded dan belum masuk runtime offline.

Tech debt yang masih tersisa:

- Panel legacy `OfflineSyncDevPanel` dan `OfflineMasterDataPilotPanel` masih dipertahankan sebagai compatibility/development component, tetapi tidak menjadi UI utama.
- Offline flow belum multi-device otomatis; data local tetap per browser/per device.
- Auto-sync belum diaktifkan.

## Batch 22 Note — Reset Maintenance tabbed workspace UX

Testing & Reset Center sekarang memakai `Reset Maintenance Workspace` berbasis tab agar tampilan reset/maintenance konsisten dengan `Offline Database Center` Batch 21.

Perubahan UX:

- Panel panjang di Reset Maintenance tidak lagi ditampilkan semua berurutan dalam satu scroll panjang.
- Area dipisah menjadi tab: `Ringkasan`, `Skenario & Audit`, `Repair Aman`, `Reset & Export`, dan `Offline DB`.
- Warning destructive, keyword confirmation, preview reset, audit log, protected data, dan flow service tidak diubah.
- `OfflineDatabaseCenter` tetap dibungkus `OfflineDevPanelErrorBoundary` agar error runtime panel offline tidak membuat halaman reset white screen.
- Cleanup lint kecil dilakukan di `OfflineDatabaseCenter.jsx`: state `queueRows` yang tidak terpakai dihapus karena daftar queue belum menjadi UI utama.

Batasan:

- Perubahan ini hanya menata UX. Tidak ada schema, collection, route/menu/role guard, dependency, flow stok, transaksi, produksi, payroll, HPP, atau reset destructive yang diubah.
- `ResetSafeRepairPanel` masih menyimpan beberapa tabel repair di dalam tab `Repair Aman`; refactor internal per repair area bisa dibuat batch terpisah jika masih terasa terlalu panjang setelah dipakai.

## Fase 1 Offline UX Guard — Batch 23–25

Status: **AKTIF / UI-ONLY / GUARDED**.

Perubahan terbaru berfokus pada kejelasan penggunaan database offline, terutama saat user membuka master data pilot.

Sudah aktif:
- `Categories.jsx` dan `Customers.jsx` sekarang menampilkan status mode data secara eksplisit: Firebase Mode atau Offline Mode.
- Banner mode menampilkan source data aktif, jumlah `sync_queue` pending, tombol refresh, dan shortcut ke `Offline Database Center`.
- Empty state saat `offline_local` tidak lagi terlihat seperti bug kosong biasa. UI memberi arahan untuk menjalankan `Firebase → Offline` agar IndexedDB local terisi.
- Helper `getPendingSyncQueueCount()` ditambahkan di `syncQueueService.js` sebagai read-only helper untuk status UI.
- Komponen baru `OfflineRepositoryStatus.jsx` bersifat presentational-only dan dipakai bersama oleh Categories/Customers agar wording tidak duplikatif.

Guard yang tetap berlaku:
- Tidak ada perubahan schema, collection, route/menu/role guard, dependency, Firebase rules, transaksi, stock, purchase, sales transaction write, finance, production, payroll, HPP, atau reset destructive flow.
- Offline runtime write masih pilot untuk `categories` dan `customers` saja; supplier hanya read-only snapshot.
- Supplier/Product/Raw/Semi/Stock/Purchase/Sales transaction/Production/Payroll/HPP tetap belum boleh masuk runtime offline tanpa kontrak dan approval terpisah.

Tech debt tersisa:
- Queue pending yang ditampilkan masih total semua collection offline pilot, bukan breakdown per collection di master page.
- Conflict resolver, queue detail, dan backup tetap dikelola dari `Offline Database Center`, bukan dari page master data agar page utama tetap compact.

Status: **SOURCE-COMPLETE / AKTIF / GUARDED**.

- `Offline Database Center` sekarang punya tab `Health` untuk audit read-only local data Fase 1: queue invalid, conflict unresolved, duplicate customer code, tombstone, snapshot kosong, queue pending terlalu lama, dan collection di luar allowlist.

- Delete tombstone local tetap tidak otomatis menghapus Firebase dari panel sync default; ini sengaja guarded untuk menghindari destructive delete tanpa review. Health audit akan memberi catatan agar user tidak mengira queue delete hilang.
- Conflict resolver, queue detail, backup, dan health audit tetap dikelola dari `Offline Database Center`, bukan dari page master data agar page utama tetap compact.

## Offline Performance Hardening — Batch 50

Status: **AKTIF / BUILD-ONLY + UI CODE-SPLIT / GUARDED**.

Perubahan terbaru berfokus pada pengurangan ukuran chunk awal tanpa mengubah business flow:

- `vite.config.js` memakai `manualChunks` untuk memisahkan vendor besar: React/router, Firebase, Dexie, Dayjs, XLSX, dan vendor lain; Ant Design/rc components dibiarkan auto-split oleh Rollup/Vite agar tidak menjadi satu chunk besar.
- `ResetMaintenanceData.jsx` memuat panel maintenance berat dengan `React.lazy` + `Suspense` lokal:
  - Skenario & Audit,
  - Repair Aman,
  - Reset & Export,
  - Offline DB.
- `OfflineDatabaseCenter.jsx` memuat `OfflineLocalDbBackupPanel` secara lazy saat tab Backup & Restore dibuka.

Guard yang tetap berlaku:

- Tidak ada perubahan route, sidebar, role guard, dependency, reset keyword, stock, purchase, sales, returns, finance ledger, production, payroll, HPP, atau destructive reset.
- Perubahan ini hanya memengaruhi cara bundle dibagi dan kapan komponen UI berat dimuat.
- `xlsx` tetap dynamic import dari helper export; tidak dipindahkan ke import statis.

## Report/Finance Runtime Snapshot — Batch 40 Runtime Closure

Status: **AKTIF / READ-ONLY SNAPSHOT / FIREBASE-PRIMARY / GUARDED**.

Batch 40 kini memiliki runtime snapshot aman di `Offline Database Center` tab `Snapshot Report`:

- Snapshot disimpan ke IndexedDB table `report_snapshots` dengan schema local v4.
- Snapshot yang tersedia:
  - Dashboard Summary,
  - Stock Report Snapshot,
  - Sales Report Snapshot,
  - Purchases Report Snapshot,
  - Finance Summary Snapshot.
- Semua snapshot dibangun dari service read Firebase-primary yang sudah ada:
  - `readDashboardData`,
  - `fetchStockReportData`,
  - `fetchSalesReportData`,
  - `fetchPurchasesReportData`,
  - `fetchProfitLossReportData`.
- Snapshot diberi metadata `readOnlySnapshot=true`, `offlineMutationAllowed=false`, `syncStatus=synced`, dan tidak masuk `sync_queue`.

Guard penting:

- Tidak ada offline mutation untuk `revenues`, `incomes`, `expenses`, `sales`, `purchases`, `returns`, `inventory_logs`, `stock_item_read_models`, production, payroll, atau HPP.
- Finance/report final tetap Firebase-primary.
- Snapshot local tidak menghitung ulang ledger/profit/loss dari local draft atau queue pending.
- Snapshot local hanya referensi offline/preview; bukan sumber laporan final.

Tech debt tersisa:

- Halaman Dashboard/Report final belum membaca snapshot offline secara otomatis. Ini sengaja ditahan agar user tidak salah mengira snapshot sebagai laporan final.
- Jika nanti ingin mode baca offline langsung di halaman report, wajib ada badge cache, timestamp `pulledAt/generatedAt`, dan warning jelas bahwa data hanya snapshot terakhir.

## Offline QA Regression & Documentation Closure — Batch 51–52

Status: **AKTIF / DOCS + QA CONTRACT / GUARDED**.

Dokumentasi final ditambahkan untuk membantu regression manual sebelum merge/deploy:

- `docs/14_OFFLINE_QA_REGRESSION.md` berisi checklist regresi full modul online/offline, backup/restore, queue/conflict, snapshot read-only, dan report/finance snapshot.
- `docs/15_OFFLINE_USER_GUIDE.md` berisi panduan user offline mode, batasan, troubleshooting, dan daftar boleh/tidak boleh.

Catatan:

- QA regression tidak mengubah runtime bisnis.
- Dokumentasi menegaskan bahwa offline write saat ini hanya `Categories` dan `Customers`.
- Semua area stock, purchase, sales, returns, finance, report, production, payroll, HPP, dan reset destructive tetap guarded.

## Batch 53 — RC Final Hardening P1-P3

Status: **AKTIF / SOURCE PATCHED / MANUAL QA REQUIRED**.

Yang ditutup:

- P1 update conflict guard: sync update `categories/customers` tidak boleh overwrite Firebase jika remote berubah setelah data dipull.
- P1 health audit: snapshot read-only wajib punya `readOnlySnapshot=true`; data lama/restored tanpa flag harus muncul sebagai warning.
- P1 docs cleanup: kontrak offline diselaraskan ke schema v4 dan UI utama Offline Database Center.
- P2 QA/security follow-up: Firestore rules broad, Firebase config hardcoded, dan dependency `xlsx` dicatat sebagai risiko follow-up tanpa perubahan runtime/dependency.
- P3 legacy cleanup: `OfflineSyncDevPanel` dan `OfflineMasterDataPilotPanel` diberi status cleanup candidate, tidak dihapus.

Sengaja tidak diubah:

- Firestore rules aktif, route/menu/role guard, Firebase config deployment, dependency, stock/purchase/sales/returns/finance/production/payroll/HPP, dan reset destructive flow.


## Update Mobile app shell baseline — 2026-06-01

- **AKTIF:** `src/layouts/AppLayout.jsx` memakai mobile sidebar drawer untuk viewport tablet/HP. Sidebar desktop tetap aktif di laptop/desktop.
- **AKTIF:** tombol menu mobile berada di header dan drawer otomatis tertutup setelah route berubah.
- **AKTIF:** `src/App.css` mengubah content shell menjadi flex-height agar tidak bergantung pada fixed `calc(100vh - 92px)` saat header mobile lebih compact.
- **AKTIF:** table, drawer, modal, PageHeader action, dan FilterBar mendapat responsive baseline agar tidak membuat body horizontal overflow di HP.
- **GUARDED:** patch ini UI-only; `sidebarMenuItems`, `SidebarMenu` role-aware filtering, route guard, auth, Firestore schema, service, stock, sales, purchase, returns, production, payroll, HPP, finance, report, reset, dan audit log tidak diubah.
- **CLEANUP CANDIDATE:** halaman dengan tabel sangat kompleks masih bisa dipoles menjadi mobile card view per halaman, tetapi harus batch terpisah karena beberapa halaman menyentuh flow guarded.

## Update Mobile Accessibility & Asset Polish — 2026-06-01
- **AKTIF:** Top header button focus state memakai outline primary yang jelas untuk keyboard navigation.
- **AKTIF:** `FilterBar` pada mobile membuat field menjadi full-width agar input/select/date tidak saling menghimpit.
- **AKTIF:** `PageHeader` action pada mobile boleh wrap dan memakai lebar penuh agar tombol tidak overlap.
- **AKTIF:** Primary action memakai token `--ims-color-on-primary` supaya teks tetap kontras pada light/dark mode.
- **AKTIF:** Login memakai asset WebP untuk logo utama dengan PNG fallback, tanpa mengubah auth flow.
- **GUARDED:** Perubahan ini UI-only; tidak menyentuh route/menu/role guard, service, SQLite/Firebase, stok, purchase, sales, production, payroll, HPP, finance, reset, atau audit log.
