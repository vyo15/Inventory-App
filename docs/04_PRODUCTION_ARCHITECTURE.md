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
