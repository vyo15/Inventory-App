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

Catatan real dari deskripsi halaman:
- QC tidak dijadikan step terpisah
- assembly dianggap proses akhir
- packing opsional bila memang ada pekerjaan pengemasan terpisah

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

## 5. BOM Produksi
Tujuan:
- komposisi produksi untuk target semi finished maupun produk jadi
- dasar auto requirement untuk PO

Rule penting yang terverifikasi:
- bila target adalah `product`, material yang boleh dipakai hanya `semi_finished_material`
- BOM menyimpan `materialLines` dan `stepLines`
- step lines sudah disortir menurut sequence

## 6. Production Order
Tujuan:
- planning produksi
- menghitung kebutuhan bahan dari BOM
- mendukung strategi varian material dan output

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

Data penting yang terlihat disimpan:
- link BOM dan link Production Order
- target item dan target variant
- step dan sequence
- worker ids/names/count
- planned qty, actual output qty, good/reject/rework/scrap
- startedAt, completedAt, durationMinutesActual
- material usages
- outputs
- materialCostActual, laborCostActual, overheadCostActual, totalCostActual, costPerGoodUnit
- monitoring miss dan output teoretis
- status stok konsumsi, output, dan payroll calculation

Status work log yang terlihat:
- `draft`
- `in_progress`
- `completed`

## 8. Payroll Produksi
Tujuan:
- rekap gaji produksi berbasis work log completed

Status payroll yang terlihat:
- `draft`
- `unpaid`
- `paid`

## 9. Analisis HPP Produksi
Tujuan:
- analisa biaya realisasi bahan, tenaga kerja, dan overhead per work log completed

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

Masih ada service legacy:
- `productionService.js`
- collection `productions`

Catatan penting:
- route utama saat ini **tidak** lagi memakai flow legacy tersebut sebagai pusat operasional
- utilitas reset data juga masih membersihkan `productions`
- artinya jejak flow lama masih ada dan perlu dicatat sebagai legacy layer

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
- Collection `productions` tetap dianggap legacy data layer yang hanya disentuh maintenance/reset scoped. File service legacy `productionService.js` tidak ditemukan di source `src.zip` terbaru, sehingga docs lama yang menyebut file tersebut harus dianggap outdated.

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
- Rule payroll diambil dari master Tahapan Produksi, bukan dari custom payroll karyawan legacy.
- Sinkronisasi labor cost ke Work Log hanya ringkasan display untuk HPP/read model, bukan pengganti source of truth line payroll.
