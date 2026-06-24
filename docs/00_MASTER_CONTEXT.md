# MASTER CONTEXT — IMS Bunga Flanel

Dokumen ini dibuat berdasarkan audit langsung terhadap source code aplikasi. Update terbaru 2026-06-22 memakai ZIP `Inventory-App-20260622-202512318-main-a99017ed-dirty.zip` sebagai sumber kebenaran utama, bukan template umum atau docs lama.

Update verifikasi source aktual — 2026-06-22:
- source yang divalidasi: ZIP `Inventory-App-20260622-202512318-main-a99017ed-dirty.zip` dengan root project source pada arsip;
- runtime utama source aktual adalah React/Vite frontend + Node.js Express backend + SQLite file lokal/LAN;
- `backend/src/server.js` mendaftarkan endpoint `/api/**` untuk Auth, master data, stock, transaksi, finance, production, reports, maintenance, dan audit log;
- `frontend/src/context/AuthContext.jsx` memakai `localAuthService` dan `authMode: "sqlite"`; nama state auth lama yang masih tersisa hanya compatibility internal untuk actor label lama, bukan runtime auth lama;
- `frontend/src/data/repositories/repositoryMode.js` hanya menetapkan `sqlite_sidecar`; konstanta mode lama `offline_local` dan `hybrid_sync` sudah dihapus dari source aktif;
- `frontend/package.json` source aktual tidak memiliki dependency `runtime-arsip` atau `database-browser-arsip`.
- `backend/src/server.js` menangani `SIGINT`, `SIGTERM`, `SIGHUP`, `SIGBREAK` pada Windows, dan reload `SIGUSR2`; shutdown menutup HTTP server, checkpoint WAL, lalu menutup koneksi SQLite sebelum process keluar.
- `dayjs` dan `@ant-design/icons` dideklarasikan langsung di `frontend/package.json` karena dipakai langsung oleh source, bukan lagi mengandalkan hoisting dependency Ant Design.

Catatan arsip:
- semua instruksi lama tentang auth lama, rules database arsip, transaksi database arsip, database browser arsip sync queue, atau fallback runtime arsip harus dibaca sebagai **ARSIP MIGRASI**, kecuali ada validasi source baru yang membuktikan runtime tersebut aktif kembali dan owner menyetujuinya eksplisit.

=====================================================
SECTION: Current repository boundary — AKTIF / GUARDED / SQLITE SOURCE OF TRUTH
Fungsi:
- Mengunci batas source aktual setelah migrasi SQLite: frontend React/Vite, backend Node.js Express, dan SQLite file lokal/LAN sebagai runtime utama.

Dipakai oleh:
- Semua task patch docs/source, terutama Auth lokal, repository mode, maintenance/backup-restore, transaksi, stock, finance, production, report, dan cleanup data historis.

Alasan perubahan:
- Source aktual sudah tidak menjalankan runtime arsip sebagai runtime utama. Backend adalah satu-satunya akses resmi ke SQLite; frontend tidak boleh akses file SQLite langsung.

Catatan cleanup:
- Referensi runtime/database/browser-local lama yang tersisa di docs/source comments harus diperlakukan sebagai compatibility data historis atau arsip migrasi sampai dibuktikan sebaliknya lewat grep/import/route/service aktual.

Catatan role guard alignment:
- Role `user` adalah operator harian, bukan admin sistem. Frontend boleh membuka halaman operasional harian hanya jika backend endpoint untuk flow yang sama juga menerima guard operasional `administrator + user`.
- Endpoint commit Purchases, Sales, update status Sales, Returns, Stock Adjustment, serta create/update Production Planning/Orders/Work Logs memakai guard operasional.
- Halaman admin/setup, finance sensitif, Payroll, HPP Analysis, reports, maintenance, dan user management tetap administrator-only.
- Read reference yang memang dibutuhkan flow operasional dapat tetap tersedia melalui service backend, tetapi halaman pengelolaan dan mutation setup tetap administrator-only. Jangan menyamakan kebutuhan membaca referensi operasional dengan izin mengelola master.
- Router JSON SQLite mendukung `readGuard`. Source aktual menerapkan read guard administrator pada `/api/finance/incomes`, `/api/finance/expenses`, `/api/finance/ledger`, `/api/reports`, dan `/api/production/payrolls`.
- Dashboard wajib mengikuti matrix `roleAccess.js`: role `user` tidak meminta dataset finance/payroll, tidak menampilkan KPI/aksi sensitif, dan link stok yang menuju halaman master dialihkan ke Stock Management yang memang boleh diakses.
- HPP Analysis tidak memiliki endpoint HPP terpisah; analisisnya derived dari Work Log dan Payroll. Route HPP Analysis dan dataset Payroll tetap administrator-only, sedangkan Planning/Orders/Work Logs tetap operasional sesuai contract produksi.
- Perubahan role guard wajib tetap menjaga atomic transaction, audit log, idempotency, dan business rule backend; UI tidak boleh menjadi satu-satunya guard.

Risiko:
- Mengikuti docs lama yang masih menyebut auth/rules database arsip dapat membuat patch baru salah arah, menghidupkan fallback lama, atau melewati backend SQLite resmi.
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
- Runtime data aktif: Node.js Express backend di `backend/`
- Database aktif: SQLite file lokal/LAN melalui backend resmi
- Auth aktif: local auth SQLite melalui `frontend/src/services/System/localAuthService.js` dan endpoint `/api/auth/**`
- Build frontend: Vite build lokal tersedia. GitHub Pages tidak dipakai sebagai runtime produksi IMS karena aplikasi tetap membutuhkan layanan lokal dan database lokal/LAN.
- runtime/database/browser-local lama: tidak ada sebagai runtime aktif pada source aktual. Sebutan lama hanya data historis/arsip kecuali source baru membuktikan sebaliknya.

## Struktur Teknis Utama yang Terverifikasi
- `src/main.jsx` memakai `HashRouter`
- `src/layouts/AppLayout.jsx` menangani shell aplikasi, dark mode, sidebar, header, dan route container
- `src/router/AppRoutes.jsx` adalah peta route utama
- `src/services/**` berisi service utama untuk master data, pricing, inventory, produksi, dan reset utilitas
- `src/services/Produksi/**` aktual berisi service granular: `productionBomsService.js`, `productionEmployeesService.js`, `productionOrdersService.js`, `productionPayrollsService.js`, `productionPlanningService.js`, `productionProfilesService.js`, `productionStepsService.js`, `productionWorkLogsService.js`, dan `semiFinishedMaterialsService.js`
- Backend produksi menjaga public facade di `backend/src/modules/production/production.service.js`; lifecycle Planning/Order berada di `production.order.service.js`, guard/router di `production.guards.js`, primitive transaksi bersama di `production.shared.js`, dan kalkulasi deterministik di `production.calculations.js`. Mutasi stok, completion Work Log, payroll/HPP, finance posting, dan audit tetap melalui transaction backend resmi.
- Backend Maintenance menjaga public facade di `backend/src/modules/maintenance/maintenance.service.js`; audit/repair data quality berada di `maintenance.dataQuality.service.js`, sedangkan normalizer snapshot murni berada di `maintenance.auditHelpers.js`. Backup/restore, file swap, rollback, dan confirm guard tetap berada di facade Maintenance.
- `src/pages/**` berisi implementasi halaman per modul

## Route Utama yang Aktif
- `/dashboard`
- `/categories`
- `/customers`
- `/pricing-rules`
- `/products`
- `/raw-materials`
- `/suppliers`
- `/inventory`
- `/inventory/stock-management`
- `/production`
- `/production/planning`
- `/production/orders`
- `/production/work-logs`
- `/production/steps`
- `/production/employees`
- `/production/profiles`
- `/production/semi-finished-materials`
- `/production/boms`
- `/production/payrolls`
- `/production/hpp-analysis`
- `/stock-adjustment` dan `/stock-management` menjadi compatibility redirect ke `/inventory/stock-management`
- Child route lama `/produksi/...` menjadi compatibility redirect terisolasi ke `/production/...`; exact hub `/stock` dan `/produksi` sudah dipensiunkan.
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
- `/utilities/reset-test-data` sekarang redirect lama ke `/utilities/reset-maintenance-data`

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
- modul produksi final vs flow data historis `productions`
- laporan yang membaca collection lain, bukan collection transaksi mentah

## Aturan Aman untuk Task Berikutnya
- jangan ubah field stok hanya di satu field jika modul terkait sudah memakai `currentStock`, `reservedStock`, dan `availableStock`
- jangan menambah flow produksi baru di luar alur final tanpa alasan jelas
- kalau menyentuh sales, purchases, stock adjustment, dan production, selalu cek efek ke `inventory_logs`
- kalau menyentuh laporan, cek collection sumber datanya terlebih dahulu


## Catatan Batch Prioritas Terbaru
- Work Log costing final sudah diarahkan agar completed Work Log menyimpan `materialCostActual`, `laborCostActual`, `totalCostActual`, dan `costPerGoodUnit` sebagai read model HPP. HPP Analysis wajib memisahkan angka Final dan Preview agar payroll draft/estimasi Step tidak terbaca sebagai HPP final.
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
- Route lama `/stock-adjustment` dan `/stock-management` dipertahankan sementara sebagai compatibility redirect ke `/inventory/stock-management`, bukan halaman adjustment aktif terpisah.
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
- **Data historis/compatibility:** payroll preference custom di master karyawan hanya data historis/compatibility; payroll final mengikuti rule Tahapan Produksi dan Work Log completed.
- **Aktif:** Profit Loss membaca biaya payroll dari `expenses`, bukan dari `production_payrolls`, agar tidak double counting.
- **Aktif:** Export laporan final memakai XLSX rapi, bukan data mentah.

## Update UX Produksi Semi Product / BOM / Production Order — 2026-05-12
- **Aktif:** menu Semi Product boleh ditampilkan secara grouped/accordion berdasarkan **Product Family / Jenis Bunga → Kategori → Item** agar data tidak menjadi daftar campur panjang. Semi Product tetap merupakan stok produksi global/reusable, bukan data duplikat per produk jadi.
- **Aktif:** menu BOM / Resep Produksi boleh ditampilkan grouped berdasarkan **Target Type → Target Item → Resep Produksi**. Grouping ini hanya cara baca UI; source of truth tetap dokumen BOM existing.
- **Aktif:** drawer Buat Production Order memakai pemilihan target yang lebih natural, tetapi submit tetap wajib memakai `bomId` sebagai source of truth internal.
- **Aktif:** untuk `Produk Jadi`, drawer PO cukup menampilkan **Jenis Produksi → Produk yang dibuat → Resep Produksi jika lebih dari satu → Qty → Preview Kebutuhan**. Filter **Jenis Bunga / Product Family** dan **Kategori Bahan** tidak ditampilkan untuk produk jadi bila source product tidak memakai field itu.
- **Aktif:** untuk `Bahan / Semi Produk`, drawer PO menampilkan filter UI-only **Jenis Bunga / Product Family** dan **Kategori Bahan** sebelum field **Bahan yang dibuat**, agar user tidak memilih dari flat list panjang.
- **Guarded:** filter UI-only seperti selected family/category/target key tidak boleh disimpan ke database arsip dan tidak boleh membuat schema/collection baru.
- **Guarded:** istilah/kode internal seperti kode BOM atau kode target master boleh disembunyikan dari label pilihan user-facing, tetapi `bomId`, kode transaksi Production Order, dan referensi audit internal tetap wajib dipertahankan.
- **Guarded:** perubahan ini hanya UX/listing/selection; tidak boleh mengubah stok, requirement calculation, Work Log, Payroll, HPP Analysis, report, atau lifecycle Production Order.

## Update Production Planning / Planning Schedule — 2026-04-25
- **Aktif:** Production Planning ditambahkan sebagai layer target sebelum Production Order dengan canonical route `/production/planning` dan collection `production_plans`.
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
- **Guarded:** mode `hasVariants` tetap dikunci untuk edit biasa, tetapi data historis non-varian boleh mulai memakai varian lewat flow aman hanya jika `stock/currentStock`, `reservedStock`, dan `availableStock` semuanya 0.
- **Guarded:** varian baru pada item existing wajib mulai dari stok 0; stok fisik tetap harus masuk lewat Stock Management / Stock Adjustment / transaksi resmi.
- **Guarded:** item lama yang masih punya stok master atau reserved stock tidak boleh dikonversi otomatis ke varian karena itu akan memindahkan bucket stok tanpa audit.
- **Data historis:** field `stock` tetap disimpan sebagai alias/compatibility dan tidak boleh dihapus dari dokumen.
- **Aktif:** Stock Adjustment resmi mendukung `raw_materials`, `semi_finished_materials`, dan `products`. Semi Finished non-varian/bervarian dapat dikoreksi lewat Stock Management dengan transaction, `stock_adjustments`, dan `inventory_logs`.
- **Docs lock:** task berikutnya tidak boleh membuka kembali direct edit stok master kecuali ada business rule baru, audit trail baru, dan approval eksplisit.

### Hardening Edit Master Inventory — 2026-06-21
- **Aktif/P0:** backend Product, Raw Material, dan Semi Finished sekarang menjadi authority final untuk edit metadata. Payload client tidak boleh menentukan `stock`, `currentStock`, `reservedStock`, `availableStock`, atau field stok varian.
- **Aktif/P0:** generic SQLite JSON route menjalankan sanitizer inventory **sebelum** ekstraksi kolom SQL. Nilai stok final selalu diambil dari record database terbaru dan invariant `availableStock = max(currentStock - reservedStock, 0)` dihitung ulang.
- **Aktif/P0:** edit master memakai `expectedVersion`/`versionToken`. Snapshot form yang stale ditolak `409 INVENTORY_STALE_UPDATE`; update tanpa versi ditolak `428 INVENTORY_VERSION_REQUIRED`.
- **Aktif/P0:** `variantKey` existing immutable. Hapus/nonaktif varian berstok ditolak; varian zero-stock yang dihapus dipindahkan ke `archivedVariants[]`; varian baru pada item existing selalu mulai stok 0.
- **Aktif/P0:** valuation hasil transaksi/produksi dipertahankan dari database terbaru: Product `hppPerUnit`/cost alias, Raw Material `averageActualUnitCost`, dan Semi Finished `averageCostPerUnit`/`lastProductionCostPerUnit`/cost alias. Field reference/manual tetap dapat diedit sesuai rule modul.
- **Aktif/P1:** sinkronisasi `stock_read_models` dipindahkan ke backend dalam transaction SQLite yang sama dengan create/update/delete master. Direct create/update/delete read model dari client diblokir.
- **Aktif/P1:** Pricing Rule hanya mengirim payload harga minimal dan `expectedVersion`; snapshot item penuh tidak lagi ikut dikirim sehingga tidak dapat membawa stok/HPP stale.
- **Aktif/P1:** field valuation transaction-derived dibuat read-only pada UI edit master agar user tidak menerima kesan perubahan HPP/modal berhasil padahal backend wajib mempreserve nilai transaksi terbaru.
- **Aktif/P1:** response sukses generic write baru dikirim setelah transaction SQLite selesai `COMMIT`; kegagalan commit tidak boleh terlihat sebagai sukses di client.
- **Compatibility:** alias `stock`, `variantOptions`, archive/history varian, dan data lama tetap dipertahankan; delete master juga memeriksa snapshot stok pada `archivedVariants[]`. Tidak ada perubahan schema/collection/role guard. Route baru hanya `POST /api/pricing-rules/:id/apply` untuk batch pricing atomic yang sudah disetujui.
- **Aktif/P0 lanjutan:** resolver varian backend/frontend memilih `variants` hanya jika berisi data, lalu fallback ke `variantOptions` legacy. `variants: []` tidak boleh menutupi bucket stok legacy dan tidak boleh membuat item non-varian dianggap bervarian.
- **Aktif/P0 lanjutan:** setiap stock-out master/varian divalidasi terhadap saldo `availableStock` terbaru di dalam transaction Stock Engine. `reservedStock > currentStock` tidak boleh dihasilkan oleh mutation resmi.
- **Aktif/P1 lanjutan:** mutation normal menolak master/varian nonaktif. Return historis yang sudah lolos guard Sales boleh memakai override internal ter-audit dan dapat memulihkan varian arsip zero-stock; flag override tidak berasal dari payload client.
- **Aktif/P1 lanjutan:** create item bervarian wajib memiliki minimal satu varian aktif dan seluruh nested `availableStock` dinormalisasi sebelum persist/read-model sync.
- **Aktif/P1 lanjutan:** apply Pricing Rule SQLite memakai `POST /api/pricing-rules/:id/apply` dan satu transaction batch. Satu item stale/gagal menyebabkan seluruh batch rollback; tidak ada partial apply.

## Update Batch Fix Bug Merge — 2026-05-03
- **Aktif:** patch gabungan ini menggabungkan perbaikan no-decimal number format, sidebar nested accordion, login UI copy cleanup, Production Order strict variant requirement, Work Log worker stock audit, dan Semi Finished variant color rename ke baseline source/docs terbaru yang diunggah. Pada audit 2026-05-06, baseline yang diverifikasi adalah `Inventory-App.zip` + `docs.zip`.
- **Aktif:** format angka operasional diarahkan tanpa desimal melalui formatter dan input UI aktif; data historis yang sudah memiliki decimal tidak dimigrasi otomatis.
- **Guarded:** Production Order bervarian tidak boleh fallback diam-diam ke stok master/default. Preview PO dan Start Production harus memakai kontrak varian material yang sama.
- **Guarded:** completed Work Log tetap hanya boleh posting output stock satu kali, tetapi inventory log output produksi baru menyimpan snapshot operator/worker agar audit di Stock Management lebih jelas.
- **Guarded:** edit nama/label varian Product, Raw Material, dan Semi Finished hanya mengganti metadata tampilan; `variantKey` tetap menjadi identitas bucket stok/reference dan stok varian tidak boleh reset.
- **Aktif:** Pricing Rules opsional saat create Product/Raw Material. Mode default create adalah Manual; `pricingRuleId` hanya wajib saat user memilih mode Rule.
- **Aktif:** sidebar memakai nested accordion agar sibling submenu otomatis tertutup tanpa mengubah route, role access, atau business flow.
- **Aktif:** login normal tidak lagi menampilkan copy teknis internal runtime/auth/database arsip, tanpa mengubah flow Auth dan `system_users`.

## Update Pricing Mode Shared UI — 2026-05-11
- **Aktif:** Pricing Mode Product dan Raw Material sekarang memakai shared UI `src/components/Pricing/PricingModeSwitch.jsx` untuk pilihan Manual/Rule.
- **Scope component:** `PricingModeSwitch` hanya mengatur switch UI Manual/Rule dan meneruskan perubahan mode ke pemakai. Kontrak pemakaiannya wajib membersihkan `pricingRuleId` saat user kembali ke Manual.
- **Guarded:** `PricingModeSwitch` tidak boleh berisi formula pricing, service validation, query database arsip, atau auto-preview harga.
- **Guarded:** shared UI ini tidak mengubah schema/collection database arsip, tidak mengubah validasi service Product/Raw Material, dan tidak menjadi source perhitungan harga.
- **Aktif:** formula preview pricing tetap bersumber dari `buildSinglePricingPreview` di `pricingService`; auto-preview Product/Raw Material tetap local di halaman masing-masing karena base cost dan target price berbeda.

## Update Standar Referensi Audit dan Kode Manusiawi — 2026-05-11
- **Guarded:** Technical ID adalah internal database ID random, auto ID, internal generated ID, atau ID teknis lain yang tidak manusiawi. Technical ID bukan referensi audit bisnis.
- **Aktif:** Referensi ID bisnis manusiawi adalah acuan utama untuk audit, pencarian, relasi operasional, table, detail, drawer, report UI, dan export yang dibaca user.
- **Guarded:** Technical ID tidak boleh tampil di UI, tooltip, table, detail, drawer, report UI, atau fallback text. Jika referensi bisnis belum tersedia, UI wajib menampilkan fallback manusiawi seperti `-` atau `Referensi belum tersedia`, bukan ID database teknis.
- **Guarded:** Prioritas referensi audit adalah kode bisnis transaksi/master/produksi yang manusiawi, lalu `sourceRef` / `referenceNumber` readable, lalu fallback manusiawi. Jangan fallback ke Technical ID.
- **Target setelah reset data:** untuk collection bisnis baru dengan pola 1 dokumen = 1 referensi, internal database ID boleh dan sebaiknya sama dengan Referensi ID bisnis, misalnya `purchases/PUR-DDMMYYYY-001` atau `sales/ORD-DDMMYYYY-001`.
- **Target setelah reset data:** untuk collection log yang bisa memiliki banyak dokumen per referensi, gunakan ID turunan readable seperti `LOG-PUR-DDMMYYYY-001-001`, bukan random ID.
- **Guarded:** kode audit yang sudah dipakai harus immutable. Edit nama/ref tidak boleh otomatis mengubah kode audit lama tanpa approval migrasi.
- **Standar kode manusiawi:** jangan pakai mapping manual kata-per-kata atau dictionary singkatan per modul. Gunakan prefix modul yang disetujui + sequence shared; jangan membuat dictionary singkatan kata per modul di page/service.
- **Source of truth:** satu shared generator yang disetujui harus menjadi sumber kode manusiawi lintas modul. Page/service tidak boleh membuat generator baru atau duplicate logic.
- **Current state source aktual:** generator kode aktif berada pada backend SQLite dan memakai helper bersama `backend/src/utils/businessCodeCounter.js`. Tabel existing `business_code_counters` sudah menjadi runtime counter untuk kode managed pada generic master/config, Customer, Supplier, Pricing Rule, Purchase, Sales, Return, Stock Adjustment, Cash In/Out, Production Order, Work Log, dan Payroll. Preview kode tidak melakukan reservasi; create/commit final melakukan reservasi dalam transaction yang sama, mengambil baseline kode historis langsung di SQLite, tidak memakai full scan sequence di JavaScript, dan tidak memakai ulang kode soft-deleted.

## SQLite Concurrent Write & Runtime Counter — 2026-06-21
- **Aktif/P0:** seluruh akses koneksi SQLite singleton diproses melalui FIFO coordinator di `backend/src/db/connection.js`. Transaction `BEGIN IMMEDIATE` memegang akses eksklusif sampai `COMMIT`/`ROLLBACK`; read dan write request lain menunggu agar tidak ikut masuk ke transaction request lain.
- **Aktif/P0:** service finance, stock, transactions, pricing, production, auth, customer, supplier, category, generic JSON write, backup, dan restore memakai boundary bersama. Nested stock/finance/audit helper tetap reentrant dan tidak membuat nested transaction.
- **Aktif/P0:** queue tetap bergerak setelah callback gagal; rollback satu request tidak boleh membatalkan request lain. Context async yang sudah selesai tidak boleh terus melewati queue.
- **Aktif/P1:** backup lifecycle dan restore file swap berjalan eksklusif terhadap request database operasional. Restore tetap mempertahankan preview, confirm keyword, pre-restore backup, candidate validation, rollback file, dan audit yang sudah ada.
- **Aktif/P1:** automated regression mencakup transaction paralel, read menunggu commit, queue setelah rollback, counter code paralel, baseline data historis, finance/ledger, purchase/stock, dan last-admin guard.
- **Compatibility:** satu koneksi SQLite, WAL, `busy_timeout=5000`, schema, route, role guard, dan format data historis tetap dipertahankan. Serialization application-level ditambahkan di atas locking SQLite; bukan pengganti transaction database.
- **Observability aktif:** coordinator mempublikasikan queue depth, active operation, slow wait/operation, failure terakhir, dan database generation melalui status maintenance. Slow wait/operation dicatat ke structured JSON logger tanpa payload bisnis.
- **Runtime guard aktif:** Node.js didukung pada `>=22.12.0 <23`; versi rekomendasi `22.16.0` dikunci melalui `.nvmrc`, `.node-version`, package `engines`, CI, dan `npm run check:runtime`. Runner `dev`, test/check backend, test/build/lint frontend, serta `git:check` melakukan fail-fast agar Node di luar rentang dukungan tidak hanya menghasilkan warning lalu tetap menjalankan IMS.

## Maintenance Center — 2026-06-24
- **Aktif:** halaman `/utilities/reset-maintenance-data` tetap dipertahankan untuk compatibility route, tetapi label dan UI final memakai Maintenance Center.
- **Flow standar:** Backup & Restore → Audit & Health → Repair Data Turunan → Audit ulang → Riwayat.
- **Cleanup selesai:** tab Reset Testing, reset/baseline HPP, service repair stub/no-op, session-only maintenance log, export checklist JSON, dan checklist duplikat di Database Center sudah dihapus.
- **Audit & Health:** audit read-only nyata memeriksa integrity SQLite, foreign key, invariant stok master, stock read model, registry backup, dan pasangan kas-ledger.
- **Export data master:** tersedia sebagai export master SQLite read-only untuk arsip/review; bukan paket restore dan bukan merge transaksi.
- Backup resmi SQLite memakai satu file `.imsbackup` self-contained berisi database, manifest, checksum, dan README internal; file `.manifest.json` terpisah tidak dibuat lagi. Snapshot, lifecycle daily/monthly/retention, dan restore file swap memegang database coordinator eksklusif agar tidak berjalan bersamaan dengan request operasional. Struktur folder aktif hanya `daily/`, `monthly/`, dan `manual/`. Daily dibuat otomatis maksimal satu per hari dan disimpan 60 hari. Monthly dibuat otomatis dari daily verified terakhir setiap bulan dan disimpan maksimal 12 bulan. Backup manual, import, pre-update, pre-reset, pre-repair, dan pre-restore disimpan pada folder `manual/` serta tidak dihapus otomatis. Restore tetap full replace guarded, bukan merge; backup legacy `.imsbak.zip` dan sidecar manifest lama tetap dibaca sebagai kompatibilitas. Backup `pre-restore` dan backup sumber restore dipastikan tercatat ulang setelah restore agar rollback dan traceability tetap terlihat di daftar backup.
- **Guarded:** log/transaksi lama tidak direkomendasikan dibawa ulang sebagai default jika logic berubah; transaksi baru sebaiknya dibuat ulang lewat flow terbaru agar log baru mengikuti logic terbaru.
- **Opening stock:** setelah restore/reset manual di luar aplikasi, stok awal sebaiknya dibuat ulang lewat purchase/opening adjustment resmi, bukan menempel stok mentah tanpa audit.
- **Audit & Health aktif:** backend menyediakan audit read-only untuk integrity SQLite, foreign key, invariant stok master, stock read model, registry backup, dan pasangan kas-ledger. Audit tidak menulis data bisnis.
- **Repair Data Turunan aktif terbatas:** hanya missing/stale `stock_read_models` yang boleh direbuild dari master dan orphan projection yang boleh dibersihkan dengan keyword. Kedua aksi membuat backup `pre-repair`, memakai transaction, dan membuat audit log. Repair stok utama, transaksi, finance, production, payroll, serta HPP tetap tidak tersedia.
- **Import backup atomic:** file, `backup_logs`, dan audit import diproses dalam exclusive coordinator; kegagalan audit me-rollback row dan membersihkan file import agar tidak ada registry yatim.



## Hardening Platform Aman — 2026-06-21
- API mengirim security headers tanpa dependency baru: `nosniff`, frame deny, referrer policy, permissions policy, COOP/CORP, dan CSP ketat untuk response API.
- Structured JSON logger aktif untuk request/error/queue/server lifecycle, dengan rotation ukuran dan retention harian. Bootstrap secret tetap hanya dicetak ke terminal dan tidak ditulis ke log file.
- OpenAPI 3.1 ringkas tersedia administrator-only di `GET /api/openapi.json`; dokumentasi tidak membuka endpoint publik baru.
- Password tetap minimal 8 karakter, wajib huruf+angka, maksimum 128 karakter, dan menolak daftar password umum lokal. Screening breach online tidak dipakai agar runtime tetap offline.
- Vendor split hanya memisahkan React Router/React dan Day.js; business chunks tetap mengikuti route lazy. Tidak ada circular manual-chunk warning.

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
- Sales tetap boleh memakai nama field data historis `saleNumber`, tetapi value data baru wajib ber-prefix `ORD`.
- Date sequence wajib memakai `DDMMYYYY` dan sequence 3 digit (`001`, `002`, `003`).
- Master item/config produksi memakai sequence internal sederhana `PREFIX-001`. Kode ini disimpan untuk relasi/backstage dan tidak menjadi fokus UI.
- Internal database ID teknis/random tidak boleh tampil sebagai kode audit/user-facing.
- Data historis dengan prefix lama tetap compatibility, tetapi bukan standar data baru.


### Guard final reference code

- Kode utama harus otomatis dibuat oleh helper/service, bukan input manual user.
- Field kode utama di UI harus `disabled` dan/atau `readOnly` saat create/edit.
- Kode tidak boleh berubah saat edit nama, kontak, katalog, harga, atau status.
- Untuk data baru yang satu dokumen mewakili satu reference utama, document ID idealnya sama dengan kode bisnis.
- Data historis tidak boleh di-rename document ID tanpa preview/repair plan terpisah.
- Generator readable semantic lama sudah tidak menjadi flow aktif; data historis readable tetap dibaca sebagai data existing, sedangkan data baru Product, Raw Material, Semi Finished, BOM, dan Production Step memakai sequence internal `PREFIX-001`.
- Prefix lama `SAL`, `RM`, `CIN`, `COUT`, `WL`, `ADJ`, dan `STEP` hanya boleh muncul sebagai catatan compatibility data historis/audit, bukan generator data baru.


### UI rule final: master item/config code internal

- Kode untuk Product, Raw Material, Semi Finished, BOM, dan Production Step adalah **kode internal**.
- Service tetap wajib membuat dan menyimpan field `code` otomatis saat create.
- Kode internal master item/config tidak wajib tampil sebagai field utama UI, tidak perlu realtime preview, dan tidak boleh diinput manual user.
- UI utama master item/config memakai nama dan atribut bisnis sebagai identitas: kategori, warna, bahan, varian, target produk, step, dan satuan.
- Kode transaksi/audit tetap wajib tampil di UI: Customer, Supplier, Purchase, Sales/Order, Return, Stock Adjustment, Cash In, Cash Out, Production Order, Work Log/Job, Payroll, dan laporan/history terkait.

## Update Guard Semi Product Flower Group — 2026-05-17
- **Aktif:** Semi Product tidak boleh silent default ke `Mawar`. Field `flowerGroup` harus dipilih/diketik eksplisit saat create/edit agar jenis bunga lain tidak salah masuk grouping Mawar.
- **Aktif:** data historis tanpa `flowerGroup` tetap tampil sebagai `Umum / Reusable`; data dengan custom/unknown `flowerGroup` harus ditampilkan sebagai label aslinya, bukan disembunyikan menjadi `-`.
- **Guarded:** filter `Jenis Bunga / Product Family` di Production Order tetap UI-only dan tidak boleh disimpan ke `production_orders`; source of truth submit tetap `bomId`.



## Update Produksi/HPP — 2026-05-17
- Detail Work Log dan HPP Analysis memakai resolver labor yang sama: payroll final, draft payroll, lalu estimasi Step sebagai read-only preview.
- Overhead aktif berasal dari BOM untuk listrik/glue gun. Field hasil selain Good Qty adalah compatibility data historis dan tidak ditampilkan sebagai workflow aktif.
- Data Quality Audit produksi read-only mendeteksi Work Log data historis status, payroll pending/mismatch, output HPP yang butuh reconcile, dan Semi Finished tanpa `flowerGroup`; audit hasil selain Good Qty sengaja tidak diaktifkan.

## Update SQLite Local Runtime Pilot

Status terbaru: source aktual sudah SQLite-first untuk runtime utama. `frontend/.env.example` mengaktifkan `VITE_AUTH_MODE=sqlite` dan repository mode aktif hanya `sqlite_sidecar`. Konstanta mode lama `offline_local` dan `hybrid_sync` sudah dihapus agar tidak terlihat sebagai opsi runtime. Database browser arsip tidak lagi dipakai sebagai runtime aktif Offline Database Center. Supplier, Product, Raw Material, Semi Finished, Stock, Transactions, Finance, Production, dan Reports harus melalui backend SQLite sesuai service/endpoint aktual.

## Mobile UI Standard v1.0 — Keputusan Aktif

IMS Bunga Flanel memakai standar mobile portrait-first. Desktop tetap menggunakan tabel profesional, sedangkan mobile harus menggunakan card/list ringkas dengan detail drawer. Tujuannya agar user tidak perlu memiringkan HP, zoom, atau horizontal scroll body.

Guardrail mobile:

- Patch mobile adalah UI-only kecuali ada approval khusus.
- Jangan mengubah business logic saat scope hanya mobile UI.
- `DataTableView` + `mobileCardConfig` menjadi pola utama untuk daftar data.
- `MobileActionMenu`, `MobileDetailDrawer`, `ResponsiveFormSection`, dan `MobileStateBlock` menjadi komponen foundation.
- Setiap patch mobile wajib update docs agar standar tidak balik ke pola lama.

## Update Mobile UI Standard M1-M5 — 2026-06-05

Keputusan aktif tambahan:

- Mobile IMS memakai standar portrait-first untuk semua phase M1-M5.
- `DataTableView + mobileCardConfig` menjadi pola wajib untuk daftar operasional lintas modul.
- `ResponsiveDataView` adalah alias standar untuk `DataTableView`; tidak boleh membuat komponen table/card baru yang menduplikasi behavior.
- Foundation mobile aktif: `MobileActionMenu`, `MobileFilterDrawer`, `MobileDetailDrawer`, `ResponsiveFormSection`, dan `MobileStateBlock`.
- Patch mobile harus UI-only kecuali ada persetujuan khusus. Jangan mengubah stock mutation, sales/purchase/return commit, finance ledger, production material usage, payroll final, HPP, backup/restore, maintenance destructive flow, auth, schema, atau role guard.
- Dokumentasi wajib ikut diperbarui setiap patch mobile agar standar tidak kembali ke tampilan desktop table di HP.

## Update 2026-06-05 - UI Runtime Database Tidak Ditampilkan di Halaman Operasional

Karena IMS sudah memakai database lokal utama, halaman operasional tidak perlu menampilkan banner teknis mode database. Label mode database, instruksi IP/port/firewall, dan tombol cepat ke pusat database harus dihapus dari halaman kerja harian seperti Kategori, Customer, dan Supplier. Informasi teknis koneksi hanya boleh berada di Maintenance/Database Center.


## Responsive UI/UX Standard v2 — 2026-06-21

Status: **AKTIF / SOURCE-ALIGNED / GUARDED**.

- Source aktual memakai floating module dock untuk desktop, Drawer kiri untuk tablet, serta bottom navigation + bottom sheet role-aware untuk telepon.
- Matrix aktif: desktop lebar `>= 1200px`, desktop compact `993-1199px`, tablet `768-992px`, telepon `<= 767px`, dan penyesuaian telepon kecil `<= 374px`.
- Viewport desktop dengan tinggi `<= 720px` memakai dock low-height agar seluruh icon tetap berada di dalam rail.
- Module Hub menjadi landing child menu; child route bisnis, compatibility path, role guard, dan service existing tetap dipertahankan.
- Source menu lintas desktop/tablet/mobile tetap `sidebarMenuItems + filterSidebarMenuItemsByRole`; hidden menu bukan security control.
- Rundown lintas perangkat, visual density, safe area, overlay, test matrix, dan Definition of Done resmi berada di `docs/21_RESPONSIVE_UI_UX_STANDARD.md`.
- Perubahan responsive tetap UI-only kecuali ada approval eksplisit; jangan mengubah schema, stock, transaksi, production, payroll, HPP, finance, reset, atau audit log hanya untuk layout.
