# TEST CHECKLIST — IMS Bunga Flanel

Status: **AKTIF / SOURCE-VERIFIED / SQLITE-FIRST**.

Checklist ini adalah checklist aktif untuk source terbaru. Checklist lama yang mengarah ke runtime lama tidak dipakai lagi untuk QA aktif.

## 1. Setup dan run

```bash
npm install
npm run dev
```

Jika menjalankan terpisah:

```bash
cd backend
npm install
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

## 2. Backend health dan status

- [ ] `GET /health` sukses.
- [ ] `GET /api` menampilkan endpoint resmi.
- [ ] `GET /api/maintenance/status` menampilkan path database, schema version, backup policy, dan jumlah module runtime status.
- [ ] `GET /api/module-runtime-status` sukses dan menampilkan summary modul.
- [ ] `GET /api/migration-status` tetap berfungsi sebagai alias compatibility.
- [ ] Backend log tidak menunjukkan error migrasi.

## 3. Auth dan user management

- [ ] Login admin lokal berhasil.
- [ ] Login password salah ditolak.
- [ ] `/api/auth/me` mengembalikan user lokal aktif.
- [ ] Tambah user lokal berhasil sesuai role yang diizinkan.
- [ ] Update status user tidak boleh melewati role guard.
- [ ] User non-admin tidak bisa mengelola user lain.
- [ ] Logout membersihkan session/token lokal di frontend.

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

- [ ] Return terkait sale yang valid.
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
- [ ] Docs tidak mengarahkan patch baru ke runtime lama.
- [ ] Docs guarded area tetap melindungi stock, sales, purchases, returns, finance, production, payroll, HPP, auth, backup/restore, reset, route/menu, role guard, dan audit log.
- [ ] Jika source berubah, docs terkait ikut diperbarui dalam patch yang sama.
