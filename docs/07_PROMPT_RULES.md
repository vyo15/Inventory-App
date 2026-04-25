# PROMPT RULES — IMS Bunga Flanel

Gunakan file ini sebagai aturan kerja saat membantu project IMS Bunga Flanel.

## Aturan Umum
1. Anggap dokumen di folder ini sebagai sumber konteks utama.
2. Jangan mengubah arsitektur atau rule bisnis tanpa menyebut dampaknya.
3. Jika menemukan konflik antara flow aktif dan flow legacy, sebutkan eksplisit.
4. Untuk task kode, jangan langsung refactor besar kalau tidak diminta.
5. Output kode harus siap tempel dan jelas file targetnya.

## Sebelum Memberi Solusi
Selalu jelaskan singkat:
- pemahaman task
- file yang kemungkinan terdampak
- efek ke stok, kas, laporan, atau produksi bila ada
- risiko mismatch schema / collection bila ada

## Rule Penting Project Ini
- field stok sedang transisi: jangan ubah hanya `stock` bila area tersebut sudah memakai `currentStock`
- sales selesai baru mengakui income
- cancel/delete sale punya logic revert stok yang sensitif
- purchases membuat expense otomatis
- purchases report membaca `expenses`, bukan `purchases`
- profit loss membaca `revenues + incomes + expenses`
- flow produksi aktif adalah BOM → Production Order → Work Log → Payroll → HPP Analysis
- collection `Customers` vs `customers` harus dianggap temuan penting setiap kali menyentuh module customer/sales

## Format Jawaban yang Diinginkan
Untuk task pengembangan:
1. warning mismatch atau risiko dulu bila ada
2. ringkasan apa yang akan diubah
3. sebut file yang diubah
4. beri hasil final siap pakai
5. tambahkan checklist test singkat

## Saat Menyentuh Modul Sensitif

### Jika task menyentuh stok
cek:
- `stock`
- `currentStock`
- `reservedStock`
- `availableStock`
- `inventory_logs`

### Jika task menyentuh penjualan
cek:
- pengurangan stok
- cancel / delete revert
- income saat status selesai
- laporan penjualan
- cash in

### Jika task menyentuh pembelian
cek:
- total stock in
- average actual unit cost
- restock reference price
- expense otomatis
- laporan pembelian

### Jika task menyentuh produksi
- anggap logic produksi sebagai **locked / guarded area** setelah task stabilisasi ini
- jangan ubah contract Work Log / PO / Payroll hanya karena refactor UI atau shared component
- jika task menyentuh `productionWorkLogsService`, `productionOrdersService`, `productionPayrollsService`, atau helper produksi, sebutkan bahwa ini area sensitif
- jika ingin mengubah status flow, contract 1 PO = 1 Work Log, stock posting start/complete, atau completed log editability, wajib evaluasi khusus dan update docs produksi

cek:
- BOM
- PO requirement
- material usage
- output stock
- payroll status
- HPP analysis

## Saat Menutup Task
Selalu beritahu apakah task itu sebaiknya juga mengupdate:
- `00_MASTER_CONTEXT.md`
- `03_BUSINESS_RULES.md`
- `05_CURRENT_STATE_AND_TECH_DEBT.md`
- `06_TEST_CHECKLIST.md`


## Tambahan Guard Batch Prioritas
- jika task menyentuh `productionWorkLogsService`, perlakukan summary costing saat complete sebagai area sensitif
- payroll `paid` boleh membuat expense otomatis hanya jika guard idempotent `sourceModule` + `sourceId` tetap dipakai
- jika task menyentuh export laporan, utamakan helper XLSX reusable dan jangan merusak filter/source data laporan

## Update Prompt Guard Setelah Cleanup — 2026-04-25
- Untuk mutasi stok umum, prioritaskan `updateInventoryStock()` dan jangan update `stock/currentStock/variants[]` langsung dari page.
- Jika item bervarian, caller wajib mengirim `variantKey` kecuali sedang menangani data legacy dengan alasan eksplisit.
- Stock Adjustment wajib memakai `updateInventoryStock()` dan validasi keluar harus berbasis `availableStock`, bukan hanya `currentStock`.
- `customers` lowercase adalah collection final customer. `Customers` uppercase harus dianggap legacy/test data kecuali ada bukti baru.
- Inventory log baru sebaiknya mengirim `referenceId`, `referenceType`, dan detail transaksi agar Stock Management bisa menampilkan audit trail jelas.
- Produksi final tetap guarded exception dan tidak boleh dipaksa memakai helper stok umum jika transaction produksi memang dibutuhkan.
- File unused boleh dihapus hanya setelah grep/import check membuktikan tidak dipakai route/runtime.

## Update Prompt Guard Karyawan Produksi — 2026-04-25
- Jika task menyentuh Karyawan Produksi, jangan kembalikan field `code` menjadi input manual.
- Kode karyawan baru wajib mengikuti format `DDMMYYYY-XXX` dan digenerate oleh `productionEmployeesService.js`.
- Preview kode di UI hanya bantuan tampilan; kode final tetap harus digenerate ulang saat create.
- Edit karyawan tidak boleh regenerate kode existing karena Work Log/Payroll bisa menyimpan display reference lama.
- Kode lama seperti `EMP-...` dianggap legacy data dan jangan dimigrasi otomatis tanpa task khusus.

## Update Prompt Guard UI Produksi — 2026-04-25

- Patch UI produksi tidak boleh mengembalikan tabel utama Production Orders atau Work Log Produksi ke `scroll x` besar hanya untuk mengakses tombol aksi.
- Kolom aksi produksi harus langsung terlihat pada desktop/laptop normal, atau diringkas tanpa menghapus handler Detail, Refresh Need, Mulai Produksi, Edit, dan Selesaikan.
- Modal `Selesaikan Work Log Produksi` wajib mempertahankan konteks estimasi output/hasil sebagai acuan user sebelum mengisi Good Qty, Reject Qty, dan Rework Qty.
- Perubahan UI produksi tidak boleh mengubah flow produksi, posting stok, payroll, HPP, status lifecycle, atau completed guard.

## Prompt Guard Auto Payroll Produksi — 2026-04-25

- Jika task menyentuh Work Log complete, jangan putus flow auto payroll.
- Setelah Work Log completed, sistem wajib memanggil generator payroll idempotent per Work Log + Step + Operator.
- Jangan membuat payroll dobel saat user klik Selesaikan dua kali, refresh, atau reload data.
- Jangan mengubah posting stok/output Work Log hanya untuk memperbaiki payroll.
- Jangan memutus flow payroll `paid` -> Cash Out/Expense otomatis yang sudah memakai guard idempotent khusus.
- Jangan memakai custom payroll karyawan legacy sebagai source utama payroll baru; rule final tetap Tahapan Produksi.

## Prompt Guard — Integrasi IMS Otomatis
- Jangan memutus flow Work Log completed → payroll line otomatis.
- Jangan membuat payroll line dobel; guard wajib berbasis Work Log + Step + Operator.
- Payroll `paid` sekarang otomatis membuat Cash Out/Expense, tetapi wajib memakai guard `sourceModule=production_payroll` dan `sourceId=payrollId`.
- Jangan membuat expense payroll tanpa source reference.
- Jangan membuat Profit Loss menghitung payroll langsung dari `production_payrolls` jika payroll paid sudah menjadi expense, karena akan double counting.
- Jangan membuat rollback/delete expense otomatis saat payroll paid dibatalkan sebelum business rule rollback diputuskan.
- Jangan backfill data lama otomatis tanpa task khusus dan preview.


## Prompt Guard Final Cleanup Task 6
- Jika task menyentuh Stock Management, jangan hapus kolom Referensi Audit; rapikan labelnya agar manusiawi dan pertahankan ID teknis sebagai detail sekunder.
- Jika task menyentuh Stock Adjustment, angka bulat tidak boleh tampil `.00`, adjustment keluar wajib berbasis `availableStock`, dan riwayat terbaru harus di atas.
- Jika task menyentuh Production Order create drawer, jangan hilangkan preview compact stok target dan kebutuhan material; preview tetap read-only dan PO final tetap dihitung dari BOM/helper final.
- Jika task menyentuh Work Log complete/cost, perlakukan area ini guarded: jangan double posting stok, jangan double payroll, jangan isi cost asal, dan jangan ubah HPP tanpa cek completed Work Log cost final.
- Jika task menyentuh Payroll Produksi, pertahankan auto payroll dari Work Log completed dan auto expense dari payroll paid dengan guard idempotent.
- Jika task menyentuh Karyawan Produksi, jelaskan payroll preference legacy sebagai compatibility; rule payroll final tetap Tahapan Produksi + Work Log completed.
- Jika task menyentuh Cash Out, payroll expense otomatis harus punya `sourceModule=production_payroll`, `sourceId`, dan `sourceRef`; jangan buat expense dobel.
- Jika task menyentuh Profit Loss, jangan hitung payroll dari `production_payrolls` jika payroll paid sudah masuk `expenses`.
- Jika task menyentuh report export, pertahankan XLSX final yang siap baca; jangan kembalikan export ke data mentah/JSON/CSV sebagai output utama.
- Jika task UI produksi, tabel utama tidak boleh butuh scroll horizontal hanya untuk tombol aksi dan modal complete Work Log wajib menampilkan estimasi output.
