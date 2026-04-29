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
| Penjualan dibuat / selesai | sales | stock keluar saat create + income saat selesai | availableStock guard + sale id / status selesai |
| Stock Adjustment | stock_adjustments | inventory_logs | adjustment id/reference |
| Work Log completed | production_work_logs | output stock + payroll line | Work Log completed guard |
| Payroll dari Work Log | production_payrolls | labor cost ke Work Log | Work Log + Step + Operator |
| Payroll paid | production_payrolls | expenses / Cash Out | sourceModule + sourceId |
| Profit Loss | revenues + incomes + expenses | laporan laba rugi | jangan baca payroll langsung jika sudah jadi expense |
| HPP Analysis | completed Work Logs | material + labor + total cost + warning cost 0 | completed Work Log only + payroll final only |

## Source reference wajib

Semua data otomatis harus menyimpan referensi:

- `sourceModule`
- `sourceId`
- `sourceRef`
- `sourceType` jika perlu
- `createdByAutomation` jika dibuat sistem

## Guard penting

1. Work Log completed tidak boleh diproses dua kali.
2. Payroll line tidak boleh dobel untuk Work Log + Step + Operator yang sama.
3. Payroll paid tidak boleh membuat expense dobel.
4. Profit Loss tidak boleh menghitung payroll dari dua sumber sekaligus.
5. Backfill data lama tidak boleh otomatis tanpa preview.

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
→ Work Log in_progress
→ user action: Complete Work Log
→ output stock + payroll/HPP existing
→ Dashboard membaca progress planning
```

| Flow | Source aktif | Output otomatis | Guard anti-double |
|---|---|---|---|
| Planning dibuat | production_plans | target monitoring | tidak ada mutasi stok |
| PO dari Planning | production_plans + production_boms | production_orders dengan planning reference | user action wajib, tetap lewat BOM |
| Progress Planning | completed production_work_logs | actual/remaining/progress read model realtime | hitung Work Log completed sekali per id |
| Dashboard Planning | production_plans + PO + Work Log completed | summary target minggu/bulan | read-only, tidak update data |

## Source reference Planning ke PO
PO yang dibuat dari planning wajib menyimpan:
- `planningId`
- `planningCode`
- `planningTitle`

Planning dapat menyimpan:
- `linkedProductionOrderIds`
- `linkedProductionOrderCodes`

Jika array link planning belum lengkap, service tetap bisa membaca PO berdasarkan `planningId`.

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
- jika mutasi stok gagal setelah sale dibuat, sale baru harus rollback/delete agar tidak orphan;
- cancel/delete tetap revert stok satu kali dan tidak membuat income dobel.

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
-> warning jika cost 0
-> Export HPP XLSX membawa kolom Validasi Cost
```

Guard:
- jangan isi cost asal;
- draft payroll tidak dihitung sebagai final;
- Work Log completed tidak diproses ulang hanya untuk display warning.

### Dashboard Read-only Map
```text
Dashboard
-> reads only: stock, planning, PO, work log, payroll, expenses/incomes, inventory logs
-> 5 section compact
-> no write
-> last updated + refresh summary only
```

Dashboard tidak boleh menjadi sumber transaksi. Semua action Dashboard hanya navigasi ke modul terkait.

### Report / Export Map
```text
Stock Report
-> raw_materials + semi_finished_materials + products
-> XLSX siap baca

HPP Analysis
-> completed Work Logs + payroll final
-> XLSX HPP + Validasi Cost

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

## Flow Reset & Maintenance Aman

```text
Reset & Maintenance
-> preview target reset
-> tampilkan collection yang akan dihapus
-> tampilkan protected master data termasuk supplierPurchases
-> user wajib konfirmasi RESET
-> reset hanya menghapus target non-protected
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
2. UI menampilkan audit read-only: Tanggal, Arah, Sumber, Item, Qty, Referensi Audit, dan Catatan.
3. Kolom `Stok` generic tidak ditampilkan selama snapshot belum reliable.
4. Panel Penyesuaian Stok menjadi entry point adjustment manual resmi.
5. Saat adjustment disimpan, Firestore transaction melakukan commit bersama:
   - update item di `raw_materials` atau `products`;
   - set `stock_adjustments/{adjustmentId}`;
   - set `inventory_logs/{logId}` dengan `referenceType: stock_adjustment`.

Batas integrasi:
- Purchases, Sales, Returns, Production, Payroll, Dashboard, dan Reports tidak ikut diubah saat task hanya Stock Management.
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

## Integrasi Login + Role + Manajemen User Internal - Fase A

Status: **DESAIN + GUARDED**. Source code Auth, route guard, menu guard, User Management, dan Firestore Rules belum diubah pada fase ini.

### Flow akses target

```text
User membuka aplikasi
-> Auth loading state mengecek sesi
-> Jika belum login: tampilkan Login
-> User login dengan username/password internal
-> Auth menghasilkan authUid
-> App membaca profile system_users/{authUid}
-> App cek role dan status active
-> App render layout, sidebar, dan route sesuai role
-> Firestore Rules memvalidasi request.auth + role/status
```

### Flow Manajemen User target

```text
administrator membuka Manajemen User (`super_admin` lama hanya compatibility actor)
-> route guard memastikan role boleh akses
-> form membuat user internal
-> backend trusted / Cloud Functions membuat akun Auth jika strategi itu dipilih
-> system_users/{authUid} dibuat/diupdate dengan role dan status
-> user baru login dengan username/password internal
```

Batasan role:
- `administrator` boleh membuat/mengelola role aktif `administrator` dan `user`.
- `super_admin` lama hanya compatibility actor sampai dimigrasikan.
- Role `super_admin` tidak boleh dibuat sebagai role baru.
- `user` tidak boleh membuka Manajemen User.

### Collection profile role yang disarankan

```text
system_users/{uid}
-> authUid
-> username
-> usernameLower
-> displayName
-> role: administrator | user (`super_admin` hanya legacy compatibility)
-> status: active | inactive
-> createdAt / updatedAt
-> createdBy / updatedBy
-> lastLoginAt
-> mustChangePassword (opsional)
```

Larangan integrasi:
- Jangan simpan password plaintext di Firestore.
- Jangan simpan secret Firebase/Admin SDK di frontend.
- Jangan validasi password dari Firestore di frontend untuk production.
- Jangan gunakan email asli sebagai identitas utama user.

### Access control layer

| Layer | Tanggung jawab | Catatan guard |
|---|---|---|
| Login/Auth | Memastikan user punya sesi valid. | Belum ada pada source saat Fase A. |
| `system_users` profile | Menentukan role dan status active/inactive. | User tidak boleh update role/status sendiri. |
| Route guard | Mencegah akses langsung dari URL. | Wajib untuk Reset & Maintenance dan Manajemen User. |
| Sidebar/menu guard | Menampilkan menu sesuai role. | Hide menu tidak cukup tanpa route guard. |
| Firestore Rules | Security final data. | Wajib sebelum data real production. |

### Integrasi Reset & Maintenance

```text
Reset & Maintenance
-> hanya muncul untuk administrator (`super_admin` lama ikut compatibility)
-> route langsung ditolak untuk user
-> tetap memakai preview dan konfirmasi RESET
-> tetap melindungi Supplier dan master data protected
```

### Catatan functions legacy

`functions/index.js` tidak boleh langsung dipakai untuk Auth sebelum audit. Jika Cloud Functions diperlukan untuk create user atau custom token, gunakan fase terpisah dan pastikan trigger stok legacy tidak ikut aktif tanpa validasi.

### Fase implementasi target

1. Fase A - Access Matrix + docs only.
2. Fase B - Auth foundation.
3. Fase C - Route guard.
4. Fase D - Sidebar/menu guard.
5. Fase E - User Management.
6. Fase F - Firestore Rules/Auth alignment.
7. Fase G - Cleanup kecil terkait Auth.
8. Fase H - Docs final sync.


---

## Integration Map Auth Foundation Fase B — 2026-04-28

### Flow login aktif Fase B
```text
Login.jsx
→ useAuth().loginWithUsername(username, password)
→ AuthProvider build username@ims-bunga-flanel.local
→ Firebase Auth Email/Password
→ onAuthStateChanged
→ Firestore system_users/{uid}
→ validasi status active + role valid
→ App.jsx membuka AppLayout
→ AppHeader menampilkan user/role + logout
```

### Collection profile internal
```text
system_users/{uid}
```

Field minimal yang dibaca AuthProvider:
- `authUid`
- `username`
- `displayName`
- `role`
- `status`

Role valid aktif:
- `administrator`
- `user`

Role legacy compatibility:
- `super_admin`

Status valid:
- `active`

### Boundary integrasi
- **AKTIF:** Firebase Auth menjadi sumber session login.
- **AKTIF:** Firestore `system_users` menjadi sumber profile/role/status.
- **GUARDED:** Firestore Rules final belum diselaraskan pada Fase B.
- **GUARDED:** Sidebar/menu filtering dan route guard per role belum dibuat pada Fase B.
- **GUARDED:** User Management belum dibuat pada Fase B.
- **LEGACY/GUARDED:** `functions/index.js` lama tidak menjadi bagian flow Auth Foundation.

### Dampak ke flow bisnis
Auth Foundation hanya menentukan boleh/tidaknya app utama terbuka. Patch ini tidak mengubah:
- Purchases
- Returns
- Sales
- Stock Management / Stock Adjustment
- Supplier business rule
- Production
- Payroll
- HPP
- Reports/export
---

## Integration Map Sidebar/Menu Guard Fase D — 2026-04-28

### Flow menu aktif Fase D
```text
AuthProvider
→ profile system_users/{uid}
→ role user aktif
→ SidebarMenu.jsx
→ filterSidebarMenuItemsByRole(sidebarMenuItems, role)
→ menu tampil sesuai allowedRoles
```

### Flow route guard sinkron
```text
User membuka route
→ AppRoutes.jsx
→ ProtectedRoute routeKey
→ roleAccess.canAccessRoute(routeKey, role)
→ route tampil atau Unauthorized
```

### Boundary integrasi
- **AKTIF:** `sidebarMenu.js` menyimpan metadata `allowedRoles`.
- **AKTIF:** `roleAccess.js` menyimpan role constants, route access matrix, dan helper filter menu.
- **AKTIF:** `SidebarMenu.jsx` hanya render menu yang lolos role filter.
- **AKTIF:** `ProtectedRoute` menjaga URL langsung agar tidak bypass menu.
- **GUARDED:** Hide menu bukan security final; Firestore Rules final tetap fase terpisah.
- **GUARDED:** User Management belum ada.
- **GUARDED:** Reset & Maintenance hanya Administrator; `super_admin` lama ikut legacy compatibility.

### Dampak ke flow bisnis
Fase D hanya memengaruhi navigasi dan akses route. Patch ini tidak mengubah:
- Purchases
- Returns
- Sales
- Stock Management / Stock Adjustment
- Supplier business rule
- Production
- Payroll
- HPP
- Reports/export
- Firebase Rules final

---

## Integration Map Final Auth/Role/User Management Fase E-H — 2026-04-28

### Flow login dan profile aktif
```text
Login.jsx
→ useAuth().loginWithUsername(username, password)
→ Firebase Auth Email/Password internal alias
→ AuthProvider onAuthStateChanged
→ Firestore system_users/{uid}
→ cek role/status
→ AppLayout / Login blocked state
```

### Flow Manajemen User aktif
```text
UserManagement.jsx
-> useAuth().profile sebagai actor
-> userService.createSystemUserWithAuth()
-> HTTP Cloud Function createSystemUser
-> Firebase Admin SDK createUser()
-> Firebase Auth menghasilkan uid otomatis
-> Cloud Function membuat Firestore system_users/{uid}
-> AuthProvider membaca profile saat user login/refresh
```

### Flow route/menu guard
```text
AuthProvider profile.role
→ roleAccess.js
→ SidebarMenu filter menu
→ AppRoutes ProtectedRoute
→ halaman tampil atau Unauthorized
```

### Flow Firestore Rules/Auth alignment
```text
Firebase Auth request.auth.uid
→ Firestore Rules get system_users/{uid}
→ status harus active
→ role menentukan akses system_users dan data aplikasi
```

### Boundary integrasi
- **AKTIF:** Firebase Auth tetap sumber session/password.
- **AKTIF:** `system_users` menjadi sumber profile, role, dan status.
- **AKTIF:** User Management mengelola create Auth user via Cloud Function serta profile/role/status.
- **AKTIF:** `roleAccess.js` menjadi single source of truth untuk role/menu/route/user-management guard.
- **AKTIF:** Cloud Function `createSystemUser` membuat Auth UID otomatis dan profile `system_users/{uid}`.
- **GUARDED:** Firestore Rules tetap harus dipublish manual dan diuji.
- **LEGACY/GUARDED:** `functions/index.js` stok lama tidak boleh ikut dideploy untuk flow Auth tanpa audit.

### Dampak ke flow bisnis
Fase E-H hanya memengaruhi akses user dan security boundary. Patch ini tidak mengubah:
- Purchases
- Returns
- Sales
- Stock Management / Stock Adjustment
- Supplier business rule
- Production
- Payroll
- HPP
- Reports/export


---

## Integration Map Auth UID Otomatis via Cloud Functions - 2026-04-29

### Flow create user aktif

```text
Administrator / super_admin legacy
-> UserManagement.jsx submit Tambah Profile User
-> userService.createSystemUserWithAuth(values, actorProfile)
-> HTTP fetch createSystemUser dengan Authorization Bearer Firebase ID token
-> Cloud Function request.auth.uid
-> baca system_users/{actorUid}
-> validasi actor active + role
-> Firebase Admin SDK auth.createUser()
-> dapat uid otomatis
-> Firestore create system_users/{uid}
-> return authUid + profile
-> frontend refresh tabel user
```

### Flow login setelah user dibuat

```text
Login.jsx username/password
-> AuthProvider build username@ims-bunga-flanel.local
-> Firebase Auth signInWithEmailAndPassword
-> AuthProvider onAuthStateChanged
-> Firestore system_users/{uid}
-> cek status active + role valid
-> AppLayout / route guard
```

### Boundary data
- Firebase Auth menyimpan password/session.
- `system_users/{uid}` menyimpan profile/role/status.
- Cloud Function menyimpan audit `createdBy` dan `updatedBy` memakai actor UID.
- Password sementara tidak masuk Firestore.
- Admin SDK hanya berada di folder `functions`.

### Boundary non-Auth
- Tidak ada perubahan integrasi stok.
- Tidak ada perubahan integrasi purchases/sales/returns.
- Tidak ada perubahan integrasi production/payroll/HPP.
- Tidak ada perubahan reports/dashboard/pricing/reset maintenance.
- Offline database tetap boundary desain, belum diimplementasikan.
---

## Integration Map Penyederhanaan Role Aktif - 2026-04-29

### Flow role aktif
```text
Firestore system_users/{uid}.role
-> AuthProvider cek role valid
-> roleAccess.js mengenali:
   - administrator = role admin aktif utama
   - user = role operasional terbatas
   - super_admin = legacy compatibility sementara
-> SidebarMenu filter allowedRoles
-> ProtectedRoute cek routeKey
-> halaman tampil atau Unauthorized
```

### Flow create user setelah penyederhanaan
```text
Administrator
-> UserManagement Tambah Profile User
-> pilih role Administrator atau User
-> userService.createSystemUserWithAuth()
-> Cloud Function createSystemUser
-> validasi role target hanya administrator/user
-> Firebase Auth createUser
-> Firestore system_users/{uid}
```

### Boundary legacy
- `super_admin` tidak tampil sebagai pilihan baru di UI.
- `super_admin` tidak diterima sebagai role target Cloud Function.
- User lama dengan `role = super_admin` tetap diberi akses setara Administrator agar tidak terkunci.
- Migration manual yang disarankan: ubah profile lama `super_admin` menjadi `administrator` setelah akses owner aman.

## Integration Map Fix CORS Callable createSystemUser - 2026-04-29

```text
UserManagement.jsx
-> userService.createSystemUserWithAuth()
-> fetch POST createSystemUser HTTP endpoint
-> Cloud Function v2 onRequest createSystemUser
-> runtime options: region us-central1 + CORS allowlist + public invoker
-> request.auth.uid guard
-> system_users/{actorUid} guard
-> Firebase Admin SDK createUser()
-> Firestore system_users/{newUid}
```

Catatan guard:
- **AKTIF:** frontend memakai fetch HTTP dengan Authorization Bearer Firebase ID token.
- **AKTIF:** CORS di-handle oleh opsi function, bukan middleware Express.
- **GUARDED:** role target tetap hanya `administrator` dan `user`; `super_admin` hanya legacy actor compatibility.
- **KANDIDAT CLEANUP:** jika nanti region function dipindah dari `us-central1`, update `src/firebase.js` menjadi `getFunctions(app, "region-baru")` dan update docs ini.

## Integration Map createSystemUser HTTP CORS Fix — 2026-04-29

Status: **AKTIF + GUARDED**.

```text
UserManagement.jsx
-> userService.createSystemUserWithAuth(values, actorProfile)
-> auth.currentUser.getIdToken()
-> fetch POST https://us-central1-{projectId}.cloudfunctions.net/createSystemUser
-> Authorization: Bearer <Firebase ID token>
-> Cloud Function onRequest createSystemUser
-> OPTIONS preflight dijawab dengan CORS header untuk localhost/production
-> Admin SDK verifyIdToken()
-> baca system_users/{actorUid}
-> validasi role/status actor
-> Admin SDK createUser()
-> Firestore create system_users/{newUid}
-> response data kembali ke frontend
```

Catatan guard:
- Endpoint HTTP ini menggantikan pemanggilan callable untuk flow create user karena environment terbaru masih gagal di preflight callable.
- Security utama tetap Firebase ID token + profile `system_users`, bukan hanya CORS.

## Integration Map Follow-up createSystemUser CORS Runtime Option - 2026-04-29

```text
UserManagement.jsx
-> userService.createSystemUserWithAuth(values, actorProfile)
-> fetch POST https://us-central1-{projectId}.cloudfunctions.net/createSystemUser
-> Authorization: Bearer Firebase ID token
-> Cloud Function v2 onRequest createSystemUser
-> runtime option cors: HTTP_CORS_ORIGINS
-> manual OPTIONS/header fallback
-> verifyIdToken()
-> read actor profile system_users/{uid}
-> create Firebase Auth user
-> create Firestore profile system_users/{newUid}
```

- **AKTIF:** CORS allowlist meliputi localhost/127.0.0.1 untuk development, Firebase Hosting, dan GitHub Pages origin `https://vyo15.github.io`.
- **GUARDED:** Security utama tetap Firebase ID token + profile `system_users`, bukan CORS allowlist saja.
- **LEGACY:** `super_admin` hanya actor compatibility untuk data lama dan tidak boleh menjadi target role baru.
