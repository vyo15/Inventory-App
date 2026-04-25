# TEST CHECKLIST — IMS Bunga Flanel

Checklist ini disusun berdasarkan modul yang benar-benar ada di aplikasi saat ini.

## A. Master Data

### Produk Jadi
- tambah produk tanpa varian
- tambah produk dengan varian
- edit produk
- ubah pricing mode rule/manual
- toggle aktif/nonaktif
- cek field stok dan min stock alert tersimpan benar

### Bahan Baku
- tambah bahan baku tanpa varian
- tambah bahan baku dengan varian
- pilih supplier
- edit harga referensi dan average actual unit cost
- toggle aktif/nonaktif
- cek variant totals tersinkron

### Supplier
- tambah/edit supplier
- cek dropdown supplier di bahan baku dan pembelian

### Customer
- tambah customer
- edit customer
- hapus customer
- cek customer baru muncul di modul sales
- cek tidak ada split data antara `Customers` dan `customers`

### Pricing Rules
- buat rule untuk raw materials
- buat rule untuk products
- tes margin percent
- tes margin nominal
- tes marketplace buffer nominal
- tes marketplace buffer percent
- tes rounding up/down/nearest
- apply rule ke item mode `rule`
- pastikan item mode `manual` tidak ikut berubah

## B. Transaksi

### Pembelian
- buat pembelian bahan baku non-varian
- buat pembelian bahan baku varian
- buat pembelian produk
- cek `totalStockIn`
- cek `actualUnitCost`
- cek `purchaseSaving`
- cek stok bertambah
- cek inventory log `purchase_in`
- cek expense otomatis masuk

### Penjualan
- buat penjualan status `Diproses`
- cek stok langsung berkurang
- pastikan income belum tercatat
- ubah status menjadi `Selesai`
- cek income tercatat sekali saja
- ubah status menjadi `Dibatalkan`
- cek stok kembali
- hapus sale yang statusnya belum dibatalkan
- cek stok kembali satu kali
- hapus sale yang sudah dibatalkan
- cek stok tidak double revert

### Retur
- tambah retur produk
- tambah retur bahan baku
- cek stok bertambah
- cek inventory log `return_in`

## C. Kas & Biaya

### Cash In
- tambah pemasukan manual
- cek data masuk ke `revenues`
- cek penjualan selesai muncul dari `incomes`
- cek filter bulan/tahun

### Cash Out
- tambah pengeluaran manual
- cek data masuk ke `expenses`
- cek pembelian otomatis tampil sebagai expense
- cek saving tampil sebagai info, bukan pengurang nilai amount

## D. Inventaris

### Stock Adjustment
- tambah adjustment masuk bahan baku
- tambah adjustment keluar produk
- cek `stock_adjustments`
- cek inventory log `stock_adjustment`
- cek sinkronisasi `stock` dan `currentStock`

### Stock Management
- cek semua sumber mutasi muncul
- cek filter arah masuk/keluar
- cek pencarian keyword
- cek referensi sale/customer/supplier/PO/work log terbaca

## E. Produksi

### Tahapan Produksi
- tambah step
- edit step
- nonaktifkan step
- cek relasi ke karyawan/BOM

### Karyawan Produksi
- tambah karyawan
- assign step
- nonaktifkan karyawan

### Profil Produksi
- tambah profil
- mapping profil ke produk
- cek perhitungan kapasitas otomatis

### Semi Finished Materials
- tambah item tanpa varian
- tambah item dengan varian
- cek total stock, available stock, active variant count

### BOM Produksi
- buat BOM target semi finished
- buat BOM target product
- pastikan BOM product hanya menerima material semi finished
- cek material lines dan step lines tersimpan benar

### Production Order
- generate PO dari BOM
- cek requirement line
- cek status `shortage` / `ready`
- cek target varian bila ada

### Work Log Produksi
- buka menu Work Log Produksi saat semua referensi produksi normal
- buka menu Work Log Produksi saat salah satu referensi produksi gagal dimuat lalu pastikan halaman tetap tampil dengan warning
- cek list work log tetap tampil urut terbaru walau query utama fallback
- buat work log manual dari tombol tambah
- buat work log dari PO eligible
- pastikan PO `ready` / `shortage` bisa dipakai start produksi
- pastikan PO yang sudah punya work log tidak muncul lagi di referensi Work Log
- isi material usage
- isi outputs
- cek worker dan biaya aktual
- cek status `draft`, `in_progress`, `completed`
- cek konsumsi stok material
- cek penambahan stok output
- selesaikan work log dari popup complete
- pastikan work log completed tidak bisa diedit ulang sembarangan
- cek payroll tetap bisa membaca work log completed
- cek HPP tetap bisa membaca work log completed

### Payroll Produksi
- selesaikan work log eligible dan pastikan draft payroll langsung terbentuk otomatis per operator
- cek operator produksi langsung muncul di menu Payroll tanpa generate manual
- cek nilai payroll per line sesuai step rule snapshot pada Work Log
- confirm payroll draft
- ubah status confirmed → paid
- cancel payroll draft/confirmed dan pastikan line tidak aktif lagi

### Analisis HPP
- pastikan work log completed terbaca
- cek total biaya produksi
- cek total good qty
- cek rata-rata HPP per unit

### Baseline UI Table / Action
- cek semua main table prioritas apakah kolom `Aksi` ada di paling kanan
- cek main table lebar apakah aksi utama tetap terlihat tanpa scroll horizontal dulu
- cek `ProductionOrders` apakah `Detail / Refresh Need / Mulai Produksi` tetap langsung terlihat
- cek `ProductionSteps` sekarang tampil sebagai detail-capable page ringan: tabel utama ringkas, tombol `Detail` ada, dan drawer Detail read-only tampil benar
- cek `ProductionProfiles` tetap konsisten sebagai simple config page tanpa tombol `Detail`
- cek `CashIn` dan `CashOut` tetap rapi sebagai ledger/simple action page tanpa ubah logic handler
- cek nested/subtable BOM dan Work Log tetap usable walau tidak dipaksa sticky
- cek dark mode dan light mode
- cek semua tombol aksi tetap memanggil handler yang benar

## F. Laporan
- Stock Report tampil benar
- Purchases Report membaca pengeluaran pembelian
- Sales Report menampilkan total dan status transaksi
- Profit Loss menggabungkan revenues + incomes + expenses dengan benar
- ekspor Excel/CSV berjalan

## G. Utility Reset
- preview reset sesuai modul terpilih
- simpan baseline stok
- reset transaksi saja
- reset + zero stock
- reset + restore baseline
- cek field stok sinkron kembali setelah reset


### Global UI Normalization Batch
- cek `Sales` apakah status + aksi tetap konsisten dan tombol row tidak lagi terasa manual/acak
- cek `SupplierPurchases` apakah tombol `Detail` sekarang muncul jelas di kolom aksi
- cek `PricingRules` apakah tombol `Detail` membuka modal detail/preview yang benar
- cek `Purchases`, `Returns`, `StockAdjustment`, `StockManagement`, `StockReport`, `PurchasesReport`, `SalesReport`, `ProfitLossReport`, dan `ProductionHppAnalysis` apakah main table sudah memakai baseline surface global
- cek halaman lebar tetap nyaman dipakai dengan `scroll.x` dan sticky/fixed right bila ada aksi
- cek `ResetMaintenanceData` apakah tabel preview tetap rapi walau page shell utility masih transisi
- cek dark mode dan light mode setelah normalisasi batch global
- cek tidak ada variasi action liar baru di luar baseline final

## Checklist Cleanup File Legacy / Wrapper

Setelah menjalankan script penghapusan file legacy:

- jalankan `npm run dev` dan hard refresh browser;
- buka Dashboard;
- buka Produk Jadi dan pastikan form produk/varian tetap normal;
- buka Penjualan dan pastikan status/tab sales tetap normal;
- buka semua menu produksi final: BOM, Production Order, Work Log, Payroll, Analisis HPP;
- pastikan tidak ada import error untuk `StatusBadge`, `productOptions`, `salesStatusOptions`, `useAppRole`, atau `productionService`;
- pastikan route/sidebar tetap menuju halaman aktif yang benar;
- jalankan pencarian import: tidak boleh ada import ke file yang sudah dihapus;
- jangan menghapus data Firestore hanya karena file legacy dihapus;
- jika perlu sinkronisasi data lama, gunakan menu Reset & Maintenance Data dengan dry run terlebih dulu.

## Checklist Cleanup Structure Batch 2

- buka menu `Sistem → Reset & Maintenance Data` dan pastikan path final `/utilities/reset-maintenance-data` terbuka;
- buka path lama `/utilities/reset-test-data` dan pastikan redirect ke path final;
- jalankan script `scripts/maintenance/delete-transition-cleanup-batch2.sh` atau `.bat` setelah patch diekstrak;
- pastikan `src/pages/Utilities/ResetTestData.jsx` dan `src/services/Utilities/resetTestDataService.js` sudah terhapus;
- jalankan `npm run dev` dan hard refresh;
- test tombol Cek Data Produksi, Cek Stok Umum, Cek Schema Inventory Log, Preview Reset, dan dialog konfirmasi RESET;
- pastikan tidak ada import error ke `ResetTestData` atau `resetTestDataService`;
- pastikan tidak ada perubahan stok/kas/payroll/HPP hanya karena cleanup struktur.

## Checklist Batch 3 — Cleanup Data Legacy
- Buka `Reset & Maintenance Data`.
- Klik `Cek Data Legacy` dan pastikan tidak ada data domain yang berubah.
- Pastikan hasil audit membagi data menjadi OK, Aman Repair, Display Repair, Reset Scoped, dan Manual.
- Jika ada `productions` legacy, siapkan reset produksi scoped lalu cek preview sebelum mengetik `RESET`.
- Jika ada sales/returns/adjustments/purchases lama tanpa variant snapshot, gunakan reset transaksi varian scoped hanya untuk data testing.
- Pastikan completed/final data tidak berubah otomatis.
- Pastikan reset sales tidak menghapus income non-sales, dan reset purchases tidak menghapus expense manual.
- Pastikan maintenance log mencatat dry run legacy.
