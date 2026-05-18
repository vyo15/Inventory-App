# PRODUCTION ARCHITECTURE — IMS Bunga Flanel

Dokumen ini fokus pada modul produksi final yang saat ini aktif di codebase.

## Ringkasan Arsitektur Produksi
Arsitektur produksi modern yang terlihat saat ini adalah:
- master step produksi
- master karyawan produksi
- master profil produksi
- master semi finished materials
- BOM Produksi
- Production Order
- Work Log Produksi
- Payroll Produksi
- Analisis HPP Produksi

## Flow Final yang Terlihat di Kode
Flow final yang tertulis di service production order:
- `BOM -> PO -> Start Production -> Work Log -> Complete`

Di sisi routing dan halaman, flow operasional yang paling masuk akal saat ini adalah:
- buat BOM
- buat Production Order dari BOM
- cek status requirement: shortage / ready
- mulai proses produksi
- realisasikan ke Work Log
- generate payroll dari work log selesai
- analisa HPP berdasarkan work log completed

## 1. Tahapan Produksi
Tujuan:
- standarisasi proses
- relasi dengan karyawan
- relasi dengan BOM

Catatan real dari source terbaru:
- Good Qty menjadi input hasil aktif utama; field hasil lain tidak dijadikan step terpisah dan tidak menjadi field monitoring di form Step.
- assembly dianggap proses akhir.
- packing opsional bila memang ada pekerjaan pengemasan terpisah.
- Step memakai `basisType` universal dengan label UI `Per Meter Bahan`, `Per Kawat`, `Per Qty`, dan `Per Batch`.
- Aturan upah step hanya memakai mode aktif `per_qty` dan `per_batch`; `payrollQtyBase` tidak menjadi payload Step baru, sedangkan klasifikasi payroll/HPP diturunkan otomatis dari jenis proses.

## 2. Karyawan Produksi
Tujuan:
- master operator untuk work log dan payroll
- bisa dihubungkan ke step produksi

## 3. Profil Produksi
Tujuan:
- menyimpan rumus hasil, batch assembly, dan batas miss per produk
- dipakai untuk aturan hitung operasional dan monitoring
- **bukan** pengganti BOM

Pemisahan fungsi yang terlihat:
- BOM = resep bahan
- Profil produksi = aturan hitung hasil/monitoring

## 4. Semi Finished Materials
Tujuan:
- stok internal untuk kebutuhan produksi
- bisa punya varian
- tidak ditujukan untuk dijual ke customer
- koreksi stok manual resmi dilakukan lewat Stock Management / Stock Adjustment, bukan dari edit master
- bisa reusable/lintas beberapa produk jadi sehingga tidak boleh diduplikasi per produk jadi hanya untuk kebutuhan tampilan

Organisasi UI aktif:
- daftar Semi Finished boleh ditampilkan grouped/accordion berdasarkan `Product Family / Jenis Bunga` lalu `Kategori` agar tidak menjadi daftar campur panjang
- saat group tertutup, UI boleh menampilkan ringkasan jumlah item, stok kosong, stok aman, dan item nonaktif
- saat group terbuka, item tetap menampilkan informasi stok total, available, variant stock, status, dan action existing
- fallback data lama yang tidak punya family/category harus tetap tampil, misalnya `Umum / Reusable` dan `Tanpa Kategori`

Guard integrasi:
- Stock Adjustment Semi Finished hanya mengoreksi stok dan audit inventory; tidak mengubah BOM, Production Order, Work Log, Payroll, atau HPP.
- Semi Finished bervarian wajib memakai `variantKey` saat adjustment agar bucket stok produksi tetap konsisten.
- Grouping UI tidak boleh mengubah collection `semi_finished_materials`, tidak boleh memecah stok per produk, dan tidak boleh menulis relasi baru tanpa approval.

## 5. BOM Produksi
Tujuan:
- komposisi produksi untuk target semi finished maupun produk jadi
- dasar auto requirement untuk PO

Rule penting yang terverifikasi:
- bila target adalah `product`, material utama memakai `semi_finished_material`, dan `raw_material` boleh dipakai untuk consumable assembly seperti lem tembak
- BOM menyimpan `materialLines` dan `stepLines`
- step lines sudah disortir menurut sequence
- estimasi material BOM mengambil live master cost terbaru: Raw Material memakai `averageActualUnitCost` dengan fallback `restockReferencePrice`; Semi Finished memakai `averageCostPerUnit` dengan fallback `lastProductionCostPerUnit`. Jika source master 0, estimate BOM wajib 0 dan tidak boleh fallback ke snapshot BOM lama.
- `materialLines[].costPerUnitSnapshot` / `totalCostSnapshot` di BOM hanya derived cache/read-only history field; bukan source utama untuk estimasi aktif, PO baru, atau Work Log baru.
- Untuk produksi bertingkat, input Semi Finished pada step berikutnya memakai HPP master Semi Finished dari step sebelumnya (`material + accrued labor saat Work Log completed + overhead jika ada`, lalu direvisi oleh payroll final jika ada selisih) setelah source masternya tersedia. Step berikutnya tidak boleh kembali memakai harga raw material awal sebagai shortcut.
- estimasi biaya produksi BOM mengambil tarif dari Tahapan Produksi.
- overhead BOM dipakai untuk biaya listrik/glue gun. Work Log baru dari PO membawa `overheadCostEstimate` BOM ke `overheadCostActual` dan mengalikannya dengan jumlah batch PO.

Organisasi UI aktif:
- daftar BOM boleh ditampilkan grouped/accordion berdasarkan `Target Type → Target Item → Resep Produksi`
- label user-facing boleh memakai istilah `Resep Produksi` agar tidak terlalu teknis, tetapi source of truth tetap dokumen BOM existing
- grouping BOM hanya cara baca UI; tidak mengubah rule material, target type, payload create/edit, atau service BOM

Alur source cost aktif:
- Raw Material master cost / Semi Finished master HPP terbaru → BOM estimate aktif → PO requirement qty → Work Log baru.
- Work Log baru wajib mengambil cost dari master aktif saat Start Production. Saat Complete, material yang sudah `stockDeducted=true` wajib memakai snapshot Start Production agar HPP tidak berubah karena master cost berubah setelah bahan keluar. Fallback baca master hanya untuk data legacy yang belum punya snapshot valid.
- Saat Complete Work Log, `laborCostActual` langsung di-accrue dari rule Tahapan Produksi dan jumlah operator agar HPP output tidak menunggu user klik Paid payroll. Payroll `paid/confirmed` hanya menjadi final adjustment/reconcile jika nominal final berbeda dari accrued labor.
- Weighted average cost/HPP memakai zero-cost baseline protection: jika stok lama masih ada tetapi cost/HPP master 0 karena reset/data lama, stok lama tidak boleh dihitung sebagai modal 0 saat ada pembelian/produksi baru; cost masuk pertama yang valid menjadi baseline.
- Snapshot BOM/PO hanya cache requirement; snapshot Work Log yang sudah dipotong menjadi histori costing material untuk completed Work Log, inventory log, payroll/final HPP history, dan transaksi yang sudah final.
- Reset Modal/HPP wajib merefresh BOM estimate dari master cost pasca-reset, menjaga `laborCostEstimate` dari step dan `overheadCostEstimate` existing.

Presisi dan pembulatan HPP:
- Qty resep produksi tetap bulat sesuai rule bisnis, misalnya 1 bunga memakai 10 kelopak, 1 daun, dan 1 tangkai.
- HPP internal per unit semi product kecil tidak boleh dibulatkan terlalu cepat. Nilai seperti `22.18125` tetap disimpan/dipakai kalkulasi BOM dan Work Log sebagai angka decimal internal.
- Pembulatan Rupiah penuh hanya untuk display utama, subtotal, total HPP produk jadi, harga jual, kas, purchase, payroll, dan laporan uang.
- UI detail produksi boleh menampilkan HPP/unit dengan 2 decimal, misalnya `Rp 22,18 / pcs`, agar `Rp 21,97` dan `Rp 22,18` tidak terlihat sama-sama `Rp 22`.
- Untuk komponen bunga, UI boleh menampilkan estimasi resep, misalnya `10 × HPP kelopak = ± Rp 222 / 10 kelopak`, tetapi kalkulasi tetap memakai angka decimal internal sebelum dibulatkan di total akhir.

## 6. Production Order
Tujuan:
- planning produksi
- menghitung kebutuhan bahan dari BOM
- mendukung strategi varian material dan output

UX create drawer aktif:
- source of truth submit tetap `bomId`, bukan field UI target/family/category baru
- untuk `Produk Jadi`, UI menampilkan `Jenis Produksi → Produk yang dibuat → Resep Produksi jika lebih dari satu → Qty → Preview Kebutuhan`
- untuk `Bahan / Semi Produk`, UI menampilkan `Jenis Produksi → Jenis Bunga / Product Family → Kategori Bahan → Bahan yang dibuat → Resep Produksi jika lebih dari satu → Qty → Preview Kebutuhan`
- filter `Jenis Bunga / Product Family` dan `Kategori Bahan` hanya dipakai untuk semi product, bukan dipaksakan ke produk jadi
- jika target hanya punya satu resep aktif, `bomId` boleh auto-selected secara internal dan field `Resep Produksi` tidak perlu tampil
- pilihan target user-facing tidak wajib menampilkan kode master internal atau hitungan jumlah BOM
- preview kebutuhan tetap read-only dan requirement final tetap dihitung ulang oleh helper/service existing saat submit

Status yang terlihat:
- `shortage`
- `ready`
- `in_production`

Makna status secara praktis:
- `shortage` = ada kekurangan material berdasarkan available stock snapshot
- `ready` = material cukup untuk diproses
- `in_production` = order sedang berjalan ke tahap realisasi

## 7. Work Log Produksi
Tujuan:
- realisasi produksi dari production order
- 1 PO = 1 Work Log
- Work Log baru dibuat dari action **Mulai Produksi** di Production Order, bukan dari input manual di menu Work Log

Data penting yang terlihat disimpan:
- link BOM dan link Production Order
- target item dan target variant
- step dan sequence
- worker ids/names/count
- planned qty, actual output qty, Good Qty aktif; field hasil lama tetap compatibility internal
- startedAt, completedAt, durationMinutesActual
- material usages
- outputs
- materialCostActual, overheadCostActual, laborCostActual, totalCostActual, costPerGoodUnit; input labor aktif tidak diedit manual dari Work Log karena labor diambil dari rule Tahapan Produksi saat Complete dan direvisi oleh payroll final bila ada selisih
- Work Log baru wajib memakai current master cost saat Start/Complete; stale BOM/PO/material line snapshot tidak boleh menjadi source biaya aktual baru
- monitoring miss dan output teoretis
- status stok konsumsi, output, dan payroll calculation

Status work log aktif yang terlihat:
- `in_progress`
- `completed`

Status compatibility:
- `draft` dan `cancelled` tidak menjadi opsi input/filter utama, summary card, tombol cancel, atau flow aktif baru di menu Work Log.

## 8. Payroll Produksi
Tujuan:
- rekap gaji produksi berbasis work log completed

Status payroll yang terlihat:
- `draft` = line payroll hasil sistem belum final/masih bisa dicek.
- `confirmed` = line payroll sudah disetujui bila flow approval dipakai.
- `paid` = payroll sudah dibayar dan menjadi trigger Cash Out/Expense otomatis.

Payment status yang terlihat:
- `unpaid` = belum dibayar.
- `paid` = pembayaran internal payroll sudah ditandai selesai.

## 9. Analisis HPP Produksi
Tujuan:
- analisa biaya realisasi bahan, overhead listrik/glue gun, dan tenaga kerja per work log completed, dengan pemisahan HPP Final vs HPP Preview.

Sumber HPP yang terlihat:
- data work log completed
- ringkasan biaya aktual, total good qty, dan rata-rata HPP per unit

## 10. Legacy Flow yang Masih Ada
## 9A. Boundary Logic Produksi yang Harus Dijaga
Boundary produksi aktif yang sekarang harus dianggap final/guarded:
- query dan fallback load Work Log
- filter PO yang boleh dipakai untuk start produksi
- lock field inti Work Log setelah linked ke PO
- lock Work Log setelah completed
- helper query completed work log untuk payroll / HPP

Catatan penting:
- refactor UI, shared component, atau patch modul lain tidak boleh memindahkan logic ini ke layer presentational
- bila ada task produksi baru, cek selalu boundary ini sebelum mengubah page/component apa pun
- jangan mengembalikan tombol tambah Work Log manual dari halaman Work Log tanpa review stock/payroll/HPP karena flow aktif harus lewat Production Order

Status legacy aktual hasil verifikasi source 2026-05-06:
- file `src/services/Produksi/productionService.js` **tidak ditemukan** pada ZIP aktual; jangan menjadikannya target patch aktif;
- collection `productions` masih diperlakukan sebagai legacy data layer pada maintenance/reset/audit, terutama melalui reset scoped dan legacy data audit;
- flow operasional utama tetap memakai service granular `productionBomsService.js`, `productionOrdersService.js`, `productionWorkLogsService.js`, `productionPayrollsService.js`, `productionPlanningService.js`, dan service master produksi terkait.

Catatan penting:
- route utama saat ini **tidak** lagi memakai collection `productions` sebagai pusat operasional;
- utilitas reset/maintenance masih dapat membersihkan atau mengaudit `productions` sebagai data lama;
- artinya jejak flow lama masih ada di data layer, bukan sebagai service aktif.

## Rekomendasi Dokumentasi Ke Depan
Setiap perubahan di modul produksi sebaiknya selalu diuji terhadap:
- requirement material
- status PO
- stock consumption
- stock output
- payroll calculation status
- HPP analysis result


## Tambahan Flow Produksi yang Perlu Dianggap Aktif
- saat Work Log `completed`, posting stok tetap mengikuti flow aktif yang ada
- setelah posting stok, summary costing Work Log harus dihitung ulang dari snapshot material final agar detail biaya tidak berhenti di 0
- sinkronisasi payroll ke Work Log hanya dipakai sebagai **ringkasan display labor**, bukan mengganti source of truth line payroll

## Update Boundary Produksi Setelah Cleanup Stok — 2026-04-25
- Cleanup stok umum tidak memindahkan logic posting stok produksi ke helper page.
- Flow produksi final tetap guarded: BOM → Production Order → Work Log → Payroll → HPP Analysis.
- `productionWorkLogsService` tetap boleh melakukan transaction sendiri untuk start/complete Work Log karena proses tersebut harus memotong material, menambah output, menutup status, dan mencatat log secara atomic.
- Collection `productions` tetap dianggap legacy data layer yang hanya disentuh maintenance/reset/audit scoped. File service legacy `src/services/Produksi/productionService.js` tidak ditemukan di source `Inventory-App.zip` terbaru, sehingga docs lama yang menyebut file tersebut sebagai file aktif harus dianggap outdated.

## Update Guarded Integration Stok & Log — 2026-04-25
- Produksi tetap dianggap guarded area.
- `productionWorkLogsService.js` tetap melakukan mutasi bahan keluar dan output masuk di dalam `runTransaction`.
- Mutasi stok produksi memakai `applyStockMutationToItem()` supaya field master dan varian tetap sinkron.
- Inventory log produksi memakai `buildInventoryLogPayload()` dari inventory log service final sehingga format log produksi sama dengan transaksi umum.
- Reserve/release Production Order masih dicatat sebagai flow legacy/guarded; jika dipakai, variant key hasil resolve helper final harus dipakai agar reserved stock tidak jatuh ke master/default.
- Business rules BOM, lifecycle Production Order, completed Work Log, HPP, dan payroll tidak diubah oleh cleanup ini.

## Update Auto Payroll Setelah Complete Work Log — 2026-04-25

Flow aktif produksi setelah patch ini:

`Production Order -> Work Log -> Complete Work Log -> Auto Payroll Line -> Payroll Produksi -> HPP Analysis`

Catatan boundary:
- `productionWorkLogsService` tetap menangani complete Work Log dan posting stok/output secara guarded.
- Auto payroll dijalankan setelah Work Log sukses completed, memakai `generatePayrollLinesFromCompletedWorkLog()`.
- Payroll line dibuat per operator yang tersimpan di Work Log.
- Id dokumen payroll dibuat deterministik dari Work Log + Step + Operator untuk mencegah duplikasi.
- Rule payroll diambil dari master Tahapan Produksi, bukan dari custom payroll karyawan.
- Sinkronisasi labor cost ke Work Log hanya ringkasan display untuk HPP/read model, bukan pengganti source of truth line payroll.

## Integration Map Produksi → Payroll → Kas → Laporan
1. Production Order menghasilkan Work Log.
2. Work Log completed memposting output stok satu kali dan menghitung `materialCostActual`.
3. Work Log completed memanggil auto payroll untuk membuat payroll line per operator.
4. Payroll line menyimpan `workLogId`, `workNumber`, `stepId`, `stepName`, `workerId`, dan `workerName`.
5. Complete Work Log langsung menyimpan accrued labor dari rule Tahapan Produksi ke `laborCostActual`, `totalCostActual`, dan `costPerGoodUnit` agar output HPP/master cost siap dipakai BOM bertingkat tanpa menunggu payroll paid.
6. Payroll summary tetap disinkronkan kembali ke Work Log sebagai final adjustment jika line payroll sudah `confirmed/paid` dan nominal final berbeda dari accrued labor.
7. Payroll paid membuat expense otomatis dengan guard `sourceModule/sourceId`.
8. Cash Out membaca expense payroll dari collection `expenses`.
9. Profit Loss membaca expense payroll dari `expenses`, sedangkan Payroll Report tetap membaca `production_payrolls`.


## Final Guard Produksi Setelah Task 6
- **Production Order preview aktif:** drawer create PO memakai preview compact read-only. Preview boleh membantu user melihat stok target dan kebutuhan material, tetapi tidak boleh menjadi source final submit.
- **Work Log completed guarded:** complete Work Log tidak boleh memproses stok/output dua kali, tidak boleh membuat payroll dobel, dan tidak boleh mengubah completed data tanpa evaluasi khusus.
- **Actual cost aktif:** completed Work Log wajib menyimpan ringkasan material/labor accrued/total/cost per good unit untuk HPP Analysis. Payroll final boleh merevisi selisih, tetapi HPP output tidak boleh material-only hanya karena payroll belum paid.
- **Payroll otomatis aktif:** Work Log completed membuat payroll line per operator berdasarkan rule Tahapan Produksi.
- **Cash Out otomatis aktif:** payroll `paid` membuat expense otomatis dengan source reference dan guard idempotent.
- **Legacy:** custom payroll preference di master karyawan tetap dibaca sebagai compatibility/info lama, bukan rule utama payroll baru.
- **Rollback guarded:** membatalkan payroll paid tidak boleh otomatis menghapus expense sebelum business rule rollback disepakati.

## Production Planning Architecture — 2026-04-25

### Posisi dalam Flow Produksi
Flow produksi aktif sekarang:

```text
Production Planning
→ Production Order
→ Work Log
→ Payroll Produksi / HPP Analysis
→ Dashboard / Laporan
```

Planning berada sebelum PO dan hanya menjadi target monitoring. Planning bukan pengganti BOM, bukan mutasi stok, dan bukan transaksi biaya.

### Collection Baru: `production_plans`
Field aktif:
- `planCode`
- `title`
- `periodType`
- `periodStartDate`
- `periodEndDate`
- `dueDate`
- `targetType`
- `targetItemId`
- `targetItemName`
- `targetItemCode`
- `targetUnit`
- `targetHasVariants`
- `targetVariantKey`
- `targetVariantLabel`
- `targetQty`
- `status`
- `priority`
- `linkedProductionOrderIds`
- `linkedProductionOrderCodes`
- `notes`
- `createdAt`
- `updatedAt`
- `createdBy`
- `updatedBy`

### Service Aktif
`src/services/Produksi/productionPlanningService.js` bertugas untuk:
- CRUD `production_plans`;
- generate `planCode`;
- membaca reference product/semi finished/BOM;
- menghitung progress dari Work Log completed;
- membuat PO dari planning melalui `createProductionOrder()` existing;
- menyajikan summary planning untuk Dashboard.

### Guard Integrasi PO
`productionOrdersService.js` ditambah field reference planning. Perubahan ini hanya menambah metadata `planningId/planningCode/planningTitle` dan tidak mengubah requirement BOM, reservation, start, complete, payroll, atau HPP.

### Guard Progress
Progress planning dihitung read-only dari Work Log completed. Perhitungan tidak menyimpan stok, tidak update Work Log, dan tidak update PO lifecycle.

### Guard Cancel Planning
Cancel Planning adalah status-level action pada layer target/monitoring sebelum PO. Planning tanpa PO boleh dicancel jika status belum final. Planning yang sudah punya PO / linked Production Order tidak boleh dicancel langsung; user harus mengelola PO terkait terlebih dahulu.

Cancel Planning hanya mengubah status Planning menjadi `cancelled`. Action ini tidak menghapus dokumen Planning, tidak menghapus/mengubah PO existing, dan tidak menyentuh Work Log, inventory/stok, Payroll, HPP, report, sales, purchases, returns, atau cash in/out.

Status final tetap guarded: Planning `cancelled` dan `completed` tidak boleh dibuatkan PO. Planning `overdue` tanpa PO masih boleh dibuatkan PO atau dicancel sesuai kebutuhan operasional.

### Boundary Planning Compatibility
- PO tanpa planning tetap dianggap PO aktif selama lifecycle produksinya valid.
- Work Log yang dibuat dari PO tetap valid walaupun planning kosong.
- Tidak ada migrasi otomatis dari menu harian.

### Guard Flower Group Semi Finished
- `semi_finished_materials.flowerGroup` adalah metadata grouping/filter, bukan relasi kepemilikan produk jadi.
- Create/update Semi Finished tidak boleh mengisi `flowerGroup` otomatis ke `mawar`; validasi harus gagal jika user belum memilih/mengetik jenis bunga.
- Production Order membaca grouping Semi Product dari reference master yang eksplisit. Jika reference tidak punya `flowerGroup`, item masuk fallback `Umum / Reusable`; jangan infer dari nama target/BOM.



## Update HPP Analysis Final/Preview — 2026-05-17
- `ProductionHppAnalysis.jsx` memisahkan `finalLaborCost`, `finalTotalCost`, dan `finalHppPerUnit` dari `displayLaborCost`, `previewTotalCost`, dan `previewHppPerUnit`.
- Resolver labor yang sama dipakai oleh detail Work Log dan HPP Analysis agar tidak ada drift antara payroll final, payroll draft, dan estimasi Step.
- Data Quality Audit produksi bersifat read-only dan sekarang mendeteksi payroll final pending/mismatch, output line HPP stale, master Product/Semi Finished HPP stale, variant output HPP stale, stale BOM cost estimate, serta Semi Finished aktif tanpa `flowerGroup`. Audit hasil selain Good Qty tidak diaktifkan.
- Flow payroll final baru menjalankan reconcile output HPP/master cost tanpa mutasi qty stok ulang. Data lama yang tidak tersentuh payroll sync tetap tidak dibackfill massal otomatis dan harus lewat audit/repair guarded terpisah.

## Guarded HPP Reconcile Payroll Final — 2026-05-18

Flow aktif source terbaru:

```text
BOM live master cost
→ Production Order requirement
→ Start Production freeze material actual snapshot
→ Complete Work Log post output material/overhead/accrued labor cost
→ Auto Payroll line sebagai payable/checking karyawan
→ Payroll final sync/reconcile hanya jika nominal final berbeda
→ Reconcile output HPP/master average cost tanpa mutasi qty stok ulang
```

Rule aktif:
- BOM estimasi membaca Raw Material `averageActualUnitCost` fallback `restockReferencePrice`.
- BOM estimasi membaca Semi Finished `averageCostPerUnit` fallback `lastProductionCostPerUnit`.
- Semi Finished bervarian harus memakai weighted average berdasarkan stok varian aktif agar BOM bertingkat tidak memakai HPP rata-rata sederhana yang miss.
- Complete Work Log memakai material snapshot yang sudah dibekukan saat Start Production. Fallback ke master hanya untuk data legacy yang belum punya snapshot cost.
- Complete Work Log wajib menghitung accrued labor dari master Tahapan Produksi (`payrollMode`, `payrollRate`, `payrollQtyBase`, `payrollOutputBasis`, `includePayrollInHpp`) dan operator. Jika step direct labor rate 0/operator kosong, complete harus ditolak agar HPP tidak material-only.
- Payroll final mengubah `laborCostActual`, `totalCostActual`, dan `costPerGoodUnit` hanya saat ada final line yang masuk HPP, lalu menjalankan reconcile output HPP/master cost.
- Pembelian/produksi masuk memakai weighted average dengan guard cost 0: stok lama yang cost/HPP-nya 0 tidak boleh menurunkan average cost saat incoming cost valid tersedia.
- Reconcile HPP tidak boleh menambah/mengurangi stock qty, tidak boleh membuat inventory log baru, dan tidak boleh mengubah status Work Log/PO.

Boundary legacy:
- Work Log lama yang tidak pernah tersentuh payroll sync tetap perlu Data Quality Audit/backfill guarded terpisah.
- Jika data sudah pernah dijual/dipakai sebelum reconcile, patch ini menjaga master cost ke depan tetapi tidak merekonstruksi COGS histori lama.

## Guard Modal/HPP Stok Awal dan Reset Cost — 2026-05-18

Rule aktif:
- Stock Adjustment `Tambah` untuk item yang cost/HPP master-nya masih 0 wajib mengisi `Modal per Unit` agar stok awal/data lama tidak masuk sebagai modal 0.
- Jika item sudah punya cost/HPP master valid, Stock Adjustment tetap hanya koreksi stok dan tidak meng-average ulang cost lama. Pembelian resmi tetap menjadi flow utama untuk incoming cost baru.
- Raw Material purchase dan output produksi memakai weighted average dengan zero-cost baseline protection. Contoh: stok lama 100 pcs dengan average cost 0, lalu beli/produksi 10 pcs dengan cost 1.000, average cost menjadi 1.000, bukan 90,9.
- Reset Modal/HPP hanya boleh dipakai untuk data test. Jika stok asli masih ada, simpan baseline/isi ulang modal via Stock Adjustment guard sebelum transaksi baru.
