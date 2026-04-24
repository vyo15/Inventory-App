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
- buat payroll dari work log completed
- cek nilai payroll
- ubah status unpaid → paid

### Analisis HPP
- pastikan work log completed terbaca
- cek total biaya produksi
- cek total good qty
- cek rata-rata HPP per unit

### Baseline UI Table / Action
- cek semua main table prioritas apakah kolom `Aksi` ada di paling kanan
- cek main table lebar apakah aksi utama tetap terlihat tanpa scroll horizontal dulu
- cek `ProductionOrders` apakah `Detail / Refresh Need / Mulai Produksi` tetap langsung terlihat
- cek `ProductionSteps` dan `ProductionProfiles` tetap konsisten sebagai simple config page tanpa tombol `Detail`
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
- cek `ResetTestData` apakah tabel preview tetap rapi walau page shell utility masih transisi
- cek dark mode dan light mode setelah normalisasi batch global
- cek tidak ada variasi action liar baru di luar baseline final

### Final Varian Produksi
- buat Production Order target `semi_finished_material` dengan varian tertentu
- pastikan list dan detail PO menampilkan varian target yang benar
- klik `Mulai Produksi` dari PO dan cek Work Log root membawa `targetVariantKey` / `targetVariantLabel` yang sama
- cek output line Work Log memakai `outputVariantKey` / `outputVariantLabel` yang sama, bukan `master`
- complete Work Log dan pastikan stok hasil masuk ke varian yang benar
- cek `inventory_logs` type `production_output_in` menyimpan `variantKey` dan `variantLabel` yang benar
- cek `inventory_logs` type `production_material_out` menyimpan varian material hasil resolve requirement
- buat Production Order target `product` dengan varian tertentu dan ulangi flow sampai complete
- test material strategy `inherit` dengan naming varian tidak persis sama tetapi masih unik, contoh target `Merah` dan material `Flanel Merah`
- test material strategy `inherit` yang tidak bisa match; proses harus error/warning jelas dan tidak fallback master
- test jalur Work Log `Apply Draft PO`; output harus tetap dikunci mengikuti target variant PO
- test jalur planned/manual dari BOM; pastikan tidak mengganggu flow final PO variant dan item bervarian tidak bisa complete tanpa varian output jelas
- cek payroll dan HPP tetap membaca Work Log completed tanpa perubahan contract payroll
- cek tidak ada perubahan tidak sengaja ke sales, purchases, laporan, dan reset utility

### Display Varian Produksi
- cek detail Production Order: target variant tampil benar.
- cek requirement Production Order: material inherit/fixed tampil sebagai variant, bukan `Master` / `Tanpa varian`, jika resolved variant ada.
- cek list Work Log: target variant tampil dari snapshot Work Log.
- cek detail Work Log: material usage tampil memakai `resolvedVariantLabel` atau fallback `resolvedVariantKey`.
- cek detail Work Log: output tampil memakai `outputVariantLabel` atau fallback `outputVariantKey`.
- cek modal Selesaikan Work Log: target, varian, step, PO, qty batch, estimasi output, Good Qty, Reject Qty, Rework Qty, dan selisih vs estimasi terlihat jelas.
- cek complete Work Log: inventory log tetap menampilkan varian yang sama dengan output.
- cek item non-varian: label `Master` masih boleh tampil dan tidak dianggap bug.

### Reset & Maintenance Data
- klik `Cek Data Produksi` dan pastikan dry run tidak mengubah data apa pun
- pastikan ringkasan audit menampilkan Data Dicek, Aman Repair, Display Repair, Reset/Manual, dan Plan Eksekusi
- jalankan `Repair Aman` dan pastikan hanya field turunan/snapshot/display yang berubah
- pastikan repair aman tidak mengurangi stok, menambah stok, mengubah kas, mengubah payroll, atau mengubah HPP
- test PO draft/ready tanpa Work Log: requirement line varian bisa disinkronkan aman
- test Work Log in_progress belum output applied: target/output snapshot bisa disinkronkan
- test Work Log completed: tidak ada posting stok ulang; hanya display/snapshot repair jika sumber varian jelas
- klik `Siapkan Reset Terarah Produksi` dan pastikan hanya modul Produksi yang terpilih sebelum user mengetik RESET
- pastikan dialog destructive tetap meminta teks `RESET`
- pastikan menu sidebar menampilkan `Reset & Maintenance Data`
