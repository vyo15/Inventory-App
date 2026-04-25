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
- menjaga audit rule payroll per step tetap stabil walau master step berubah di kemudian hari

Contract final payroll yang sekarang harus dianggap resmi:
- source of truth rule payroll = master `production_steps`
- work log menyimpan snapshot rule payroll step (`mode`, `rate`, `qty base`, `output basis`, `classification`, `include in HPP`)
- saat work log completed, service payroll harus auto-create payroll draft per operator dari snapshot rule pada work log
- menu Payroll hanya membaca draft final untuk review, confirm, paid, atau cancelled; bukan lagi generator candidate manual
- sebelum draft dibuat, Work Log completed harus lolos payroll eligibility gate
- fallback ke master step hanya untuk work log lama yang belum punya snapshot dan harus dianggap legacy/deprecated
- custom payroll di master karyawan tidak lagi dipakai sebagai jalur hitung aktif
- payroll v1 final = 1 line per 1 operator + 1 step + 1 batch/work log
- satu work log boleh punya banyak payroll line aktif selama tiap operator line berbeda
- line payroll support / fulfillment tetap dibayar, tetapi dibedakan dari direct labor dan bisa dikeluarkan dari HPP inti

Status payroll yang terlihat:
- `draft`
- `confirmed`
- `paid`
- `cancelled`

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
- helper payroll rule produksi dan sinkronisasi flag payroll pada work log

Catatan penting:
- refactor UI, shared component, atau patch modul lain tidak boleh memindahkan logic ini ke layer presentational
- payroll eligibility gate dan validasi payload form payroll termasuk boundary guarded
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

## Update Architecture: Produksi Legacy Setelah Cleanup File

Flow produksi aktif tetap:

```text
BOM → Production Order → Work Log → Payroll → HPP Analysis
```

Service lama `src/services/Produksi/productionService.js` sudah tidak mempunyai import aktif di source tree terbaru. Karena service tersebut hanya mengatur collection legacy `productions` dan mutasi stok master-only, file tersebut masuk kategori aman dihapus dari codebase setelah dipastikan route/import lama tidak lagi menunjuk ke flow produksi dasar.

Catatan penting:
- menghapus file service legacy tidak berarti menghapus data Firestore secara otomatis;
- jika masih ada data `productions` lama, bersihkan lewat menu Reset & Maintenance Data / reset terarah produksi;
- jangan menghidupkan kembali flow `productions` sebagai jalur produksi aktif;
- production final tetap guarded di service BOM, Production Order, Work Log, Payroll, dan HPP.

## Maintenance Produksi dan Data Legacy
- Flow produksi final tetap `BOM → Production Order → Work Log → Payroll → HPP Analysis`.
- Collection `productions` adalah data legacy dan tidak menjadi source of truth produksi final.
- Jika data legacy produksi mengganggu cleanup, gunakan `Reset & Maintenance Data → Cek Data Legacy` lalu `Reset Produksi + Log` secara scoped.
- Completed Work Log tidak boleh diposting ulang oleh maintenance. Yang boleh diperbaiki hanya snapshot/display jika sumbernya jelas.
