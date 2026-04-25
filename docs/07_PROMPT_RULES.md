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
- jika task menyentuh payroll produksi, anggap contract finalnya adalah: Work Log completed -> auto-create payroll draft per operator -> review/confirm -> paid/cancelled
- jangan menghidupkan lagi flow candidate manual dari completed Work Log kecuali sedang menangani data legacy secara eksplisit

cek:
- BOM
- PO requirement
- material usage
- output stock
- payroll status
- HPP analysis

## Saat Menyentuh Baseline UI Table / Action
- anggap baseline table/action sebagai area presentational yang sudah dijaga konsistensinya
- jangan menambah tombol `Detail` kecuali halaman itu memang punya drawer/detail read-only atau modal detail yang jelas
- untuk main table yang lebar atau memakai `scroll.x`, kolom `Aksi` wajib di kanan dan `fixed: "right"`
- jika ada kolom `Status` di table lebar, letakkan sticky di kanan sebelum `Aksi`
- simple config page tidak perlu dipaksa punya `Detail`
- jika beban informasi halaman konfigurasi sudah terlalu kaya untuk tabel utama, halaman boleh dinaikkan menjadi detail-capable page ringan; `ProductionSteps` adalah contoh resmi untuk pola ini
- ledger/simple action page boleh tanpa `Detail`, tetapi action column dan tombolnya tetap harus mengikuti baseline global
- read-only data table page tidak perlu action column, tetapi tetap harus memakai surface table global (`app-data-table` / `ims-table`)
- nested/subtable tidak perlu dipaksa sticky kecuali ada bug horizontal scroll nyata
- jika ada halaman yang sengaja berbeda, jelaskan alasannya secara eksplisit sebelum coding
- utility page yang masih transisi harus diberi comment jelas: aktif / transisi / legacy, dan kapan aman dibersihkan

## Saat Menutup Task
Selalu beritahu apakah task itu sebaiknya juga mengupdate:
- `00_MASTER_CONTEXT.md`
- `03_BUSINESS_RULES.md`
- `05_CURRENT_STATE_AND_TECH_DEBT.md`
- `06_TEST_CHECKLIST.md`

## Prompt Rule: Cleanup File Legacy

Untuk task cleanup berikutnya:
- cek import tree terlebih dahulu, jangan menghapus file hanya karena nama file terlihat lama;
- file kosong dan tidak diimport boleh masuk daftar aman hapus;
- service legacy yang tidak diimport boleh dihapus dari codebase, tetapi data Firestore lama tetap harus dibersihkan lewat Reset & Maintenance Data;
- wrapper transisi harus diberi alasan kenapa belum dihapus;
- jika pengiriman patch memakai zip, sertakan daftar file yang harus dihapus manual atau script cleanup karena ekstrak zip biasa tidak dapat menghapus file lama secara otomatis;
- setelah cleanup valid, jangan membuat import baru ke file yang sudah dipensiunkan.

## Prompt Rule: Cleanup Structure Batch 2

Untuk task berikutnya:
- gunakan `ResetMaintenanceData.jsx` sebagai entry final menu maintenance;
- gunakan `resetMaintenanceDataService.js` di folder `services/Maintenance` sebagai service final untuk preview/reset/baseline/sync stok;
- jangan membuat import baru ke `ResetTestData.jsx` atau `services/Utilities/resetTestDataService.js`;
- route lama `/utilities/reset-test-data` hanya redirect transisi dan boleh dihapus setelah semua referensi memakai `/utilities/reset-maintenance-data`;
- jika cleanup menyentuh data, tetap gunakan Reset & Maintenance Data untuk dry run / repair aman / reset terarah.

## Prompt Rule Batch 3 — Legacy Data Cleanup
- Sebelum cleanup file/logic legacy berikutnya, jalankan atau minta user menjalankan `Cek Data Legacy` di menu Reset & Maintenance Data.
- Jangan menyarankan hapus database manual jika reset scoped atau repair aman tersedia.
- Jika audit menemukan transaksi lama tanpa snapshot variant, jangan buat fallback master baru. Tandai sebagai reset scoped untuk data testing atau manual review untuk data final.
- Completed/final data hanya boleh display/snapshot repair jika sumbernya jelas.
