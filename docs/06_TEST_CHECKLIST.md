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
- upload screenshot Shopee, terapkan hasil OCR, dan pastikan Catatan tampil multiline rapi
- klik Terapkan Qty & Biaya OCR lebih dari sekali dan pastikan Catatan OCR tidak dobel
- isi Catatan manual sebelum menerapkan OCR dan pastikan catatan manual tetap tersimpan di atas ringkasan OCR
- pastikan tabel Purchases tidak menampilkan raw detail OCR panjang; tampilkan catatan manual singkat dan/atau tag `OCR Shopee` saja

## Checklist OCR Shopee Purchases — Regression Guard

- [ ] Buka Purchases lalu klik Tambah Pembelian.
- [ ] Upload screenshot Shopee valid dan pastikan preview qty/biaya muncul tanpa auto-save.
- [ ] Klik **Terapkan Qty & Biaya ke Form** dan pastikan field Qty Beli, Subtotal Barang, Ongkir, Diskon Ongkir/Voucher/Koin, Biaya Layanan, Total Aktual, dan Modal Aktual berubah sesuai preview.
- [ ] Setelah Apply, pastikan ada feedback lokal di area OCR/form: tombol berubah menjadi **Sudah Diterapkan ke Form** atau muncul alert sukses dengan ringkasan field yang diterapkan.
- [ ] Klik Apply lebih dari sekali dan pastikan Catatan tidak menambah segmen `OCR Shopee` dobel. Catatan manual sebelum OCR harus tetap ada.
- [ ] Tutup modal Tambah Pembelian, lalu pada tabel klik **Lihat** di samping tag `OCR Shopee`; popup detail harus terbuka tanpa error console `record is not defined`.
- [ ] Tutup popup detail OCR dan pastikan halaman Purchases bisa diklik/scroll normal lagi; overlay tidak boleh menutup tabel setelah ditutup.
- [ ] Print popup OCR dan pastikan isi struk terbaca tanpa scrollbar internal di hasil print.
- [ ] Setelah menutup popup OCR, coba print halaman non-OCR bila tersedia dan pastikan halaman lain tidak blank akibat CSS print OCR.
- [ ] Upload screenshot Shopee dengan `Koin Shopee Ditukarkan/Digunakan` dan pastikan nilainya masuk ke `Voucher / Koin / Potongan`, total OCR cocok, serta tidak muncul warning selisih sebesar nilai koin.
- [ ] Pastikan OCR tidak mengisi tanggal pembelian dari tanggal status pengiriman/diterima; tanggal transaksi tetap manual.
- [ ] Pastikan flow Simpan Pembelian tetap satu-satunya flow yang mengubah purchases, stok, inventory log, dan expense. OCR Apply tidak boleh membuat transaksi.

### Penjualan
- buka form Tambah Penjualan dan pastikan ada field Jenis Item per line
- pilih Jenis Item Produk Jadi dan pastikan dropdown item hanya menampilkan produk dari `products`
- pilih Jenis Item Bahan Baku dan pastikan dropdown item hanya menampilkan bahan dari `raw_materials`
- ganti Jenis Item setelah item dipilih, lalu pastikan `itemId`, `variantKey`, `quantity`, dan `pricePerUnit` reset aman
- pilih Produk Jadi dan pastikan harga otomatis memakai `price`
- pilih Bahan Baku dan pastikan harga otomatis memakai `sellingPrice`
- pilih item bervarian dan pastikan `variantKey` wajib sebelum submit
- buat penjualan status `Diproses`
- cek stok langsung berkurang
- pastikan income belum tercatat
- ubah status menjadi `Selesai`
- cek income tercatat sekali saja
- pilih channel Shopee/Tokopedia/TikTok Shop/Lazada/Instagram/Lainnya dan pastikan field reference aktif tetapi opsional
- pilih channel Offline dan pastikan reference disabled serta value dikosongkan
- pilih channel WhatsApp dan pastikan reference disabled serta value dikosongkan tanpa mengubah status/income timing menjadi Offline
- pastikan tidak ada tombol Batalkan/Delete/Hapus di tabel Sales
- jika barang kembali, buat transaksi lewat menu Return
- cek Return menambah stok dan mencatat inventory log `return_in`
- pastikan Return tidak membuat income/expense otomatis sebelum ada rule finance resmi

### Retur
- tambah retur produk
- tambah retur bahan baku
- cek stok bertambah
- cek inventory log `return_in`
- cek kolom Tanggal / Ref dan tooltip tidak menampilkan Firestore/Technical ID; data tanpa kode bisnis memakai fallback manusiawi.

## C. Kas & Biaya


## Checklist — Cash In / Cash Out Summary Layout

- [ ] Buka Cash In dan Cash Out di desktop, tablet, dan mobile.
- [ ] Pastikan total utama menjadi angka paling dominan dan tidak ada flow strip/bar bawah yang mengulang metric.
- [ ] Pastikan nominal Rupiah tampil penuh, tidak truncate/ellipsis, dan boleh wrap rapi jika layar sempit.
- [ ] Pastikan helper/catatan metric seperti `Jumlah cash-in tercatat`, `Sales selesai`, `Payroll paid`, dan `Efisiensi vs referensi` tampil di bawah nominal.
- [ ] Pastikan Cash In tetap membaca `revenues + incomes`, dan Cash Out tetap membaca `expenses` tanpa perubahan service/payload.
- [ ] Pastikan tambah Cash In manual dan Cash Out manual tetap menyimpan data seperti sebelum patch.

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
- pastikan pilihan Jenis Item menampilkan Bahan Baku, Semi Finished, dan Produk Jadi
- tambah adjustment masuk bahan baku non-varian
- tambah adjustment keluar produk non-varian
- tambah adjustment masuk Semi Finished non-varian
- tambah adjustment keluar Semi Finished non-varian
- pastikan adjustment keluar tidak boleh melebihi `availableStock`
- tambah adjustment masuk item bervarian
- tambah adjustment keluar item bervarian
- pastikan item bervarian wajib memilih varian, termasuk Semi Finished bervarian
- cek `stock_adjustments` menyimpan `collectionName` sesuai source item
- cek inventory log `stock_adjustment`
- cek sinkronisasi `stock`, `currentStock`, `reservedStock`, `availableStock`, dan total `variants[]`

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
- item bervarian dengan semua stok 0 dan hanya satu varian punya `averageCostPerUnit` > 0 harus menampilkan Modal/HPP Aktif dari varian cost tersebut, bukan rata-rata yang ikut membagi varian cost 0
- item bervarian dengan stok di beberapa varian harus menampilkan Modal/HPP Aktif weighted by stock varian

### BOM Produksi
- buat BOM target semi finished
- buat BOM target product
- pastikan BOM product menerima `semi_finished_material` untuk komponen utama dan `raw_material` untuk consumable assembly seperti lem tembak
- pastikan Estimasi Biaya Material BOM otomatis mengambil cost dari master item, bukan tetap Rp 0 jika master punya modal/referensi.
- pastikan Estimasi Biaya Produksi BOM otomatis mengikuti tarif Tahapan Produksi.
- pastikan Overhead Manual BOM tersimpan sebagai estimasi dan ikut Total Estimasi, tanpa mengubah rule HPP final Work Log/payroll.
- cek material lines dan step lines tersimpan benar

### Production Planning
- buat Planning baru tanpa PO
- pastikan badge/link menunjukkan `Belum ada PO`
- pastikan tombol Cancel tampil untuk Planning tanpa PO yang statusnya belum final
- klik Cancel, batalkan modal, lalu pastikan status tidak berubah
- klik Cancel lagi dan confirm, lalu pastikan status berubah menjadi `cancelled`
- filter `Cancelled`, pastikan Planning yang dicancel muncul
- pastikan Planning `cancelled` tidak menampilkan tombol Buat PO dan tidak menampilkan Cancel lagi
- buat Planning baru lalu buat PO dari Planning tersebut
- pastikan Planning yang sudah punya PO / linked Production Order tidak menampilkan Cancel
- pastikan tidak ada label disabled `Cancel — sudah ada PO`
- pastikan Cancel Planning tidak menghapus/mengubah PO existing
- pastikan Cancel Planning tidak mengubah Work Log, inventory/stok, Payroll, HPP, report, sales, purchases, returns, atau cash in/out
- pastikan progress Planning tetap berasal dari Work Log `completed`, bukan dari PO created/start
- pastikan Dashboard/filter membaca status canonical `cancelled`

### Production Order
- generate PO dari BOM
- cek requirement line
- cek status `shortage` / `ready`
- cek target varian bila ada

### Work Log Produksi
- buka menu Work Log Produksi saat semua referensi produksi normal
- buka menu Work Log Produksi saat salah satu referensi produksi gagal dimuat lalu pastikan halaman tetap tampil dengan warning
- cek list work log tetap tampil urut terbaru walau query utama fallback
- pastikan halaman Work Log Produksi tidak menampilkan tombol tambah manual
- pastikan summary card Work Log hanya menampilkan Total, In Progress, dan Completed
- pastikan tidak ada tombol cancel aktif di Work Log dan status final tidak berubah tanpa flow service yang guarded
- buat work log dari PO eligible lewat tombol **Mulai Produksi** di menu Production Order
- pastikan PO `ready` / `shortage` bisa dipakai start produksi
- pastikan PO yang sudah punya work log tidak muncul lagi di referensi Work Log
- isi material usage
- isi outputs
- cek worker dan biaya aktual
- cek status aktif `in_progress` dan `completed`; `draft` tidak menjadi opsi input/filter utama
- cek konsumsi stok material
- cek penambahan stok output
- selesaikan work log dari popup complete
- pastikan work log completed tidak bisa diedit ulang sembarangan
- pastikan row Work Log `completed` hanya menampilkan tombol Detail, tanpa tombol Edit disabled
- cek payroll tetap bisa membaca work log completed
- cek HPP tetap bisa membaca work log completed

### Payroll Produksi
- buat payroll dari work log completed
- cek nilai payroll
- ubah status unpaid → paid
- pastikan row Payroll `paid` hanya menampilkan tombol Detail, tanpa tombol Edit disabled atau Paid
- pastikan tag status `Paid` tidak tampil dobel di tabel Payroll Produksi dan Laporan Payroll; data `status`/`paymentStatus` tetap terpisah di source.

### Analisis HPP
- pastikan work log completed terbaca
- cek total biaya produksi
- cek total good qty
- cek rata-rata HPP per unit

## F. Laporan
- Stock Report tampil benar dan tetap memuat bahan baku, semi-finished, dan produk jadi
- Purchases Report default bulan berjalan, filter periode mengubah query, dan membaca pengeluaran pembelian sesuai periode
- Sales Report default bulan berjalan, filter periode mengubah query, serta menampilkan total dan status transaksi sesuai periode
- Profit Loss default bulan berjalan, filter periode mengubah query, dan menggabungkan revenues + incomes + expenses sesuai periode
- Payroll Report default periode aktif, filter custom mengubah query payroll sesuai `payrollDate`, lalu filter operator/step/status tetap bekerja pada data periode tersebut
- Export XLSX laporan mencantumkan periode/filter aktif dan hanya mengekspor data yang sedang tampil
- ekspor Excel/CSV berjalan

## Checklist Scalability Read Path — Dashboard / Report / Kode Bisnis

- [ ] Buka Dashboard dan pastikan tidak ada write ke stok, sales, finance, payroll, HPP, atau planning hanya karena refresh.
- [ ] Cek Dashboard sales/finance/payroll menampilkan monitoring bulan berjalan dan Work Log completed minggu berjalan.
- [ ] Buka Sales Report, Purchases Report, dan Profit Loss; pastikan default periode bulan berjalan dan data di luar periode tidak ikut terbaca/tampil.
- [ ] Ubah range tanggal report ke bulan/periode lain dan pastikan summary, tabel, dan export mengikuti periode tersebut.
- [ ] Buka Payroll Report, pilih custom range, lalu pastikan data payroll yang dimuat sesuai `payrollDate`; filter operator/step/status tetap berjalan setelah data periode dimuat.
- [ ] Buat data master/transaksi baru yang memakai kode bisnis dan pastikan sequence berikutnya tetap benar tanpa duplicate kode.
- [ ] Batch 16B: buat Sales baru dan pastikan kode tetap `ORD-DDMMYYYY-001`, dokumen sales memakai ID readable, stok berkurang, dan inventory log `sale` tetap terbentuk.
- [ ] Batch 16B: buat Purchase baru dan pastikan kode tetap `PUR-DDMMYYYY-001`, stock in, expense otomatis, inventory log `purchase_in`, dan average cost tetap benar.
- [ ] Batch 16B: buat Return baru dan pastikan kode tetap `RET-DDMMYYYY-001`, return doc + stok masuk + inventory log `return_in` tetap satu transaction.
- [ ] Batch 16B: simulasikan create cepat dua tab untuk Sales/Purchase/Return; tidak boleh overwrite document ID dan sequence harus maju lewat `business_code_counters`.
- [ ] Batch 16B: pastikan counter tidak naik kalau transaction gagal karena stok tidak cukup, item tidak ditemukan, atau validasi varian gagal.

- [ ] Jika Firestore meminta index untuk query tertentu, buat index sesuai pesan Firebase; jangan ganti ke full scan permanen sebagai solusi utama.

## G. Utility Reset
- preview reset sesuai modul terpilih
- simpan baseline stok
- reset transaksi saja
- reset + zero stock
- reset + restore baseline
- cek field stok sinkron kembali setelah reset


## H. UI Detail / Drawer / Form Regression Checklist

### Standar umum
- buka semua halaman utama setelah patch UI;
- buka detail drawer/modal pada halaman yang punya detail;
- buka form tambah/edit pada halaman yang punya form;
- pastikan action utama tetap terlihat dan tetap memanggil handler lama;
- pastikan warning penting tidak hilang;
- pastikan validation/error message tetap ada;
- pastikan disabled reason penting tetap ada;
- pastikan confirmation copy untuk action destructive tetap jelas;
- pastikan angka bisnis tidak berubah;
- pastikan responsive aman di desktop dan mobile;
- pastikan dark/light mode rapi;
- pastikan tidak ada console error;
- pastikan tidak ada data berubah hanya karena membuka halaman, detail, drawer, modal, atau panel.

### Detail drawer
- pastikan title/nama/kode utama terlihat;
- pastikan status badge/tag terlihat;
- pastikan metric utama seperti total, stok, final amount, output qty, atau HPP tetap terbaca;
- pastikan data anak seperti item transaksi, material requirement, step, payroll line, varian, atau supplier item tetap terbaca;
- pastikan catatan manual tetap tersedia jika ada;
- pastikan info audit/opsional tidak mengganggu ringkasan utama.

### Form drawer/modal
- pastikan label field tetap jelas;
- pastikan helper text tidak menghapus konteks sensitif seperti stok, varian, cost, payroll, HPP, reset, dan Auth UID;
- pastikan submit, cancel, close, preview, reset, adjust, delete, dan confirm tetap memakai flow lama;
- pastikan payload create/edit/update/reset tidak berubah.

### Area sensitif
- Production Planning: Planning tanpa PO tetap bisa cancel, Planning dengan PO tetap tidak bisa cancel langsung, dan Planning tidak mengubah stok;
- Production Order: readiness, material requirement, dan shortage warning tetap jelas;
- Work Log: warning biaya material 0, biaya tenaga kerja 0, total biaya 0, dan HPP belum valid tetap terlihat saat relevan;
- Payroll: final amount, status payroll, payment status, include HPP, dan relasi Cash Out tetap jelas;
- HPP Analysis: HPP invalid/cost kosong tetap terlihat;
- Stock: stok total, stok tersedia, stok dipesan, minimum stock, varian, dan warning critical tetap terlihat;
- Sales/Purchases/Returns: item, qty, harga, subtotal, total, status, dan dampak stok/kas tetap jelas;
- Cash In/Cash Out: sumber manual/otomatis dan referensi transaksi tetap jelas;
- Reset Maintenance: preview wajib, scope reset, jumlah dokumen terdampak, protected data, confirmation keyword, dan destructive warning tetap jelas;
- User Management: email, role, status, Auth UID/profile binding, dan security warning tetap jelas.

### Validasi visual
- cek light mode;
- cek dark mode;
- cek drawer lebar desktop;
- cek mobile/responsive width;
- pastikan table/list di drawer tidak overflow buruk;
- pastikan UI tidak penuh paragraf panjang yang tidak perlu;
- pastikan tidak ada istilah internal seperti legacy, guard, bucket, source, read-only, metadata tampilan, atau AKTIF sebagai copy utama.

## Tambahan Checklist Batch Prioritas

### Inventory UX
- kolom Referensi Audit di Manajemen Stok menampilkan label manusiawi seperti Penyesuaian Stok, Pembelian, Penjualan, Retur, Produksi / Work Log, atau Production Order
- ID teknis inventory log hanya tampil sebagai detail kecil/tooltip, bukan teks utama yang membingungkan user
- popup Stock Adjustment item berbasis pcs/bulat tidak memaksa tampilan `.00`
- angka pecahan di Penyesuaian Stok tampil format Indonesia maksimal 2 desimal tanpa trailing nol berlebih
- riwayat adjustment terbaru tampil paling atas setelah submit berdasarkan `createdAt`, dengan fallback ke `date` untuk data lama

### Production Order
- preview kebutuhan material tampil sebelum submit PO
- info shortage utama muncul saat bahan kurang

### Work Log Costing
- complete Work Log menghitung ulang `materialCostActual`
- complete Work Log menghitung ulang `totalCostActual` dan `costPerGoodUnit`
- detail labor Work Log membaca ringkasan payroll final bila tersedia

### Payroll / Cash Out
- detail Payroll Produksi lebih mudah dipahami user
- `paid` payroll membuat expense otomatis dengan guard `sourceModule/sourceId` agar tidak double

### Export
- Stock Report ekspor ke XLSX
- file hasil memiliki header, filter, dan lebar kolom yang lebih rapi

## Checklist Tambahan Cleanup Stok & Customer — 2026-04-25

### Stock Adjustment Final
- tambah adjustment masuk bahan baku non-varian
- tambah adjustment keluar bahan baku non-varian dan pastikan stok tidak boleh melebihi `availableStock`
- tambah adjustment masuk Semi Finished non-varian
- tambah adjustment keluar Semi Finished non-varian dan pastikan stok tidak boleh melebihi `availableStock`
- tambah adjustment masuk produk non-varian
- tambah adjustment keluar produk non-varian dan pastikan stok tidak boleh melebihi `availableStock`
- tambah adjustment item bervarian dan pastikan varian wajib dipilih
- tambah adjustment Semi Finished bervarian dan pastikan `variantKey` / `variantLabel` masuk ke `stock_adjustments` dan `inventory_logs`
- cek `stock`, `currentStock`, `reservedStock`, `availableStock`, dan total `variants[]` tetap sinkron
- cek record `stock_adjustments` menyimpan `collectionName`, `variantKey`, `variantLabel`, `currentStockBefore`, `currentStockAfter`, `availableStockBefore`, dan `availableStockAfter`
- cek record `stock_adjustments` tetap menyimpan `reason` dan `note` terpisah, tetapi tabel riwayat hanya menampilkan satu kolom `Alasan & Catatan`
- jika `note` kosong atau sama dengan `reason`, pastikan tabel riwayat Penyesuaian Stok tidak menampilkan info dobel
- cek `inventory_logs` menyimpan `adjustmentId`, `referenceId`, `referenceType`, `details`, dan snapshot stok sebelum/sesudah

### Customer Collection Final
- tambah customer dari Master Customer
- refresh halaman Master Customer dan pastikan customer tetap muncul
- edit customer
- hapus customer
- buka Sales dan pastikan customer dari Master Customer muncul di dropdown
- pastikan tidak ada flow aktif yang masih membaca `Customers` uppercase

### Inventory Log Audit
- buat pembelian dan cek log menampilkan `purchaseId`
- buat penjualan dan cek log menampilkan `saleId`
- buat retur dan cek log menampilkan `returnId`
- buat stock adjustment dan cek log menampilkan `adjustmentId`
- cek log lama tetap tampil walau belum punya `details`

## Checklist Tambahan Kode Karyawan Produksi Otomatis — 2026-04-25

### Karyawan Produksi
- buka halaman Karyawan Produksi
- klik Tambah Karyawan Produksi
- pastikan field Kode Karyawan otomatis terisi
- pastikan format kode `DDMMYYYY-001`
- pastikan field kode disabled/read-only dan tidak bisa diedit manual
- simpan karyawan pertama
- tambah karyawan kedua di tanggal yang sama dan pastikan kode menjadi `DDMMYYYY-002`
- tambah karyawan ketiga di tanggal yang sama dan pastikan kode menjadi `DDMMYYYY-003`
- pastikan data tersimpan ke Firestore field `code`
- pastikan tabel Karyawan Produksi menampilkan kode baru
- edit karyawan lama dan pastikan kode tidak berubah otomatis
- pastikan kode lama format `EMP-...` tetap aman saat edit data existing
- pastikan Work Log tetap bisa memilih/membaca karyawan
- pastikan Payroll tetap bisa membaca karyawan dari Work Log completed
- pastikan tidak ada error console
- jalankan `npm run build`


## Checklist Bug Karyawan Produksi Tidak Tampil — 2026-04-25

### Load halaman Karyawan Produksi
- buka route `/produksi/karyawan-produksi`
- pastikan data lama di collection `production_employees` muncul di tabel
- pastikan summary Total Karyawan tidak 0 jika Firestore memiliki data employee
- pastikan employee lama dengan kode seperti `11042026-01` tetap tampil
- pastikan kolom `name`, `employmentType`, `role`, `assignedStepNames`, dan `isActive` terbaca benar
- tambah karyawan baru, lalu pastikan setelah save langsung muncul di tabel
- refresh halaman dan pastikan data tetap muncul

### Guard query pendukung
- test ketika query tahapan produksi gagal karena index, data employee tetap tampil
- test ketika query work log gagal karena index, data employee tetap tampil
- test ketika query payroll gagal karena index, data employee tetap tampil
- pastikan warning data pendukung muncul tanpa mengosongkan tabel employee
- pastikan filter status aktif/nonaktif tetap jalan
- pastikan filter jenis kerja tetap jalan
- pastikan filter role tetap jalan
- pastikan filter assignment tetap jalan jika data tahapan berhasil dimuat

### Integrasi produksi
- pastikan Work Log Produksi tetap bisa membaca karyawan aktif
- pastikan Payroll Produksi tetap bisa membaca karyawan dari Work Log completed
- pastikan tidak ada perubahan ke payroll calculation, HPP, lifecycle PO, atau completed guard Work Log
- pastikan tidak ada error fatal di console
- jalankan `npm run build`

## Checklist UI Regression Produksi — 2026-04-25

### Production Orders
- buka `/produksi/production-orders`
- pastikan tabel utama tidak memaksa scroll horizontal hanya untuk melihat tombol aksi pada desktop/laptop normal
- pastikan tombol Detail langsung terlihat
- pastikan tombol Refresh Need tetap terlihat dan berjalan pada order shortage/ready
- pastikan tombol Mulai Produksi tetap terlihat dan berjalan pada order ready
- pastikan target/BOM panjang tetap wrap atau compact dan tidak mendorong aksi keluar layar
- pastikan drawer detail tetap terbuka normal
- pastikan status ready/shortage/in production/completed tidak berubah karena patch UI

### Work Log Produksi
- buka `/produksi/work-log-produksi`
- pastikan tabel utama tidak memaksa scroll horizontal hanya untuk melihat tombol aksi pada desktop/laptop normal
- pastikan tombol Detail langsung terlihat
- pastikan tombol Edit langsung terlihat untuk work log yang masih editable
- pastikan tombol Selesaikan langsung terlihat untuk work log yang belum completed/cancelled
- klik Selesaikan dan pastikan modal menampilkan target produksi
- pastikan modal menampilkan step produksi
- pastikan modal menampilkan qty batch
- pastikan modal menampilkan estimasi hasil/output dan satuan output
- pastikan Good Qty, Reject Qty, Rework Qty, Operator Produksi, dan Catatan Penyelesaian tetap bisa diisi
- pastikan flow Selesaikan tetap memakai handler lama dan output stock/payroll/HPP tidak berubah

### General UI Regression Guard
- pastikan tidak ada error console
- pastikan build berhasil

## Checklist Regression Auto Payroll Work Log Completed — 2026-04-25

- buka `/produksi/work-log-produksi`
- pilih Work Log status aktif/proses
- klik `Selesaikan`
- pastikan modal menampilkan estimasi hasil/output
- isi Good Qty lebih dari 0
- pilih minimal satu Operator Produksi
- klik `Selesaikan`
- pastikan Work Log berubah status menjadi `completed`
- buka `/produksi/payroll-produksi`
- pastikan payroll line baru muncul
- pastikan Total Payroll bertambah
- pastikan Draft/Belum Dibayar bertambah sesuai status awal `draft` dan `unpaid`
- pastikan nominal payroll mengikuti rule Tahapan Produksi
- buka Detail Karyawan Produksi
- pastikan Ringkasan Payroll tidak lagi 0 bila payroll line dibuat
- pastikan Histori Payroll Singkat menampilkan line payroll
- klik Selesaikan ulang/refresh flow dan pastikan payroll tidak dobel
- test Good Qty 0 sesuai rule: line boleh audit 0 atau service menolak complete jika total good output 0
- pastikan operator kosong tidak boleh submit modal complete
- pastikan Payroll Produksi filter status tetap jalan
- pastikan tidak ada error console
- jalankan `npm run build`

## Checklist Task 2 - Work Log Actual Cost / HPP Safety
- buat PO `ready`, lalu start menjadi Work Log dari PO
- pastikan material usage yang berasal dari PO menyimpan `costPerUnitSnapshot` dan `totalCostSnapshot` dari master cost aktif saat material punya cost aktual
- complete Work Log dengan `goodQty > 0`
- pastikan `materialCostActual` tidak tetap 0 jika raw material punya `averageActualUnitCost`/`restockReferencePrice`, atau semi finished punya `averageCostPerUnit`/`lastProductionCostPerUnit`
- pastikan input Semi Finished pada Work Log step berikutnya memakai master HPP Semi Finished, bukan menghitung ulang dari raw material awal
- pastikan `laborCostActual` tersinkron setelah payroll line otomatis dibuat
- pastikan `totalCostActual = materialCostActual + laborCostActual`
- pastikan `costPerGoodUnit = totalCostActual / goodQty` dan tidak membagi 0 saat `goodQty` tidak valid
- pastikan output stok hanya bertambah satu kali saat Work Log completed
- pastikan payroll line tidak dobel saat tombol Selesaikan ditekan ulang / halaman refresh
- pastikan HPP Analysis membaca material cost dan labor cost dari Work Log completed tanpa mengubah data lama massal
- pastikan Work Log completed/final tidak di-backfill otomatis tanpa task reconcile terpisah


## Checklist Reset Semua Testing
- [ ] Di Reset & Maintenance, klik `Reset Semua Testing` dan pastikan modal meminta keyword `RESET SEMUA`.
- [ ] Pastikan preview menunjukkan delete transaksi/log stok/planning/pricing, operasi stok, operasi HPP, dan total operasi di bawah batas batch aman.
- [ ] Setelah konfirmasi, pastikan transaksi/log stok yang tidak dilindungi bersih, stok master/variant menjadi 0, dan field modal/HPP allowlist menjadi 0.
- [ ] Pastikan protected master tidak terhapus: Supplier, Customer, Product, Raw Material, Semi Finished, BOM, Production Step, Employee.
- [ ] Pastikan maintenance log mencatat action `reset_all_testing_data`, status success/failed, affected collections, stock result, dan HPP result.

## Checklist Reset Modal/HPP Master
- [ ] Di Reset & Maintenance, pilih `Reset Semua Modal & HPP`, klik preview, dan pastikan affected collection hanya Raw Material, Product, dan Semi Finished.
- [ ] Pastikan tombol `Reset Semua Modal/HPP` tetap meminta keyword `RESET MODAL HPP` sebelum write.
- [ ] Pastikan reset tidak menghapus transaksi, stok, PO, Work Log, Payroll, Sales, Purchases, Returns, atau Cash.
- [ ] Pastikan Semi Finished ikut preview/reset untuk `averageCostPerUnit` dan `lastProductionCostPerUnit`; field legacy cost hanya dibersihkan sebagai compatibility cleanup.

## Checklist Task 2 All-in-One - HPP Cost 0 Final Verification
- [ ] Buat raw material bervarian dengan stok varian valid dan `averageActualUnitCost` master > 0, lalu Start Production dari PO dan pastikan `materialUsages[].costPerUnitSnapshot` memakai cost master aktif bila cost varian kosong.
- [ ] Complete Work Log dari PO dan pastikan `materialCostActual`, `totalCostActual`, dan `costPerGoodUnit` tersimpan > 0 saat material cost dan `goodQty` valid.
- [ ] Pastikan Complete Work Log tidak error Firestore `reads after writes`: semua material/output stock document terbaca sebelum write transaksi.
- [ ] Pastikan output stok tetap bertambah satu kali, dan HPP/average cost output hanya update jika `goodQty > 0` dan `totalCostActual > 0`.
- [ ] Pastikan jika total cost 0, output stock boleh mengikuti flow existing tetapi HPP/average cost master tidak ditulis 0 sebagai HPP valid.
- [ ] Generate payroll otomatis dari Work Log completed dan pastikan operator kosong, rate step 0, basis invalid, atau output basis 0 menghasilkan error yang jelas.
- [ ] Pastikan `includePayrollInHpp=false` tidak masuk ke `payrollFinalAmount`, `laborCostActual`, `totalCostActual`, dan HPP Analysis.
- [ ] Buka Detail Work Log dan HPP Analysis: angka material cost mengikuti data Work Log final yang disimpan, tanpa backfill massal otomatis.
- [ ] Buka Reset Maintenance > HPP Trial: Preview Semua Modal/HPP wajib tampil sebelum reset, keyword konfirmasi wajib benar, dan reset hanya menyentuh field cost/HPP allowlist.
- [ ] Simpan baseline modal/HPP, jalankan reset, lalu restore baseline dan pastikan stok, transaksi, PO, Work Log, Payroll, Sales, Purchases, Returns, dan Cash tidak berubah.
- [ ] Jalankan smoke regression: PO ready → Start Production → Complete Work Log → Payroll generated → HPP Analysis → Reset preview/baseline/restore.

## Checklist Task 3 — Clarify Payroll dan Detail Karyawan Produksi

### Payroll Produksi — Detail Line Payroll
- buka menu Payroll Produksi
- buka detail salah satu line payroll
- pastikan label `No. Line Payroll` menjelaskan bahwa nomor ini unik per line/operator
- pastikan field Work Log menjelaskan sumber pekerjaan produksi asal payroll
- pastikan field Step/Tahapan menjelaskan bahwa rule/tarif payroll berasal dari tahapan produksi
- pastikan field Operator/Karyawan menjelaskan penerima payroll
- pastikan status `draft`, `confirmed`, dan `paid` memiliki help text yang mudah dipahami
- pastikan UI detail Payroll menampilkan status secara compact: jika `status` dan `paymentStatus` sama-sama `paid`, hanya tampil satu tag `Paid`
- pastikan `paymentStatus` tetap tersimpan dan dijelaskan lewat help text; saat `paid`, sistem membuat Cash Out otomatis dengan guard sourceModule/sourceId
- pastikan `Payroll Rate`, `Qty Dasar / Output Qty Used`, `Amount Calculated`, dan `Final Amount` punya penjelasan fungsi
- pastikan `Calculation Notes` dan `Notes` jelas bedanya antara catatan sistem dan catatan manual
- pastikan tidak ada perubahan nominal, status, atau payment status hanya karena membuka detail

### Karyawan Produksi — Detail Master Operator
- buka menu Karyawan Produksi
- buka detail salah satu karyawan
- pastikan informasi dasar karyawan mudah dibaca
- pastikan status aktif/nonaktif menjelaskan bahwa data lama tidak dihapus
- pastikan jenis kerja, role, skill tags, dan assignment tahapan memiliki konteks pemakaian
- pastikan ringkasan Work Log dan Payroll bersifat read-only
- pastikan histori payroll singkat membaca payroll final
- pastikan histori work log singkat membaca Work Log final
- pastikan section Payroll Preference tidak menjadi source utama payroll baru
- pastikan user paham payroll final mengikuti rule Tahapan Produksi dan Work Log completed, bukan custom payroll employee
- pastikan tidak ada perubahan perhitungan payroll, Work Log, Cash Out, atau HPP
- pastikan build berhasil dan tidak ada error console

## Checklist Integrasi IMS Produksi → Payroll → Kas → HPP → Laporan
- [ ] Buat PO ready lalu start Work Log.
- [ ] Complete Work Log dengan `goodQty > 0` dan operator valid.
- [ ] Pastikan output stok bertambah satu kali saja.
- [ ] Pastikan Work Log status completed.
- [ ] Pastikan `materialCostActual` terisi jika material punya cost source.
- [ ] Pastikan `laborCostActual` langsung terisi dari accrued labor rule Tahapan Produksi saat Work Log completed, sebelum payroll paid.
- [ ] Pastikan output Semi Finished/Product langsung mendapat HPP `material + accrued labor + overhead` dan BOM bertingkat membaca HPP tersebut.
- [ ] Pastikan payroll line otomatis dibuat per operator.
- [ ] Pastikan payroll draft tidak mengubah `laborCostActual` menjadi 0.
- [ ] Pastikan `totalCostActual = materialCostActual + laborCostActual + overheadCostActual`.
- [ ] Pastikan `costPerGoodUnit` benar jika `goodQty > 0`.
- [ ] Klik Paid di Payroll Produksi dan pastikan hanya reconcile selisih final, bukan baru pertama kali memasukkan labor.
- [ ] Pastikan payroll berubah `status=paid` dan `paymentStatus=paid`.
- [ ] Pastikan expense otomatis muncul di Kas & Biaya > Pengeluaran.
- [ ] Pastikan expense payroll punya `sourceModule=production_payroll`, `sourceId`, dan `sourceRef`.
- [ ] Klik Paid ulang/reload, pastikan expense tidak dobel.
- [ ] Pastikan Profit Loss membaca expense payroll sebagai pengeluaran.
- [ ] Pastikan Payroll Report menampilkan referensi Cash Out tanpa menghitung expense sebagai source payroll.
- [ ] Pastikan HPP Analysis membaca Work Log completed dengan material/accrued labor/total cost, lalu berubah hanya jika payroll final berbeda.
- [ ] Pastikan pembelian tetap membuat expense, penjualan selesai tetap membuat income, dan stock adjustment tetap membuat inventory log.
- [ ] Pastikan build berhasil dan tidak ada error console.

## Checklist Task 5 - Standardisasi Export Laporan

### Export XLSX Final
- export Sales Report dan pastikan file `.xlsx` memiliki sheet `Sales Report`
- export Purchases Report dan pastikan file `.xlsx` memiliki sheet `Purchases Report`
- export Stock Report dan pastikan file `.xlsx` memiliki sheet `Stock Report`
- export Profit Loss Report dan pastikan file `.xlsx` memiliki sheet `Profit Loss`
- export Payroll Report detail dan pastikan file `.xlsx` memiliki sheet `Payroll Report`
- export Payroll Report rekap operator dan pastikan file `.xlsx` memiliki sheet `Payroll Recap`
- pastikan setiap file memiliki title laporan dan subtitle/periode/filter aktif
- pastikan header kolom manusiawi, bukan key teknis mentah
- pastikan nominal tampil format Rupiah Indonesia
- pastikan tanggal tampil format Indonesia
- pastikan angka jumlah/qty tidak memaksa trailing `.00` jika bulat
- pastikan kolom auto width dan file bisa langsung dibaca tanpa olah ulang manual
- pastikan export CSV Payroll Detail dipahami sebagai legacy/compatibility, bukan export final utama
- pastikan build berhasil dan tidak ada error console


## Checklist Final Task 6 — Docs & Regression Lock
- [ ] Stock Management reference jelas sebagai audit source dan tampil manusiawi.
- [ ] Stock Adjustment format angka bersih tanpa trailing `.00` untuk angka bulat.
- [ ] Adjustment terbaru tampil di atas setelah submit.
- [ ] PO preview compact menampilkan stok target, varian target, qty batch, estimasi output, kebutuhan material, stok material, dan status cukup/kurang.
- [ ] PO preview tetap read-only dan tidak mengubah stok/status/PO/BOM.
- [ ] Work Log actual cost benar: material, labor, total, dan cost per good unit tersimpan pada completed Work Log.
- [ ] HPP Analysis membaca completed Work Log cost final.
- [ ] Detail Payroll punya penjelasan field, status, payment status, rate, qty dasar, amount calculated, final amount, notes, dan calculation notes.
- [ ] Detail Karyawan Produksi menjelaskan data dasar, status, jenis kerja, role, skill, assignment, work log, payroll summary, dan legacy payroll preference.
- [ ] Payroll paid business rule jelas: paid membuat Cash Out/Expense otomatis hanya dengan guard idempotent.
- [ ] Cash Out payroll rule jelas: expense payroll punya `sourceModule=production_payroll`, `sourceId`, dan `sourceRef`.
- [ ] Profit Loss membaca payroll paid dari `expenses` dan tidak menghitung payroll langsung dari `production_payrolls`.
- [ ] Export laporan rapi dalam XLSX dengan title, periode/filter, header manusiawi, Rupiah, tanggal Indonesia, sheet name jelas, dan auto width.
- [ ] UI regression guard tertulis: tabel utama tidak boleh butuh scroll horizontal hanya untuk tombol aksi; modal complete Work Log wajib menampilkan estimasi output.
- [ ] Build/test manual final selesai tanpa error console.

## Checklist Dashboard Operational Control Center — 2026-04-26
- [ ] Buka `/dashboard` dan pastikan halaman tampil tanpa white screen atau error console.
- [ ] Pastikan Dashboard tetap read-only: tidak ada tombol yang membuat PO, Work Log, Payroll, Cash Out, Income, Expense, atau mutasi stok langsung dari Dashboard.
- [ ] Pastikan `Terakhir diperbarui` tampil dan tombol `Muat Ulang` hanya reload data summary read-only.
- [ ] Pastikan tidak ada table besar atau horizontal scroll di Dashboard pada laptop/desktop normal.
- [ ] Ringkasan Hari Ini tampil sebagai KPI compact: Sales bulan ini, Kas Masuk, Kas Keluar, Net Kas, Stok Kritis, Produksi Dicek, Payroll Pending, dan Data Perlu Dicek.
- [ ] Aksi Cepat tampil sebagai shortcut navigasi saja dan tidak mengubah data.
- [ ] Prioritas Hari Ini tetap tampil sebagai action card/chip: Stok Menipis, PO Shortage, PO Siap, Work Log Berjalan, Planning Overdue, dan Payroll Pending.
- [ ] Planning completed/cancelled tidak tampil sebagai urgent.
- [ ] Planning overdue dan deadline terdekat tampil sebagai prioritas.
- [ ] Status Produksi menampilkan PO Shortage, PO Ready, Work Log Berjalan, Work Log Completed Minggu Ini, dan Payroll Pending.
- [ ] Fokus Produksi menampilkan Target Minggu Ini, Target Bulan Ini, sisa target, progress, dan maksimal 3 Planning Perlu Dikejar.
- [ ] Data Perlu Dicek menampilkan exception penting saja: stok minus/reserved tidak wajar, stok kritis, PO shortage, planning risk, cost/HPP kosong, atau payroll pending.
- [ ] Stok Kritis tampil sebagai compact list maksimal 5 item stok paling kritis, bukan table besar.
- [ ] Keuangan Ringkas tetap membaca incomes/revenues/expenses dan memberi catatan bahwa Profit Loss tetap source final.
- [ ] Aktivitas Terbaru tampil sebagai activity feed compact dari inventory log, bukan table besar.
- [ ] Status Integrasi IMS menampilkan Work Log completed, Payroll generated, Payroll pending, Payroll paid, Expense Payroll, dan HPP Cost Issue.
- [ ] Jika ada Work Log completed dengan biaya aktual 0, warning HPP/cost material tampil.
- [ ] Catatan payroll paid/expense tampil agar user tidak menghitung payroll dobel.
- [ ] Jika salah satu collection gagal dibaca, Dashboard tetap tampil dengan fallback aman.
- [ ] Build berhasil dan tidak ada error console.

## Checklist Dashboard Business Control Center Compact — 2026-05
- [ ] Buka `/dashboard`; pastikan tidak ada white screen, horizontal scroll, atau error runtime baru.
- [ ] Klik `Muat Ulang`; pastikan hanya reload data, tidak ada dokumen baru di sales, purchases, production_orders, work_logs, payrolls, incomes, expenses, inventory_logs, atau production_plans.
- [ ] Klik semua Aksi Cepat; pastikan hanya pindah route dan tidak ada submit otomatis.
- [ ] Cocokkan KPI Sales Bulan Ini dengan collection/report Sales sebagai monitoring omzet, bukan kas resmi.
- [ ] Cocokkan Kas Masuk/Keluar dengan Cash In/Cash Out/Profit Loss; jangan double count sales sebagai income jika status belum selesai.
- [ ] Buat data stok minus atau reserved melebihi stok di data uji, lalu pastikan muncul sebagai Data Perlu Dicek tanpa auto-fix stok.
- [ ] Buat PO shortage/planning overdue/payroll pending/cost 0 di data uji, lalu pastikan alert muncul dan link menuju menu terkait.
- [ ] Login sebagai user operasional; Dashboard boleh tampil, tetapi route sensitif tetap ditolak oleh route guard jika user klik quick action yang tidak berhak.
- [ ] Jika salah satu collection gagal dibaca karena permission/index, Dashboard tetap tampil dengan warning parsial.


## Checklist Final Hardening Fase A-G - 2026-04-26

### Fase A - Sales Stock Safety
- [ ] Buka form Sales dan pastikan Jenis Item memfilter dropdown: Produk Jadi hanya `products`, Bahan Baku hanya `raw_materials`.
- [ ] Ganti Jenis Item setelah item dipilih dan pastikan item, varian, quantity, dan harga reset agar tidak stale.
- [ ] Pilih channel Offline/WhatsApp dan pastikan `referenceNumber` disabled serta dikosongkan.
- [ ] Pilih channel marketplace/online dan pastikan `referenceNumber` aktif tetapi tetap opsional.
- [ ] Pastikan WhatsApp tidak otomatis diperlakukan seperti Offline untuk status/income timing.
- [ ] Buat sale stok cukup dan pastikan sale tersimpan.
- [ ] Pastikan stok master/varian berkurang setelah sale dibuat.
- [ ] Buat sale stok tidak cukup dan pastikan sale tidak tersimpan.
- [ ] Buat sale item bervarian stok cukup dan pastikan varian yang benar berkurang.
- [ ] Buat sale item bervarian stok tidak cukup dan pastikan sale tidak tersimpan.
- [ ] Input item yang sama di dua baris dengan total melebihi `availableStock`, lalu pastikan sale tidak tersimpan.
- [ ] Status `Selesai` membuat income sekali saja.
- [ ] Status selain `Selesai` tidak membuat income.
- [ ] Pastikan tabel Sales tidak menyediakan tombol Batalkan/Delete/Hapus.
- [ ] Buat Return untuk barang kembali dan pastikan stok bertambah melalui inventory log `return_in`.

### Fase B - Purchase Expense Metadata
- [ ] Buat purchase baru.
- [ ] Pastikan stok bertambah.
- [ ] Pastikan inventory log `purchase_in` tetap muncul.
- [ ] Pastikan expense otomatis dibuat.
- [ ] Pastikan amount expense sama dengan total pembelian aktual.
- [ ] Pastikan saving pembelian tetap hanya info efisiensi.
- [ ] Pastikan expense punya `sourceModule: purchases`.
- [ ] Pastikan expense punya `sourceId` berisi purchase id.
- [ ] Pastikan expense punya `sourceRef` reference pembelian.
- [ ] Pastikan expense punya `sourceType: auto_generated`.
- [ ] Pastikan expense punya `createdByAutomation: true`.
- [ ] Pastikan Profit Loss tetap membaca expense.

### Fase C - HPP dan Work Log Cost 0 Warning
- [ ] Buka HPP Analysis.
- [ ] Pastikan Work Log completed dengan `materialCostActual = 0` menampilkan warning material.
- [ ] Pastikan Work Log completed dengan `laborCostActual = 0` menampilkan warning payroll/tenaga kerja.
- [ ] Pastikan Work Log completed dengan `totalCostActual = 0` menampilkan warning HPP belum valid.
- [ ] Pastikan `costPerGoodUnit = 0` dan `goodQty > 0` menampilkan warning.
- [ ] Pastikan Work Log cost valid tidak menampilkan warning berlebihan.
- [ ] Buka detail Work Log dan pastikan warning cost 0 tampil jika ada.
- [ ] Pastikan rumus HPP tidak berubah.

### Fase D - Dashboard Cleanup
- [ ] Buka Dashboard.
- [ ] Pastikan Dashboard tetap compact sebagai control center dan tidak berubah menjadi laporan/table besar.
- [ ] Pastikan tidak ada horizontal scroll.
- [ ] Pastikan Ringkasan Hari Ini, Aksi Cepat, Data Perlu Dicek, dan Prioritas Hari Ini jelas serta actionable hanya sebagai navigasi/read-only.
- [ ] Pastikan Fokus Produksi ringkas dan planning prioritas maksimal 3 item.
- [ ] Pastikan Stok Kritis compact dan maksimal 5 item.
- [ ] Pastikan Keuangan Ringkas tidak terlihat sebagai Profit Loss final.
- [ ] Pastikan Aktivitas Terbaru compact dan maksimal 5 item.
- [ ] Pastikan last updated tampil.
- [ ] Klik Muat Ulang/Refresh dan pastikan hanya reload data summary.
- [ ] Pastikan Dashboard tidak membuat/mengubah data apa pun.

### Fase E - Report dan Export Standard
- [ ] Export Stock Report.
- [ ] Pastikan Stock Report mencakup bahan baku, semi-finished, dan produk jadi jika datanya ada.
- [ ] Buka XLSX Stock Report dan pastikan header jelas.
- [ ] Pastikan angka stok rapi dan tidak menampilkan `.00` berlebihan.
- [ ] Export HPP Analysis ke XLSX.
- [ ] Pastikan XLSX HPP punya header jelas, Rupiah rapi, tanggal rapi, dan sheet name jelas.
- [ ] Pastikan kolom Validasi Cost ikut masuk ke export HPP.
- [ ] Export Payroll Report XLSX dan pastikan filter operator tidak error.
- [ ] Pastikan tidak ada object mentah/JSON teknis yang membingungkan user.

### Fase F - Legacy Duplicate Cleanup
- [ ] Jalankan grep/import check dan pastikan tidak ada reference ke `src/src`.
- [ ] Pastikan route Dashboard memakai `src/pages/Dashboard/Dashboard.jsx`.
- [ ] Pastikan service Planning aktif memakai `src/services/Produksi/productionPlanningService.js`.
- [ ] Pastikan folder/file duplicate `src/src/**` tidak ada atau sudah tercatat sebagai legacy yang tidak dipakai.
- [ ] Jika ada penghapusan, pastikan `DELETE_LIST.md` jelas.

### Final Regression Check
- [ ] `npm run build` berhasil.
- [ ] Tidak ada error console di Dashboard, Sales, Purchases, HPP Analysis, Work Logs, Stock Report, dan Payroll Report.
- [ ] Business rules docs sinkron dengan source terbaru.
- [ ] Tech debt terbaru tercatat.
- [ ] Prompt rules mencegah regression untuk Sales, Purchase Expense, HPP, Dashboard, Export, dan Legacy Cleanup.
- [ ] Integration Map sesuai flow aktual.

## Supplier Restock Catalog Manual

### Supplier
- [ ] Buka menu Supplier.
- [ ] Pastikan alert/info tidak menyebut sinkronisasi otomatis ke bahan baku.
- [ ] Pastikan tombol “Sinkronkan Bahan” tidak ada.
- [ ] Tambah supplier baru.
- [ ] Pilih beberapa material di katalog supplier.
- [ ] Isi `productLink`, `referencePrice`, dan `note` per material.
- [ ] Simpan supplier dan pastikan data supplier tersimpan.
- [ ] Pastikan `materialDetails` tetap tersimpan di detail supplier.
- [ ] Pastikan Raw Material yang belum memilih supplier tersebut tidak berubah setelah supplier disimpan.
- [ ] Edit nama/link supplier dan pastikan hanya Raw Material dengan `supplierId` yang sama ikut memperbarui snapshot nama/link.
- [ ] Edit `materialDetails` supplier dan pastikan tidak memasang supplier baru ke Raw Material.
- [ ] Hapus supplier dan pastikan hanya Raw Material dengan `supplierId` yang sama dikosongkan data suppliernya.

### Raw Material
- [ ] Buka Raw Materials.
- [ ] Tambah/edit raw material.
- [ ] Pilih supplier secara manual dari form Raw Material.
- [ ] Simpan dan pastikan supplier tampil di table/detail Raw Material.
- [ ] Pastikan label detail memakai “Link Toko Supplier”.
- [ ] Pastikan data lama dengan `supplierId`, `supplierName`, dan `supplierLink` tetap terbaca.
- [ ] Pastikan bahan tanpa supplier tetap aman dan tidak error.

### Purchases
- [ ] Buka Purchases.
- [ ] Pilih raw material.
- [ ] Pastikan dropdown supplier tetap bisa digunakan sebagai referensi vendor.
- [ ] Pastikan harga aktual pembelian tetap dari transaksi.
- [ ] Pastikan stok masuk tetap berjalan dari flow Purchases.
- [ ] Pastikan expense pembelian tetap dibuat dari flow Purchases.
- [ ] Pastikan saving tetap hanya info efisiensi.
- [ ] Pastikan kolom Info/Catatan di tabel Purchases tetap ringkas dan tidak menampilkan detail OCR Shopee mentah.

### Build / Regression
- [ ] Pastikan tidak ada flow yang memasang supplier ke Raw Material berdasarkan `materialDetails`.
- [ ] Pastikan tidak ada reference `handleSyncSupplierMaterials`.
- [ ] Pastikan tidak ada state `syncingRowId` di halaman Supplier.
- [ ] Pastikan tidak ada tombol “Sinkronkan Bahan” di UI Supplier.
- [ ] Pastikan build berhasil dan tidak ada error console.
- [ ] Pastikan Dashboard, Reports, Sales, Production, HPP, dan Cash Out tidak berubah.

## Checklist Restock Assistant

### Raw Material Detail
- [ ] Buka Detail Raw Material dan pastikan tidak ada section Restock besar/list semua supplier.
- [ ] Pastikan row Supplier menampilkan supplier terakhir dibeli jika ada purchase.
- [ ] Jika belum ada purchase, pastikan Supplier fallback ke supplier manual/snapshot.
- [ ] Pastikan row Link Produk menampilkan tombol dari purchase terakhir jika `productLink` ada.
- [ ] Jika link produk tidak ada, pastikan empty state aman dan tidak white screen.
- [ ] Pastikan tombol Lihat Supplier Lain membuka `#/suppliers?materialId=...`.

### Dashboard Restock Assistant
- [ ] Buka Dashboard dan cek Stok Kritis tetap compact.
- [ ] Pastikan bahan baku stok kritis menampilkan supplier terakhir/harga terakhir jika ada purchase.
- [ ] Klik Buka Link Produk dan pastikan link eksternal terbuka tanpa mengubah data.
- [ ] Klik Buat Pembelian dan pastikan masuk ke Purchases dengan material/supplier/link produk terisi awal jika tersedia.
- [ ] Klik Bandingkan Supplier dan pastikan masuk ke Supplier dengan filter material.
- [ ] Pastikan Dashboard tidak membuat purchase, expense, atau mutasi stok otomatis.

### Purchases Prefill
- [ ] Dari Dashboard klik Buat Pembelian.
- [ ] Pastikan modal Purchases terbuka dan tidak auto-submit.
- [ ] Pastikan user tetap wajib mengisi qty/harga aktual sebelum Simpan.
- [ ] Simpan purchase dan pastikan stok/expense/saving tetap mengikuti flow Purchases existing.

## Checklist Regression Stok Varian Final

- Edit Raw Material bervarian lalu simpan; audit Reset/Maintenance harus OK tanpa klik Repair.
- Purchase Raw Material varian; audit harus tetap OK dan master `stock/currentStock` sama dengan total varian.
- Stock Adjustment masuk/keluar untuk varian; audit harus tetap OK dan inventory log tetap normal.
- Edit Product bervarian; audit harus tetap OK.
- Sales produk varian harus mengurangi stok varian yang benar. Jika barang kembali, uji lewat Return dan pastikan stok masuk/audit tetap OK.
- Return item varian; audit harus OK dan stok tidak double.
- Edit Semi Finished bervarian; master `stock/currentStock` harus sama dengan total varian.
- Start/Complete Work Log yang memakai varian; audit harus OK dan tidak double posting.
- Reset/Maintenance tidak boleh diperlukan untuk menjaga data baru tetap sinkron.

## Checklist Reset & Maintenance Aman

### Supplier Protection
- [ ] Buat Supplier real dan Supplier test manual.
- [ ] Buka Reset & Maintenance.
- [ ] Pastikan preview reset menampilkan `supplierPurchases` sebagai Dilindungi.
- [ ] Jalankan reset transaksi.
- [ ] Pastikan Supplier tidak terhapus.
- [ ] Pastikan Raw Material supplier manual tetap tampil.
- [ ] Pastikan dropdown Supplier di Purchases tetap jalan.

### Hapus Data Test Saja
- [ ] Buat dokumen test dengan marker `isTestData=true`, `sourceModule=dev_test_seed`, dan `createdBy=dev_seed`.
- [ ] Refresh preview Data Test Aman.
- [ ] Pastikan hanya data bermarker yang masuk preview.
- [ ] Jalankan Hapus Data Test Saja.
- [ ] Pastikan data normal tanpa marker tidak terhapus.
- [ ] Pastikan Supplier protected tidak ikut target default.

### Regression Reset
- [ ] Reset/Maintenance tidak white screen.
- [ ] Preview reset tetap menampilkan jumlah data yang akan dihapus.
- [ ] Modal konfirmasi RESET tetap wajib diketik sebelum reset destructive.
- [ ] Maintenance repair stok tidak membuat inventory log baru.

## Purchases Supplier Restock Prefill

- [ ] Buka menu Supplier dan pastikan supplier punya `materialDetails` untuk bahan terkait.
- [ ] Isi Link Produk dan Harga Supplier Tercatat pada material supplier.
- [ ] Simpan Supplier dan pastikan tidak otomatis memasang supplier ke Raw Material baru.
- [ ] Buka Purchases, pilih Jenis Item = Bahan Baku, lalu pilih bahan.
- [ ] Pastikan dropdown Supplier hanya menampilkan supplier yang menyediakan bahan tersebut.
- [ ] Pilih supplier dan pastikan Link Produk Restock otomatis terisi dari Supplier.
- [ ] Ganti supplier lain dan pastikan Link Produk ikut berubah sesuai supplier tersebut.
- [ ] Pastikan Harga Supplier Tercatat / Satuan Stok otomatis terisi dan read-only.
- [ ] Pastikan Total Pembanding Supplier dihitung dari komponen supplier: Qty Beli × Harga Barang Supplier + Ongkir Default + Biaya Layanan Default - Diskon Default.
- [ ] Pastikan Selisih Hemat berubah dari Total Pembanding Supplier - Total Aktual Pembelian.
- [ ] Pastikan Modal Aktual per Satuan Stok tetap dihitung dari Total Aktual / Stok Masuk total.
- [ ] Isi Qty Beli dan pastikan Stok Masuk total = Qty Beli × Konversi Supplier.
- [ ] Simpan purchase dan pastikan stok, inventory log, expense, dan saving tetap mengikuti flow Purchases existing.
- [ ] Pastikan tidak ada tombol/logic “Sinkronkan Bahan” yang kembali.

## Supplier Katalog Restock Lengkap

- [ ] Buka menu Supplier dan pastikan field Kategori/Keterangan Supplier tidak lagi tampil sebagai field utama.
- [ ] Tambah supplier baru dan isi Katalog Restock Supplier.
- [ ] Pilih bahan, isi Link Produk, Tipe Pembelian, Satuan Beli, Qty per Pembelian, Konversi, Harga Barang, Ongkir, Admin, Diskon, dan Catatan.
- [ ] Pastikan Total Estimasi Supplier, Total Stok dari Konversi, dan Harga Estimasi Supplier / Satuan Stok terhitung otomatis.
- [ ] Simpan Supplier dan buka detail supplier.
- [ ] Pastikan katalog tampil jelas: bahan, link produk, tipe pembelian, satuan/konversi, estimasi harga, dan catatan.
- [ ] Buka supplier lama yang belum punya field baru dan pastikan tidak error.
- [ ] Di Purchases, pilih bahan dan supplier tersebut lalu pastikan Link Produk, Satuan Beli, Konversi, dan Harga Supplier Tercatat terisi awal dari katalog.
- [ ] Pastikan harga aktual, stok, expense, dan saving tetap mengikuti transaksi Purchases saat Simpan.
- [ ] Pastikan Supplier tidak mengubah Raw Material otomatis dan tombol/logic Sinkronkan Bahan tidak kembali.

## Checklist Purchases Stok Masuk Total

- [ ] Supplier catalog punya `conversionValue = 50` dan satuan stok `pcs`.
- [ ] Buka Purchases, pilih bahan, lalu pilih supplier tersebut.
- [ ] Qty Beli = 1 menampilkan Stok Masuk 50 pcs sebagai field utama.
- [ ] Qty Beli = 5 menampilkan Stok Masuk 250 pcs sebagai field utama.
- [ ] Konversi Supplier tidak bisa diedit di Purchases.
- [ ] Perubahan Qty Beli tidak menghapus Supplier, Link Produk Restock, purchaseType, biaya supplier, atau Harga Supplier Tercatat.
- [ ] Subtotal Barang mengikuti Qty × Harga Barang Supplier selama belum diedit manual.
- [ ] Total Pembanding Supplier untuk Qty > 1 tidak menggandakan ongkir/admin secara salah; ongkir/admin/diskon default dihitung sebagai komponen katalog, bukan dikali per satuan stok.
- [ ] Subtotal manual tidak dioverwrite saat Qty berubah lagi.
- [ ] Supplier tanpa konversi valid menampilkan warning dan tidak bisa disimpan dengan Stok Masuk 0.
- [ ] Purchase tersimpan menambah stok sesuai Stok Masuk total dan expense tetap mengikuti Total Aktual.

## Checklist Purchases Preview Stok Aktual dan Breakdown Ringkasan

- [ ] Buka Purchases lalu klik tambah pembelian.
- [ ] Pilih bahan baku non-varian dan pastikan preview stok aktual menampilkan `currentStock`, `reservedStock`, dan `availableStock` dari stok master.
- [ ] Ubah supplier, Qty Beli, subtotal, ongkir, admin/service fee, potongan ongkir, dan voucher/koin; pastikan preview stok tetap read-only dan tidak error.
- [ ] Pilih bahan baku bervarian tanpa memilih varian; pastikan UI menampilkan pesan untuk memilih varian terlebih dahulu.
- [ ] Pilih varian bahan baku dan pastikan stok yang tampil adalah stok varian terpilih, bukan total master.
- [ ] Pilih produk non-varian dan pastikan preview stok aktual menampilkan stok master.
- [ ] Pilih produk bervarian tanpa memilih varian; pastikan UI menampilkan pesan untuk memilih varian terlebih dahulu.
- [ ] Pilih varian produk dan pastikan stok berubah real-time mengikuti `productVariantKey`.
- [ ] Pastikan Ringkasan Perbandingan Supplier menampilkan Subtotal Barang / Harga Awal, Ongkir, Admin / Service Fee, Potongan Ongkir, Voucher / Koin / Potongan, Total Aktual Pembelian, Total Pembanding Supplier, Modal Aktual / Satuan Stok, dan Selisih Hemat.
- [ ] Pastikan Total Aktual Pembelian tetap sama dengan formula existing `subtotalItems + shippingCost + serviceFee - shippingDiscount - voucherDiscount`.
- [ ] Pastikan Total Pembanding Supplier tetap mengikuti logic supplier catalog existing dan tidak mengubah harga aktual pembelian.
- [ ] Simpan purchase kecil dan pastikan stok bertambah, inventory log tercatat, expense otomatis tercatat, dan `purchaseSaving` tetap informasi efisiensi.


## Checklist Stock Management Inventory Log Final
- [ ] Buka menu Stock Management / Manajemen Stok.
- [ ] Pastikan tabel Riwayat Pergerakan Stok urut terbaru ke terlama.
- [ ] Pastikan kolom generik `Stok` yang kosong/`-` tidak tampil membingungkan.
- [ ] Jika snapshot stok belum reliable untuk semua log, jangan isi kolom dengan stok saat ini karena itu bukan snapshot audit historis.
- [ ] Pastikan tabel tetap menampilkan Tanggal, Arah, Sumber, Item, Qty, Referensi Audit, dan Catatan.
- [ ] Untuk log produksi, pastikan Referensi Audit menampilkan Production Order, Work Log, dan Tahapan.
- [ ] Untuk log produksi, pastikan Catatan tidak mengulang PO/Work Log/Tahapan; Catatan cukup menampilkan operator atau catatan manual produksi.
- [ ] Pastikan Catatan tampil ringkas 1-2 baris dan detail panjang tetap bisa dibaca lewat tooltip/hover.
- [ ] Pastikan membuka halaman Stock Management tidak mengubah stok.
- [ ] Pastikan submit Penyesuaian Stok tetap melalui panel resmi dan inventory log tetap terbentuk normal.

## Checklist Retur & Inventory Log Guarded — 2026-04-26

- [ ] Buat retur produk non-varian dan pastikan stok master bertambah sesuai jumlah retur.
- [ ] Buat retur bahan baku non-varian dan pastikan stok master bertambah sesuai jumlah retur.
- [ ] Buat retur produk bervarian dan pastikan varian wajib dipilih.
- [ ] Buat retur bahan baku bervarian dan pastikan varian wajib dipilih.
- [ ] Pastikan `stock`, `currentStock`, `reservedStock`, `availableStock`, dan total `variants[]` tetap sinkron setelah retur varian.
- [ ] Pastikan dokumen `returns` terbentuk sekali untuk satu submit.
- [ ] Pastikan `inventory_logs` terbentuk sekali dengan `type = return_in`, `returnId`, `referenceId`, dan `referenceType = return`.
- [ ] Pastikan tidak ada stok berubah jika validasi item, tanggal, jumlah, atau varian gagal.
- [ ] Pastikan tidak ada double stock dan tidak ada double inventory log saat submit normal.
- [ ] Pastikan data retur tampil benar di tabel Retur.
- [ ] Pastikan log retur tampil di Stock Management / Manajemen Stok sebagai sumber Retur.
- [ ] Pastikan tidak ada error console setelah submit retur.
- [ ] Jalankan `npm run build` setelah `npm install` bersih di environment lokal.

## Checklist Stock Management & Adjustment Guarded — 2026-04-26

- [ ] Buka Stock Management / Manajemen Stok.
- [ ] Pastikan riwayat inventory log terbaru tampil di atas.
- [ ] Pastikan tidak ada kolom generik `Stok` yang kosong/membingungkan.
- [ ] Pastikan tabel menampilkan Tanggal, Arah, Sumber, Item, Qty, Referensi Audit, dan Catatan.
- [ ] Pastikan Qty tidak tampil dengan trailing `.00` untuk angka bulat.
- [ ] Pastikan Sumber terbaca sebagai Pembelian, Penjualan, Retur, Produksi, atau Penyesuaian Stok.
- [ ] Pastikan Referensi Audit menampilkan label bisnis dan ID teknis sebagai detail kecil/tooltip.
- [ ] Pastikan Catatan ringkas 1-2 baris dan detail panjang tetap bisa dilihat lewat tooltip.
- [ ] Pastikan riwayat Penyesuaian Stok memakai satu kolom `Alasan & Catatan`; `reason`/`note` tetap tersimpan terpisah dan tidak tampil dobel jika isinya sama/kosong.
- [ ] Pastikan membuka halaman Stock Management tidak mengubah stok.
- [ ] Buat adjustment masuk item non-varian dan pastikan stok bertambah.
- [ ] Buat adjustment keluar item non-varian dan pastikan stok berkurang sesuai `availableStock`.
- [ ] Buat adjustment masuk/keluar item varian dan pastikan varian wajib dipilih.
- [ ] Pastikan `stock`, `currentStock`, `reservedStock`, `availableStock`, dan total `variants[]` tetap sinkron setelah adjustment varian.
- [ ] Pastikan dokumen `stock_adjustments` terbentuk sekali untuk satu submit.
- [ ] Pastikan `inventory_logs` terbentuk sekali dengan `referenceType = stock_adjustment` dan `referenceId` sama dengan `adjustmentId`.
- [ ] Pastikan tidak ada double stock dan tidak ada double log saat submit normal.
- [ ] Pastikan tidak ada error console.
- [ ] Jalankan `npm run build` setelah `npm install` bersih di environment lokal.

## Checklist Final Auth/User Management dan Firestore Rules — 2026-05-01

Status: **AKTIF + GUARDED**. Checklist ini menggantikan checklist Auth/Role lama setelah domain aktif menjadi `@ziyocraft.com` dan role aktif final hanya `administrator` / `user`.

### Checklist setup Auth final

- [ ] Firebase Authentication memiliki user aktif `admin@ziyocraft.com`.
- [ ] Firebase Authentication memiliki user aktif `user@ziyocraft.com`.
- [ ] Firestore `system_users/{uid-admin}` memiliki `usernameLower = admin`, `role = administrator`, dan `status = active`.
- [ ] Firestore `system_users/{uid-user}` memiliki `usernameLower = user`, `role = user`, dan `status = active`.
- [ ] Tidak ada dokumen aktif dengan `role = super_admin`.
- [ ] Tidak ada profile lama/orphan seperti `admin_legacy` atau `user_legacy`.

### Checklist login dan profile gate

- [ ] Stop dev server lalu jalankan ulang `npm run dev`.
- [ ] Login `admin` memakai mapping internal `admin@ziyocraft.com`.
- [ ] `admin` berhasil masuk sebagai Administrator.
- [ ] Login `user` memakai mapping internal `user@ziyocraft.com`.
- [ ] `user` berhasil masuk sebagai User.
- [ ] User tanpa profile Firestore ditolak masuk.
- [ ] User inactive ditolak masuk.
- [ ] Role tidak dikenal ditolak/default deny.

### Checklist Role-Based Menu dan Direct Route Access

- [ ] Login sebagai `admin`; pastikan semua menu aktif terlihat: Dashboard, Master Data, Stock Control, Produksi, Transaksi, Kas & Biaya, Sistem, Laporan, Pricing Rules, dan Reset & Maintenance.
- [ ] Login sebagai `user`; pastikan hanya menu operasional harian yang terlihat: Dashboard, Stock Control, Production Operation, dan Transaksi.
- [ ] User tidak melihat Master Data, Pricing Rules, Production Setup, Cost & Analysis, Kas & Biaya, Sistem, Reset & Maintenance, dan Laporan.
- [ ] User mencoba membuka `/system/user-management` lewat URL langsung dan harus diarahkan ke unauthorized/akses ditolak sesuai ProtectedRoute.
- [ ] User mencoba membuka route sensitif lain seperti `/pricing-rules`, `/cash-in`, `/profit-loss`, atau `/utilities/reset-maintenance-data` dan akses harus ditolak.
- [ ] Administrator tetap bisa membuka semua route aktif.

### Checklist Manajemen User

- [ ] Manajemen User hanya bisa diakses administrator.
- [ ] User biasa tidak bisa membuka Manajemen User, termasuk lewat URL langsung.
- [ ] Form tambah/edit profile hanya menyediakan role `administrator` dan `user`.
- [ ] Tidak ada opsi role `super_admin`.
- [ ] Tambah profile baru role `administrator` berhasil untuk UID valid dan username unik.
- [ ] Tambah profile baru role `user` berhasil untuk UID valid dan username unik.
- [ ] Duplicate username tetap ditolak.
- [ ] Edit profile tetap berjalan untuk target aman.
- [ ] Aktif/nonaktif profile tetap berjalan untuk target aman.
- [ ] Hapus Profile target aman berhasil menghapus dokumen Firestore `system_users/{uid}`.
- [ ] Hapus Profile untuk profile sendiri disabled/ditolak.
- [ ] Hapus administrator aktif terakhir ditolak.
- [ ] Firebase Authentication user tidak berubah saat Hapus Profile.

### Checklist Firestore Rules final/staged-final

=====================================================
SECTION: Firestore Rules validation without repo rules file — AKTIF / GUARDED
Fungsi:
- Memastikan backend rules tetap divalidasi walaupun repo ZIP saat ini tidak membawa file `firestore.rules`.

Dipakai oleh:
- Checklist release Auth/User Management, runtime smoke test, dan deployment manual Firebase.

Alasan perubahan:
- Owner mengonfirmasi rules aktif dikelola langsung di Firebase Console/external, bukan melalui patch source repo ini.

Catatan cleanup:
- Tambahkan source-controlled rules pada task terpisah jika owner ingin rules masuk repo.

Risiko:
- Melewatkan validasi rules backend dapat membuat UI guard tampak aman padahal data masih terbuka/terblokir di Firestore.
=====================================================

- [ ] Pastikan Firestore Rules aktif sudah dipublish di Firebase Console atau source external yang dipakai owner.
- [ ] Jangan mencari file `firestore.rules` di repo ZIP ini sebagai syarat patch saat rules masih dikelola manual/external.
- [ ] Rules memakai `rules_version = '2';`.
- [ ] Semua akses penting berbasis `request.auth != null`.
- [ ] Actor profile dibaca dari `system_users/{request.auth.uid}`.
- [ ] Role Rules aktif hanya `administrator` dan `user`.
- [ ] `system_users` guarded: user baca profile sendiri, administrator manage profile user lain.
- [ ] User biasa tidak bisa create/update/delete profile user lain.
- [ ] Fallback collection tidak dikenal deny.
- [ ] Tidak ada rules cleanup sementara `allow read, write: if true`.
- [ ] Tidak ada rules expiry sementara `request.time < ...` sebagai rules final.

### Checklist regression modul utama setelah Rules publish

- [ ] Dashboard bisa dibuka tanpa permission error.
- [ ] Supplier/master data bisa dibuka sesuai role aktif.
- [ ] Purchases bisa dibuka dan flow aktif utama tidak permission denied.
- [ ] Sales bisa dibuka dan flow aktif utama tidak permission denied.
- [ ] Produksi bisa dibuka dan flow aktif utama tidak permission denied.
- [ ] Cashflow/Reports bisa dibuka sesuai akses role aktif.
- [ ] Tidak ada error permission yang memutus flow utama di console.
- [ ] Tidak ada perubahan angka, stok, kas, laporan, HPP, atau produksi akibat patch docs/rules.

### Checklist packaging patch

- [ ] ZIP hanya berisi file docs/rules yang berubah.
- [ ] ZIP tidak berisi full project.
- [ ] ZIP tidak berisi `node_modules`, `dist`, `build`, `.git`, `.env`, credential, service account, atau secret.

## Checklist Regression — Batch Fix Bug Merge 2026-05-03

### General
- Jalankan `npm run build` di project lengkap.
- Buka halaman yang berubah dan pastikan tidak ada runtime error.
- Pastikan angka tidak menampilkan trailing `.00` pada qty, stok, Rupiah, summary, dan report yang masuk scope patch.

### No-decimal number format
- Test Purchases: qty, conversion, stock preview, dan ringkasan tetap angka bulat; rumus `quantity × conversionValue` tetap benar.
- Test Stock Adjustment: input qty integer, stock berubah lewat flow resmi, dan inventory log tetap dibuat.
- Test Sales/Returns: input qty integer, stok/income/return flow tidak berubah.
- Test Finance Cash In/Cash Out: nominal input/display tetap tanpa desimal.
- Test report Sales/Stock: quantity/stok tampil tanpa decimal.

### Production Order strict variant requirement
- Buat PO target bervarian dan pilih varian: preview target dan kebutuhan material membaca stok varian yang dipilih.
- Buat PO target non-varian: preview memakai stok master/non-variant.
- Material bervarian dengan strategy fixed/inherit harus menampilkan Variant atau error jelas, bukan Master diam-diam.
- Klik Refresh Need pada PO lama lalu pastikan material requirement tersimpan dengan resolved variant yang benar.
- Start Production dari PO bervarian harus memotong bucket varian yang sama dengan preview PO.

### Work Log worker stock audit
- Complete Work Log dengan satu operator: output stock bertambah satu kali, inventory log `production_output_in` dibuat, dan Stock Management menampilkan operator.
- Complete Work Log dengan beberapa operator: operator tampil ringkas dan payroll tidak dobel.
- Complete Work Log output bervarian: varian dan operator sama-sama tampil di Stock Management.
- Cek log legacy tanpa worker metadata: halaman tidak error dan fallback tetap aman.

### Semi Finished generic variant rename
- Edit nama/label varian Semi Finished dengan stok > 0: `variantKey` tetap, label berubah, stok tidak berubah.
- Edit nama/label varian dengan `reservedStock` > 0: reserved dan available tetap benar.
- Coba nama varian duplikat: validasi harus menolak.
- Buat PO baru setelah rename: dropdown varian menampilkan label baru tanpa mengubah reference lama.

### Variant conversion & Pricing optional
- [ ] Tambah Product baru tanpa Pricing Rule; default mode Manual dan simpan berhasil tanpa `pricingRuleId`.
- [ ] Tambah Raw Material baru tanpa Pricing Rule; default mode Manual dan simpan berhasil tanpa `pricingRuleId`.
- [ ] Pilih mode Rule pada Product/Raw Material; simpan wajib menolak jika Pricing Rule kosong.
- [ ] Edit Product/Raw/Semi non-varian lama dengan stok 0, reserved 0, available 0; aktifkan varian dan simpan, semua varian baru mulai stok 0.
- [ ] Edit Product/Raw/Semi non-varian lama dengan stok atau reserved > 0; mode varian tetap terkunci/validasi service menolak konversi.
- [ ] Tambah varian baru pada item existing bervarian; varian baru tersimpan dengan stok 0 tanpa mengubah stok varian lama.
- [ ] Rename nama/label varian existing dengan stok > 0; `variantKey`, stok, reserved, dan available tetap sama.
- [ ] Hapus varian dengan stok/reserved/available > 0; simpan ditolak.
- [ ] Hapus varian yang stok/reserved/available 0; simpan berhasil dan total master tetap sinkron.
- [ ] Search/list/detail menampilkan label varian fleksibel seperti Warna, Ukuran, Tipe, Motif, atau Spesifikasi.

### Sidebar nested accordion
- Buka root menu lain lalu Produksi; root sebelumnya harus tertutup.
- Di Produksi, buka Production Operation lalu Production Setup; sibling harus tertutup.
- Refresh di route nested seperti `/produksi/production-orders`; parent aktif tetap terbuka dan highlight benar.
- Login sebagai role user/administrator; menu tetap role-aware.

### Login UI copy cleanup
- Buka Login normal: teks `Login internal IMS` dan keterangan teknis Firebase/Auth/Firestore tidak tampil.
- Login gagal tetap menampilkan Alert error.
- Login valid tetap masuk sesuai role/status.
- User inactive/invalid role tetap diblokir oleh flow existing.


### UI Read-only Panel / Alert Semantics
- [ ] Stock Management > Tambah Penyesuaian menampilkan snapshot stok terpilih sebagai panel read-only clean, bukan bubble `Alert` besar.
- [ ] Snapshot Stock Adjustment menampilkan nama item, nama varian bila ada, Current Stock, Reserved Stock, Available Stock, dan satuan stok dengan format Indonesia tanpa `.00`.
- [ ] Item bervarian tetap menampilkan helper bahwa penyesuaian wajib masuk ke varian agar total master sinkron.
- [ ] Submit adjustment masuk/keluar tetap membuat `stock_adjustments`, mutasi stok, dan `inventory_logs` seperti sebelum perubahan UI.
- [ ] Sales form menampilkan snapshot stok master/varian sebagai panel read-only clean dan create sale tetap mengurangi stok sesuai flow aktif.
- [ ] Sales income timing tetap hanya mengikuti status `Selesai`; perubahan panel tidak boleh membuat income lebih awal.
- [ ] Returns form menampilkan snapshot stok master/varian sebagai panel read-only clean dan retur tetap memakai transaction resmi tanpa double posting stok.
- [ ] Raw Material ringkasan varian dan Semi Finished ringkasan stok master tampil sebagai panel read-only clean tanpa membuka edit stok langsung dari master.
- [ ] Warning/error/destructive/security/reset/auth alert tetap memakai `Alert` agar semantik guard tidak hilang.
- [ ] Purchases “Stok Aktual Sebelum Restock” tetap rapi dan tidak berubah logic.

## Checklist — Cash In delete lock dan Sales status tab — 2026-05-03

### Cash In / Pemasukan
- [ ] Buka halaman Pemasukan dan pastikan tidak ada tombol Hapus.
- [ ] Pastikan tidak ada kolom Aksi jika tidak ada aksi lain yang tampil.
- [ ] Pastikan data Auto Penjualan dari `incomes` tetap tampil.
- [ ] Pastikan data Manual / Lama dari `revenues` tetap tampil.
- [ ] Pastikan tambah pemasukan manual masih tersimpan ke `revenues`.
- [ ] Pastikan filter tahun/bulan tetap berjalan.
- [ ] Pastikan nominal tetap format Rupiah Indonesia tanpa trailing `.00`.
- [ ] Pastikan user tidak bisa menghapus pemasukan dari UI Pemasukan.

### Sales status tabs
- [ ] Buka halaman Penjualan dan klik tab Semua Penjualan; semua status boleh tampil.
- [ ] Klik tab Diproses dan pastikan hanya status `Diproses` yang tampil.
- [ ] Klik tab Dikirim dan pastikan hanya status `Dikirim` yang tampil.
- [ ] Klik tab Selesai dan pastikan hanya status `Selesai` yang tampil.
- [ ] Pastikan status `Selesai` tidak muncul di tab `Dikirim`.
- [ ] Pastikan status `Dikirim` tidak muncul di tab `Selesai`.
- [ ] Cari resi/order/reference di tab Dikirim dan pastikan hasil search tetap terbatas pada status `Dikirim`.
- [ ] Cari resi/order/reference di tab Selesai dan pastikan hasil search tetap terbatas pada status `Selesai`.
- [ ] Simulasikan fetch gagal atau reload lambat; tabel tidak boleh menampilkan data status lama sebagai data tab aktif.

### Regression bisnis
- [ ] Sales tetap mengurangi stok saat dibuat.
- [ ] Sales tetap membuat income hanya saat status `Selesai`.
- [ ] Sales tetap tidak menyediakan aksi batal/delete; barang kembali tetap lewat Return.
- [ ] Cash In tetap membaca pemasukan dari `revenues + incomes`.
- [ ] Profit Loss tetap membaca `revenues + incomes + expenses`.
- [ ] Dashboard/Reports tidak berubah.


## Checklist — Sales pending income, status tab, dan no-delete action — 2026-05-03

### Sales pending income card
- Buka halaman Sales dan pastikan ada card `Pemasukan Pending`.
- Buat sales status `Diproses`; nilai total masuk ke Pemasukan Pending.
- Ubah status ke `Dikirim`; nilai tetap masuk Pemasukan Pending.
- Ubah status ke `Selesai`; nilai keluar dari Pemasukan Pending dan income resmi tetap dibuat sesuai flow aktif.
- Ubah sales menjadi `Selesai`; nilai keluar dari Pemasukan Pending.
- Pastikan Pemasukan Pending tidak muncul di menu Pemasukan / Cash In.
- Pastikan Pemasukan Pending tidak menulis dokumen ke `revenues` atau `incomes`.

### Cash In official income boundary
- Buka halaman Pemasukan dan pastikan tidak ada card Pemasukan Pending.
- Pastikan Pemasukan hanya menghitung data resmi `revenues + incomes`.
- Pastikan Auto Penjualan dari sales `Selesai` tetap tampil.
- Pastikan sales `Diproses`/`Dikirim` tidak tampil sebagai pemasukan resmi.
- Pastikan tombol Hapus Cash In tetap tidak ada.

### Sales status tabs dan search
- Tab Semua Penjualan menampilkan semua status.
- Tab Diproses hanya menampilkan `Diproses`.
- Tab Dikirim hanya menampilkan `Dikirim`.
- Tab Selesai hanya menampilkan `Selesai`.
- Search resi/order/reference di setiap tab hanya mencari dalam status aktif.
- Clear search dan pastikan tab tetap menampilkan status yang benar.

### Sales action column
- Row `Diproses` hanya menampilkan aksi lanjut `Dikirim`.
- Row `Dikirim` hanya menampilkan aksi lanjut `Selesai`.
- Row `Selesai` tidak menampilkan aksi status lanjutan dari tabel Sales.
- Tidak ada tombol Batalkan/Delete/Hapus di tabel Sales.
- Barang kembali/koreksi stok setelah Sales tercatat wajib diuji melalui menu Return.

### Sales selector dan stock snapshot
- Buka Tambah Penjualan dan pilih Jenis Item.
- Dropdown item hanya menampilkan nama item + jenis item, tanpa teks stok panjang.
- Dropdown varian hanya menampilkan label varian, tanpa teks stok panjang.
- Panel read-only stok tetap tampil setelah item/varian dipilih.
- Submit sales tetap berhasil jika `availableStock` cukup.
- Submit sales tetap ditolak jika `availableStock` tidak cukup.

### Regression business flow
- Sales tetap mengurangi stok saat dibuat.
- Income tetap hanya dibuat saat status `Selesai`.
- Profit Loss tetap membaca `revenues + incomes + expenses`.
- Cash In tetap membaca `revenues + incomes`.
- Dashboard/Reports tidak berubah.

## Checklist UI Theme Brand Blue/Yellow/White/Navy

### Foundation theme
- [ ] CSS variable global di `src/index.css` sesuai palette blue/navy primary + muted gold accent.
- [ ] Token Ant Design di `src/theme/antdTheme.js` selaras dengan CSS variable global.
- [ ] Light theme terlihat clean corporate, terang, dan mudah dibaca.
- [ ] Dark theme memakai navy/dark blue, bukan hitam polos atau tone lama.
- [ ] Biru dipakai untuk primary action, link, focus ring, selected state, dan active navigation.
- [ ] Gold/yellow hanya menjadi accent kecil, bukan background besar, bukan semua CTA, dan bukan body text panjang.
- [ ] Semantic warning/success/danger/info tetap jelas dan warning tidak tertukar dengan brand gold.

### Flow theme runtime
- [ ] Toggle light/dark berjalan tanpa reload manual.
- [ ] Pilihan theme tersimpan di localStorage `ims-bunga-flanel-theme`.
- [ ] Dengan localStorage berisi `dark`, refresh browser tidak menampilkan flash light mode pada render awal React.
- [ ] `html/body` mendapat `app-theme-light` atau `app-theme-dark` sejak bootstrap awal di `src/main.jsx`, lalu tetap sinkron dari `AppLayout.jsx`.
- [ ] `html/body` mendapat `data-app-theme="light"` atau `data-app-theme="dark"`.
- [ ] Refresh browser mempertahankan mode terakhir.
- [ ] Modal, drawer, dropdown, select, datepicker, popover, dan table tetap solid di light/dark.

### Area UI terdampak
- [ ] Loading screen, shell, header, dan theme toggle readable dengan flat surface tanpa gradient global/shared.
- [ ] Sidebar expanded/collapsed rapi, active route jelas, submenu normal, dan role-aware menu tidak berubah.
- [ ] Login normal/error/loading/blocked user tampil profesional dan auth flow tetap berjalan.
- [ ] Dashboard tetap read-only, compact, tanpa perubahan query/calculation/write flow, dan card yang disentuh tetap flat tanpa gradient dekoratif.
- [ ] PageHeader, PageSection, SummaryStatCard, FilterBar, PageFormModal, dan OCR receipt konsisten dengan token brand; SummaryStatCard/FilterBar/OCR receipt flat tanpa gradient dan tanpa `font-weight: 900` hardcoded.

## Checklist Cleanup Theme Aman

- [ ] Login normal, error, loading profile, blocked user, dan logout blocked user tetap berjalan setelah cleanup CSS.
- [ ] Sidebar expanded/collapsed, active route, nested accordion, dan role-aware menu tetap sama.
- [ ] Light/dark toggle tetap menyimpan `app-theme-light`, `app-theme-dark`, dan `data-app-theme`.
- [ ] Modal, drawer, select dropdown, datepicker, dropdown menu, popover, dan table tetap solid/readable di light dan dark mode.
- [ ] Table fixed column, hover row, selected row, dan pagination tetap readable.
- [ ] Tidak ada class CSS yang dihapus tanpa grep pemakai aktif.
- [ ] Tidak ada perubahan ke AuthContext, AppLayout runtime, SidebarMenu logic, services, transaksi, stok, cashflow, produksi, payroll, HPP, reports, atau reset flow.
- [ ] Jalankan `npm run lint` dan `npm run build` di project lengkap yang punya `package.json`.


## Checklist Hardcoded Color / Theme Token Cleanup

- [ ] Buka Purchases di light mode dan dark mode; preview stok, ringkasan supplier, dan OCR draft panel harus mengikuti warna card/border/text theme, bukan fallback putih/abu lama.
- [ ] Upload OCR Shopee, buka popup detail OCR, cek badge, ikon, total, note, tombol, dan print preview tetap readable di light/dark mode.
- [ ] Pastikan tidak ada penggunaan token lama `--surface-card` atau `--surface-muted` pada Purchases/OCR.
- [ ] Cek Stock Management qty masuk/keluar, Supplier Purchases status harga, Sales item row, dan Production Orders requirement preview: border/status tetap readable.
- [ ] Pastikan cleanup warna tidak mengubah OCR parser, payload purchase, stock mutation, inventory log, expense, route, role guard, production, payroll, HPP, atau reset flow.

## Checklist Login visual polish — 2026-05-04

- [ ] Login normal tampil lebih proporsional dengan panel brand dan form yang seimbang.
- [ ] Logo resmi tidak terlihat berada dalam frame/wrap besar.
- [ ] Logo tidak tertimpa orb, glow, atau dekorasi lain.
- [ ] Background Login tidak terlalu ramai dan tercatat sebagai cleanup candidate bila masih memakai gradient page-specific.
- [ ] Form Login tetap menjadi fokus utama dan mudah dibaca.
- [ ] Username/password tetap bisa diisi.
- [ ] Login error tetap tampil sebagai Alert error.
- [ ] Loading profile tetap tampil.
- [ ] Blocked user tetap tampil dan tombol keluar tetap bekerja.
- [ ] Mobile Login tidak overflow dan panel brand tidak membuat scroll terlalu panjang.
- [ ] Tidak ada perubahan ke `AuthContext`, route guard, role access, Dashboard, Sidebar, atau modul bisnis.

## Checklist Login Mode A — Modern Bright Corporate

- [ ] Login page tampil terang, clean, modern, dan corporate.
- [ ] Layout desktop menampilkan brand hero kiri dan form card kanan secara proporsional.
- [ ] Logo resmi tampil bebas, tidak berada dalam frame besar, dan tidak tertimpa dekorasi.
- [ ] Shape/curve Login tetap tidak ramai; gradient page-specific lama dicatat sebagai cleanup candidate sampai batch Login khusus.
- [ ] Form login tetap menjadi fokus utama dan mudah dibaca.
- [ ] Button Masuk memakai primary blue yang kontras dan terlihat clickable.
- [ ] Input username/password tetap bisa diisi dan focus state jelas.
- [ ] Login normal tetap berhasil.
- [ ] Login error tetap muncul sebagai Alert error.
- [ ] Loading profile tetap tampil.
- [ ] Blocked user tetap tampil dan tombol keluar tetap berjalan.
- [ ] Mobile layout form-first, tidak overflow, dan brand panel turun ke bawah.
- [ ] Tidak ada perubahan ke AuthContext, route guard, role access, Sidebar, Dashboard, atau modul bisnis.

## Checklist Login full-page corporate final
- [ ] Login tampil full-page dan tidak terasa dibungkus outer card besar.
- [ ] Brand area kiri menyatu dengan viewport dan memakai aksen geometric minimalis.
- [ ] Logo utama tampil besar, center, presisi, dan tidak tertimpa dekorasi.
- [ ] Teks deskripsi lebih kecil dan tidak mengalahkan logo/form.
- [ ] Note internal tampil sebagai footer note/supportive information.
- [ ] Form card kanan tetap clean, fokus, dan button Masuk tetap primary blue.
- [ ] Input username/password readable dan focus state jelas.
- [ ] Login normal, login error, loading profile, blocked user, dan logout blocked user tetap berjalan.
- [ ] Mobile login tetap form-first, rapi, dan tidak overflow.
- [ ] Tidak ada perubahan ke AuthContext, route guard, role access, Sidebar, Dashboard, atau modul bisnis.

## Checklist UI Table Compact — 2026-05-06
- [ ] Buka Cash In: table utama tampil tanpa horizontal scroll default, sumber + tipe terbaca, nominal tetap rata kanan, dan tidak ada aksi delete/edit row.
- [ ] Buka Stock Management > Stock Adjustment Panel: riwayat adjustment tampil compact tanpa horizontal scroll default, kolom `Alasan & Catatan` tidak dobel, dan catatan panjang tetap terbaca via tooltip/preview.
- [ ] Buka Pricing Rules: table utama tampil compact tanpa fixed/sticky kanan; tombol Detail/Edit/Hapus tetap bekerja; modal Detail/preview tetap menghitung data yang sama.
- [ ] Buka Products: kolom Stok tetap menampilkan `Total`, `Tersedia`, dan semua variant pill langsung di table untuk item bervarian.
- [ ] Buka Semi Finished Materials: primary table tampil tanpa horizontal scroll default; kolom Stok tetap menampilkan `Total`, `Tersedia`, dan semua variant pill langsung di table.
- [ ] Buka Supplier: table utama tetap tanpa horizontal scroll default; Detail/Edit/Hapus tetap bekerja; drawer detail katalog tetap read-only terhadap transaksi.
- [ ] Buka Stock Report: baris stok menampilkan `Total`, `Tersedia`, dan variant pill jika data source membawa `variants[]`; filter, summary, dan export tetap memakai data laporan existing.
- [ ] Regression guarded: create/edit/toggle Products, submit Stock Adjustment, apply Pricing Rule, save Supplier, dan tambah Cash In manual tetap sama seperti sebelum patch.

## Checklist global/auth/route LogoLoadingScreen — 2026-05-07
- [ ] Refresh browser saat sudah login menampilkan satu loading logo full screen tanpa card/wrap, lalu masuk dashboard/app seperti sebelumnya.
- [ ] Refresh browser saat belum login menampilkan satu loading logo full screen, lalu masuk halaman Login seperti sebelumnya.
- [ ] Buka URL protected langsung: route guard memakai loading logo yang sama, redirect login tetap benar, dan unauthorized tetap benar.
- [ ] Lazy route/page load memakai loading logo yang sama tanpa mengubah route definitions atau role guard.
- [ ] Login auth/profile loading memakai loading logo yang sama; blocked/inactive/missing profile tetap berjalan.
- [ ] Logo loading tidak muter, micro split tetap subtle, light/dark mode bagus, mobile center, dan reduced motion aman.
- [ ] Console tidak menampilkan error canvas/image/import.
- [ ] Table loading, button submit loading, report loading, maintenance preview/loading, Refresh Need, dan Refresh Preview tidak berubah.

## Checklist Sidebar Logo & Brand Theme — 2026-05-07
- [ ] Sidebar expanded menampilkan logo, `IMS Bunga Flanel`, dan `Flanel Karawang Industries` dalam satu baris visual yang rapi tanpa wrap.
- [ ] Jika ruang sidebar sempit, title/subtitle memakai ellipsis dan tidak turun baris.
- [ ] Warna brand title/subtitle menyatu dengan token biru/navy theme aplikasi dan tidak memakai burgundy/rose baru.
- [ ] Sidebar collapsed hanya menampilkan logo/mark secara proporsional tanpa teks pecah.
- [ ] Cek light mode dan dark mode: logo tetap jelas, teks readable, tidak ada horizontal overflow baru, dan menu di bawah logo tetap sejajar.


## Checklist Product & Semi Finished Min Stock Master — 2026-05-07
- [ ] Product non-varian: Create/Edit menampilkan `Minimum Stok`, tersimpan ke `products.minStockAlert`, dan status low stock memakai nilai master itu.
- [ ] Product bervarian: Create/Edit menampilkan `Minimum Stok Master`, tidak ada input `Min Stok` per varian, dan detail drawer menampilkan `Minimum Stok Master` sekali di level master.
- [ ] Product bervarian: total stok/reserved/available tetap berasal dari varian, tetapi `products.minStockAlert` tidak berubah menjadi total `variants[].minStockAlert`.
- [ ] Semi Finished non-varian: Create/Edit menampilkan `Min Stock Alert`, tersimpan ke `semi_finished_materials.minStockAlert`, dan summary `Perlu Dicek` memakai nilai master itu.
- [ ] Semi Finished bervarian: Create/Edit menampilkan `Min Stock Alert Master`, tidak ada input `Min Stock Alert` per varian, dan ringkasan read-only menyebut Min Stock Alert sebagai master item.
- [ ] Semi Finished bervarian: total current/reserved/available tetap berasal dari varian, average cost varian tetap tampil, tetapi min stock tidak dihitung dari total varian.
- [ ] Negative validation: `minStockAlert < 0` ditolak baik untuk mode varian maupun non-varian.
- [ ] Legacy compatibility: data lama yang masih punya `variants[].minStockAlert` tetap tidak crash, tetapi angka itu tidak tampil sebagai input/detail utama per varian.
- [ ] Tidak ada perubahan ke Raw Materials, Stock Adjustment, Sales, Purchases, Production Order, Work Log, Dashboard selain read low-stock dari field master yang sudah enriched.

## Checklist Minimum Stock Read-Only Alignment — 2026-05-07

### Raw Material
- [ ] Minimum Stok Master tetap tampil dan editable di form/detail Raw Material.
- [ ] Status Raw Material memakai comparator `availableStock ?? currentStock ?? stock ?? 0` terhadap `raw_materials.minStock`.
- [ ] Uji item dengan `currentStock` di atas `minStock`, tetapi `availableStock` di bawah/sama `minStock`; status harus menunjukkan perlu dicek/rendah.
- [ ] Raw Material bervarian tetap tidak punya minimum stok per variant.
- [ ] Tidak ada inventory log baru hanya karena status display berubah.

### Semi Finished
- [ ] `Min Stock Alert` / `Min Stock Alert Master` tetap tampil dan editable.
- [ ] Status Semi Finished memakai comparator `availableStock ?? currentStock ?? stock ?? 0` terhadap `semi_finished_materials.minStockAlert`.
- [ ] Summary `Perlu Dicek`, status row, dan drawer detail konsisten.
- [ ] Tidak ada minimum stock per variant dan tidak ada label/komentar aktif yang menyatakan min alert varian sebagai source threshold.
- [ ] Tidak ada perubahan create/edit Semi Finished, production order, work log, payroll, atau HPP.

### Dashboard
- [ ] Widget `Stok Kritis` menampilkan Product, Raw Material, dan Semi Finished jika datanya kosong/menipis.
- [ ] Product memakai threshold `products.minStockAlert`, Raw Material memakai `raw_materials.minStock`, dan Semi Finished memakai `semi_finished_materials.minStockAlert`.
- [ ] Dashboard memakai comparator available-first dan tidak membaca `variants[].minStockAlert`.
- [ ] Semi Finished tampil read-only tanpa action pembelian/restock otomatis.
- [ ] Restock Assistant bahan baku tetap hanya untuk Raw Material dan tidak berubah menjadi auto-purchase.
- [ ] Dashboard tidak crash saat data kosong, threshold 0/kosong, atau data lama masih punya `variants[].minStockAlert`.

### Stock Report
- [ ] Product, Raw Material, dan Semi Finished tetap tampil di Stock Report.
- [ ] Status `Habis/Kritis/Normal` memakai threshold master per entity, bukan angka statis `10`.
- [ ] Threshold 0 atau kosong tidak otomatis membuat item menjadi `Kritis`; stok 0 tetap `Habis`.
- [ ] Export XLSX membawa status yang sama dengan tabel dan menyertakan minimum stok master.
- [ ] Tidak ada perubahan report lain, query collection lain, stok fisik, inventory log, transaksi, produksi, payroll, HPP, auth, role, route, atau reset maintenance.

### Produk Jadi dan Data Lama
- [ ] Product `minStockAlert` tetap ada dan status Product tetap memakai threshold master itu.
- [ ] Product tidak menampilkan minimum stock per variant.
- [ ] Data lama dengan `variants[].minStockAlert` tidak crash dan field legacy itu tidak memengaruhi Dashboard/Stock Report status.


## Checklist Brand Theme Alignment — Blue/Navy + Gold Accent No-Gradient

### Light mode
- [ ] Dashboard, Produk, Raw Material, Stock Management, Sales, Purchases, Returns, Cash In, Cash Out, Produksi, Laporan, Manajemen User, dan Reset & Maintenance tetap readable.
- [ ] Form input/select/date picker, table, modal, drawer, dropdown, empty state, disabled button, active menu, hover menu, dan focus input tetap jelas.
- [ ] Gold accent terlihat subtle sebagai marker kecil, bukan background besar.

### Dark mode
- [ ] Semua area light mode di atas tetap readable.
- [ ] Sidebar active marker gold terlihat elegan, tidak neon.
- [ ] Header greeting, table row, modal, drawer, dan dropdown tidak belang.
- [ ] Surface tetap flat dan corporate.

### Branding dan accessibility
- [ ] Logo cocok dengan shell; blue/navy tetap terasa sebagai primary.
- [ ] Gold/yellow terlihat sebagai aksen kecil dan tidak terlalu banyak.
- [ ] Tidak ada gradient aktif pada file global/shared/page-specific yang diubah.
- [ ] Brand gold tidak membingungkan dengan warning semantic.
- [ ] Text contrast, table row, tag status, warning/success/error/info, focus state, disabled state, dan primary button tetap terbaca.

### Responsive dan regression
- [ ] Desktop lebar, laptop 1366px, laptop 1280px, tablet, mobile, sidebar expanded, dan sidebar collapsed tidak horizontal overflow.
- [ ] Tidak ada console error; logout tetap bisa diklik; role badge jelas; menu active benar; action buttons terbaca; modal/dropdown/select/date picker tetap solid.
- [ ] Tidak ada perubahan data, service, transaksi, stok, report mapper, produksi, payroll, HPP, auth, role, route, atau reset maintenance.

## Checklist HPP Trial — Reset Maintenance

### Preview dan reset semua modal/HPP testing
- [ ] Buka Reset Maintenance lalu lihat kartu `Pilih Kebutuhan Testing` > `HPP Trial`.
- [ ] Klik `Preview Semua Modal/HPP` dan pastikan preview berhasil dimuat sebelum reset.
- [ ] Klik `Reset Semua Modal/HPP` dan pastikan modal konfirmasi muncul.
- [ ] Isi keyword salah dan pastikan aksi tidak jalan.
- [ ] Isi `RESET MODAL HPP` hanya pada data test dan pastikan aksi hanya menyentuh field cost/HPP allowlist.
- [ ] Pastikan tidak menyentuh Work Log, Payroll, PO, stock mutation, transactions, sales, purchases, returns, atau cash.

### Guard cost/HPP stok awal dan reset modal
- [ ] Reset Average Cost Raw Material/Semi/Product hanya pada data test, lalu buat Stock Adjustment `Tambah` pada item yang masih punya stok fisik.
- [ ] Jika cost/HPP master 0, form Stock Adjustment wajib meminta `Modal per Unit` dan menolak submit jika kosong.
- [ ] Setelah cost/HPP baseline terisi, buat pembelian baru dengan harga valid; pastikan average cost tidak turun karena stok lama dihitung modal 0.
- [ ] Untuk raw material bervarian, tambah stok via purchase pada varian aktif dan pastikan master `averageActualUnitCost` memakai zero-cost baseline protection.
- [ ] Untuk produksi output Semi Finished/Product setelah reset HPP, pastikan HPP output baru tidak terdilusi oleh stock lama yang cost/HPP-nya 0.

### Regression data setelah reset modal/HPP
- [ ] Stok raw material tidak berubah.
- [ ] Stok product tidak berubah.
- [ ] Stok semi finished tidak berubah.
- [ ] Purchases, sales, returns, production_orders, production_work_logs, production_payrolls, dan cash in/out tidak terhapus.
- [ ] Work Log completed lama tidak diproses ulang otomatis.
- [ ] HPP Analysis masih bisa dibuka.
- [ ] HPP Analysis berubah hanya karena sumber cost master dipakai pada simulasi produksi berikutnya, bukan karena Work Log lama dibackfill otomatis.
- [ ] Preview/reset transaksi existing, reset production planning only, baseline stok existing, sync stok existing, hapus data test existing, dan audit maintenance existing tetap jalan.

## Checklist Buku Besar Kas / Log Pergerakan Uang

### Akses menu dan route
- [ ] Login sebagai Administrator.
- [ ] Buka menu `Kas & Biaya` dan pastikan child `Buku Besar Kas` tampil.
- [ ] Buka route `/finance/money-movement-ledger` dan pastikan halaman tampil tanpa whitescreen.
- [ ] Login sebagai role `user` dan pastikan menu `Buku Besar Kas` tidak tampil.
- [ ] Dengan role `user`, akses langsung route `/finance/money-movement-ledger` harus ditolak oleh route guard.

### Source data dan anti double count
- [ ] Data dari `incomes` tampil sebagai uang masuk `Penjualan Selesai`.
- [ ] Data dari `revenues` tampil sebagai uang masuk `Cash In Manual` atau pemasukan legacy.
- [ ] Data dari `expenses` tampil sebagai uang keluar.
- [ ] Sales selesai tidak dihitung lagi langsung dari collection `sales`.
- [ ] Purchase tidak dihitung lagi langsung dari collection `purchases`.
- [ ] Payroll paid tidak dihitung lagi langsung dari collection `production_payrolls`.
- [ ] Work Log completed tidak muncul sebagai uang keluar jika tidak ada dokumen `expenses`.
- [ ] Inventory log, stock adjustment, HPP update, dan reset modal/HPP testing tidak muncul sebagai pergerakan uang.

### Filter dan summary
- [ ] Filter tahun bekerja.
- [ ] Filter bulan bekerja.
- [ ] Filter arah `Masuk` hanya menampilkan `incomes` dan `revenues`.
- [ ] Filter arah `Keluar` hanya menampilkan `expenses`.
- [ ] Filter sumber `Penjualan Selesai`, `Cash In Manual`, `Pembelian`, `Payroll Produksi`, `Cash Out Manual`, dan `Lainnya` bekerja sesuai row.
- [ ] Search bisa mencari referensi, deskripsi, sumber, status, tipe, dan nominal.
- [ ] Summary `Total Uang Masuk` sama dengan jumlah row masuk yang tampil.
- [ ] Summary `Total Uang Keluar` sama dengan jumlah row keluar yang tampil.
- [ ] Summary `Selisih Bersih Periode` = total masuk - total keluar dan tidak dibaca sebagai saldo akhir kas.
- [ ] Limit transaksi membatasi jumlah row yang tampil tanpa crash.

### Read-only dan regression
- [ ] Membuka halaman tidak membuat dokumen Firestore baru.
- [ ] Membuka halaman tidak mengubah `incomes`, `revenues`, `expenses`, `sales`, `purchases`, `production_payrolls`, `production_work_logs`, `inventory_logs`, atau `stock_adjustments`.
- [ ] Cash In manual tetap bisa dibuat dari halaman Pemasukan.
- [ ] Cash Out manual tetap bisa dibuat dari halaman Pengeluaran.
- [ ] Profit Loss tidak berubah akibat membuka Buku Besar Kas.
- [ ] Sales, Purchases, Payroll, HPP, Inventory, dan Reset Maintenance tetap berjalan sesuai checklist existing.
- [ ] Cek console error.
- [ ] Jalankan `npm run lint` jika environment tersedia.
- [ ] Jalankan `npm run build` jika environment tersedia.

## Checklist Biaya Produksi / Labor HPP — Estimasi, Draft, Final

### A. Setup Step Produksi
- [ ] Buka Tahapan Produksi.
- [ ] Buat/edit step dengan Rate Biaya Produksi valid.
- [ ] Buat/edit step dengan rate 0.
- [ ] Pastikan label rate tetap mengarah ke Biaya Produksi/operator produksi dan payload field tidak berubah.

### B. Work Log baru dari PO
- [ ] Buat BOM dengan step produksi yang punya rate valid.
- [ ] Buat PO lalu mulai produksi / buat Work Log.
- [ ] Pastikan material cost tetap dari snapshot bahan.
- [ ] Pastikan Biaya Produksi estimasi tampil jika data step tersedia.
- [ ] Pastikan labelnya `Estimasi` atau `Estimasi dari Step`, bukan `Final`.
- [ ] Pastikan tidak ada payroll dibuat saat PO dibuat.
- [ ] Pastikan tidak ada payroll dibuat saat Work Log baru/start production.
- [ ] Pastikan tidak ada Cash Out/Expense dibuat dari estimasi.

### C. Work Log dengan step rate 0
- [ ] Buat Work Log dari step rate 0.
- [ ] Pastikan Biaya Produksi 0.
- [ ] Pastikan status/warning `Perlu cek` muncul.
- [ ] Pastikan tidak ada NaN/Infinity.

### D. Complete Work Log dan Payroll
- [ ] Complete Work Log dengan operator valid.
- [ ] Pastikan payroll line dibuat sesuai flow existing setelah Work Log completed.
- [ ] Pastikan status awal payroll draft tampil sebagai `Draft Payroll`, bukan final.
- [ ] Pastikan HPP output sudah memakai accrued labor dari step saat Work Log completed, walaupun payroll belum paid.
- [ ] Confirm/pay payroll jika flow tersedia.
- [ ] Pastikan setelah payroll final, Work Log detail hanya mereconcile selisih jika nominal final berbeda dari accrued labor.
- [ ] Pastikan accrued labor tidak dijumlahkan dobel dengan payroll final.
- [ ] Complete Work Log tanpa operator jika flow mengizinkan dan pastikan warning operator/payroll jelas.
- [ ] Pastikan payroll cancelled tidak dihitung sebagai final.
- [ ] Pastikan `includePayrollInHpp=false` tidak masuk ke final HPP.

### E. HPP Analysis
- [ ] Buka HPP Analysis.
- [ ] Cek Work Log completed dengan draft payroll.
- [ ] Cek Work Log completed dengan payroll final.
- [ ] Cek Work Log completed tanpa payroll final.
- [ ] Pastikan status `Final`, `Draft Payroll`, `Estimasi`, dan `Perlu cek` muncul sesuai kondisi.
- [ ] Pastikan kolom HPP/unit menampilkan `Perlu Reconcile HPP` saat output line cost belum sama dengan HPP final payroll.
- [ ] Pastikan total HPP tidak double count estimasi + final.
- [ ] Pastikan HPP/unit invalid jika goodQty 0.
- [ ] Pastikan HPP Analysis tidak menulis ke Firestore dan tidak update `products.hppPerUnit` atau `semi_finished_materials.averageCostPerUnit`; update master hanya boleh terjadi dari service payroll/reconcile guarded.

### E2. Scenario produksi bertingkat dan reconcile HPP
- [ ] Buat Raw Material kain dengan `averageActualUnitCost` dari purchase dan `restockReferencePrice` berbeda; pastikan BOM memakai modal aktual rata-rata, bukan harga referensi, ketika modal aktual tersedia.
- [ ] Buat Semi Finished `Pola Kelopak` dari Raw Material; complete Work Log dan pastikan material cost memakai snapshot Start Production.
- [ ] Sebelum payroll final, pastikan HPP aktif sudah terbentuk dari material snapshot + accrued labor step + overhead sehingga semi product bisa dipakai ke step berikutnya tanpa material-only.
- [ ] Setelah payroll final/paid, pastikan Work Log `laborCostActual`, `totalCostActual`, dan `costPerGoodUnit` hanya berubah jika nominal final berbeda dari accrued labor.
- [ ] Pastikan payroll final menjalankan reconcile HPP tanpa menambah qty stok dan tanpa membuat inventory log baru.
- [ ] Cek master Semi Finished: `averageCostPerUnit` / variant `averageCostPerUnit` sinkron sesuai rule weighted average.
- [ ] Buat BOM Produk Jadi yang memakai Semi Finished tersebut; pastikan estimate membaca HPP Semi Finished, bukan harga Raw Material awal.
- [ ] Buka Data Quality Audit; pastikan kategori output line stale, master HPP stale, dan variant HPP stale muncul hanya untuk data yang belum sinkron.

### E3. Presisi HPP dan pembulatan komponen bunga
- [ ] Buat Semi Finished kategori `Kelopak` dengan HPP internal seperti `22.18125`; pastikan detail Semi Finished menampilkan `Rp 22,18 / pcs`, bukan hanya `Rp 22`.
- [ ] Pastikan detail Semi Finished kategori `Kelopak` menampilkan estimasi resep `± Rp 222 / 10 kelopak per produk`.
- [ ] Buat pembanding HPP `21.9729`; pastikan UI detail tetap bisa membedakan `Rp 21,97` vs `Rp 22,18`.
- [ ] Buat BOM Produk Jadi dengan 10 kelopak; pastikan subtotal memakai `10 × cost decimal internal`, bukan `10 × angka tampilan bulat`.
- [ ] Pastikan total HPP produk jadi/harga jual tetap tampil rupiah bulat, sementara HPP/unit kecil di detail produksi boleh 2 decimal.
- [ ] Pastikan export HPP/unit memakai 2 decimal, sedangkan total biaya, purchase, kas, payroll, dan laporan uang tetap tanpa sen/desimal.

### F. Payroll dan Cash
- [ ] Pastikan payroll tidak dibuat saat PO dibuat.
- [ ] Pastikan payroll tidak dibuat saat Work Log start.
- [ ] Pastikan payroll dibuat saat complete sesuai flow existing.
- [ ] Klik paid payroll jika tersedia.
- [ ] Pastikan Cash Out/Expense payroll paid dibuat sekali.
- [ ] Klik ulang paid jika UI memungkinkan dan pastikan Cash Out/Expense tidak double.
- [ ] Pastikan draft payroll tidak dianggap uang keluar.

### G. Transaction safety dan regression
- [ ] Start production.
- [ ] Complete Work Log.
- [ ] Pastikan tidak muncul error `Firestore transactions require all reads to be executed before all writes.`
- [ ] Pastikan stok material tidak double berkurang.
- [ ] Pastikan stok output tidak double bertambah.
- [ ] Production Planning, Production Order, Work Log detail, HPP Analysis, dan Production Payrolls tetap bisa dibuka.
- [ ] Sales/Purchases/Returns, Cash In/Cash Out, Inventory, Reset Maintenance, route/menu/role guard tidak berubah.
- [ ] Cek console error.

## Checklist Tahap 1 & 2 — Validasi Form + Referensi Display

### A. Popup field wajib
- [ ] Buka form tambah/edit di Master Data Produk, kosongkan field wajib, klik Simpan, muncul popup `Data belum lengkap` dan field wajib tetap ter-highlight.
- [ ] Buka form Bahan Baku, kosongkan field wajib, klik Simpan, popup menyebut field yang harus dilengkapi.
- [ ] Buka transaksi Sales/Purchases/Returns/Stock Adjustment, kosongkan field wajib, klik Simpan, popup muncul dan tidak membuat data baru.
- [ ] Buka Production Planning/Order/Work Log/Payroll/BOM/Step/Employee/Semi Finished, kosongkan field wajib, klik Simpan, popup muncul dan tidak ada perubahan data.
- [ ] Pastikan error bisnis/service non-validasi tetap muncul sebagai pesan error biasa, bukan tertelan popup validasi.

### B. Referensi display
- [ ] Inventory > Stock Management: kolom Referensi menampilkan label bisnis (`Penjualan`, `Pembelian`, `Work Log`, dll.) dengan kode/ref manusiawi jika tersedia, bukan ID random sebagai teks utama.
- [ ] Finance > Buku Besar Kas: kolom Referensi menampilkan `sourceRef/referenceNumber/payrollNumber` jika tersedia; data lama tetap menampilkan ID ringkas.
- [ ] Laporan Sales/Purchases/Profit Loss/Payroll/Stock: export dan tabel memakai kode bisnis/display reference jika ada.
- [ ] Produksi Planning/Order/Work Log/Payroll/BOM/Employee/Semi Finished: tabel/detail menampilkan kode bisnis (`planCode`, `code`, `workNumber`, `payrollNumber`) dan bukan Firestore ID random.
- [ ] Buat data dummy baru setelah patch: Sales selesai, Purchase, Work Log completed, Payroll paid; cek semua referensi muncul konsisten di Inventory Log, Ledger Kas, dan Report.

### C. Guard regresi
- [ ] Tidak ada whitescreen saat membuka detail payroll, work log, production order, BOM, employee, atau semi finished.
- [ ] Submit valid tetap berhasil membuat/update data seperti sebelum patch.
- [ ] Tidak ada double posting stok, cash in, cash out, payroll, atau HPP akibat perubahan display/validasi.


## Checklist Data Quality Audit — Reset Maintenance

- [ ] Buka menu **Reset & Maintenance** sebagai admin.
- [ ] Buka panel **Auto Detect Bug Data**.
- [ ] Klik **Cek Data Lama**.
- [ ] Pastikan summary tampil: Data Dicek, Total Temuan, Kategori Bermasalah, dan Collection Skipped.
- [ ] Pastikan audit tidak membuat collection baru dan tidak menulis data baru.
- [ ] Pastikan ringkasan issue tampil di tabel area audit tanpa membuka panel `Detail Audit / Tools` lama.
- [ ] Pastikan kategori Sales tanpa `ORD`, Purchase tanpa `PUR`, Return tanpa `RET`, Cash In/Out tanpa `CSH-IN/CSH-OUT`, Work Log tanpa `JOB`, Work Log cost 0, Work Log material snapshot kosong, Payroll reference tidak jelas, Inventory Log reference ID random, Expense/Income source tidak jelas, dan HPP 0 tampil jika ada datanya.
- [ ] Pastikan rekomendasi kategori jelas: `Aman dibuat ulang jika data test`, `Perlu cek manual`, atau `Jangan reset jika data asli`.
- [ ] Pastikan collection kosong tampil sebagai 0/skipped dan halaman tidak crash.
- [ ] Pastikan tidak ada data yang terhapus setelah audit.
- [ ] Pastikan stok, kas, payroll, HPP, Sales, Purchases, Returns, Inventory Log, dan Production Work Log tidak berubah hanya karena audit dibuka.
- [ ] Pastikan fitur reset existing tetap wajib preview dan konfirmasi seperti sebelumnya.
- [ ] Pastikan panel `Detail Audit / Tools` lama tidak tampil lagi di bagian bawah halaman.
- [ ] Pastikan `Cara Pakai Setelah Patch` tetap tampil sebagai guide ringkas.
- [ ] Cek console browser, pastikan tidak ada error merah saat menjalankan audit.

## Patch Check — Pricing Mode Switch Product & Raw Material

- [ ] Buka Master Data > Produk Jadi, tambah/edit produk, pastikan field “Gunakan Pricing Rule” tampil sebagai switch Manual/Rule.
- [ ] Switch Produk OFF/manual: `pricingMode` tersimpan `manual`, `pricingRuleId` dikosongkan, harga jual tetap bisa diisi manual.
- [ ] Switch Produk ON/rule tanpa memilih rule: muncul warning preview dan validasi tetap meminta pricing rule.
- [ ] Switch Produk ON/rule dengan HPP valid dan rule aktif: harga jual di form terisi preview hasil `pricingService` saat rule/base cost berubah.
- [ ] Buka Master Data > Raw Materials, tambah/edit bahan baku, pastikan field “Gunakan Pricing Rule” tampil sebagai switch Manual/Rule.
- [ ] Switch Raw Material OFF/manual: `pricingMode` tersimpan `manual`, `pricingRuleId` dikosongkan, harga jual tetap bisa diisi manual.
- [ ] Switch Raw Material ON/rule tanpa memilih rule: muncul warning preview dan validasi tetap meminta pricing rule.
- [ ] Switch Raw Material ON/rule dengan modal/base cost valid dan rule aktif: harga jual di form terisi preview hasil `pricingService` saat rule/base cost berubah.
- [ ] Tabel dan detail Produk menampilkan mode Manual atau Pricing Rule + nama rule bila tersedia.
- [ ] Tabel dan detail Raw Material menampilkan mode Manual atau Pricing Rule + nama rule bila tersedia.
- [ ] Pricing Rules tetap membaca field existing `pricingMode` dan `pricingRuleId`; tidak ada schema Firestore baru.
- [ ] `npm run build` berhasil.
- [ ] `npm run lint` berhasil atau warning non-blocker dicatat.


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


### Checklist final reference code

- [ ] Customer baru memakai `CUS-DDMMYYYY-001` dan field kode disabled/read-only.
- [ ] Supplier baru memakai `SUP-DDMMYYYY-001` dan field kode disabled/read-only.
- [ ] Product baru memakai `PRD-001`, `PRD-002`, dan seterusnya.
- [ ] Raw Material baru memakai `RAW-001`, `RAW-002`, dan seterusnya, bukan `RM`.
- [ ] Semi Finished baru memakai `SFP-001`, `SFP-002`, dan seterusnya.
- [ ] BOM baru memakai `BOM-001`, `BOM-002`, dan seterusnya.
- [ ] Production Step baru memakai `STP-001`, `STP-002`, dan seterusnya, bukan timestamp.
- [ ] Purchase baru memakai `PUR-DDMMYYYY-001`.
- [ ] Sales/Order baru memakai `ORD-DDMMYYYY-001` walaupun field compatibility masih `saleNumber`.
- [ ] Return baru memakai `RET-DDMMYYYY-001`.
- [ ] Production Order baru memakai `PO-PRD-DDMMYYYY-001` atau `PO-SFP-DDMMYYYY-001`.
- [ ] Stock Adjustment baru memakai `STK-ADJ-DDMMYYYY-001`.
- [ ] Cash In baru memakai `CSH-IN-DDMMYYYY-001`.
- [ ] Cash Out baru memakai `CSH-OUT-DDMMYYYY-001`, bukan `CSH-OT`.
- [ ] Work Log baru memakai `JOB-DDMMYYYY-001`, bukan `WL`.
- [ ] Payroll baru memakai `PAY-DDMMYYYY-001`.
- [ ] Firestore random ID tidak tampil sebagai kode audit/user-facing.
- [ ] Data lama tidak di-rename document ID.
- [ ] Duplicate code dicegah oleh service/helper.


### Checklist UI code internal master item/config

- [ ] Product form tidak menampilkan input kode utama.
- [ ] Raw Material form tidak menampilkan input kode utama.
- [ ] Semi Finished form tidak menampilkan input kode utama atau realtime preview kode.
- [ ] BOM form tidak menampilkan input kode utama.
- [ ] Production Step form tidak menampilkan input kode utama.
- [ ] Create Product/Raw Material/Semi Finished/BOM/Production Step tetap sukses tanpa `code` dari UI.
- [ ] Data baru Product/Raw Material/Semi Finished/BOM/Production Step tetap tersimpan punya field `code`.
- [ ] Edit nama/kategori/target/status tidak mengubah `code` existing.
- [ ] Customer/Supplier code tetap tampil di UI.
- [ ] Purchase/Sales/Return/Stock Adjustment/Cash In/Cash Out/Production Order/Work Log/Payroll reference tetap tampil di UI.
- [ ] Return tanpa referensi bisnis tidak menampilkan Firestore/Technical ID di tabel/tooltip dan memakai fallback manusiawi.
- [ ] SKU Variant/kode variant tetap tersimpan untuk compatibility, tetapi tidak ditampilkan sebagai field utama UI.


## Checklist UI Produksi Grouped & Production Order Target Filter — 2026-05-12

### Semi Finished Materials
- [ ] Buka menu Semi Product / Semi Finished Materials.
- [ ] Pastikan tampilan grouped/accordion berdasarkan `Product Family / Jenis Bunga` lalu kategori, atau mode global tetap tersedia bila source menyediakan toggle.
- [ ] Pastikan item tidak hilang dari UI walaupun data lama tidak punya family/category; item harus masuk fallback seperti `Umum / Reusable` atau `Tanpa Kategori`.
- [ ] Pastikan total stock, available stock, variant stock, status aman/kosong, status aktif/nonaktif, tombol Detail/Edit/Nonaktifkan tetap sama seperti sebelum patch.
- [ ] Pastikan grouping tidak mengubah stok, `variantKey`, `currentStock`, `availableStock`, `reservedStock`, atau collection Firestore.

### BOM / Resep Produksi
- [ ] Buka menu BOM / Resep Produksi.
- [ ] Pastikan daftar bisa dibaca berdasarkan `Target Type → Target Item → Resep Produksi`.
- [ ] Pastikan BOM target `product` dan `semi_finished_material` tetap dibedakan.
- [ ] Pastikan create/edit BOM, material lines, step lines, status aktif/nonaktif, dan rule material tidak berubah.
- [ ] Pastikan search/filter tetap menemukan BOM walaupun item berada dalam group/accordion.

### Production Order Create Drawer
- [ ] Buka menu Production Order lalu klik Buat Production Order.
- [ ] Pastikan section angka `1`, `2`, `3` tidak muncul lagi dan diganti section yang lebih halus seperti `Target Produksi`, `Detail Produksi`, dan `Preview Kebutuhan`.
- [ ] Pilih `Jenis Produksi = Produk Jadi`; pastikan hanya muncul `Produk yang dibuat`, bukan `Jenis Bunga / Product Family`, `Kategori Bahan`, atau `Bahan yang dibuat`.
- [ ] Pilih `Jenis Produksi = Bahan / Semi Produk`; pastikan muncul `Jenis Bunga / Product Family`, `Kategori Bahan`, dan `Bahan yang dibuat`.
- [ ] Pilih family seperti `Mawar`; pastikan daftar bahan terfilter dan tidak menampilkan semua bahan dalam flat list panjang.
- [ ] Pilih kategori seperti `Daun`, `Kelopak`, `Pola`, atau `Kawat`; pastikan daftar bahan makin sempit sesuai kategori.
- [ ] Pastikan option target user-facing tidak menampilkan hitungan `· 1 BOM` dan tidak perlu menampilkan kode master internal di belakang nama.
- [ ] Jika target hanya punya satu resep aktif, pastikan resep otomatis dipakai secara internal dan field `Resep Produksi` tidak perlu tampil.
- [ ] Jika target punya lebih dari satu resep aktif, pastikan field `Resep Produksi` tampil dan user bisa memilih resep.
- [ ] Pastikan `bomId` tetap terisi saat submit dan tidak ada field UI-only seperti selected family/category yang tersimpan ke Firestore.
- [ ] Pastikan varian target tetap wajib dipilih jika target bervarian.
- [ ] Pastikan preview kebutuhan/stok tetap read-only dan muncul setelah target, varian jika ada, dan qty valid.
- [ ] Buat PO untuk Produk Jadi dan Bahan / Semi Produk; pastikan kode order tetap auto-generated dan status ready/shortage tetap sesuai stok.
- [ ] Pastikan cancel/start/complete Production Order tetap berjalan dan tidak merusak Work Log, Payroll, HPP Analysis, inventory mutation, atau report.

## Checklist Master Code Maintenance — Reset & Maintenance

- [ ] Buka Reset & Maintenance sebagai admin.
- [ ] Klik `Cek Kode Master`; pastikan preview hanya menampilkan Product, Raw Material, Semi Finished, BOM, Production Step, dan Supplier yang kode/aliasnya belum sesuai standar aktif.
- [ ] Klik `Normalisasi Kode`; pastikan hanya field `code` dan alias kode aktif yang berubah.
- [ ] Pastikan document ID master tidak berubah dan transaksi/history lama tetap bisa dibuka.
- [ ] Buka halaman Supplier; pastikan tidak ada tombol/modal `Repair Kode Supplier Lama`.
- [ ] Buat Supplier/Product/Raw/Semi/BOM/Step baru; pastikan format kode tetap sesuai standar locked.

## Checklist Work Log Live Cost Bertingkat
- [ ] Buat Semi Finished step awal, finalkan payroll sesuai flow, lalu pastikan master Semi Finished memiliki `averageCostPerUnit` / `lastProductionCostPerUnit` sesuai HPP step tersebut.
- [ ] Buat BOM step berikutnya yang memakai Semi Finished tersebut sebagai input.
- [ ] Start Production dari PO baru dan pastikan `materialUsages[].costPerUnitSnapshot` memakai cost master Semi Finished, bukan snapshot BOM/PO lama.
- [ ] Ubah/reset master cost Semi Finished menjadi 0, lalu buat/start PO baru dan pastikan biaya material Work Log baru menjadi 0, bukan fallback snapshot lama.
- [ ] Complete Work Log yang sedang berjalan dan pastikan service refresh cost dari master aktif sebelum menghitung `materialCostActual`.
- [ ] Pastikan wording UI Work Log tidak berubah pada patch live cost ini.

## Checklist Produksi — BOM Cost, Work Log Snapshot, Payroll Reconcile HPP
- [ ] Buat/update Raw Material dengan `averageActualUnitCost` valid, lalu buat BOM yang memakai raw tersebut. Pastikan estimasi material BOM memakai `averageActualUnitCost`, bukan harga jual/manual lain.
- [ ] Buat Semi Finished dari Work Log completed, finalkan/payroll paid, lalu buka BOM produk jadi yang memakai Semi Finished tersebut. Pastikan estimasi BOM membaca `averageCostPerUnit` Semi Finished yang sudah ikut labor final.
- [ ] Untuk Semi Finished bervarian, buat stok/cost varian berbeda. Pastikan master `averageCostPerUnit` menjadi weighted average berdasarkan stok varian, bukan rata-rata sederhana per varian.
- [ ] Jalankan flow PO → Start Production → Complete Work Log. Pastikan material cost saat complete memakai snapshot Work Log dari start, bukan berubah karena master cost diedit setelah bahan dipotong.
- [ ] Setelah payroll final/paid, pastikan `laborCostActual`, `totalCostActual`, `costPerGoodUnit`, output `costPerUnit`, dan master HPP/average cost output berubah sesuai final tanpa menambah qty stok dan tanpa inventory log baru.
- [ ] Buka HPP Analysis dan export XLSX. Pastikan status sinkron master HPP tampil dan kolom export membawa status sinkron master.
- [ ] Jalankan Data Quality Audit. Pastikan kandidat stale BOM/output HPP tetap read-only dan tidak melakukan backfill otomatis.

### Master inventory table noise cleanup
- [ ] Buka Semi Product: tabel utama tidak menampilkan caption panjang `Perlu restock...`; status cukup tag ringkas dan varian kosong/rendah tetap terlihat lewat pill stok.
- [ ] Buka Semi Product: kolom `Modal/HPP` tampil ringkas memakai format HPP/unit presisi, tanpa mengubah angka HPP di database.
- [ ] Buka Products: kolom Status tidak menampilkan caption panjang `Perlu restock...`; info harga jual/HPP tetap tampil di kolom Harga.
- [ ] Buka Raw Materials: kolom Bahan Baku tidak menampilkan caption panjang `Perlu restock...`; tag status, varian, supplier, dan kolom harga tetap rapi.
- [ ] Buka detail item Raw/Product/Semi untuk memastikan informasi varian lengkap masih tersedia di drawer/detail dan tidak ada mutasi stok/HPP hanya karena membuka halaman.

## Checklist Sinkronisasi Docs vs Source Aktual

Gunakan checklist ini setiap ada audit docs/source atau patch docs:

- [ ] Sebutkan nama ZIP/source yang dibaca, misalnya `src.zip` dan `docs.zip`, bukan hanya mengandalkan catatan chat lama.
- [ ] Hitung ulang line count file besar dari source aktual sebelum menulis prioritas maintainability.
- [ ] Grep semua path penting yang disebut docs dan pastikan statusnya jelas: aktif, legacy, missing, atau external.
- [ ] Pastikan docs tidak menyatakan `firestore.rules`, `firebase.json`, atau `functions/` ada di repo kecuali file tersebut benar-benar diupload pada source terbaru.
- [ ] Pastikan route/menu/import source aktif tidak mengarah ke file yang sudah hilang.
- [ ] Jika file hilang memang intentional cleanup, tulis penggantinya atau alasan status legacy agar developer berikutnya tidak menghidupkan file lama.
- [ ] Jangan melakukan refactor besar hanya karena file besar; buat task kecil behavior-preserving dan guard modul sensitif.


## Batch 16C — Atomic Counter Master/Finance/Stock/Produksi

- [ ] Buat Customer dan Supplier baru; pastikan ID dokumen sama dengan kode `CUS-*`/`SUP-*` dan tidak overwrite saat create cepat dari dua tab.
- [ ] Buat Product, Raw Material, BOM, dan Semi Finished baru; pastikan kode sequence `PRD-*`, `RAW-*`, `BOM-*`, `SFP-*` tetap terbentuk dan dokumen baru memakai ID readable.
- [ ] Buat Cash In dan Cash Out manual; pastikan dokumen `revenues`/`expenses` memakai `CSH-IN-*`/`CSH-OUT-*` dan ledger/report tetap membaca data.
- [ ] Buat Stock Adjustment masuk/keluar; pastikan stok, stock_adjustments, dan inventory_logs tetap satu transaction serta nomor `STK-ADJ-*` tidak dobel.
- [ ] Buat Production Order, start PO menjadi Work Log, buat Work Log manual, dan buat Payroll manual; pastikan kode `PO-*`, `JOB-*`, `PAY-*` final tidak dobel dan flow status/stok/HPP tetap sama.
- [ ] Simulasikan validasi gagal pada create yang memakai counter; counter tidak boleh maju bila transaction gagal setelah validasi/read transaction.
- [ ] Verifikasi Firestore Rules production mengizinkan read/write collection `business_code_counters` hanya untuk user/role internal yang boleh create transaksi/master terkait.


## Batch 16D — Production Planning dan Karyawan Produksi Counter

- [ ] Buat Production Planning baru; pastikan kode dan document ID berformat `PP-YYYYMMDD-0001`.
- [ ] Buat dua Production Planning berurutan; sequence harus naik dan tidak memakai random `addDoc` ID untuk data baru.
- [ ] Buat Karyawan Produksi baru; pastikan format kode tetap `DDMMYYYY-XXX` dan document ID baru sama dengan kode tersebut.
- [ ] Pastikan preview kode Karyawan Produksi hanya preview; nomor final tetap dikunci saat submit.
- [ ] Pastikan create Planning/Employee gagal validasi tidak meninggalkan dokumen bisnis partial.
- [ ] Pastikan `business_code_counters` berisi key `DAILY__PP__YYYYMMDD` dan `DAILY__EMP__DDMMYYYY` setelah create sukses.
- [ ] Pastikan Work Log/Payroll lama yang memakai employee ID lama tetap tampil dan tidak ikut dimigrasi otomatis.
- [ ] Verifikasi Firestore Rules production mengizinkan read/write `business_code_counters` untuk flow create Planning dan Karyawan Produksi.

## Batch 17A — Stock Report Partial Read Guard

- [ ] Buka Laporan Stok dalam kondisi normal; raw materials, products, semi finished, dan categories tetap tampil seperti sebelumnya.
- [ ] Simulasikan salah satu source gagal dibaca; laporan harus tetap menampilkan source lain yang berhasil dibaca dan warning area gagal.
- [ ] Pastikan warning tidak membuat export aktif terlihat seperti data lengkap jika ada source yang gagal.
- [ ] Export XLSX setelah filter aktif; data export harus sama dengan rows yang berhasil dibaca dan sedang difilter di UI.
- [ ] Pastikan tidak ada write ke stok, inventory log, transaksi, produksi, atau collection read model baru.

## Batch 17B — Dashboard / Stock Report Read Model Design & Foundation

### Design/docs only
- [ ] Pastikan docs membedakan **Stock Row Mapper** dari **Firestore Stock Read Model**.
- [ ] Pastikan docs historis Batch 17B diberi label `SUPERSEDED` untuk catatan lama yang menyebut Dashboard/Stock Report masih full-source.
- [ ] Pastikan docs status aktif menyatakan Dashboard dan Stock Report runtime terbaru memakai `stock_item_read_models` sebagai read path utama dengan fallback guarded.
- [ ] Pastikan docs menyatakan `stock_item_read_models` adalah derived read model, bukan source of truth stok.

### Foundation source
- [ ] Jalankan lint/build; pastikan penambahan `buildStockItemReadModelPayload()` dan `stockReadModelService.js` tidak memunculkan syntax/import error.
- [ ] Pastikan tidak ada import baru ke `stockReadModelService.js` dari Dashboard, Stock Report, Purchases, Sales, Returns, Stock Adjustment, Production, atau Reset/Maintenance pada Batch 17B foundation.
- [ ] Unit/manual check pure builder: Product non-varian menghasilkan `sourceType=product`, `sourceCollection=products`, dan threshold dari `minStockAlert`.
- [ ] Unit/manual check pure builder: Raw Material non-varian menghasilkan `sourceType=material`, `sourceCollection=raw_materials`, dan threshold dari `minStock`.
- [ ] Unit/manual check pure builder: Semi Finished menghasilkan `sourceType=semi_finished`, `sourceCollection=semi_finished_materials`, dan threshold dari `minStockAlert`.
- [ ] Unit/manual check item bervarian: varian kosong/rendah menghasilkan `hasStockIssue=true`, `affectedVariantCount > 0`, dan `affectedVariantEntries` terisi.
- [ ] Unit/manual check reserved overrun: `reservedStock > currentStock` menghasilkan `isReservedOverrun=true` dan `hasStockIssue=true`.
- [ ] Pastikan builder payload tidak menulis Firestore, tidak membuat inventory log, dan tidak mengubah master stock.

### Writer sync/backfill future guard
- [ ] Sebelum Dashboard/Stock Report switch, siapkan writer sync realtime untuk Purchases, Sales, Returns, Stock Adjustment, Production Work Logs, Production Orders/reservation, Master Data edit/toggle, dan Reset/Maintenance rebuild.
- [ ] Backfill/rebuild `stock_item_read_models` wajib punya preview jumlah dokumen, scope jelas, dan tidak mengubah master stock maupun `inventory_logs`.
- [ ] Batch 17C menyediakan audit/rebuild manual; pastikan tetap dianggap backfill, bukan realtime writer sync.
- [ ] Setelah backfill, bandingkan sample Dashboard old mapper vs `stock_item_read_models`; status `Habis/Kritis/Normal`, available stock, threshold, dan variant summary harus sama.
- [ ] Firestore Rules production wajib mengizinkan read/write collection baru sesuai role yang disetujui; rules tidak ada di ZIP frontend.
- [ ] Buat composite index yang diminta Firebase untuk query issue/read report; jangan fallback ke full scan permanen.

### Export/paging active guard
- [ ] Buka Stock Report; pastikan page awal dari read model tampil dan tombol load more muncul jika masih ada data.
- [ ] Export XLSX; pastikan export mencoba semua matching filter via paging batch dan memberi disclosure jika fallback/limit terjadi.
- [ ] Pagination Stock Report tidak boleh membuat item kritis hilang dari export/summary yang sedang difilter.


## Batch 17C — Stock Read Model Backfill/Audit Maintenance

### Service audit/rebuild
- [ ] Jalankan syntax/build check; pastikan `stockReadModelMaintenanceService.js`, `useResetMaintenanceRepairs.js`, `ResetMaintenanceData.jsx`, dan `ResetSafeRepairPanel.jsx` tidak error import/JSX.
- [ ] Jalankan Cek Read Model Stok dari Reset Maintenance; pastikan summary menampilkan master checked, missing, stale, dan orphan/manual review.
- [ ] Jika `stock_item_read_models` kosong, audit harus menampilkan missing sesuai jumlah master stock aktif dari `products`, `raw_materials`, dan `semi_finished_materials`.
- [ ] Jalankan Rebuild Read Model Stok; pastikan hanya collection `stock_item_read_models` yang bertambah/ter-update.
- [ ] Setelah rebuild, jalankan Cek Read Model Stok ulang; missing/stale harus turun menjadi 0 untuk data yang sukses ditulis.
- [ ] Pastikan orphan read model hanya tampil sebagai manual review dan tidak dihapus otomatis.

### Guard data integrity
- [ ] Pastikan rebuild tidak mengubah `products`, `raw_materials`, `semi_finished_materials`, `inventory_logs`, sales, purchases, returns, production, payroll, HPP, finance, route/menu, atau role guard.
- [ ] Pastikan maintenance log mencatat `actionType=stock_read_model_rebuild`, affected collection `stock_item_read_models`, jumlah repaired, dan manual review/orphan count.
- [ ] Pastikan Dashboard tetap membaca source lama dan tampilan tidak berubah setelah patch ini.
- [ ] Pastikan Stock Report tetap membaca source lama dan export contract tidak berubah setelah patch ini.
- [ ] Pastikan Firestore Rules production sudah mengizinkan admin/maintenance menulis `stock_item_read_models`; rules tidak ada di ZIP frontend.

### Future switch guard
- [ ] Jangan switch Dashboard ke `stock_item_read_models` sebelum writer sync realtime semua jalur mutasi stok disiapkan.
- [ ] Jangan switch Stock Report ke `stock_item_read_models` sebelum paging/export semua matching filter disetujui.
- [ ] Setelah writer sync future selesai, bandingkan sample row dari old mapper vs read model: status, available stock, threshold, variant summary, dan issue flag harus sama.

## Checklist P2 — Jumbo File Split Behavior-Preserving

### P2-A/P2-B — Production Work Logs UI split
- [ ] Buka halaman Production Work Logs dan pastikan list/table tetap tampil.
- [ ] Klik detail Work Log dan pastikan drawer detail tampil sama: status, referensi PO/BOM, ringkasan biaya, material usage, output, labor, overhead, dan catatan.
- [ ] Tambah/edit Material Usage dan pastikan field item type, item, varian, qty, unit, cost snapshot, dan notes tetap tersimpan ke form utama.
- [ ] Tambah/edit Output dan pastikan output type, item, varian, good qty, cost per unit, unit, dan notes tetap tersimpan ke form utama.
- [ ] Complete Work Log dan pastikan operator, good qty, auto payroll, posting stok output, HPP, dan inventory log tetap berjalan seperti sebelum split.
- [ ] Pastikan tidak ada perubahan behavior create/edit/complete Work Log, payroll, HPP, reserved stock, atau inventory log.

### P2-C — Reset Maintenance orchestration split
- [ ] Buka Reset Maintenance dan pastikan panel Auto Detect, Safe Repair, Export, Preview, Danger Zone, dan Usage Guide tetap tampil.
- [ ] Jalankan audit read-only dan pastikan ringkasan serta detail kategori tetap muncul.
- [ ] Jalankan preview reset sebelum destructive action dan pastikan keyword/confirmation guard tetap wajib.
- [ ] Pastikan tombol repair tetap terkunci sampai audit punya kandidat, dan destructive reset service tidak berubah.

### P2-D — Purchases UI split
- [ ] Buka Purchases dan pastikan tabel, filter, aksi detail/edit, dan modal tambah pembelian tetap tampil.
- [ ] Buat pembelian bahan baku non-varian, bahan baku varian, dan produk jadi. Pastikan stok masuk, inventory log `purchase_in`, dan expense tetap terbentuk.
- [ ] Uji supplier catalog/prefill dan pastikan tidak berubah.
- [ ] Upload OCR Shopee, apply qty/biaya, lihat preview/detail OCR, dan pastikan parser/notes/print behavior tetap sama.
- [ ] Pastikan average cost, purchase saving, expense payload, dan create purchase transaction tetap dari service existing.

### P2-E — Service helper/config split guarded
- [ ] Complete Work Log existing dan pastikan helper split tidak mengubah HPP/output/payroll/stock posting.
- [ ] Jalankan flow reset maintenance yang biasa dipakai dan pastikan allowlist/config reset tetap sama.
- [ ] Pastikan tidak ada helper baru yang mengambil alih business logic destructive atau transaction utama.



## Checklist Batch Merge 1-8 — rebase patch gabungan — 2026-05-23

- [ ] `npm run build` berhasil setelah patch gabungan diterapkan.
- [ ] Dashboard tetap read-only: Stok Kritis, Audit Stok, Restock Assistant, dan summary planning tampil tanpa auto-create/auto-fix.
- [ ] Stock Report tetap menampilkan raw materials, products, semi finished, dan export XLSX mengikuti filter aktif; jika ada failedReads, UI/export menandai partial read.
- [ ] Reset & Maintenance tidak white screen setelah hook individual lama dihapus.
- [ ] Preview Export, Export Master, dan Export Checklist berjalan dari `useMasterDataExport` tanpa menjalankan reset/delete/repair.
- [ ] Cek Semua menjalankan audit Data Quality, HPP, Master Code, Stok, Inventory Log, Legacy, Produksi, Payroll, Variant Transaksi, dan Side-Effect Transaksi.
- [ ] Repair Side-Effect Transaksi terkunci sampai Cek Side-Effect dijalankan dan hanya berjalan setelah keyword `REPAIR TRANSAKSI` benar.
- [ ] Setelah Repair Side-Effect, cek ulang Cash In, Cash Out, Stock Management/inventory log, Sales Report, Purchases Report, dan Profit Loss.
- [ ] Return tetap stock-only + inventory log; tidak muncul refund/cash otomatis.
- [ ] Sales tetap no-cancel user-facing; barang kembali/koreksi tetap lewat Return.
- [ ] Firestore Rules/index tidak berubah dari patch ini; validasi manual di Firebase Console tetap diperlukan.


## Batch 25–27 — Final QA & Stabilization Sweep

### Lint/build blocker cleanup
- [ ] Jalankan `npm run lint` setelah semua ZIP changed-files-only diextract.
- [ ] Jalankan `npm run build` setelah `npm install` di environment lokal agar optional dependency Rollup sesuai platform terpasang.
- [ ] Pastikan tidak ada `no-undef`, `no-unused-vars`, duplicate props, duplicate import, atau helper export yang tertinggal setelah split helper Batch 18–24.
- [ ] Jika build gagal karena `@rollup/rollup-*-*` optional dependency, jalankan `npm install` ulang di project root lokal sebelum menyimpulkan source error.

### Docs/source final conflict cleanup
- [ ] Pastikan docs tidak lagi menyebut Dashboard/Stock Report full-source sebagai status aktif normal.
- [ ] Pastikan catatan lama Batch 17A/17B diberi label `SUPERSEDED` oleh Batch 17N–18F.
- [ ] Pastikan `stock_item_read_models` tetap dijelaskan sebagai derived read model, bukan source of truth stok.
- [ ] Pastikan status helper split Batch 18–24 tertulis sebagai behavior-preserving dan tidak mengubah transaction/write flow.

### Large file audit
- [ ] Review kandidat file besar: ProductionBoms, ProductionOrders, SemiFinishedMaterials, ProductionWorkLogs page, Purchases page, Dashboard page, resetMaintenanceDataService, productionWorkLogsService.
- [ ] Tandai kandidat split lanjutan sebagai `CLEANUP CANDIDATE`, bukan langsung refactor business logic.
- [ ] Jangan split transaction/write block produksi/reset/purchase/payroll tanpa approval eksplisit.

### UI consistency QA pass
- [ ] Dashboard: cek light/dark mode, empty/loading/error state, KPI stock issue `+`, restock assistant, dan tidak ada technical Firestore ID noise.
- [ ] Stock Report: cek load more, filter, export, warning partial/limited, variant display, dan fallback message.
- [ ] Raw Materials/Purchases/Supplier Purchases: cek supplier/restock label, OCR receipt preview, compact table, dan no double scroll berlebihan.
- [ ] Production Orders/Work Logs/BOM/Semi Finished/Employees: cek status tag, modal/detail, HPP/payroll display, dan action guard.
- [ ] Reset Maintenance/Data Quality Audit: cek destructive wording, keyword guard, manual review wording, and derived cleanup scope.

### Final guarded regression checklist
- [ ] Purchase stock-in, expense, inventory log, and read model sync tetap berjalan.
- [ ] Sales stock-out dan income saat selesai tetap sesuai rule aktif.
- [ ] Return tetap stock-only sesuai rule aktif.
- [ ] Production Work Log complete tetap posting material/output stock, HPP, payroll accrual, inventory log, and read model sync.
- [ ] Reset destructive tetap mematuhi protected collection/keyword/baseline guard.


## Offline DB Foundation + Backup + Contract checklist — 2026-05

### Smoke test foundation
- [ ] Jalankan `npm install`, `npm run lint`, dan `npm run build` setelah patch diextract ke repo lengkap.
- [ ] App tetap login dan berjalan memakai Firebase seperti sebelumnya.
- [ ] Tidak ada route/menu baru setelah foundation offline DB.
- [ ] Tidak ada flow stock, purchase, sales, return, production, payroll, HPP, finance, reset, atau report yang berubah.
- [ ] DevTools Browser > Application > IndexedDB dapat menampilkan DB `ims_bunga_flanel_offline` setelah helper foundation dipanggil manual.
- [ ] Table awal tersedia: `app_meta`, `local_profiles`, `sync_queue`, `sync_conflicts`, `audit_logs`, `categories`, `customers`, `suppliers`.

### Backup export/restore foundation
- [ ] `exportLocalDbBackup()` menghasilkan JSON dengan `app = IMS Bunga Flanel`.
- [ ] `type = offline-local-db-backup`.
- [ ] `schemaVersion` sama dengan versi schema lokal.
- [ ] JSON invalid ditolak.
- [ ] App/type/schemaVersion yang salah ditolak.
- [ ] Table di luar allowlist ditolak.
- [ ] `previewLocalDbBackupRestore()` hanya preview dan tidak menulis data.
- [ ] `restoreLocalDbBackup()` hanya restore table foundation allowlist.
- [ ] Restore membuat audit log lokal `module = local_db_backup`, `action = restore`.
- [ ] Restore tidak menyentuh transaksi/stock/production/payroll/HPP/finance.

### Database Contract
- [ ] `docs/10_OFFLINE_DATABASE_CONTRACT.md` tersedia.
- [ ] Batch berikutnya mengikuti urutan kontrak: repository pilot master data rendah risiko dulu.
- [ ] Tidak ada sync otomatis ke Firebase dari `sync_queue`.
- [ ] Reset/Maintenance destructive tidak ikut berubah dari batch ini.


## Repository Pilot Batch 4 checklist — 2026-05

- [ ] `npm run lint` bersih setelah patch di-merge.
- [ ] `npm run build` bersih setelah patch di-merge.
- [ ] App tetap berjalan sebagai Firebase-first.
- [ ] Customers page tetap memakai `customersService` existing dan tidak berubah runtime.
- [ ] Categories page tetap memakai flow existing dan tidak berubah runtime.
- [ ] SupplierPurchases page tetap memakai flow existing dan tidak berubah runtime.
- [ ] Import repository baru tidak menghasilkan circular dependency.
- [ ] `categoriesRepository.listCategories({ mode: "firebase_primary" })` bisa membaca Firebase saat diuji manual/dev.
- [ ] `customersRepository.listCustomers({ mode: "firebase_primary" })` tetap mengikuti `customersService`.
- [ ] `suppliersRepository.listSuppliers({ mode: "firebase_primary" })` bisa membaca supplier catalog.
- [ ] Supplier create/update/delete via Firebase repository masih intentionally blocked sampai flow SupplierPurchases diekstrak.
- [ ] Dexie mode local untuk categories/customers/suppliers tidak menulis ke Firebase.
- [ ] Delete Dexie default memakai tombstone `_deleted`, bukan hard delete.
- [ ] Tidak ada perubahan stock, purchase, sales, returns, production, payroll, HPP, finance, reset, route/menu, role guard.


## Offline Sync Queue pilot checklist — 2026-05

### Source/runtime guard
- [ ] `npm run lint` dan `npm run build` tetap sukses.
- [ ] App tetap berjalan Firebase-first.
- [ ] Tidak ada route/menu baru.
- [ ] Categories, Customers, dan SupplierPurchases runtime lama tetap berjalan.
- [ ] Stock, purchase, sales, returns, finance, production, payroll, HPP, dan reset tidak berubah.

### Sync queue local pilot
- [ ] `createCategory(..., { mode: "offline_local" })` membuat record lokal dan item `sync_queue` pending.
- [ ] `updateCategory(..., { mode: "offline_local" })` membuat item queue operation `update`.
- [ ] `deleteCategory(..., { mode: "offline_local" })` membuat tombstone `_deleted` dan item queue operation `delete`.
- [ ] `listPendingSyncQueueItems()` hanya menampilkan item `pending`.
- [ ] `getSyncQueueSummary()` menghitung byStatus dan byCollection.
- [ ] Queue menolak collection di luar `categories`, `customers`, dan `suppliers`.
- [ ] Queue menolak operation di luar `create`, `update`, dan `delete`.
- [ ] Tidak ada push otomatis ke Firebase setelah item masuk queue.

### Mode guard
- [ ] `setRepositoryModeForDevelopment("offline_local")` tanpa confirmation harus error.
- [ ] Confirmation yang valid hanya `ENABLE OFFLINE REPOSITORY PILOT`.
- [ ] `hybrid_sync` tetap ditolak.
- [ ] `resetRepositoryModeToFirebasePrimary()` mengembalikan mode ke `firebase_primary`.


## Offline Sync Dev Panel checklist — 2026-05

### Smoke test UI
- [ ] Buka Testing & Reset Center.
- [ ] Panel `Offline Sync Dev Panel` tampil tanpa route/menu baru.
- [ ] Klik `Siapkan Local DB`; IndexedDB `ims_bunga_flanel_offline` siap.
- [ ] Klik `Refresh Preview`; panel menampilkan mode repository, queue pending, dan konflik aktif.
- [ ] Tanpa keyword, `Aktifkan Offline Pilot` harus gagal.
- [ ] Dengan keyword `ENABLE OFFLINE REPOSITORY PILOT`, mode repository menjadi `offline_local`.
- [ ] Klik `Kembali ke Firebase Primary`; mode kembali `firebase_primary`.

### Manual sync guard
- [ ] Tanpa keyword, `Sync Manual ke Firebase` harus gagal.
- [ ] Dengan keyword `SYNC MASTER DATA PILOT TO FIREBASE`, sync hanya memproses queue categories/customers.
- [ ] Queue suppliers harus gagal/blocked dengan pesan guarded.
- [ ] Delete queue tidak boleh menghapus Firebase dari panel Batch 8.
- [ ] Create yang menemukan dokumen Firebase existing harus menjadi `conflict`, bukan overwrite.
- [ ] Update yang dokumen Firebase-nya hilang harus menjadi `conflict`, bukan create diam-diam.
- [ ] Konflik tampil di tabel konflik panel.
- [ ] Local audit log `module = local_db_sync` dibuat untuk hasil sync.

### Regression guard
- [ ] Login tetap normal.
- [ ] Dashboard tetap normal.
- [ ] Categories/Customers/SupplierPurchases runtime lama tetap normal.
- [ ] Stock/purchase/sales/returns/finance/production/payroll/HPP tidak berubah.
- [ ] Tidak ada auto-sync saat halaman dibuka.


## Offline Batch 10/11/12 combined checklist — 2026-05

### White screen/import guard
- [ ] Buka `/utilities/reset-maintenance-data` tanpa white screen.
- [ ] Console browser tidak menampilkan `does not provide an export named createSyncConflict`.
- [ ] `npm run lint` sukses.
- [ ] `npm run build` sukses.

### Conflict resolver
- [ ] Tabel konflik aktif tampil bila ada data di `sync_conflicts`.
- [ ] Resolve tanpa keyword `RESOLVE MASTER DATA CONFLICT` harus gagal.
- [ ] `mark_skipped` menandai konflik resolved tanpa menulis Firebase.
- [ ] `remote_wins` memperbarui local DB dari payload remote.
- [ ] `local_wins` menulis payload local ke Firebase hanya untuk categories/customers.
- [ ] Konflik supplier/stock/transaksi/production/payroll/HPP ditolak.
- [ ] Konflik delete hanya boleh `mark_skipped`.

### Offline Master Data Pilot
- [ ] Panel `Offline Master Data Pilot` tampil di Testing & Reset Center.
- [ ] `Muat Data Local` menyiapkan IndexedDB dan menampilkan categories/customers local.
- [ ] Create category local menambah record dan item `sync_queue` pending.
- [ ] Update category local menambah item `sync_queue` update.
- [ ] Delete category local membuat tombstone dan item `sync_queue` delete.
- [ ] Customer pilot wajib punya ID/kode lokal.
- [ ] Manual sync tetap harus dijalankan dari `Offline Sync Dev Panel` dengan keyword terpisah.
- [ ] Page aktif Categories/Customers/SupplierPurchases tetap berjalan seperti sebelumnya.
- [ ] Stock, purchase, sales, returns, finance, production, payroll, HPP, reset destructive, route/menu, dan role guard tidak berubah.
