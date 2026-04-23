# CURRENT STATE & TECH DEBT — IMS Bunga Flanel

Dokumen ini tidak berisi tebakan. Semua poin di bawah berasal dari temuan audit source code saat ini.

## Bagian yang Sudah Terlihat Matang
- struktur route utama sudah cukup rapi
- service layer sudah mulai dipisah untuk master data, pricing, inventory, produksi, dan utilitas
- modul produksi final sudah jauh lebih matang daripada flow legacy
- pricing rules sudah punya fondasi logika yang jelas
- reset data uji sudah cukup canggih karena mendukung baseline dan sinkronisasi field stok
- inventory log sudah menjadi audit trail lintas modul

## Bagian yang Masih Terlihat Transisional

### 1. Field stok lama vs field stok baru
Temuan:
- beberapa service baru sudah menganggap `currentStock` sebagai source of truth aktif
- tetapi masih banyak logic lama yang langsung mengubah `stock`

Risiko:
- tampilan atau logic modul baru dan modul lama bisa berbeda hasil

### 2. Customer collection inkonsisten
Temuan:
- halaman Customers membaca `Customers`
- halaman Customers menambah data ke `customers`
- halaman Sales membaca `customers`

Risiko:
- data customer bisa terpencar di dua collection
- halaman customer dan halaman sales bisa tidak sepenuhnya sinkron

### 3. Stock Adjustment hanya update `stock`
Temuan:
- `StockAdjustment.jsx` melakukan `updateDoc(..., { stock: increment(...) })`
- tidak ikut update `currentStock`

Risiko:
- item yang dibaca modul baru berbasis `currentStock` bisa tidak konsisten setelah adjustment manual

### 4. Revert sale juga hanya update `stock`
Temuan:
- saat cancel / delete sale, revert stok dilakukan dengan `stock: increment(...)`
- tidak ikut update `currentStock`

Risiko:
- sinkronisasi stok bisa tidak penuh

### 5. Laporan stok masih sederhana
Temuan:
- `StockReport.jsx` memakai threshold tetap `10`
- membaca `stock` dan bukan pendekatan stok baru yang lebih lengkap
- belum terlihat mempertimbangkan varian/reserved stock secara penuh

Risiko:
- laporan stok bisa berbeda dengan kebutuhan operasional produksi yang lebih detail

### 6. Firebase Functions tampak legacy
Temuan:
- `functions/index.js` masih punya trigger lama yang update stok pada `products`
- purchase function bahkan masih mengarah ke `products` saat purchase item dibuat
- tidak terlihat sinkron dengan logic aplikasi aktif yang banyak berjalan di client/service layer dan memakai `raw_materials`

Risiko:
- bila function ini aktif di environment production, ada potensi logic dobel atau salah target

### 7. Flow legacy produksi masih tersisa
Temuan:
- `productionService.js` masih ada
- collection `productions` masih dibersihkan oleh utilitas reset
- route utama saat ini berpusat pada BOM/PO/Work Log, bukan `productions`

Risiko:
- developer baru bisa bingung membedakan flow aktif dan flow lama

## Current State yang Sebaiknya Dianggap Resmi
Untuk dokumentasi saat ini, flow aktif yang paling aman dianggap resmi adalah:
- master data modern
- transaksi pembelian/penjualan/retur
- cash in & cash out
- inventory logs
- pricing rules
- produksi final: BOM → Production Order → Work Log → Payroll → Analisis HPP
- reset utilitas dengan baseline

## Prioritas Tech Debt yang Paling Layak Dibereskan Dulu
1. satukan semua mutasi stok agar selalu update `currentStock`, `stock`, dan bila perlu `availableStock`
2. rapikan `Customers` vs `customers`
3. audit ulang Firebase Functions apakah masih dipakai atau sebaiknya dipensiunkan
4. dokumentasikan resmi bahwa `productions` adalah legacy flow
5. rapikan laporan stok agar membaca field stok aktif dan mendukung varian lebih baik

## Definition of Done untuk Perubahan Besar Berikutnya
## Update Current State: Guard Logic Work Log Produksi
Perbaikan terbaru di area produksi menegaskan:
- Work Log load dibuat lebih tahan gangguan jika salah satu referensi produksi gagal dimuat
- query Work Log completed punya fallback agar payroll / HPP tidak mudah ikut gagal karena index/query
- filter referensi PO untuk Work Log sekarang hanya menampilkan PO yang benar-benar masih eligible diproses
- Work Log completed dianggap locked agar patch lain tidak mengubah hasil produksi yang sudah ter-posting

Status current state yang sekarang paling aman dianggap resmi:
- logic inti produksi adalah area sensitif / guarded
- refactor UI lintas modul tidak boleh mengubah contract flow produksi tanpa task khusus produksi

Sebuah task dianggap aman selesai bila:
- route/halaman target berhasil jalan
- stock mutation sinkron
- inventory log tetap tercatat
- collection sumber laporan tetap benar
- flow produksi final tidak rusak
- tidak menambah inkonsistensi schema baru

## Update Current State: Payroll Produksi Final
Perbaikan payroll produksi menegaskan baseline baru berikut:
- payroll final sekarang memakai 1 alur utama: `production_steps` -> snapshot rule ke Work Log -> generate Payroll dari Work Log completed
- mode `per_batch` sekarang benar-benar memakai qty batch work log, bukan lagi membayar 1x rate tanpa pengali
- custom payroll pada master karyawan dipindah statusnya menjadi legacy/deprecated dan tidak lagi menjadi jalur hitung aktif
- work log completed yang sudah punya payroll aktif tidak lagi tampil sebagai kandidat draft payroll baru
- status payroll di work log disinkronkan kembali agar audit trail Work Log -> Payroll lebih jelas

Area guarded tambahan yang sekarang tidak boleh diubah sembarangan:
- `productionPayrollsService`
- `productionPayrollRuleHelpers`
- snapshot payroll rule pada payload `production_work_logs`
- rumus final `per_batch` / `per_qty` di helper payroll
