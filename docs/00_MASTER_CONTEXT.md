# MASTER CONTEXT — IMS Bunga Flanel

Dokumen ini dibuat berdasarkan audit langsung terhadap source code aplikasi. Update terbaru 2026-06-07 memakai ZIP `Inventory-App-clean.zip` sebagai sumber kebenaran utama, bukan template umum atau docs lama.

Update verifikasi source aktual — 2026-06-07:
- source yang divalidasi: ZIP `Inventory-App-clean.zip` dengan root project `Inventory-App-test`;
- runtime utama source aktual adalah React/Vite frontend + Node.js Express backend + SQLite file lokal/LAN;
- `backend/src/server.js` mendaftarkan endpoint `/api/**` untuk Auth, master data, stock, transaksi, finance, production, reports, maintenance, dan audit log;
- `frontend/src/context/AuthContext.jsx` memakai `localAuthService` dan `authMode: "sqlite"`; nama state auth lama yang masih tersisa hanya compatibility internal untuk actor label lama, bukan runtime auth lama;
- `frontend/src/data/repositories/repositoryMode.js` memetakan alias lama `primary arsip`, `offline_local`, dan `hybrid_sync` ke `sqlite_sidecar`; alias ini tidak boleh dianggap fallback runtime arsip;
- `frontend/package.json` source aktual tidak memiliki dependency `runtime-arsip` atau `database-browser-arsip`.

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
- `/stock-adjustment` sekarang redirect lama ke `/stock-management`
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
- Route lama `/stock-adjustment` dipertahankan sebagai redirect lama ke `/stock-management`, bukan halaman adjustment aktif.
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
- **Guarded:** mode `hasVariants` tetap dikunci untuk edit biasa, tetapi data historis non-varian boleh mulai memakai varian lewat flow aman hanya jika `stock/currentStock`, `reservedStock`, dan `availableStock` semuanya 0.
- **Guarded:** varian baru pada item existing wajib mulai dari stok 0; stok fisik tetap harus masuk lewat Stock Management / Stock Adjustment / transaksi resmi.
- **Guarded:** item lama yang masih punya stok master atau reserved stock tidak boleh dikonversi otomatis ke varian karena itu akan memindahkan bucket stok tanpa audit.
- **Data historis:** field `stock` tetap disimpan sebagai alias/compatibility dan tidak boleh dihapus dari dokumen.
- **Aktif:** Stock Adjustment resmi mendukung `raw_materials`, `semi_finished_materials`, dan `products`. Semi Finished non-varian/bervarian dapat dikoreksi lewat Stock Management dengan transaction, `stock_adjustments`, dan `inventory_logs`.
- **Docs lock:** task berikutnya tidak boleh membuka kembali direct edit stok master kecuali ada business rule baru, audit trail baru, dan approval eksplisit.

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
- **Current state note:** source terbaru sudah memakai `businessCodeGenerator.js` sebagai source of truth utama dan `productionCodeGenerator.js` hanya wrapper compatibility. Cleanup lanjutan tetap guarded untuk strategi counter/ID log readable, bukan untuk membuat generator baru.

## Maintenance & Backup Center — 2026-06-07
- **Aktif:** Reset & Maintenance Data menjadi Maintenance & Backup Center, bukan daftar tombol reset teknis.
- **Flow standar:** Backup & Restore → Audit Data → Repair Aman → Export Master/Checklist → Audit ulang.
- **Reset testing lama:** route/tab hanya menampilkan status nonaktif. Handler reset testing lama tidak tersedia di UI operasional.
- **Auto detect:** audit data historis/stok/log/produksi/payroll/variant transaksi bersifat read-only terhadap data bisnis dan hanya boleh membuat maintenance log metadata.
- **Export data pokok:** tersedia sebagai backup/checklist master, bukan restore otomatis.
- **Guarded:** log/transaksi lama tidak direkomendasikan dibawa ulang sebagai default jika logic berubah; transaksi baru sebaiknya dibuat ulang lewat flow terbaru agar log baru mengikuti logic terbaru.
- **Opening stock:** setelah restore/reset manual di luar aplikasi, stok awal sebaiknya dibuat ulang lewat purchase/opening adjustment resmi, bukan menempel stok mentah tanpa audit.


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

Status terbaru: source aktual sudah SQLite-first untuk runtime utama. `frontend/.env.example` mengaktifkan `VITE_AUTH_MODE=sqlite` dan semua repository mode utama diarahkan ke SQLite. Alias data historis seperti `primary arsip`, `offline_local`, dan `hybrid_sync` dinormalisasi ke `sqlite_sidecar`, bukan menghidupkan runtime arsip. database browser arsip tidak lagi dipakai sebagai runtime aktif Offline Database Center. Supplier, Product, Raw Material, Semi Finished, Stock, Transactions, Finance, Production, dan Reports harus melalui backend SQLite sesuai service/endpoint aktual.

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
- Patch mobile harus UI-only kecuali ada persetujuan khusus. Jangan mengubah stock mutation, sales/purchase/return commit, finance ledger, production material usage, payroll final, HPP, backup/restore, reset testing, auth, schema, atau role guard.
- Dokumentasi wajib ikut diperbarui setiap patch mobile agar standar tidak kembali ke tampilan desktop table di HP.

## Update 2026-06-05 - UI Runtime Database Tidak Ditampilkan di Halaman Operasional

Karena IMS sudah memakai database lokal utama, halaman operasional tidak perlu menampilkan banner teknis mode database. Label mode database, instruksi IP/port/firewall, dan tombol cepat ke pusat database harus dihapus dari halaman kerja harian seperti Kategori, Customer, dan Supplier. Informasi teknis koneksi hanya boleh berada di Maintenance/Database Center.
