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
- Data lama yang belum punya satuan tetap boleh tampil tanpa satuan; jangan backfill/migrasi otomatis hanya untuk display.

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
- simpan transaksi ke `purchases`
- tambah stok item
- untuk bahan baku tertentu update `averageActualUnitCost` dan `restockReferencePrice`
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
- transaksi masuk ke `returns`
- stok item bertambah
- catat `inventory_logs` dengan type `return_in`
- tidak membuat `incomes`, `revenues`, atau `expenses`

Rule aktif Return adalah **stock-only correction**. Return dipakai untuk barang kembali/koreksi stok setelah Sales tercatat, bukan untuk refund/finance otomatis. Jika suatu hari refund, potongan pembayaran, atau koreksi kas atas Return diperlukan, itu wajib menjadi rule finance Return terpisah dengan review guarded, idempotency, dan update ledger/report.

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

## 14. Rule Reset Data Uji
Reset utilitas mendukung mode:
- reset transaksi saja
- reset + nolkan semua stok
- reset + restore baseline testing

Utilitas ini juga menyinkronkan kembali field stok agar konsisten.

Preset `Reset Semua Testing` adalah shortcut guarded untuk development/testing: memilih semua modul non-protected, menghapus transaksi/log stok/planning/pricing yang diizinkan, menolkan stok master/variant, dan menolkan field modal/HPP allowlist dalam satu flow preview + keyword `RESET SEMUA`. Protected master seperti Supplier, Customer, Produk, Raw Material, Semi Finished, BOM, Step, dan Employee tidak dihapus.


## Tambahan Rule Terkini (Batch Prioritas)

### Work Log Costing saat Complete
- saat Work Log diselesaikan, summary costing final dihitung dari snapshot material actual yang dibekukan saat Start Production; data lama tanpa snapshot boleh fallback ke master cost aktif
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
1. Query dokumen kandidat memakai prefix kode (`PREFIX-`) dari document ID dan field kode bisnis terkait.
2. Hitung nomor terbesar yang cocok dengan format `PREFIX-001` dari kandidat tersebut.
3. Buat nomor berikutnya dengan padding 3 digit.
4. Data lama readable tetap dibaca untuk compatibility melalui fallback full scan hanya jika prefix query gagal.
5. Kode master/config tidak ditampilkan sebagai informasi utama UI; user memilih dari nama, varian, target, step, dan satuan.

Contoh final:
- Product: `PRD-001`
- Raw Material: `RAW-001`
- Semi Finished: `SFP-001`
- BOM Product: `BOM-001`
- BOM Semi Finished: `BOM-002`
- Production Step: `STP-001`

Catatan current state:
- Source terbaru memakai `generateUniqueSequentialCode` untuk Product/Raw Material dan wrapper `generateUniqueProductionSequentialCode` untuk Semi Finished/BOM.
- Production Step sudah memakai generator `STP-001` lokal di service step.
- Collision kode harian memakai prefix query pada document ID dan field kode bisnis terkait untuk baseline data lama. Batch 16B menambahkan counter atomic `business_code_counters` untuk Sales/Purchases/Returns agar create paralel tidak memakai nomor yang sama.

### Batch 16B — Atomic Counter Transaksi Utama

Status: **GUARDED / AKTIF TERBATAS**.

- Collection counter yang disetujui untuk kode transaksi adalah `business_code_counters`.
- Sales (`ORD-*`), Purchases (`PUR-*`), dan Returns (`RET-*`) reserve sequence counter di dalam backend SQLite transaction/atomic commit yang sama dengan create dokumen bisnis.
- Sebelum transaction, service tetap membaca prefix query lama sebagai baseline sequence data lama agar counter baru tidak mulai dari `001` saat data lama sudah ada.
- Counter commit dilakukan setelah semua transaction read/validasi selesai dan sebelum write dokumen bisnis, sehingga tidak ada read-after-write di backend SQLite transaction/atomic commit.
- Format kode, document ID readable, inventory log payload, income/expense, stock mutation, purchase average cost, OCR, Return transaction, route/menu/role guard, production, payroll, HPP, dan reset tidak berubah.
- Batch 16C: Customer/Supplier, Product/Raw Material, BOM/Semi Finished, Cash In/Out manual, Stock Adjustment, Production Order, Work Log, dan Payroll manual juga reserve business code melalui `business_code_counters` di dalam transaction create masing-masing. Batch 16D melengkapi Production Planning `PP-*` dan Karyawan Produksi lewat counter bersama yang sama.


### Batch 16C — Atomic Counter Master, Finance, Stock Adjustment, dan Produksi

- `business_code_counters` menjadi counter teknis bersama untuk kode harian dan sequence internal non-transaksi.
- Daily code yang ikut dimigrasi di Batch 16C: `CUS`, `SUP`, `CSH-IN`, `CSH-OUT`, `STK-ADJ`, `PO-PRD`, `PO-SFP`, `JOB`, dan `PAY`.
- Sequential internal code yang ikut dimigrasi: `PRD`, `RAW`, `BOM`, dan `SFP`.
- Production Planning `PP` dan counter internal Karyawan Produksi `EMP` bukan scope Batch 16C; keduanya diselesaikan di Batch 16D agar audit counter tetap jelas per tahap.
- Preview kode di UI tetap boleh memakai prefix-query data lama, tetapi final create service/page wajib reserve kode ulang di transaction agar dua create paralel tidak overwrite document ID.
- Fallback data lama prefix-query tetap dipakai sebagai baseline sequence agar counter baru tidak mulai dari `001` saat data lama sudah ada.


## Update Rule Tahapan Produksi — 2026-05-16

- Tahapan Produksi memakai `basisType` sebagai field aktif untuk cara kerja step. Field `workBasisType` tidak dipakai lagi di source terbaru.
- Label basis step aktif adalah: `Per Meter Bahan`, `Per Kawat`, `Per Qty`, dan `Per Batch`.
- Cara pantau hasil / `monitoringMode` tidak lagi tampil dan tidak lagi disimpan dari form Step karena reject/QC detail belum menjadi workflow utama.
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
- Kode lama seperti `EMP-...` dianggap data lama dan tidak dimigrasi otomatis saat edit.

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
- Riwayat adjustment harus terbaru di atas, prioritas `createdAt` lalu fallback `date` untuk data lama.

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
- Payroll preference/custom payroll di master karyawan adalah data lama/compatibility, bukan source utama payroll baru.

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
- fallback hanya untuk data lama: `workLog.goodQty` jika target Work Log cocok;
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
- Payroll Report boleh mempertahankan CSV data lama untuk compatibility, tetapi XLSX adalah output final yang lebih rapi. Query laporan Payroll harus membaca periode aktif bila tersedia, bukan selalu `getAllProductionPayrolls`.

### Fase F - Duplicate Cleanup Data Lama
- Folder/file duplicate seperti `src/src/**` tidak boleh diedit untuk patch baru.
- File duplicate data lama hanya boleh dihapus setelah grep/import/route check membuktikan tidak dipakai runtime.
- Route aktif Dashboard harus tetap memakai `src/pages/Dashboard/*`.
- Service aktif Planning harus tetap memakai `src/services/Produksi/productionPlanningService.js`.
- Jika ada penghapusan data lama, wajib ada catatan `DELETE_LIST.md` atau dokumentasi setara yang menjelaskan bukti dan file yang dihapus.

### Final Guard Anti Double Payroll / Expense
- Work Log completed wajib membuat payroll line secara idempotent per Work Log + Step + Operator.
- Payroll paid wajib membuat expense secara idempotent dengan `sourceModule=production_payroll` dan `sourceId=payrollId`.
- UI final-state harus clean: Payroll `paid` hanya menampilkan aksi Detail di list utama; tombol Edit disabled dan Paid tidak perlu ditampilkan.
- Profit Loss membaca payroll lewat `expenses`, bukan langsung dari `production_payrolls`, agar tidak double count.
- Expense payroll tidak boleh dihapus otomatis saat payroll paid dibatalkan sebelum business rule rollback disepakati.

## 15. Rule Supplier & Raw Material

### 15.1 Supplier sebagai katalog vendor/restock
- Supplier adalah master/katalog vendor untuk referensi restock.
- Supplier boleh menyimpan daftar material yang dijual melalui `materialDetails`.
- `materialDetails.productLink`, `materialDetails.referencePrice`, dan `materialDetails.note` hanya informasi restock.
- Supplier tidak boleh memasang supplier baru ke Raw Material berdasarkan katalog `materialDetails`.
- Saat master Supplier diedit, sistem boleh memperbarui snapshot `supplierName` dan `supplierLink` hanya pada Raw Material yang sudah memiliki `supplierId` sama.
- Saat master Supplier dihapus, sistem boleh mengosongkan snapshot supplier hanya pada Raw Material yang masih menunjuk `supplierId` tersebut.
- Tidak ada tombol atau flow aktif “Sinkronkan Bahan” dari Supplier ke Raw Material.

### 15.2 Raw Material memilih supplier manual
- Raw Material tetap source utama stok bahan.
- Supplier pada Raw Material dipilih manual dari form Raw Material.
- Snapshot manual yang boleh disimpan di raw material:
  - `supplierId`
  - `supplierName`
  - `supplierLink`
- Data lama dengan snapshot supplier tetap aman dibaca; snapshot boleh ikut diperbarui/dibersihkan hanya melalui cascade berdasarkan `supplierId` yang sudah dipilih manual.

### 15.3 Batas ke Purchases
- Purchases boleh memakai supplier sebagai referensi vendor.
- Harga aktual pembelian tetap berasal dari transaksi pembelian.
- Harga referensi supplier tidak boleh menggantikan `actualUnitCost` atau harga aktual pembelian.
- Klik link supplier/product restock tidak membuat purchase dan tidak mengubah stok.

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
- Menu Supplier tetap menjadi tempat melihat semua supplier, harga referensi, link produk katalog, dan catatan supplier.

## 15. Rule Final Stok Varian

- `currentStock` adalah stok utama yang dipakai per varian.
- `stock` tetap wajib disimpan sebagai alias kompatibilitas dan nilainya harus sama dengan `currentStock`.
- `reservedStock` wajib angka aman dan tidak boleh membuat available negatif.
- `availableStock` wajib dihitung dari `currentStock - reservedStock` dengan batas minimum 0.
- Semua writer varian wajib memakai helper pusat `variantStockNormalizer` atau helper lama yang sudah delegasi ke helper pusat.
- Master item bervarian wajib menyimpan `currentStock`, `stock`, `reservedStock`, dan `availableStock` berdasarkan total varian.
- Untuk Product dan Semi Finished, minimum stok final adalah field master: `products.minStockAlert` dan `semi_finished_materials.minStockAlert`, berlaku untuk item non-varian maupun bervarian.
- `variants[].minStockAlert` pada Product/Semi Finished hanya data lama/compatibility field jika masih ada di data lama/helper generic; UI dan service master tidak boleh menjadikannya source utama threshold low-stock.
- Saat Product/Semi Finished bervarian dibuat atau di-edit, total stok master tetap dihitung dari varian, tetapi `minStockAlert` master wajib berasal dari input master `values.minStockAlert`, bukan penjumlahan varian.
- Untuk modal/HPP Semi Finished bervarian: jika stok varian ada, master `averageCostPerUnit` wajib weighted by stock; jika semua stok 0, read-model cost tidak boleh dirata-ratakan dengan varian yang cost-nya 0. Gunakan rata-rata varian aktif yang punya cost > 0, lalu fallback `lastProductionCostPerUnit` untuk tampilan/BOM cost source.
- Reset/Maintenance hanya alat audit/repair/development, bukan flow harian user untuk menjaga stok tetap sinkron.

### 15.1 Variant conversion aman

- Edit master biasa tetap tidak boleh menjadi jalur mutasi stok.
- Data lama non-varian boleh mulai memakai varian hanya jika `stock/currentStock`, `reservedStock`, dan `availableStock` semuanya 0.
- Varian baru pada item existing wajib dibuat dengan `stock/currentStock/reservedStock/availableStock = 0`.
- Item lama yang masih punya stok master atau reserved stock tidak boleh dikonversi otomatis ke varian; user harus memakai Stock Management / Stock Adjustment / transaksi resmi bila stok perlu dialihkan.
- `variantKey` existing tidak boleh berubah saat nama/label varian diganti karena itu adalah identitas bucket stok/reference transaksi.
- Hapus/arsip varian wajib ditolak jika varian masih punya `stock`, `currentStock`, `reservedStock`, atau `availableStock` yang belum aman.
- Jika semua bucket stok varian aman 0, varian boleh disembunyikan dari transaksi baru dengan memindahkannya ke `archivedVariants[]`, bukan hard delete.
- Mode varian existing boleh dimatikan hanya jika semua varian aktif punya `currentStock`, `reservedStock`, dan `availableStock` 0; hasilnya `variants[]` aktif kosong, `hasVariants=false`, dan tombstone tetap ada di `archivedVariants[]`.
- `archivedVariants[]` wajib menyimpan `variantKey`, label/nama/kode varian, snapshot stok terakhir, `isArchived=true`, `isActive=false`, `archivedAt`, `archivedBy`, dan `archiveReason`.
- Varian arsip tidak boleh muncul sebagai pilihan transaksi baru, tetapi boleh ditampilkan di detail master sebagai audit/history.
- Jika user membuat lagi varian dengan nama/struktur yang sama seperti arsip, service wajib restore `variantKey` lama dari `archivedVariants[]`, menghapusnya dari arsip aktif, dan menulis `restoredAt/restoredBy/restoreReason`.
- Duplicate active variant tetap wajib ditolak; hanya satu varian aktif yang boleh memakai nama/struktur/`variantKey` yang sama.
- `variantModeHistory[]` adalah audit ringkas untuk event `variant_mode_enabled`, `variant_mode_disabled`, `variant_archived`, dan `variant_restored`; history ini tidak menggantikan inventory log stok.

### 15.2 Pricing Rules optional

- Pricing Rules adalah fitur harga opsional, bukan blocker create master Product/Raw Material.
- Mode create default Product/Raw Material adalah `manual`.
- `pricingRuleId` hanya wajib jika user memilih `pricingMode = rule`.
- Jika `pricingMode = manual`, `pricingRuleId` boleh kosong/null dan harga manual tetap valid.
- Mode Manual tidak boleh otomatis overwrite harga manual yang diinput user.
- Mode Rule hanya boleh melakukan auto-preview harga saat base cost dan rule valid. Jika base cost/rule belum valid, tampilkan warning/preview tidak siap tanpa mengisi harga asal.
- Product memakai basis cost `hppPerUnit` untuk preview Pricing Rule.
- Raw Material memakai `averageActualUnitCost` sebagai basis utama dengan fallback `restockReferencePrice`.
- Semua preview harga wajib lewat `buildSinglePricingPreview` dari `pricingService`; jangan membuat formula pricing baru di page/component.
- `PricingModeSwitch` hanya shared UI switch Manual/Rule, bukan source formula pricing, bukan validation service, bukan query backend/database, dan bukan tempat auto-preview.
- Auto-preview Product dan Raw Material tetap local di halaman masing-masing kecuali ada audit patch terpisah yang membuktikan shared hook lebih aman.
- PricingRules preview/apply tetap skip item Manual dan hanya memproses item yang memang berada pada mode Rule/valid.

## 17. Rule Reset & Maintenance Data Aman

- Supplier adalah protected master data dan collection `supplierPurchases` tidak boleh ikut reset default.
- Reset/Maintenance hanya untuk admin/development/testing, bukan flow harian user.
- Reset transaksi boleh menghapus data transaksi/testing sesuai scope, tetapi tidak boleh menghapus Supplier, Raw Material, Product, Customer, BOM/setup, atau master penting lain secara default.
- Reset Supplier hanya boleh dibuat sebagai opsi destructive developer terpisah dengan preview, warning, dan konfirmasi eksplisit; tidak boleh menjadi bagian dari reset default.
- Preview reset wajib menampilkan collection yang akan dihapus dan master yang dilindungi.
- Data test wajib memakai marker `isTestData: true`, `sourceModule: "dev_test_seed"`, dan `createdBy: "dev_seed"`.
- Hapus Data Test hanya boleh menghapus dokumen bermarker test; data normal tanpa marker tidak boleh ikut terhapus.
- Repair stok tetap hanya menyamakan field turunan dan tidak boleh membuat inventory log palsu.
- Reset destructive wajib membuat audit log awal sebelum delete; jika log awal gagal karena rules/permission, reset tidak boleh dijalankan.
- Reset destructive wajib melakukan preflight sebelum write pertama: validasi mode, module, allowlist collection rules, protected master data, baseline restore, keberadaan item baseline, dan estimasi jumlah operasi.
- Reset destructive dari client hanya boleh berjalan jika seluruh delete transaksi dan update stok bisa masuk satu batch aman; jika melebihi batas aman client, reset wajib diblokir agar tidak partial delete.
- Jika reset berhasil tetapi update audit log akhir gagal, UI harus memisahkan error audit dari hasil reset dan tidak boleh menampilkan reset seolah gagal.

## 19. Rule Purchases Supplier Restock Prefill

- Form Purchases boleh membaca katalog Supplier `materialDetails` secara read-only untuk mengisi awal Link Produk dan Harga Supplier Tercatat.
- Link Produk di Purchases berasal dari `materialDetails[].productLink` supplier yang dipilih dan materialId yang cocok; link produk bahan lain tidak boleh dipakai.
- Harga Supplier Tercatat berasal dari katalog Supplier yang dipilih dan hanya menjadi harga pembanding per satuan stok.
- Harga Supplier Tercatat tidak boleh menjadi harga aktual pembelian, tidak boleh menjadi `actualUnitCost`, dan tidak boleh mengubah kas/expense secara langsung.
- Harga aktual pembelian tetap berasal dari subtotal transaksi, ongkir, diskon ongkir, voucher/koin/potongan, dan biaya layanan.
- `totalStockIn` tetap dihitung dari `Qty Beli × Konversi Supplier` untuk bahan baku.
- Total Pembanding Supplier di Purchases memakai komponen katalog supplier: `Qty Beli × Harga Barang Supplier + Ongkir Default Supplier + Biaya Layanan Default Supplier - Diskon Default Supplier`; jangan menggandakan ongkir/admin dengan mengalikan harga per satuan stok saat Qty Beli lebih dari 1.
- Supplier dropdown pada pembelian bahan baku harus memprioritaskan supplier yang menyediakan material tersebut; jangan fallback diam-diam ke semua supplier.
- Supplier tetap katalog vendor/restock dan tidak otomatis menulis ke Raw Material.

## 20. Rule Katalog Restock Supplier

- Supplier adalah katalog vendor/restock, bukan transaksi pembelian.
- Field kategori/keterangan supplier lama hanya data lama read-only dan bukan input utama flow restock.
- Setiap `materialDetails` supplier boleh menyimpan konteks restock: link produk, tipe pembelian, satuan beli, qty per pembelian, konversi ke satuan stok, satuan stok, harga barang supplier, ongkir estimasi, biaya admin, diskon, dan catatan.
- Harga Estimasi Supplier / Satuan Stok dihitung dari katalog supplier sebagai pembanding: `(harga barang + ongkir + biaya admin - diskon) / total stok hasil konversi`.
- Harga Estimasi Supplier bukan harga aktual pembelian, bukan `actualUnitCost`, dan tidak boleh membuat kas/expense/laporan berubah.
- Purchases boleh memakai katalog Supplier untuk prefill Link Produk, Satuan Beli, Konversi, dan Harga Supplier Tercatat, tetapi user tetap wajib mengisi transaksi aktual dan klik Simpan.
- Supplier tetap tidak boleh otomatis memasang supplier ke Raw Material berdasarkan `materialDetails`.

## 21. Rule Stok Masuk Purchases dari Konversi Supplier

- Purchases wajib menampilkan **Stok Masuk total** sebagai informasi utama, bukan menjadikan **Konversi Supplier** sebagai input utama/editable.
- Untuk bahan baku, rumus final tetap: `Stok Masuk = Qty Beli × Konversi Supplier`.
- Konversi Supplier berasal dari katalog Supplier `materialDetails.conversionValue`, bersifat read-only di Purchases, dan hanya menjadi sumber hitung stok masuk.
- Qty Beli boleh diubah user dan hanya boleh mengubah Stok Masuk, subtotal default jika belum diedit manual, dan ringkasan pembanding.
- Perubahan Qty Beli tidak boleh mereset Supplier, Link Produk Restock, purchaseType, biaya supplier, atau Harga Supplier Tercatat.
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

Catatan data lama:
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

Status: **AKTIF + GUARDED + SOURCE-VERIFIED SQLITE**. Section ini menggantikan catatan lama Auth runtime lama/database lama setelah source aktual memakai local auth SQLite.

### 24.1 Prinsip Auth final

- SQLite local auth adalah source of truth untuk password hash, session/token lokal, profile internal, role, status, dan metadata user IMS.
- Login IMS memakai username di UI; backend `/api/auth/login` memvalidasi username + password ke tabel SQLite, bukan auth lama.
- `AuthContext.jsx` masih memiliki nama state auth lama sebagai compatibility actor label lama, tetapi object tersebut dibentuk dari user SQLite lokal dan `providerId: sqlite_local`.
- User tanpa session/token lokal valid wajib ditolak masuk aplikasi utama.
- User dengan `status = inactive` wajib ditolak masuk aplikasi utama.
- Role tidak dikenal wajib default deny.
- Password plaintext, token rahasia, service account, credential Admin SDK, atau secret tidak boleh disimpan di frontend/source.

### 24.2 Role aktif final

| Role | Status | Akses utama | Batasan wajib |
|---|---:|---|---|
| `administrator` | **AKTIF / GUARDED** | Admin utama aplikasi. Mengakses menu sistem, Manajemen User, Reset & Maintenance, dan menu operasional sesuai route guard. | Tetap wajib mengikuti business rules stok, kas, pembelian, penjualan, produksi, payroll, HPP, dan laporan. Tidak boleh mengubah role/status dirinya sendiri dari Manajemen User. |
| `user` | **AKTIF / GUARDED** | User operasional terbatas sesuai access matrix. | Tidak boleh membuka Manajemen User, Reset & Maintenance, route sistem sensitif, atau melakukan manajemen role/profile user lain. |

Role `super_admin` adalah **REMOVED FROM ACTIVE FLOW**. Role ini tidak boleh dibuat, dipilih, disimpan sebagai target profile baru, atau dipakai sebagai compatibility aktif setelah cleanup data selesai.

### 24.2.1 Access matrix menu final

Status: **AKTIF / GUARDED**. Matrix ini menyelaraskan `roleAccess.js`, `sidebarMenu.js`, dan route guard. Perubahan matrix hanya membatasi visibilitas/akses menu; tidak mengubah business rules, kalkulasi, schema, atau flow transaksi.

| Area menu | Administrator | User | Catatan guard |
|---|---:|---:|---|
| Dashboard | Ya | Ya | Shared read/summary sesuai route aktif. |
| Master Data | Ya | Tidak | Admin-only karena dapat mengubah referensi bisnis seperti produk, raw materials, kategori, supplier, customer, dan pricing. |
| Pricing Rules | Ya | Tidak | Admin-only karena memengaruhi harga/margin. |
| Stock Control | Ya | Ya | Operasional harian untuk cek/kelola stok sesuai flow aktif. |
| Production Operation | Ya | Ya | Meliputi Production Planning, Order Produksi, dan Work Log Produksi. |
| Production Setup | Ya | Tidak | Admin-only karena mengubah setup produksi, BOM, semi product, karyawan, dan template. |
| Cost & Analysis | Ya | Tidak | Admin-only karena berhubungan dengan payroll, HPP, dan analisis biaya. |
| Transaksi | Ya | Ya | Operasional harian Purchases, Sales, dan Returns. |
| Kas & Biaya | Ya | Tidak | Admin-only karena data finance sensitif. |
| Sistem | Ya | Tidak | Manajemen User dan Reset & Maintenance selalu admin-only. |
| Laporan | Ya | Tidak | Admin-only karena laporan dapat memuat finance, payroll, HPP, dan laba/rugi. |

User biasa tidak boleh melihat menu sensitif di sidebar dan tidak boleh membuka route sensitif lewat URL langsung. Route guard tetap wajib selaras dengan sidebar guard.

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

Login pertama boleh bootstrap administrator lokal hanya melalui flow backend yang guarded saat belum ada admin aktif. Setelah itu, pembuatan user wajib melalui administrator.

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

### 24.6 Data lama / arsip migrasi runtime lama

- auth lama, database lama `system_users/{uid}`, rules database lama, dan domain `username@ziyocraft.com` adalah **ARSIP MIGRASI** untuk source saat ini.
- Jangan membuat user runtime lama, menempel UID Auth, mengubah rules database lama, atau menghidupkan fallback runtime lama untuk task Auth/User Management tanpa approval eksplisit dan validasi source baru.
- Jika menemukan komentar/source variable bernama lama, audit import/usage dulu. Nama compatibility tidak otomatis berarti runtime lama aktif.

### 24.7 Boundary yang tidak berubah

Patch Auth/User Management tidak boleh mengubah rumus stok, Purchases, Returns, Sales, Stock Management / Stock Adjustment, Supplier sebagai katalog restock, Production, Payroll, HPP, Reports/export, Dashboard read-only, Pricing Rules, atau Reset & Maintenance business flow.

## 11. Rule Batch Fix Bug Merge — 2026-05-03

### 11.1 Format angka tanpa desimal
- Tampilan angka, qty, stok, Rupiah, summary, report, dan input UI aktif diarahkan tanpa decimal.
- `formatNumberId`, `formatQuantityId`, `formatPercentId`, dan parser input integer menjadi standar UI.
- Perubahan ini tidak mengubah rumus transaksi, schema SQLite/backend, atau migrasi/backfill data lama.
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
- Sidebar nested accordion dan Login UI copy cleanup adalah perubahan UI; keduanya tidak mengubah stok, transaksi, produksi, laporan, AuthContext, role access, rules database lama, atau schema.

## Update Business Rules — Cash In delete lock dan Sales status tab — 2026-05-03

### Cash In / Pemasukan sebagai ledger aman
- Halaman Pemasukan membaca gabungan `revenues` dan `incomes` sebagai tampilan ledger pemasukan aktif.
- `revenues` tetap menjadi sumber pemasukan manual/lama, sedangkan `incomes` tetap menjadi pemasukan otomatis dari Sales berstatus `Selesai`.
- Menu Pemasukan tidak menyediakan tombol Hapus untuk mengurangi risiko penyalahgunaan dan menjaga audit kas.
- Penghapusan pemasukan tidak boleh dilakukan dari UI Pemasukan biasa tanpa task khusus, audit, dan approval eksplisit.
- Perubahan ini tidak menghapus data lama, tidak mengubah `revenues`, tidak mengubah `incomes`, dan tidak mengubah Profit Loss yang membaca `revenues + incomes + expenses`.

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
- Untuk item bervarian, status low-stock utama wajib membaca setiap varian terhadap threshold master (`minStock` untuk Raw Material, `minStockAlert` untuk Product/Semi Finished). Aggregate master tetap boleh tampil sebagai total, tetapi tidak boleh membuat item terlihat aman jika ada varian kosong/di bawah minimum.
- Rule ini berlaku untuk tampilan saldo stok item seperti Products, Raw Materials, Semi Finished Materials, Dashboard Stok Kritis, dan Stock Report.
- Rule ini tidak berlaku untuk Qty transaksi, Stok Masuk Purchases, Stock Adjustment quantity, inventory log delta, atau field audit lain yang bukan saldo stok master. Untuk inventory log delta, Qty boleh menampilkan satuan dari `stockUnit`/`unit`, tetapi tidak boleh berubah menjadi komponen saldo stok master.
- Perubahan tampilan compact table tidak boleh mengubah rumus stok, mutation, reserved stock, available stock, HPP, pricing, export mapping, atau schema SQLite/backend.

## Update Business Rules — Buku Besar Kas / Log Pergerakan Uang — 2026-05-09

Buku Besar Kas adalah halaman audit read-only untuk melihat uang masuk dan uang keluar aktual dari data kas existing.

Source of truth nominal utama:
- `incomes` untuk uang masuk resmi dari Sales berstatus `Selesai`.
- `revenues` untuk uang masuk manual / data lama dari Cash In.
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
- **Audit:** read-only terhadap data bisnis. Audit boleh membuat maintenance log metadata admin, tetapi tidak boleh mengubah stok, transaksi, kas, payroll, HPP, report, atau schema bisnis.
- **Repair:** hanya untuk field turunan/snapshot/display yang aman sesuai service existing. Repair tidak boleh membuat transaksi baru, posting stok ulang, atau menghapus data utama.
- **Reset:** destructive, wajib preview, warning, confirmation keyword existing, result summary, dan audit/error trail.
- **Export data pokok:** wajib direkomendasikan sebelum reset total/master. Export bersifat backup/checklist, bukan import atau restore otomatis.
- **Reset transaksi + nolkan stok:** cocok untuk data development yang belum real saat master masih dipakai tetapi stok lama tidak dipercaya.
- **Protected master:** tidak ikut reset default dan tidak boleh dilepas dari guard tanpa approval khusus.
- **Data real:** jangan reset data real/semi real tanpa backup/export dan audit dampak.
- **Import normalized:** belum masuk patch ini; export dipakai untuk review/manual input/normalization task berikutnya.
- **Normalisasi kode master:** tersedia di Reset & Maintenance Data untuk Product, Raw Material, Semi Finished, BOM, Production Step, dan Supplier. Aksi ini hanya update field `code` dan alias kode aktif; tidak rename document ID, tidak menghapus data, dan tidak menyentuh transaksi/history.
- **Supplier data lama repair:** tidak lagi dijalankan dari halaman Supplier. Semua repair kode lama harus lewat Reset & Maintenance Data agar audit/preview terpusat.
- **Reset Modal/HPP:** menu Reset & Maintenance menyediakan mode `Reset Semua Modal & HPP` untuk menolkan field cost/HPP master aktif dalam satu aksi guarded setelah preview dan keyword khusus. Aksi ini tidak menghapus transaksi, stok, PO, Work Log, Payroll, Sales, Purchases, Returns, atau Cash.
- **Reset Semua Testing:** tombol gabungan di Reset & Maintenance menjalankan scope non-protected + zero stock + reset modal/HPP allowlist dengan keyword `RESET SEMUA`. Update stok dan HPP pada dokumen master yang sama harus digabung dalam satu write agar batch tetap aman dan tidak double-write document ref.
- **Allowlist Reset Modal/HPP:** Raw Material: `averageActualUnitCost`, `restockReferencePrice`; Product: `hppPerUnit`, `averageCostPerUnit`, `costPerUnit`; Semi Finished: `averageCostPerUnit`, `lastProductionCostPerUnit`, `referenceCostPerUnit`, `costPerUnit` termasuk variant fields jika ada.


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
- Sales tetap boleh memakai nama field data lama `saleNumber`, tetapi value data baru wajib ber-prefix `ORD`.
- Date sequence wajib memakai `DDMMYYYY` dan sequence 3 digit (`001`, `002`, `003`).
- Master item/config produksi memakai sequence internal sederhana `PREFIX-001`. Kode ini disimpan untuk relasi/backstage dan tidak menjadi fokus UI.
- internal database ID teknis/random tidak boleh tampil sebagai kode audit/user-facing.
- Data lama dengan prefix lama tetap compatibility, tetapi bukan standar data baru.


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
- Customer/Supplier/transaksi/audit reference tidak boleh disembunyikan dari UI.
- SKU Variant/kode variant tetap compatibility/backstage; UI utama cukup menampilkan nama varian, status, dan stok.


## Update 2026-05-22 — Service Extraction Transaksi dan Read Path

### Sales
- Source of truth flow penjualan tetap `sales`.
- Pembuatan Sales sekarang diorkestrasi melalui `src/services/Transaksi/salesService.js`.
- Income otomatis tetap hanya dibuat saat status final `Selesai`.
- Guard stok varian tetap wajib: item yang punya varian tidak boleh mengurangi stok master/default.
- Pembatalan Sales tetap tidak disediakan sebagai status update langsung; barang kembali harus lewat Return.

### Returns
- Return tetap menulis dokumen return, update stok, dan inventory log dalam satu backend SQLite transaction/atomic commit.
- Return aktif adalah stock-only correction: tidak membuat `incomes`, `revenues`, `expenses`, atau ledger finance otomatis.
- Orkestrasi transaksi Return dipindah ke `src/services/Transaksi/returnsService.js`.
- Collection dan field Return tidak diubah.

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

- Production Planning baru memakai document ID sama dengan `planCode` berformat `PP-YYYYMMDD-0001`.
- Production Planning tidak lagi memakai full scan + `addDoc` sebagai jalur create utama; prefix query tetap menjadi baseline data lama sebelum counter transaction-level.
- Karyawan Produksi tetap memakai kode tampilan `DDMMYYYY-XXX`, tetapi sequence final disimpan pada `business_code_counters` dengan prefix internal `EMP`.
- Collection lama `production_employee_code_sequences` hanya dibaca sebagai baseline data lama dan tidak menjadi counter aktif create baru.
- Tidak ada migration/rename data lama; relasi Work Log, Payroll, dan PO existing wajib tetap aman.


## Update Business Rules — Transaction Side-Effect Repair guarded — 2026-05-23

Status: **AKTIF / GUARDED**.

- Flow transaksi aktif tetap sama: Sales membuat stock out + inventory log, dan income hanya saat status `Selesai`; Purchases membuat purchase + stock in + inventory log + expense; Return tetap stock-only correction + inventory log tanpa income/expense/revenue otomatis.
- Menu Reset & Maintenance boleh menjalankan **Repair Side-Effect Transaksi** hanya untuk membuat side-effect yang benar-benar hilang dari transaksi aktif: `incomes` untuk Sales `Selesai`, `expenses` untuk Purchases, dan `inventory_logs` untuk Sales/Purchases/Returns.
- Repair side-effect tidak boleh mengubah stok master/variant, tidak boleh mengubah dokumen `sales`, `purchases`, atau `returns`, tidak boleh menghapus income/expense/log lama, tidak boleh mengubah payroll/HPP, dan tidak boleh membuat refund Return.
- Konflik seperti Sales belum `Selesai` tetapi sudah punya income tetap masuk review manual. Sistem tidak melakukan rollback/delete otomatis karena berisiko merusak laporan finance.
- Repair wajib didahului audit/dry run dan konfirmasi keyword `REPAIR TRANSAKSI`; setelah repair wajib audit ulang dan cek Cash In, Cash Out, Stock Management, Sales Report, Purchases Report, dan Profit Loss.


## SQLite Local DB runtime pilot — Patch A-B — 2026-06-02

Status: **AKTIF / SQLITE-FIRST PILOT / BROWSER-LOCAL DATA LAMA CLEANUP SELESAI**.

Rule aktif:
- Runtime offline/local web sekarang memakai SQLite sidecar lewat backend Node.js lokal/LAN, bukan database browser lama.
- `frontend/.env.example` dibuat SQLite-first: `VITE_AUTH_MODE=sqlite`.
- `.env.local` tidak boleh di-commit.
- `VITE_SUPPLIERS_REPOSITORY_MODE=sqlite` aktif untuk Supplier. Relasi purchase/raw/history tetap wajib mengikuti service/endpoint SQLite aktual dan tidak boleh direct write dari UI.
- Categories dan Customers boleh CRUD lewat repository SQLite/backend.
- runtime lama tidak dipertahankan sebagai fallback runtime aktif; alias lama hanya compatibility dan dinormalisasi ke `sqlite_sidecar`.
- Nilai data lama `offline_local` dan `hybrid_sync` hanya compatibility alias di `repositoryMode.js`; nilainya dinormalisasi ke `sqlite_sidecar` dan tidak mengaktifkan database browser lama.

Cleanup yang sudah dilakukan:
- Folder data lama `src/data/adapters/database-browser-lama/`, `src/data/local/`, dan `src/data/sync/` dihapus dari source aktif.
- Panel data lamabase browser lama yang tidak masuk route aktif dihapus: `OfflineLocalDbBackupPanel`, `OfflineMasterDataPilotPanel`, `OfflineQaExecutionPanel`, dan `OfflineSyncDevPanel`.
- UI aktif untuk database lokal hanya `OfflineDatabaseCenter.jsx` / SQLite Local DB Center.

Guard tetap berlaku:
- Tidak ada `sync queue lama` storage browser lama runtime.
- Tidak ada backup/restore JSON storage browser lama runtime.
- Tidak ada auto-sync runtime lama ke SQLite untuk transaksi.
- Stock, purchase, sales, returns, finance, reports, production, payroll, HPP, reset destructive, route/menu/role guard, dan rules database lama/index tidak berubah.
- Restore SQLite destructive tetap wajib admin lokal, preview/plan, file backup eksplisit, keyword guard, dan backup otomatis.

Kontrak resmi: `docs/10_OFFLINE_DATABASE_CONTRACT.md`.
