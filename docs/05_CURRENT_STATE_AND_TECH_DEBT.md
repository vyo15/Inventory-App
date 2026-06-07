# CURRENT STATE & TECH DEBT — IMS Bunga Flanel

## Status source aktual — 2026-06-07

Status: **AKTIF / SOURCE-VERIFIED / SQLITE-FIRST**.

Source aktual `Inventory-App-clean.zip` menunjukkan IMS berjalan dengan arsitektur:

- Frontend React/Vite.
- Backend Node.js Express sebagai satu-satunya akses database.
- Database SQLite lokal/LAN di sisi backend.
- Auth lokal SQLite melalui endpoint `/api/auth/**`.
- Semua flow guarded wajib lewat endpoint/service resmi backend.

Dokumen ini menggantikan catatan lama yang masih mengarah ke runtime lama. Jika ada arsip historis lain yang bertentangan dengan dokumen ini, gunakan source aktual dan dokumen ini sebagai acuan.

## Patch runtime status modul — digabung

Patch `ims-module-runtime-status.changed-files.zip` sudah digabung ke baseline docs cleanup ini. Scope patch tersebut:

- Backend menambah endpoint status modul melalui `/api/module-runtime-status` dan alias `/api/migration-status`.
- Backend maintenance status menampilkan jumlah row `module_migration_status`.
- UI Database Center menampilkan ringkasan status runtime modul.
- Checklist maintenance mengambil status dari backend, bukan dari asumsi docs lama.

Patch ini tidak mengubah schema guarded secara manual; tabel status modul sudah dikelola oleh migrasi SQLite yang ada di source patch.

## Modul runtime yang dianggap aktif SQLite

Berdasarkan `backend/src/db/migrate.js`, modul berikut berstatus `sqlite_active`:

- Auth & Role Guard.
- Customers.
- Categories.
- Suppliers.
- Pricing Rules.
- Products.
- Raw Materials.
- Semi Finished.
- Stock Engine.
- Purchases.
- Sales.
- Returns.
- Finance Ledger.
- Production.
- Payroll & HPP.
- Reports & Dashboard.

Konsekuensi:

- Patch baru tidak boleh mengarahkan modul di atas ke runtime lama.
- Frontend tidak boleh membaca file `.sqlite` langsung.
- Data transaction/stock/finance/production/payroll/HPP tidak boleh ditulis lewat helper generic yang melewati service resmi.
- Status modul di Database Center adalah indikator bantu; keputusan patch tetap harus validasi source aktual.

## Area yang sudah matang

- Struktur frontend/backend sudah terpisah.
- Runner root `npm run dev` menjalankan backend dan frontend.
- Backup SQLite resmi sudah tersedia dengan checksum, manifest, dan restore guarded.
- Auth lokal sudah aktif dengan user/role/status di SQLite.
- Module Runtime Status tersedia di backend dan UI maintenance.
- Repository mode frontend diarahkan ke SQLite sidecar.
- Sales cancel/delete tetap dilarang; return menjadi jalur resmi barang kembali.
- Stock mutation utama sudah diarahkan ke stock engine/backend commit.

## Tech debt aktif yang masih perlu dijaga

### 1. Nama compatibility lama di source

Masih ada kemungkinan nama variable/comment lama yang tersisa untuk compatibility, misalnya nama actor/session lama. Jangan menyimpulkan runtime lama aktif hanya dari nama variable. Audit import, package dependency, endpoint, dan service aktual terlebih dahulu.

### 2. Data lama dan referensi teknis

Data lama bisa masih membawa field/ID teknis. UI tetap wajib menampilkan referensi manusiawi:

1. Kode bisnis transaksi/master/produksi.
2. `sourceRef` / `referenceNumber` yang readable.
3. Fallback manusiawi seperti `-` atau `Referensi belum tersedia`.

Jangan menampilkan ID database teknis sebagai judul, subtitle, tooltip, drawer, report UI, export user-facing, atau audit reference utama.

### 3. Stock read model dan mutation

Read model stok boleh dipakai untuk tampilan/report. Mutation stok tetap wajib melalui endpoint/service resmi:

- Stock adjustment commit.
- Purchase stock-in.
- Sales stock-out.
- Return stock restore.
- Production material usage/output.

Jangan membuat perhitungan stok baru di UI.

### 4. Sales, purchases, dan returns

- Sales tidak boleh punya cancel/delete user-facing.
- Return adalah jalur resmi barang kembali.
- Purchase/Sales/Return wajib menjaga audit log dan finance side effect sesuai aturan backend.
- Jangan membuat direct write generic ke transaksi.

### 5. Finance ledger

- Income/expense/ledger tidak boleh dihitung ulang bebas di UI.
- Posting otomatis dari sales/purchase/payroll harus idempotent.
- Profit/Loss membaca sumber final yang sudah diposting, bukan draft/preview.

### 6. Production, payroll, dan HPP

- Work Log completed menjadi dasar material actual.
- Payroll final/paid menjadi dasar labor actual.
- HPP final tidak boleh mengambil payroll draft sebagai angka final.
- Production order/work log/payroll tidak boleh diproses dua kali.

### 7. Backup, restore, dan reset

- Backup resmi memakai format SQLite backup resmi dari backend.
- Restore wajib preview, validasi, pre-restore backup, dan keyword confirm.
- Reset testing lama tetap nonaktif/redirect lama.
- Destructive action wajib punya scope jelas, confirm guard, dan audit log.

### 8. UI/UX

- UI harus clean, compact, profesional, dan aman untuk data banyak.
- Mobile tidak boleh memaksa tabel desktop penuh bila data utama panjang.
- Empty/loading/error state wajib jelas.
- Dark mode dan light mode harus tetap terbaca.

## Jangan dilakukan tanpa approval eksplisit

- Mengubah schema SQLite.
- Mengubah route/menu/role guard.
- Mengubah status flow sales/purchase/return/production/payroll.
- Mengubah stock mutation, finance ledger, HPP final, atau payroll paid flow.
- Menghidupkan runtime lama.
- Membuat direct database access dari frontend.
- Menghapus compatibility helper sebelum audit usage.
- Membuat service/helper baru jika helper existing sudah tersedia.
- Melakukan formatting massal file tidak terkait.

## Checklist audit sebelum patch berikutnya

- [ ] Validasi ZIP/source terbaru.
- [ ] Cek file aktual yang menangani fitur.
- [ ] Cek import dan usage.
- [ ] Cek route/menu/role guard jika fitur user-facing.
- [ ] Cek service/helper existing sebelum membuat logic baru.
- [ ] Cek audit log dan histori transaksi untuk area guarded.
- [ ] Cek backup/restore/reset guard jika menyentuh maintenance.
- [ ] Cek docs terkait dan update bila source berubah.
- [ ] Pastikan docs tidak mengarahkan kembali ke runtime lama.
