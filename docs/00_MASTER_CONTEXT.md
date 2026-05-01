# MASTER CONTEXT — IMS Bunga Flanel

Dokumen ini dibuat berdasarkan audit langsung terhadap source code aplikasi pada folder `IMS_Bunga_Flanel` yang diunggah, bukan template umum.

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
- Backend tambahan: Firebase Functions (ada, tetapi tampak legacy dan tidak menjadi flow utama saat ini)

## Struktur Teknis Utama yang Terverifikasi
- `src/main.jsx` memakai `HashRouter`
- `src/layouts/AppLayout.jsx` menangani shell aplikasi, dark mode, sidebar, header, dan route container
- `src/router/AppRoutes.jsx` adalah peta route utama
- `src/services/**` berisi service utama untuk master data, pricing, inventory, produksi, dan reset utilitas
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
- `/utilities/reset-test-data`

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

## Update Migrasi UI Produksi Shared — 2026-05-01
- Migrasi presentational/layout ke `src/components/Produksi/shared/*` sudah diterapkan bertahap untuk halaman:
  - `ProductionEmployees.jsx`
  - `ProductionProfiles.jsx`
  - `ProductionSteps.jsx`
  - `SemiFinishedMaterials.jsx`
  - `ProductionOrders.jsx`
  - `ProductionPayrolls.jsx`
  - `ProductionPlanning.jsx`
  - `ProductionHppAnalysis.jsx`
- Halaman baseline referensi tetap:
  - `ProductionWorkLogs.jsx`
  - `ProductionBoms.jsx`
- Guardrail tetap aktif:
  - perubahan hanya wrapper UI (header/summary/filter/section visual),
  - tidak mengubah service, query/mutation, payload submit, status transition, kalkulasi stok/payroll/HPP, atau posting flow produksi.

## Update Integrasi IMS Otomatis — 2026-04-25
- Flow final IMS aktif: **Work Log completed → Payroll Produksi → Payroll paid → Cash Out/Expense → Profit Loss**.
- Payroll Produksi yang ditandai `paid` sekarang otomatis membuat expense di collection `expenses` dengan source reference `production_payroll`.
- Expense payroll wajib punya `sourceModule`, `sourceId`, `sourceRef`, `sourceType`, dan `createdByAutomation` agar audit jelas dan tidak double.
- Profit Loss tetap membaca collection final `expenses`; payroll tidak dihitung langsung dari `production_payrolls` supaya biaya payroll tidak dobel.
- Backfill Work Log/payroll lama tetap tidak otomatis dilakukan; jika diperlukan harus dibuat task terpisah dengan preview.


## Final Documentation Lock — Task 6
Status cleanup bertahap yang dikunci di docs:
- **Aktif:** Stock Management adalah satu entry point inventory; Stock Adjustment berada di dalamnya dan wajib memakai format angka Indonesia tanpa trailing `.00`.
- **Aktif:** Kolom Referensi Audit di Stock Management adalah audit source, bukan kolom tidak berguna; tampilannya harus manusiawi dan ID teknis hanya detail sekunder.
- **Aktif:** Production Order create drawer memakai preview compact read-only untuk stok target, varian target, qty batch, estimasi output, kebutuhan material, stok material, dan status cukup/kurang.
- **Guarded:** Completed Work Log harus menjaga material cost, labor cost, total cost, cost per good unit, output stock posting, dan auto payroll agar tidak diproses dua kali.
- **Aktif:** Work Log completed membuat payroll line otomatis; payroll `paid` membuat Cash Out/Expense otomatis dengan guard idempotent.
- **Legacy/compatibility:** payroll preference custom di master karyawan hanya data lama/compatibility; payroll final mengikuti rule Tahapan Produksi dan Work Log completed.
- **Aktif:** Profit Loss membaca biaya payroll dari `expenses`, bukan dari `production_payrolls`, agar tidak double counting.
- **Aktif:** Export laporan final memakai XLSX rapi, bukan data mentah.

## Update Production Planning / Planning Schedule — 2026-04-25
- **Aktif:** Production Planning ditambahkan sebagai layer target sebelum Production Order dengan route `/produksi/production-planning` dan collection `production_plans`.
- **Aktif:** Flow final menjadi **Planning → Production Order → Work Log completed → Payroll/HPP → Dashboard**.
- **Business rule terkunci:** planning hanya menyimpan target, periode, deadline, prioritas, catatan, target item/varian, dan link PO; planning **tidak mengubah stok**, tidak membuat payroll, tidak membuat expense, dan tidak masuk HPP langsung.
- **Guarded:** Production Order yang dibuat dari planning tetap diproses oleh service PO existing sehingga kebutuhan material tetap dihitung dari BOM dan helper requirement final.
- **Aktif:** progress planning dihitung dari Work Log `completed` milik PO terkait, dengan filter target item dan `targetVariantKey` jika item bervarian.
- **Aktif:** Dashboard membaca summary planning mingguan/bulanan, overdue, dan kurang target secara read-only.
- **Compatibility:** PO lama tanpa `planningId` tetap valid sebagai PO manual; Work Log lama tanpa planning tetap valid dan tidak dimigrasi otomatis.
- **Docs lock:** patch berikutnya tidak boleh menganggap planning sebagai stok nyata atau shortcut untuk memotong bahan.
