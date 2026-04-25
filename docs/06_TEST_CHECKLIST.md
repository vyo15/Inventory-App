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
