# BUSINESS RULES — IMS Bunga Flanel

Dokumen ini merangkum aturan bisnis yang terlihat langsung dari implementasi aplikasi saat diaudit.

## 1. Rule Pembelian

### 1.1 Scope item pembelian
Pembelian bisa dilakukan untuk:
- bahan baku
- produk jadi

### 1.2 Konversi unit bahan baku
Untuk bahan baku, quantity pembelian bisa memakai unit beli yang dikonversi ke unit stok.

Rumus yang dipakai:
- `totalStockIn = quantity × conversionValue`

Rule satuan stok aktif:
- Satuan stok operasional memakai nilai bulat, termasuk bahan berbasis `meter`; input Qty Beli, Stok Masuk, dan Stock Adjustment tidak membuka decimal baru.
- Jangan menambahkan satuan `cm` untuk flow stok saat ini karena operasional IMS memakai pembelian/produksi per `meter`.
- Inventory log baru dari purchase, sales, return, stock adjustment, dan production wajib membawa snapshot `stockUnit`/`unit` jika tersedia agar Qty di Stock Management terbaca sebagai `10 pcs` atau `10 meter`, bukan angka polos.
- Untuk log produksi, metadata `productionOrderCode`, `workNumber`, dan `stepName` wajib menjadi sumber kolom **Referensi Audit**. Kolom **Catatan** tidak boleh mengulang PO/Work Log/Step; catatan cukup menampilkan operator atau catatan manual produksi.
- Data historis yang belum punya satuan tetap boleh tampil tanpa satuan; jangan backfill/migrasi otomatis hanya untuk display.

### 1.3 Actual purchase dan actual unit cost
Total pembelian aktual dihitung dari:
- subtotal item
- ongkir
- diskon ongkir
- voucher/koin/potongan marketplace
- service fee

Actual unit cost per stock unit dihitung dari:
- `actualUnitCost = totalActualPurchase / totalStockIn`

### 1.4 Reference purchase dan saving
Pembelian bahan baku membandingkan biaya aktual dengan harga referensi restock.

Rumus:
- `totalReferencePurchase = totalStockIn × restockReferencePrice`
- `purchaseSaving = totalReferencePurchase - totalActualPurchase`

Status saving:
- `hemat` jika positif
- `lebih_mahal` jika negatif
- `normal` jika nol

### 1.5 Efek pembelian
Saat pembelian disimpan:
- backend menetapkan status final canonical `Selesai`; payload operasional tidak boleh membuat Purchase berstatus draft, cancel, inactive, atau deleted
- simpan transaksi ke `purchases`
- tambah stok item
- untuk Bahan Baku, hitung `averageActualUnitCost` dengan weighted average dari nilai stok lama dan total biaya aktual pembelian per satuan stok masuk
- `restockReferencePrice` tetap harga acuan/manual dan tidak boleh ditimpa otomatis oleh modal transaksi
- pembaruan modal, stok, katalog supplier, `inventory_logs`, expense, ledger, dan audit wajib berada dalam transaction SQLite yang sama
- catat `inventory_logs` dengan type `purchase_in`
- buat pengeluaran otomatis ke `expenses`

### 1.6 Catatan penting pengeluaran pembelian
Saving pembelian **ditampilkan sebagai informasi efisiensi**, bukan pengurang langsung nilai kas keluar. Nilai kas keluar tetap `totalActualPurchase`.

### 1.7 OCR Shopee pembelian
OCR Shopee hanya alat bantu draft untuk membaca Qty Beli dan komponen biaya marketplace. OCR tidak boleh langsung menyimpan purchase, mengubah supplier/item/satuan/konversi, menambah stok, membuat expense, atau menyimpan gambar screenshot.

Guard aktif:
- Hasil OCR wajib muncul sebagai preview dan user tetap klik **Terapkan Qty & Biaya ke Form** sebelum Simpan Pembelian.
- OCR Shopee wajib memperlakukan `Koin Shopee Ditukarkan/Digunakan` sebagai bagian dari `voucherDiscount` karena koin mengurangi total cash-out marketplace.
- OCR tidak boleh auto-set tanggal pembelian dari tanggal pengiriman/diterima; tanggal transaksi tetap input manual sampai ada rule tanggal order/pembayaran yang disetujui.
- Jika OCR mendeteksi kemungkinan multi-item dalam 1 screenshot, auto-apply diblokir. User harus input manual atau memecah pembelian per item agar modal, stok, expense, dan HPP tidak tercampur.
- Jika total pesanan tidak cocok dengan rumus sistem atau marker Shopee kurang kuat, user wajib melihat warning/konfirmasi sebelum hasil OCR boleh diterapkan.
- Catatan transaksi menyimpan ringkasan OCR teks saja; bukti screenshot tidak disimpan di database/storage lama maupun folder project.
- Popup detail OCR bersifat tampilan audit/read-only. Tombol Print hanya mencetak struk OCR tanpa mengubah data transaksi.

## 1A. Kategori & Kelompok Master

Kategori master memakai satu tabel dengan scope yang terpisah:
- `product_form` untuk **Bentuk Produk** seperti Bouquet atau Bunga Tangkai;
- `flower_type` untuk **Jenis Bunga** seperti Mawar atau Tulip;
- `raw_material_group` untuk **Kelompok Bahan** seperti Kain Flanel, Kawat, atau Kemasan;
- `semi_finished_group` untuk **Kelompok Komponen** sebagai metadata pencarian/laporan.

Rule aktif:
- Struktur kategori maksimal dua tingkat: kategori utama → subkategori.
- Nama kategori unik secara case-insensitive pada scope dan parent yang sama.
- Produk, bahan, dan komponen memilih kategori paling spesifik melalui `categoryId`.
- Nama kategori pada record item hanya snapshot compatibility; tampilan terbaru mengutamakan master berdasarkan `categoryId`.
- Kategori yang masih digunakan atau masih memiliki child tidak boleh dinonaktifkan.
- Warna, ukuran, jumlah tangkai, satuan pembelian, dan nilai konversi bukan kategori.
- Kategori tidak menentukan harga, Pricing Rule, stok minimum, BOM, HPP, atau flow produksi.
- Pada Semi Finished, field `category` lama tetap berarti **Jenis Komponen** (`pola`, `kelopak`, `daun`, `kawat`, `lainnya`) untuk logic produksi. `semi_finished_group` hanya metadata pengelompokan dan tidak boleh menggantikan field tersebut.

Konversi pembelian tetap mengikuti transaksi:
- purchase menyimpan Qty Beli, Satuan Beli, nilai konversi, dan hasil Stok Masuk;
- inventory, BOM, dan stock report memakai satuan stok dasar;
- kategori tidak menyimpan atau menggandakan rule konversi unit.

## 2. Rule Penjualan

### 2.1 Scope item penjualan
Penjualan bisa menjual:
- produk jadi
- bahan baku

### 2.2 Validasi stok
Sebelum penjualan disimpan, stok item harus cukup.

### 2.2A UX pemilihan item dan referensi channel
- Form Penjualan tetap boleh menjual produk jadi dan bahan baku, tetapi UI wajib memisahkan pilihan Jenis Item agar dua sumber item tidak tercampur dalam satu dropdown panjang.
- Pilihan Jenis Item hanya untuk filter UI; payload final sale tetap menyimpan `collectionName`, `itemId`, `itemName`, `typeLabel`, `variantKey`, `variantLabel`, dan `stockSourceType` sesuai flow aktif.
- `referenceNumber` bersifat opsional dan relevan untuk channel online/marketplace seperti Shopee, Tokopedia, TikTok Shop, Lazada, Instagram, dan Lainnya.
- Offline dan WhatsApp tidak wajib memakai resi/order/reference; saat channel berubah ke Offline/WhatsApp, field reference harus dikosongkan dan tidak aktif.
- WhatsApp hanya dianggap non-reference channel; jangan otomatis mengubah status/income timing WhatsApp menjadi Offline tanpa keputusan business rule terpisah.

### 2.3 Efek saat penjualan dibuat
Saat transaksi penjualan disimpan:
- simpan transaksi ke `sales`
- stok langsung dikurangi
- catat `inventory_logs` dengan type `sale`

### 2.4 Pengakuan pemasukan kas
Pemasukan kas **tidak selalu dicatat saat sale dibuat**.

Rule yang terlihat:
- pemasukan ke `incomes` hanya dibuat jika status transaksi adalah `Selesai`
- jika transaksi dibuat dengan status selain `Selesai`, income belum dicatat
- jika nanti status diubah ke `Selesai`, income dibuat jika belum ada

### 2.5 Barang kembali / transaksi tidak jadi
Sales tidak memiliki flow cancel user-facing. Status aktif Sales hanya `Diproses`, `Dikirim`, dan `Selesai`.

Jika barang kembali, pembeli batal setelah transaksi tercatat, atau perlu koreksi stok atas penjualan, user wajib memakai modul **Return** agar dokumen return, stok masuk, dan `inventory_logs` type `return_in` tetap auditable.

### 2.6 Sales no-cancel dan hard delete bukan flow operasional

=====================================================
SECTION: Sales no-cancel and no hard-delete user action — AKTIF / GUARDED
Fungsi:
- Mengunci bahwa Sales tidak menyediakan aksi batal/delete user-facing.
- Mengarahkan barang kembali ke modul Return sebagai flow resmi.

Dipakai oleh:
- `src/pages/Transaksi/Sales.jsx`, `src/services/Transaksi/salesService.js`, laporan Sales, Cash In auto income, Return, dan audit `inventory_logs`.

Alasan perubahan:
- Cancel langsung dari Sales membuat stok, income, dan audit bercabang. Return lebih jelas karena membuat dokumen koreksi tersendiri.

Catatan cleanup:
- Hard delete, jika suatu hari diperlukan, harus menjadi maintenance flow guarded dengan approval dan audit trail.

Risiko:
- Menghidupkan kembali aksi batal/delete Sales sebagai aksi user dapat menyembunyikan transaksi, memutus audit stok, dan mengacaukan income/report.
=====================================================

Rule aktif:
- Sales dibuat melalui transaction yang mengurangi stok dan mencatat `inventory_logs` type `sale`.
- Income hanya dibuat saat Sales berstatus `Selesai`.
- Barang kembali wajib masuk lewat Return, bukan mengubah Sales menjadi status batal.
- Hard delete Sales tidak tersedia untuk user biasa dan tidak boleh ditambahkan sebagai tombol/handler baru.

## 3. Rule Retur
Saat retur disimpan:
- user wajib memilih transaksi Sales yang valid
- item retur wajib berasal dari item pada Sales tersebut
- qty retur tidak boleh melebihi qty terjual dikurangi qty yang sudah pernah diretur
- transaksi masuk ke `returns` dengan `relatedSaleId` dan `saleReference`
- backend menetapkan status Return canonical `Selesai`; client tidak boleh membuat Return draft, cancel, atau deleted
- payload `refundAmount`/`refundTotal` ditolak karena Return operasional tidak boleh membuat expense/ledger otomatis
- stok item/varian bertambah lewat endpoint resmi
- catat `inventory_logs` dengan type `return_in`
- tidak membuat `incomes`, `revenues`, atau `expenses`

Rule aktif Return adalah **stock-only correction yang terkait Sales**. Return dipakai untuk barang kembali/koreksi stok setelah Sales tercatat, bukan untuk refund/finance otomatis. Jika suatu hari refund, potongan pembayaran, atau koreksi kas atas Return diperlukan, itu wajib menjadi rule finance Return terpisah dengan review guarded, idempotency, dan update ledger/report.

## 4. Rule Kas Masuk
Modul Cash In membaca dua sumber:
- `revenues` untuk pemasukan manual
- `incomes` untuk pemasukan yang berasal dari penjualan selesai

Pemasukan manual baru disimpan ke `revenues` agar kompatibel dengan laporan lama.

## 5. Rule Kas Keluar
Modul Cash Out membaca `expenses`.

Buku Besar Kas dan Profit/Loss membaca pergerakan uang dari `revenues`, `incomes`, dan `expenses`. Collection `returns` tidak dibaca sebagai sumber finance karena Return aktif belum memiliki side-effect refund/kas.

Sumber pengeluaran aktif:
- pembelian otomatis dari modul purchases
- payroll produksi otomatis saat line payroll ditandai `paid`
- pengeluaran manual dari halaman cash out

Expense otomatis wajib memiliki source reference agar tidak double:
- `sourceModule`
- `sourceId`
- `sourceRef` jika tersedia
- `sourceType` jika auto-generated
- `createdByAutomation` jika dibuat sistem

## 6. Rule Laporan Pembelian
Laporan pembelian membaca `expenses`, bukan `purchases` langsung.

Implikasi:
- laporan pembelian mengikuti aliran pengeluaran yang benar-benar diakui
- pembelian yang tidak membuat expense tidak akan muncul di laporan ini

## 7. Rule Laporan Laba Rugi
Laporan laba rugi menggabungkan:
- `revenues`
- `incomes`
- `expenses`

Perhitungan:
- semua `revenues` + `incomes` dianggap pemasukan
- semua `expenses` dianggap pengeluaran
- laba kotor = total pemasukan - total pengeluaran

## 8. Rule Stok

### 8.1 Field stok aktif
Codebase memperlihatkan dua lapis field stok:
- lama: `stock`
- baru: `currentStock`, `reservedStock`, `availableStock`

### 8.2 Helper update stok umum
`inventoryService.updateInventoryStock()` adalah helper aktif untuk mutasi stok umum. Helper ini wajib menjaga sinkronisasi:
- `stock`
- `currentStock`
- `reservedStock`
- `availableStock`
- `variants[]` untuk item bervarian

### 8.3 Konsekuensi penting
Kalau ada modul yang mengubah hanya `stock`, ada risiko sinkronisasi tidak penuh terhadap modul baru yang membaca `currentStock`, `reservedStock`, `availableStock`, dan `variants[]`.

## 9. Rule Produksi Umum
Flow produksi final yang terlihat di codebase adalah:
- BOM
- Production Order
- Work Log
- Payroll
- HPP Analysis

Catatan service bahkan menyebut:
- flow aktif: `BOM -> PO -> Start Production -> Work Log -> Complete`
- reserve/release dipertahankan untuk kompatibilitas lama, bukan flow utama

## 10. Rule BOM
- target BOM bisa `product` atau `semi_finished_material`
- bila target BOM adalah `product`, material utama sebaiknya berasal dari `semi_finished_material`, tetapi `raw_material` tetap boleh untuk bahan assembly/consumable seperti lem tembak
- BOM menyimpan material lines dan step lines
- Estimasi biaya BOM dihitung otomatis dari master cost aktif, upah dari tarif Tahapan Produksi, dan overhead manual dari input BOM.
- Source estimasi material BOM aktif:
  - Raw Material: `averageActualUnitCost` dari purchase weighted average, fallback `restockReferencePrice` jika modal aktual belum ada.
  - Semi Finished: `averageCostPerUnit` hasil produksi sebelumnya, fallback `lastProductionCostPerUnit`. Untuk item bervarian, `averageCostPerUnit` master wajib weighted by stock varian jika ada stok varian. Jika semua stok varian 0, fallback read-model hanya boleh memakai varian aktif yang punya cost > 0 atau `lastProductionCostPerUnit`; jangan membagi rata dengan varian kosong/cost 0 karena HPP turunan akan turun palsu. Field reference/manual semi finished tidak menjadi source estimasi aktif agar HPP turunan tetap jujur.
- Untuk produksi bertingkat, bahan/input Semi Finished wajib memakai HPP master Semi Finished dari step sebelumnya. Sistem tidak boleh menghitung ulang ke raw material awal di step berikutnya.
- Snapshot BOM/PO tidak boleh menjadi source aktif Work Log baru. Saat Start Production, sistem mengambil master cost aktif lalu membekukannya sebagai snapshot actual material yang dipakai saat Complete agar biaya tidak berubah setelah stok bahan sudah dipotong.
- Overhead manual BOM saat ini hanya estimasi/referensi rencana, bukan source of truth HPP final. HPP final tetap dari Work Log completed dan payroll final.

## 11. Rule Production Order
- PO dibentuk dari BOM.
- Source of truth internal create PO tetap `bomId`; target/family/category di drawer create hanya alat bantu UI untuk memfilter pilihan.
- PO menghitung requirement bahan otomatis dari BOM/helper requirement final.
- status utama yang terlihat: `shortage`, `ready`, `in_production`.
- ada dukungan strategi varian material: `inherit`, `fixed`, `none`.
- Untuk target `product`, UI create PO menampilkan `Produk yang dibuat`; filter `Jenis Bunga / Product Family` dan `Kategori Bahan` tidak wajib/tidak ditampilkan bila source product tidak memakai field tersebut.
- Untuk target `semi_finished_material`, UI create PO boleh menampilkan filter UI-only `Jenis Bunga / Product Family` dan `Kategori Bahan` sebelum `Bahan yang dibuat`, supaya user tidak memilih dari daftar bahan yang terlalu panjang.
- Field `Resep Produksi` hanya perlu tampil jika target punya lebih dari satu resep aktif; jika hanya satu resep aktif, `bomId` boleh dipilih otomatis secara internal.
- Label user-facing target produksi tidak perlu menampilkan kode internal master item atau jumlah BOM; kode internal tetap disimpan pada data untuk relasi/backstage.
- Filter UI-only production order tidak boleh disimpan ke database, tidak boleh membuat schema baru, dan tidak boleh mengubah payload bisnis selain memastikan `bomId` valid.

## 12. Rule Work Log
Work Log adalah realisasi kerja produksi dari Production Order. Flow aktif yang dipakai UI adalah **BOM → Production Order → Mulai Produksi → Work Log → Complete**.

Rule final:
- Work Log baru dibuat lewat tombol **Mulai Produksi** di menu Production Order.
- Menu Work Log Produksi tidak menyediakan tombol tambah manual.
- Flow input aktif hanya dari Production Order. `sourceType: manual` / `planned` tidak boleh dipakai untuk data baru.
- Jangan menambahkan kembali Work Log manual tanpa review khusus karena bisa memutus contract 1 PO = 1 Work Log, stok, payroll, dan HPP.

Data inti yang direkam:
- material usage
- outputs
- worker
- step
- target
- planned qty dan actual qty
- good / reject / rework / scrap
- labor cost / total cost
- monitoring miss dan output teoretis

## 12A. Rule Guarded Logic Produksi
Setelah flow produksi aktif tervalidasi, area berikut harus dianggap locked / guarded:
- status flow utama: `ready` / `shortage` / `in_production` / `completed`
- contract 1 PO = 1 Work Log
- Start Production memotong stok bahan dari requirement PO, tetapi biaya material wajib dihydrate dari master cost aktif saat Start/Complete
- Complete Work Log menambah stok output dan menutup PO
- Work Log completed tidak boleh diedit sembarangan tanpa evaluasi khusus
- Tidak ada aksi cancel aktif di halaman Work Log; completed/in-progress dijaga oleh flow Production Order dan guard service

Implikasi:
- patch UI tidak boleh mengubah field inti work log / PO setelah flow aktif berjalan
- perubahan helper shared / refactor presentational tidak boleh mengubah sourceType, link PO, target, step, material usage yang sudah ter-posting, atau output yang sudah ter-posting

## 13. Rule Payroll Produksi
Payroll produksi dibangun dari work log completed.

## 14. Rule Maintenance Data
Reset destructive/testing lama tidak tersedia di UI operasional. Jalur maintenance aktif adalah:
- Backup & Restore resmi.
- Audit & Health read-only.
- Repair Data Turunan khusus `stock_read_models`.
- Export Data Master read-only.
- Checklist dan Riwayat resmi.

Audit & Health memeriksa integrity SQLite, foreign key, invariant stok, stock read model, registry backup, dan rekonsiliasi kas-ledger. Total issue dihitung penuh, sedangkan contoh UI boleh dibatasi dan harus ditandai bila terpotong. Rekonsiliasi finance mendeteksi pasangan hilang/duplikat, status, nominal, arah, debit-credit, source ID/type, serta orphan ledger. Setiap audit run dicatat ke audit log, tetapi tidak mengubah data bisnis. Repair hanya aktif untuk rebuild missing/stale projection serta cleanup orphan dengan backup `pre-repair`, transaction, audit log, dan keyword. Repair stok utama, inventory log, transaksi, finance, production, payroll, HPP, dan reset data tidak tersedia dari Maintenance Center.


## Tambahan Rule Terkini (Batch Prioritas)

### Work Log Costing saat Complete
- saat Work Log diselesaikan, summary costing final dihitung dari snapshot material actual yang dibekukan saat Start Production; data historis tanpa snapshot boleh fallback ke master cost aktif
- `materialCostActual`, `totalCostActual`, dan `costPerGoodUnit` tidak boleh memakai snapshot BOM/PO lama; source actual material adalah Work Log material usage setelah Start Production
- sinkronisasi payroll ke Work Log boleh memperbarui `laborCostActual` sebagai ringkasan display, tetapi tidak mengubah source of truth payroll line
- setelah payroll final berubah, output HPP/average cost master wajib direconcile lewat service tanpa menambah qty stok ulang

### Payroll Paid vs Cash Out
- status `paid` pada payroll produksi sekarang adalah trigger integrasi ke Cash Out/Expense.
- Saat payroll berubah menjadi `paid` dan `paymentStatus` menjadi `paid`, sistem membuat expense otomatis dengan guard idempotent.
- Guard wajib memakai `sourceModule: production_payroll` dan `sourceId: payrollId`; jika expense dengan source yang sama sudah ada, sistem tidak boleh membuat expense baru.
- Jika payroll `finalAmount <= 0`, expense otomatis boleh dilewati dan status sync dicatat agar audit tetap jelas.
- Untuk UI list/detail/report, `status` dan `paymentStatus` tetap field data terpisah, tetapi tampilan harus compact. Jika keduanya bernilai `paid`, UI cukup menampilkan satu tag `Paid` agar tidak ada info pembayaran dobel.

### Export Laporan
- laporan stok aktif sebaiknya memakai ekspor XLSX yang lebih rapi, bukan CSV mentah
- helper export reusable boleh dipakai lintas laporan selama tidak mengubah source data laporan

## Update Rule Stok & Audit Log — 2026-04-25

### 8.4 Source of truth mutasi stok umum
Mutasi stok umum wajib lewat `updateInventoryStock()` agar field berikut tetap sinkron:
- `stock`
- `currentStock`
- `reservedStock`
- `availableStock`
- `variants[]` untuk item bervarian

Pengecualian yang dijaga adalah flow produksi final karena `productionWorkLogsService` membutuhkan transaction atomic untuk konsumsi material dan posting output.

### 8.5 Stock Adjustment
Stock Adjustment tidak boleh lagi update field `stock` secara langsung dari page. Adjustment harus:
- memakai backend SQLite transaction/atomic commit agar update stok, record `stock_adjustments`, dan `inventory_logs` tidak commit setengah jalan;
- memakai helper stok varian aktif seperti `applyStockMutationToItem()` agar `stock/currentStock/reservedStock/availableStock/variants[]` tetap sinkron;
- memilih item dari `raw_materials`, `semi_finished_materials`, atau `products`;
- memilih varian jika item bervarian, termasuk Semi Finished bervarian agar stok masuk ke bucket `variantKey` dan tidak fallback ke master/default;
- mencegah adjustment keluar melebihi `availableStock`, bukan hanya mengecek `currentStock`;
- membuat record `stock_adjustments`;
- membuat `inventory_logs` dengan `adjustmentId`, `referenceId`, `referenceType`, dan snapshot stok sebelum/sesudah;
- tidak mengubah stok jika record adjustment atau inventory log gagal dibuat.

### 8.6 Inventory Log Reference
Inventory log baru wajib menyimpan reference audit di field standar:
- `referenceId`
- `referenceType`
- `details`

Field lama di top-level tetap boleh dipertahankan untuk kompatibilitas reader lama.

### 2.7 Customer Collection
Collection customer final adalah `customers` lowercase. Modul Master Customer dan Sales harus membaca sumber yang sama agar data pelanggan tidak terpencar.

## Standar Referensi ID Bisnis dan Larangan Technical ID

Definisi:
- **Technical ID** adalah internal database ID random, auto ID, internal generated ID, atau ID teknis lain yang tidak manusiawi.
- **Referensi ID bisnis** adalah kode manusiawi yang dipakai user untuk audit, pencarian, dan relasi operasional.

Aturan audit UI:
- Technical ID tidak boleh dipakai sebagai referensi audit bisnis.
- Technical ID tidak boleh tampil di UI, tooltip, table, detail, drawer, report UI, export user-facing, atau fallback text.
- Technical ID tidak boleh menjadi search utama user.
- Jika referensi bisnis tidak tersedia, tampilkan fallback manusiawi seperti `-` atau `Referensi belum tersedia`.
- Database tetap membutuhkan ID internal, tetapi ID internal bukan acuan audit UI bila nilainya random/technical.

Prioritas referensi audit:
1. Kode bisnis transaksi/master/produksi yang manusiawi.
2. `sourceRef` / `referenceNumber` readable.
3. Fallback manusiawi `-` atau `Referensi belum tersedia`.
4. Jangan fallback ke Technical ID.

Contoh Referensi ID bisnis:
- Purchase: `PUR-YYYYMMDD-0001`
- Sales: `ORDE-YYYYMMDD-0001`
- Return: `RET-YYYYMMDD-0001`
- Stock Adjustment: `STK-ADJ-DDMMYYYY-001`
- Cash In: `CSH-IN-DDMMYYYY-001`
- Cash Out: `CSH-OUT-DDMMYYYY-001`
- Payroll: `PAY-YYYYMMDD-0001`
- Work Log: `JOB-DDMMYYYY-001`
- Production Order: `PO-YYYYMMDD-0001`

Policy internal database ID setelah reset data:
- Untuk collection transaksi dengan pola 1 dokumen = 1 referensi, document ID boleh dan sebaiknya sama dengan Referensi ID bisnis, misalnya `purchases/PUR-20260511-0001`, `sales/ORDE-20260511-0001`, atau `returns/RET-20260511-0001`.
- Untuk collection log yang bisa memiliki banyak baris per referensi, jangan pakai random ID. Pakai ID turunan readable seperti `LOG-PUR-20260511-0001-001`, `LOG-PUR-20260511-0001-002`, atau `LOG-STK-ADJ-12052026-001-001`.
- `sourceRef`, `referenceNumber`, `purchaseNumber`, `saleNumber`, `returnNumber`, dan field bisnis readable tetap menjadi acuan audit utama.
- Kode audit harus immutable setelah dipakai. Jika nama/ref berubah, jangan otomatis mengubah kode audit lama tanpa approval migrasi.
- Perubahan document ID/write flow adalah task arsitektur terpisah dan tidak boleh dilakukan tanpa approval khusus.

## Standar Kode Manusiawi Tanpa Mapping Manual

Aturan:
- Product, Raw Material, Semi Finished, BOM, dan Production Step memakai sequence internal sederhana `PREFIX-001`.
- Jangan membuat dictionary singkatan kata per modul untuk kode baru.
- Jangan membuat format kode berbeda-beda antar modul tanpa alasan arsitektur yang disetujui.
- Jangan duplicate generator kode di page/service berbeda.
- Gunakan shared generator sebagai source of truth.
- Jangan fallback ke Technical ID/random ID untuk menyelesaikan duplicate.

Algoritma sequence internal master/config:
1. Preview membaca nilai counter dan baseline `MAX(sequence)` kode historis langsung di SQLite; source tidak memuat seluruh daftar kode ke memory JavaScript.
2. Preview tidak mereservasi nomor dan boleh sama pada dua form yang terbuka bersamaan.
3. Create/commit final menjalankan reservasi counter dan insert dalam transaction yang sama. Jika preview managed sudah dipakai request lebih dulu, server mengalokasikan nomor berikutnya dan response final menjadi source of truth.
4. Unique code mencakup data soft-deleted; kode audit lama tidak boleh dipakai ulang.
5. Rollback boleh meninggalkan gap sequence hanya bila reservasi sudah menjadi bagian operasi yang kemudian dibatalkan/ditolak; nomor tidak boleh dipaksa mundur karena berisiko duplicate.
6. Kode master/config tidak ditampilkan sebagai informasi utama UI; user memilih dari nama, varian, target, step, dan satuan.

Contoh final:
- Product: `PRD-001`
- Raw Material: `RAW-001`
- Semi Finished: `SFP-001`
- BOM Product: `BOM-001`
- BOM Semi Finished: `BOM-002`
- Production Step: `STP-001`

Catatan current state source aktual:
- Generator kode aktif berada pada backend SQLite dan dipusatkan pada `businessCodeCounter.js`; page/frontend tidak menghitung sequence final.
- Placeholder frontend `businessCodeGenerator.js` dan `businessCodeCounterService.js` tetap tidak dipakai dan tidak dihidupkan kembali.
- Production Step dan generic master/config memakai runtime counter `PREFIX-001`; Customer/Supplier serta transaksi harian memakai counter per tanggal bila service tidak menerima reference custom.
- Data historis readable dan reference marketplace/custom tetap dipertahankan. Collision reference custom ditolak; collision preview managed dialihkan ke nomor berikutnya di server.

### Atomic Counter Kode Bisnis — Status Aktual

Status: **AKTIF / GUARDED / TRANSACTIONAL**.

- Tabel existing `business_code_counters` menjadi runtime source counter tanpa perubahan schema.
- Counter baseline memakai `MAX(CAST(SUBSTR(...)))` di SQLite dan tidak memakai reduce/full scan sequence di JavaScript.
- Reservasi managed code dilakukan di dalam transaction create/commit yang juga menyimpan record, stock mutation, finance side effect, dan audit terkait.
- Test concurrency wajib menjaga dua request dengan preview sama tetap menghasilkan code/ID unik, counter mengikuti baseline historis, dan rollback tidak merusak queue berikutnya.
- Preview tidak boleh dianggap reservation. UI wajib memakai code final dari response server.


## Update Rule Tahapan Produksi — 2026-05-16

- Tahapan Produksi memakai `basisType` sebagai field aktif untuk cara kerja step. Field `workBasisType` tidak dipakai lagi di source terbaru.
- Label basis step aktif adalah: `Per Meter Bahan`, `Per Kawat`, `Per Qty`, dan `Per Batch`.
- Field legacy `monitoringMode` tidak lagi tampil dan tidak lagi disimpan. Form Step memakai metadata eksplisit `monitoringMetric` (`none`, `petal`, `leaf`, atau `stem`) hanya bila step terhubung ke Production Profile; sistem tidak boleh menebak jenis hasil dari nama step.
- Mode upah step aktif hanya `per_qty` dan `per_batch`; mode `fixed` tidak lagi menjadi pilihan aktif.
- Field `payrollQtyBase` tidak lagi menjadi input atau payload dari menu Step. Untuk per qty, tarif dibaca sebagai tarif per 1 hasil. Untuk per batch, tarif mengikuti batch Work Log.
- Klasifikasi payroll tidak dipilih manual di UI Step. Sistem menurunkan klasifikasi dari `processType` agar tidak ada rule ganda antara UI Step, Work Log, Payroll, dan HPP.
- Step produksi harus tetap universal untuk produksi bunga, bukan hard-code hanya untuk mawar atau bouquet.

## Update Rule Karyawan Produksi — 2026-04-25

### Kode karyawan produksi otomatis
- Karyawan produksi baru wajib memakai kode otomatis format `DDMMYYYY-XXX`.
- Prefix `DDMMYYYY` memakai tanggal lokal saat data karyawan dibuat.
- Nomor urut `XXX` selalu 3 digit dan naik per tanggal pembuatan.
- User tidak boleh mengetik kode karyawan manual saat tambah data baru.
- Service karyawan produksi wajib generate ulang kode saat submit agar preview di form tidak menjadi source final bila ada input paralel.
- Field `code` tetap dipakai sebagai display reference di Work Log/Payroll. internal database ID boleh tetap dipakai sebagai relasi internal teknis, tetapi bukan referensi audit UI dan tidak boleh menjadi fallback display.
- Kode lama seperti `EMP-...` dianggap data historis dan tidak dimigrasi otomatis saat edit.

## Update Rule Auto Payroll Work Log Completed — 2026-04-25

- Work Log Produksi yang berubah ke status `completed` wajib membuat line Payroll Produksi otomatis.
- Source of truth payroll baru tetap mengikuti rule pada Tahapan Produksi: `payrollMode`, `payrollRate`, dan `payrollOutputBasis`.
- `payrollQtyBase` tidak lagi menjadi input atau payload UI Step; payroll otomatis memakai nilai aman `1` agar tidak ada layer hitung ganda.
- `payrollClassification` dan `includePayrollInHpp` diturunkan otomatis dari jenis proses: `support_process` menjadi support/fulfillment dan tidak masuk HPP inti; selain itu menjadi direct labor dan masuk HPP inti.
- Operator Produksi wajib dipilih saat menyelesaikan Work Log agar payroll line bisa dibuat per operator.
- Guard idempotent wajib memakai kombinasi Work Log + Step + Operator agar klik Selesaikan berulang tidak membuat payroll dobel.
- Status awal line payroll otomatis adalah `draft` dan `paymentStatus` awal adalah `unpaid`.
- Payroll paid membuat Cash Out/Expense otomatis hanya lewat guard `sourceModule/sourceId` agar tidak double expense.
- Work Log completed tetap guarded: posting stok output dan material tidak boleh diproses ulang hanya karena payroll line dibuat atau payroll dibayar.

## Business Rule Final — Integrasi Payroll Paid ke Cash Out
- Work Log completed otomatis membuat payroll line per operator berdasarkan rule Tahapan Produksi.
- Payroll line otomatis tetap memakai guard idempotent Work Log + Step + Operator agar tidak double payroll.
- Saat payroll ditandai `paid` dan `paymentStatus` menjadi `paid`, sistem otomatis membuat Cash Out/Expense.
- Expense payroll wajib memakai `sourceModule: production_payroll`, `sourceId: payrollId`, dan `sourceRef: payrollNumber`.
- Expense payroll tidak boleh dibuat ulang jika source payroll yang sama sudah punya expense.
- Payroll dengan `finalAmount <= 0` boleh ditandai paid, tetapi Cash Out otomatis dilewati dan dicatat sebagai `skipped_zero_amount`.
- Profit Loss membaca biaya payroll dari collection `expenses`, bukan dari `production_payrolls`, agar tidak double counting.
- Jika payroll paid dibatalkan/diubah ulang, expense tidak dihapus otomatis sebelum ada business rule rollback yang jelas.


## Final Lock Cleanup Task 1–5 — 2026-04-25

### Inventory / Stock Management
- Kolom Referensi Audit adalah audit source untuk menjelaskan asal mutasi stok: Penyesuaian Stok, Pembelian, Penjualan, Retur, Produksi / Work Log, atau Production Order.
- Referensi harus tampil manusiawi; ID teknis/random ID tidak boleh tampil sebagai teks utama, detail kecil, tooltip, drawer/detail, report UI, atau fallback display.
- Stock Adjustment aktif hanya melalui halaman Manajemen Stok; route lama bila ada hanya redirect lama.
- Angka pada Stock Adjustment wajib memakai format Indonesia tanpa trailing `.00` dan input aktif memakai angka bulat (`precision=0`), termasuk untuk stok berbasis meter.
- Riwayat adjustment harus terbaru di atas, prioritas `createdAt` lalu fallback `date` untuk data historis.

### Production Order Preview
- Drawer Buat Production Order wajib menampilkan preview compact read-only: stok target, varian target jika ada, qty batch, estimasi output, kebutuhan material, stok material, dan status cukup/kurang.
- Preview tidak boleh mengubah stok, status PO, BOM, Work Log, payroll, atau HPP.
- Production Order final tetap dihitung ulang dari BOM/helper requirement final saat submit.


### Production Order Target Selection UX
- Drawer Buat Production Order harus membantu user memilih target secara bertahap tanpa mengubah kontrak data.
- Untuk `Produk Jadi`, urutan UI yang disarankan: `Jenis Produksi → Produk yang dibuat → Resep Produksi jika lebih dari satu → Qty Batch Produksi → Preview Kebutuhan`.
- Untuk `Bahan / Semi Produk`, urutan UI yang disarankan: `Jenis Produksi → Jenis Bunga / Product Family → Kategori Bahan → Bahan yang dibuat → Resep Produksi jika lebih dari satu → Qty Batch Produksi → Preview Kebutuhan`.
- `Jenis Bunga / Product Family` dan `Kategori Bahan` hanya filter UI untuk semi product; jangan dipakai untuk memaksa produk jadi memiliki family bila source product belum mendukungnya.
- Dropdown target user-facing sebaiknya menampilkan nama yang mudah dibaca. Kode master internal seperti `(FLN-DN-POLA)` dan hitungan `· 1 BOM` tidak wajib tampil di pilihan user karena mengganggu operasional.
- `bomId` tetap wajib terisi sebelum submit, baik lewat auto-select resep tunggal maupun pilihan `Resep Produksi` jika ada banyak resep aktif.

### Work Log Actual Cost / HPP
- Completed Work Log wajib menyimpan `materialCostActual`, `laborCostActual`, `overheadCostActual`, `totalCostActual`, dan `costPerGoodUnit`.
- Biaya tidak boleh diisi asal; material cost harus berasal dari Work Log start snapshot atau fallback source cost item yang aman, bukan harga jual.
- `totalCostActual = materialCostActual + laborCostActual + overheadCostActual` untuk flow aktif. Overhead dari BOM tetap material/biaya produksi pendukung seperti listrik/glue gun sesuai input, bukan pengganti labor payroll final.
- `costPerGoodUnit = totalCostActual / goodQty` hanya jika `goodQty > 0`; jangan membagi 0.
- HPP Analysis membaca completed Work Log sebagai source cost final.

### Payroll Produksi
- Work Log completed wajib membuat payroll line otomatis berdasarkan rule Tahapan Produksi.
- Guard payroll wajib mencegah duplikasi per kombinasi Work Log + Step + Operator.
- Status payroll yang dipakai: `draft`, `confirmed` jika flow approval dipakai, dan `paid`.
- `paymentStatus` menjelaskan status pembayaran internal line payroll; saat paid, sistem membuat expense otomatis dengan guard.
- Payroll preference/custom payroll di master karyawan adalah data historis/compatibility, bukan source utama payroll baru.

### Cash Out / Expense Payroll
- Payroll paid otomatis membuat expense di Cash Out dengan `sourceModule=production_payroll`, `sourceId=payrollId`, dan `sourceRef=payrollNumber`.
- Expense payroll tidak boleh dibuat dobel ketika user klik Paid ulang, reload, atau update status berulang.
- Jika payroll paid dibatalkan, expense tidak dihapus otomatis sebelum ada business rule rollback yang jelas.

### Export Laporan
- Export final laporan harus XLSX rapi dengan title, filter/periode, header manusiawi, format Rupiah, format tanggal Indonesia, format angka Indonesia, sheet name jelas, dan auto width.
- Jangan export object mentah, JSON string panjang, atau field teknis yang tidak dibutuhkan user.

## 9. Rule Production Planning / Planning Schedule

### 9.1 Scope Production Planning
Production Planning adalah layer rencana sebelum Production Order. Data aktif disimpan di collection `production_plans`.

Planning boleh menyimpan:
- kode planning;
- periode mingguan, bulanan, atau custom;
- deadline;
- target type `product` atau `semi_finished_material`;
- target item;
- target varian jika item punya varian;
- target qty;
- priority;
- catatan;
- referensi PO terkait.

### 9.2 Efek Planning
Production Planning **tidak boleh**:
- mengubah stok;
- memotong bahan;
- menambah output;
- membuat payroll;
- membuat expense/cash out;
- mengubah HPP;
- otomatis membuat PO tanpa aksi user.

### 9.3 Link Planning ke PO
PO yang dibuat dari planning wajib menyimpan:
- `planningId`;
- `planningCode`;
- `planningTitle`.

PO manual tanpa planning tetap valid.

### 9.4 Progress Planning
Progress planning wajib dihitung dari data aktual:
- sumber utama: Work Log `completed` milik PO yang terhubung ke planning;
- jika Work Log punya output line, gunakan `outputs[].goodQty` yang cocok dengan target item;
- fallback hanya untuk data historis: `workLog.goodQty` jika target Work Log cocok;
- Work Log `draft`, `in_progress`, `cancelled`, atau status lain tidak dihitung.

Jika target punya varian, progress wajib cocok dengan `targetVariantKey`. Jika target tidak punya varian, progress cukup cocok dengan item master.

### 9.5 Status Planning
Status planning final:
- `draft`: periode belum mulai dan target belum tercapai;
- `active`: periode berjalan / belum overdue dan target belum tercapai;
- `completed`: actual completed qty >= target qty;
- `overdue`: due date lewat dan target belum tercapai;
- `cancelled`: dibatalkan manual.

Planning `completed` atau `cancelled` tidak boleh menghapus PO/Work Log yang sudah ada.

### 9.5A Rule Cancel Production Planning
Cancel Production Planning adalah pembatalan status planning, bukan hard delete dokumen. Cancel hanya mengubah status Planning menjadi `cancelled`.

Rule cancel:
- Planning tanpa PO / linked Production Order boleh dicancel jika status belum final.
- Planning yang sudah punya PO / linked Production Order tidak boleh dicancel langsung. User harus mengelola PO terkait terlebih dahulu.
- Planning `cancelled` tidak boleh dibuatkan PO.
- Planning `completed` tidak boleh dibuatkan PO.
- Planning `overdue` tanpa PO masih boleh dibuatkan PO atau dicancel sesuai kebutuhan operasional.
- Planning `overdue` dengan PO tidak boleh dicancel langsung.

Cancel Planning tidak boleh menghapus atau mengubah:
- Production Order existing;
- Work Log;
- inventory/stok;
- Payroll;
- HPP;
- reports;
- sales;
- purchases;
- returns;
- cash in/out.

Progress Planning tetap dihitung dari Work Log `completed`, bukan dari PO yang baru dibuat atau baru dimulai. Dashboard dan filter Planning wajib membaca status canonical `cancelled`.

### 9.6 Dashboard Planning
Dashboard hanya membaca summary planning:
- target minggu ini;
- progress minggu ini;
- target bulan ini;
- progress bulan ini;
- jumlah overdue;
- jumlah kurang target.

Dashboard tidak boleh mengubah data planning, PO, Work Log, stok, payroll, atau HPP.


## Final Lock Hardening Fase A-G - 2026-04-26

Bagian ini mengunci hasil hardening bertahap Fase A sampai F dan menjadi acuan utama untuk patch berikutnya. Fase G hanya dokumentasi, tidak mengubah source aplikasi.

### Fase A - Sales Stock Safety
- Penjualan wajib melakukan validasi stok sebelum transaksi disimpan.
- Validasi penjualan wajib memakai `availableStock` master atau varian, bukan hanya `currentStock` atau snapshot UI lama.
- Jika item yang sama muncul lebih dari satu baris, kebutuhan qty wajib dihitung total sebelum create sale agar stok tidak minus.
- Item bervarian wajib memvalidasi `variantKey` dan stok varian yang benar.
- Selector item Sales boleh difilter per Jenis Item, tetapi filter UI tidak boleh mengubah payload final atau source stok (`collectionName` + `itemId`).
- Field reference/resi wajib tetap opsional dan hanya aktif untuk channel yang relevan; Offline/WhatsApp tidak boleh memaksa reference tersimpan.
- Sale tidak boleh tersimpan jika stok tersedia tidak cukup.
- Jika mutasi stok gagal saat create sale, transaction wajib gagal sehingga tidak ada transaksi orphan tanpa stok keluar.
- Income rule tidak berubah: income hanya dibuat saat sale berstatus `Selesai` dan tidak boleh dobel.
- Sales tetap no-cancel user-facing: barang kembali wajib lewat Return. Hard delete bukan flow user.

### Fase B - Metadata Expense Pembelian
- Pembelian tetap membuat expense otomatis dengan amount mengikuti logic existing pembelian.
- Saving pembelian tetap hanya informasi efisiensi dan bukan pengurang kas.
- Expense otomatis pembelian wajib menyimpan reference audit:
  - `sourceModule` mengikuti schema aktif project, yaitu `purchases`;
  - `sourceId` berisi purchase id;
  - `sourceRef` berisi nomor/reference pembelian yang tersedia;
  - `sourceType: auto_generated`;
  - `createdByAutomation: true`;
  - field kompatibilitas lama seperti `relatedPurchaseId` tetap boleh dipertahankan.
- Expense pembelian tidak boleh dibuat dobel untuk transaksi purchase yang sama.

### Fase C - HPP dan Work Log Cost 0 Visibility
- HPP tidak boleh mengisi angka cost asal jika sumber cost belum valid.
- `materialCostActual = 0` wajib diberi penjelasan: cek cost bahan atau snapshot material.
- `laborCostActual = 0` wajib diberi penjelasan: cek payroll Work Log.
- `totalCostActual = 0` wajib diberi penjelasan bahwa HPP belum valid untuk analisis.
- Jika `costPerGoodUnit = 0` sementara `goodQty > 0`, tampilkan warning agar user tidak membaca HPP/unit sebagai valid.
- Draft payroll tidak boleh dihitung sebagai biaya tenaga kerja final untuk HPP.
- Work Log completed tetap tidak boleh diproses ulang hanya untuk memperbaiki display cost.
- UI final-state harus clean: Work Log `completed` hanya menampilkan aksi Detail di list utama; tombol Edit disabled tidak perlu ditampilkan.

### Fase D - Dashboard Read-only Control Center
- Dashboard adalah read-only operational control center.
- Dashboard tidak boleh menulis/mengubah stok, sales, PO, Work Log, payroll, expense, income, HPP, planning, atau laporan.
- Struktur Dashboard harus compact sebagai control center: KPI ringkas, quick actions navigasi-only, Data Perlu Dicek, Prioritas Hari Ini, Fokus Produksi, Stok Kritis, Keuangan Ringkas, dan Aktivitas Terbaru. Jumlah section boleh bertambah hanya jika tetap read-only dan tidak berubah menjadi report/table besar.
- Dashboard tidak boleh memakai table besar atau horizontal scroll sebagai layout utama.
- List Dashboard maksimal 5 item, Data Perlu Dicek maksimal 6 alert, dan planning prioritas maksimal 3 item.
- Keuangan Dashboard hanya ringkasan monitoring; Profit Loss tetap source final laporan laba/rugi.
- Dashboard wajib punya last updated dan refresh/Muat Ulang yang hanya reload data summary. Data transaksi/finance pada Dashboard dibatasi ke periode operasional aktif seperti bulan/minggu berjalan; report final tetap berada di halaman laporan.
- Jika payroll paid sudah masuk expense atau ada cost 0, Dashboard hanya menampilkan catatan/warning, bukan angka final yang misleading.

### Fase E - Report dan Export Standard
- Laporan transaksi/finance/payroll harus memakai filter periode server-side bila collection sumber memakai field tanggal yang stabil. Default aman adalah bulan berjalan agar halaman laporan tidak membaca seluruh collection transaksi.
- Export final laporan harus XLSX, bukan data mentah.
- Header harus manusiawi, sheet name jelas, tanggal rapi, Rupiah rapi, dan angka memakai format Indonesia.
- Stock Report wajib mencakup sumber stok aktif yang relevan: bahan baku, semi-finished, dan produk jadi.
- Jika Stock Report hanya berhasil membaca sebagian source stok, UI dan export XLSX wajib menandai laporan sebagai parsial; export tidak boleh terlihat seperti full database lengkap.
- HPP Analysis boleh diekspor ke XLSX tanpa mengubah rumus HPP.
- Export HPP wajib membawa kolom validasi cost agar warning cost 0 tetap terlihat saat file dibuka.
- Payroll Report boleh mempertahankan CSV data historis untuk compatibility, tetapi XLSX adalah output final yang lebih rapi. Query laporan Payroll harus membaca periode aktif bila tersedia, bukan selalu `getAllProductionPayrolls`.

### Fase F - Duplicate Cleanup Data Historis
- Folder/file duplicate seperti `src/src/**` tidak boleh diedit untuk patch baru.
- File duplicate data historis hanya boleh dihapus setelah grep/import/route check membuktikan tidak dipakai runtime.
- Route aktif Dashboard harus tetap memakai `src/pages/Dashboard/*`.
- Service aktif Planning harus tetap memakai `src/services/Produksi/productionPlanningService.js`.
- Jika ada penghapusan data historis, wajib ada catatan `DELETE_LIST.md` atau dokumentasi setara yang menjelaskan bukti dan file yang dihapus.

### Final Guard Anti Double Payroll / Expense
- Work Log completed wajib membuat payroll line secara idempotent per Work Log + Step + Operator.
- Payroll paid wajib membuat expense secara idempotent dengan `sourceModule=production_payroll` dan `sourceId=payrollId`.
- UI final-state harus clean: Payroll `paid` hanya menampilkan aksi Detail di list utama; tombol Edit disabled dan Paid tidak perlu ditampilkan.
- Profit Loss membaca payroll lewat `expenses`, bukan langsung dari `production_payrolls`, agar tidak double count.
- Expense payroll tidak boleh dihapus otomatis saat payroll paid dibatalkan sebelum business rule rollback disepakati.

## 15. Rule Supplier, Katalog Toko, dan Relasi Barang

### 15.1 Supplier sebagai identitas toko
- Supplier menyimpan identitas toko/vendor: nama, link toko utama, kontak, alamat, catatan, dan status.
- `supplierId`, ID penawaran, ID item, serta kode internal tetap dibuat/disimpan backend dan tidak ditampilkan pada form, tabel, drawer, tooltip, atau fallback UI utama.
- Kode/ID internal tidak boleh dihapus dari data karena tetap diperlukan untuk relasi, migrasi, dan audit backend.
- Satu komponen detail drawer dipakai ulang untuk semua supplier; drawer selalu memuat satu toko yang dipilih, bukan menggabungkan seluruh supplier.

### 15.2 Katalog toko sebagai relasi many-to-many
- Katalog aktif disimpan pada `supplier_catalog_offers`, bukan sebagai satu field link pada master item.
- Satu supplier boleh menyediakan banyak Produk dan Bahan Baku.
- Satu Produk/Bahan Baku boleh disediakan banyak supplier.
- Kombinasi supplier + item yang sama boleh memiliki banyak link/paket selama penawarannya berbeda.
- Setiap penawaran menyimpan item type/id, varian bila ada, nama listing, channel, link, satuan beli, qty paket, konversi, satuan stok, harga saat ini, estimasi biaya, status aktif, dan status ketersediaan.
- `materialDetails` lama tetap dibaca sebagai compatibility dan dimigrasikan aman; penulisan baru memakai katalog terstruktur.
- Supplier/katalog tidak mengunci master barang pada satu supplier dan tidak melakukan cascade otomatis ke Product/Raw Material.

### 15.3 Histori wajib per toko
- Histori harga, pengecekan, link, status, dan verifikasi Pembelian disimpan di `supplier_catalog_history` dengan `supplier_id` yang jelas.
- Saat drawer Toko A dibuka, hanya histori Toko A yang boleh dimuat dan ditampilkan; histori toko lain tidak boleh tercampur.
- Harga lama, waktu pengecekan, waktu perubahan, dan pelaku perubahan tidak ditampilkan di katalog utama. Detail tersebut hanya tersedia pada tab **Histori Toko**.
- Katalog utama hanya menampilkan kondisi terbaru: barang, toko/channel, paket, harga saat ini, harga per unit, status, dan aksi.
- Penawaran tidak dihapus saat link mati/barang habis; gunakan status ketersediaan atau nonaktif agar histori transaksi tetap utuh.

### 15.4 Batas ke Purchases
- Purchases wajib memilih supplier dan satu penawaran/link katalog yang sesuai item serta varian.
- Harga aktual wajib diverifikasi pada setiap Pembelian sebelum commit, walaupun katalog baru diperiksa sebelumnya.
- Jika harga aktual berubah, perubahan harga katalog, histori toko, purchase, stock-in, inventory log, dan expense wajib berada dalam transaksi SQLite yang sama agar tidak partial.
- Harga aktual Pembelian tetap snapshot transaksi dan tidak boleh berubah ketika katalog diedit kemudian.
- Klik link atau tombol Beli hanya membuka/prefill form; stok, kas, expense, dan laporan baru berubah setelah commit Pembelian berhasil.

## 16. Rule Restock Assistant

- Restock Assistant hanya membantu navigasi dan prefill data, bukan membuat transaksi otomatis.
- Dashboard boleh menampilkan action cepat untuk bahan baku stok menipis/kritis:
  - buka link produk terakhir dari Purchases terakhir;
  - buka form Purchases dengan material/supplier/link produk terisi awal;
  - buka menu Supplier dengan filter material untuk membandingkan supplier.
- Klik action Restock Assistant tidak boleh mengubah stok, kas, expense, saving, laporan, atau supplier.
- Stok/kas/expense hanya berubah setelah user menyimpan transaksi di halaman Purchases.
- Supplier terakhir dibeli dan link produk terakhir wajib berasal dari transaksi Purchases terakhir untuk bahan tersebut.
- Jika belum ada purchase/link produk, UI harus menampilkan fallback/empty state aman dan tidak boleh memakai link toko supplier sebagai link produk utama.
- Menu Supplier menampilkan daftar toko secara ringkas. Katalog dan Histori Toko hanya dimuat pada drawer supplier yang sedang dipilih agar data antartoko tidak tercampur.

## 15. Rule Final Stok Varian

- `currentStock` adalah stok utama yang dipakai per varian.
- `stock` tetap wajib disimpan sebagai alias kompatibilitas dan nilainya harus sama dengan `currentStock`.
- `reservedStock` wajib angka aman dan tidak boleh membuat available negatif.
- `availableStock` wajib dihitung dari `currentStock - reservedStock` dengan batas minimum 0.
- Stock-out wajib dibandingkan dengan `availableStock` terbaru di Stock Engine dalam transaction yang sama; validasi UI/service pemanggil tidak cukup.
- `reservedStock` tidak boleh melebihi `currentStock`. Mutation yang akan membuat invariant tersebut rusak wajib ditolak tanpa partial write.
- Semua writer varian wajib memakai helper pusat `variantStockNormalizer` atau helper lama yang sudah delegasi ke helper pusat.
- Resolver compatibility wajib memilih `variants` yang non-empty, lalu fallback ke `variantOptions` yang non-empty. Array `variants: []` tidak boleh menutupi data legacy dan tidak boleh otomatis dianggap sebagai mode varian.
- Master item bervarian wajib menyimpan `currentStock`, `stock`, `reservedStock`, dan `availableStock` berdasarkan total varian.
- Untuk Product dan Semi Finished, minimum stok final adalah field master: `products.minStockAlert` dan `semi_finished_materials.minStockAlert`, berlaku untuk item non-varian maupun bervarian.
- `variants[].minStockAlert` pada Product/Semi Finished hanya data historis/compatibility field jika masih ada di data historis/helper generic; UI dan service master tidak boleh menjadikannya source utama threshold low-stock.
- Saat Product/Semi Finished bervarian dibuat atau di-edit, total stok master tetap dihitung dari varian, tetapi `minStockAlert` master wajib berasal dari input master `values.minStockAlert`, bukan penjumlahan varian.
- Untuk Raw Material tanpa varian, minimum stok memakai field master `minStock`/`minStockAlert`.
- Untuk Raw Material bervarian, minimum stok operasional wajib berasal dari `variants[].minStockAlert`; nilai top-level disimpan `0` untuk data baru agar threshold master tidak diterapkan ulang ke setiap varian.
- Read model Raw Material bervarian boleh menyimpan jumlah seluruh minimum varian aktif untuk ringkasan aggregate, tetapi status low-stock tetap harus mengevaluasi setiap varian terhadap minimum masing-masing.
- Data Raw Material lama yang belum memiliki `variants[].minStockAlert` boleh memakai `minStock` master sebagai fallback compatibility saat dibaca, lalu dinormalisasi ketika master disimpan kembali.
- Untuk modal/HPP Semi Finished bervarian: jika stok varian ada, master `averageCostPerUnit` wajib weighted by stock; jika semua stok 0, read-model cost tidak boleh dirata-ratakan dengan varian yang cost-nya 0. Gunakan rata-rata varian aktif yang punya cost > 0, lalu fallback `lastProductionCostPerUnit` untuk tampilan/BOM cost source.
- Reset/Maintenance hanya alat audit/repair/development, bukan flow harian user untuk menjaga stok tetap sinkron.

### 15.1 Variant conversion aman

- Edit master biasa tetap tidak boleh menjadi jalur mutasi stok.
- Data historis non-varian boleh mulai memakai varian hanya jika `stock/currentStock`, `reservedStock`, dan `availableStock` semuanya 0.
- Varian baru pada item existing wajib dibuat dengan `stock/currentStock/reservedStock/availableStock = 0`.
- Item lama yang masih punya stok master atau reserved stock tidak boleh dikonversi otomatis ke varian; user harus memakai Stock Management / Stock Adjustment / transaksi resmi bila stok perlu dialihkan.
- `variantKey` existing tidak boleh berubah saat nama/label varian diganti karena itu adalah identitas bucket stok/reference transaksi.
- Hapus/arsip varian wajib ditolak jika varian masih punya `stock`, `currentStock`, `reservedStock`, atau `availableStock` yang belum aman.
- Jika semua bucket stok varian aman 0, varian boleh disembunyikan dari transaksi baru dengan memindahkannya ke `archivedVariants[]`, bukan hard delete.
- Mode varian existing boleh dimatikan hanya jika semua varian aktif punya `currentStock`, `reservedStock`, dan `availableStock` 0; hasilnya `variants[]` aktif kosong, `hasVariants=false`, dan tombstone tetap ada di `archivedVariants[]`.
- `archivedVariants[]` wajib menyimpan `variantKey`, label/nama/kode varian, snapshot stok terakhir, `isArchived=true`, `isActive=false`, `archivedAt`, `archivedBy`, dan `archiveReason`.
- Varian arsip tidak boleh muncul sebagai pilihan transaksi baru, tetapi boleh ditampilkan di detail master sebagai audit/history.
- Jika user membuat lagi varian dengan nama/struktur yang sama seperti arsip, service wajib restore `variantKey` lama dari `archivedVariants[]`, menghapusnya dari arsip aktif, dan menulis `restoredAt/restoredBy/restoreReason`.
- Duplicate varian aktif maupun nonaktif dalam payload master wajib ditolak; satu bucket existing tidak boleh direferensikan oleh dua baris edit.
- Referensi transaksi/produksi historis boleh dicocokkan melalui `variantKey`, label, kode, atau SKU, tetapi bucket final tetap mempertahankan `variantKey` immutable.
- Create master bervarian wajib memiliki minimal satu varian aktif.
- Mutation normal pada master/varian nonaktif atau archived wajib ditolak. Override hanya boleh berasal dari backend flow historis resmi, memiliki alasan internal, dan tercatat di audit metadata.
- Return historis yang valid boleh memulihkan varian archived zero-stock dengan `variantKey` lama. Stock mutation biasa tidak boleh melakukan restore tersebut.
- `variantModeHistory[]` adalah audit ringkas untuk event `variant_mode_enabled`, `variant_mode_disabled`, `variant_archived`, dan `variant_restored`; history ini tidak menggantikan inventory log stok.

### 15.1.1 Guard backend edit master inventory

- UI `disabled` bukan boundary data integrity. Backend wajib menghapus/mengabaikan semua stock field dari direct master update dan mengambil saldo terbaru dari database.
- Sanitasi wajib berjalan sebelum payload diubah menjadi kolom SQL; hook validasi yang hanya berjalan setelah `extractColumns()` tidak cukup untuk mode preserve/ignore.
- Direct update Product, Raw Material, dan Semi Finished wajib membawa `expectedVersion` dari `versionToken` record yang dibuka user. Konflik versi harus ditolak, bukan last-write-wins.
- Stock top-level dan stock varian wajib dipreserve berdasarkan `variantKey`, bukan berdasarkan urutan array. Array varian dari client tidak boleh mengganti seluruh bucket stok secara buta.
- Field valuation transaction-derived wajib dipreserve dari database terbaru. Edit metadata tidak boleh mengembalikan HPP/modal sebelum purchase/production terakhir.
- Create/update/delete master dan sinkronisasi `stock_read_models` wajib satu transaction backend. Frontend tidak boleh melakukan request sync read model kedua atau menelan kegagalannya.
- Endpoint client untuk direct create/update/delete `stock_read_models` wajib diblokir karena read model adalah data turunan, bukan source of truth.
- Delete master inventory yang masih memiliki current/reserved/variant stock wajib ditolak, termasuk stok tersembunyi pada `archivedVariants[]` data legacy.
- Field valuation transaction-derived harus read-only pada form edit master; backend tetap authority walaupun client dimodifikasi.
- Response sukses write transactional hanya boleh dikirim setelah `COMMIT` selesai.

### 15.2 Pricing Rules optional

- Pricing Rules adalah fitur harga opsional, bukan blocker create master Product/Raw Material.
- Mode create default Product/Raw Material adalah `manual`.
- `pricingRuleId` hanya wajib jika user memilih `pricingMode = rule`.
- Jika `pricingMode = manual`, `pricingRuleId` boleh kosong/null dan harga manual tetap valid.
- Mode Manual tidak boleh otomatis overwrite harga manual yang diinput user.
- Mode Rule hanya boleh melakukan auto-preview harga saat base cost dan rule valid. Jika base cost/rule belum valid, tampilkan warning/preview tidak siap tanpa mengisi harga asal.
- Product memakai basis cost `hppPerUnit` untuk preview Pricing Rule.
- Raw Material memakai `averageActualUnitCost` sebagai basis utama dengan fallback `restockReferencePrice`.
- `averageActualUnitCost` adalah transaction-derived, read-only pada edit master, dan hanya boleh berubah dari Pembelian/flow valuation resmi.
- Saat membuat Raw Material dengan stok awal > 0, modal stok awal per satuan wajib > 0 agar nilai persediaan dan HPP tidak dimulai dari nol palsu.
- Semua preview harga wajib lewat `buildSinglePricingPreview` dari `pricingService`; jangan membuat formula pricing baru di page/component.
- `PricingModeSwitch` hanya shared UI switch Manual/Rule, bukan source formula pricing, bukan validation service, bukan query backend/database, dan bukan tempat auto-preview.
- Auto-preview Product dan Raw Material tetap local di halaman masing-masing kecuali ada audit patch terpisah yang membuktikan shared hook lebih aman.
- PricingRules preview/apply tetap skip item Manual dan hanya memproses item yang memang berada pada mode Rule/valid.
- Apply Pricing Rule SQLite wajib memakai endpoint batch atomic. Seluruh item membawa `expectedVersion`; satu conflict atau item invalid menyebabkan seluruh batch rollback.
- Frontend tidak boleh melakukan loop direct `PUT` Product/Raw Material untuk apply massal karena dapat menghasilkan partial apply.

## Rule Guard Master Bahan Baku

- Raw Material tidak terikat pada satu Supplier di master. Sumber restock dikelola melalui `supplier_catalog_offers`; satu bahan boleh memiliki banyak toko dan banyak link/paket.
- Form/tabel utama Raw Material tidak menampilkan supplier snapshot lama, kode master, atau ID teknis. UI cukup menampilkan ringkasan jumlah toko/link dan aksi ke katalog Supplier.
- Nama Raw Material wajib unik case-insensitive; kategori wajib aktif dengan tipe `raw_material_group`; satuan stok wajib berasal dari daftar unit yang didukung.
- Nilai stok, minimum stok, harga, dan modal tidak boleh negatif. Stok awal > 0 wajib mempunyai modal stok awal > 0.
- `averageActualUnitCost` tidak boleh diedit melalui update master. Backend wajib preserve nilai terbaru dan menghitung weighted average secara atomic pada Pembelian Bahan Baku.
- Raw Material tidak boleh dinonaktifkan jika masih mempunyai current/reserved stock pada master, varian aktif, atau varian arsip.
- Raw Material juga tidak boleh dinonaktifkan jika masih dipakai BOM aktif atau proses produksi aktif yang menyimpan referensi material tersebut.
- Guard nonaktif wajib berada di backend; menyembunyikan/toggle-disable di UI saja tidak cukup.
- Link Pembelian/restock historis hanya boleh dibuka jika skemanya `http://` atau `https://`.

## 17. Rule Maintenance Center dan Backup Data Aman

- Supplier adalah protected master data dan collection `supplierPurchases` tidak boleh ikut aksi maintenance default.
- Maintenance hanya untuk admin, bukan flow harian user operasional.
- Jalur utama pemulihan data adalah Backup & Restore resmi, bukan tombol reset transaksi/testing lama.
- Repair stok tetap hanya menyamakan field turunan dan tidak boleh membuat inventory log palsu.
- Rebuild stock read model hanya menulis tabel `stock_read_models` dari Product/Raw Material/Semi Finished; dilarang mengubah current/reserved/available stock pada master.
- Cleanup orphan stock read model wajib keyword `BERSIHKAN DATA STOK`, backup `pre-repair`, transaction, dan audit log.
- Import backup wajib atomic antara file package, `backup_logs`, dan audit log; kegagalan setelah file ditulis harus membersihkan file dan rollback registry.
- Repair otomatis hanya boleh diaktifkan setelah backend SQLite menyediakan audit/preview nyata, guard, transaction, dan audit log resmi. Service no-op tidak boleh ditampilkan sebagai sukses.
- Export Data Master bersifat arsip/review manual, bukan import atau restore otomatis.
- Maintenance Center tidak menampilkan reset transaksi atau reset HPP. Pengujian destructive dipisahkan ke **Lab Pengujian** dan hanya tersedia pada database sandbox terpisah dengan guard backend.
- Reset destructive baru hanya boleh dibuat setelah desain guard baru disetujui: backup otomatis, preview dampak, protected master, keyword, audit log awal/akhir, dan batas operasi aman.

## 19. Rule Purchases Supplier Catalog dan Verifikasi Harga

- Form Purchases membaca `supplier_catalog_offers` berdasarkan jenis item, item, varian, dan supplier yang dipilih.
- Supplier dropdown hanya menampilkan toko yang memiliki penawaran aktif dan tersedia untuk item/varian tersebut; jangan fallback diam-diam ke semua supplier.
- Setelah supplier dipilih, user wajib memilih satu link/paket katalog. Link transaksi menjadi snapshot dari penawaran tersebut dan bukan input URL bebas.
- Prefill katalog boleh mengisi satuan beli, konversi, tipe online/offline, harga barang, dan estimasi biaya, tetapi user tetap memasukkan biaya aktual transaksi.
- Verifikasi harga wajib dilakukan setelah Qty dan Subtotal Barang aktual tersedia. Harga paket aktual dihitung `Subtotal Barang / Qty Beli`.
- Mengubah supplier, penawaran, Qty, atau Subtotal setelah verifikasi wajib membatalkan status verifikasi dan meminta verifikasi ulang.
- Jika harga aktual berbeda, katalog diperbarui saat commit Pembelian dan histori perubahan dicatat pada toko terkait.
- UI Purchases hanya menampilkan status `Belum diverifikasi`, `Harga sesuai`, atau `Harga berubah`; harga lama dan waktu perubahan tetap berada di Histori Toko.
- `totalStockIn` bahan baku tetap `Qty Beli × Konversi Supplier`; Product memakai Qty Beli sebagai stock-in.
- Purchase wajib menyimpan snapshot nama supplier/item, penawaran, link, satuan, konversi, harga terverifikasi, dan varian agar histori tidak bergantung pada master terbaru.

## 20. Rule Katalog Restock Supplier

- Supplier adalah katalog vendor/restock, bukan transaksi pembelian.
- Tabel utama Supplier tidak menampilkan kode atau ID internal.
- Drawer supplier reusable memiliki tab **Ringkasan**, **Katalog**, dan **Histori Toko**.
- Katalog mendukung Produk dan Bahan Baku, banyak barang per toko, banyak toko per barang, serta banyak link/paket untuk barang yang sama.
- Harga per unit stok dihitung dari `(Qty beli × harga barang + estimasi ongkir + biaya layanan - diskon) / total stok hasil konversi`.
- Harga dan biaya katalog hanya referensi. Ongkir, voucher, diskon, biaya layanan, dan total aktual tetap berasal dari Pembelian.
- Status katalog utama boleh menunjukkan `Perlu dicek`, `Aktif`, `Barang habis`, `Link bermasalah`, atau `Nonaktif` tanpa menampilkan timestamp.
- Pengecekan manual memperbarui status/harga terbaru dan menulis Histori Toko; harga lama tidak ditampilkan pada katalog utama.
- Penawaran yang pernah dipakai transaksi dinonaktifkan, bukan dihapus permanen.

## 21. Rule Stok Masuk Purchases dari Konversi Supplier

- Purchases wajib menampilkan **Stok Masuk total** sebagai informasi utama, bukan menjadikan **Konversi Supplier** sebagai input utama/editable.
- Untuk bahan baku, rumus final tetap: `Stok Masuk = Qty Beli × Konversi Supplier`.
- Konversi Supplier berasal dari penawaran terpilih pada `supplier_catalog_offers.conversion_value`, bersifat read-only di Purchases, dan hanya menjadi sumber hitung stok masuk.
- Qty Beli boleh diubah user dan hanya boleh mengubah Stok Masuk, subtotal default jika belum diedit manual, dan ringkasan pembanding.
- Perubahan Qty Beli tidak boleh mereset Supplier atau penawaran yang masih sesuai item/varian, tetapi wajib membatalkan status verifikasi harga agar harga aktual dikonfirmasi ulang.
- Reject/selisih barang setelah diterima ditangani lewat Penyesuaian Stok agar audit stok tetap jelas, bukan dengan mengubah konversi di Purchases.
- Selisih Hemat tetap dihitung dari `Total Pembanding Supplier - Total Aktual Pembelian` dan hanya menjadi informasi efisiensi, bukan pengurang kas.

## 21.1 Rule UI Preview Stok Aktual dan Breakdown Purchases

Status: **AKTIF + GUARDED**.

- Modal Purchases wajib menampilkan preview stok aktual sebelum restock setelah user memilih item dan/atau varian.
- Untuk item non-varian, preview stok membaca stok master: `currentStock`, `reservedStock`, dan `availableStock`.
- Untuk item bervarian, preview stok wajib memakai stok varian yang dipilih, bukan total master yang menjumlah semua varian.
- Jika item bervarian belum memilih varian, UI wajib meminta user memilih varian terlebih dahulu sebelum menampilkan stok aktual varian.
- Preview stok hanya read-only untuk membantu keputusan restock dan tidak boleh menjadi sumber mutasi stok, expense, inventory log, supplier catalog, atau payload submit.
- Ringkasan perbandingan supplier boleh menampilkan breakdown `subtotalItems`, `shippingCost`, `serviceFee`, `shippingDiscount`, `voucherDiscount`, `totalActualPurchase`, `totalReferencePurchase`, `actualUnitCost`, dan `purchaseSaving`, tetapi tidak boleh memindahkan atau mengubah formula kalkulasi existing.
- `totalActualPurchase` tetap dasar expense/cash-out; `purchaseSaving` tetap informasi efisiensi dan bukan pengurang kas.

## 22. Rule Atomic Save Pembelian

Status: **AKTIF + GUARDED**.

Saat user klik **Simpan Pembelian**, flow aktif wajib menjaga purchase, stok masuk, inventory log, dan expense/cash out sebagai satu rangkaian konsisten.

Ketentuan wajib:
- validasi item, supplier, varian, tanggal, Qty Beli, Stok Masuk, dan Total Aktual dilakukan sebelum write pertama;
- Stok Masuk tetap memakai rule final `Qty Beli × Konversi Supplier`;
- Total Aktual tetap memakai `Subtotal Barang + Ongkir + Biaya Layanan - Diskon Ongkir - Voucher/Koin/Potongan`;
- `actualUnitCost = Total Aktual / Stok Masuk`;
- saving/selisih hemat tetap hanya metadata efisiensi dan tidak mengurangi cash out;
- expense pembelian wajib memakai source reference `sourceModule: purchases` dan `sourceId: purchaseId` agar tidak double;
- inventory log pembelian wajib punya `referenceType: purchase` dan `referenceId` dari purchase yang sama;
- jika transaksi gagal sebelum commit, data tidak boleh tersimpan sebagian.

Catatan data historis:
- flow lama yang menyimpan purchase terlebih dahulu lalu update stok/log/expense satu per satu dianggap rawan partial write;
- flow tersebut tidak boleh dihidupkan kembali tanpa alasan teknis kuat dan test regression.

## 23. Rule Stock Management & Adjustment Guarded — 2026-04-26

Status: **AKTIF + GUARDED**.

- Stock Management adalah halaman audit log + Penyesuaian Stok resmi.
- Membuka Stock Management tidak boleh membuat mutasi stok apa pun.
- Tabel Riwayat Pergerakan Stok wajib fokus pada: Tanggal, Arah, Sumber, Item, Qty, Referensi Audit, dan Catatan.
- Kolom generik `Stok` tidak boleh ditampilkan jika snapshot before/after belum reliable untuk semua log.
- Jangan mengisi kolom stok historis memakai stok saat ini, karena itu bukan audit history.
- Jika semua writer inventory log nanti sudah konsisten menyimpan snapshot, kolom boleh kembali dengan label eksplisit seperti `Stok Setelah` atau `Stok Sebelum/Sesudah`.
- Catatan log harus ringkas di tabel; catatan lengkap boleh tersedia lewat tooltip/detail.
- Untuk tabel riwayat Penyesuaian Stok, field `reason` dan `note` tetap tersimpan terpisah di `stock_adjustments`, tetapi UI tabel boleh menggabungkan keduanya menjadi satu kolom `Alasan & Catatan` agar tidak menampilkan info audit dobel.
- Jika `note` kosong atau sama dengan `reason`, tabel riwayat Penyesuaian Stok hanya boleh menampilkan satu informasi ringkas; data mentah tetap tidak dihapus.
- Catatan OCR Shopee dari purchase tidak boleh ditampilkan mentah panjang di tabel Stock Management. Tabel cukup menampilkan tag `OCR Shopee`, ringkasan konversi stok bila ada, dan detail lengkap tetap tersedia di tooltip/detail.
- Submit Penyesuaian Stok wajib menjaga stock adjustment, mutasi stok, dan inventory log sebagai satu rangkaian konsisten.
- Area ini tidak boleh dipakai untuk hitung ulang stok dari semua transaksi saat halaman dibuka.

## 24. Rule Final Auth, Role, dan Manajemen User — SQLite Runtime — 2026-06-07

Status: **AKTIF + GUARDED + SOURCE-VERIFIED SQLITE**. Section ini menggantikan catatan lama Auth runtime arsip/database arsip setelah source aktual memakai local auth SQLite.

### 24.1 Prinsip Auth final

- SQLite local auth adalah source of truth untuk password hash, session/token lokal, profile internal, role, status, dan metadata user IMS.
- Login IMS memakai username di UI; backend `/api/auth/login` memvalidasi username + password ke tabel SQLite, bukan auth lama.
- `AuthContext.jsx` memakai `authUser` sebagai nama state utama. Nama lama terkait auth provider lama tidak boleh dihidupkan ulang.
- User tanpa session/token lokal valid wajib ditolak masuk aplikasi utama.
- User dengan `status = inactive` wajib ditolak masuk aplikasi utama.
- Role tidak dikenal wajib default deny.
- Password plaintext, token rahasia, service account, credential Admin SDK, atau secret tidak boleh disimpan di frontend/source.

### 24.2 Role aktif final

| Role | Status | Akses utama | Batasan wajib |
|---|---:|---|---|
| `administrator` | **AKTIF / GUARDED** | Admin utama aplikasi. Mengakses menu sistem, Manajemen User, Reset & Maintenance, dan menu operasional sesuai route guard. | Tetap wajib mengikuti business rules stok, kas, pembelian, penjualan, produksi, payroll, HPP, dan laporan. Tidak boleh mengubah role/status dirinya sendiri dari Manajemen User. |
| `user` | **AKTIF / GUARDED** | Operator harian untuk stock adjustment, purchases, sales, returns, production planning, production orders, dan production work logs sesuai access matrix. | Tidak boleh membuka Manajemen User, Reset & Maintenance, route sistem sensitif, master/setup, finance manual, payroll, HPP, reports, atau melakukan manajemen role/profile user lain. |

Role `super_admin` adalah **REMOVED FROM ACTIVE FLOW**. Role ini tidak boleh dibuat, dipilih, disimpan sebagai target profile baru, atau dipakai sebagai compatibility aktif setelah cleanup data selesai.

### 24.2.1 Access matrix menu final

Status: **AKTIF / GUARDED**. Matrix ini menyelaraskan `roleAccess.js`, `sidebarMenu.js`, dan route guard. Perubahan matrix hanya membatasi visibilitas/akses menu; tidak mengubah business rules, kalkulasi, schema, atau flow transaksi.

| Area menu | Administrator | User | Catatan guard |
|---|---:|---:|---|
| Dashboard | Ya | Ya | Shared read/summary sesuai route aktif. |
| Master Data | Ya | Tidak | Admin-only karena dapat mengubah referensi bisnis seperti produk, raw materials, kategori, supplier, customer, dan pricing. |
| Pricing Rules | Ya | Tidak | Admin-only karena memengaruhi harga/margin. |
| Stock Control | Ya | Ya | Operasional harian. Backend boleh membuka commit stock adjustment untuk `administrator` dan `user`; validasi stok dan audit log tetap wajib backend. |
| Production Operation | Ya | Ya | Meliputi create/update Production Planning, Order Produksi, dan Work Log Produksi. Delete/cleanup dan setup produksi tetap admin-only. |
| Production Setup | Ya | Tidak | Admin-only karena mengubah setup produksi, BOM, semi product, karyawan, dan template. |
| Cost & Analysis | Ya | Tidak | Admin-only karena berhubungan dengan payroll, HPP, dan analisis biaya. |
| Transaksi | Ya | Ya | Backend commit Purchases, Sales, update status Sales, dan Returns boleh untuk `administrator` dan `user`; finance side effect tetap idempotent di backend. |
| Kas & Biaya | Ya | Tidak | Admin-only karena data finance sensitif. |
| Sistem | Ya | Tidak | Manajemen User dan Reset & Maintenance selalu admin-only. |
| Laporan | Ya | Tidak | Admin-only karena laporan dapat memuat finance, payroll, HPP, dan laba/rugi. |

User biasa tidak boleh melihat menu sensitif di sidebar dan tidak boleh membuka route sensitif lewat URL langsung. Route guard tetap wajib selaras dengan sidebar guard.

### 24.2.2 Backend guard operasional harian

Status: **AKTIF / GUARDED**. Frontend route/menu guard dan backend write guard wajib selaras agar role `user` tidak bisa membuka halaman operasional tetapi gagal saat menyimpan.

Backend boleh memakai guard operasional `administrator + user` hanya untuk endpoint harian berikut:

- `POST /api/transactions/purchases/commit`
- `POST /api/transactions/sales/commit`
- `PUT /api/transactions/sales/:id/status`
- `POST /api/transactions/returns/commit`
- `POST /api/stock/adjustments/commit`
- Create/update `production/planning`, `production/orders`, dan `production/work-logs` lewat router produksi SQLite.

Backend tetap wajib `administrator` untuk area berikut:

- User Management, Maintenance, Backup/Restore, dan Module Runtime Status.
- Master/setup data, pricing rules, production steps, employees, profiles, BOM, semi product setup.
- Cash In/Cash Out manual, ledger, reports sensitif, payroll final/paid, dan HPP analysis.
- Delete/cleanup data produksi/transaksi kecuali flow resmi yang sudah memiliki guard bisnis eksplisit.

Guard operasional tidak boleh memindahkan business rule ke UI. Validasi stok, side effect finance, audit log, idempotency, dan atomic transaction tetap harus berada di backend.

### 24.3 Flow create user aktif

```text
Administrator login SQLite
-> Sistem > Manajemen User > Tambah User
-> input username + displayName + role + status + password
-> userService / localAuthService
-> backend /api/auth/users
-> validasi actor administrator, username unik, role/status allowlist, self/last-admin guard
-> simpan user lokal SQLite + password hash backend
-> audit log backend bila tersedia
-> tabel Manajemen User reload
```

Login pertama boleh bootstrap administrator lokal hanya melalui flow backend yang guarded saat belum ada admin aktif. Bootstrap wajib memakai kode setup acak yang tampil di terminal backend dan tidak boleh dikirim melalui endpoint status/browser. Setelah administrator aktif tersedia, endpoint bootstrap terkunci dan pembuatan user berikutnya wajib melalui administrator.

### 24.4 Field user aktif

Field user yang dikelola backend SQLite:

- `id` / `authUid` internal lokal
- `username`
- `usernameLower`
- `displayName`
- `role`: hanya `administrator` atau `user`
- `status`: `active` atau `inactive`
- `passwordHash` hanya di backend/database, tidak pernah dikirim ke UI
- `createdAt`
- `updatedAt`
- `createdBy`
- `updatedBy`
- `lastLoginAt` bila tersedia

Field yang tidak boleh disimpan di frontend/source:

- password plaintext
- password sementara jangka panjang
- token rahasia
- credential Admin SDK
- service account
- API key/secret non-public

### 24.5 Guard Manajemen User

- Username wajib unik melalui `usernameLower`.
- `administrator` boleh membuat/mengelola role aktif `administrator` dan `user`.
- `user` tidak boleh membuka Manajemen User dan tidak boleh membuat/mengelola user lain.
- User tidak boleh mengubah role/status dirinya sendiri dari Manajemen User.
- Hapus/nonaktifkan user diri sendiri wajib ditolak.
- Hapus/nonaktifkan administrator aktif terakhir wajib ditolak oleh backend/service/UI.
- Reset password atau perubahan credential wajib lewat backend resmi; jangan membuat hash password di frontend.

### 24.6 Data historis / arsip migrasi runtime arsip

- auth lama, database arsip `system_users/{uid}`, rules database arsip, dan domain `username@ziyocraft.com` adalah **ARSIP MIGRASI** untuk source saat ini.
- Jangan membuat user runtime arsip, menempel UID Auth, mengubah rules database arsip, atau menghidupkan fallback runtime arsip untuk task Auth/User Management tanpa approval eksplisit dan validasi source baru.
- Jika menemukan komentar/source variable bernama lama, audit import/usage dulu. Nama compatibility tidak otomatis berarti runtime arsip aktif.

### 24.7 Boundary yang tidak berubah

Patch Auth/User Management tidak boleh mengubah rumus stok, Purchases, Returns, Sales, Stock Management / Stock Adjustment, Supplier sebagai katalog restock, Production, Payroll, HPP, Reports/export, Dashboard read-only, Pricing Rules, atau Reset & Maintenance business flow.

## 11. Rule Batch Fix Bug Merge — 2026-05-03

### 11.1 Format angka tanpa desimal
- Tampilan angka, qty, stok, Rupiah, summary, report, dan input UI aktif diarahkan tanpa decimal.
- `formatNumberId`, `formatQuantityId`, `formatPercentId`, dan parser input integer menjadi standar UI.
- Perubahan ini tidak mengubah rumus transaksi, schema SQLite/backend, atau migrasi/backfill data historis.
- Jika suatu hari ada satuan yang wajib decimal secara bisnis, pengecualian harus dibahas eksplisit sebagai business rule baru.

### 11.2 Production Order dan material variant strict
- Jika target/BOM/material memakai varian, preview kebutuhan PO wajib membaca bucket stok varian yang dipilih/terselesaikan.
- Material bervarian tidak boleh fallback diam-diam ke master/default ketika varian tidak ditemukan.
- Start Production dari PO memakai `materialRequirementLines` sebagai kontrak final ke `materialUsages` Work Log.
- Jika kontrak varian PO tidak valid, user harus refresh need/perbaiki BOM sebelum produksi dimulai.

### 11.3 Work Log output stock audit
- Complete Work Log tetap menjaga guard agar output stock tidak diposting dobel.
- Inventory log `production_output_in` baru menyimpan metadata Work Log, PO, step, varian, dan worker/operator jika tersedia.
- Log lama tanpa worker metadata tetap valid dan tidak di-backfill otomatis.

### 11.4 Generic variant label and rename
- Edit nama/label varian existing hanya mengganti label tampilan/metadata.
- `variantKey` tetap menjadi identitas bucket stok/reference.
- `stock`, `currentStock`, `reservedStock`, dan `availableStock` varian tetap dipreserve dari data existing/latest.
- Rename nama/label varian tidak membuat inventory log palsu, tidak memigrasi PO/Work Log lama, dan tidak membuka edit stok langsung dari master.

### 11.5 UI non-business-flow cleanup
- Sidebar nested accordion dan Login UI copy cleanup adalah perubahan UI; keduanya tidak mengubah stok, transaksi, produksi, laporan, AuthContext, role access, rules database arsip, atau schema.

## Update Business Rules — Cash In delete lock dan Sales status tab — 2026-05-03

### Cash In / Pemasukan sebagai ledger aman
- Halaman Pemasukan membaca gabungan `revenues` dan `incomes` sebagai tampilan ledger pemasukan aktif.
- `revenues` tetap menjadi sumber pemasukan manual/lama, sedangkan `incomes` tetap menjadi pemasukan otomatis dari Sales berstatus `Selesai`.
- Menu Pemasukan tidak menyediakan tombol Hapus untuk mengurangi risiko penyalahgunaan dan menjaga audit kas.
- Penghapusan pemasukan tidak boleh dilakukan dari UI Pemasukan biasa tanpa task khusus, audit, dan approval eksplisit.
- Perubahan ini tidak menghapus data historis, tidak mengubah `revenues`, tidak mengubah `incomes`, dan tidak mengubah Profit Loss yang membaca `revenues + incomes + expenses`.

### Sales status tab
- Tabel Sales wajib menampilkan row sesuai tab status aktif.
- Tab `Semua Penjualan` boleh menampilkan semua status.
- Tab `Diproses`, `Dikirim`, dan `Selesai` hanya boleh menampilkan row dengan status yang sama.
- Search resi/order/reference harus tetap bekerja di dalam batas status tab aktif.
- Guard tab status adalah guard tampilan; tidak boleh mengubah status transition, mutasi stok, income timing, Return, dashboard, atau reports.


## Update Business Rules — Sales pending income, no-delete Sales, dan selector stok ringkas — 2026-05-03

### Sales pending income display-only
- Sales berstatus `Diproses` dan `Dikirim` boleh dihitung sebagai **Pemasukan Pending** hanya untuk monitoring di halaman Sales.
- Pemasukan Pending adalah estimasi/potensi uang yang belum masuk resmi; nilai ini **tidak boleh** ditulis ke `revenues`, `incomes`, atau collection baru.
- Pemasukan Pending **tidak boleh** tampil sebagai pemasukan resmi di menu Pemasukan / Cash In dan **tidak boleh** masuk Profit Loss.
- Sales berstatus `Selesai` tetap menjadi dasar income resmi sesuai flow aktif.
- Offline tetap mengikuti flow aktif yang biasanya otomatis `Selesai`; WhatsApp boleh masuk pending jika statusnya `Diproses`/`Dikirim`, tetapi WhatsApp tidak boleh otomatis dianggap Offline tanpa keputusan business rule terpisah.

### Sales no-cancel/no-delete user action
- Tabel Sales tidak menyediakan tombol **Batalkan**, **Delete**, atau **Hapus** sebagai aksi operasional biasa.
- Row `Diproses` hanya boleh menyediakan aksi lanjut ke `Dikirim`.
- Row `Dikirim` hanya boleh menyediakan aksi lanjut ke `Selesai`.
- Row `Selesai` tidak menyediakan aksi status lanjutan dari tabel Sales.
- Jika barang kembali atau transaksi perlu dikoreksi setelah tercatat, user wajib memakai modul Return agar dokumen return, stok masuk, dan inventory log tetap terpisah.
- Hard delete Sales, jika suatu hari dibutuhkan, harus menjadi maintenance flow guarded dengan approval dan audit trail, bukan tombol tabel reguler.

### Sales selector dan info stok
- Selector item Sales boleh memisahkan Produk Jadi dan Bahan Baku melalui field UI **Jenis Item**, tetapi payload akhir tetap memakai `collectionName`, `itemId`, `variantKey`, dan `stockSourceType`.
- Dropdown item/varian cukup menampilkan nama item/varian dan jenis item; detail stok tersedia cukup tampil di panel read-only stok.
- Panel stok read-only hanya informasi snapshot; validasi dan mutasi stok tetap memakai guard `availableStock` dan helper stok aktif.

## 24. Rule Tampilan Saldo Stok Locked — 2026-05-06
- Table yang menampilkan **saldo stok item/master** harus menampilkan `Total`, `Tersedia`, dan semua variant pill langsung di table bila row memiliki `variants[]`.
- Variant pill tidak boleh menambah teks status panjang seperti `Kosong`/`Stok Rendah` di dalam pill karena membuat tabel berantakan saat varian banyak. Status varian boleh diberi tone visual soft, sedangkan ringkasan varian bermasalah ditaruh sebagai caption ringkas di area status/nama item.
- Untuk Product/Semi Finished bervarian, status low-stock utama wajib membaca setiap varian terhadap threshold master `minStockAlert`.
- Untuk Raw Material bervarian, status low-stock wajib membaca setiap varian terhadap `variants[].minStockAlert`; aggregate master hanya ringkasan dan tidak boleh membuat item terlihat aman jika satu varian kosong/di bawah minimum.
- Rule ini berlaku untuk tampilan saldo stok item seperti Products, Raw Materials, Semi Finished Materials, Dashboard Stok Kritis, dan Stock Report.
- Rule ini tidak berlaku untuk Qty transaksi, Stok Masuk Purchases, Stock Adjustment quantity, inventory log delta, atau field audit lain yang bukan saldo stok master. Untuk inventory log delta, Qty boleh menampilkan satuan dari `stockUnit`/`unit`, tetapi tidak boleh berubah menjadi komponen saldo stok master.
- Perubahan tampilan compact table tidak boleh mengubah rumus stok, mutation, reserved stock, available stock, HPP, pricing, export mapping, atau schema SQLite/backend.

## Update Business Rules — Buku Besar Kas / Log Pergerakan Uang — 2026-05-09

Buku Besar Kas adalah halaman audit read-only untuk melihat uang masuk dan uang keluar aktual dari data kas existing.

Source of truth nominal utama:
- `incomes` untuk uang masuk resmi dari Sales berstatus `Selesai`.
- `revenues` untuk uang masuk manual / data historis dari Cash In.
- `expenses` untuk uang keluar dari Cash Out manual, purchase expense, payroll paid, dan expense lain.

Collection yang tidak boleh dipakai sebagai nominal utama ledger kas:
- `sales` karena Sales selesai sudah membuat dokumen pemasukan di `incomes`.
- `purchases` karena Purchase yang berdampak kas sudah membuat dokumen pengeluaran di `expenses`.
- `production_payrolls` karena Payroll paid yang berdampak kas sudah membuat dokumen pengeluaran di `expenses`.
- `production_work_logs` karena Work Log adalah aktivitas produksi/HPP, bukan pembayaran kas langsung.
- `inventory_logs` dan `stock_adjustments` karena mutasi stok bukan mutasi uang.

Guard wajib:
- Halaman Buku Besar Kas tidak boleh melakukan `addDoc`, `setDoc`, `updateDoc`, atau `deleteDoc`.
- Halaman Buku Besar Kas tidak boleh membuat collection baru `money_movement_logs`.
- Membuka halaman Buku Besar Kas tidak boleh membuat transaksi, audit log, backfill, saldo, stok, HPP, atau posting kas baru.
- Summary Buku Besar Kas adalah total row sesuai filter, bukan saldo akhir kas karena saldo awal dan rekonsiliasi bank belum menjadi bagian fitur ini.
- Akses menu dan route Buku Besar Kas mengikuti finance sensitive area: Administrator only.

## Reset & Maintenance Development Rules
- **Audit otomatis:** subset read-only nyata sudah aktif di backend untuk integrity SQLite, invariant stok, projection stok, registry backup, dan kas-ledger. Stub/no-op area lain tidak boleh menghasilkan status sukses atau evidence resmi.
- **Repair otomatis:** hanya stock read model missing/stale dan orphan projection yang aktif. Aksi wajib berdasarkan audit terbaru, membuat backup `pre-repair`, memakai transaction, audit log, dan keyword untuk cleanup. Repair area bisnis lain tidak boleh dibuat hanya di frontend.
- **Reset/destructive testing:** tidak tersedia di Maintenance Center dan tidak boleh memakai blanket `DELETE`. Lab Pengujian hanya boleh mengembalikan database sandbox ke backup baseline verified.
- **Sandbox guard:** wajib `IMS_ENABLE_TESTING_LAB=true`, `IMS_DATABASE_PURPOSE=sandbox`, path database berbeda dari database operasional default, dan folder backup berbeda dari storage backup operasional.
- **Baseline:** dibuat sebagai backup resmi tipe `test`, mempunyai checksum/integrity/account guard, dan dipilih eksplisit sebagai baseline aktif.
- **Reset sandbox:** admin-only, keyword `RESET SANDBOX`, menolak ketika masih ada operasi tulis aktif, membuat backup `pre-reset`, memakai restore guarded existing, mencatat audit, lalu mengirim event `database_replaced` agar seluruh client reload.
- **Skenario testing:** data dibuat melalui menu/route/service operasional existing. Lab tidak menyisipkan data langsung ke tabel dan tidak memindahkan business logic ke UI.
- **Database operasional:** endpoint testing tetap menolak meskipun frontend dimanipulasi. Badge `MODE TESTING` hanya muncul ketika backend benar-benar memakai purpose sandbox.
- **Export data master:** direkomendasikan sebelum maintenance besar. Export bersifat arsip/review, bukan import atau restore otomatis.
- **Protected master:** tidak boleh dilepas dari guard tanpa approval khusus.
- **Data real:** jangan lakukan maintenance besar pada data real/semi real tanpa backup/export dan audit dampak.
- **Repair aktif:** hanya projection `stock_read_models` missing/stale dan orphan yang sudah didukung backend. Stub/no-op frontend dilarang ditampilkan sebagai fitur.
- **Riwayat resmi:** backup, restore, import, repair, cleanup, retention, dan promosi monthly dibaca dari database audit log, bukan session browser.


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
- internal database ID teknis/random tidak boleh tampil sebagai kode audit/user-facing.
- Data historis dengan prefix lama tetap compatibility, tetapi bukan standar data baru.


### Business rule final untuk generator

- Daily reference code memakai format `PREFIX-DDMMYYYY-001`.
- Master item/config produksi memakai format `PREFIX-001`, `PREFIX-002`, dan seterusnya; tidak memakai readable target/nama di kode baru.
- Prefix dengan hyphen seperti `STK-ADJ`, `CSH-IN`, dan `CSH-OUT` valid dan wajib diperlakukan sebagai satu prefix bisnis.
- `saleNumber` untuk Sales tetap dipertahankan sebagai field compatibility, tetapi value data baru wajib `ORD-DDMMYYYY-001`.
- `cashOutNumber` untuk Cash Out wajib `CSH-OUT-DDMMYYYY-001`, bukan `CSH-OT`.


### Business rule: kode internal master item/config

- Product, Raw Material, Semi Finished, BOM, dan Production Step boleh menyembunyikan input code dari form dan table utama.
- Service tetap wajib generate code otomatis saat create walaupun UI tidak mengirim `code`.
- Code master item/config immutable saat edit; perubahan nama/kategori/warna/target tidak boleh regenerate code existing.
- User tidak boleh input manual code master item/config.
- Field `code` tidak boleh dihapus dari payload/data karena masih dipakai internal reference, export, dan audit teknis.
- Nomor referensi transaksi dan audit bisnis tetap ditampilkan bila diperlukan operasional. Kode master Customer/Supplier serta seluruh ID teknis tetap backend-only dan tidak ditampilkan pada UI utama.
- SKU Variant/kode variant tetap compatibility/backstage; UI utama cukup menampilkan nama varian, status, dan stok.


## Update 2026-05-22 — Service Extraction Transaksi dan Read Path

### Sales
- Source of truth flow penjualan tetap `sales`.
- Pembuatan Sales sekarang diorkestrasi melalui `src/services/Transaksi/salesService.js`.
- Income otomatis tetap hanya dibuat saat status final `Selesai`.
- Guard stok varian tetap wajib: item yang punya varian tidak boleh mengurangi stok master/default.
- Pembatalan Sales tetap tidak disediakan sebagai status update langsung; barang kembali harus lewat Return.

### Returns
- Return menulis dokumen return, update stok, dan inventory log dalam satu backend transaction/atomic commit.
- Return wajib terkait Sales melalui `relatedSaleId` dan menyimpan `saleReference`.
- Item Return hanya boleh berasal dari item Sales yang dipilih.
- Qty Return maksimal = qty item pada Sales - qty item yang sudah pernah diretur.
- Return aktif adalah stock-only correction: tidak membuat `incomes`, `revenues`, `expenses`, atau ledger finance otomatis.
- Orkestrasi transaksi Return dipindah ke `src/services/Transaksi/returnsService.js` dan validasi final tetap diulang di backend.

### Purchases
- Pembuatan Purchase sekarang diorkestrasi melalui `src/services/Transaksi/purchasesService.js`.
- Efek Purchase tetap atomik: dokumen purchase, stok masuk, inventory log, dan expense otomatis dibuat dalam transaction yang sama.
- OCR UI/parser, filter supplier catalog, dan flow average cost tidak diubah oleh refactor ini.
- Expense otomatis pembelian tetap membaca amount dari total aktual, bukan saving.

### Dashboard dan Laporan
- Dashboard tetap read-only dan query orchestration dipindah ke `src/services/Dashboard/dashboardService.js`.
- Laporan Sales/Purchases/Profit Loss memindahkan fetch data ke `src/services/Laporan/reportsService.js`.
- Stock Report memindahkan fetch data ke `src/services/Laporan/stockReportService.js`.
- Rule laporan tidak berubah: Profit Loss tetap `revenues + incomes - expenses`, Purchases Report tetap dari `expenses`, Sales Report tetap dari `sales`.


### Batch 16D — Production Planning dan Karyawan Produksi Counter

- Production Planning baru memakai managed code backend `PLN-001`; ID dapat mengikuti code final untuk record baru bila client memakai preview code sebagai ID.
- Sequence Planning memakai runtime `business_code_counters` dan baseline tabel SQLite aktif; flow `addDoc`/collection sequence lama tidak dipakai runtime.
- Karyawan Produksi baru memakai managed code backend `EMP-001` melalui runtime `business_code_counters`; kode historis dengan format lama tetap compatibility dan tidak di-rename.
- Tidak ada collection sequence terpisah yang dihidupkan kembali; baseline dibaca dari field `code` pada tabel SQLite aktif.
- Tidak ada migration/rename data historis; relasi Work Log, Payroll, dan PO existing wajib tetap aman.


## Update Business Rules — Transaction Side-Effect Repair guarded — 2026-05-23

Status: **BELUM TERSEDIA / MANUAL REVIEW ONLY**.

- Flow transaksi aktif tetap sama: Sales membuat stock out + inventory log, dan income hanya saat status `Selesai`; Purchases membuat purchase + stock in + inventory log + expense; Return tetap stock-only correction + inventory log tanpa income/expense/revenue otomatis.
- Maintenance saat ini hanya menyediakan audit/read-only untuk mendeteksi masalah data dan rekonsiliasi finance. Tidak ada endpoint atau tombol aktif **Repair Side-Effect Transaksi**.
- Side-effect transaksi yang hilang harus direview manual berdasarkan source transaction, inventory log, audit log, income/expense, dan ledger. Jangan membuat record pengganti langsung tanpa patch guarded yang disetujui.
- Repair future, bila disetujui, tidak boleh mengubah stok master/variant, dokumen `sales`/`purchases`/`returns`, payroll/HPP, atau membuat refund Return; wajib dry-run, idempotency, pre-repair backup, keyword, transaction, dan audit ulang.


## SQLite Local DB runtime pilot — Patch A-B — 2026-06-02

Status: **AKTIF / SQLITE-FIRST PILOT / BROWSER-LOCAL DATA HISTORIS CLEANUP SELESAI**.

Rule aktif:
- Runtime offline/local web sekarang memakai SQLite sidecar lewat backend Node.js lokal/LAN, bukan database browser arsip.
- `frontend/.env.example` dibuat SQLite-first: `VITE_AUTH_MODE=sqlite`.
- `.env.local` tidak boleh di-commit.
- `VITE_SUPPLIERS_REPOSITORY_MODE=sqlite` aktif untuk Supplier. Relasi purchase/raw/history tetap wajib mengikuti service/endpoint SQLite aktual dan tidak boleh direct write dari UI.
- Categories dan Customers boleh CRUD lewat repository SQLite/backend.
- runtime arsip tidak dipertahankan sebagai fallback runtime aktif; repository mode source aktif hanya `sqlite_sidecar`.
- Konstanta mode lama `offline_local` dan `hybrid_sync` sudah dihapus dari `repositoryMode.js` agar tidak terlihat sebagai mode aktif.

Cleanup yang sudah dilakukan:
- Folder data historis `src/data/adapters/database-browser-arsip/`, `src/data/local/`, dan `src/data/sync/` dihapus dari source aktif.
- Panel database browser arsip yang tidak masuk route aktif dihapus: `OfflineLocalDbBackupPanel`, `OfflineMasterDataPilotPanel`, `OfflineQaExecutionPanel`, dan `OfflineSyncDevPanel`.
- UI aktif untuk database lokal hanya `OfflineDatabaseCenter.jsx` / Database Center di area Maintenance.

Guard tetap berlaku:
- Tidak ada `sync queue arsip` storage browser arsip runtime.
- Tidak ada backup/restore JSON storage browser arsip runtime.
- Tidak ada auto-sync runtime arsip ke SQLite untuk transaksi.
- Stock, purchase, sales, returns, finance, reports, production, payroll, HPP, maintenance destructive flow, route/menu/role guard, dan rules database arsip/index tidak berubah.
- Restore SQLite destructive tetap wajib admin lokal, preview/plan, file backup eksplisit, keyword guard, dan backup otomatis.

Kontrak resmi: `docs/10_OFFLINE_DATABASE_CONTRACT.md`.

## Update Rule Finance Manual vs System Idempotency — 2026-06-21
- Cash In/Cash Out manual dengan `id` atau `code` yang sudah ada wajib ditolak `409 FINANCE_DUPLICATE_MANUAL_REFERENCE`; transaksi manual tidak boleh diam-diam meng-overwrite catatan kas lama.
- Posting sistem dari Sale/Purchase/Payroll tetap idempotent berdasarkan source ID agar retry tidak membuat ledger duplikat. Guard manual tidak boleh memutus idempotency system side-effect.

## Update 2026-06-28 — Realtime SQLite dan Kebijakan Nonaktif/Purge

Status: **AKTIF / GUARDED**.

### Realtime lintas perangkat dan tab pengirim
- Backend memublikasikan invalidasi data melalui Server-Sent Events (SSE) administrator/user yang sudah login. SSE hanya membawa revision, tabel, dan scope; data bisnis tetap dibaca ulang melalui endpoint HTTP ber-role guard.
- Event perubahan hanya boleh dikirim setelah write/transaction SQLite berhasil commit. Rollback tidak boleh mengirim event.
- Client asal mutation tetap menerima event commit dan menandainya sebagai local-origin. Dengan begitu tab yang melakukan save, tab lain, dan perangkat lain memakai jalur refresh scope yang sama; halaman boleh tetap melakukan optimistic/local state update dari response mutation untuk feedback instan.
- `X-IMS-Client-ID` wajib unik per tab/page instance. Browser ID boleh persisten, tetapi page-instance ID wajib dibuat ulang setiap page load agar tab duplicate tetap menerima event dari tab pengirim.
- `fetchSqliteJson()` menjadi satu-satunya injector header `X-IMS-Client-ID` untuk request JSON normal; adapter tidak boleh membuat origin header sendiri-sendiri. Identitas browser/page wajib stabil selama tab hidup meskipun storage browser dibersihkan atau tidak tersedia.
- Request mutation backend hanya boleh mengambil origin dari header `X-IMS-Client-ID`; query `clientId` hanya dipakai oleh koneksi EventSource karena native EventSource tidak mendukung custom header. Backend wajib memakai normalisasi client ID yang sama untuk request mutation dan registrasi SSE.
- Saat form, modal, drawer, popover, atau input aktif, refresh otomatis harus ditahan dan UI menampilkan `Data baru tersedia` agar pekerjaan user tidak hilang. Setelah kondisi form aman, pending refresh wajib berjalan otomatis tanpa menunggu user pindah tab atau menekan tombol manual.
- Jika SSE putus/tidak didukung, satu fallback revision global berjalan 60 detik, tidak overlap, berhenti saat tab tersembunyi, dan langsung catch-up saat tab kembali terlihat. Adapter data tidak boleh membuat polling interval masing-masing; API subscription legacy hanya melakukan initial load.
- Perubahan profile akses dari tabel `users/roles` wajib memvalidasi ulang `/api/auth/me`, memperbarui AuthContext, dan menyambung ulang SSE agar snapshot role koneksi tidak stale. Perubahan profile biasa tidak boleh memaksa reload browser penuh; hanya `session_expired` dan `database_replaced` yang memakai reload global. Perubahan session login/logout biasa memakai scope `auth_session` dan tidak boleh me-reload seluruh device.
- Koneksi SSE wajib mengikuti `expiresAt` session. Ketika session habis, backend mengirim `session_expired`, menutup stream, dan frontend melakukan reload agar user kembali melalui auth gate.
- Revision fallback untuk role `user` hanya boleh berubah pada event yang memang terlihat oleh role tersebut; event audit/maintenance/finance administrator-only tidak boleh memicu wildcard refresh user.
- Koneksi SSE dibatasi secara defensif per server, user, dan IP. Saat buffer client tidak mampu menerima event, koneksi ditutup agar EventSource reconnect dan fallback revision melakukan catch-up, bukan menahan memory tanpa batas.
- Restore database wajib mengirim event `database_replaced`; semua client melakukan reload aman dan validasi session ulang.

### Nonaktif sebagai operasi standar
- Menu operasional tidak boleh melakukan hard-delete master atau user. Aksi regular harus berupa `inactive`, `deleted` logis, atau arsip varian agar histori transaksi, audit, dan kode lama tetap dipertahankan.
- Tombol dan pesan UI harus memakai istilah `Nonaktifkan` atau `Arsipkan`, bukan `Hapus`, untuk entitas yang record-nya tetap disimpan.
- Customer, Kategori, Supplier, Aturan Harga, User, Kas Keluar manual, serta master generic memakai soft-delete/nonaktif sesuai guard domain masing-masing.
- Varian zero-stock yang dikeluarkan dari master dipindahkan ke `archivedVariants` dan mencatat histori; varian berstok/reserved tetap ditolak.

### Hapus permanen hanya dari Maintenance
- Hard-delete hanya tersedia untuk administrator pada tab `Data Nonaktif` dan hanya untuk allowlist: Customer, Kategori, Supplier, Aturan Harga, dan User yang sudah nonaktif/deleted logis.
- Stok, inventory log, purchase, sales, return, finance, production, payroll, backup/restore history, serta audit log tidak boleh dipurge dari flow ini.
- Sebelum purge, backend wajib menjalankan dependency check atas kolom relasi, hierarchy, katalog/histori supplier, dan seluruh payload bisnis yang relevan. Record yang masih direferensikan harus diblokir.
- Purge wajib memerlukan keyword `HAPUS PERMANEN` dan konfirmasi kedua berupa kode/nama/id target.
- Sistem wajib membuat backup `pre-repair` sebelum purge, menjalankan hard-delete dalam transaction, dan menyimpan snapshot record yang disanitasi pada audit action `inactive_record_purge`.
- Password hash user tidak boleh dimasukkan ke snapshot audit. Audit log purge tidak masuk allowlist purge dan harus tetap dipertahankan.

## Update Rule Produksi Multi-Jenis Bunga — 2026-06-28

Status: **AKTIF / GUARDED**.

- Master **Tahapan Produksi** wajib memakai nama pekerjaan generik yang dapat dipakai lintas jenis bunga, misalnya `Potong Bahan Awal Kelopak`, `Bentuk Kelopak`, `Bentuk Daun`, `Potong Kawat Tangkai`, dan `Rakit Bunga`. Nama Mawar, Tulip, atau jenis lain berada pada master Jenis Bunga, item Semi Finished, dan Resep/BOM.
- Runtime aktif memakai kontrak **1 BOM = 1 target output = tepat 1 Tahapan Produksi = 1 Production Order = 1 Work Log = 1 aturan payroll**. Proses bertingkat wajib dibuat sebagai rantai BOM/PO terpisah agar mutasi stok, payroll, dan HPP setiap tahap dapat diaudit.
- BOM tanpa step atau BOM dengan lebih dari satu step ditolak. BOM historis multi-step harus dipersempit menjadi satu step sebelum digunakan kembali.
- Saat **Start Production**, rule payroll master step dibekukan ke Work Log. Snapshot Work Log menjadi source of truth payroll/HPP untuk pekerjaan tersebut; perubahan tarif master setelah Start hanya berlaku untuk Work Log baru. Master step hanya boleh menjadi fallback untuk data historis yang belum memiliki snapshot.
- Satu Work Log baru hanya boleh memiliki tepat **1 operator**. Jika pekerjaan dibagi beberapa operator, qty/PO/Work Log harus dipisahkan per operator supaya Good Qty tidak dibayar penuh berulang kepada setiap pekerja.
- Operator yang dipilih wajib ada dan aktif. UI memprioritaskan operator yang ditugaskan ke step, tetapi assignment step tetap metadata operasional dan tidak mengganti validasi operator aktif backend.
- Complete Work Log, output stok, payroll draft, accrued labor HPP, penutupan PO, dan audit dilakukan melalui satu endpoint/transaction atomic. Frontend tidak boleh memanggil generate payroll kedua kali setelah complete berhasil.
- Semi Finished boleh tidak memiliki Jenis Bunga untuk komponen **Umum / Reusable**, seperti `Kawat Tangkai 20 cm`, yang digunakan lintas Mawar/Tulip.
- Monitoring Production Profile tidak boleh ditebak dari nama step. Step memakai metadata eksplisit `monitoringMetric` (`none`, `petal`, `leaf`, atau `stem`). Production Profile tetap opsional dan bukan source of truth BOM/HPP.
