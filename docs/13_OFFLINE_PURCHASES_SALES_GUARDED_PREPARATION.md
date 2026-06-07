<!--
PATCH A-B NOTE — 2026-06-02:
Dokumen ini adalah arsip historis Batch offline database browser lama. Source aktif sekarang memakai SQLite sidecar lewat backend Node.js lokal/LAN. Jangan mengikuti instruksi runtime database browser lama, sync queue lama, conflict resolver, atau backup JSON storage browser lama dari dokumen arsip ini. Kontrak terbaru ada di docs/10_OFFLINE_DATABASE_CONTRACT.md dan docs/17_SQLITE_OFFLINE_WEB_ROADMAP.md.
-->

# Offline Purchases & Sales Guarded Preparation — Batch 34–37

Status: **ARSIP HISTORIS / SUPERSEDED BY SQLITE RUNTIME / JANGAN DIPAKAI SEBAGAI INSTRUKSI AKTIF**.

Tanggal validasi: 2026-05-30

Dokumen ini menutup Fase 4 persiapan Purchases dan Sales untuk offline database. Scope batch ini hanya audit, kontrak field, dan konsep Draft Offline yang aman. Tidak ada runtime migration, tidak ada perubahan schema database lama/storage browser lama, tidak ada table draft baru, tidak ada stock/finance mutation offline, dan tidak ada perubahan route/menu/role guard.

## 1. Validasi source aktual

ZIP yang divalidasi: `Inventory-App-clean.zip`.

File source yang benar-benar dicek:

- `src/pages/Transaksi/Purchases.jsx`
- `src/services/Transaksi/purchasesService.js`
- `src/utils/purchases/shopeePurchaseOcrParser.js`
- `src/utils/purchases/purchaseNoteDisplay.js`
- `src/pages/Transaksi/Sales.jsx`
- `src/services/Transaksi/salesService.js`
- `src/services/Transaksi/salesCustomerReferenceService.js`
- `src/services/Transaksi/returnsService.js`
- `src/services/Inventory/inventoryLogService.js`
- `src/services/Inventory/stockReadModelService.js`
- `src/services/Finance/moneyMovementLedgerService.js`
- `src/services/Laporan/reportsService.js`
- `src/pages/Laporan/PurchasesReport.jsx`
- `src/pages/Laporan/SalesReport.jsx`
- `src/services/Dashboard/dashboardService.js`
- `src/pages/Dashboard/Dashboard.jsx`
- `src/data/local/localDbSchema.js`
- `src/data/local/imsLocalDb.js`
- `src/data/sync/syncQueueService.js`
- `src/pages/Utilities/components/OfflineDatabaseCenter.jsx`

File relevan yang tidak ditemukan pada source aktual:

- Tidak ditemukan `purchasesRepository.js` / `salesRepository.js` runtime.
- Tidak ditemukan database browser lama adapter khusus `purchases` atau `sales`.
- Tidak ditemukan table lokal `purchase_drafts`, `sales_drafts`, `purchases`, atau `sales` di `LOCAL_DB_TABLES`.
- Tidak ditemukan allowlist `purchases` atau `sales` di `LOCAL_SYNC_COLLECTIONS`.
- Tidak ditemukan flow edit/delete Purchase aktif dari service transaksi.
- Tidak ditemukan flow delete/cancel Sales user-facing; Sales hanya punya create dan status transition aktif.

Batasan validasi:

- Audit ini static source review dari ZIP frontend, bukan inspeksi data database lama production.
- rules database lama/index tidak ada di ZIP dan harus dicek manual di runtime lama Console jika nanti Purchases/Sales draft atau commit online diubah.
- Tidak ada test runtime browser karena batch ini docs/contract only.

## 2. Validasi docs vs source

Docs existing yang dicek:

- `docs/10_OFFLINE_DATABASE_CONTRACT.md`
- `docs/11_OFFLINE_SUPPLIER_FLOW_AUDIT.md`
- `docs/12_OFFLINE_PRODUCTS_RAW_SEMI_CONTRACT.md`
- `docs/06_TEST_CHECKLIST.md`
- `docs/08_INTEGRATION_MAP.md`

Keselarasan source dengan docs existing:

- Docs sudah menyatakan transaksi/stock/finance belum boleh masuk sync offline awal. Source menguatkan ini karena `LOCAL_SYNC_COLLECTIONS` hanya berisi `categories` dan `customers`, sementara supplier hanya snapshot read-only.
- Docs sudah menyatakan supplier belum boleh dipakai write offline. Source Sales sudah punya guard lebih ketat: Sales customer reference dibaca dari runtime lama-primary lewat `salesCustomerReferenceService`, bukan dari customer local-only.
- Docs belum punya kontrak detail khusus Purchases/Sales Draft Offline; dokumen ini menambahkan kontrak Batch 34–37 tanpa mengubah runtime.

Konflik docs vs source yang perlu dicatat:

- Istilah `Offline` di Sales saat ini adalah `salesChannel: "Offline"` untuk transaksi toko/offline channel, bukan offline database mode. Jangan disamakan dengan `offline_local` database browser lama.
- Istilah `purchaseType: "offline"` di Purchases saat ini berarti pembelian non-marketplace/tanpa ongkir-voucher online, bukan local/offline database draft.

## 3. Batch 34 — Purchases Audit

### 3.1 Purchase integration map aktual

```text
Purchases.jsx
-> user isi form / OCR apply ke form saja
-> createPurchaseTransaction(values, products, materials, suppliers)
-> database lama runTransaction
   -> reserve/generate PUR-DDMMYYYY-001
   -> validate supplier dari daftar supplier aktif
   -> validate item product/raw material dari transaksi database lama snapshot
   -> validate varian bila item bervarian
   -> calculate subtotal/ongkir/diskon/voucher/service fee/actual unit cost
   -> update stock product/raw material
   -> update stock_item_read_models dalam transaction yang sama
   -> set purchases/{PUR-*}
   -> set inventory_logs/{logId} type purchase_in
   -> set expenses/{purchases__PUR-*}
-> report/ledger/dashboard membaca output final
```

### 3.2 Source of truth Purchases

| Area | Source of truth aktual | Catatan offline |
|---|---|---|
| Purchase final | `purchases/{PUR-*}` | runtime lama-only sampai commit online dirancang |
| Stock masuk | `products` / `raw_materials` via transaksi database lama | Tidak boleh offline mutation |
| Stock audit | `inventory_logs` type `purchase_in` | Wajib dibuat bersama purchase final |
| Stock read model | `stock_item_read_models` | Derived/cache, bukan source of truth |
| Finance cash out | `expenses/{purchases__PUR-*}` | Tidak boleh dibuat dari draft offline |
| Supplier relation | supplier list yang dipakai form dan service | Supplier local snapshot belum boleh jadi source transaksi |
| OCR | parser Shopee apply ke form/note | OCR bukan transaksi dan tidak boleh commit otomatis |
| Report pembelian | `expenses` dengan `sourceModule: purchases` atau type pembelian | Draft offline tidak masuk report final |
| Ledger cash out | `expenses` saja | Jangan baca `purchases` mentah agar tidak double count |
| Dashboard restock | `purchases` lookup ringan + stock read model | Dashboard tetap read-only |

### 3.3 Field contract Purchase final yang tidak boleh dipalsukan offline

Purchase final wajib menjaga field berikut saat commit runtime lama:

| Field | Wajib | Keterangan |
|---|---|---|
| `purchaseNumber` / `code` / `referenceNumber` / `sourceRef` | Ya | Kode bisnis `PUR-DDMMYYYY-001`, sebaiknya document ID final |
| `type` | Ya | `product` atau `material` |
| `itemId`, `itemName` | Ya | Snapshot item final yang divalidasi ulang dari runtime lama |
| `variantKey`, `variantLabel`, `stockSourceType` | Wajib jika item bervarian | Mencegah stok masuk ke master/default yang salah |
| `supplierId`, `supplierName` | Ya | Harus berasal dari supplier runtime lama/resolved supplier aktif |
| `quantity` | Ya | Qty beli sebelum konversi |
| `totalStockIn` | Ya | Qty stok masuk setelah konversi |
| `purchaseUnit`, `stockUnit`, `conversionValue` | Wajib untuk material | Konversi supplier → stok |
| `subtotalItems`, `shippingCost`, `shippingDiscount`, `voucherDiscount`, `serviceFee` | Ya | Dasar total aktual pembelian |
| `totalActualPurchase`, `actualUnitCost` | Ya | Dasar expense dan modal aktual |
| `restockReferencePrice`, `totalReferencePurchase`, `purchaseSaving` | Opsional/monitoring | Untuk efisiensi/restock assistant |
| `purchaseTransactionStatus` | Ya | Saat ini final memakai `committed` |
| `date`, `createdAt` | Ya | Date transaksi dan created timestamp |
| `note` | Opsional | Note manual/OCR yang sudah direview user |

Companion documents final:

| Collection | Field minimum |
|---|---|
| `inventory_logs` | `type: purchase_in`, `itemId`, `itemName`, `quantityChange`, `collectionName`, `referenceType: purchase`, `referenceNumber/sourceRef`, `supplierName`, `unit/stockUnit`, variant metadata, cost metadata |
| `expenses` | `type: Pembelian Bahan/Barang`, `amount`, `sourceModule: purchases`, `sourceId`, `sourceRef`, `sourceType: auto_generated`, `createdByAutomation: true`, supplier/item/variant metadata |
| `stock_item_read_models` | Ditulis ulang dalam transaction/batch stock writer, tidak boleh jadi satu-satunya bukti stok |

### 3.4 Purchase offline feasibility report

Keputusan: **belum layak purchase final offline**.

Alasan:

1. Purchase final menulis minimal empat area sekaligus: `purchases`, stock item master, `inventory_logs`, dan `expenses`.
2. Supplier relation belum write-safe offline dan supplier local hanya snapshot read-only.
3. Raw material/product bervarian membutuhkan validasi stok/variant shape dari runtime lama saat commit.
4. Actual unit cost mempengaruhi average cost/HPP; retry sync yang tidak idempotent bisa membuat modal dan expense dobel.
5. OCR dapat salah baca multi-item, voucher, ongkir, atau total; source saat ini benar karena OCR hanya mengisi form dan tetap butuh Simpan Pembelian.
6. Report pembelian dan cash ledger membaca `expenses`, sehingga draft offline tidak boleh ikut report final.

Yang boleh pada tahap berikutnya:

- Menyimpan **Offline Purchase Draft** lokal sebagai dokumen kerja sementara.
- Draft boleh menyimpan snapshot input, hasil OCR, note, dan status review.
- Draft boleh ditampilkan di menu khusus draft/review saat online kembali.
- Draft boleh dipakai untuk prefill form commit online.

Yang tidak boleh:

- Direct stock in offline.
- Direct cash out/expense offline.
- Direct purchase final offline.
- Menulis `inventory_logs` offline sebagai final.
- Menulis `stock_item_read_models` dari draft.
- Memasukkan draft ke Purchase Report, Profit Loss, Cash Out, Dashboard cash, atau Stock Report final.

## 4. Batch 35 — Purchases Draft Offline Concept

### 4.1 Konsep aman

```text
User offline
-> buat Purchase Draft lokal
-> simpan input pembelian + OCR parsed data + note review
-> status draft: local_draft / needs_review
-> tidak mengubah stok
-> tidak membuat expense
-> tidak membuat inventory log final
-> tidak masuk report final

Saat online
-> user buka review draft
-> system re-fetch supplier + item + variant + stock/cost terbaru dari runtime lama
-> user review perbedaan
-> user klik Commit Purchase
-> createPurchaseTransaction existing berjalan runtime lama transaction
-> draft ditandai committed setelah sukses
```

### 4.2 Field contract Offline Purchase Draft

Catatan: field ini adalah **kontrak konsep**, belum dibuat table pada batch ini.

| Field | Fungsi |
|---|---|
| `id` | Local draft ID, bukan `PUR-*` final kecuali commit sukses |
| `draftType` | `purchase_draft` |
| `draftStatus` | `local_draft`, `needs_review`, `ready_to_commit`, `committing`, `committed`, `failed`, `discarded` |
| `createdAt`, `updatedAt`, `localUpdatedAt` | Audit lokal draft |
| `createdBy`, `deviceId` | Trace lokal jika multi-device nanti aktif |
| `purchaseType` | Online/offline channel pembelian aktual, bukan offline database mode |
| `type`, `itemId`, `itemNameSnapshot` | Product/material dan snapshot pilihan user |
| `variantKey`, `variantLabelSnapshot`, `stockSourceType` | Snapshot varian saat draft dibuat |
| `supplierId`, `supplierNameSnapshot` | Snapshot supplier; wajib revalidate saat commit |
| `quantity`, `purchaseUnit`, `stockUnit`, `conversionValue` | Input qty/konversi |
| `subtotalItems`, `shippingCost`, `shippingDiscount`, `voucherDiscount`, `serviceFee` | Input biaya |
| `totalActualPurchasePreview`, `actualUnitCostPreview` | Preview lokal, bukan final accounting |
| `ocrRawText`, `ocrParsed`, `ocrReviewStatus`, `ocrAutoApplyBlocked` | Metadata OCR untuk review |
| `note` | Catatan user/OCR compact |
| `commitCandidatePayload` | Payload form yang akan dikirim ke service existing setelah revalidate |
| `commitResult` | `{ purchaseId, purchaseNumber }` setelah sukses |
| `discardReason` | Alasan draft dibuang |

### 4.3 Commit gate wajib

Sebelum draft menjadi purchase final, sistem harus:

1. Re-fetch supplier dari runtime lama dan pastikan supplier masih aktif/valid.
2. Re-fetch product/raw material dari runtime lama transaction snapshot.
3. Revalidasi variant key/label dan stock source type.
4. Rehitung conversion value, total stock in, total aktual, actual unit cost, saving metadata.
5. Generate `PUR-*` hanya saat commit online, bukan saat draft dibuat.
6. Menjalankan `createPurchaseTransaction()` existing atau service commit yang mempertahankan atomic write setara.
7. Menandai draft committed hanya setelah transaction runtime lama sukses.

## 5. Batch 36 — Sales Audit

### 5.1 Sales integration map aktual

```text
Sales.jsx
-> load products/raw_materials for sellable items
-> load customer via salesCustomerReferenceService (runtime lama-primary)
-> user isi form
-> buildSaleLine dengan guard availableStock UI cache
-> validateSaleStockAvailability dari runtime lama
-> createSaleTransaction
   -> database lama runTransaction
   -> reserve/generate ORD-DDMMYYYY-001
   -> revalidate stock item/variant dari transaction snapshot
   -> set sales/{ORD-*}
   -> stock out product/raw_material
   -> set stock_item_read_models
   -> set inventory_logs type sale
   -> jika status final Selesai: set incomes/{sales__ORD-*}
-> status Diproses/Dikirim bisa diubah sampai Selesai lewat updateSaleStatusTransaction
-> Return adalah flow resmi untuk barang kembali/stok masuk
```

### 5.2 Source of truth Sales

| Area | Source of truth aktual | Catatan offline |
|---|---|---|
| Sales final | `sales/{ORD-*}` | runtime lama-only sampai commit online dirancang |
| Customer reference | `salesCustomerReferenceService` → `customersService` runtime lama-primary | Customer local-only tidak boleh dipakai transaksi |
| Sellable item | `products` / `raw_materials` | Harus revalidate saat commit |
| Stock keluar | master stock product/raw material via transaction | Tidak boleh offline mutation |
| Stock audit | `inventory_logs` type `sale` | Wajib dibuat bersama sale final |
| Income final | `incomes/{sales__ORD-*}` hanya saat status `Selesai` | Tidak boleh dibuat dari draft |
| Status aktif | `Diproses`, `Dikirim`, `Selesai` | No cancel user-facing |
| Return relation | `returns` stock-only correction | Koreksi barang kembali lewat Return, bukan cancel Sales |
| Sales report | `sales` read-only | Draft offline tidak masuk report final |
| Dashboard sales KPI | `sales` monitoring, cash resmi dari `incomes/revenues` | Jangan double count cash |

### 5.3 Field contract Sales final yang tidak boleh dipalsukan offline

| Field | Wajib | Keterangan |
|---|---|---|
| `saleNumber` / `code` / `referenceNumber` / `sourceRef` | Ya | Kode bisnis `ORD-DDMMYYYY-001`, document ID final |
| `items[]` | Ya | Snapshot line item final |
| `items[].itemId`, `itemName`, `quantity`, `pricePerUnit`, `subtotal` | Ya | Dasar stock out dan omzet |
| `items[].collectionName` | Ya | `products` atau `raw_materials` |
| `items[].variantKey`, `variantLabel`, `stockSourceType` | Wajib jika bervarian | Mencegah stok keluar dari bucket salah |
| `items[].unit` | Ya | Tampilan dan audit stok |
| `salesChannel` | Ya | Channel transaksi; `Offline` di sini berarti channel toko, bukan database browser lama mode |
| `status` | Ya | `Diproses`, `Dikirim`, atau `Selesai` |
| `customerId`, `customerName`, customer snapshot | Opsional/bersyarat | Harus dari runtime lama-primary bila dipilih |
| `totalAmount` / nilai total penjualan | Ya | Dasar monitoring/income |
| `referenceNumber` marketplace/resi | Opsional | Hanya untuk channel yang mendukung reference |
| `note` | Opsional | Catatan transaksi |
| `date`, `createdAt`, `updatedAt` | Ya | Audit waktu transaksi |

Companion documents final:

| Collection | Field minimum |
|---|---|
| `inventory_logs` | `type: sale`, item, qty negatif/stock out, collection, reference sale, unit, variant metadata |
| `incomes` | Dibuat hanya untuk Sales `Selesai`, dengan `sourceModule/sourceId/sourceRef` sale |
| `stock_item_read_models` | Derived read model yang sinkron dengan master stock setelah mutation |
| `returns` | Jika barang kembali, return membuat stock correction terpisah; tidak mengubah sales menjadi cancel |

### 5.4 Sales offline feasibility report

Keputusan: **belum layak sales final offline**.

Alasan:

1. Sales final langsung mengurangi stock dan dapat membuat income final.
2. Stock availability harus divalidasi dari data terbaru agar tidak oversell.
3. Customer local-only belum boleh dipakai sebagai foreign reference transaksi runtime lama.
4. Status flow aktif punya efek finance saat masuk `Selesai`; retry sync bisa membuat income dobel bila tidak idempotent.
5. Return adalah koreksi stock resmi; offline final/cancel sales bisa membuka jalur bypass Return.
6. Dashboard dan report membaca sales/incomes terpisah; draft offline tidak boleh bercampur dengan angka final.

Yang boleh pada tahap berikutnya:

- Menyimpan **Offline Sales Draft** lokal sebagai dokumen kerja sementara.
- Draft boleh menyimpan snapshot customer/item/price/note untuk review.
- Draft boleh menghitung total estimasi lokal sebagai preview.
- Saat online, draft wajib revalidate stock dan customer sebelum commit.

Yang tidak boleh:

- Sales final offline.
- Stock out offline.
- Income offline final.
- Menggunakan customer local-only untuk sales final runtime lama.
- Masuk Sales Report/Cash In/Profit Loss/Dashboard cash sebagai transaksi final.

## 6. Batch 37 — Sales Draft Offline Concept

### 6.1 Konsep aman

```text
User offline
-> buat Sales Draft lokal
-> simpan customer/item/qty/harga/note snapshot
-> preview total lokal
-> tidak mengurangi stok
-> tidak membuat income
-> tidak masuk report final

Saat online
-> re-fetch customer runtime lama-primary jika customerId terisi
-> re-fetch product/raw material + variant terbaru
-> revalidate availableStock terbaru
-> user review perbedaan harga/stok/customer
-> user klik Commit Sales
-> createSaleTransaction existing berjalan runtime lama transaction
-> draft ditandai committed setelah sukses
```

### 6.2 Field contract Offline Sales Draft

Catatan: field ini adalah **kontrak konsep**, belum dibuat table pada batch ini.

| Field | Fungsi |
|---|---|
| `id` | Local draft ID, bukan `ORD-*` final kecuali commit sukses |
| `draftType` | `sales_draft` |
| `draftStatus` | `local_draft`, `needs_review`, `ready_to_commit`, `committing`, `committed`, `failed`, `discarded` |
| `createdAt`, `updatedAt`, `localUpdatedAt` | Audit lokal draft |
| `createdBy`, `deviceId` | Trace lokal jika multi-device nanti aktif |
| `customerId`, `customerNameSnapshot`, `customerSource` | `customerSource` harus `primary lama` jika dipakai untuk commit final |
| `salesChannel` | Channel transaksi; jangan disamakan dengan offline DB mode |
| `requestedStatus` | `Diproses`/`Dikirim`/`Selesai` request user; final divalidasi saat commit |
| `items[]` | Snapshot line item draft |
| `items[].itemId`, `itemNameSnapshot`, `collectionName` | Identitas item draft |
| `items[].variantKey`, `variantLabelSnapshot`, `stockSourceType` | Snapshot varian draft |
| `items[].quantity`, `pricePerUnit`, `subtotalPreview`, `unit` | Input dan preview total |
| `availableStockSnapshot` | Informasi terakhir untuk user, bukan guard final |
| `totalSaleValuePreview` | Preview lokal, bukan income final |
| `referenceNumber`, `note` | Input opsional |
| `commitCandidatePayload` | Payload form untuk service existing setelah revalidate |
| `commitResult` | `{ saleId, saleNumber }` setelah sukses |
| `discardReason` | Alasan draft dibuang |

### 6.3 Commit gate wajib

Sebelum draft menjadi sales final, sistem harus:

1. Re-fetch customer dari runtime lama-primary jika customer dipilih.
2. Menolak customer dengan `customerSource !== primary lama` untuk commit final.
3. Re-fetch product/raw material dan variant dari runtime lama transaction snapshot.
4. Revalidasi stock availability untuk semua line.
5. Rehitung total sale value dari payload final.
6. Generate `ORD-*` hanya saat commit online.
7. Menjalankan `createSaleTransaction()` existing atau service commit yang menjaga atomic write setara.
8. Menandai draft committed hanya setelah transaction runtime lama sukses.

## 7. Risiko double mutation dan guard idempotency

Risiko utama bila Purchases/Sales final dipaksa offline:

| Risiko | Dampak |
|---|---|
| Retry purchase commit tanpa idempotency | Stock masuk dobel, expense dobel, inventory log dobel |
| Retry sales commit tanpa idempotency | Stock keluar dobel, income dobel, inventory log dobel |
| Draft memakai ID final terlalu awal | Bentrok sequence/kode bisnis saat online |
| Customer/supplier local-only dipakai transaksi | Foreign reference runtime lama putus |
| Variant berubah saat offline | Stock masuk/keluar ke bucket salah |
| Report membaca draft | Omzet, cash, HPP, dan stock report salah |
| Auto conflict resolver untuk transaksi | Data final bisa overwrite tanpa audit manual |

Guard wajib sebelum runtime draft diimplementasikan:

- Draft lokal harus punya namespace/table terpisah dari collection final.
- Draft tidak boleh masuk `sync queue lama` final otomatis.
- Commit harus user-reviewed dan online-only.
- Commit harus punya idempotency key bila nanti dibuat queue commit.
- Untuk V1, lebih aman draft tidak auto-sync; user klik commit satu per satu.
- Draft committed tidak boleh bisa dikomit ulang.
- Discard draft tidak boleh menghapus transaksi final yang sudah committed.
- Conflict transaksi harus manual review, bukan auto overwrite.

## 8. Keputusan akhir Fase 4

- Batch 34 Purchases Audit: **selesai sebagai audit/contract**.
- Batch 35 Purchases Draft Offline Concept: **selesai sebagai konsep guarded**.
- Batch 36 Sales Audit: **selesai sebagai audit/contract**.
- Batch 37 Sales Draft Offline Concept: **selesai sebagai konsep guarded**.
- Tidak ada runtime migration.
- Tidak ada schema storage browser lama/database lama baru.
- Tidak ada route/menu/role guard baru.
- Tidak ada mutasi stock/finance/report offline.
- Keputusan awal tetap: **Purchases/Sales final mutation tetap runtime lama-only**.

## 9. Gate sebelum implementasi draft runtime berikutnya

Sebelum batch runtime draft dibuat, wajib ada approval terpisah untuk:

1. Nama table lokal draft, misalnya `purchase_drafts` dan `sales_drafts`.
2. Upgrade database browser lama schema version dan backup/restore scope baru.
3. UI lokasi draft review: apakah di Offline Database Center atau page transaksi masing-masing.
4. Permission/role guard draft bila nanti user non-admin boleh memakai.
5. Commit service design: direct commit from draft vs queue manual commit.
6. Idempotency key dan manual conflict resolution.
7. Test data migration policy: tidak ada migrasi runtime otomatis untuk data existing.

## 10. Test checklist Fase 4

- [ ] Buat Purchase online normal; pastikan `purchases`, stock, `inventory_logs`, `stock_item_read_models`, dan `expenses` tetap terbentuk.
- [ ] Purchase OCR apply hanya mengisi form/note, belum membuat transaksi sampai klik Simpan Pembelian.
- [ ] Purchase dengan item bervarian wajib memilih varian.
- [ ] Purchase Report tetap membaca `expenses`, bukan draft/local data.
- [ ] Cash ledger tetap membaca `expenses` untuk pembelian, bukan `purchases` mentah.
- [ ] Buat Sales `Diproses`; pastikan stock keluar dan income belum masuk jika status belum `Selesai` sesuai rule service aktual.
- [ ] Ubah Sales `Diproses -> Dikirim -> Selesai`; pastikan income dibuat satu kali.
- [ ] Sales customer dropdown tetap runtime lama-primary; customer local-only tidak muncul/dipakai transaksi.
- [ ] Return tetap jalur resmi stock correction, bukan cancel Sales.
- [ ] `LOCAL_SYNC_COLLECTIONS` tetap hanya pilot master data; tidak ada `purchases`, `sales`, `inventory_logs`, `expenses`, atau `incomes`.
- [ ] Offline Database Center tidak menawarkan push/pull transaksi final.
- [ ] Draft offline masa depan tidak muncul di report/dashboard/ledger final sebelum commit online sukses.

## Update C6 SQLite Transaction Foundation

Endpoint foundation baru:

```text
/api/transactions/purchases
/api/transactions/sales
/api/transactions/returns
```

Status: guarded storage foundation.

Yang belum boleh:

- Purchase final langsung menambah stok atau expense dari draft SQLite.
- Sales final langsung mengurangi stok atau membuat income dari draft SQLite.
- Returns final langsung restore stok/refund dari draft SQLite.
- Menganggap data transaksi lokal sebagai laporan final sebelum commit/rekonsiliasi audited.
