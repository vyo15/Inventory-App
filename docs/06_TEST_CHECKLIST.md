# TEST CHECKLIST — IMS Bunga Flanel

Status: **AKTIF / SOURCE-VERIFIED / SQLITE-FIRST**.

Checklist ini adalah checklist aktif untuk source terbaru. Checklist lama yang mengarah ke runtime arsip tidak dipakai lagi untuk QA aktif.

## 1. Setup dan run

```bash
npm run install:all
npm test
npm run dev
```

Jika menjalankan terpisah:

```bash
cd backend
npm install
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

## 1A. Automated backend dan frontend regression

Jalankan dari root:

```bash
npm test
```

Atau jalankan terpisah:

```bash
npm --prefix backend test
npm --prefix frontend test
```

Coverage aktif saat ini:

- Rate limit login: percobaan gagal keenam per IP ditolak `429`; login sukses tidak menghabiskan kuota kegagalan.
- Auth route aktual: login mengirim cookie `HttpOnly`, JSON tidak membawa raw token, `/me` menerima cookie, logout revoke session, Bearer lama termigrasi menjadi cookie, dan compatibility dapat dinonaktifkan tanpa memutus cookie session.
- Bootstrap guard: endpoint status tidak membocorkan kode; setup admin pertama wajib kode dari terminal backend.
- CORS: hostname frontend/backend yang sama di port berbeda diizinkan; origin asing ditolak.
- Auth service: login/session, password salah, user nonaktif, dan last active administrator guard.
- Stock engine: stok minus ditolak, varian wajib valid, serta sinkronisasi master/read model/inventory log/audit log.
- Transaction atomicity: purchase + expense/ledger, rollback seluruh sale jika salah satu item gagal, dan income sale idempotent saat status menjadi `Selesai`.
- Finance ledger: cash-in, invalid cash-out rollback, serta soft-delete cash-out dan ledger pasangannya.
- Return guard: `relatedSaleId` wajib dan qty retur kumulatif tidak boleh melebihi sisa qty sales.
- Role access guard: role `user` ditolak membaca finance, report, dan Payroll; Planning, Production Orders, dan Work Logs tetap operasional; Administrator tetap dapat membaca endpoint sensitif.
- Production Planning atomic: create PO + update Planning satu transaction, rollback bila update Planning gagal, cancel guard, dan target PO tidak dapat dioverride dari payload client.
- Production Work Log atomic: Start memotong seluruh material dan membuat satu Work Log; material kedua gagal me-rollback semua; step harus berasal dari BOM; Complete menambah output, membuat payroll, menghitung HPP, dan menutup PO satu kali.
- Production payload/lifecycle guard: snapshot material, output, cost, relasi, status, serta field finance tidak dapat ditulis langsung melalui generic CRUD atau payload Complete.
- Production Payroll atomic: Paid membuat expense + ledger satu kali, mengenali expense compatibility legacy, mereconcile HPP, dan me-rollback payroll/HPP bila finance gagal.
- Backup/restore: package + manifest + checksum, daily idempotency, preview-only plan, confirm guard, pre-restore backup, restore log/audit, corrupt backup rejection, dan import filename sanitization.
- Source hygiene: runtime artifact ter-track ditolak, `data/` dan `backups/` benar-benar hilang dari `git archive`, serta script clean ZIP wajib menjalankan source readiness sebelum `git archive HEAD`.
- Frontend auth dan role: cookie-first service, migrasi Bearer lama, ProtectedRoute, route access matrix, Dashboard role-aware, bootstrap UI, serta perbedaan error backend mati dan credential invalid.

Baseline automated test setelah P5-P7: **15 file / 59 test backend** dan **5 file / 17 test frontend**, seluruhnya lulus.

Test backend memakai database SQLite temporary di folder sistem dan tidak menunjuk ke database operasional `data/`. Test frontend memakai environment `jsdom` dan tidak mengakses backend/database nyata.

## 2. Backend health dan status

- [ ] `GET /health` sukses.
- [ ] `GET /api` hanya menampilkan info public minimal, bukan daftar endpoint penuh/detail lokal.
- [ ] `GET /api/maintenance/status` tanpa token ditolak; dengan token administrator menampilkan path database, schema version, backup policy, dan jumlah status modul.
- [ ] `GET /api/module-runtime-status` tanpa token ditolak; dengan token administrator sukses dan menampilkan summary modul.
- [ ] `GET /api/migration-status` tetap berfungsi sebagai alias compatibility dengan proteksi administrator yang sama.
- [ ] Backend log tidak menunjukkan error migrasi.

## 3. Auth dan user management

- [ ] Saat database belum memiliki admin, kode setup hanya tampil di terminal backend dan tidak muncul pada `GET /api/auth/status`.
- [ ] Bootstrap dengan kode salah ditolak; kode terminal yang benar hanya dapat dipakai sebelum admin aktif tersedia.
- [ ] Login admin lokal berhasil dan response JSON tidak membawa raw session token.
- [ ] Browser menerima cookie `ims_session` dengan atribut `HttpOnly`, `SameSite=Lax`, dan `Path=/`.
- [ ] Key legacy `ims.sqlite.authToken` dibersihkan dari `localStorage` setelah login atau migrasi `/api/auth/me` berhasil.
- [ ] Login password salah ditolak.
- [ ] Setelah 5 login gagal dari IP yang sama dalam 60 detik, percobaan berikutnya ditolak `429 AUTH_RATE_LIMITED`.
- [ ] Login berhasil tidak menghabiskan kuota kegagalan rate limit.
- [ ] `/api/auth/me` mengembalikan user lokal aktif menggunakan cookie.
- [ ] Session Bearer lama masih diterima sementara dan response `/api/auth/me` membuat cookie migrasi.
- [ ] Setelah semua perangkat login ulang, set `IMS_AUTH_ALLOW_LEGACY_BEARER=false`, restart backend, lalu pastikan cookie login tetap sukses dan Bearer lama ditolak `401`.
- [ ] Origin frontend dengan hostname yang sama seperti backend diterima; origin asing mendapat `403 CORS_ORIGIN_FORBIDDEN`.
- [ ] Tambah user lokal berhasil sesuai role yang diizinkan.
- [ ] Update status user tidak boleh melewati role guard.
- [ ] User non-admin tidak bisa mengelola user lain.
- [ ] Logout revoke session SQLite, menghapus cookie, dan membersihkan cache user/token legacy frontend.

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
- [ ] Create PO dari Planning menyimpan PO dan relasi/status Planning secara atomic; kegagalan salah satu write tidak meninggalkan PO parsial.
- [ ] Target, target type, target item, dan requirement PO selalu mengikuti BOM; payload client yang berbeda ditolak.
- [ ] Planning yang sudah punya PO tidak dapat dibatalkan atau diubah relasi PO-nya melalui generic update.
- [ ] Production Order start menghitung kebutuhan material dengan guard stok, memotong seluruh line dalam satu transaction, membuat satu Work Log, dan menolak start kedua.
- [ ] Step Start Production wajib merupakan step yang terdaftar pada BOM.
- [ ] Jika salah satu material tidak valid/kurang, material sebelumnya, inventory log, Work Log, audit, dan status PO seluruhnya rollback.
- [ ] Generic update tidak dapat menulis `workLogId`, timestamp lifecycle, atau mengubah status PO menjadi `in_production/completed`.
- [ ] Work Log dari PO mengunci snapshot material, output, target, step, dan cost setelah Start; edit operator/catatan tetap berjalan.
- [ ] Work Log Complete hanya menerima Good Qty/operator/catatan dan mengabaikan payload client yang mencoba mengganti snapshot material/output/HPP.
- [ ] Work Log completed menambah output, membuat payroll draft per operator, mencatat material actual/accrued labor/overhead, menutup PO, dan menulis audit satu kali.
- [ ] Complete kedua ditolak dan tidak menambah stok/payroll/inventory log ulang.
- [ ] Kegagalan output me-rollback payroll dan status Complete tanpa mengulang material yang sudah sah dipotong saat Start.
- [ ] Payroll baru melalui generic create hanya boleh `draft` + `unpaid` dan tidak boleh membawa field finance/paid.
- [ ] Manual payroll dengan kombinasi Work Log + Step + Operator yang sudah memiliki payroll ditolak agar tidak membuat line dobel.
- [ ] Payroll confirmed/paid hanya lewat endpoint finalize/mark-paid Administrator.
- [ ] Payroll final/paid mereconcile labor/HPP tanpa menambah qty output ulang.
- [ ] Posting payroll paid membuat expense + ledger satu kali dan mengenali expense legacy dengan source payroll yang sama.
- [ ] Kegagalan expense/ledger me-rollback status payroll, HPP Work Log, dan cost master output.
- [ ] HPP output accrued tidak material-only saat payroll draft otomatis sudah terbentuk; payroll final menjadi adjustment akhir bila nominal berubah.

## 11. Maintenance, backup, restore

Automated coverage aktif untuk pembuatan/validasi backup, daily idempotency, restore preview/confirm/pre-restore/rollback safety, corrupt backup, import sanitization, dan source ZIP hygiene. Checklist manual berikut tetap wajib untuk UI serta perangkat operasional:

- [ ] Database Center menampilkan status backend SQLite.
- [ ] Module Runtime Status tampil dan summary masuk akal.
- [ ] Backup manual berhasil dan masuk riwayat.
- [ ] Backup otomatis harian tidak membuat error startup.
- [ ] Restore plan menampilkan preview sebelum execute.
- [ ] Restore execute wajib keyword confirm.
- [ ] Restore membuat pre-restore backup.
- [ ] Restore gagal aman jika backup tidak valid.
- [ ] Reset testing lama tetap nonaktif/redirect lama.

## 12. UI/UX regression

- [ ] Light mode terbaca.
- [ ] Dark mode terbaca.
- [ ] Mobile 360x640 tidak horizontal scroll body untuk list utama.
- [ ] Desktop tetap rapi dan compact.
- [ ] Empty state jelas.
- [ ] Loading state jelas.
- [ ] Error state tidak white screen.
- [ ] Technical ID tidak tampil di UI utama, drawer, tooltip, report, atau export.

## 13. Docs anti-regression

- [ ] Docs menyatakan SQLite/backend sebagai runtime utama.
- [ ] Docs tidak mengarahkan patch baru ke runtime arsip.
- [ ] Docs guarded area tetap melindungi stock, sales, purchases, returns, finance, production, payroll, HPP, auth, backup/restore, reset, route/menu, role guard, dan audit log.
- [ ] Jika source berubah, docs terkait ikut diperbarui dalam patch yang sama.
- [ ] `npm test` lulus sebelum merge; coverage yang belum otomatis tetap diuji manual.
- [ ] `npm run check` menjalankan test backend + frontend, backend syntax check, frontend lint, dan frontend production build.
- [ ] `git check`/pre-push menjalankan automated test backend + frontend dan menolak runtime backup/database yang ter-track.
