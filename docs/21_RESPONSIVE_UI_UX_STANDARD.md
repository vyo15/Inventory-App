# 21 Responsive UI/UX Standard — IMS Bunga Flanel

Status: **AKTIF / SOURCE-ALIGNED / GUARDED**
Tanggal lock: **2026-06-29**

Dokumen ini menjadi rundown utama agar tampilan IMS konsisten pada desktop, laptop, tablet, telepon, viewport pendek, dan layar lebar. Standar ini tidak memakai deteksi jenis perangkat atau user-agent. Keputusan layout selalu berdasarkan **lebar dan tinggi viewport aktual**.

## 1. Source of truth aktual

Implementasi responsive aktif bersumber dari:

- `frontend/src/layouts/AppLayout.jsx`
- `frontend/src/styles/app-shell.css`
- `frontend/src/components/Layout/Page/PageContentCanvas.jsx`
- `frontend/src/components/Layout/Page/PageContentCanvas.css`
- `frontend/src/components/Layout/Navigation/DesktopModuleDock.jsx`
- `frontend/src/components/Layout/Navigation/DesktopModuleDock.css`
- `frontend/src/components/Layout/Navigation/MobileBottomNavigation.jsx`
- `frontend/src/components/Layout/Navigation/MobileBottomNavigation.css`
- `frontend/src/components/Layout/Sidebar/SidebarMenu.jsx`
- `frontend/src/components/Layout/Header/AppHeader.css`
- `frontend/src/pages/Navigation/ModuleHub.jsx`
- `frontend/src/pages/Navigation/ModuleHub.css`
- `frontend/src/config/sidebarMenu.js`
- `frontend/src/utils/navigation/sidebarNavigation.js`
- `frontend/src/utils/auth/roleAccess.js`
- `frontend/src/router/AppRoutes.jsx`

Docs tidak boleh mengalahkan source aktual. Jika dokumen ini berbeda dengan file di atas, audit source terlebih dahulu dan perbarui docs pada patch yang sama.

## 2. Matrix viewport dan pola navigasi

| Kelas viewport | Rule aktif | Navigasi | Layout konten | Catatan utama |
|---|---|---|---|---|
| Desktop lebar | `>= 1200px` | Floating module dock | Offset kiri `112px`, content maksimum `1560px` | Dock normal `92 × 480px`; child route dibuka dari Module Hub. |
| Desktop compact / laptop | `993–1199px` | Floating module dock compact | Offset kiri `100px` | Dock sekitar `84 × 450px`; icon dan gap dipadatkan. |
| Desktop/laptop pendek | lebar `>= 993px` dan tinggi `<= 720px` | Floating dock low-height | Tetap desktop | Dock sekitar `420px`; semua icon wajib tetap berada di dalam asset rail. |
| Tablet portrait/landscape | `768–992px` | Hamburger + Drawer kiri | Content full width | Drawer maksimum `304px` atau `88vw`; bottom navigation tidak tampil. |
| Telepon umum | `481–767px` | Bottom navigation + bottom sheet | Content full width + safe bottom padding | Slot tetap: Dashboard, Stock, Menu IMS, Transaksi, Produksi. |
| Telepon sempit | `375–480px` | Bottom navigation + header compact | Role tag header disembunyikan; logout tetap tersedia | Greeting icon dapat disembunyikan agar tidak overflow. |
| Telepon kecil | `<= 374px` | Bottom navigation compact | Module Hub 1 kolom | Inset bottom nav diperkecil, label `8px`, center space dipadatkan. |
| Layar sangat lebar | di atas lebar desktop umum | Floating dock normal | Content tetap maksimum `1560px` | Jangan meregangkan tabel/form tanpa batas; ruang ekstra berada di luar canvas utama. |

### Aturan orientasi

- Sistem memakai breakpoint berbasis viewport, bukan label perangkat.
- Telepon landscape dengan viewport CSS `>= 768px` dapat masuk pola tablet Drawer. Ini adalah fallback aktif dan tidak boleh dianggap bug selama seluruh action tetap dapat diakses tanpa overflow.
- Portrait-first tetap menjadi standar utama telepon.
- Tidak ada rule khusus foldable berdasarkan model perangkat. Foldable mengikuti lebar viewport aktual dan wajib diuji pada kedua state bila digunakan di produksi.

## 3. Navigasi konsisten lintas viewport

### Desktop dan laptop

- Floating dock hanya menampilkan top-level module.
- Klik top-level module membuka Dashboard, halaman direct bila hanya ada satu tujuan, atau Module Hub bila memiliki beberapa halaman.
- Tidak ada submenu pop-up di dock desktop.
- Active state wajib benar pada Module Hub, direct module `/inventory/stock-management`, dan seluruh child route `/production/...`. `/inventory` hanya redirect role-guarded; exact hub `/stock` dan `/produksi` tidak aktif.
- Seluruh icon, active pill, focus outline, dan marker gold harus berada di dalam shape rail.
- Light dan dark mode memakai asset rail terpisah; jangan mengganti warna rail dengan filter CSS acak.

### Tablet

- Tablet mempertahankan `SidebarMenu` nested di Drawer kiri.
- Drawer memakai sumber menu, label, grouping, dan filter role yang sama dengan desktop/mobile.
- Drawer harus tertutup otomatis setelah route berubah.
- Tablet tidak menampilkan floating dock dan tidak menampilkan bottom navigation.

### Telepon

- Bottom navigation memiliki empat shortcut tetap dan satu tombol tengah `Menu`.
- Tombol tengah hanya membuka bottom sheet navigasi. Tombol ini bukan tombol tambah/create dan tidak boleh menjalankan mutation.
- Bottom sheet menampilkan top-level module yang lolos `filterSidebarMenuItemsByRole`.
- Theme toggle telepon berada di bottom sheet.
- Floating theme button desktop/tablet disembunyikan di telepon.
- Bottom sheet tertutup otomatis setelah route berubah.

## 4. Role guard dan keamanan navigasi

- `sidebarMenuItems` adalah sumber label, urutan, grouping, path/hub path, icon, metadata section workspace, dan allowed role.
- `filterSidebarMenuItemsByRole()` wajib dipakai oleh floating dock, Drawer tablet, bottom navigation, bottom sheet, dan Module Hub.
- `sidebarNavigation.js` menjadi helper bersama untuk active route dan target navigasi. Jangan menduplikasi resolver path di komponen lain.
- Hidden menu bukan security control. Hub route dan child route tetap wajib memakai `ProtectedRoute`.
- Tombol navigasi tidak boleh melewati confirm guard, validation, status flow, atau business service.
- Tidak boleh membuat shortcut langsung untuk stock adjustment, production completion, payroll final, finance posting, reset, restore, atau destructive action.

## 5. Rundown visual dan density

### Desktop lebar

- Header compact, brand dan greeting berada satu garis.
- Action utama berada di kanan Page Header.
- Tabel profesional tetap menjadi tampilan utama untuk data banyak.
- Module Hub maksimal 3 kolom pada area yang cukup lebar dan section mengikuti kelompok fungsi pada metadata role-aware.
- Summary/KPI boleh 3–4 kolom sesuai isi, tetapi tidak boleh menjadi report penuh.
- Page Header tetap berada di luar canvas. Ringkasan, filter, tabel, chart, dan pagination halaman operasional disatukan di dalam `PageContentCanvas` dengan divider tipis, bukan card bertumpuk.

### Desktop compact dan tablet

- Module Hub turun menjadi 2 kolom.
- Filter dan action boleh wrap, tetapi action utama tetap mudah ditemukan.
- Table dapat tetap dipakai di tablet bila kolom penting masih terbaca; gunakan scroll lokal pada wrapper, bukan scroll horizontal body.
- Form dapat memakai 2 kolom hanya bila label/input tidak terpotong. Field panjang atau dependent flow harus turun ke 1 kolom.

### Telepon

- Daftar operasional memakai `DataTableView` dengan `mobileCardConfig` bila tersedia.
- Mobile card menampilkan judul, subtitle, status, metadata utama, dan maksimal dua action utama.
- Detail panjang masuk `MobileDetailDrawer`; jangan memenuhi card utama.
- Form panjang memakai `ResponsiveFormSection` dan turun menjadi 1 kolom.
- Filter utama/search boleh tetap terlihat; filter lanjutan masuk `MobileFilterDrawer`.
- Module Hub memakai 1 kolom pada telepon karena setiap card membawa deskripsi fungsi. Pola 2 kolom hanya dipakai mulai tablet/desktop compact ketika ruang baca mencukupi.
- Jangan tampilkan technical ID, Firestore/SQLite internal ID, atau audit ref ganda pada card utama.

## 5A. Unified page content canvas

Halaman data operasional memakai `PageContentCanvas` sebagai satu boundary isi halaman setelah `PageHeader`. Tujuannya bukan membuat satu card tebal, melainkan menyatukan hierarchy berikut dalam satu workspace ringan:

1. ringkasan/KPI;
2. filter atau tab status;
3. section tabel/chart;
4. pagination dan catatan operasional.

Aturan aktif:

- `PageHeader`, App Header, sidebar/dock, route, dan role guard tetap berada di luar canvas dan tidak boleh diubah hanya untuk menyatukan isi halaman;
- summary card tetap berupa kartu kecil dengan gap internal, tetapi grup summary tidak menjadi card terpisah dari filter dan tabel;
- `FilterBar`, `ProductionFilterCard`, dan `PageSection` menjadi band internal dengan divider tipis, tanpa negative margin atau border sambungan palsu;
- modal, drawer, popover, dan confirm guard tetap memakai komponen existing serta tidak dipindahkan ke business layer;
- Dashboard, Module Hub, Login, Error Page, dan Maintenance Center boleh mempertahankan layout khusus bila hierarchy atau guard-nya berbeda;
- canvas tidak boleh mengubah query, state filter, pagination, dataSource, handler, payload, schema, stok, purchase, production, payroll, HPP, finance, reset, atau audit log.

Breakpoint minimum:

- desktop: summary maksimal 4 kolom dalam satu strip;
- tablet: summary turun menjadi 2 kolom;
- mobile: summary 2 kolom compact, filter lanjutan tetap memakai `MobileFilterDrawer`, dan table tetap memakai `DataTableView`/mobile card existing.

## 6. Spacing, touch target, dan safe area

- Target sentuh navigasi/action minimal `40px`; untuk kontrol utama disarankan `44px`.
- Bottom navigation memiliki tinggi visual `64px`, wrapper `78px`, dan memperhitungkan `env(safe-area-inset-bottom)`.
- Content telepon wajib memiliki padding bawah minimal setara `104px + safe area` agar tombol, pagination, sticky footer, dan baris terakhir tidak tertutup.
- Drawer/form/modal harus memakai scroll vertikal internal ketika konten panjang.
- Body/shell tidak boleh horizontal scroll pada telepon.
- Jarak antaricon dock tidak boleh dipaksakan dengan `space-between` tanpa memperhitungkan jumlah menu role aktif; semua icon harus tetap berada dalam zona aman shape.

## 7. Overlay dan z-index

Urutan interaksi yang wajib:

1. Modal/confirm/dialog kritis.
2. Form Drawer/detail Drawer/Select/DatePicker/dropdown overlay.
3. Bottom sheet Menu IMS.
4. Bottom navigation.
5. Content halaman.

Bottom navigation saat ini memakai layer tinggi agar stabil, tetapi overlay operasional wajib tetap berada di atasnya. Perubahan z-index harus diuji pada Modal, Drawer, Select, DatePicker, notification, dan action menu.

## 8. Header dan action

- Desktop/tablet lebar: title kiri, action utama kanan.
- Tablet sempit/mobile: action boleh wrap atau turun ke bawah tanpa overlap.
- Telepon tidak menampilkan hamburger karena navigasi utama sudah berada di bawah.
- Header telepon menampilkan brand compact dan greeting ringkas.
- Role tag boleh disembunyikan pada telepon kecil bila ruang sempit; akses role tetap tersedia di bottom sheet.
- Logout harus tetap dapat dijangkau dan tidak boleh tertutup atau terpotong.

## 9. Light/dark mode

- Semua navigation surface harus membaca token theme aktif.
- Dock desktop memakai `sidebar-rail-mask.svg` untuk light dan `sidebar-rail-mask-dark.svg` untuk dark.
- Bottom navigation, bottom sheet, Drawer tablet, Module Hub, table/card, modal, dan form wajib readable di kedua mode.
- Perubahan theme tidak boleh menggeser layout, ukuran dock, safe padding, atau posisi bottom navigation.
- Gold hanya accent kecil; jangan menjadi background besar atau pengganti warning semantic.

## 10. Empty, loading, error, dan data banyak

Setiap halaman yang disentuh wajib diuji dalam kondisi:

- loading;
- empty state;
- error state;
- data sedikit;
- data banyak;
- teks/nama panjang;
- angka Rupiah panjang;
- role Administrator dan User;
- light dan dark mode.

Data banyak tidak boleh membuat body horizontal scroll. Pagination, virtualized/local scroll, table wrapper, atau mobile card/list harus dipakai sesuai komponen existing.

Untuk form, modal, dan drawer operasional:
- panduan umum yang panjang memakai `InfoPopoverButton` atau popover on-demand;
- definisi singkat, contoh input, dan keterangan opsional satu field memakai tooltip pada label;
- warning dinamis, alasan field terkunci, guard stok/transaksi, validasi, dan konsekuensi destructive tetap tampil langsung;
- informasi tidak boleh dihapus hanya demi compact; pindahkan sesuai hierarchy dan pastikan tetap dapat dibuka di desktop maupun mobile.

Untuk workspace admin panjang seperti Maintenance Center:
- tab utama tidak boleh sticky bila panel mempunyai navigasi internal karena dua navigation bar dapat saling menutup saat scroll;
- mode internal seperti Backup, Restore, Cakupan Data, dan Detail Teknis memakai selector segmented dengan local horizontal scroll pada mobile;
- info sekunder memakai popover on-demand, bukan alert/banner permanen yang menambah tinggi halaman;
- mobile boleh memakai horizontal tab scroll lokal, bukan horizontal scroll pada body;
- status `belum diperiksa` tidak boleh dipadatkan menjadi angka `0`;
- daftar backup, audit log, dan riwayat wajib memakai pagination atau local scroll yang terlihat.

## 11. Rundown implementasi UI/UX per halaman

Urutan kerja untuk menjaga konsistensi:

1. **Validasi source aktual** — cari page, service/helper, route, role guard, dan komponen responsive yang sudah dipakai.
2. **Kunci hierarchy informasi** — tentukan title, subtitle, summary, filter, data utama, detail, dan action.
3. **Desktop lebar** — pastikan table/grid dan Page Header rapi pada `1440 × 900` serta `1920 × 1080`.
4. **Desktop compact** — cek `1024 × 768`, `1280 × 720`, dan tinggi viewport `600–720px`.
5. **Tablet** — cek `768 × 1024`, `820 × 1180`, serta landscape; Drawer harus usable.
6. **Telepon umum** — cek `390 × 844` dan `430 × 932`; bottom navigation dan bottom sheet tidak overlap.
7. **Telepon kecil** — cek `360 × 640` dan lebar `<= 374px`; label tidak tabrakan dan Module Hub turun menjadi 1 kolom bila perlu.
8. **Light/dark** — ulangi minimal satu halaman Dashboard, Master Data, Transaksi, dan halaman ber-Drawer/Modal.
9. **Role** — ulangi Administrator dan User; tidak boleh ada card/menu yang berakhir ke Unauthorized karena visibility salah.
10. **Overlay** — cek modal, detail drawer, form drawer, select, date picker, confirm dialog, dan keyboard mobile.
11. **Regression bisnis** — pastikan handler/action tetap memanggil flow existing dan tidak ada mutation baru dari UI responsive.
12. **Update docs dan test checklist** — perubahan responsive belum selesai sebelum docs dan QA ikut diselaraskan.

## 12. Matrix QA minimum

| Target | Resolusi minimum | Fokus QA |
|---|---|---|
| Desktop lebar | `1440 × 900`, `1920 × 1080` | Dock normal, content max width, table/data banyak. |
| Laptop umum | `1366 × 768` | Dock, header, page action, tidak ada overlap. |
| Desktop pendek | `1280 × 600`, `1280 × 720` | Dock low-height, seluruh icon masuk shape. |
| Tablet portrait | `768 × 1024`, `820 × 1180` | Hamburger, Drawer kiri, form/table. |
| Tablet landscape | `1024 × 768` | Fallback desktop compact atau tablet sesuai CSS viewport; tidak overflow. |
| Telepon kecil | `360 × 640` | Label bottom nav, 1 kolom pada breakpoint kecil, keyboard. |
| Telepon umum | `390 × 844`, `430 × 932` | Bottom nav, bottom sheet, safe area, overlay. |
| Mobile landscape | contoh `844 × 390` | Fallback width-based tetap usable; content tidak terpotong. |

## 13. Definition of Done responsive

Patch UI/UX baru dinyatakan selesai bila:

- [ ] Tidak ada horizontal scroll pada body telepon.
- [ ] Navigasi sesuai matrix viewport.
- [ ] Active route konsisten pada dock, Drawer, bottom nav, bottom sheet, dan Module Hub.
- [ ] Menu/card sesuai role dan route tetap dijaga `ProtectedRoute`.
- [ ] Semua action utama dapat dijangkau tanpa tertutup navigasi.
- [ ] Light/dark mode readable dan tidak menggeser layout.
- [ ] Loading, empty, error, data banyak, dan teks panjang diuji.
- [ ] Modal/Drawer/Select/DatePicker berada di atas bottom navigation.
- [ ] Mobile card/form memakai foundation existing, bukan komponen duplikat.
- [ ] Tidak ada perubahan schema, service bisnis, stock, transaksi, production, payroll, HPP, finance, reset, atau audit log hanya untuk responsive.
- [ ] Docs dan checklist QA ikut diperbarui.

## Breakpoint convention aktif — 2026-06-29

Breakpoint untuk component baru:

| Kategori | Range acuan |
|---|---|
| Phone | sampai `575px` |
| Large phone / small tablet | `576px–767px` |
| Tablet | `768px–991px` |
| Compact desktop | `992px–1199px` |
| Wide desktop | mulai `1200px` |

Nilai legacy lain boleh dipertahankan sampai component tersebut disentuh. Jangan menambah breakpoint baru yang berbeda 1–8px tanpa alasan layout yang terdokumentasi.

## Empty/error dan akses keyboard

- Tabel/card mobile memakai state yang sama dengan desktop: loading, error, empty, dan data.
- Card mobile yang membuka detail wajib memiliki `role`, `tabIndex`, accessible label, Enter, Space, dan focus-visible state.
- Tombol/action di dalam clickable card harus menghentikan propagation agar tidak membuka detail secara tidak sengaja.
- Error load tidak boleh ditampilkan sebagai “belum ada data”; sediakan retry bila request aman diulang.
