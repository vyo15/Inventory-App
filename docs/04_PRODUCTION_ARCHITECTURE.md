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
- payroll draft membaca snapshot rule dari work log completed
- sebelum draft dipakai, Work Log completed harus lolos payroll eligibility gate
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

## 11. Contract Final Varian Produksi
Flow final varian produksi sekarang dikunci sebagai:

`PO target variant -> Work Log target snapshot -> Work Log output variant -> stock mutation -> inventory log`

Contract per layer:
- Production Order menyimpan `targetVariantKey` dan `targetVariantLabel` sebagai source of truth varian target.
- Requirement line menyimpan hasil turunan `resolvedVariantKey`, `resolvedVariantLabel`, dan `stockSourceType` untuk material usage.
- Work Log root menyimpan snapshot `targetVariantKey` dan `targetVariantLabel` dari PO.
- Work Log output menyimpan `outputVariantKey`, `outputVariantLabel`, dan `stockSourceType` yang wajib mengikuti target PO untuk flow `production_order`.
- Inventory log produksi menyimpan `variantKey` dan `variantLabel` sesuai material/output yang benar-benar dimutasi.

Status logic:
- **Final / guarded**: flow `production_order` dari PO ke Work Log dan output.
- **Manual / transisi**: draft BOM/manual masih ada, tetapi tidak boleh menjadi acuan flow final PO variant.
- **Legacy/deprecated**: `productionService.js` dan collection `productions` tetap legacy.

Tidak ada silent fallback untuk flow final PO variant. Jika varian tidak bisa di-resolve, proses wajib berhenti dengan pesan error agar stok tidak masuk ke master/default.

## 12. Contract Display Varian Produksi
Layer tampilan sekarang mengikuti contract yang sama dengan layer data:

`PO display -> Work Log display -> Output display -> Inventory log display`

Field display final:
- PO target: `targetVariantKey` / `targetVariantLabel`.
- PO requirement: `resolvedVariantKey` / `resolvedVariantLabel`.
- Work Log target: `targetVariantKey` / `targetVariantLabel`.
- Work Log material: `resolvedVariantKey` / `resolvedVariantLabel`.
- Work Log output: `outputVariantKey` / `outputVariantLabel`.
- Inventory log: `variantLabel`, fallback `variantKey`.

`stockSourceType` tetap ada sebagai metadata, tetapi tidak boleh menjadi satu-satunya penentu tampilan. Jika key/label varian aktual ada, UI harus menampilkan varian walaupun metadata lama masih `master`.

## Maintenance Produksi Varian Lama
Untuk data lama yang dibuat sebelum contract varian final stabil, perbaikan dilakukan melalui menu `Reset & Maintenance Data`.

Batas aman:
- PO yang belum punya Work Log boleh direbuild requirement line-nya dari BOM + target variant PO.
- Work Log yang belum applied boleh disinkronkan material usage dan output snapshot-nya dari PO.
- Work Log completed / stock applied hanya boleh display atau snapshot repair dari data yang sudah ada, tanpa posting stok ulang.
- Inventory log produksi boleh dilengkapi `variantKey` / `variantLabel` jika sumbernya jelas dari Work Log, tetapi quantity dan arah mutasi tidak boleh diubah.

Flow operasional final tetap: BOM → Production Order → Work Log → Payroll → HPP Analysis.
