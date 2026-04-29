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
- collection customer final adalah `customers` lowercase; `Customers` uppercase harus dianggap legacy/test data kecuali ada task migrasi khusus

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
- Stock Adjustment wajib memakai Firestore transaction atau guard setara agar record adjustment, mutasi stok, dan inventory log tidak partial; validasi keluar harus berbasis `availableStock`, bukan hanya `currentStock`.
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

## Prompt Guard Dashboard Operational Control Center — 2026-04-26
- Dashboard adalah read-only operational control center; jangan membuat Dashboard melakukan write data ke stok, PO, Work Log, Payroll, Cash Out, Income, Expense, atau laporan.
- Dashboard boleh menampilkan link/action card, tetapi semua action hanya navigasi ke menu terkait.
- Dashboard tidak boleh memakai table besar atau horizontal scroll sebagai layout utama.
- Prioritas Hari Ini wajib actionable dan ringkas: stok menipis, PO shortage, PO siap, Work Log berjalan, Planning overdue, dan Payroll pending.
- Dashboard Planning tidak boleh hanya angka agregat; wajib menampilkan maksimal 3 planning urgent berdasarkan overdue, deadline dekat, progress rendah, dan remaining target besar.
- Progress planning di Dashboard harus mengikuti summary Production Planning yang berbasis Work Log completed/PO terkait, bukan PO created atau input manual.
- Planning completed/cancelled tidak boleh tampil sebagai urgent.
- Keuangan Dashboard bersifat ringkas; Profit Loss tetap source final untuk laporan laba/rugi.
- Jika payroll paid sudah/sedang terhubung ke Expense, tampilkan catatan agar tidak terjadi double counting.
- Status Integrasi IMS harus menjadi warning/read-only guard, bukan proses auto posting.
- Jika Work Log completed punya actual cost 0, tampilkan warning untuk cek HPP/cost material; jangan isi cost otomatis dari Dashboard.
- Dashboard harus punya last updated dan refresh yang hanya reload data summary.
- Jika salah satu service/collection gagal, Dashboard wajib fallback aman dan tidak white screen.


## Prompt Guard Final Hardening Fase A-G - 2026-04-26

### Guard Fase A - Sales Stock Safety
- Jika task menyentuh Sales create/update/cancel/delete, audit dulu dampak ke stok, income, dan inventory log.
- Jangan membuat sale tersimpan jika `availableStock` master/varian tidak cukup.
- Jangan kembali memakai `currentStock` saja untuk validasi sale.
- Jika item sama muncul beberapa baris, total kebutuhan harus dihitung sebelum create sale.
- Item bervarian wajib memakai `variantKey` yang valid.
- Income tetap hanya dibuat saat status `Selesai` dan tidak boleh dobel.
- Cancel/delete sale tetap guarded agar stok tidak double revert.

### Guard Fase B - Purchase Expense Metadata
- Jika task menyentuh Purchases, jangan hapus expense otomatis.
- Jangan ubah amount expense pembelian tanpa alasan bisnis eksplisit.
- Saving pembelian tetap info efisiensi, bukan pengurang kas.
- Expense pembelian wajib punya reference audit: `sourceModule`, `sourceId`, `sourceRef`, `sourceType`, dan `createdByAutomation`.
- Pertahankan schema aktif `sourceModule: purchases` jika reader Cash Out/Report masih memakai plural.

### Guard Fase C - HPP / Work Log Cost 0
- Jangan mengisi cost 0 dengan angka perkiraan.
- Jika sumber material/payroll belum lengkap, tampilkan warning, bukan menghitung asal.
- Draft payroll tidak boleh dianggap final untuk HPP.
- Jangan proses ulang Work Log completed hanya untuk memperbaiki display cost.
- Warning cost 0 harus tetap terlihat di HPP Analysis, detail Work Log, dan export HPP jika ada.

### Guard Fase D - Dashboard
- Dashboard wajib read-only; tidak boleh ada write ke Firestore dari Dashboard.
- Dashboard maksimal 5 section utama dan tidak boleh kembali menjadi laporan besar penuh table.
- Jangan tampilkan angka keuangan Dashboard sebagai Profit Loss final.
- Stok kritis Dashboard harus memakai `availableStock` bila tersedia agar tidak misleading.
- Dashboard harus punya last updated dan refresh yang hanya reload data.

### Guard Fase E - Report / Export
- Export final wajib XLSX rapi dengan header manusiawi, bukan object mentah.
- Jangan ubah source data bisnis hanya untuk mempercantik laporan.
- Stock Report harus tetap mencakup semi-finished stock jika data produksi memakai semi-finished.
- HPP export tidak boleh mengubah rumus HPP dan harus membawa warning/validasi cost.
- Payroll CSV boleh legacy compatibility, tetapi XLSX adalah output utama yang siap baca.

### Guard Fase F - Legacy Duplicate Cleanup
- Jangan edit file di `src/src/**` sebagai patch aktif.
- Jika menemukan duplicate legacy, buktikan dulu dengan grep/import/route check.
- Jangan hapus file tanpa `DELETE_LIST.md` atau catatan jelas berisi bukti.
- Jangan menyentuh file aktif di `src/pages`, `src/services`, `src/router`, atau `src/config` saat task hanya cleanup legacy.

### Guard Fase G - Docs Final
- Fase docs hanya boleh mengubah file docs dalam scope.
- Jangan klaim source selesai jika belum ada bukti dari source terbaru.
- Jika docs dan source konflik, tulis status sebenarnya dan catat sebagai tech debt.
- ZIP final docs hanya boleh berisi file docs yang berubah.

## Guard Supplier Restock Catalog Manual

- Jika task menyentuh Supplier atau Raw Material, jangan membuat flow yang memasang supplier ke Raw Material berdasarkan `materialDetails`.
- Supplier adalah katalog vendor/restock, bukan sumber pemasangan supplier otomatis ke bahan.
- Raw Material memilih supplier manual dari form Raw Material.
- Snapshot `supplierName` dan `supplierLink` boleh diperbarui/dibersihkan hanya untuk raw material yang sudah memiliki `supplierId` sama dengan master Supplier yang diedit/dihapus.
- Jangan menghapus field manual `supplierId`, `supplierName`, dan `supplierLink` dari raw material tanpa migrasi eksplisit.
- Jangan mengembalikan tombol “Sinkronkan Bahan”.
- Jangan menghidupkan lagi helper yang memasang Supplier ke collection `raw_materials` berdasarkan katalog material.
- `productLink`, `referencePrice`, dan `note` di Supplier hanya referensi restock.
- Harga aktual pembelian tetap dari Purchases; jangan auto-fill atau override dari harga referensi supplier.
- Jangan sentuh stok, Purchases mutation, Sales, Production, HPP, Cash Out, atau Reports jika task hanya Supplier katalog.

## Prompt Guard Restock Assistant

- Restock Assistant hanya boleh berupa navigasi/prefill dan tidak boleh membuat purchase otomatis.
- Dashboard tidak boleh melakukan write ke Firestore saat user klik action restock.
- Tombol internal dari Dashboard/Raw Material wajib memakai React Router navigation yang aman untuk HashRouter.
- Link produk utama restock harus berasal dari Purchases terakhir, bukan dari link toko supplier umum.
- Purchases prefill dari query tidak boleh mengubah rumus `actualUnitCost`, `restockReferencePrice`, saving, expense, atau stok.
- Jangan tampilkan semua supplier di Dashboard atau Detail Raw Material; semua perbandingan supplier tetap di menu Supplier.
- Jangan mengembalikan tombol/logic “Sinkronkan Bahan” atau pemasangan supplier otomatis berdasarkan `materialDetails`.

## Guard Stok Varian Final

- Jangan membuat normalisasi stok varian baru yang tidak memakai `variantStockNormalizer`.
- Jangan menghapus field `stock` atau `currentStock`; keduanya wajib dipertahankan untuk kompatibilitas.
- Jangan melemahkan audit Reset/Maintenance agar mismatch terlihat OK.
- Jangan membuat inventory log hanya untuk normalisasi field turunan stok.
- Jika task menyentuh writer varian, pastikan output variant punya `stock`, `currentStock`, `reservedStock`, `availableStock`, `variantKey`, dan `isActive`.
- Jika task menyentuh master item bervarian, pastikan master `stock === currentStock` berdasarkan total varian.

## Guard Reset & Maintenance Aman

- Jangan menambahkan `supplierPurchases` ke reset default atau reset transaksi.
- Supplier adalah protected master data; reset Supplier harus task destructive khusus dengan preview dan konfirmasi eksplisit.
- Jangan membuat Hapus Data Test menghapus dokumen tanpa marker `isTestData=true`, `sourceModule=dev_test_seed`, dan `createdBy=dev_seed`.
- Jangan memakai Reset/Maintenance sebagai flow harian user.
- Jangan mengubah flow Supplier, Raw Material, Purchases, stok, produksi, payroll, HPP, dashboard, atau reports saat task hanya mengamankan reset.

## Guard Purchases Supplier Restock Prefill

- Jika task menyentuh Purchases, Link Produk boleh diprefill dari Supplier `materialDetails`, tetapi tidak boleh membuat purchase otomatis.
- Harga Supplier Tercatat dari Supplier hanya pembanding; jangan jadikan sebagai harga aktual pembelian atau `actualUnitCost`.
- Jangan mengubah rumus `totalStockIn = Qty Beli × Konversi Supplier` untuk bahan baku.
- Total Pembanding Supplier harus memakai komponen katalog supplier agar ongkir/admin/diskon default tidak otomatis dikali per satuan stok saat Qty Beli lebih dari 1.
- Jangan fallback diam-diam ke semua supplier saat bahan baku sudah dipilih; tampilkan empty state jika belum ada supplier relevan.
- Jangan mengembalikan auto-sync Supplier ke Raw Material dan jangan menulis `raw_materials` dari form Supplier/Purchases.

## Guard Katalog Restock Supplier

- Jangan mengembalikan field Kategori/Keterangan Supplier sebagai input utama jika task membahas restock supplier.
- Supplier `materialDetails` boleh menyimpan konteks satuan/konversi/estimasi biaya, tetapi tidak boleh menjadi transaksi pembelian.
- Harga Estimasi Supplier / Satuan Stok hanya pembanding; jangan pakai sebagai harga aktual pembelian atau `actualUnitCost`.
- Purchases boleh prefill dari Supplier, tetapi user tetap harus mengisi dan menyimpan transaksi aktual sendiri.
- Jangan menulis `raw_materials`, stok, kas, expense, atau laporan dari menu Supplier.

## Guard Purchases Stok Masuk Total

- Jika task menyentuh form Purchases, tampilkan Stok Masuk total sebagai informasi utama: `Qty Beli × Konversi Supplier`.
- Jangan mengembalikan Konversi Supplier sebagai input utama/editable di Purchases.
- Jangan membuat perubahan Qty Beli memicu reset item/supplier/link/purchaseType/harga pembanding.
- Jangan menghapus guard manual subtotal; harga barang supplier hanya default, bukan pemaksa harga aktual.
- Jangan membuat shipping tier / ongkir bertingkat tanpa task khusus; ongkir, voucher, diskon ongkir, dan biaya layanan aktual tetap editable di Purchases.
- Reject/selisih barang harus diarahkan ke Penyesuaian Stok, bukan edit konversi di Purchases.

## Guard Stock Management Inventory Log
- Stock Management adalah halaman audit log + Penyesuaian Stok dalam satu konteks; membuka halaman tidak boleh membuat mutasi stok.
- Jangan menampilkan kolom generik `Stok` jika data snapshot before/after tidak reliable untuk semua inventory log.
- Jangan mengisi kolom stok audit dengan stok saat ini karena itu menyesatkan untuk riwayat historis.
- Jika semua writer inventory log nanti sudah menyimpan snapshot yang konsisten, kolom boleh dibuat ulang dengan label eksplisit seperti `Stok Setelah` atau `Stok Sebelum/Sesudah`.
- Kolom Catatan di tabel inventory log harus ringkas; catatan panjang boleh dipotong/ellipsis, bukan membuat row terlalu tinggi.
- Jangan mengubah `variantStockNormalizer` hanya untuk merapikan tabel riwayat. Submit Stock Adjustment boleh disentuh hanya jika tujuannya menjaga adjustment, stok, dan inventory log tetap konsisten.

## Prompt Guard — Simpan Pembelian

Untuk task yang menyentuh `src/pages/Transaksi/Purchases.jsx`:
- jangan mengembalikan flow lama yang membuat purchase terlebih dahulu lalu update stok/log/expense secara terpisah;
- jangan mengubah rumus Stok Masuk, Total Aktual, actualUnitCost, atau saving tanpa persetujuan business rule;
- jangan menyentuh Supplier catalog, Raw Material master UI, Sales, Returns, Production, Payroll, HPP, Dashboard, atau Reports jika task hanya hardening Purchases;
- setiap patch wajib menjaga expense idempotent dengan `sourceModule: purchases` dan `sourceId: purchaseId`;
- setiap blok yang menyentuh purchase, stok, log, atau expense wajib diberi comment `AKTIF` dan `GUARDED`.

## Prompt Guard — Stock Management & Adjustment

Untuk task yang menyentuh `src/pages/Inventory/StockManagement.jsx` atau `src/pages/Inventory/components/StockAdjustmentPanel.jsx`:
- jangan membuat mutasi stok saat halaman Stock Management dibuka;
- jangan menghitung ulang stok dari seluruh transaksi hanya untuk mengisi tabel;
- jangan menampilkan kolom `Stok` generik jika snapshot before/after belum reliable;
- jangan mengisi audit history dengan stok saat ini;
- pertahankan kolom Tanggal, Arah, Sumber, Item, Qty, Referensi Audit, dan Catatan;
- Catatan wajib ringkas di tabel, detail panjang boleh lewat tooltip;
- submit adjustment harus guarded terhadap double submit, stok negatif, item bervarian tanpa varian, dan partial write log;
- setiap blok penting wajib diberi comment `AKTIF`, `GUARDED`, `LEGACY`, dan `CLEANUP CANDIDATE` jika relevan;
- output patch tetap ZIP berisi file berubah saja.

## Prompt Guard - Login + Role + Manajemen User Internal

Status: **GUARDED**. Gunakan section ini untuk semua task yang menyentuh Auth, role, route guard, sidebar guard, User Management, Firestore Rules, atau Reset & Maintenance access.

### Aturan umum

- Jangan mengubah business rules stok, kas, Purchases, Returns, Sales, Stock Adjustment, Production, Payroll, HPP, Dashboard, atau Reports saat task hanya Login/Role.
- Jangan membuat Login page, AuthProvider, User Management, atau Firestore Rules final sebelum access matrix disetujui.
- Jangan memakai Google login untuk konsep akun internal IMS.
- Jangan memakai email asli sebagai identitas utama user.
- Jangan menyimpan password plaintext di Firestore.
- Jangan validasi password langsung di frontend untuk production.
- Jangan hanya menyembunyikan menu; route guard dan Firestore Rules tetap harus dirancang.
- Jangan mengaktifkan Firestore Rules terlalu ketat sebelum Auth/profile/seed `administrator` siap; `super_admin` lama hanya legacy compatibility.
- Jangan membiarkan Firestore Rules production terlalu terbuka tanpa warning.
- Jangan mengerjakan offline database bersamaan dengan Login/Role.

### Role guard wajib

- `administrator` adalah role aktif admin utama dan boleh akses semua menu admin, Reset & Maintenance, dan Manajemen User.
- `administrator` boleh membuat/mengelola role aktif `administrator` dan `user`, tetapi tidak boleh membuat role `super_admin` baru.
- `administrator` tidak boleh mengubah role/status dirinya sendiri.
- `user` tidak boleh akses Reset & Maintenance, Manajemen User, atau halaman admin via URL langsung.
- User `inactive` tidak boleh masuk aplikasi.

### Guard untuk functions

- `functions/index.js` saat ini harus dianggap `LEGACY/GUARDED` sebelum diaudit.
- Jangan langsung memakai/deploy functions lama untuk Auth karena file tersebut dapat berisi trigger stok legacy.
- Jika Auth butuh Cloud Functions/Admin SDK, buat fase khusus dan pastikan trigger stok lama tidak ikut aktif tanpa audit.

### Output patch wajib

- Untuk fase docs-only, ubah docs saja.
- Untuk fase coding, kirim hanya file yang berubah dalam ZIP.
- ZIP tidak boleh berisi `node_modules`, `dist`, `build`, `.git`, `.env`, secret, atau full project.
- Setiap file source yang nanti disentuh wajib diberi comment blok penting dengan status `AKTIF`, `GUARDED`, `LEGACY`, atau `CLEANUP CANDIDATE` jika relevan.


---

## Prompt Rules Auth Foundation Fase B — 2026-04-28

### Aturan wajib untuk patch setelah Fase B
- Jangan membuat User Management kecuali task eksplisit Fase E.
- Jangan mengubah Firestore Rules final kecuali task eksplisit Fase F.
- Jangan membuat role/menu guard detail kecuali task eksplisit Fase C/D.
- Jangan menyimpan password plaintext di Firestore.
- Jangan validasi password dengan membaca dokumen Firestore dari frontend.
- Jangan mengubah flow stok, kas, pembelian, retur, produksi, payroll, HPP, atau laporan untuk memperbaiki Auth.
- Jangan deploy atau memakai `functions/index.js` legacy untuk Auth tanpa audit khusus functions.

### Guard Auth yang harus dipertahankan
- User tanpa profile `system_users/{uid}` tidak boleh masuk app utama.
- User dengan `status` selain `active` tidak boleh masuk app utama.
- User tanpa role valid tidak boleh masuk app utama.
- Login UI tetap memakai konsep Username + Password internal, bukan Google login dan bukan email asli sebagai identitas user.
- AuthProvider harus punya loading state agar Dashboard tidak tampil sebelum session/profile selesai diverifikasi.

### File scope yang harus dijaga
- Auth foundation boleh menyentuh `firebase.js`, `AuthContext`, `useAuth`, `Login`, `App`, dan header logout.
- Role/menu guard detail nanti harus dipisah ke fase berikutnya.
- Business pages tidak boleh disentuh untuk perubahan Auth foundation.
---

## Prompt Rules Sidebar/Menu Guard Fase D — 2026-04-28

### Aturan wajib setelah Fase D
- Jangan menampilkan menu tanpa metadata `allowedRoles`.
- Jangan memakai `sidebarMenuItems` mentah untuk render menu tanpa filter role.
- Jangan hanya hide menu untuk security; route guard dan Firestore Rules tetap wajib.
- Jangan membuka Reset & Maintenance untuk `user`; Administrator adalah role admin utama.
- Jangan menambah menu User Management sebelum Fase E dibuat.
- Jangan mengubah business pages untuk memperbaiki menu guard.
- Jangan mengubah transaction logic Firestore/stok/kas/produksi/laporan untuk task sidebar/menu.
- Role tidak dikenal harus default deny.

### Guard route/menu yang harus dipertahankan
- `roleAccess.js` menjadi single source of truth awal untuk route/menu matrix.
- `ProtectedRoute` wajib tetap ada untuk mencegah akses langsung lewat URL.
- `Unauthorized` harus tampil saat role tidak berhak, bukan white screen.
- Parent menu tanpa child allowed harus disembunyikan.
- Reset & Maintenance harus Administrator-only di menu dan route; `super_admin` lama hanya ikut sebagai legacy compatibility.

### Batas fase berikutnya
- Firestore Rules final tetap Fase F.
- User Management tetap Fase E.
- Action-level permission create/edit/delete per modul harus dibuat sebagai task terpisah jika dibutuhkan.
- Offline database tidak boleh digabung dengan task auth/role/menu.

---

## Prompt Rules Final Auth/Role/User Management Fase E-H — 2026-04-28

### Aturan wajib setelah Fase E-H
- Jangan menyimpan password plaintext di Firestore.
- Jangan validasi password langsung dari Firestore/frontend.
- Jangan membuat Firebase Auth user dari frontend tanpa backend trusted/Admin SDK.
- Jangan memberi akses Manajemen User kepada role `user`.
- Jangan membuka Reset & Maintenance untuk `user`; Administrator adalah role admin utama.
- Jangan mengubah role/status user sendiri dari halaman Manajemen User.
- Jangan mengizinkan pembuatan role `super_admin` baru; role ini hanya legacy compatibility.
- Jangan menganggap UI role guard sebagai pengganti Firestore Rules.
- Jangan publish Firestore Rules sebelum `system_users/{uid}` Administrator pertama siap.
- Jangan deploy `functions/index.js` stok legacy untuk kebutuhan Auth tanpa audit khusus.
- Jangan mengubah flow stok/kas/transaksi/produksi/payroll/HPP/laporan saat task hanya Auth/Role.

### Scope yang boleh disentuh untuk patch lanjutan Auth/Role
- `src/pages/System/UserManagement.jsx`
- `src/services/System/userService.js`
- `src/utils/auth/roleAccess.js`
- route/menu/auth guard terkait
- `firestore.rules` atau Firebase Console Rules
- docs auth/role/checklist/map

### Scope yang tetap guarded
- Purchases, Returns, Sales, Stock Management, Stock Adjustment, Supplier business rule, Production, Payroll, HPP, Reports/export.
- `functions/index.js` stok lama tetap **LEGACY/GUARDED**.
- Offline database tetap roadmap terpisah.


---

## Prompt Rules Auth UID Otomatis via Cloud Functions - 2026-04-29

Status: **AKTIF + GUARDED**. Gunakan section ini untuk semua task lanjutan yang menyentuh create user, Cloud Functions Auth, role, atau `system_users`.

### Aturan wajib
- Jangan membuat Firebase Auth user langsung dari frontend biasa.
- Create user harus lewat backend trusted, saat ini HTTP Cloud Function `createSystemUser`.
- Jangan menyimpan password sementara, password plaintext, password hash frontend, token, atau credential Admin SDK di Firestore.
- Jangan menaruh Admin SDK atau service account di `src` frontend.
- Jangan mengubah domain internal login `ims-bunga-flanel.local` tanpa update AuthProvider, Cloud Function, docs, dan data Auth existing.
- Jangan mengizinkan pembuatan role `super_admin` baru; role aktif baru hanya `administrator` dan `user`.
- Jangan mengizinkan user mengubah role/status dirinya sendiri dari Manajemen User.
- Jangan menganggap UI guard sebagai pengganti backend guard dan Firestore Rules.
- Jangan deploy ulang `functions/index.js` legacy yang berisi trigger stok/transaksi tanpa audit khusus.
- Jangan mengubah stok, purchases, sales, returns, production, payroll, HPP, reports, dashboard, pricing rules, atau reset maintenance untuk task Auth create user.

### File yang boleh disentuh untuk task sejenis
- `src/pages/System/UserManagement.jsx`
- `src/services/System/userService.js`
- `src/firebase.js` jika butuh client Firebase Functions/region
- `functions/index.js` atau struktur functions khusus Auth
- `functions/package.json`
- docs Auth/Role/User Management/checklist/integration map

### File/area guarded
- `src/services/Inventory/**`
- `src/services/MasterData/**` kecuali ada task eksplisit non-Auth
- `src/services/Produksi/**`
- `src/pages/Transaksi/**`
- `src/pages/Laporan/**`
- dashboard dan pricing rules
- Firestore business collections selain `system_users`
- offline database implementation

### Definition of Done Auth create user
- Admin bisa tambah user tanpa input Auth UID manual.
- Firebase Authentication membuat UID otomatis.
- Cloud Function membuat `system_users/{uid}` dengan field profile yang disepakati.
- Password tidak tersimpan di Firestore.
- Role/status guard bekerja untuk administrator, user, super_admin legacy, inactive, dan missing profile.
- ZIP patch hanya berisi file berubah dan tidak membawa secret/node_modules/dist.
---

## Prompt Guard - Penyederhanaan Role Aktif Administrator/User

Status: **AKTIF + GUARDED**. Gunakan section ini untuk task yang menyentuh role, route guard, sidebar guard, User Management, atau Cloud Function create user setelah penyederhanaan role.

### Aturan wajib
- Role aktif baru hanya `administrator` dan `user`.
- Jangan menampilkan `Super Admin` sebagai pilihan role baru di UI Manajemen User.
- Jangan menerima payload role `super_admin` di Cloud Function `createSystemUser`.
- `administrator` adalah role admin utama dan harus mendapat akses penuh ke menu/route admin sesuai matrix.
- `user` tetap akses terbatas dan tidak boleh membuka Manajemen User atau Reset & Maintenance.
- `super_admin` hanya legacy compatibility agar data lama tidak langsung terkunci; tandai sebagai kandidat cleanup/migration ke `administrator`.
- Jangan mengubah stok, purchases, sales, production, payroll, HPP, reports, dashboard bisnis, pricing rules, atau offline database saat task hanya role/access.


## Prompt Rules Bug Fix createSystemUser HTTP CORS — 2026-04-29

Status: **AKTIF + GUARDED** untuk task lanjutan auth/user-management.

- Jika create user gagal dengan CORS, cek dulu apakah frontend memanggil endpoint HTTP `createSystemUser` dengan `fetch` dan Firebase ID token.
- Jangan mengembalikan flow create user ke frontend Firebase Auth langsung.
- Jangan menyimpan password sementara di Firestore.
- Jangan membuka role target selain `administrator` dan `user`.
- `super_admin` hanya legacy compatibility actor; jangan tampilkan sebagai pilihan user baru.
- Jangan menyentuh stok, purchases, sales, production, payroll, HPP, reports, dashboard, atau reset maintenance untuk bug create user.
- Jika production custom domain berubah, tambahkan origin HTTPS resmi ke allowlist CORS di `functions/index.js`.

## Prompt Rules Follow-up createSystemUser CORS Runtime Option - 2026-04-29

- Saat memperbaiki `createSystemUser`, cek dua lapis CORS: runtime option `cors` pada `onRequest` dan header manual `OPTIONS`.
- Jangan hanya menambah origin localhost; masukkan production origin yang benar, saat ini Firebase Hosting dan GitHub Pages `https://vyo15.github.io`.
- Jika browser masih menunjukkan `No Access-Control-Allow-Origin` setelah kode benar, prioritaskan cek deploy versi terbaru dan public invoker Cloud Run/Functions v2.
- Jangan membuka role target selain `administrator` dan `user`; `super_admin` tetap legacy compatibility actor saja.
