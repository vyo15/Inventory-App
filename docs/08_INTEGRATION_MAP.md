# 08 Integration Map IMS Bunga Flanel

Status: **AKTIF / SQLITE-FIRST / SOURCE-VERIFIED**.

Dokumen ini mengunci alur integrasi IMS agar modul tidak berjalan sendiri-sendiri. Runtime utama source aktual adalah frontend React/Vite + backend Node.js Express + SQLite lokal/LAN.

## Prinsip integrasi utama

```text
Frontend React/Vite
→ service/adapter frontend
→ endpoint backend resmi
→ transaksi SQLite/backend service
→ audit log
→ read model/report/dashboard
```

Frontend tidak boleh direct access file SQLite dan tidak boleh melakukan mutation guarded tanpa endpoint backend resmi.

## Backend endpoint map aktif

Endpoint utama yang terlihat di `backend/src/server.js`:

- `/api/auth/**`
- `/api/customers/**`
- `/api/categories/**`
- `/api/suppliers/**`
- `/api/pricing-rules/**`
- `/api/products/**`
- `/api/raw-materials/**`
- `/api/semi-finished-materials/**`
- `/api/stock-read-models/**`
- `/api/stock/adjustments/commit`
- `/api/stock-adjustments/**`
- `/api/transactions/purchases/**`
- `/api/transactions/sales/**`
- `/api/transactions/returns/**`
- `/api/finance/**`
- `/api/production/**`
- `/api/reports/**`
- `/api/maintenance/**`
- `/api/module-runtime-status`
- `/api/migration-status`
- `/api/audit-logs/**`

## Auth dan role guard

```text
Login UI
→ localAuthService
→ POST /api/auth/login
→ backend validasi username/password lokal
→ token/session lokal
→ ProtectedRoute + role guard frontend
→ backend endpoint guard untuk action sensitif
```

Guard aktif berada di backend SQLite route/service dan protected UI route. Jangan membuat flow auth baru tanpa audit source.

Alignment source aktual:

- `roleAccess.js` menjadi matrix route/menu/Dashboard frontend.
- Generic JSON router menerima `readGuard`; default tetap authenticated read untuk data referensi yang memang dibutuhkan operasi.
- Finance (`incomes`, `expenses`, `ledger`), report snapshots, dan production payroll memakai administrator read guard.
- Planning, Production Orders, dan Work Logs tetap menerima role `administrator + user` untuk flow operasional harian.
- Hidden menu bukan security control; request backend tetap harus lolos guard endpoint.

## Master data

```text
Master page
→ service frontend
→ endpoint backend master data
→ table SQLite terkait
→ audit log bila action mutation
→ UI refresh/read model
```

Master data boleh CRUD sesuai role, tetapi tidak boleh langsung mengubah stock/finance/production side effect kecuali lewat endpoint resmi yang memang dirancang untuk itu.

## Stock engine

```text
Stock adjustment / transaction / production
→ endpoint commit resmi
→ validasi item + varian + available stock
→ atomic commit SQLite
→ stock row update
→ inventory log
→ read model/report update
```

Aturan:

- Stock mutation tidak boleh dibuat di UI.
- Item bervarian wajib membawa `variantKey`.
- Adjustment keluar wajib validasi available stock.
- Deteksi mode varian tidak boleh memakai keberadaan array kosong; resolver memilih `variants` non-empty lalu `variantOptions` non-empty.
- Master/varian nonaktif ditolak untuk mutation normal. Return historis memakai override internal ter-audit, bukan flag dari request client.
- Inventory log wajib memakai referensi bisnis manusiawi.
- Technical database ID tidak boleh menjadi display audit utama.

## Supplier, katalog toko, dan histori per toko

```text
Daftar Supplier
→ GET /api/suppliers
→ pilih satu toko
→ reusable Supplier Detail Drawer
   ├─ Ringkasan
   ├─ Katalog barang/link aktif
   └─ GET /api/suppliers/:id/history
```

- Katalog terstruktur disimpan di `supplier_catalog_offers` dan dapat menghubungkan satu supplier ke banyak Produk/Bahan Baku serta banyak link/paket untuk item yang sama.
- Histori disimpan di `supplier_catalog_history` dan selalu difilter memakai `supplier_id`; drawer Toko A tidak boleh memuat histori toko lain.
- Pengecekan manual memakai `POST /api/suppliers/:id/catalog/:offerId/verify` dan hanya tersedia untuk administrator.
- Harga lama, waktu pengecekan, waktu perubahan, dan pelaku perubahan hanya ditampilkan pada tab Histori Toko. Tabel katalog utama hanya menampilkan kondisi terbaru.
- Kode supplier, ID supplier, ID item, dan ID penawaran tetap backend-only; UI menggunakan nama toko, nama barang, listing, channel, dan status operasional.

## Raw Material master dan sumber restock

```text
Raw Materials
→ create/edit metadata dan struktur stok
→ backend validasi kategori, unit, nama unik, stok/modal awal, dan guard nonaktif
→ source restock dibaca dari supplier_catalog_offers
→ detail bahan menampilkan ringkasan jumlah toko/link
→ buka Supplier dengan filter item untuk mengelola atau membandingkan sumber restock
```

- Master Raw Material tidak menyimpan satu Supplier sebagai source utama. Field supplier snapshot lama hanya compatibility data dan tidak ditampilkan pada UI utama.
- Bahan tanpa varian memakai minimum stok master. Bahan bervarian memakai `variants[].minStockAlert`; read model aggregate menyimpan total minimum varian aktif untuk ringkasan.
- `averageActualUnitCost` bersifat transaction-derived dan read-only pada master. Pembelian menghitung weighted average di backend dalam transaction yang sama dengan stock-in dan finance.
- Penonaktifan ditolak jika masih ada current/reserved stock, BOM aktif, atau proses produksi aktif yang bergantung pada bahan tersebut.

## Purchases

```text
Purchase form
→ pilih item + supplier + satu penawaran katalog
→ buka link dan verifikasi harga aktual
→ POST /api/transactions/purchases/commit
→ backend cocokkan supplier/item/varian/penawaran
→ update harga katalog + histori toko bila berubah
→ stock-in Product/Raw Material
→ expense/finance side effect
→ purchase + inventory log + audit
```

- Supplier, penawaran katalog, dan verifikasi harga wajib untuk setiap Pembelian baru.
- Jika qty, subtotal, supplier, atau penawaran berubah setelah verifikasi, verifikasi dianggap stale dan harus diulang.
- Update harga katalog, histori toko, purchase, stock-in, inventory log, dan finance berada dalam transaction SQLite yang sama agar tidak terjadi partial write.
- Harga aktual tetap disimpan sebagai snapshot Pembelian; edit katalog berikutnya tidak mengubah histori transaksi lama.
- Purchase tidak boleh menulis stok atau finance lewat helper terpisah yang tidak idempotent.

## Sales

```text
Sales form
→ POST /api/transactions/sales/commit
→ gabungkan kebutuhan item yang sama
→ validasi available stock
→ stock-out
→ simpan sales
→ posting income bila status final sesuai rule
→ audit log
→ sales report
```

Aturan terkunci:

- Sales cancel/delete user-facing dilarang.
- Status aktif hanya `Diproses`, `Dikirim`, dan `Selesai`.
- Barang kembali harus lewat Return.

## Returns

```text
Return form
→ pilih Sales
→ item Return hanya dari item Sales tersebut
→ POST /api/transactions/returns/commit
→ backend validasi relatedSaleId
→ backend validasi item ada pada Sales
→ backend validasi qty <= qty terjual - qty sudah diretur
→ stock restore
→ refund/finance guard sesuai backend
→ audit log
→ return/report update
```

Return bukan sales cancel tersembunyi. Return adalah jalur resmi barang kembali dan wajib memiliki relasi Sales.

## Pricing Rule batch

```text
Pricing Rules preview
→ POST /api/pricing-rules/:id/apply
→ validasi rule + target + expectedVersion seluruh item
→ BEGIN IMMEDIATE TRANSACTION
→ update harga minimal Product/Raw Material
→ preserve stok/HPP + sync stock read model
→ audit item + audit batch
→ COMMIT seluruh batch atau ROLLBACK seluruhnya
```

Frontend tidak boleh menerapkan Pricing Rule massal melalui loop direct update master. Satu item stale/gagal harus membatalkan seluruh batch agar harga tidak berubah sebagian.

## Finance

```text
Cash In/Cash Out manual atau side effect transaksi
→ endpoint finance/backend service
→ ledger SQLite
→ audit log
→ Profit/Loss report
```

Aturan:

- Posting otomatis harus idempotent.
- Profit/Loss membaca data final.
- Draft/preview tidak boleh dihitung sebagai final.
- Read `/api/finance/incomes`, `/api/finance/expenses`, dan `/api/finance/ledger` hanya untuk Administrator; role `user` tidak boleh mendapat ringkasan finance dari Dashboard.

## Production, payroll, dan HPP

```text
Production Planning
→ Production Order
→ Work Log completed
→ material actual
→ Payroll final/paid
→ labor actual
→ HPP final
→ finance expense payroll bila paid
→ reports/dashboard
```

Aturan:

- Planning tidak mengubah stok/payroll/HPP langsung.
- Work Log completed harus menjaga material actual.
- Payroll paid harus idempotent saat posting expense.
- HPP final tidak boleh memakai payroll draft.
- `/api/production/payrolls` hanya boleh dibaca Administrator.
- HPP Analysis adalah halaman derived, bukan endpoint HPP terpisah. Route HPP Analysis tetap Administrator-only; Planning/Orders/Work Logs tetap operasional.

## Reports dan dashboard

```text
Backend report service
→ data SQLite/read model
→ response aman dengan fallback section
→ UI report/dashboard
```

Dashboard/report harus read-only. Jika satu section gagal, tampilkan partial warning/empty state, bukan white screen total.

Dashboard juga harus role-aware: loader hanya memanggil dataset yang diizinkan, kartu/aksi menggunakan route key yang sama dengan ProtectedRoute, dan role `user` tidak boleh diarahkan ke halaman Administrator-only.

## Maintenance, backup, restore

```text
Database Center UI
→ login administrator
→ /api/maintenance/status
→ /api/module-runtime-status
→ backup/restore endpoint guarded
→ audit log maintenance
```

Backup lifecycle:

```text
backend start / hourly lifecycle check
→ ensure daily verified maksimal satu per hari
→ promote daily terakhir bulan sebelumnya menjadi monthly
→ verify package/checksum/integrity
→ cleanup daily > 60 hari jika monthly bulan terkait tersedia
→ simpan maksimal 12 monthly
→ audit log setiap promosi/cleanup
```

Folder aktif hanya `daily`, `monthly`, dan `manual`. Backup manual, import, pre-repair, serta pre-restore masuk storage class `manual`; jenis aslinya tetap dicatat di manifest.

Restore wajib:

- pilih backup eksplisit,
- preview,
- validasi checksum/integrity,
- pre-restore backup yang disimpan di folder manual,
- keyword confirm,
- audit log.

## Module Runtime Status

```text
module_migration_status
→ GET /api/module-runtime-status dengan token administrator
→ Database Center / Maintenance Checklist
→ summary modul aktif/guarded/data historis/unknown
```

Status modul adalah alat bantu audit administrator. Patch fitur tetap wajib membaca file source aktual yang menangani modul tersebut.

## Anti-regression

Dilarang:

- Menghidupkan runtime arsip.
- Direct database access dari frontend.
- Direct write generic ke tabel guarded.
- Menampilkan technical database ID sebagai referensi audit UI.
- Mengubah route/menu/role guard tanpa approval.
- Mengubah stock, sales, purchase, return, finance, production, payroll, HPP, backup/restore, reset, atau audit flow tanpa audit dan approval eksplisit.
