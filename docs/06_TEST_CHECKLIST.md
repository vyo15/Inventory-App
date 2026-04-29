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
- tambah adjustment masuk bahan baku non-varian
- tambah adjustment keluar produk non-varian
- pastikan adjustment keluar tidak boleh melebihi `availableStock`
- tambah adjustment masuk item bervarian
- tambah adjustment keluar item bervarian
- pastikan item bervarian wajib memilih varian
- cek `stock_adjustments`
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
- tambah adjustment masuk produk non-varian
- tambah adjustment keluar produk non-varian dan pastikan stok tidak boleh melebihi `availableStock`
- tambah adjustment item bervarian dan pastikan varian wajib dipilih
- cek `stock`, `currentStock`, `reservedStock`, `availableStock`, dan total `variants[]` tetap sinkron
- cek record `stock_adjustments` menyimpan `variantKey`, `variantLabel`, `currentStockBefore`, `currentStockAfter`, `availableStockBefore`, dan `availableStockAfter`
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
- pastikan material usage yang berasal dari PO menyimpan `costPerUnitSnapshot` dan `totalCostSnapshot` saat material punya cost aktual
- complete Work Log dengan `goodQty > 0`
- pastikan `materialCostActual` tidak tetap 0 jika material punya `averageActualUnitCost`, `averageCostPerUnit`, `costPerUnit`, `lastPurchasePrice`, `lastProductionCostPerUnit`, atau `hppPerUnit`
- pastikan `laborCostActual` tersinkron setelah payroll line otomatis dibuat
- pastikan `totalCostActual = materialCostActual + laborCostActual + overheadCostActual`
- pastikan `costPerGoodUnit = totalCostActual / goodQty` dan tidak membagi 0 saat `goodQty` tidak valid
- pastikan output stok hanya bertambah satu kali saat Work Log completed
- pastikan payroll line tidak dobel saat tombol Selesaikan ditekan ulang / halaman refresh
- pastikan HPP Analysis membaca material cost dan labor cost dari Work Log completed tanpa mengubah data lama massal
- pastikan Work Log lama yang sudah completed tetapi cost 0 tidak di-backfill otomatis tanpa task terpisah

## Checklist Task 3 — Clarify Payroll dan Detail Karyawan Produksi

### Payroll Produksi — Detail Line Payroll
- buka menu Payroll Produksi
- buka detail salah satu line payroll
- pastikan label `No. Line Payroll` menjelaskan bahwa nomor ini unik per line/operator
- pastikan field Work Log menjelaskan sumber pekerjaan produksi asal payroll
- pastikan field Step/Tahapan menjelaskan bahwa rule/tarif payroll berasal dari tahapan produksi
- pastikan field Operator/Karyawan menjelaskan penerima payroll
- pastikan status `draft`, `confirmed`, dan `paid` memiliki help text yang mudah dipahami
- pastikan `Payment Status` menjelaskan status pembayaran internal payroll; saat `paid`, sistem membuat Cash Out otomatis dengan guard sourceModule/sourceId
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
- pastikan section Payroll Preference Legacy / Deprecated jelas sebagai data lama/compatibility
- pastikan user paham payroll final mengikuti rule Tahapan Produksi dan Work Log completed, bukan custom payroll employee
- pastikan tidak ada perubahan perhitungan payroll, Work Log, Cash Out, atau HPP
- pastikan build berhasil dan tidak ada error console

## Checklist Integrasi IMS Produksi → Payroll → Kas → HPP → Laporan
- [ ] Buat PO ready lalu start Work Log.
- [ ] Complete Work Log dengan `goodQty > 0` dan operator valid.
- [ ] Pastikan output stok bertambah satu kali saja.
- [ ] Pastikan Work Log status completed.
- [ ] Pastikan `materialCostActual` terisi jika material punya cost source.
- [ ] Pastikan payroll line otomatis dibuat per operator.
- [ ] Pastikan `laborCostActual` tersinkron dari payroll line.
- [ ] Pastikan `totalCostActual = materialCostActual + laborCostActual + overheadCostActual`.
- [ ] Pastikan `costPerGoodUnit` benar jika `goodQty > 0`.
- [ ] Klik Paid di Payroll Produksi.
- [ ] Pastikan payroll berubah `status=paid` dan `paymentStatus=paid`.
- [ ] Pastikan expense otomatis muncul di Kas & Biaya > Pengeluaran.
- [ ] Pastikan expense payroll punya `sourceModule=production_payroll`, `sourceId`, dan `sourceRef`.
- [ ] Klik Paid ulang/reload, pastikan expense tidak dobel.
- [ ] Pastikan Profit Loss membaca expense payroll sebagai pengeluaran.
- [ ] Pastikan Payroll Report menampilkan referensi Cash Out tanpa menghitung expense sebagai source payroll.
- [ ] Pastikan HPP Analysis membaca Work Log completed dengan material/labor/total cost final.
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
- [ ] Pastikan `Terakhir diperbarui` tampil dan tombol `Refresh` hanya reload data summary.
- [ ] Pastikan tidak ada table besar atau horizontal scroll di Dashboard pada laptop/desktop normal.
- [ ] Prioritas Hari Ini tampil sebagai action card/chip: Stok Menipis, PO Shortage, PO Siap, Work Log Berjalan, Planning Overdue, dan Payroll Pending.
- [ ] Setiap action card/chip hanya navigasi ke menu terkait dan tidak mengubah data.
- [ ] Fokus Target Produksi menampilkan Target Minggu Ini, Target Bulan Ini, sisa target, progress, dan maksimal 3 Planning Perlu Dikejar.
- [ ] Planning completed/cancelled tidak tampil sebagai urgent.
- [ ] Planning overdue dan deadline terdekat tampil sebagai prioritas.
- [ ] Status Produksi menampilkan PO Shortage, PO Ready, Work Log Berjalan, Work Log Completed Minggu Ini, dan Payroll Pending.
- [ ] Stok & Operasional tampil sebagai compact list maksimal 5 item stok paling kritis, bukan table besar.
- [ ] Keuangan Ringkas menampilkan penjualan bulan ini, pengeluaran bulan ini, payroll pending, dan indikator selisih dengan catatan bahwa Profit Loss tetap source final.
- [ ] Aktivitas Terbaru tampil sebagai activity feed compact dari inventory log, bukan table besar.
- [ ] Status Integrasi IMS menampilkan Work Log completed, Payroll generated, Payroll pending, Payroll paid, Expense Payroll, dan HPP Cost Issue.
- [ ] Jika ada Work Log completed dengan biaya aktual 0, warning HPP/cost material tampil.
- [ ] Catatan payroll paid/expense tampil agar user tidak menghitung payroll dobel.
- [ ] Jika salah satu collection gagal dibaca, Dashboard tetap tampil dengan fallback aman.
- [ ] Build berhasil dan tidak ada error console.


## Checklist Final Hardening Fase A-G - 2026-04-26

### Fase A - Sales Stock Safety
- [ ] Buat sale stok cukup dan pastikan sale tersimpan.
- [ ] Pastikan stok master/varian berkurang setelah sale dibuat.
- [ ] Buat sale stok tidak cukup dan pastikan sale tidak tersimpan.
- [ ] Buat sale item bervarian stok cukup dan pastikan varian yang benar berkurang.
- [ ] Buat sale item bervarian stok tidak cukup dan pastikan sale tidak tersimpan.
- [ ] Input item yang sama di dua baris dengan total melebihi `availableStock`, lalu pastikan sale tidak tersimpan.
- [ ] Status `Selesai` membuat income sekali saja.
- [ ] Status selain `Selesai` tidak membuat income.
- [ ] Cancel sale revert stok satu kali.
- [ ] Delete sale yang sudah `Dibatalkan` tidak double revert.

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
- [ ] Pastikan Dashboard hanya memiliki 5 section utama.
- [ ] Pastikan tidak ada horizontal scroll.
- [ ] Pastikan Prioritas Hari Ini jelas dan actionable.
- [ ] Pastikan Fokus Produksi ringkas dan planning prioritas maksimal 3 item.
- [ ] Pastikan Stok Kritis compact dan maksimal 5 item.
- [ ] Pastikan Keuangan Ringkas tidak terlihat sebagai Profit Loss final.
- [ ] Pastikan Aktivitas Terbaru compact dan maksimal 5 item.
- [ ] Pastikan last updated tampil.
- [ ] Klik Refresh dan pastikan hanya reload data summary.
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
- Sales produk varian dan cancel/delete jika relevan; stok revert harus aman dan audit tetap OK.
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

## Checklist Stock Management Inventory Log Final
- [ ] Buka menu Stock Management / Manajemen Stok.
- [ ] Pastikan tabel Riwayat Pergerakan Stok urut terbaru ke terlama.
- [ ] Pastikan kolom generik `Stok` yang kosong/`-` tidak tampil membingungkan.
- [ ] Jika snapshot stok belum reliable untuk semua log, jangan isi kolom dengan stok saat ini karena itu bukan snapshot audit historis.
- [ ] Pastikan tabel tetap menampilkan Tanggal, Arah, Sumber, Item, Qty, Referensi Audit, dan Catatan.
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

## Checklist Fase A - Access Matrix Login + Role + Manajemen User Internal

Status: **DOCS ONLY**. Source code, Firestore Rules, Login page, dan User Management belum berubah pada fase ini.

### Checklist dokumen

- [ ] `docs/03_BUSINESS_RULES.md` memuat role aktif `administrator` dan `user`, dengan `super_admin` sebagai legacy compatibility.
- [ ] Access matrix menu/route sudah jelas dan mudah direview sebelum coding.
- [ ] Konsep akun internal tertulis: bukan Google login dan bukan email asli sebagai identitas utama.
- [ ] Dokumen menegaskan password tidak boleh plaintext di Firestore.
- [ ] Dokumen menegaskan password tidak boleh divalidasi langsung dari frontend untuk production.
- [ ] Reset & Maintenance tertulis sebagai akses Administrator, dengan `super_admin` lama sebagai legacy compatibility.
- [ ] Manajemen User tertulis hanya untuk Administrator, dengan `super_admin` lama sebagai legacy compatibility.
- [ ] Administrator tidak boleh membuat role `super_admin` baru.
- [ ] Administrator tidak boleh mengubah role/status dirinya sendiri.
- [ ] User inactive tidak boleh masuk aplikasi pada fase implementasi berikutnya.
- [ ] Business rules stok, kas, Purchases, Returns, Sales, Production, Payroll, HPP, Dashboard, dan Reports tidak berubah.
- [ ] Offline database tetap ditandai roadmap terpisah, bukan bagian dari Login/Role.

### Checklist fase berikutnya - Auth foundation

- [ ] Firebase Auth dipilih dan diekspor dari `src/firebase.js` tanpa memutus Firestore existing.
- [ ] AuthProvider punya state `loading`, `authUser`, `profile`, `role`, dan `status`.
- [ ] Login memakai username/password internal, bukan Google login.
- [ ] Username internal tidak menampilkan email asli sebagai identitas utama.
- [ ] Logout tersedia di header.
- [ ] Refresh browser tetap mempertahankan sesi jika Auth masih aktif.
- [ ] User tanpa profile diarahkan ke halaman akses belum aktif, bukan white screen.
- [ ] User inactive tidak bisa masuk app.

### Checklist fase berikutnya - Route dan menu guard

- [ ] Route login bersifat public.
- [ ] Route aplikasi bersifat protected.
- [ ] User biasa tidak bisa membuka Reset & Maintenance dari URL langsung.
- [ ] User biasa tidak melihat menu Reset & Maintenance.
- [ ] Administrator tidak melihat pilihan role `super_admin` sebagai role baru.
- [ ] User lama `super_admin`, jika masih ada, tetap mendapat akses setara Administrator sampai dimigrasikan.
- [ ] Unauthorized page jelas dan tidak menyebabkan redirect loop.

### Checklist fase berikutnya - Firestore Rules/Auth alignment

- [ ] Rules development diberi warning dan batas waktu jika masih sementara.
- [ ] Rules final mewajibkan `request.auth != null`.
- [ ] Rules final membaca profile `system_users/{uid}` atau strategi role final lain.
- [ ] User `inactive` ditolak read/write.
- [ ] User tidak bisa mengubah role/status miliknya sendiri.
- [ ] Rules/guard tidak mengizinkan pembuatan role `super_admin` baru.
- [ ] Rules tidak dibuka public untuk data real tanpa warning.

### Checklist packaging patch

- [ ] ZIP patch hanya berisi file yang berubah.
- [ ] ZIP patch tidak berisi `node_modules`.
- [ ] ZIP patch tidak berisi `dist` atau `build`.
- [ ] ZIP patch tidak berisi `.git`.
- [ ] ZIP patch tidak berisi `.env` atau secret.
- [ ] Jika fase docs-only, ZIP hanya berisi file docs yang berubah.


---

## Checklist Auth Foundation Fase B — 2026-04-28

### Checklist setup manual sementara
- [ ] Firebase Authentication Email/Password sudah aktif.
- [ ] User Auth awal sudah dibuat dengan email internal, contoh `admin@ims-bunga-flanel.local`.
- [ ] Dokumen `system_users/{uid}` sudah dibuat sesuai UID Auth.
- [ ] `system_users/{uid}.status` bernilai `active`.
- [ ] `system_users/{uid}.role` bernilai role aktif `administrator`/`user`, atau `super_admin` hanya untuk data legacy.
- [ ] Password tidak pernah disimpan di Firestore.

### Checklist Auth
- [ ] Buka aplikasi tanpa login dan pastikan halaman Login tampil.
- [ ] Login dengan username/password valid.
- [ ] Pastikan user masuk ke Dashboard.
- [ ] Logout dari header.
- [ ] Pastikan kembali ke halaman Login.
- [ ] Refresh halaman saat sudah login dan pastikan session tetap terbaca.
- [ ] Test user tanpa dokumen `system_users/{uid}` dan pastikan app utama tidak terbuka.
- [ ] Test user dengan `status: inactive` dan pastikan app utama tidak terbuka.
- [ ] Test user tanpa role valid dan pastikan app utama tidak terbuka.
- [ ] Pastikan tidak ada error console yang menyebabkan white screen.

### Checklist route utama setelah login
- [ ] Buka route Dashboard langsung saat belum login dan pastikan app utama tidak terbuka.
- [ ] Setelah login, buka Dashboard.
- [ ] Buka Supplier.
- [ ] Buka Purchases.
- [ ] Buka Stock Management.
- [ ] Buka Production menu yang biasa dipakai.
- [ ] Pastikan business page tetap berjalan dan tidak ada perubahan flow data.

### Checklist business rules tidak berubah
- [ ] Pembelian tetap memakai flow transaksi existing.
- [ ] Retur tetap memakai flow existing.
- [ ] Sales tidak berubah oleh patch Auth.
- [ ] Stock Adjustment tidak berubah oleh patch Auth.
- [ ] Produksi, Payroll, HPP, dan Reports tidak berubah.
- [ ] Dashboard tetap read-only.
- [ ] Reset/Maintenance tetap dianggap guarded, meskipun role guard detail belum dibuat pada Fase B.

### Checklist build
- [ ] Jalankan `npm run build`.
- [ ] Jalankan `npm run preview` jika memungkinkan.
- [ ] Pastikan tidak white screen di localhost dan deploy.
---

## Checklist Sidebar/Menu Guard Fase D — 2026-04-28

### Checklist menu administrator akses penuh
- [ ] Login sebagai `administrator`.
- [ ] Pastikan semua menu utama tampil.
- [ ] Pastikan menu Sistem tampil.
- [ ] Pastikan Reset & Maintenance tampil.
- [ ] Klik semua menu yang tampil dan pastikan route valid.
- [ ] Pastikan tidak ada parent menu kosong.

### Checklist menu administrator
- [ ] Login sebagai `administrator`.
- [ ] Pastikan menu operasional tampil sesuai access matrix.
- [ ] Pastikan menu finance/report yang diizinkan tampil.
- [ ] Pastikan menu Sistem tampil untuk Administrator karena berisi Manajemen User dan Reset & Maintenance.
- [ ] Buka `/utilities/reset-maintenance-data` langsung dari URL.
- [ ] Pastikan route Reset & Maintenance terbuka untuk Administrator, bukan Unauthorized.
- [ ] Pastikan tidak ada parent menu kosong.

### Checklist menu user
- [ ] Login sebagai `user`.
- [ ] Pastikan hanya menu operasional dasar yang tampil.
- [ ] Pastikan Pricing Rules tidak tampil.
- [ ] Pastikan Kas & Biaya tidak tampil.
- [ ] Pastikan Laporan tidak tampil pada matrix awal.
- [ ] Pastikan Sistem/Reset tidak tampil.
- [ ] Buka route forbidden langsung dari URL dan pastikan diarahkan ke Unauthorized.
- [ ] Pastikan tidak ada parent menu kosong.

### Checklist route/menu sync
- [ ] Klik semua menu yang tampil untuk `administrator`.
- [ ] Jika masih ada user lama `super_admin`, klik semua menu yang tampil dan pastikan akses setara Administrator.
- [ ] Klik semua menu yang tampil untuk `user`.
- [ ] Pastikan semua path menu sesuai `AppRoutes.jsx`.
- [ ] Pastikan HashRouter GitHub Pages tetap aman.
- [ ] Pastikan route legacy `/stock-adjustment` tetap redirect ke `/stock-management` jika role diizinkan.

### Checklist build
- [ ] Jalankan `npm run build`.
- [ ] Jalankan `npm run preview`.
- [ ] Pastikan tidak white screen.
- [ ] Pastikan tidak ada error console terkait `roleAccess`, `ProtectedRoute`, `Unauthorized`, atau `SidebarMenu`.

### Checklist business rules tidak berubah
- [ ] Purchases tidak berubah.
- [ ] Returns tidak berubah.
- [ ] Sales tidak berubah.
- [ ] Stock Management / Stock Adjustment tidak berubah.
- [ ] Supplier tetap katalog restock.
- [ ] Production, Payroll, HPP, dan Reports/export tidak berubah.
- [ ] Dashboard tetap read-only.

---

## Checklist Final Auth/Role/User Management Fase E-H — 2026-04-28

### Checklist User Management
- [ ] Login sebagai `administrator`.
- [ ] Pastikan menu **Sistem > Manajemen User** tampil.
- [ ] Buat Auth user manual di Firebase Console untuk user test.
- [ ] Copy UID Auth user dan buat profile dari Manajemen User.
- [ ] Tambah profile role `user`.
- [ ] Tambah profile role `administrator` dari Manajemen User bila diperlukan.
- [ ] Nonaktifkan user biasa.
- [ ] Pastikan inactive user tidak bisa masuk app utama.
- [ ] Pastikan user tidak bisa menonaktifkan dirinya sendiri dari halaman Manajemen User.
- [ ] Login sebagai `administrator`.
- [ ] Pastikan Administrator bisa melihat/mengelola role aktif `administrator` dan `user`, kecuali dirinya sendiri.
- [ ] Pastikan Administrator tidak bisa membuat role `super_admin` baru.
- [ ] Login sebagai `user`.
- [ ] Pastikan menu Manajemen User tidak tampil.
- [ ] Buka `/system/user-management` langsung sebagai `user` dan pastikan Unauthorized.

### Checklist Firestore Rules/Auth
- [ ] Review `firestore.rules` sebelum publish.
- [ ] Pastikan `system_users/{uid}` untuk Administrator pertama sudah ada dan `status = active`.
- [ ] Publish rules lewat Firebase Console atau Firebase CLI hanya setelah seed user siap.
- [ ] Login sebagai `administrator` dan baca data utama.
- [ ] Login sebagai `administrator` dan pastikan tidak bisa membuat role `super_admin` baru.
- [ ] Login sebagai `user` dan pastikan tidak bisa akses Manajemen User.
- [ ] Test user inactive.
- [ ] Test user tanpa role valid.
- [ ] Pastikan tidak ada `Missing or insufficient permissions` untuk flow yang memang diizinkan.
- [ ] Pastikan permission denied muncul untuk flow yang memang dilarang.

### Checklist cleanup Auth/Role
- [ ] Role aktif hanya `administrator` dan `user`; `super_admin` hanya legacy compatibility.
- [ ] Status user hanya memakai `active` dan `inactive`.
- [ ] Route/menu guard memakai `roleAccess.js`.
- [ ] Role tidak dikenal default deny.
- [ ] Unauthorized page tampil, bukan white screen.
- [ ] No-profile dan inactive state tetap jelas di Login/AuthProvider.
- [ ] Tidak ada business page yang ikut berubah.

### Checklist route/menu
- [ ] Klik semua menu yang tampil untuk `administrator`.
- [ ] Jika masih ada user lama `super_admin`, klik semua menu yang tampil dan pastikan akses setara Administrator.
- [ ] Klik semua menu yang tampil untuk `user`.
- [ ] Pastikan Reset & Maintenance tampil untuk `administrator` dan tidak tampil untuk `user`.
- [ ] Pastikan route forbidden langsung dari URL diarahkan ke Unauthorized.

### Checklist build
- [ ] Jalankan `npm run build`.
- [ ] Jalankan `npm run preview`.
- [ ] Pastikan tidak white screen.
- [ ] Pastikan tidak ada error console terkait `UserManagement`, `userService`, `roleAccess`, atau `firestore.rules`.


---

## Checklist Auth UID Otomatis via Cloud Functions - 2026-04-29

### Checklist setup Functions
- [ ] Pastikan folder `functions` tidak berisi trigger stok legacy yang ikut aktif tanpa audit.
- [ ] Jalankan `cd functions && npm install`.
- [ ] Jalankan `npm run lint` atau `node --check index.js` dari folder `functions`.
- [ ] Deploy hanya function baru: `firebase deploy --only functions:createSystemUser`.
- [ ] Jika deploy memakai region khusus, samakan region di frontend Firebase Functions client.

### Checklist create user dari Manajemen User
- [ ] Login sebagai `administrator`.
- [ ] Buka Manajemen User.
- [ ] Klik Tambah Profile User.
- [ ] Pastikan field Auth UID tidak diminta saat create.
- [ ] Isi username, nama tampilan, role, status, dan password sementara.
- [ ] Simpan dan pastikan tidak ada password yang masuk ke `system_users`.
- [ ] Pastikan Firebase Authentication punya user baru dengan email internal `username@ims-bunga-flanel.local`.
- [ ] Pastikan Firestore membuat dokumen `system_users/{uid}` sesuai UID Auth.
- [ ] Pastikan tabel Manajemen User refresh dan Auth UID tampil/copyable.
- [ ] Logout lalu login memakai username dan password sementara user baru.

### Checklist guard role create user
- [ ] Login sebagai `administrator` dan pastikan pilihan role create hanya `administrator` dan `user`.
- [ ] Coba membuat `super_admin` dari payload langsung/function emulator dan pastikan ditolak.
- [ ] Login sebagai `user` dan pastikan Manajemen User tidak bisa dibuka dari menu maupun URL langsung.
- [ ] Nonaktifkan actor lalu pastikan actor inactive tidak bisa memanggil endpoint HTTP create user.
- [ ] Test user tanpa profile `system_users/{uid}` dan pastikan tidak bisa memanggil endpoint HTTP create user.

### Checklist data dan keamanan
- [ ] Firestore `system_users/{uid}` hanya berisi profile: authUid, username, usernameLower, displayName, role, status, createdAt, updatedAt, createdBy, updatedBy, lastLoginAt.
- [ ] Pastikan password sementara tidak muncul di Firestore, console log, docs, atau ZIP patch.
- [ ] Pastikan credential Admin SDK tidak ada di `src` frontend.
- [ ] Pastikan duplicate username ditolak.
- [ ] Pastikan create profile gagal melakukan rollback Auth user atau minimal tercatat di log function.

### Checklist non-regression bisnis
- [ ] Buka Dashboard setelah login.
- [ ] Buka Supplier, Purchases, Sales, Returns, Stock Management, dan Production menu utama.
- [ ] Pastikan tidak ada perubahan flow stok, kas, purchases, sales, production, payroll, HPP, reports, pricing rules, atau reset maintenance.
- [ ] Jalankan `npm run build` untuk frontend.
- [ ] Jalankan preview/manual smoke test setelah build.

### Checklist packaging patch
- [ ] ZIP patch hanya berisi file yang berubah.
- [ ] ZIP patch tidak berisi `node_modules`.
- [ ] ZIP patch tidak berisi `dist` atau `build`.
- [ ] ZIP patch tidak berisi `.git`.
- [ ] ZIP patch tidak berisi `.env` atau secret.
---

## Checklist Penyederhanaan Role Aktif - 2026-04-29

### Checklist UI Manajemen User
- [ ] Dropdown role create hanya menampilkan `Administrator` dan `User`.
- [ ] Dropdown role create tidak menampilkan `Super Admin`.
- [ ] Administrator bisa tambah user dengan role `administrator`.
- [ ] Administrator bisa tambah user dengan role `user`.
- [ ] Role `super_admin` lama, jika ada di tabel, tampil sebagai legacy dan bisa dimigrasikan manual ke `administrator` atau `user`.

### Checklist route/menu guard
- [ ] Administrator bisa membuka semua menu admin, termasuk Manajemen User dan Reset & Maintenance.
- [ ] User tidak melihat Manajemen User.
- [ ] User tidak melihat Reset & Maintenance.
- [ ] User yang mencoba URL admin-only diarahkan ke Unauthorized.
- [ ] User lama `super_admin`, jika masih ada, tidak langsung terkunci dan tetap mendapat akses setara Administrator sampai dimigrasikan.

### Checklist Cloud Function createSystemUser
- [ ] Payload role `administrator` diterima dari actor Administrator aktif.
- [ ] Payload role `user` diterima dari actor Administrator aktif.
- [ ] Payload role `super_admin` ditolak dari UI maupun emulator/direct HTTP.
- [ ] Jika error CORS/Internal masih muncul, cek deploy/region/log Cloud Function sebagai isu terpisah dari role dropdown.

## Checklist Fix CORS Callable createSystemUser - 2026-04-29

- [ ] Jalankan `cd functions && npm install` jika dependency belum terpasang.
- [ ] Jalankan `npm run lint` dari folder `functions`.
- [ ] Deploy `firebase deploy --only functions:createSystemUser`.
- [ ] Jalankan frontend di `http://localhost:5173`.
- [ ] Login sebagai Administrator dengan profile `system_users/{uid}` status `active`.
- [ ] Tambah user role `administrator` dan pastikan tidak ada CORS preflight blocked.
- [ ] Tambah user role `user` dan pastikan tidak ada CORS preflight blocked.
- [ ] Pastikan Firebase Authentication membuat user baru.
- [ ] Pastikan Firestore membuat `system_users/{uid}` sesuai UID Auth.
- [ ] Pastikan password sementara tidak tersimpan di Firestore.
- [ ] Jika masih muncul `FirebaseError: internal`, cek Firebase Functions logs karena frontend sudah memakai fetch HTTP dan function sudah menjawab CORS manual.
- [ ] Catat warning Ant Design deprecated, React 19 compatibility, dan favicon 404 sebagai non-blocker/kandidat cleanup terpisah.

## Checklist Bug Fix createSystemUser HTTP CORS — 2026-04-29

Status: **WAJIB TEST setelah deploy function**.

- [ ] Deploy function dengan `firebase deploy --only functions:createSystemUser`.
- [ ] Jalankan frontend di `http://localhost:5173`.
- [ ] Login sebagai `administrator` active.
- [ ] Buka `/system/user-management`.
- [ ] Tambah user role `administrator`.
- [ ] Tambah user role `user`.
- [ ] Pastikan request `OPTIONS` ke `createSystemUser` mendapat response aman dan tidak ada CORS blocked.
- [ ] Pastikan request `POST` membawa header `Authorization: Bearer <token>`.
- [ ] Pastikan user baru muncul di Firebase Authentication.
- [ ] Pastikan profile baru muncul di Firestore `system_users/{uid}`.
- [ ] Pastikan password sementara tidak tersimpan di Firestore.
- [ ] Pastikan role tersimpan hanya `administrator` atau `user`.
- [ ] Pastikan payload role `super_admin` ditolak jika dicoba manual.
- [ ] Pastikan user baru bisa login sesuai role/status.
- [ ] Pastikan warning Ant Design deprecated dan favicon 404 dicatat sebagai non-blocker jika masih ada.

## Checklist Follow-up createSystemUser CORS Runtime Option - 2026-04-29

- [ ] Deploy ulang function: `firebase deploy --only functions:createSystemUser`.
- [ ] Buka frontend dari `http://localhost:5173` lalu tambah user role `administrator`.
- [ ] Tambah user role `user`.
- [ ] Pastikan preflight `OPTIONS` mendapat header `Access-Control-Allow-Origin`.
- [ ] Pastikan endpoint HTTP tetap mengembalikan JSON saat error validasi/permission.
- [ ] Jika hosting production memakai GitHub Pages, test dari `https://vyo15.github.io` dan pastikan CORS tidak terblokir.
- [ ] Pastikan password sementara tidak muncul di dokumen `system_users/{uid}`.
- [ ] Pastikan payload role `super_admin` tetap ditolak sebagai role target baru.
