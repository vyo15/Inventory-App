# MASTER CONTEXT — IMS Bunga Flanel

Dokumen ini dibuat berdasarkan audit langsung terhadap source code aplikasi pada ZIP `Inventory-App.zip` yang diunggah, bukan template umum.

Update verifikasi source aktual — 2026-05-06:
- folder custom `functions/` tidak ditemukan pada ZIP aktual; jangan menganggap ada Firebase Functions custom aktif tanpa bukti source baru;
- file legacy `src/services/Produksi/productionService.js` tidak ditemukan pada ZIP aktual; produksi aktif memakai service granular di `src/services/Produksi/`;
- collection `productions` masih muncul sebagai legacy data layer pada maintenance/reset/audit, bukan flow operasional utama;
- Firestore Rules wajib aktif dan aman di backend Firebase, tetapi repo ZIP saat ini tidak menyertakan file rules source-controlled karena rules dikelola manual/external di Firebase Console;
- root `assets/` yang berisi build artifact lama bukan source aktif dan boleh dibersihkan jika tidak ada referensi runtime aktif.

=====================================================
SECTION: Current repository boundary — AKTIF / GUARDED / CLEANUP CANDIDATE
Fungsi:
- Mengunci batas source aktual: frontend React/Vite, Firestore client layer, rules backend external, dan cleanup root artifact.

Dipakai oleh:
- Semua task patch docs/source, terutama Auth/User Management, Firestore Rules, dan cleanup repository.

Alasan perubahan:
- Owner mengonfirmasi Firestore Rules dikelola langsung di Firebase Console dan root assets/ adalah sisa build yang lupa terhapus.

Catatan cleanup:
- Source-controlled rules boleh menjadi task terpisah jika owner ingin rules dimasukkan ke repo.

Risiko:
- Menganggap rules tidak wajib karena tidak ada file repo akan membuka risiko security; menghapus `src/assets` keliru akan merusak logo/branding aktif.
=====================================================

## Ringkasan Aplikasi
IMS Bunga Flanel adalah aplikasi inventory dan operasional usaha yang mencakup:
- master data bahan baku, produk jadi, supplier, pelanggan, kategori, dan pricing rules
- transaksi pembelian, penjualan, retur, pemasukan, dan pengeluaran
- inventaris dan audit log stok
- modul produksi modern berbasis BOM → Production Order → Work Log → Payroll → Analisis HPP
- logic produksi aktif sekarang dianggap **guarded / locked area**
- boundary sensitif produksi: `productionOrdersService`, `productionWorkLogsService`, `productionPayrollsService`, helper referensi/transform produksi, dan docs arsitektur produksi
- patch UI / shared component / refactor halaman lain tidak boleh mengubah contract flow produksi tanpa evaluasi khusus

- laporan stok, pembelian, penjualan, dan laba rugi
- utilitas reset data uji

## Stack Teknis yang Terverifikasi
- Frontend: React 19
- Build tool: Vite 7
- UI library: Ant Design 5
- Routing: `HashRouter`
- Database: Firebase Firestore
- Hosting/deploy frontend: GitHub Pages (`gh-pages`)
- Backend custom: tidak ada folder `functions/` pada ZIP aktual. Aplikasi berjalan sebagai frontend React/Vite + Firestore client/service layer. Dependency Firebase tetap dapat membawa package internal `@firebase/functions`, tetapi itu bukan bukti adanya Cloud Functions custom project.

## Struktur Teknis Utama yang Terverifikasi
- `src/main.jsx` memakai `HashRouter`
- `src/layouts/AppLayout.jsx` menangani shell aplikasi, dark mode, sidebar, header, dan route container
- `src/router/AppRoutes.jsx` adalah peta route utama
- `src/services/**` berisi service utama untuk master data, pricing, inventory, produksi, dan reset utilitas
- `src/services/Produksi/**` aktual berisi service granular: `productionBomsService.js`, `productionEmployeesService.js`, `productionOrdersService.js`, `productionPayrollsService.js`, `productionPlanningService.js`, `productionProfilesService.js`, `productionStepsService.js`, `productionWorkLogsService.js`, dan `semiFinishedMaterialsService.js`
- `src/pages/**` berisi implementasi halaman per modul

## Route Utama yang Aktif
- `/dashboard`
- `/categories`
- `/customers`
- `/pricing-rules`
- `/products`
- `/raw-materials`
- `/suppliers`
- `/produksi/tahapan-produksi`
- `/produksi/karyawan-produksi`
- `/produksi/profil-produksi`
- `/produksi/semi-finished-materials`
- `/produksi/production-planning`
- `/produksi/bom-produksi`
- `/produksi/production-orders`
- `/produksi/work-log-produksi`
- `/produksi/payroll-produksi`
- `/produksi/analisis-hpp`
- `/stock-management`
- `/stock-adjustment` sekarang legacy redirect ke `/stock-management`
- `/purchases`
- `/returns`
- `/sales`
- `/cash-in`
- `/cash-out`
- `/purchases-report`
- `/sales-report`
- `/report-stock`
- `/profit-loss`
- `/payroll-report`
- `/system/user-management`
- `/utilities/reset-maintenance-data`
- `/utilities/reset-test-data` sekarang legacy redirect ke `/utilities/reset-maintenance-data`

## Prinsip Stok Aktif yang Terlihat di Kode
Aplikasi saat ini memakai pendekatan transisi antara field lama dan field baru:
- `currentStock` diperlakukan sebagai source of truth aktif di beberapa service baru
- `stock` tetap disinkronkan untuk kompatibilitas tampilan dan logic lama
- `reservedStock` dan `availableStock` sudah dipakai di beberapa modul baru, terutama produksi dan varian

## Prinsip UI yang Terlihat Konsisten
- bahasa UI dominan Bahasa Indonesia
- angka menggunakan format Indonesia tanpa desimal
- banyak halaman memakai ringkasan statistik + tabel + modal form
- beberapa halaman baru memakai helper/shared component khusus produksi

## Catatan Penting untuk Pengembangan Lanjutan
Saat membuat perubahan baru, selalu cek apakah perubahan menyentuh salah satu area sensitif berikut:
- sinkronisasi `stock` vs `currentStock`
- item dengan varian
- flow kas dari penjualan dan pembelian
- modul produksi final vs flow legacy `productions`
- laporan yang membaca collection lain, bukan collection transaksi mentah

## Aturan Aman untuk Task Berikutnya
- jangan ubah field stok hanya di satu field jika modul terkait sudah memakai `currentStock`, `reservedStock`, dan `availableStock`
- jangan menambah flow produksi baru di luar alur final tanpa alasan jelas
- kalau menyentuh sales, purchases, stock adjustment, dan production, selalu cek efek ke `inventory_logs`
- kalau menyentuh laporan, cek collection sumber datanya terlebih dahulu


## Catatan Batch Prioritas Terbaru
- Work Log costing final sudah diarahkan agar completed Work Log menyimpan `materialCostActual`, `laborCostActual`, `totalCostActual`, dan `costPerGoodUnit` sebagai read model HPP.
- Payroll paid sekarang menjadi flow integrasi aktif: payroll `paid` otomatis membuat Cash Out/Expense dengan guard `sourceModule/sourceId` agar tidak double.
- Export laporan final diarahkan ke XLSX siap baca melalui helper reusable, dengan header manusiawi, format Rupiah, tanggal Indonesia, dan sheet name jelas.

## Update Cleanup Stok & Customer — 2026-04-25
- Source of truth mutasi stok umum adalah `src/services/Inventory/inventoryService.js` melalui `updateInventoryStock()`.
- Penyesuaian Stok sekarang digabung ke halaman `StockManagement.jsx` melalui `StockAdjustmentPanel.jsx`; file halaman lama `StockAdjustment.jsx` dihapus agar tidak ada dua entry point inventory.
- Item bervarian pada panel Penyesuaian Stok wajib memilih varian supaya stok tidak masuk ke master/default.
- Collection customer final adalah `customers` lowercase, sama seperti yang dibaca modul Sales.
- `inventory_logs` baru menyimpan reference di `referenceId`, `referenceType`, dan `details`, tetapi field lama top-level tetap dipertahankan agar log lama masih terbaca.
- Produksi final tetap **guarded exception**: mutasi stok produksi boleh tetap memakai transaction service produksi karena start/complete Work Log harus atomic.
- Cleanup file unused yang terbukti tidak di-import: `src/stock.json`, `src/assets/dark-mode.svg`, `src/assets/light-mode.svg`, `src/utils/access/accessControl.js`, dan `src/constants/roleOptions.js`.

## Update Integrasi Manajemen Stok — 2026-04-25
- Sidebar Inventaris sekarang hanya menampilkan **Manajemen Stok** sebagai entry point utama.
- Area Penyesuaian Stok aktif berada di halaman Manajemen Stok supaya user bisa melihat audit log dan melakukan koreksi stok dalam satu konteks.
- Route lama `/stock-adjustment` dipertahankan sebagai legacy redirect ke `/stock-management`, bukan halaman adjustment aktif.
- File lama `src/pages/Inventory/StockAdjustment.jsx` dihapus dari source patch karena logic submit adjustment sudah dipindahkan ke `src/pages/Inventory/components/StockAdjustmentPanel.jsx`.

## Update Integrasi IMS Otomatis — 2026-04-25
- Flow final IMS aktif: **Work Log completed → Payroll Produksi → Payroll paid → Cash Out/Expense → Profit Loss**.
- Payroll Produksi yang ditandai `paid` sekarang otomatis membuat expense di collection `expenses` dengan source reference `production_payroll`.
- Expense payroll wajib punya `sourceModule`, `sourceId`, `sourceRef`, `sourceType`, dan `createdByAutomation` agar audit jelas dan tidak double.
- Profit Loss tetap membaca collection final `expenses`; payroll tidak dihitung langsung dari `production_payrolls` supaya biaya payroll tidak dobel.
- Backfill Work Log/payroll lama tetap tidak otomatis dilakukan; jika diperlukan harus dibuat task terpisah dengan preview.


## Final Documentation Lock — Task 6
Status cleanup bertahap yang dikunci di docs:
- **Aktif:** Stock Management adalah satu entry point inventory; Stock Adjustment berada di dalamnya, mendukung Bahan Baku, Semi Finished, dan Produk Jadi, serta wajib memakai format angka Indonesia tanpa trailing `.00`.
- **Aktif:** Kolom Referensi Audit di Stock Management adalah audit source, bukan kolom tidak berguna; tampilannya harus manusiawi dan tidak boleh menampilkan ID teknis/random ID sebagai detail sekunder, tooltip, atau fallback display.
- **Aktif:** Production Order create drawer memakai preview compact read-only untuk stok target, varian target, qty batch, estimasi output, kebutuhan material, stok material, dan status cukup/kurang.
- **Guarded:** Completed Work Log harus menjaga material cost, labor cost, total cost, cost per good unit, output stock posting, dan auto payroll agar tidak diproses dua kali.
- **Aktif:** Work Log completed membuat payroll line otomatis; payroll `paid` membuat Cash Out/Expense otomatis dengan guard idempotent.
- **Legacy/compatibility:** payroll preference custom di master karyawan hanya data lama/compatibility; payroll final mengikuti rule Tahapan Produksi dan Work Log completed.
- **Aktif:** Profit Loss membaca biaya payroll dari `expenses`, bukan dari `production_payrolls`, agar tidak double counting.
- **Aktif:** Export laporan final memakai XLSX rapi, bukan data mentah.

## Update UX Produksi Semi Product / BOM / Production Order — 2026-05-12
- **Aktif:** menu Semi Product boleh ditampilkan secara grouped/accordion berdasarkan **Product Family / Jenis Bunga → Kategori → Item** agar data tidak menjadi daftar campur panjang. Semi Product tetap merupakan stok produksi global/reusable, bukan data duplikat per produk jadi.
- **Aktif:** menu BOM / Resep Produksi boleh ditampilkan grouped berdasarkan **Target Type → Target Item → Resep Produksi**. Grouping ini hanya cara baca UI; source of truth tetap dokumen BOM existing.
- **Aktif:** drawer Buat Production Order memakai pemilihan target yang lebih natural, tetapi submit tetap wajib memakai `bomId` sebagai source of truth internal.
- **Aktif:** untuk `Produk Jadi`, drawer PO cukup menampilkan **Jenis Produksi → Produk yang dibuat → Resep Produksi jika lebih dari satu → Qty → Preview Kebutuhan**. Filter **Jenis Bunga / Product Family** dan **Kategori Bahan** tidak ditampilkan untuk produk jadi bila source product tidak memakai field itu.
- **Aktif:** untuk `Bahan / Semi Produk`, drawer PO menampilkan filter UI-only **Jenis Bunga / Product Family** dan **Kategori Bahan** sebelum field **Bahan yang dibuat**, agar user tidak memilih dari flat list panjang.
- **Guarded:** filter UI-only seperti selected family/category/target key tidak boleh disimpan ke Firestore dan tidak boleh membuat schema/collection baru.
- **Guarded:** istilah/kode internal seperti kode BOM atau kode target master boleh disembunyikan dari label pilihan user-facing, tetapi `bomId`, kode transaksi Production Order, dan referensi audit internal tetap wajib dipertahankan.
- **Guarded:** perubahan ini hanya UX/listing/selection; tidak boleh mengubah stok, requirement calculation, Work Log, Payroll, HPP Analysis, report, atau lifecycle Production Order.

## Update Production Planning / Planning Schedule — 2026-04-25
- **Aktif:** Production Planning ditambahkan sebagai layer target sebelum Production Order dengan route `/produksi/production-planning` dan collection `production_plans`.
- **Aktif:** Flow final menjadi **Planning → Production Order → Work Log completed → Payroll/HPP → Dashboard**.
- **Business rule terkunci:** planning hanya menyimpan target, periode, deadline, prioritas, catatan, target item/varian, dan link PO; planning **tidak mengubah stok**, tidak membuat payroll, tidak membuat expense, dan tidak masuk HPP langsung.
- **Guarded:** Production Order yang dibuat dari planning tetap diproses oleh service PO existing sehingga kebutuhan material tetap dihitung dari BOM dan helper requirement final.
- **Aktif:** progress planning dihitung dari Work Log `completed` milik PO terkait, dengan filter target item dan `targetVariantKey` jika item bervarian.
- **Aktif:** Dashboard membaca summary planning mingguan/bulanan, overdue, dan kurang target secara read-only.
- **Compatibility:** PO lama tanpa `planningId` tetap valid sebagai PO manual; Work Log lama tanpa planning tetap valid dan tidak dimigrasi otomatis.
- **Docs lock:** patch berikutnya tidak boleh menganggap planning sebagai stok nyata atau shortcut untuk memotong bahan.

## Update Lock Stok Master Edit — 2026-05-02
- **Aktif:** stok awal hanya boleh diinput saat create pertama kali di master Product, Raw Material, dan Semi Finished Material, baik non-variant maupun variant.
- **Guarded:** setelah data master dibuat, field stok fisik tidak boleh diedit langsung dari form edit master. Mutasi stok wajib lewat Stock Management / Stock Adjustment / flow transaksi resmi agar audit trail, `stock_adjustments`, dan `inventory_logs` tetap jelas.
- **Guarded:** field yang dikunci dari edit master mencakup `stock`, `currentStock`, `reservedStock`, `availableStock`, serta `variants[].stock`, `variants[].currentStock`, `variants[].reservedStock`, dan `variants[].availableStock`.
- **Aktif:** edit master tetap boleh mengubah metadata non-stok seperti nama, kategori, harga, supplier manual/reference non-stok, SKU/kode/label, deskripsi, status aktif, dan `minStock` / `minStockAlert`.
- **Guarded:** mode `hasVariants` tetap dikunci untuk edit biasa, tetapi data lama non-varian boleh mulai memakai varian lewat flow aman hanya jika `stock/currentStock`, `reservedStock`, dan `availableStock` semuanya 0.
- **Guarded:** varian baru pada item existing wajib mulai dari stok 0; stok fisik tetap harus masuk lewat Stock Management / Stock Adjustment / transaksi resmi.
- **Guarded:** item lama yang masih punya stok master atau reserved stock tidak boleh dikonversi otomatis ke varian karena itu akan memindahkan bucket stok tanpa audit.
- **Legacy:** field `stock` tetap disimpan sebagai alias/compatibility dan tidak boleh dihapus dari dokumen.
- **Aktif:** Stock Adjustment resmi mendukung `raw_materials`, `semi_finished_materials`, dan `products`. Semi Finished non-varian/bervarian dapat dikoreksi lewat Stock Management dengan transaction, `stock_adjustments`, dan `inventory_logs`.
- **Docs lock:** task berikutnya tidak boleh membuka kembali direct edit stok master kecuali ada business rule baru, audit trail baru, dan approval eksplisit.

## Update Batch Fix Bug Merge — 2026-05-03
- **Aktif:** patch gabungan ini menggabungkan perbaikan no-decimal number format, sidebar nested accordion, login UI copy cleanup, Production Order strict variant requirement, Work Log worker stock audit, dan Semi Finished variant color rename ke baseline source/docs terbaru yang diunggah. Pada audit 2026-05-06, baseline yang diverifikasi adalah `Inventory-App.zip` + `docs.zip`.
- **Aktif:** format angka operasional diarahkan tanpa desimal melalui formatter dan input UI aktif; data lama yang sudah memiliki decimal tidak dimigrasi otomatis.
- **Guarded:** Production Order bervarian tidak boleh fallback diam-diam ke stok master/default. Preview PO dan Start Production harus memakai kontrak varian material yang sama.
- **Guarded:** completed Work Log tetap hanya boleh posting output stock satu kali, tetapi inventory log output produksi baru menyimpan snapshot operator/worker agar audit di Stock Management lebih jelas.
- **Guarded:** edit nama/label varian Product, Raw Material, dan Semi Finished hanya mengganti metadata tampilan; `variantKey` tetap menjadi identitas bucket stok/reference dan stok varian tidak boleh reset.
- **Aktif:** Pricing Rules opsional saat create Product/Raw Material. Mode default create adalah Manual; `pricingRuleId` hanya wajib saat user memilih mode Rule.
- **Aktif:** sidebar memakai nested accordion agar sibling submenu otomatis tertutup tanpa mengubah route, role access, atau business flow.
- **Aktif:** login normal tidak lagi menampilkan copy teknis internal Firebase/Auth/Firestore, tanpa mengubah flow Auth dan `system_users`.

## Update Pricing Mode Shared UI — 2026-05-11
- **Aktif:** Pricing Mode Product dan Raw Material sekarang memakai shared UI `src/components/Pricing/PricingModeSwitch.jsx` untuk pilihan Manual/Rule.
- **Scope component:** `PricingModeSwitch` hanya mengatur switch UI Manual/Rule dan meneruskan perubahan mode ke pemakai. Kontrak pemakaiannya wajib membersihkan `pricingRuleId` saat user kembali ke Manual.
- **Guarded:** `PricingModeSwitch` tidak boleh berisi formula pricing, service validation, query Firestore, atau auto-preview harga.
- **Guarded:** shared UI ini tidak mengubah schema/collection Firestore, tidak mengubah validasi service Product/Raw Material, dan tidak menjadi source perhitungan harga.
- **Aktif:** formula preview pricing tetap bersumber dari `buildSinglePricingPreview` di `pricingService`; auto-preview Product/Raw Material tetap local di halaman masing-masing karena base cost dan target price berbeda.

## Update Standar Referensi Audit dan Kode Manusiawi — 2026-05-11
- **Guarded:** Technical ID adalah Firestore document ID random, auto ID, internal generated ID, atau ID teknis lain yang tidak manusiawi. Technical ID bukan referensi audit bisnis.
- **Aktif:** Referensi ID bisnis manusiawi adalah acuan utama untuk audit, pencarian, relasi operasional, table, detail, drawer, report UI, dan export yang dibaca user.
- **Guarded:** Technical ID tidak boleh tampil di UI, tooltip, table, detail, drawer, report UI, atau fallback text. Jika referensi bisnis belum tersedia, UI wajib menampilkan fallback manusiawi seperti `-` atau `Referensi belum tersedia`, bukan Firestore random ID.
- **Guarded:** Prioritas referensi audit adalah kode bisnis transaksi/master/produksi yang manusiawi, lalu `sourceRef` / `referenceNumber` readable, lalu fallback manusiawi. Jangan fallback ke Technical ID.
- **Target setelah reset data:** untuk collection bisnis baru dengan pola 1 dokumen = 1 referensi, Firestore document ID boleh dan sebaiknya sama dengan Referensi ID bisnis, misalnya `purchases/PUR-YYYYMMDD-0001` atau `sales/ORDE-YYYYMMDD-0001`.
- **Target setelah reset data:** untuk collection log yang bisa memiliki banyak dokumen per referensi, gunakan ID turunan readable seperti `LOG-PUR-YYYYMMDD-0001-001`, bukan random ID.
- **Guarded:** kode audit yang sudah dipakai harus immutable. Edit nama/ref tidak boleh otomatis mengubah kode audit lama tanpa approval migrasi.
- **Standar kode manusiawi:** jangan pakai mapping manual kata-per-kata atau dictionary singkatan per modul. Satu algoritma universal berbasis normalisasi + konsonan harus menjadi standar.
- **Source of truth:** satu shared generator yang disetujui harus menjadi sumber kode manusiawi lintas modul. Page/service tidak boleh membuat generator baru atau duplicate logic.
- **Current state note:** source terbaru masih perlu audit karena generator seperti `businessCodeGenerator.js` dan `productionCodeGenerator.js` masih memiliki mapping manual kata tertentu. Patch docs ini hanya mengunci standar baru; refactor source harus menjadi task terpisah.

## Reset & Maintenance Decision Center — 2026-05-11
- **Aktif:** Reset & Maintenance Data diarahkan menjadi Maintenance Decision Center, bukan hanya daftar tombol reset teknis.
- **Flow standar:** Audit → Preview → Export → Reset/Repair → Audit ulang.
- **Development rule:** data lama yang belum real boleh direset agar tidak menumpuk fallback/logic lama, selama destructive action tetap lewat preview, confirmation keyword, dan audit trail.
- **Export data pokok:** tersedia sebelum reset destructive sebagai backup/checklist master, bukan restore otomatis.
- **Guarded:** log/transaksi lama tidak direkomendasikan dibawa ulang sebagai default jika logic berubah; transaksi baru sebaiknya dibuat ulang lewat flow terbaru agar log baru mengikuti logic terbaru.
- **Opening stock:** setelah reset, stok awal sebaiknya dibuat ulang lewat purchase/opening adjustment, bukan menempel stok mentah tanpa audit.


---

## FINAL LOCKED REFERENCE CODE STANDARD — IMS Bunga Flanel

Status: **LOCKED / GUARDED**. Prefix dan format di bawah ini tidak boleh diubah lagi tanpa approval arsitektur khusus.

| Modul | Prefix final | Format final | Contoh |
|---|---|---|---|
| Customer | `CUS` | `CUS-DDMMYYYY-001` | `CUS-12052026-001` |
| Supplier | `SUP` | `SUP-DDMMYYYY-001` | `SUP-12052026-001` |
| Produk Jadi | `PRD` | `PRD-[READABLE]` | `PRD-BQT-MWR-PTH-FLN` |
| Raw Material | `RAW` | `RAW-[READABLE]` | `RAW-FLN-PTH` |
| Semi Finished | `SFP` | `SFP-[READABLE]` | `SFP-BNG-MWR-PTH` |
| BOM | `BOM` | `BOM-[TARGET]` | `BOM-PRD-BQT-MWR-PTH-FLN` |
| Production Step | `STP` | `STP-[READABLE]` | `STP-POTONG` |
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
- Readable semantic code unik tidak memakai suffix; suffix sequence 3 digit (`-001`, `-002`) hanya ditambahkan saat base code duplicate/collision dan tidak boleh memakai timestamp/random.
- Firestore random ID tidak boleh tampil sebagai kode audit/user-facing.
- Data lama dengan prefix legacy tetap compatibility, tetapi bukan standar data baru.


### Guard final reference code

- Kode utama harus otomatis dibuat oleh helper/service, bukan input manual user.
- Field kode utama di UI harus `disabled` dan/atau `readOnly` saat create/edit.
- Kode tidak boleh berubah saat edit nama, kontak, katalog, harga, atau status.
- Untuk data baru yang satu dokumen mewakili satu reference utama, document ID idealnya sama dengan kode bisnis.
- Data lama tidak boleh di-rename document ID tanpa preview/repair plan terpisah.
- Generator readable semantic harus universal berbasis normalisasi teks + konsonan, bukan dictionary manual kata seperti `PUTIH -> PTH`.
- Prefix legacy `SAL`, `RM`, `CIN`, `COUT`, `WL`, `ADJ`, dan `STEP` hanya boleh muncul sebagai catatan legacy compatibility/audit, bukan generator data baru.


### UI rule final: master item/config code internal

- Kode untuk Product, Raw Material, Semi Finished, BOM, dan Production Step adalah **kode internal**.
- Service tetap wajib membuat dan menyimpan field `code` otomatis saat create.
- Kode internal master item/config tidak wajib tampil sebagai field utama UI, tidak perlu realtime preview, dan tidak boleh diinput manual user.
- UI utama master item/config memakai nama dan atribut bisnis sebagai identitas: kategori, warna, bahan, varian, target produk, step, dan satuan.
- Kode transaksi/audit tetap wajib tampil di UI: Customer, Supplier, Purchase, Sales/Order, Return, Stock Adjustment, Cash In, Cash Out, Production Order, Work Log/Job, dan Payroll.
