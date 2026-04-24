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
- utility page seperti `ResetTestData` boleh tetap berbeda di level page shell selama tabel preview-nya sudah mengikuti baseline table global
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

## Update Master Context: Source of Truth Varian Produksi
Flow varian produksi final sekarang memakai satu source of truth:
- PO `targetVariantKey` / `targetVariantLabel`
- Work Log root snapshot dari PO
- Work Log output variant dari snapshot PO
- stock mutation dan inventory log mengikuti output variant tersebut

Area ini termasuk guarded production logic. Patch UI atau refactor shared component tidak boleh mengubah contract varian PO -> Work Log -> Output tanpa evaluasi produksi khusus.

## Update Master Context: Display Varian Produksi
Tampilan varian produksi sekarang harus mengikuti field final yang sama dengan mutasi stok:
- PO detail membaca `targetVariantKey` / `targetVariantLabel` dan requirement `resolvedVariantKey` / `resolvedVariantLabel`.
- Work Log detail membaca snapshot target, material usage resolved variant, dan output variant.
- Inventory log display membaca `variantLabel` lalu fallback ke `variantKey` agar audit stok tidak terlihat master ketika mutasi aktual sudah varian.

Label `Master` hanya boleh muncul untuk item yang memang tidak memakai varian. Jika item bervarian tetapi field variant kosong, UI harus menandai sebagai mismatch/data lama, bukan menampilkan seolah normal.

## Update Master Context: Reset & Maintenance Data Terpusat
Menu `Reset & Maintenance Data` sekarang menjadi pusat resmi untuk dua kebutuhan yang berbeda:
- **Maintenance / Sinkronisasi Data**: audit dan repair field turunan/snapshot/display tanpa menghapus data dan tanpa posting stok/kas/payroll/HPP ulang.
- **Reset Data**: aksi destructive terarah per modul dengan preview dan konfirmasi.

Implementasi awal maintenance difokuskan ke produksi varian lama. Service maintenance dipisahkan ke `src/services/Maintenance/productionVariantMaintenanceService.js` agar tidak bercampur dengan service operasional produksi aktif.

## Update Master Context: Variant Support Lintas Modul
Dukungan varian lintas aplikasi sekarang distandardisasi ke helper stok final `updateInventoryStock` di `src/services/Inventory/inventoryService.js`.

Contract final lintas modul:
- item bervarian wajib memilih `variantKey` sebelum mutasi stok manual/transaksi umum
- mutasi stok final menyinkronkan `variants[]`, `currentStock`, `stock`, `reservedStock`, dan `availableStock`
- inventory log final menulis `variantKey`, `variantLabel`, dan `stockSourceType`
- `updateStock()` tetap ada hanya sebagai wrapper legacy/deprecated untuk import lama dan tidak boleh dipakai pada menu baru/final

Menu yang sudah ikut contract final awal:
- Stock Adjustment untuk raw material, product, dan semi finished material
- Purchases untuk raw material variant dan product variant
- Sales untuk pemotongan stok variant dan revert cancel/delete ke variant yang sama
- Returns untuk penambahan stok variant
- Stock Management membaca schema log final plus field legacy pembelian lama
- Stock Report membaca aggregate final dan semi finished material

## Formatter Display Final
- Formatter shared resmi berada di `src/utils/formatters/numberId.js`, `src/utils/formatters/currencyId.js`, dan `src/utils/formatters/dateId.js`.
- Angka umum, qty, stok, summary count, dan persentase harus memakai helper number formatter shared agar angka bulat tidak menampilkan `.00`.
- Nominal uang harus memakai `formatCurrencyId` / `formatCurrencyIDR` agar tampilan Rupiah konsisten di seluruh aplikasi.
- Page baru tidak boleh membuat `Intl.NumberFormat("id-ID")`, `toLocaleString("id-ID")`, atau `toFixed()` lokal untuk kebutuhan display jika helper shared sudah cukup.
