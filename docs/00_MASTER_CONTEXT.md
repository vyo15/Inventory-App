# MASTER CONTEXT — IMS Bunga Flanel

Dokumen ini dibuat berdasarkan audit langsung terhadap source code aplikasi pada folder `IMS_Bunga_Flanel` yang diunggah, bukan template umum.

## Ringkasan Aplikasi
IMS Bunga Flanel adalah aplikasi inventory dan operasional usaha yang mencakup:
- master data bahan baku, produk jadi, supplier, pelanggan, kategori, dan pricing rules
- transaksi pembelian, penjualan, retur, pemasukan, dan pengeluaran
- inventaris dan audit log stok
- modul produksi modern berbasis BOM → Production Order → Work Log → Payroll → Analisis HPP
- payroll produksi final sekarang dikunci ke flow: Work Log completed → auto-create payroll draft per operator → review/confirm → paid/cancelled
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
- `/stock-adjustment`
- `/stock-management`
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
- baseline resmi table/action sekarang dikunci: kolom aksi main table selalu di kanan, dan table lebar wajib memakai sticky/fixed right untuk aksi utama
- halaman dibagi menjadi empat klasifikasi UI resmi: detail-capable page, simple config page, ledger/simple action page, dan read-only data table page
- tombol `Detail` hanya dipakai pada halaman yang memang punya drawer/detail read-only atau modal detail yang jelas
- global normalization terbaru sudah membawa pola baseline ini ke: Sales, Supplier Purchases, Pricing Rules, Purchases, Returns, Stock Adjustment, Stock Management, report pages, dan Analisis HPP
- utility page seperti `ResetMaintenanceData` boleh tetap berbeda di level page shell selama tabel preview-nya sudah mengikuti baseline table global
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

## Update Master Context: Cleanup File Legacy / Wrapper

Batch cleanup terbaru menegaskan struktur aktif berikut:
- flow produksi aktif tetap memakai BOM → Production Order → Work Log → Payroll → HPP Analysis;
- helper/service produksi lama berbasis collection `productions` tidak lagi menjadi jalur operasional;
- file kosong, helper tidak terimpor, dan wrapper/testing-only yang tidak punya import aktif harus dipetakan sebelum dihapus;
- penghapusan file legacy tidak boleh mengubah business rules, stok, kas, payroll, HPP, atau flow produksi final.

File yang sudah teridentifikasi aman untuk penghapusan manual di batch cleanup ini:
- `src/components/Layout/Display/StatusBadge.jsx` dan `src/components/Layout/Display/StatusBadge.css` karena kosong dan tidak diimport;
- `src/constants/productOptions.js` karena tidak diimport dan source final produk sudah berada di `productsService.js` + `variantHelpers.js`;
- `src/constants/salesStatusOptions.js` karena tidak diimport dan status sales aktif masih dikelola di halaman Sales saat ini;
- `src/hooks/useAppRole.js` karena tidak diimport oleh layout/route aktif;
- `src/services/Produksi/productionService.js` karena flow produksi final tidak lagi memakainya dan collection `productions` hanya dipertahankan sebagai data legacy yang dapat dibersihkan melalui reset terarah.

## Update Master Context: Cleanup Structure Batch 2

Batch cleanup structure berikutnya memindahkan entry final menu sistem dari nama testing lama ke struktur final:
- route utama sekarang: `/utilities/reset-maintenance-data`;
- halaman utama sekarang: `src/pages/Utilities/ResetMaintenanceData.jsx`;
- service reset/preview/baseline destructive sekarang: `src/services/Maintenance/resetMaintenanceDataService.js`;
- route lama `/utilities/reset-test-data` hanya redirect kompatibilitas untuk bookmark lama.

File transisi yang aman dihapus setelah patch ini tervalidasi:
- `src/pages/Utilities/ResetTestData.jsx` karena route/import final sudah pindah ke `ResetMaintenanceData.jsx`;
- `src/services/Utilities/resetTestDataService.js` karena import final sudah pindah ke `services/Maintenance/resetMaintenanceDataService.js`.

Catatan penting: perubahan ini hanya merapikan entry/import/route maintenance. Tidak ada perubahan business rules, stok, kas, payroll, HPP, atau flow produksi final.

## Update Batch 3 — Cleanup Data Legacy via Reset & Maintenance
- Menu `Reset & Maintenance Data` sekarang menjadi fondasi resmi untuk dry run data legacy sebelum cleanup file/logic berikutnya.
- Audit legacy memetakan `productions`, orphan `inventory_logs`, PO/Work Log stale, transaksi bervarian lama tanpa snapshot variant, dan income/expense yang source reference-nya tidak jelas.
- Dry run legacy tidak mengubah data domain; hasilnya hanya membagi data menjadi OK, aman repair, display repair, aman reset scoped, atau butuh manual review.
- Reset scoped tetap harus melalui preview dan konfirmasi `RESET`; tidak boleh ada delete database manual tanpa audit.
