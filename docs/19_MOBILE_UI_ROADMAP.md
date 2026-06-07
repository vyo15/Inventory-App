# IMS Mobile UI Roadmap v1.0

Dokumen ini menjadi standar kerja mobile untuk IMS Bunga Flanel. Setiap patch mobile wajib mengacu ke dokumen ini supaya perubahan UI tidak balik lagi ke pola tabel desktop di HP.

## 1. Prinsip utama

- Desktop tetap memakai tabel lengkap.
- Mobile portrait memakai card/list ringkas.
- Tidak boleh ada horizontal scroll body di HP.
- Detail panjang masuk drawer atau halaman detail.
- Form mobile wajib 1 kolom.
- Filter lanjutan masuk drawer/collapse.
- Action utama maksimal 2 tombol; action tambahan masuk menu titik tiga.
- Destructive action seperti reset, restore, delete, nonaktifkan wajib confirm.
- Patch mobile tidak boleh mengubah business logic, stock mutation, finance, production, sales, purchase, return, backup, restore, schema, atau auth.

## 2. Komponen standar

| Komponen | Fungsi | Catatan |
| --- | --- | --- |
| `DataTableView` / `ResponsiveDataView` | Desktop table, mobile card/list | Gunakan `mobileCardConfig` untuk list utama. |
| `MobileActionMenu` | Action card mobile | Maksimal 2 action utama, sisanya titik tiga. |
| `MobileDetailDrawer` | Detail lengkap mobile | Full-screen/drawer untuk detail panjang. |
| `ResponsiveFormSection` | Form mobile 1 kolom | Form panjang dipisah per section. |
| `MobileStateBlock` | Loading, empty, error state | Pesan user-friendly, bukan error mentah. |

## 3. Standar mobile card

Setiap mobile card idealnya hanya menampilkan:

1. Judul utama.
2. Kode atau referensi.
3. Status badge.
4. Maksimal 4 meta penting.
5. Maksimal 2 action utama.
6. Menu titik tiga untuk action tambahan.

Data teknis, audit, detail relasi, varian lengkap, item transaksi, dan riwayat masuk detail drawer.

## 4. Roadmap implementasi

### Phase M0 — Audit Baseline Mobile

Tujuan:
- Cek kondisi awal mobile.
- Cari horizontal scroll body, tabel lebar, modal kepotong, filter ramai, tombol dempet.
- Petakan halaman yang sudah memakai `DataTableView` dan `mobileCardConfig`.

Output:
- Daftar temuan per halaman.
- Prioritas patch.
- Checklist desktop/mobile regression.

### Phase M1 — Mobile Foundation

Scope:
- `AppLayout`: sidebar mobile menjadi drawer dan auto close setelah pilih menu.
- `AppHeader`: header ringkas dan tidak terlalu tinggi.
- `PageHeader`: action responsif.
- `FilterBar`: search tetap tampil, filter lanjutan collapse/drawer.
- `DataTableView`: desktop table, mobile card/list.
- `MobileActionMenu`, `MobileDetailDrawer`, `ResponsiveFormSection`, `MobileStateBlock`.
- CSS global mencegah overflow body tanpa menyembunyikan bug layout.

Definition of Done:
- Mobile tidak menampilkan sidebar permanen.
- Tidak perlu landscape di HP portrait.
- Desktop tetap table.
- Empty/loading/error state rapi.

### Phase M2 — Master Data Mobile

Halaman:
- Products.
- Raw Materials.
- Semi Finished Materials.
- Customers.
- Suppliers.
- Pricing Rules.

Mobile card utama:
- Nama.
- Kode.
- Kategori/status.
- Stok/minimum/harga bila relevan.
- Action detail/edit/titik tiga.

Detail drawer:
- Varian.
- Riwayat stok.
- Relasi supplier/customer.
- Pricing.
- Audit.

### Phase M3 — Inventory & Transactions

Halaman:
- Stock Management.
- Stock Adjustment.
- Purchases.
- Sales.
- Returns.

Guardrail:
- Tidak mengubah stock mutation.
- Tidak menambah sales cancel/delete.
- Return tetap jalur resmi barang kembali.
- Purchase/sales/return logic tetap dari service/backend existing.

### Phase M4 — Production, Payroll, HPP

Halaman:
- Production Profiles.
- Production BOMs.
- Production Planning.
- Production Orders.
- Production Work Logs.
- Production Payrolls.
- Production HPP Analysis.

Guardrail:
- Labor final tetap dari payroll final/paid.
- Lem tembak tetap material usage.
- Scrap/QC tidak dibuat workflow besar tanpa approval.
- Material usage dan output produksi tidak diubah oleh patch UI.

### Phase M5 — Finance, Reports, Maintenance

Halaman:
- Cash In.
- Cash Out.
- Money Movement Ledger.
- Dashboard.
- Reports.
- Offline Database Center.
- Reset Maintenance Data.

Guardrail:
- Restore/reset tetap guarded.
- Backup/restore tetap audit logged.
- Report mobile boleh summary-first; tabel lengkap boleh tetap lokal scroll atau masuk detail/export.

## 5. Aturan update docs anti-regression

Setiap patch mobile wajib update minimal salah satu dokumen berikut sesuai area yang disentuh:

- `docs/19_MOBILE_UI_ROADMAP.md` untuk standar/roadmap mobile.
- `docs/09_UI_THEME_GUIDE.md` untuk aturan visual dan komponen layout.
- `docs/06_TEST_CHECKLIST.md` untuk checklist QA mobile.
- `docs/00_MASTER_CONTEXT.md` jika ada keputusan standar baru.
- `README.md` jika cara test/preview berubah.

Patch tidak dianggap selesai jika source berubah tetapi docs tidak ikut diperbarui.

## 6. Checklist QA mobile

- HP portrait tidak perlu landscape.
- Tidak ada horizontal scroll body.
- Table besar punya mobile card/list atau scroll lokal yang disengaja.
- Search tetap mudah ditemukan.
- Filter tidak memenuhi layar.
- Tombol tambah terlihat.
- Tombol action tidak dempet.
- Form mobile 1 kolom.
- Modal panjang menjadi drawer/page.
- Detail lengkap tidak dipaksa di card.
- Empty/loading/error state rapi.
- Error mentah seperti `TypeError` tidak tampil ke user.
- Sales tetap tidak punya cancel/delete.
- Restore/reset tetap guarded.
- Desktop tidak rusak.
- Build tetap berhasil.

## 7. Preview mobile operasional

Route preview mobile lama sudah dihapus dari aplikasi operasional. Evaluasi mobile sekarang dilakukan melalui halaman bisnis asli, komponen foundation, dan screenshot QA desktop/mobile/dark mode sebelum merge visual.

## 8. Status Eksekusi Mobile Standard — 2026-06-05

Status: **M1-M5 baseline diterapkan secara UI-only** pada source aktual.

Yang sudah dikunci:

- `AppLayout` memakai mobile sidebar drawer dan auto-close setelah route berubah.
- `AppHeader`, `PageHeader`, `FilterBar`, modal, drawer, form, dan content shell diperkuat untuk portrait-first.
- `DataTableView` menjadi `ResponsiveDataView` aktif: desktop tetap table, mobile memakai card/list bila `mobileCardConfig` tersedia.
- `DataTableView` mendukung `MobileStateBlock` untuk loading/empty mobile dan siap memakai `MobileActionMenu` lewat `primaryActions` / `moreActions` untuk page baru.
- `MobileFilterDrawer` ditambahkan sebagai standar filter lanjutan mobile untuk patch berikutnya.
- Master Data, Inventory, Transactions, Production, Payroll/HPP, Finance, Reports, dan Maintenance yang sudah memakai `DataTableView + mobileCardConfig` mengikuti mode card/list di mobile.
- Tabel utility/maintenance yang masih rawan panjang mulai dipindahkan ke `DataTableView` untuk riwayat backup, data tools, auto detect, dan safe repair.
- CSS global menjaga body tidak horizontal scroll di HP portrait, namun table yang sengaja belum dikonversi tetap scroll lokal agar tidak menutup bug layout.

Guardrail yang tetap berlaku:

- Patch mobile ini tidak mengubah schema SQLite, auth, route guard, stock mutation, purchase/sales/return commit, finance ledger, production material usage, payroll final, HPP, backup/restore, atau reset testing.
- Sales tetap tidak boleh memiliki cancel/delete.
- Restore/reset tetap harus guarded dan tidak boleh dibuat shortcut mobile tanpa confirm keyword.
- Setiap phase berikutnya wajib update dokumen ini, `docs/09_UI_THEME_GUIDE.md`, dan `docs/06_TEST_CHECKLIST.md` bila ada perubahan standar/QA.

### Definition of Done tambahan setelah eksekusi M1-M5

- [ ] Buka viewport 360x640, 390x844, 430x932.
- [ ] Pastikan tidak ada horizontal scroll body pada Dashboard, Products, Raw Materials, Sales, Purchases, Returns, Stock Management, Production Work Logs, Payroll, Reports, dan Maintenance Center.
- [ ] Pastikan Desktop >=1024px tetap memakai table lengkap.
- [ ] Pastikan mobile card menampilkan judul, subtitle, status, meta utama, dan action ringkas.
- [ ] Pastikan drawer/modal/form panjang tetap satu kolom dan tidak terpotong.
- [ ] Pastikan utility/maintenance table yang kompleks scroll lokal atau tampil card, bukan membuat body overflow.

### Update tambahan M4 line section

- `components/Produksi/shared/EditableLineSection.jsx` dan `ReadonlyLineSection.jsx` sekarang memakai `DataTableView` sehingga tabel material/step/output produksi juga mendapat mobile card/list fallback.
- Default mobile card line section hanya bersifat ringkasan presentational dan tidak mengubah add/edit/delete line handler yang dikirim oleh page pemanggil.

## Update 2026-06-05 - Mobile Clean v2: Hilangkan Banner Runtime Teknis

Bagian dari Mobile Clean v2 adalah mengurangi visual noise dari halaman operasional. Banner mode database, badge teknis, tombol cepat ke pusat database, dan instruksi port/firewall tidak boleh tampil di halaman kerja harian. Mobile harus fokus pada data dan aksi utama; troubleshooting koneksi/data dipusatkan di Maintenance/Database Center.

## Update 2026-06-07 - Phase M7: Mobile Clean Real Pages

Status: **mulai diterapkan pada halaman nyata**, bukan hanya preview.

Perubahan standar:

- `FilterBar` sekarang dapat memindahkan filter lanjutan ke `MobileFilterDrawer` pada mobile. Search/filter utama tetap tampil inline, sementara filter tambahan masuk drawer bottom.
- `ProductionFilterCard` mengikuti pola yang sama untuk halaman produksi, payroll, dan HPP.
- `PageFormModal` memakai `ResponsiveFormSection` secara default agar form modal real pages ikut standar 1 kolom mobile.
- Form pembelian dan retur diberi `ResponsiveFormSection` agar input panjang lebih rapi di HP.
- Detail Pembelian dan Detail Riwayat Stok memakai `MobileDetailDrawer`, sehingga mobile tidak lagi memakai drawer desktop mentah.

Halaman yang ikut terdampak secara UI-only:

- Purchases.
- Returns.
- Stock Management.
- Cash In / Cash Out / Ledger.
- Production Work Logs.
- Production Payrolls.
- Production HPP Analysis.
- Maintenance Center dan halaman lain yang memakai `FilterBar` / `PageFormModal` shared.

Guardrail:

- Perubahan ini hanya presentational/responsive.
- Tidak mengubah schema SQLite, query service, stock mutation, purchase/sales/return commit, finance ledger, production material usage, payroll final, HPP, backup/restore, reset testing, route, atau role guard.
- Filter tetap memakai state halaman existing; tombol Terapkan di drawer hanya menutup panel karena value sudah controlled oleh halaman.

Checklist QA tambahan M7:

- [ ] Di mobile, search tetap terlihat tanpa membuka drawer.
- [ ] Filter lanjutan bisa dibuka dari tombol Filter dan tidak memenuhi layar utama.
- [ ] Detail Purchases dan Stock Management nyaman dibaca di drawer mobile.
- [ ] Form Cash In/Cash Out/Purchases/Returns tetap validasi seperti sebelumnya dan tidak terpotong.
- [ ] Work Logs, Payroll, dan HPP tetap memakai filter state lama dan hasil filter sama seperti desktop.
