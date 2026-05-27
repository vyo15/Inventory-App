# 08 Integration Map IMS Bunga Flanel

Dokumen ini mengunci alur integrasi IMS final agar modul tidak berjalan sendiri-sendiri.

## Alur utama

```text
Master Data
→ Transaksi
→ Stok
→ Produksi
→ Payroll
→ Kas & Biaya
→ HPP
→ Laporan
```

## Flow aktif per modul

| Flow | Source aktif | Output otomatis | Guard anti-double |
|---|---|---|---|
| Pembelian selesai | purchases | stock masuk + expenses | purchase id + metadata source expense |
| Penjualan dibuat / selesai | sales | stock keluar saat create + income saat selesai | Firestore transaction + sale id + status transition |
| Stock Adjustment | stock_adjustments | inventory_logs | adjustment id/reference |
| Work Log dari PO | production_orders + production_work_logs | Work Log in_progress + konsumsi bahan | 1 PO = 1 Work Log |
| Work Log completed | production_work_logs | output stock + payroll line | Work Log completed guard |
| Payroll dari Work Log | production_payrolls | labor cost ke Work Log | Work Log + Step + Operator |
| Payroll paid | production_payrolls | expenses / Cash Out | sourceModule + sourceId |
| Profit Loss | revenues + incomes + expenses | laporan laba rugi | jangan baca payroll langsung jika sudah jadi expense |
| HPP Analysis | completed Work Logs + payrolls + steps | HPP Final + HPP Preview + validasi cost | final dari payroll confirmed/paid atau step non-HPP; draft/estimasi step hanya preview read-only |

## Source reference wajib

Semua data otomatis harus menyimpan referensi:

- `sourceModule`
- `sourceId`
- `sourceRef`
- `sourceType` jika perlu
- `createdByAutomation` jika dibuat sistem

## Guard penting

1. Work Log baru harus dimulai dari Production Order; halaman Work Log tidak boleh membuat input manual aktif.
2. Work Log completed tidak boleh diproses dua kali.
3. Payroll line tidak boleh dobel untuk Work Log + Step + Operator yang sama.
4. Payroll paid tidak boleh membuat expense dobel.
5. Profit Loss tidak boleh menghitung payroll dari dua sumber sekaligus.
6. Backfill data lama tidak boleh otomatis tanpa preview.

## Catatan legacy

- Data lama yang belum punya `sourceModule/sourceId` tetap dibaca sebagai fallback.
- Work Log lama yang cost/payroll-nya masih kosong perlu task backfill terpisah.
- Expense payroll yang dibuat otomatis tidak boleh dihapus otomatis saat payroll dibatalkan sampai rule rollback disepakati.

## Flow Production Planning

```text
Production Planning
→ user action: Buat PO
→ Production Order berbasis BOM
→ user action: Mulai Produksi
→ Work Log in_progress dari PO, bukan input manual
→ user action: Complete Work Log
→ output stock + payroll/HPP existing
→ Dashboard membaca progress planning
```

| Flow | Source aktif | Output otomatis | Guard anti-double |
|---|---|---|---|
| Planning dibuat | production_plans | target monitoring | tidak ada mutasi stok |
| PO dari Planning | production_plans + production_boms | production_orders dengan planning reference | user action wajib, tetap lewat BOM |
| Cancel Planning tanpa PO | production_plans | status Planning menjadi `cancelled` | hanya sebelum ada linked PO, bukan hard delete |
| Progress Planning | production_orders scoped + completed production_work_logs scoped | actual/remaining/progress read model realtime | hitung Work Log completed sekali per id dan fallback jika index belum siap |
| Dashboard Planning | production_plans + PO + Work Log completed | summary target minggu/bulan | read-only, tidak update data |

## Source reference Planning ke PO
PO yang dibuat dari planning wajib menyimpan:
- `planningId`
- `planningCode`
- `planningTitle`

## Read Path Planning Progress

```text
production_plans visible
-> production_orders where planningId in planIds
-> production_orders where documentId in linkedProductionOrderIds
-> production_work_logs where productionOrderId in relatedOrderIds and status == completed
-> fallback: query status == completed
-> fallback terakhir: full scan + filter completed + filter productionOrderId terkait
```

Guard:
- query progress Planning tidak boleh memakai `limit` karena actual/remaining/progress bisa salah jika histori Work Log terkait terpotong;
- fallback hanya untuk menjaga compatibility/index/rules issue, bukan alasan untuk membiarkan full scan sebagai desain final;
- Work Log yang dihitung tetap hanya `completed` dan terkait Production Order Planning.

Planning dapat menyimpan:
- `linkedProductionOrderIds`
- `linkedProductionOrderCodes`

Jika array link planning belum lengkap, service tetap bisa membaca PO berdasarkan `planningId`.

## Guard Cancel Planning
- Planning tanpa PO boleh dicancel jika status belum final.
- Planning yang sudah punya PO / linked Production Order tidak boleh dicancel langsung; user harus mengelola PO terkait terlebih dahulu.
- Cancel Planning hanya mengubah status Planning menjadi `cancelled`; bukan hard delete.
- Cancel Planning tidak menghapus/mengubah PO, Work Log, inventory/stok, Payroll, HPP, report, sales, purchases, returns, atau cash in/out.
- Planning `cancelled` dan `completed` tidak boleh dibuatkan PO.
- Planning `overdue` tanpa PO masih boleh dibuatkan PO atau dicancel.
- Dashboard dan filter Planning wajib membaca status canonical `cancelled`.

## Guard Tambahan
1. Planning tidak mengubah stok.
2. Planning tidak menggantikan BOM.
3. PO dari planning tetap harus memakai requirement helper existing.
4. Progress tidak boleh dihitung dari PO created saja.
5. Work Log selain `completed` tidak dihitung.
6. Dashboard planning tidak boleh menjadi tempat edit/update data.


## Final Integration Lock Fase A-G - 2026-04-26

### Sales Stock Safety
```text
Sales Form
-> validasi line item
-> agregasi kebutuhan item/varian
-> validasi final availableStock dari Firestore
-> create sale
-> mutasi stok keluar
-> inventory log sale
-> income hanya jika status Selesai
```

Guard:
- sale tidak boleh tersimpan jika stok tersedia tidak cukup;
- item bervarian wajib validasi varian yang benar;
- create sale, mutasi stok keluar, inventory log, dan income awal `Selesai` harus berada dalam transaction;
- Sales tidak menyediakan cancel user-facing; barang kembali wajib lewat Return agar stok masuk dan audit tercatat terpisah.
- Sales `Selesai` tidak boleh diubah balik dari tabel Sales; koreksi barang/retur ditangani oleh Return.

### Purchase Expense Metadata
```text
Purchase saved
-> stock masuk
-> inventory_logs purchase_in
-> expenses auto-generated
-> Cash Out / Profit Loss membaca expenses
```

Expense pembelian wajib membawa:
- `sourceModule: purchases` mengikuti schema aktif project;
- `sourceId: purchaseId`;
- `sourceRef` reference pembelian;
- `sourceType: auto_generated`;
- `createdByAutomation: true`.

### HPP / Work Log Cost Visibility
```text
Completed Work Log
-> materialCostActual / laborCostActual / totalCostActual / costPerGoodUnit
-> HPP Analysis
-> HPP Final jika payroll final siap
-> HPP Preview jika masih draft/estimasi
-> warning jika cost belum valid
-> Export HPP XLSX membawa kolom Final, Preview, dan Validasi Cost
```

Guard:
- jangan isi cost asal;
- draft payroll tidak dihitung sebagai final; jika draft payroll 0, tampilan boleh fallback ke estimasi step read-only;
- Work Log completed tidak diproses ulang hanya untuk display warning;
- Data Quality Audit produksi read-only mendeteksi payroll pending/mismatch, output HPP yang butuh reconcile, dan Semi Finished tanpa `flowerGroup`; audit hasil selain Good Qty tidak diaktifkan.


### Guarded Reconcile HPP Output Lama — 2026-05-17

```text
Payroll final muncul setelah Work Log/output stok sudah ter-posting
-> Data Quality Audit read-only menandai Output HPP perlu reconcile
-> task guarded terpisah wajib preview diff Work Log vs master/output
-> baru boleh update master HPP/average cost bila owner approve
```

Guard:
- jangan backfill otomatis dari drawer/detail/HPP Analysis;
- jangan menyentuh inventory history/master cost tanpa preview dan approval;
- jangan gabungkan reconcile HPP output dengan cleanup UI/docs;
- audit hasil selain Good Qty tetap tidak diaktifkan sampai ada konsep produksi yang disetujui.

### Dashboard Read-only Map
```text
Dashboard
-> reads only: sales, stock, planning, PO, work log, payroll, expenses/incomes/revenues, inventory logs
-> compact control center: KPI, quick actions, data alerts, priorities, production focus, stock, finance, activity
-> no write
-> last updated + muat ulang summary only
-> quick actions are Link/navigation only
```

Dashboard tidak boleh menjadi sumber transaksi. Semua action Dashboard hanya navigasi ke modul terkait. KPI Sales adalah monitoring omzet dari `sales`, sedangkan cash resmi tetap dari `revenues`/`incomes` dan `expenses`; jangan double count ke Profit Loss.


### Dashboard Business Control Center Map — 2026-05
```text
Dashboard Ringkasan Hari Ini
-> sales: KPI omzet monitoring
-> revenues + incomes: kas masuk resmi
-> expenses: kas keluar/pengeluaran resmi
-> products + raw_materials + semi_finished_materials: stok kritis dan alert stok
-> production_plans summary service: planning risk
-> production_orders: shortage/ready
-> production_work_logs: running/completed/cost issue
-> production_payrolls: payroll pending/paid
-> inventory_logs: aktivitas terbaru
```

Guard:
- Dashboard tidak menulis Firestore.
- Quick actions hanya Link ke route existing.
- Data Perlu Dicek hanya alert audit, bukan auto repair.
- Jika collection gagal dibaca, fallback aman harus tetap menampilkan Dashboard partial.

### Report / Export Map
```text
Stock Report
-> raw_materials + semi_finished_materials + products
-> XLSX siap baca

HPP Analysis
-> completed Work Logs + payroll final/draft + step estimate
-> Final/Preview HPP + XLSX HPP + Validasi Cost

Payroll Report
-> production_payrolls
-> XLSX utama, CSV legacy compatibility
```

### Legacy Duplicate Cleanup Map
- Folder `src/src/**` tidak boleh menjadi target patch aktif.
- Jika muncul lagi, lakukan grep/import/route check sebelum hapus.
- Route aktif Dashboard tetap `src/pages/Dashboard/Dashboard.jsx`.
- Service aktif Planning tetap `src/services/Produksi/productionPlanningService.js`.

### Profit Loss dan Payroll Anti Double Count
```text
Payroll paid
-> expense otomatis sourceModule=production_payroll sourceId=payrollId
-> Profit Loss membaca expenses
```

Profit Loss tidak boleh membaca payroll langsung dari `production_payrolls` jika payroll paid sudah menjadi expense, karena akan double counting.

## Flow Supplier Restock Catalog Manual

```text
Supplier
-> menyimpan master vendor
-> menyimpan katalog material yang dijual (`materialDetails`)
-> productLink/referencePrice/note hanya referensi restock
-> tidak memasang supplier otomatis ke raw_materials berdasarkan materialDetails
-> edit/hapus supplier boleh cascade snapshot hanya ke raw material yang supplierId-nya sama
```

```text
Raw Material
-> user memilih supplier manual di form Raw Material
-> raw material menyimpan snapshot supplierId/supplierName/supplierLink
-> snapshot nama/link bisa ikut update/clear saat master supplier yang sama diedit/dihapus
-> raw material tetap source utama stok bahan
```

```text
Purchases
-> memakai supplier sebagai referensi vendor
-> harga aktual pembelian berasal dari transaksi
-> stock masuk dan expense tetap dari flow Purchases
-> tidak ada purchase otomatis dari supplier link
```

Guard:
- tidak ada tombol/logic “Sinkronkan Bahan” dari Supplier ke Raw Material;
- Supplier edit/delete hanya boleh mengubah snapshot raw material yang sudah menunjuk `supplierId` supplier tersebut;
- filter supplier berdasarkan material boleh memakai katalog `materialDetails/supportedMaterialIds` sebagai read-only reference;
- data snapshot supplier lama di raw material tetap dibaca sebagai kompatibilitas.

## Flow Restock Assistant

```text
Dashboard Stok Kritis
-> baca raw_materials + purchases terakhir
-> action: Buka Link Produk / Buat Pembelian / Bandingkan Supplier
-> tidak ada write data dari Dashboard
```

```text
Buat Pembelian dari Restock Assistant
-> route /purchases?source=dashboard-restock&materialId=...
-> form Purchases prefill material/supplier/link produk jika tersedia
-> user tetap input qty/harga aktual
-> user klik Simpan
-> flow Purchases existing membuat stock masuk + expense
```

```text
Bandingkan Supplier
-> route /suppliers?materialId=...
-> Supplier menampilkan katalog vendor yang menyediakan bahan tersebut
-> tidak menulis otomatis ke Raw Material
```

Guard:
- Restock Assistant tidak membuat purchase otomatis;
- Dashboard tidak mengubah stok/kas/expense;
- link produk terakhir berasal dari Purchases;
- Supplier tetap katalog vendor/restock dan tidak memasang supplier otomatis ke Raw Material.

## Flow Helper Pusat Stok Varian

```text
Form/Edit Master + Transaksi + Produksi
-> helper lama sesuai modul
-> variantStockNormalizer
-> output variant final: currentStock + stock + reservedStock + availableStock + variantKey
-> output master final: currentStock + stock + reservedStock + availableStock
-> audit Reset/Maintenance hanya mengecek/repair data lama, bukan flow harian
```

Guard:
- Raw Material, Product, Semi Finished, Stock Adjustment, Sales, Returns, Purchases, dan Production tidak boleh punya rumus stok varian sendiri-sendiri.
- Helper lama boleh tetap ada untuk import lama, tetapi harus delegasi ke helper pusat.
- `stock` dipertahankan sebagai alias kompatibilitas; `currentStock` tetap stok utama.
- Product/Semi Finished bervarian: helper/service tetap menghitung `currentStock`, `stock`, `reservedStock`, dan `availableStock` dari varian, tetapi `minStockAlert` final berasal dari field master item.
- `variants[].minStockAlert` Product/Semi Finished adalah legacy/compat field dan bukan integration contract untuk low-stock summary.

## Flow Reset & Maintenance Aman

```text
Reset & Maintenance
-> preview target reset
-> tampilkan collection yang akan dihapus
-> tampilkan protected master data termasuk supplierPurchases
-> preflight resetMode + modules + allowlist rules + protected target
-> jika mode baseline: validasi baseline dan keberadaan item baseline sebelum delete
-> blokir dari client jika estimasi operasi melebihi batas single-batch aman
-> user wajib konfirmasi RESET
-> create maintenance_logs status started sebelum delete
-> commit delete transaksi + update stok dalam satu batch aman
-> update maintenance_logs menjadi success / failed
```

```text
Hapus Data Test Saja
-> scan collection transaksi/testing
-> filter marker isTestData=true + sourceModule=dev_test_seed + createdBy=dev_seed
-> hapus hanya dokumen bermarker
-> protected master data tidak ikut target default
```

Guard:
- Supplier/vendor restock (`supplierPurchases`) tidak boleh dihapus reset default;
- reset transaksi tidak boleh menghapus master Supplier;
- test cleanup tidak boleh menghapus data normal tanpa marker;
- reset Supplier hanya boleh dibuat sebagai flow destructive khusus developer.
- `maintenance_logs` dan `testing_baselines` tetap admin-only; user biasa tidak boleh membaca/menulis log/baseline reset.
- Collection target reset harus masuk allowlist rules bisnis/admin-delete; fallback deny tidak boleh dibuka menjadi allow-all.
- Error audit log akhir tidak boleh membuat UI mengklaim reset gagal jika batch reset sudah berhasil.

## Purchases Supplier Restock Prefill

```text
Supplier materialDetails
  -> Purchases supplier dropdown filtered by materialId
  -> Link Produk Restock prefill from materialDetails.productLink
  -> Harga Supplier Tercatat prefill from materialDetails.referencePrice / estimatedUnitPrice
  -> Total Pembanding Supplier dihitung dari komponen supplier catalog
  -> Selisih Hemat display
  -> User manually saves Purchase
  -> Stock, expense, and inventory log follow existing Purchases flow
```

Notes:
- Flow ini read-only terhadap Supplier dan Raw Material.
- Supplier tetap katalog vendor/restock.
- Purchases tetap satu-satunya tempat transaksi pembelian aktual.

## Supplier Katalog Restock -> Purchases Prefill

```text
Supplier materialDetails
  -> link produk + tipe pembelian + satuan beli + konversi + estimasi biaya
  -> hitung Harga Estimasi Supplier / Satuan Stok
  -> Purchases membaca read-only untuk prefill Link Produk, Satuan Beli, Konversi, dan Harga Supplier Tercatat
  -> User mengisi harga aktual dan menyimpan purchase
  -> stok/kas/expense berubah hanya lewat flow Purchases existing
```

Guard:
- Supplier tidak membuat purchase otomatis;
- Supplier tidak menulis Raw Material otomatis berdasarkan katalog material;
- harga supplier adalah pembanding, bukan harga aktual.

## Purchases Stok Masuk Total

```text
Supplier materialDetails.conversionValue
  -> Purchases read-only conversion source
  -> Qty Beli x Konversi Supplier
  -> Stok Masuk total ditampilkan sebagai field utama
  -> user klik Simpan Purchase
  -> stok/inventory log/expense mengikuti flow Purchases existing
```

Guard:
- Qty Beli hanya menghitung Stok Masuk, ringkasan, Total Pembanding Supplier berbasis komponen katalog, dan subtotal default jika belum manual;
- Qty Beli tidak boleh mereset Supplier, Link Produk, purchaseType, atau Harga Supplier Tercatat;
- Total Pembanding Supplier tidak boleh menggandakan ongkir/admin default sebagai biaya per satuan stok;
- koreksi reject/selisih dilakukan lewat Penyesuaian Stok.

## Purchases Preview Stok Aktual dan Breakdown Ringkasan

```text
User memilih item di modal Purchases
  -> jika item non-varian, preview membaca stok master
  -> jika item bervarian dan varian belum dipilih, UI meminta pilih varian
  -> jika item bervarian dan varian dipilih, preview membaca stok varian terpilih
  -> preview menampilkan Current Stock, Reserved Stock, dan Available Stock secara read-only
  -> alert global varian kosong tidak ditampilkan karena visual noise dalam flow restock
  -> user mengisi supplier, Qty Beli, subtotal, ongkir, admin, potongan, dan voucher/koin
  -> Ringkasan Perbandingan Supplier menampilkan breakdown biaya aktual + pembanding supplier
  -> user klik Simpan Purchase
  -> stok/inventory log/expense tetap mengikuti flow Purchases existing
```

Guard:
- preview stok aktual hanya display read-only sebelum restock dan tidak boleh menjadi sumber mutasi stok;
- item bervarian tidak boleh menampilkan total master sebagai stok utama;
- alert global varian kosong di Purchases tidak lagi ditampilkan jika preview stok aktual sudah memberi konteks item/varian terpilih;
- breakdown ringkasan memakai field existing dan tidak mengubah formula submit;
- Total Aktual tetap dasar expense/cash-out dan Selisih Hemat tetap informasi efisiensi.


### Supplier Table dan Inventory Log Performance Map
```text
Supplier table
-> reads supplierPurchases + raw_materials + purchase history read-only
-> shows compact restock catalog summary
-> actions are non-fixed UI buttons
-> no stock/cash/purchase mutation
```

```text
Stock Management
-> reads latest inventory_logs with a UI/service limit
-> displays audit history read-only
-> hides generic Stok column while snapshot before/after is not reliable for all logs
-> Stock Adjustment panel remains the only manual adjustment submit flow
-> Stock Adjustment transaction commits stock_adjustments + stock mutation + inventory_logs together
-> no stock mutation when page opens
```

Catatan guard:
- Jangan isi riwayat stok dengan stok saat ini jika maksudnya snapshot historis.
- Jika butuh full history, gunakan pagination/query lanjutan; jangan kembalikan full collection read tanpa batas.
- Latest purchase lookup untuk restock masih kandidat optimasi terpisah bila index/read model sudah diputuskan.

## Integrasi Guarded — Simpan Pembelian

Flow aktif saat user klik **Simpan Pembelian**:

1. Validasi form Purchases.
2. Buat reference `purchaseId`.
3. Jalankan Firestore transaction.
4. Baca item stok terbaru dari Firestore.
5. Validasi ulang varian jika item bervarian.
6. Commit bersama:
   - `purchases/{purchaseId}`;
   - update stok `raw_materials` atau `products`;
   - `inventory_logs/{logId}` dengan reference purchase;
   - `expenses/{purchases__purchaseId}` sebagai Cash Out otomatis.

Batas integrasi:
- Supplier hanya menjadi sumber prefill dan metadata vendor.
- Raw Material berubah karena transaksi stok/cost, bukan karena sync otomatis dari Supplier.
- Cash Out mengikuti Total Aktual Pembelian, bukan Selisih Hemat.
- Reports tetap membaca expense/cash flow sesuai source final.

## Integrasi Guarded — Stock Management & Adjustment

Flow aktif Stock Management:

1. Page membaca `inventory_logs` terbaru dengan limit.
2. UI menampilkan audit read-only: Tanggal, Arah, Sumber, Item, Qty bersatuan jika `stockUnit`/`unit` tersedia, Referensi Audit, dan Catatan.
3. Kolom `Stok` generic tidak ditampilkan selama snapshot belum reliable.
4. Panel Penyesuaian Stok menjadi entry point adjustment manual resmi.
5. Saat adjustment disimpan, Firestore transaction melakukan commit bersama:
   - update item di `raw_materials`, `semi_finished_materials`, atau `products`;
   - set `stock_adjustments/{adjustmentId}`;
   - set `inventory_logs/{logId}` dengan `referenceType: stock_adjustment` dan snapshot `stockUnit`/`unit`.
6. Semi Finished bervarian wajib mengirim `variantKey` agar update stok masuk ke bucket varian, bukan master/default.

Batas integrasi:
- Purchases, Sales, Returns, Production, Payroll, Dashboard, dan Reports tidak ikut diubah saat task hanya Stock Management.

### Integrasi Satuan Qty Inventory Log
- Writer aktif `purchase_in`, `sale`, `return_in`, `stock_adjustment`, `production_material_out`, dan `production_output_in` harus membawa `stockUnit`/`unit` jika source item atau line transaksi memilikinya.
- Stock Management hanya membaca metadata satuan tersebut untuk display Qty; tidak menghitung ulang stok historis dan tidak memakai satuan untuk mutasi.
- Data lama tanpa satuan tetap kompatibel dan tidak wajib dimigrasi.
- Satuan panjang mengikuti operasional stok per `meter`; jangan memperkenalkan `cm` tanpa keputusan business rule baru.
- `variantStockNormalizer` tidak boleh disentuh kecuali ada bug varian yang jelas.
- Reset/Maintenance tetap bukan flow harian untuk memperbaiki stok.

## Integrasi Supplier UI dan Lookup Performance Ringan

```text
Supplier
-> reads supplierPurchases as master katalog restock
-> reads raw_materials for pilihan bahan/satuan stok
-> reads recent purchases with a guarded limit for price comparison only
-> shows compact table summary
-> opens drawer for complete supplier catalog details
-> does not write Purchases, stock, cash, expense, reports, or Raw Material from materialDetails
```

```text
Dashboard Restock Assistant
-> reads products + raw_materials to find low stock rows
-> reads recent inventory_logs with limit for activity feed
-> reads purchases only for low-stock material IDs shown in Restock Assistant
-> builds restock navigation/prefill hints
-> remains read-only and does not create purchase or mutate stock/cash
```

```text
Raw Material Detail
-> reads raw_materials as master bahan baku
-> reads supplier catalog for manual supplier display
-> reads recent purchases with a guarded limit for last purchase/link restock display
-> does not auto-sync Supplier catalog into Raw Material
-> does not mutate stock when drawer/detail is opened
```

Guard:
- Lookup purchase ringan hanya untuk ringkasan/restock helper, bukan source histori lengkap.
- Jangan limit Dashboard summary penting jika limit bisa menyembunyikan PO, payroll, expense, atau status produksi aktif.
- Jika butuh histori penuh atau presisi lintas data lama, gunakan laporan atau buat service/index khusus pada task terpisah.

## Integration Map Final Auth/User Management dan Firestore Rules — 2026-05-01

Status: **AKTIF + GUARDED**. Section ini menggantikan map fase desain/migrasi lama setelah login internal stabil di domain `@ziyocraft.com`.

### Flow login aktif

```text
Login.jsx
-> useAuth().loginWithUsername(username, password)
-> AuthContext build username@ziyocraft.com
-> Firebase Auth signInWithEmailAndPassword
-> onAuthStateChanged
-> Firestore get system_users/{firebaseAuthUid}
-> cek status active
-> cek role administrator/user
-> AppLayout / ProtectedRoute / Unauthorized
```

### Flow profile internal aktif

```text
Firebase Authentication user
-> uid
-> system_users/{uid}
-> username / usernameLower / displayName / role / status
-> roleAccess.js
-> SidebarMenu filtering
-> ProtectedRoute routeKey
-> halaman tampil sesuai akses
```

### Flow Manajemen User aktif

```text
Administrator
-> Firebase Console > Authentication
-> buat Auth user manual dengan email username@ziyocraft.com
-> copy UID Auth
-> Sistem > Manajemen User > Tambah Profile User
-> userService.createManualUserProfile()
-> validasi UID dan username unik
-> Firestore set system_users/{authUid}
-> user dapat login setelah profile active
```

### Flow Hapus Profile aktif

```text
Administrator
-> klik Hapus Profile di Manajemen User
-> controlled modal konfirmasi
-> userService.deleteSystemUserProfile()
-> validasi bukan self profile
-> validasi bukan administrator aktif terakhir
-> deleteDoc(system_users/{targetUid})
-> tabel reload
```

Batasan: Hapus Profile tidak menghapus Firebase Authentication user. Jika Auth user masih ada tetapi profile Firestore dihapus, user tidak dapat masuk IMS sampai profile dibuat kembali.

### Flow Firestore Rules final/staged-final

=====================================================
SECTION: Firestore Rules integration boundary — AKTIF / GUARDED
Fungsi:
- Memetakan rules backend aktif yang dikelola manual/external, tanpa mengharuskan file rules ada di repo ZIP saat ini.

Dipakai oleh:
- AuthContext, ProtectedRoute, User Management, role access, dan semua service Firestore client.

Alasan perubahan:
- Owner menetapkan Firestore Rules dikelola langsung di Firebase Console dan source-controlled rules bukan bagian patch ini.

Catatan cleanup:
- Jika rules ingin dimasukkan ke repo, buat task terpisah untuk file rules dan konfigurasi deploy.

Risiko:
- Menganggap sidebar/route guard sebagai security final tanpa rules backend aman akan membuka risiko akses data.
=====================================================

```text
request.auth.uid
-> get system_users/{request.auth.uid}
-> status harus active
-> role harus administrator/user
-> system_users guarded khusus
-> business collections diakses oleh profile aktif sesuai staged-final rules
-> collection tidak dikenal fallback deny
```

### Boundary data

- Firebase Authentication menyimpan password/session.
- Firestore `system_users/{uid}` menyimpan profile internal, role, dan status.
- Frontend User Management hanya menulis profile Firestore.
- Frontend tidak membuat, mengubah password, atau menghapus Firebase Authentication user.
- Admin SDK, service account, dan secret tidak boleh berada di `src` frontend.

### Role map aktif

| Role | Status | Integrasi |
|---|---|---|
| `administrator` | **AKTIF / GUARDED** | Akses seluruh menu aktif: Dashboard, Master Data, Stock Control, Produksi, Transaksi, Kas & Biaya, Sistem, Laporan, Pricing Rules, dan Reset & Maintenance. |
| `user` | **AKTIF / GUARDED** | Akses operasional harian: Dashboard, Stock Control, Production Operation, dan Transaksi. Tidak boleh Master Data, Pricing Rules, Production Setup, Cost & Analysis, Kas & Biaya, Sistem, Reset & Maintenance, atau Laporan. |

Role `super_admin` adalah **LEGACY / REMOVED FROM ACTIVE FLOW**. Jangan tambahkan kembali ke UI, service, route guard, atau rules tanpa task migrasi khusus.

### Boundary non-Auth

Patch Auth/User Management dan Rules tidak mengubah integrasi stok, purchases/sales/returns, production/payroll/HPP, cashflow/reports, dashboard read-only, pricing rules, atau reset maintenance business flow.

### Runtime verification map

Setelah publish rules backend di Firebase Console/external source atau mengubah role access, wajib test login admin, login user, Manajemen User create/edit/aktif-nonaktif/delete profile, sidebar visibility, direct route access untuk menu sensitif, Dashboard, Stock Control, Production Operation, Transaksi, Supplier/master data sebagai admin, Purchases, Sales, Produksi, Cashflow/Reports sebagai admin, dan console permission error.

## Integration Map Update — Batch Fix Bug Merge 2026-05-03
- `numberId.js` → halaman transaksi/master/inventory/produksi/finance/laporan: menyediakan format no-decimal dan parser integer untuk input UI aktif.
- `ProductionOrders.jsx` → `productionOrdersService.js`: preview dan simpan PO memakai requirement material strict, termasuk target/material variant metadata.
- `productionOrdersService.js` → `productionWorkLogsService.js`: `materialRequirementLines` PO menjadi kontrak `materialUsages` saat Start Production.
- `productionWorkLogsService.js` → `inventory_logs`: complete Work Log output menulis `production_output_in` beserta metadata Work Log/PO/step/varian/operator.
- `inventory_logs` → `StockManagement.jsx`: Stock Management menampilkan audit operator produksi dari metadata log baru, dengan fallback untuk log lama.
- `Products.jsx` / `RawMaterials.jsx` / `SemiFinishedMaterials.jsx` → service master masing-masing: data lama non-varian hanya boleh aktif varian saat stok/reserved/available 0; varian baru existing mulai stok 0; `variantKey` existing dipreserve.
- `Products.jsx` / `RawMaterials.jsx` → service master masing-masing: Pricing Rules opsional, default create Manual, `pricingRuleId` hanya wajib saat mode Rule.
- `Products.jsx` / `RawMaterials.jsx` → `components/Pricing/PricingModeSwitch.jsx`: memakai shared UI switch Manual/Rule; handler halaman tetap membersihkan `pricingRuleId` saat kembali ke Manual.
- `Products.jsx` → `buildSinglePricingPreview`: preview Pricing Rule memakai basis `hppPerUnit` dan target harga Product.
- `RawMaterials.jsx` → `buildSinglePricingPreview`: preview Pricing Rule memakai `averageActualUnitCost` dengan fallback `restockReferencePrice` dan target harga Raw Material.
- `Products.jsx` / `RawMaterials.jsx` → `pricingService.js`: keduanya tetap memakai `buildSinglePricingPreview` sebagai satu-satunya helper formula preview pricing.
- `productsService.js` / `rawMaterialsService.js`: tetap menjadi guard validation untuk mode Rule wajib `pricingRuleId` dan mode Manual boleh tanpa `pricingRuleId`.
- `PricingRules.jsx`: preview/apply tetap melewati item Manual dan hanya memproses item mode Rule/valid.
- `SemiFinishedMaterials.jsx` → `semiFinishedMaterialsService.js`: form edit mengirim identity varian existing supaya rename nama/label varian tidak membuat bucket stok baru.
- `Products.jsx` / `SemiFinishedMaterials.jsx` → service master masing-masing: `minStockAlert` tetap source master untuk item varian/non-varian; input/detail per-varian untuk minimum stok tidak aktif dan legacy `variants[].minStockAlert` tidak dijumlahkan.
- `SidebarMenu.jsx`: hanya mengatur openKeys nested accordion di UI, tidak menyentuh route, role access, atau service.
- `Login.jsx` / `Login.css`: hanya cleanup copy teknis login, tidak menyentuh AuthContext, Firebase Auth, `system_users`, atau RBAC.

## Integration Update — Cash In ledger dan Sales status tab — 2026-05-03

```text
Sales status Selesai
-> creates/keeps income in incomes
-> Cash In reads incomes as Auto Penjualan
-> Profit Loss reads incomes together with revenues and expenses
```

```text
Manual Cash In
-> user creates manual income from Pemasukan page
-> saves to revenues
-> Cash In reads revenues as Manual / Lama
-> Profit Loss reads revenues together with incomes and expenses
```

Guard integrasi:
- Cash In adalah read/create ledger untuk pemasukan, bukan tempat delete destructive.
- Cash In tetap membaca `revenues + incomes`; patch UI tidak mengubah collection atau schema.
- Sales status tab adalah filter tampilan atas `sales.status`; patch tab tidak mengubah status transition, stock mutation, income timing, Return, atomic create transaction, dashboard, atau reports.


## Integration Update — Sales pending income display-only — 2026-05-03

```text
Sales status Diproses/Dikirim
-> counted in Sales Pemasukan Pending summary only
-> no write to revenues
-> no write to incomes
-> no Cash In official income
-> no Profit Loss official income
```

```text
Sales status Selesai
-> creates/keeps income in incomes
-> Cash In reads incomes as Auto Penjualan
-> Profit Loss reads incomes together with revenues and expenses
```


Guard integrasi:
- Sales Pemasukan Pending adalah derived UI value dari collection `sales`, bukan posting akuntansi.
- Cash In tetap membaca `revenues + incomes` sebagai pemasukan resmi.
- Tombol Batalkan/Delete/Hapus tidak tampil di tabel Sales; barang kembali/koreksi wajib melalui Return agar stock/audit trail tetap terlacak.
- Dropdown item/varian Sales disederhanakan secara UI; payload item, `collectionName`, `variantKey`, stock mutation, income timing, returns, dashboard, dan reports tidak berubah.

## Integrasi UI Table Compact — 2026-05-06
Cash In
  -> membaca revenues + incomes existing
  -> table compact menggabungkan sumber/tipi display
  -> tidak menambah row action dan tidak mengubah write pemasukan manual

Stock Management / Stock Adjustment Panel
  -> membaca stock_adjustments existing
  -> table compact hanya mengubah render audit list
  -> submit adjustment, Firestore transaction, stock mutation, dan inventory_logs tetap di flow lama

Products / Raw Materials / Stock Report / Semi Finished Materials
  -> row saldo stok dikirim ke StockDisplayBlock untuk display saldo master dan chip/pill varian
  -> StockDisplayBlock membaca currentStock/stock/availableStock/reservedStock/variants[] secara presentational
  -> Raw Materials tetap memakai helper status lokal untuk status tag, summary/filter, dan detail drawer
  -> tidak mengubah product/raw material service, semi finished service, report query, summary, atau export mapping

Purchases stock preview
  -> preview stok aktual read-only terpisah dari StockDisplayBlock
  -> menampilkan Current Stock, Reserved Stock, dan Available Stock untuk master/varian terpilih
  -> tidak boleh menjadi sumber mutasi stok, inventory log, expense, atau kalkulasi purchase
  -> alert global varian kosong tidak ditampilkan karena dianggap visual noise dalam flow restock

Pricing Rules
  -> table utama compact menjadi entry point Detail/Edit/Hapus
  -> modal Detail/preview memakai kolom compact tanpa mengubah pricingService existing
  -> apply rule tetap melewati item manual sesuai guard pricing

Supplier
  -> table utama compact membaca supplierPurchases/materialDetails existing
  -> drawer detail tetap menjadi tempat katalog restock panjang
  -> tidak membuat purchase, stok, kas, atau expense otomatis

## Integration Update — Minimum Stock Read-Only Alignment — 2026-05-07

```text
Product master
-> products.minStockAlert
-> Dashboard Stok Kritis + Stock Report status

Raw Material master
-> raw_materials.minStock
-> RawMaterials status + Dashboard Stok Kritis + Stock Report status

Semi Finished master
-> semi_finished_materials.minStockAlert
-> SemiFinishedMaterials status + Dashboard Stok Kritis + Stock Report status
```

Guard:
- Dashboard dan Stock Report adalah consumer read-only untuk minimum stock, tidak menulis stok, tidak membuat transaksi, dan tidak mengubah inventory log.
- Stok pembanding status rendah memakai `availableStock ?? currentStock ?? stock ?? 0`.
- Threshold Product/Semi memakai `minStockAlert`; threshold Raw Material memakai `minStock`.
- `variants[].minStockAlert` Product/Semi Finished adalah legacy-compat only dan bukan source threshold aktif untuk Dashboard/Report.
- Restock Assistant Dashboard tetap khusus Raw Material; Semi Finished yang muncul di `Stok Kritis` hanya read-only/navigasi.

## Integration Update — Buku Besar Kas / Money Movement Ledger — 2026-05-09

```text
Sales status Selesai
-> creates/keeps income in incomes
-> Buku Besar Kas reads incomes as uang masuk Penjualan Selesai
-> does not read sales as nominal utama to avoid double count
```

```text
Manual Cash In
-> user creates manual income from Pemasukan page
-> saves to revenues
-> Buku Besar Kas reads revenues as uang masuk Cash In Manual / legacy
```

```text
Purchase / Payroll Paid / Manual Cash Out
-> writes recognized cash expense to expenses
-> Buku Besar Kas reads expenses as uang keluar
-> does not read purchases or production_payrolls as nominal utama to avoid double count
```

```text
Production Work Log / HPP / Inventory Log / Stock Adjustment / Reset HPP Testing
-> not cash movement source
-> must not appear in Buku Besar Kas unless there is an explicit existing document in incomes, revenues, or expenses
```

Guard integrasi:
- Route aktif: `/finance/money-movement-ledger`.
- Menu aktif: `Kas & Biaya` -> `Buku Besar Kas`.
- Role: Administrator only.
- Service reader: `src/services/Finance/moneyMovementLedgerService.js`.
- Page reader: `src/pages/Finance/MoneyMovementLedger.jsx`.
- Tidak ada append-only ledger, backfill, trigger posting, schema baru, atau perubahan Profit Loss.

## Integration Update — Referensi ID Bisnis dan Technical ID Lock — 2026-05-11

```text
Business flow create
-> generate Referensi ID bisnis manusiawi
-> simpan field bisnis readable (`purchaseNumber`, `saleNumber`, `returnNumber`, `adjustmentNumber`, `workNumber`, `productionOrderCode`, `sourceRef`, `referenceNumber`)
-> UI audit membaca referensi manusiawi
-> Technical ID tetap internal Firestore, bukan display audit
```

Mapping field audit readable:
- Purchase: `purchaseNumber` / `sourceRef` / `referenceNumber` readable.
- Sales: `saleNumber` / `sourceRef` / `referenceNumber` readable untuk kode internal `ORD-*`; nomor marketplace/resi ada di `externalReferenceNumber`.
- Return: `returnNumber` / `sourceRef` / `referenceNumber` readable.
- Stock Adjustment: `adjustmentNumber` / `sourceRef` / `referenceNumber` readable.
- Work Log: `workNumber` / `code` readable.
- Production Order: `productionOrderCode` / `code` readable.
- Payroll: `payrollNumber` / `sourceRef` readable.
- Cash In/Out: `sourceRef` / `referenceNumber` readable.

Guard integration:
- `inventory_logs.referenceId`, `sourceId`, related id, atau Firestore document ID tidak boleh menjadi display audit utama jika nilainya technical/random.
- Untuk data baru setelah reset, Referensi ID bisnis adalah acuan audit utama.
- `StockManagement.jsx` harus menampilkan referensi manusiawi, bukan Technical ID/random ID.
- Jika referensi bisnis belum tersedia, UI menampilkan `-` atau `Referensi belum tersedia`.
- Inventory log baru yang memiliki banyak baris untuk satu referensi harus memakai ID turunan readable, bukan random ID, setelah task arsitektur disetujui.
- Generator kode manusiawi harus shared dan algoritmik berbasis konsonan, bukan mapping manual kata-per-kata.
- Current source masih memiliki generator/mapping manual yang perlu cleanup task terpisah, terutama `businessCodeGenerator` dan `productionCodeGenerator`.
- Patch docs-only tidak mengubah service write flow, schema/collection, inventory log writer, report/export, route, menu, role guard, atau guarded production flow.

## Integration Map — Testing & Reset Center

- Page aktif: `src/pages/Utilities/ResetMaintenanceData.jsx`.
- Service reset destructive tetap: `src/services/Maintenance/resetMaintenanceDataService.js`.
- Flow UI utama: Auto Detect Bug → Repair Turunan → Preview Reset/Baseline → Confirmation keyword → Eksekusi → Audit ulang/Riwayat Maintenance.
- Auto Detect Bug memanggil audit service existing: data quality, stok, inventory log, legacy, production variant, payroll snapshot, dan transaction variant.
- Preview reset/dev-test tidak auto full-scan saat halaman dibuka; user harus klik preview manual sebelum eksekusi destructive.
- Export data pokok membaca allowlist master secara read-only dan tidak membaca transaksi/log sebagai default.
- Opening stock reference pada export berasal dari stok master saat export dan harus dibuat ulang lewat flow terbaru setelah reset.
- Advanced Detail / Developer Tools membungkus panel lama tanpa mengubah route/menu/role guard.
- Guard: reset total protected master belum diaktifkan; butuh approval dan service khusus jika nanti dibuat.


---

## FINAL LOCKED REFERENCE CODE STANDARD — IMS Bunga Flanel

Status: **LOCKED / GUARDED**. Prefix dan format di bawah ini tidak boleh diubah lagi tanpa approval arsitektur khusus.

| Modul | Prefix final | Format final | Contoh |
|---|---|---|---|
| Customer | `CUS` | `CUS-DDMMYYYY-001` | `CUS-12052026-001` |
| Supplier | `SUP` | `SUP-DDMMYYYY-001` | `SUP-12052026-001` |
| Produk Jadi | `PRD` | `PRD-001` | `PRD-001` |
| Raw Material | `RAW` | `RAW-001` | `RAW-001` |
| Semi Finished | `SFP` | `SFP-001` | `SFP-001` |
| BOM | `BOM` | `BOM-001` | `BOM-001` |
| Production Step | `STP` | `STP-001` | `STP-001` |
| Purchase | `PUR` | `PUR-DDMMYYYY-001` | `PUR-12052026-001` |
| Sales / Order | `ORD` | `ORD-DDMMYYYY-001` | `ORD-12052026-001` |
| Return | `RET` | `RET-DDMMYYYY-001` | `RET-12052026-001` |
| Production Order | `PO` | `PO-[TYPE]-DDMMYYYY-001` | `PO-PRD-12052026-001` |
| Stock Adjustment | `STK-ADJ` | `STK-ADJ-DDMMYYYY-001` | `STK-ADJ-12052026-001` |
| Cash In | `CSH-IN` | `CSH-IN-DDMMYYYY-001` | `CSH-IN-12052026-001` |
| Cash Out | `CSH-OUT` | `CSH-OUT-DDMMYYYY-001` | `CSH-OUT-12052026-001` |
| Work Log | `JOB` | `JOB-DDMMYYYY-001` | `JOB-12052026-001` |
| Payroll | `PAY` | `PAY-DDMMYYYY-001` | `PAY-12052026-001` |

Catatan lock:
- Gunakan **`CSH-OUT`**, bukan `CSH-OT`, `COUT`, atau variasi lain.
- Sales tetap boleh memakai nama field legacy `saleNumber`, tetapi value data baru wajib ber-prefix `ORD`.
- Date sequence wajib memakai `DDMMYYYY` dan sequence 3 digit (`001`, `002`, `003`).
- Master item/config produksi memakai sequence internal sederhana `PREFIX-001`. Kode ini disimpan untuk relasi/backstage dan tidak menjadi fokus UI.
- Firestore random ID tidak boleh tampil sebagai kode audit/user-facing.
- Data lama dengan prefix legacy tetap compatibility, tetapi bukan standar data baru.


### Mapping final field reference aktif

| Modul | Collection utama | Field reference aktif |
|---|---|---|
| Customer | `customers` | `code`, `customerCode` |
| Supplier | `supplierPurchases` | `code`, `supplierCode` |
| Product | `products` | `code`, `productCode` |
| Raw Material | `rawMaterials` | `code`, `materialCode` |
| Semi Finished | `semiFinishedMaterials` | `code`, `itemCode` |
| BOM | `productionBoms` | `code`, `bomCode` |
| Production Step | `productionSteps` | `code` |
| Purchase | `purchases` | `purchaseNumber`, `code`, `referenceNumber`, `sourceRef` |
| Sales / Order | `sales` | `saleNumber` dengan value `ORD-*`, `code`, `referenceNumber`, `sourceRef`; nomor marketplace/resi: `externalReferenceNumber` |
| Return | `returns` | `returnNumber`, `code`, `referenceNumber`, `sourceRef` |
| Production Order | `productionOrders` | `productionOrderCode`, `code` |
| Stock Adjustment | `stock_adjustments` | `adjustmentNumber`, `code`, `referenceNumber`, `sourceRef` |
| Cash In | `revenues`/`incomes` | `cashInNumber`, `code`, `referenceNumber`, `sourceRef` |
| Cash Out | `expenses` | `cashOutNumber`, `code`, `referenceNumber`, `sourceRef` |
| Work Log | `productionWorkLogs` | `workNumber` |
| Payroll | `productionPayrolls` | `payrollNumber` |

Inventory log harus memakai reference bisnis dari sumber transaksi, bukan Firestore random ID.


### Mapping UI/reference: master item vs transaksi

| Area | Code behavior | UI utama |
|---|---|---|
| Product | `code` dibuat service dan disimpan internal | Nama produk, kategori, harga, stok, varian |
| Raw Material | `code` dibuat service dan disimpan internal | Nama bahan, supplier, satuan, stok, varian |
| Semi Finished | `code` dibuat service dan disimpan internal | Nama semi product, kategori, unit, stok, varian |
| BOM | `code` dibuat service dan disimpan internal | Nama BOM, target produk/semi finished, komposisi, step |
| Production Step | `code` dibuat service dan disimpan internal | Nama step, kategori, status, deskripsi, payroll rule |
| Customer/Supplier/transaksi/audit | reference tetap tampil di UI | Dipakai untuk audit, pencarian, report, bukti stok/kas/produksi |

Catatan: Inventory log, export, dan audit teknis tetap boleh memakai kode internal master item, tetapi UI utama tidak boleh memaksa user mengisi atau melihat kode sebagai identitas utama.

### Sales No-Cancel & Return Map — 2026-05-17
```text
Sales Diproses/Dikirim/Selesai
-> no user-facing batal/delete action in Sales table
-> status transition only Diproses -> Dikirim -> Selesai
-> stock out remains from Sales create transaction
-> income only when status is Selesai
-> goods returned/correction uses Return module
-> Return writes returns doc + stock in + inventory_logs return_in
-> Return does not create income/expense/revenue/ledger finance automatically
```

Guard:
- Jangan menyediakan create status batal atau action Batalkan di Sales.
- Jangan membuat flow stock revert dari Sales; stok masuk atas barang kembali wajib lewat Return.
- Search/display Sales harus membedakan kode internal `ORD-*` dari `externalReferenceNumber` marketplace/resi.
- Submit create Sales wajib punya lock agar double-click tidak membuat order/stok dobel.
- Auto Detect/Data Quality Audit hanya read-only untuk menemukan Sales belum selesai yang sudah punya income, Sales selesai yang belum punya income, Sales tanpa inventory log `sale`, dan mismatch side-effect lain yang masih relevan dengan flow aktif.

### Batch 18B — Transaction Side-Effect Repair aktual guarded — 2026-05-23

```text
Reset & Maintenance > Repair Turunan Aman
-> Cek Side-Effect Transaksi
-> transactionSideEffectRepairService.getTransactionSideEffectRepairAudit()
-> read sales/purchases/returns + incomes/expenses/inventory_logs
-> classify safe repair vs manual review
-> keyword REPAIR TRANSAKSI
-> transactionSideEffectRepairService.repairTransactionSideEffects()
-> create missing incomes/expenses/inventory_logs only
-> no stock master mutation
-> no sales/purchases/returns mutation
-> no delete/rollback side-effect lama
-> audit ulang
```

Guard:
- Sales `Selesai` tanpa income boleh dibuatkan `incomes`.
- Purchases tanpa expense otomatis boleh dibuatkan `expenses`.
- Sales/Purchases/Returns tanpa inventory log boleh dibuatkan `inventory_logs` audit, tetapi tidak boleh mengubah stok karena stok sudah dianggap side-effect aktual transaksi lama.
- Sales belum `Selesai` tetapi sudah punya income tetap manual review, bukan auto delete.
- Return aktif tetap stock-only correction + inventory log; tidak membuat refund/cash finance otomatis.

### Batch 19B — Reset/Maintenance Master Export hook aktif

```text
ResetMaintenanceData.jsx
-> useMasterDataExport()
-> resetMaintenanceDataService.getMasterDataExportPreview()
-> resetMaintenanceDataService.buildMasterDataExportPayload({ includeOpeningStock })
-> ResetExportPanel receives export preview/loading/handler props
```

Guard:
- Hook hanya mengelola state/loading/handler Preview Export, Export Master, dan Export Checklist.
- Hook tidak menjalankan reset, delete, repair, sync stock, baseline restore, HPP reset, atau mutasi transaksi.
- Export data pokok tetap read-only backup/checklist helper; bukan restore otomatis dan bukan sumber perubahan schema.

### Batch 19C-19G — Reset/Maintenance audit/repair hook consolidation

```text
ResetMaintenanceData.jsx
-> useResetMaintenanceAudits({ createPageMaintenanceLog })
-> useResetMaintenanceRepairs({ createPageMaintenanceLog, loadPreview })
-> ResetAutoDetectPanel / ResetSafeRepairPanel receive audit, repair, loading, rows, and summaries as props
```

Guard:
- Source aktif memakai hook konsolidasi `useResetMaintenanceAudits.js` dan `useResetMaintenanceRepairs.js`; hook individual lama seperti `useDataQualityAudit`, `useLegacyDataAudit`, `useMasterCodeMaintenance`, `useProductionMaintenance`, dan `useResetAuditOverview` sudah tidak menjadi kontrak aktif.
- Audit tetap dry-run/read-only sampai user menekan action repair yang guarded.
- Repair logic tetap berada di service maintenance masing-masing; hook hanya orchestration UI/loading/log metadata.

### Reset/Maintenance remaining page split guarded

```text
ResetMaintenanceData.jsx
-> ResetStatusSummaryCard
-> ResetConfirmModal
-> HppCostConfirmModal
-> ResetDangerZonePanel / ResetAutoDetectPanel / ResetSafeRepairPanel / ResetPreviewPanel / ResetExportPanel
```

Guard:
- Split UI tidak mengubah reset scope, protected collection, confirmation keyword, audit log pre-write, HPP reset/restore semantics, stock sync, atau service destructive.
- Modal destructive tetap require keyword dan blocking loading state.
- Reset service `resetMaintenanceDataService.js` tetap guarded dan tidak disentuh dalam split UI ini.

### Integration Map — Dashboard / Stock Report Stock Row Mapper

```text
products/raw_materials/semi_finished_materials
-> buildStockReadModelRow()
-> Dashboard Stok Kritis / Stock Audit
-> Stock Report table / XLSX export rows
```

Guard:
- Mapper ini read-only dan hanya menyatukan display row/comparator stok antar halaman.
- Ini bukan persisted Firestore read model, bukan collection summary, dan bukan mekanisme paging.
- Tidak melakukan backfill, tidak menulis stok, dan tidak mengganti helper mutasi stok guarded.
- Dashboard dan Stock Report masih boleh memakai mapper ini sampai switch read model dilakukan dalam batch terpisah.

### Integration Map — Firestore Stock Read Model `stock_item_read_models`

```text
products/raw_materials/semi_finished_materials
-> buildStockReadModelRow()
-> buildStockItemReadModelPayload()
-> stockReadModelService.js
-> stock_item_read_models/{sourceType}__{sourceId}
-> Dashboard issue query / Stock Report paging-export query
```

Kontrak field awal:
- Identitas: `sourceType`, `sourceCollection`, `sourceId`, `displayReference`, `name`, `typeLabel`, `route`.
- Stok: `stock`, `currentStock`, `reservedStock`, `availableStock`, `minStockThreshold`, `unitDisplay`.
- Status query: `stockStatus`, `stockStatusLabel`, `reportStatus`, `statusRank`, `sortGap`, `hasStockIssue`, `isNegativeStock`, `isReservedOverrun`.
- Varian: `hasVariants`, `variantCount`, `affectedVariantCount`, `affectedVariantSummary`, `affectedVariantEntries`.
- Restock snapshot opsional: `lastPurchaseAt`, `lastPurchasePrice`, `restockSupplierId`, `restockSupplierName`, `restockProductLink`.
- Sync metadata: `isActive`, `searchText`, `sourceUpdatedAt`, `updatedAt`, `lastSyncedFrom`.

Guard:
- `stock_item_read_models` adalah derived read model untuk read path; source of truth tetap master stok + `inventory_logs`.
- Foundation service dan maintenance backfill boleh ada, tetapi belum boleh dipakai Dashboard/Stock Report sebelum writer sync realtime semua jalur mutasi stok selesai.
- Writer future wajib meng-cover Purchases, Sales, Returns, Stock Adjustment, Production Work Logs, Production Orders/reservation, Master Data edit/toggle, dan maintenance rebuild.
- Firestore Rules/index untuk collection baru harus disiapkan di luar ZIP frontend sebelum production switch.
- Query issue/read report harus menghindari full scan permanen; jika Firestore meminta index, buat composite index yang sesuai.



### Integration Map — Stock Read Model Maintenance Backfill

```text
products/raw_materials/semi_finished_materials
+ stock_item_read_models
-> stockReadModelMaintenanceService.js
-> compare expected buildStockItemReadModelDocument()
-> ResetSafeRepairPanel: Cek Read Model Stok / Rebuild Read Model Stok
-> upsert missing/stale stock_item_read_models only
-> orphan read model = manual review, no auto-delete
```

Guard:
- Backfill/rebuild ini hanya menulis derived collection `stock_item_read_models`.
- Tidak mengubah master stock, `inventory_logs`, transaksi, produksi, HPP, payroll, finance, route/menu, atau role guard.
- Tidak mengganti Dashboard/Stock Report read path; kedua area tetap memakai source lama sampai switch resmi.
- Tidak melakukan writer sync realtime; transaksi baru tetap perlu batch writer sync berikutnya agar read model tidak stale.
- Orphan tidak dihapus otomatis agar aman terhadap data legacy, source read gagal, atau rules/index yang belum lengkap.

### Helper Integration Map — stock formatter dan trim normalization — 2026-05-17

```text
Master/Product detail display
Raw Material detail display
Semi Finished detail display
StockDisplayBlock table display
-> utils/formatters/stockUnit.js::formatStockWithUnitId()
-> utils/formatters/numberId.js::formatNumberId()
```

Guard:
- Formatter `stockUnit` hanya untuk display read-only; jangan dipakai untuk parsing input, mutasi stok, payroll, HPP, atau audit qty transaksi.
- Kalkulasi stok tetap lewat `utils/stock/stockHelpers.js` dan helper varian aktif.
- `stockHelpers.toNumber()` wajib finite-safe agar helper stok/variant tidak meneruskan `NaN`.
- `safeTrim` lokal di file guarded tetap boleh dipertahankan selama dipakai untuk fallback legacy/reference; jangan membuat refactor global tanpa grep usage dan test flow terkait.

### Helper Integration Map — option map constants — 2026-05-17

```text
src/utils/options/optionMap.js::toOptionMap()
-> src/constants/productionBomOptions.js
-> src/constants/productionEmployeeOptions.js
-> src/constants/productionPayrollOptions.js
-> src/constants/productionProfileOptions.js
-> src/constants/productionStepOptions.js
-> src/constants/productionWorkLogOptions.js
-> src/constants/variantOptions.js
-> src/constants/semiFinishedMaterialOptions.js
```

Guard:
- Constants boleh re-export `toOptionMap` sementara untuk legacy import compatibility.
- Helper ini hanya untuk enum/display map `{ value, label }`; jangan dipakai untuk mapping collection, route, role guard, stock status mutation, payroll posting, atau data migration.
- Jangan membuat helper map lain di constants baru jika `toOptionMap()` sudah cukup.

### Integration Map — Atomic Counter Transaksi Utama — 2026-05

```text
Sales create / Purchases create / Returns create
-> generateDailySequenceCode() prefix query baseline legacy
-> prepareDailySequenceCodeInTransaction()
-> business_code_counters/{DAILY__ORD__DDMMYYYY | DAILY__PUR__DDMMYYYY | DAILY__RET__DDMMYYYY | DAILY__CUS__DDMMYYYY | DAILY__SUP__DDMMYYYY | DAILY__CSH-IN__DDMMYYYY | DAILY__CSH-OUT__DDMMYYYY | DAILY__STK-ADJ__DDMMYYYY | DAILY__PO-PRD__DDMMYYYY | DAILY__PO-SFP__DDMMYYYY | DAILY__JOB__DDMMYYYY | DAILY__PAY__DDMMYYYY | DAILY__PP__YYYYMMDD | DAILY__EMP__DDMMYYYY | SEQUENTIAL__PRD | SEQUENTIAL__RAW | SEQUENTIAL__BOM | SEQUENTIAL__SFP}
-> Sales: create sales + stock out + inventory log; income hanya saat status Selesai
-> Purchases: create purchase + stock in + inventory log + expense otomatis
-> Returns: create return + stock in + inventory log; tidak ada finance/ledger otomatis
```

Guard:
- Counter transaction-level aktif untuk Sales, Purchases, Returns (Batch 16B), diperluas ke master data, finance manual, stock adjustment, serta create produksi pada Batch 16C, lalu dilengkapi untuk Production Planning dan Karyawan Produksi pada Batch 16D.
- Jangan menambah scope counter baru di luar daftar Batch 16B/16C/16D tanpa review guarded karena menyentuh document ID, audit reference, dan Firestore Rules.
- Jangan ubah format kode, document ID readable, inventory log payload, income/expense, stock mutation, purchase average cost, Return stock-only rule, status flow, route/menu/role guard, production, payroll, HPP, atau reset.
- Prefix query lama tetap menjadi baseline legacy agar counter tidak menimpa kode lama.


### Integration Map — Batch 16D Production Planning & Employee Counter

```text
Production Planning create
-> generateProductionPlanCode() prefix query baseline legacy
-> prepareDailySequenceCodeInTransaction(prefix: PP, dateFormat: YYYYMMDD, sequenceLength: 4)
-> business_code_counters/{DAILY__PP__YYYYMMDD}
-> production_plans/{PP-YYYYMMDD-0001}

Production Employee create
-> getProductionEmployeeCodeBaselineSequence() membaca production_employees + business_code_counters + legacy production_employee_code_sequences
-> prepareBusinessCodeCounterSequenceInTransaction(prefix: EMP, dateCode: DDMMYYYY)
-> business_code_counters/{DAILY__EMP__DDMMYYYY}
-> production_employees/{DDMMYYYY-001}
```

Guard:
- Format kode Planning tetap `PP-YYYYMMDD-0001`.
- Format kode Employee tetap `DDMMYYYY-XXX`; prefix `EMP` hanya dipakai sebagai key counter internal.
- Jangan rename dokumen lama atau mengubah relasi Work Log/Payroll/PO existing.

### Integration Map — Stock Report Read Guard

```text
StockReport.jsx
-> fetchStockReportData()
-> getStockReadModelRows({ ordered: true, cursor, includeMeta: true })
-> stock_item_read_models paging / load more / full export batch
-> fallback guarded ke readStockReportSnapshot(raw_materials/products/semi_finished_materials/categories) jika read model kosong/gagal
-> exportJsonToExcel() dengan metadata source, limit, fallback, dan disclosure partial/limited bila terjadi
```

Guard:
- Flow ini read-only; tidak boleh menulis stok, inventory log, transaksi, produksi, atau finance.
- Guard partial read sekarang adalah fallback compatibility; path normal Stock Report terbaru memakai read model/paging/full export batch.
- Export XLSX harus mengikuti data matching filter yang berhasil dibaca via paging batch, serta wajib membawa disclosure parsial ketika ada failedReads, fallback, atau limit operasional.


### Integration Map — Batch 25–27 Final QA & Stabilization

```text
source runtime terbaru
-> syntax/parse/lint/build local verification
-> docs/source conflict cleanup
-> large file audit
-> UI consistency QA pass
-> final manual regression checklist
```

Guard:
- Batch 25–27 bukan batch fitur dan bukan batch business logic. Perubahan source runtime hanya boleh berupa fix blocker aman yang terbukti dari source aktual.
- Jika tidak ada blocker lint/build dari source ZIP, batch ini terutama menyinkronkan docs/checklist agar tidak mengarahkan patch berikutnya ke status lama yang sudah superseded.
- Helper split Batch 18–24 tetap behavior-preserving. Jangan memakai helper UI/read-only sebagai pengganti service transaction.
- Dashboard/Stock Report path normal terbaru memakai `stock_item_read_models`; fallback master/source tetap compatibility guard.
- Semua area guarded tetap harus melalui service existing: stock posting, purchase expense, sales income, return stock-only rule, production HPP/payroll, reset destructive, inventory log, route/menu/role guard, and Firestore rules/index deployment.


## Offline Local DB contract integration — 2026-05

Status: **FOUNDATION + CONTRACT ONLY / FIREBASE PRIMARY MASIH AKTIF**.

Integrasi target jangka panjang:

```text
React UI
-> IMS service/repository
-> Dexie/IndexedDB local DB
-> sync_queue
-> Firebase mirror/backup
```

Integrasi source Batch 1/2/3:
- `src/data/local/localDbSchema.js` menyimpan nama DB, versi schema, table foundation, dan allowlist backup.
- `src/data/local/imsLocalDb.js` membuat singleton Dexie untuk `ims_bunga_flanel_offline`.
- `src/data/local/localDbMeta.js` menyimpan metadata foundation, mode, dan timestamp backup/restore.
- `src/data/local/localDbBackupValidator.js` memvalidasi payload backup sebelum restore.
- `src/data/local/localDbBackupService.js` membuat export/preview/restore foundation backup.
- `docs/10_OFFLINE_DATABASE_CONTRACT.md` menjadi peta resmi migrasi offline-first.

Boundary:
- Page/service aktif belum boleh langsung bergantung ke Dexie untuk transaksi utama.
- Firebase service existing tetap aktif sampai repository boundary dibuat.
- `sync_queue` masih local storage contract, belum integrasi Firebase Sync.
- Backup/restore foundation tidak boleh menjadi reset destructive untuk data bisnis utama.
- Migrasi berikutnya wajib melalui repository pilot untuk `categories`, `customers`, dan `suppliers` sebelum masuk stock/purchase/sales/production.


## Repository Pilot integration — 2026-05 Batch 4

Status: **PILOT / FIREBASE PRIMARY DEFAULT**.

Boundary baru:
```text
Repository
-> Firebase adapter   (default)
-> Dexie adapter      (explicit offline_local only)
```

Files:
- `src/data/repositories/repositoryMode.js`
- `src/data/repositories/categoriesRepository.js`
- `src/data/repositories/customersRepository.js`
- `src/data/repositories/suppliersRepository.js`
- `src/data/adapters/firebase/*`
- `src/data/adapters/dexie/*`

Integrasi:
- `categoriesRepository` menyediakan boundary untuk kategori, tetapi page kategori belum dimigrasi.
- `customersRepository` mode Firebase menggunakan `customersService` agar rule kode customer tetap terjaga.
- `suppliersRepository` mode Firebase read-only untuk write; create/update/delete supplier belum dipindah dari `SupplierPurchases.jsx`.
- Batch berikutnya boleh mulai memilih satu page pilot kecil, tetapi harus audit file aktual lagi dan tidak boleh menyentuh stock/transaksi/production/payroll.


## Offline Sync Queue pilot integration — 2026-05

Status: **LOCAL QUEUE ONLY / BELUM FIREBASE PUSH-PULL**.

Integrasi Batch 6:
- `src/data/sync/syncQueueService.js` mengelola queue lokal untuk collection pilot.
- `src/data/local/localDbSchema.js` menyimpan constant sync status, operation, dan collection allowlist.
- `src/data/adapters/dexie/dexieMasterDataAdapterFactory.js` mencatat queue saat create/update/delete lokal pilot.
- `src/data/repositories/repositoryModeService.js` menyediakan dev guard untuk mode repository.

Boundary:
- Queue hanya local Dexie; belum ada Firebase sync worker.
- Collection allowlist hanya `categories`, `customers`, `suppliers`.
- `hybrid_sync` masih diblokir.
- Page aktif belum switch ke offline repository.
- Batch berikutnya baru boleh membuat manual Firebase sync untuk master data pilot, bukan auto sync dan bukan transaksi.


## Offline Manual Sync Dev Panel integration — 2026-05

Status: **DEV PANEL / MANUAL ONLY**.

Integrasi Batch 8:

```text
Testing & Reset Center
-> OfflineSyncDevPanel
-> repositoryModeService
-> syncQueueService
-> firebaseMasterDataSyncService
-> syncConflictService
-> Dexie local DB
-> Firebase categories/customers only
```

Boundary:
- Panel berada di existing `ResetMaintenanceData.jsx`, tidak menambah route/menu.
- Panel hanya preview/manual action; tidak ada background sync.
- `firebaseMasterDataSyncService` hanya allowlist categories/customers.
- `syncConflictService` menyimpan konflik local ke `sync_conflicts`.
- Supplier tetap blocked sampai supplier repository write flow diaudit.
- Delete Firebase tetap blocked dari panel Batch 8.


## Offline Conflict Resolver + Master Data Pilot integration — 2026-05 Batch 10

Status: **DEV PANEL / MANUAL ONLY / NON-AUTO SYNC**.

Integrasi:

```text
Testing & Reset Center
-> OfflineSyncDevPanel
   -> firebaseMasterDataSyncService
   -> syncConflictService
   -> syncConflictResolutionService
   -> syncQueueService
   -> Dexie local DB
   -> Firebase categories/customers only

Testing & Reset Center
-> OfflineMasterDataPilotPanel
   -> categoriesRepository/customersRepository
   -> Dexie adapters via mode offline_local
   -> syncQueueService
```

Boundary:
- `firebaseMasterDataSyncService` memiliki re-export compatibility `createSyncConflict` untuk mencegah named export mismatch dari patch lama.
- `syncConflictResolutionService` hanya master data pilot categories/customers.
- `OfflineMasterDataPilotPanel` hanya dev utility; tidak mengganti page aktif Master Data.
- Tidak ada background sync, route baru, menu baru, atau role guard baru.
