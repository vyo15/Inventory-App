# TEST CHECKLIST — IMS Bunga Flanel

Status: **AKTIF / SOURCE-VERIFIED / SQLITE-FIRST**.

Checklist ini adalah checklist aktif untuk source terbaru. Checklist lama yang mengarah ke runtime arsip tidak dipakai lagi untuk QA aktif.

## 1. Setup dan run

```bash
npm install
npm test
npm run dev
```

Jika menjalankan terpisah:

```bash
cd backend
npm install
npm run check
npm test
npm run dev
```

```bash
cd frontend
npm install
npm run lint
npm run build
npm run dev -- --host 0.0.0.0
```

Target default:

- Backend: `http://localhost:3001`
- Frontend: `http://localhost:5173/Inventory-App/`

## 1A. Automated backend regression

Jalankan dari root:

```bash
npm test
```

Atau dari folder backend:

```bash
npm run test
```

Coverage aktif saat ini:

- Rate limit login: percobaan gagal keenam per IP ditolak `429`; login sukses tidak menghabiskan kuota kegagalan.
- Auth service: bootstrap, login/session, password salah, user nonaktif, dan last active administrator guard.
- Stock engine: stok minus ditolak, varian wajib valid, serta sinkronisasi master/read model/inventory log/audit log.
- Transaction atomicity: purchase + expense/ledger, rollback seluruh sale jika salah satu item gagal, dan income sale idempotent saat status menjadi `Selesai`.
- Finance ledger: cash-in, invalid cash-out rollback, serta soft-delete cash-out dan ledger pasangannya.
- Return guard: `relatedSaleId` wajib dan qty retur kumulatif tidak boleh melebihi sisa qty sales.
- SQLite concurrency: dua transaction paralel diproses FIFO, read menunggu commit, rollback tidak meracuni queue, dan context selesai tidak melewati serialisasi.
- Maintenance data tools: audit read-only, stock read model rebuild, orphan cleanup keyword, pre-repair backup, transaction, dan audit log.
- Platform hardening: security headers, structured logger rotation, OpenAPI contract, Node runtime guard, common-password rejection, dan finance manual duplicate guard.
- Business code counter: dua preview yang sama tetap menghasilkan code/ID unik saat create final, baseline historis dihormati, serta Purchase/Cash In tanpa kode memakai sequence tanggal yang aman.
- Auth concurrency: dua perubahan admin paralel tetap menyisakan satu administrator aktif.
- Password policy: maksimum 128 karakter aktif pada backend dan frontend shared policy.

Test memakai database SQLite temporary di folder sistem dan tidak menunjuk ke database operasional `data/`.

## 1A.1 Concurrent write dan runtime counter

- [ ] `backend/test/dbConnectionQueue.mock.test.js` lulus tanpa native SQLite: FIFO transaction, blocked read, dan queue recovery.
- [ ] Queue status menampilkan depth/active/slow/error tanpa payload bisnis; slow callback tidak menghentikan queue berikutnya.
- [ ] `backend/test/maintenanceDataTools.test.js` lulus: audit read-only, rebuild projection dengan pre-repair backup, keyword cleanup orphan, dan master stock tidak berubah.
- [ ] Import backup dengan audit failure me-rollback `backup_logs` dan menghapus file import.
- [ ] Cash manual duplicate ditolak, sedangkan posting system source tetap idempotent.
- [ ] Soft-delete kas tidak menonaktifkan ledger lain yang kebetulan memakai `source_id` sama tetapi `source_type` berbeda.
- [ ] Security headers dan OpenAPI administrator-only lulus automated test.
- [ ] Structured logger menghasilkan JSONL, size rotation, dan retention tanpa membuat request gagal saat file write bermasalah.
- [ ] `backend/test/sqliteConcurrentWrites.test.js` lulus pada PC project dengan native `sqlite3` terpasang.
- [ ] Dua Cash In paralel tanpa kode menghasilkan dua `CSH-IN-DDMMYYYY-xxx` unik dan dua ledger.
- [ ] Dua Purchase paralel tanpa kode menghasilkan dua `PUR-DDMMYYYY-xxx`, stok bertambah tepat, expense/ledger tidak duplikat.
- [ ] Dua Customer/Pricing Rule dengan preview sama mendapat code/ID final berbeda dari response server.
- [ ] Read request yang datang saat transaction aktif baru selesai setelah commit/rollback.
- [ ] Satu callback gagal/rollback tidak membatalkan transaction lain dan operasi berikutnya tetap dapat commit.
- [ ] Backup/restore tidak dijalankan bersamaan dengan write operasional; restore guard dan rollback file tetap lulus.

## 1B. Tooling dan line-ending regression

- [ ] `npm --prefix backend run check:syntax` memeriksa `backend/src`, `backend/test`, dan `backend/scripts`.
- [ ] `npm --prefix backend run lint` lulus tanpa unused variable/import atau duplicate import.
- [ ] `npm --prefix backend run check` menjalankan syntax check lalu ESLint.
- [ ] `npm --prefix frontend run lint` lulus dengan browser globals hanya untuk `frontend/src`.
- [ ] File `*.js`, `*.jsx`, `*.cjs`, dan `*.mjs` memakai LF tanpa CRLF/mixed EOL.
- [ ] `.gitattributes` dan `.editorconfig` tetap memiliki aturan LF untuk empat ekstensi JavaScript tersebut.
- [ ] Normalisasi EOL tidak membawa perubahan logic; verifikasi diff dengan mengabaikan whitespace sebelum merge.
- [ ] `git ls-files --eol` menunjukkan index `i/lf` untuk file JavaScript yang ter-track.

## 2. Backend health dan status

- [ ] `GET /health` sukses.
- [ ] `GET /api` hanya menampilkan info public minimal, bukan daftar endpoint penuh/detail lokal.
- [ ] `GET /api/maintenance/status` tanpa token ditolak; dengan token administrator menampilkan path database, schema version, backup policy, dan jumlah status modul.
- [ ] `GET /api/module-runtime-status` tanpa token ditolak; dengan token administrator sukses dan menampilkan summary modul.
- [ ] `GET /api/migration-status` tetap berfungsi sebagai alias compatibility dengan proteksi administrator yang sama.
- [ ] Backend log tidak menunjukkan error migrasi.

## 3. Auth dan user management

- [ ] Login admin lokal berhasil.
- [ ] Login password salah ditolak.
- [ ] Setelah 5 login gagal dari IP yang sama dalam 60 detik, percobaan berikutnya ditolak `429 AUTH_RATE_LIMITED`.
- [ ] Login berhasil tidak menghabiskan kuota kegagalan rate limit.
- [ ] `/api/auth/me` mengembalikan user lokal aktif.
- [ ] Tambah user lokal berhasil sesuai role yang diizinkan.
- [ ] Update status user tidak boleh melewati role guard.
- [ ] User non-admin tidak bisa mengelola user lain.
- [ ] Logout membersihkan session/token lokal di frontend.

## 3A. Role alignment operasional harian

- [ ] Login sebagai `user` bisa membuka Stock Management, Purchases, Sales, Returns, Production Planning, Production Orders, dan Production Work Logs.
- [ ] `user` bisa commit Purchase dan stok bertambah dengan inventory log/audit tetap tercatat.
- [ ] `user` bisa commit Sales dan stok berkurang; update status Sales ke selesai tetap membuat income idempotent sesuai rule backend.
- [ ] `user` bisa commit Return terkait Sales dan stok kembali sesuai item yang valid.
- [ ] `user` bisa commit Stock Adjustment lewat endpoint resmi; adjustment keluar tetap ditolak jika melebihi available stock.
- [ ] `user` bisa create/update Production Planning, Production Orders, dan Production Work Logs.
- [ ] `user` tetap ditolak untuk User Management, Maintenance/Reset, Backup/Restore, Module Runtime Status, halaman master/setup, Pricing Rules, Cash In/Out manual, ledger, reports sensitif, Payroll, dan HPP Analysis.
- [ ] Dashboard `user` tidak memanggil endpoint finance/payroll, tidak menampilkan KPI/aksi Administrator-only, dan tidak memiliki link kartu yang berakhir di Unauthorized.
- [ ] Link stok Dashboard untuk `user` menuju Stock Management; tombol `Bandingkan Supplier` hanya terlihat bila route Supplier diizinkan.
- [ ] GET `/api/finance/incomes`, `/api/finance/expenses`, `/api/finance/ledger`, `/api/reports`, dan `/api/production/payrolls` mengembalikan `403 FORBIDDEN` untuk role `user`.
- [ ] GET `/api/production/planning`, `/api/production/orders`, dan `/api/production/work-logs` tetap `200` untuk role `user`.
- [ ] Administrator tetap dapat membaca endpoint sensitif tersebut.
- [ ] Role frontend `roleAccess.js` dan backend guard endpoint operasional harian tetap selaras.

## 4. Master data

- [ ] Categories CRUD berjalan lewat backend.
- [ ] Customers CRUD berjalan lewat backend dan generate code tetap manusiawi.
- [ ] Suppliers CRUD berjalan lewat backend dan histori restock/purchase tidak rusak.
- [ ] Products CRUD tidak mengubah stock mutation secara langsung.
- [ ] Raw Materials CRUD menjaga unit, modal, dan relasi supplier.
- [ ] Semi Finished CRUD menjaga varian dan stok produksi.
- [ ] Pricing Rules tidak memindahkan formula ke UI component.
- [x] Automated guard: stale edit Product ditolak dan tidak mengembalikan stok/HPP lama.
- [x] Automated guard: payload edit dengan top-level/variant stock palsu dipreserve dari database terbaru.
- [x] Automated guard: hapus/nonaktif varian berstok ditolak; zero-stock diarsipkan; varian baru mulai stok 0.
- [x] Automated guard: Raw Material `averageActualUnitCost` dan Semi Finished production cost tidak dapat ditimpa dari edit metadata.
- [x] Automated guard: update tanpa `expectedVersion`, delete master berstok/archived stock legacy, dan direct write `stock_read_models` ditolak.
- [x] Static/backend guard: response sukses create/update/delete transactional dikirim setelah `COMMIT`, bukan dari dalam callback transaction.
- [ ] Manual UI: HPP Product, modal aktual Raw Material, dan average/last production cost Semi Finished read-only saat edit tetapi tetap dapat diisi saat create.
- [ ] Manual concurrency: buka drawer edit di perangkat A, lakukan transaksi stok di perangkat B, lalu pastikan Simpan di A menampilkan konflik data dan tidak menutup/mengubah stok.
- [ ] Manual Pricing Rule: apply harga setelah item berubah di proses lain harus berhenti dengan pesan conflict dan tidak mengirim field stok/HPP.
- [x] Automated Stock Engine: `variants: []` pada item non-varian tetap memakai bucket master.
- [x] Automated compatibility: `variants: []` tidak menutupi `variantOptions` legacy yang berisi data pada Product, Raw Material, Semi Finished, dan Stock Read Model.
- [x] Automated variant identity: payload create/update yang mereferensikan bucket varian sama lebih dari sekali ditolak.
- [x] Automated Stock Engine: stock-out master dan varian ditolak bila melebihi `availableStock` meskipun `currentStock` masih cukup.
- [x] Automated variant invariant: nested `availableStock` dinormalisasi dan create bervarian tanpa varian aktif ditolak.
- [x] Automated inactive policy: mutation normal menolak master/varian nonaktif; restore archived variant hanya melalui override internal return historis.
- [x] Automated Pricing Rule: batch apply atomic rollback seluruh perubahan bila satu item stale.
- [ ] Manual Pricing Rule SQLite: apply dua atau lebih item berhasil sekaligus dan audit `apply_batch` tercatat satu kali.

## 5. Stock

- [ ] Stock read model tampil tanpa technical ID.
- [ ] Stock adjustment masuk/keluar wajib melalui endpoint commit resmi.
- [ ] Item bervarian wajib memilih varian.
- [ ] Adjustment keluar tidak boleh melebihi available stock.
- [ ] Inventory log tercatat dengan referensi manusiawi.
- [ ] Tidak ada double mutation pada current/reserved/available stock.

## 6. Purchases

- [ ] Purchase commit menambah stok sesuai item target.
- [ ] Purchase commit membuat audit log.
- [ ] Expense/finance side effect tercatat sesuai aturan backend.
- [ ] OCR/parser tidak membuat catatan dobel.
- [ ] Supplier/product/raw relation tetap aman.

## 7. Sales

- [ ] Create sale memvalidasi available stock.
- [ ] Multi-line item sama digabung sebelum validasi stok.
- [ ] Status aktif hanya `Diproses`, `Dikirim`, dan `Selesai`.
- [ ] Tidak ada tombol cancel/delete sales user-facing.
- [ ] Income hanya mengikuti aturan status final yang sudah ditentukan.
- [ ] Barang kembali hanya lewat Return.

## 8. Returns

- [ ] Form Return wajib memilih transaksi Sales.
- [ ] Dropdown item Return hanya berisi item dari Sales yang dipilih.
- [ ] Backend menolak Return tanpa `relatedSaleId`.
- [ ] Backend menolak item Return yang tidak ada di Sales terkait.
- [ ] Backend menolak qty Return yang melebihi qty terjual dikurangi qty yang sudah pernah diretur.
- [ ] Return stock restore berjalan lewat endpoint resmi.
- [ ] Audit log return tercatat.
- [ ] Refund/finance tetap mengikuti guard backend.
- [ ] Return tidak membuat sales cancel/delete tersembunyi.

## 9. Finance dan reports

- [ ] Cash In manual berjalan dan muncul di ledger/report.
- [ ] Cash Out manual berjalan dan muncul di ledger/report.
- [ ] Expense otomatis dari purchase/payroll tidak dobel.
- [ ] Profit/Loss membaca data final, bukan draft.
- [ ] Sales Report, Purchases Report, Stock Report, Payroll Report, dan Profit/Loss bisa dibuka.
- [ ] Export tidak menampilkan object mentah atau ID teknis.

## 10. Production, payroll, dan HPP

- [ ] Production Steps CRUD aman.
- [ ] Production Employees CRUD aman.
- [ ] Production Profiles/BOM membaca kebutuhan material benar.
- [ ] Planning tidak mengubah stok/payroll/HPP langsung.
- [ ] Production Order start menghitung kebutuhan material dengan guard stok.
- [ ] Work Log completed mencatat material actual.
- [ ] Payroll final/paid menjadi dasar labor actual.
- [ ] HPP final tidak memakai payroll draft sebagai final.
- [ ] Posting payroll paid ke finance tidak dobel.

## 11. Maintenance, backup, restore

- [ ] Database Center menampilkan status backend SQLite.
- [ ] Module Runtime Status tampil dan summary masuk akal.
- [ ] Backup manual berhasil dan masuk riwayat.
- [ ] Backup otomatis harian tidak membuat error startup.
- [ ] Restore plan menampilkan preview sebelum execute.
- [ ] Restore execute wajib keyword confirm.
- [ ] Restore membuat pre-restore backup.
- [ ] Restore gagal aman jika backup tidak valid.
- [ ] Jika migrasi, validasi database aktif, atau pencatatan restore gagal setelah swap, database sebelum restore otomatis dikembalikan dan audit `restore_rollback` tercatat.
- [ ] Reset testing lama tetap nonaktif/redirect lama.

## 12. UI/UX regression

- [ ] Light mode terbaca.
- [ ] Dark mode terbaca.
- [ ] Desktop `>= 1200px` menampilkan floating dock; active icon dan marker tetap seluruhnya berada di dalam rail.
- [ ] Desktop `993-1199px` dan viewport tinggi pendek menampilkan dock compact tanpa icon keluar/overlap.
- [ ] Klik top-level multi-halaman membuka Module Hub tanpa submenu pop-up; modul satu halaman langsung membuka halaman tujuan.
- [ ] Module Hub hanya menampilkan child route yang diizinkan role aktif dan section kosong tidak ikut dirender.
- [ ] Active state dock tetap benar saat berada di hub route, halaman child, maupun direct module satu halaman.
- [ ] `/inventory` melakukan redirect role-guarded ke `/inventory/stock-management`, sedangkan `/production` tetap membuka Production Workspace. Exact hub lama `/stock` dan `/produksi` tidak dihidupkan kembali; hanya child route legacy terdaftar yang redirect melalui guard yang sama.
- [ ] Role `user` tidak melihat Module Hub Master Data, Finance, Sistem, Laporan, Production Setup, Payroll, atau HPP.
- [ ] Tablet `768-992px` menampilkan tombol menu + Drawer kiri; bottom navigation tidak tampil.
- [ ] Mobile `<= 767px` menampilkan bottom navigation Dashboard, Stok, Menu, Transaksi, dan Produksi.
- [ ] Tombol tengah hanya membuka bottom sheet menu, bukan create/mutation/destructive action.
- [ ] Bottom sheet role-aware: Administrator melihat seluruh modul; `user` hanya melihat modul operasional.
- [ ] Pilih modul menutup bottom sheet lalu membuka Module Hub atau halaman direct sesuai jumlah halaman modul.
- [ ] Mobile 360x640, 390x844, dan 430x932 tidak horizontal scroll body untuk list utama.
- [ ] Halaman paling bawah, pagination, action footer, modal, dan Drawer tidak tertutup bottom navigation.
- [ ] Theme toggle telepon berada di bottom sheet; FloatButton theme tidak bertabrakan dengan bottom navigation.
- [ ] Desktop tetap rapi dan compact.
- [ ] Empty state jelas.
- [ ] Loading state jelas.
- [ ] Error state tidak white screen.
- [ ] Technical ID tidak tampil di UI utama, drawer, tooltip, report, atau export.
- [ ] ZIP hasil `npm run clean:zip:ps` lulus `npm run verify:zip -- ../<nama-source-clean>.zip` dan tidak membawa `data/`, `backups/`, database, backup, `node_modules`, `dist`, atau path backslash.


## 12A. Cross-device responsive QA

- [ ] Desktop `1440x900` dan `1920x1080`: content tetap maksimum `1560px` dan tidak terlalu melebar.
- [ ] Laptop `1366x768`: dock, header, Page Header, action, dan tabel tidak overlap.
- [ ] Desktop pendek `1280x600` dan `1280x720`: dock low-height aktif dan semua icon tetap berada di dalam rail.
- [ ] Desktop compact `1024x768`: dock compact atau fallback sesuai breakpoint tetap usable.
- [ ] Tablet portrait `768x1024` dan `820x1180`: Drawer kiri terbuka, scroll menu bekerja, bottom navigation tersembunyi.
- [ ] Tablet landscape `1024x768`: fallback width-based tidak memotong content atau action.
- [ ] Telepon `390x844` dan `430x932`: bottom navigation, center Menu, bottom sheet, dan safe area tampil benar.
- [ ] Telepon kecil `360x640` / `<=374px`: label bottom nav tidak tabrakan dan Module Hub menjadi 1 kolom bila dibutuhkan.
- [ ] Mobile landscape contoh `844x390`: fallback berdasarkan viewport tetap usable tanpa body horizontal scroll.
- [ ] Bottom sheet tertutup setelah navigasi dan active route berpindah dengan benar.
- [ ] Administrator/User menerima menu, card Module Hub, dan shortcut yang sesuai role.
- [ ] Theme toggle tidak mengubah ukuran/posisi dock, Drawer, bottom nav, bottom sheet, atau safe padding.
- [ ] Virtual keyboard tidak membuat action form penting tidak dapat dijangkau.
- [ ] Modal, confirm dialog, form Drawer, detail Drawer, Select, DatePicker, dropdown, dan notification tampil di atas bottom navigation.
- [ ] Loading, empty, error, data banyak, nama panjang, dan nilai Rupiah panjang diuji pada minimal satu page per kategori.
- [ ] Body/shell telepon tidak horizontal scroll; scroll horizontal hanya boleh lokal pada table wrapper yang memang disengaja.
- [ ] Handler action desktop/tablet/mobile tetap memakai callback existing dan tidak melewati confirm/status/role guard.

Referensi detail: `docs/21_RESPONSIVE_UI_UX_STANDARD.md`.

## 13. Docs anti-regression

- [ ] Docs menyatakan SQLite/backend sebagai runtime utama.
- [ ] Docs tidak mengarahkan patch baru ke runtime arsip.
- [ ] Docs guarded area tetap melindungi stock, sales, purchases, returns, finance, production, payroll, HPP, auth, backup/restore, reset, route/menu, role guard, dan audit log.
- [ ] Jika source berubah, docs terkait ikut diperbarui dalam patch yang sama.
- [ ] GitHub Actions menjalankan source hygiene, backend check/test, frontend test/lint/build, dan bundle budget pada push/PR.
- [ ] `npm run check:runtime` lulus pada Node `>=22.12.0 <23`; `.nvmrc`, `.node-version`, package engines, dan CI selaras.
- [ ] Pada Node di luar rentang dukungan, `npm run dev`, `npm --prefix backend test`, `npm --prefix frontend build`, dan `npm run git:check:full` berhenti sebelum menjalankan proses aplikasi/test/build.
- [ ] Frontend build tidak menampilkan circular manual-chunk warning dan `npm run check:bundle` melaporkan chunk terbesar di bawah budget.
- [ ] Frontend Audit Data hanya menampilkan subset read-only nyata; Repair Aman hanya menampilkan projection stok yang didukung backend.
- [ ] `npm test` dan `npm --prefix frontend run test:coverage` lulus sebelum merge.
- [ ] CI mengunggah `frontend/coverage/coverage-summary.json` dan CycloneDX SBOM backend/frontend sebagai evidence.
- [ ] Setelah koneksi database ditutup/dibuka kembali atau restore, baseline business-code counter diverifikasi ulang sebelum kode berikutnya dialokasikan.

## 14. P8A–P12 regression

- [ ] Default backend menolak Bearer legacy; saat compatibility diaktifkan eksplisit, `/api/auth/me` membuat cookie HttpOnly dan audit `legacy_bearer_migrated`.
- [ ] Request Bearer berulang dari session yang sama tidak membuat audit migrasi duplikat.
- [ ] Maintenance status menampilkan total, tujuh hari terakhir, dan timestamp migrasi Bearer tanpa otomatis menyatakan semua perangkat siap.
- [ ] `IMS_AUTH_ALLOW_LEGACY_BEARER=false` tetap menerima cookie dan menolak Bearer; `true` hanya dipakai sementara untuk migrasi.
- [ ] `backend/package.json` memakai `node scripts/run-tests.cjs`, bukan daftar file test manual.
- [ ] Backend dependency audit lockfile tidak memiliki vulnerability aktif.
- [ ] Frontend lockfile tidak memuat registry internal dan tidak lagi membawa `@ant-design/charts`.
- [ ] Purchase/Sales/Return frontend test memastikan commit endpoint resmi dan validation guard tetap aktif.
- [ ] Production adapter dan service test memastikan Start/Complete/Payroll lifecycle memakai endpoint atomic resmi.
- [ ] Completion Work Log mengirim Good Qty/operator/catatan dalam satu request complete tanpa direct update pendahuluan.
- [ ] Restore frontend test memastikan preview dan execute guarded memakai cookie credentials.
- [ ] Adapter XLSX test memastikan jalur aktif hanya menulis workbook dari data internal.
- [ ] `npm run check:bundle` lulus setelah frontend build.
- [ ] `IMS_FRONTEND_MAX_JS_BYTES` non-numerik, nol, atau pecahan ditolak oleh bundle guard.
- [ ] Tidak ada import/usage tersisa ke `productionCodeGenerator.js` setelah file dihapus.
