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
- jangan otomatis membuat expense payroll saat `paid` tanpa guard idempotent yang jelas (`sourceModule` + `sourceId`)
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
- Jangan otomatis membuat Cash Out/Expense dari payroll `paid` tanpa task dan guard idempotent khusus.
- Jangan memakai custom payroll karyawan legacy sebagai source utama payroll baru; rule final tetap Tahapan Produksi.
