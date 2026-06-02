# 09 UI Theme Guide — IMS Bunga Flanel

Dokumen ini menjadi panduan praktis theme aktif IMS Bunga Flanel setelah rebrand visual mengikuti logo Flanel Karawang Industries.

## Theme aktif

Theme aktif memakai kombinasi **blue/navy primary, muted gold/yellow accent, white/off-white surface, dan dark navy** dengan arah visual minimalist modern, clean, proporsional, profesional, dan corporate.

## Palette utama

### Light theme
| Token | Value | Pemakaian |
|---|---:|---|
| Primary | `#245F9D` | primary action, active navigation, link, focus ring |
| Primary hover | `#1F548C` | hover action |
| Primary active | `#173F6B` | active/pressed action |
| Primary soft | `#E9F2FB` | selected state, info soft background |
| Brand gold | `#C9951A` | accent kecil, active marker, ornament, subtle badge |
| Brand gold soft | `#FFF7E3` | highlight brand lembut, bukan warning utama |
| Page background | `#F6F9FC` | canvas halaman |
| Shell background | `#EEF5FB` | app shell |
| Card background | `#FFFFFF` | card/modal/table/form surface |
| Card soft | `#F8FBFE` | secondary surface |
| Border | `#D9E5F2` | border utama |
| Text primary | `#102033` | text utama |
| Text secondary | `#5B6F84` | helper/subtitle |

### Dark theme
| Token | Value | Pemakaian |
|---|---:|---|
| Primary | `#5EA3E6` | primary action, active navigation, link, focus ring |
| Primary hover | `#7BB7F0` | hover action |
| Brand gold | `#F1C75B` | accent kecil/highlight di dark mode |
| Brand gold soft | `rgba(241, 199, 91, 0.14)` | highlight brand lembut, bukan warning utama |
| Page background | `#07111F` | canvas dark navy |
| Shell background | `#0A1627` | app shell dark |
| Card background | `#101E33` | card/table/form dark |
| Card soft | `#172A45` | secondary surface dark |
| Elevated | `#1B304D` | modal/drawer/dropdown |
| Border | `rgba(147, 184, 223, 0.18)` | border dark |
| Text primary | `#EAF2FB` | text utama dark |
| Text secondary | `rgba(234, 242, 251, 0.72)` | helper/subtitle dark |

## Aturan penggunaan warna

- Biru/navy dipakai untuk primary action, active navigation, link, selected state, dan focus ring.
- Primary action wajib memakai token teks kontras `--ims-color-on-primary` agar tombol tetap readable pada light/dark mode.
- Muted gold/yellow dipakai hemat sebagai accent kecil: active menu marker, garis aksen kecil, ornament icon, selected/focus accent, atau badge subtle.
- Gold/yellow tidak boleh menjadi background besar, semua CTA, text panjang, atau pengganti status warning semantic.
- Warning semantic memakai amber/orange terpisah dari brand gold agar status bisnis tidak ambigu.
- Putih/neutral dipakai sebagai surface utama card, modal, drawer, table, dan form.
- Dark navy dipakai sebagai shell, card, elevated surface, drawer/modal/table dark mode.
- Standar baru: **no-gradient** untuk global/shared shell dan shared components; gunakan flat surface, border subtle, dan shadow minimal.
- Page-specific visual seperti Dashboard card, OCR receipt, dan cash summary juga harus mengikuti arah flat token bila sudah disentuh dalam patch UI; jangan menghidupkan ulang gradient dekoratif.
- Hindari warna decorative lama sebagai theme aktif.


## Standar gold accent

Boleh digunakan:
- active menu marker 3px atau dot kecil;
- ornament kecil pada header/sidebar;
- selected/focus accent yang tetap readable;
- badge subtle dengan border/tint kecil;
- accent line kecil pada shared KPI/filter surface.

Tidak boleh digunakan:
- background card besar atau panel penuh;
- semua primary CTA;
- body text panjang;
- mengganti warning/success/error/info semantic;
- gradient atau glow dekoratif baru.

## File pusat theme

1. `src/index.css` — CSS variable global, light/dark token, body/root baseline.
2. `src/theme/antdTheme.js` — token Ant Design dan component token.
3. `src/App.css` — guard global app shell, table, modal, drawer, dropdown, popover, form, dan shared surface.

## Standar typography token

Typography IMS memakai font stack utama:

```css
Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

Token angka typography wajib berada di `src/index.css`. Jika CSS shared memakai token seperti `--ims-font-size-*`, `--ims-font-weight-*`, `--ims-line-height-*`, `--ims-letter-spacing-*`, atau `--ims-typo-*`, token tersebut harus didefinisikan di `:root` agar browser tidak jatuh ke default Ant Design/browser.

Standar penggunaan:

| Area | Ukuran | Weight | Catatan |
|---|---:|---:|---|
| Body/table | `14px` | `400–500` | default baca data |
| Page title | `22–26px` | `760` | tegas tapi tidak memakai `850/900` |
| Page subtitle | `13px` | `400–500` | copy pendek |
| App header greeting | `15.5–16.5px` | `700` | jangan terlalu display/bold |
| App header subtitle | `12.5px` | `500` | secondary text |
| Sidebar parent menu | `14px` | `600` | menu utama jelas |
| Sidebar submenu | `13.5px` | `500` | lebih ringan dari parent |
| Sidebar brand title | `14px` | `700` | jangan pakai display weight |
| Summary value | `25px` | `760` | angka utama compact |
| Summary label | `12px` | `680` | card title ringkas |

Aturan penting:

- Jangan menambah `font-weight: 850` atau `900` untuk UI operasional harian.
- Untuk receipt/modal transaksi, gunakan `--ims-font-weight-display` atau `--ims-font-weight-strong`, bukan angka weight 900 hardcoded.
- Jangan memakai ukuran unik berulang tanpa token. Jika angka dipakai lintas shared component, jadikan token.
- Header dan sidebar tidak boleh memakai display weight berlebihan; keduanya harus terasa calm, readable, dan corporate.
- Jangan mengubah route/menu/role guard hanya untuk memperbaiki visual sidebar. Sidebar typography adalah CSS-only.
- Jika font `Inter` belum dimuat sebagai asset/dependency, fallback `system-ui/Segoe UI` tetap harus terlihat rapi.

## Area guarded

- `src/main.jsx` melakukan bootstrap class theme sebelum React render agar dark mode tersimpan tidak flash ke light saat first paint React.
- `AppLayout.jsx` theme sync untuk `app-theme-light`, `app-theme-dark`, dan `data-app-theme` setelah React aktif.
- `App.css` guard untuk table/modal/drawer/dropdown/popover/form.
- Selector CSS global boleh menjadi guard Ant Design, tetapi tidak boleh ada duplicate top-level selector dengan nilai token final yang saling menimpa.
- `PageFormModal.jsx` `rootClassName="page-form-modal-root"` dan `getContainer`.
- `SidebarMenu.jsx` role-aware logic, nested accordion, `selectedKeys`, `openMenuKeys`, dan `onOpenChange`.
- `Login.jsx` auth flow, profile status, blocked user, dan logout blocked user.
- `Dashboard.jsx` query, calculation, source data, dan read-only flow.

## Smoke test theme

- Toggle light/dark, refresh browser, dan cek mode tetap tersimpan.
- Simpan dark mode, refresh browser, dan pastikan shell awal tidak flash ke light mode saat React mulai render.
- Buka Dashboard, Login, Sidebar expanded/collapsed, PageFormModal, table, select dropdown, datepicker, drawer, dropdown menu, dan popover.
- Cek card/table/form tetap solid dan readable di light/dark.
- Cek role-aware menu dan active route tetap benar.
- Cek Login normal, error, loading profile, blocked user, dan logout blocked user.
- Cek Dashboard tidak membuat write flow baru dan semua action hanya navigasi.

## Standar Page Header dan action utama

- Title halaman berada di kiri dan harus menyebut konteks utama halaman.
- Subtitle bersifat opsional. Pakai subtitle singkat hanya jika menambah konteks operasional; hapus bila hanya mengulang title.
- Tombol action utama seperti `Tambah Produk`, `Tambah Planning`, `Tambah PO`, atau action create lain berada di kanan header pada desktop/tablet lebar. Catatan: `Tambah Work Log` tidak berlaku untuk flow aktif karena Work Log harus dimulai dari Production Order.
- Di mobile, action utama boleh wrap atau turun ke bawah selama tetap dalam container dan tidak overlap.
- Jangan meletakkan action utama di sisi kiri jika halaman sudah memakai pola title kiri + action kanan.
- Header tidak boleh dipakai untuk menjelaskan seluruh flow bisnis. Penjelasan panjang tetap di docs, bukan di UI harian.


## Standar Mobile App Shell

- Pada viewport tablet/HP, sidebar tidak boleh memakai collapsed sidebar desktop yang tetap memakan lebar content. App shell harus memakai drawer navigasi dari tombol menu di header.
- Drawer navigasi mobile tetap memakai `SidebarLogo` dan `SidebarMenu` existing agar role-aware menu, selected route, dan nested accordion tidak berubah.
- Drawer mobile harus tertutup setelah route berubah agar layar kembali fokus ke halaman tujuan.
- Header mobile harus compact: tombol menu di kiri, greeting tetap ringkas, subtitle global boleh disembunyikan, dan action user tidak boleh membuat horizontal overflow.
- Content card mobile harus memakai full width dengan padding lebih kecil; jangan memakai fixed height content yang bergantung pada asumsi tinggi header desktop.
- Table pada mobile boleh memakai horizontal scroll lokal di dalam card/table wrapper. Jangan membuat body/shell ikut horizontal scroll.
- Drawer dan modal pada mobile harus dibatasi `100vw`/viewport dan body-nya boleh scroll vertikal agar form/detail panjang tetap bisa diakses.
- Filter mobile memakai prinsip portrait-first: HP kecil boleh full-width, tetapi tablet/HP besar tidak boleh dipaksa 1 kolom jika masih aman memakai 2 kolom compact.
- Filter dan PageHeader action boleh wrap atau turun ke bawah, tetapi jangan memaksa semua tombol menjadi full-width bila membuat header terlalu tinggi. Tombol utama tetap harus jelas, tidak overlap, dan callback/action tidak berubah.
- Summary/KPI mobile boleh memakai 2 kolom compact untuk metric pendek agar dashboard/report tidak terlalu panjang; nilai Rupiah panjang tetap harus readable dengan wrap aman.
- Top header button wajib punya focus outline yang jelas untuk keyboard navigation.
- Perubahan mobile shell harus UI-only; tidak boleh mengubah route config, sidebar menu config, role guard, auth, schema, service, stock, purchase, sales, production, payroll, HPP, finance, report, reset, atau audit log.

## Standar Detail Drawer

Detail drawer dipakai untuk membaca data, bukan untuk menggantikan dokumentasi flow. Struktur standar:

1. **Header ringkas**
   - Tampilkan nama/kode utama.
   - Tampilkan status badge/tag yang relevan.
   - Tampilkan metric utama bila ada, misalnya total, stok, final amount, output qty, atau HPP.

2. **Section `Ringkasan`**
   - Pakai `Card`, `Descriptions`, atau layout ringkas yang sudah ada.
   - Label harus pendek dan user-facing.
   - Hindari paragraf panjang atau helper text yang tidak dibutuhkan saat user hanya membaca detail.

3. **Section `Data Anak`**
   - Item transaksi, material requirement, step produksi, payroll line, varian, supplier item, atau output Work Log ditampilkan memakai `Card + Table` kecil bila berbentuk list.
   - Hindari table HTML manual bila AntD `Table` bisa dipakai konsisten.
   - Data anak yang panjang harus tetap readable dan boleh memakai horizontal scroll natural drawer.

4. **Section `Catatan`**
   - Catatan manual tampil sebagai section sendiri.
   - Catatan tidak boleh mendominasi area atas kecuali memang menjadi warning bisnis.
   - Catatan audit panjang di tabel utama wajib diringkas 1-2 baris; detail penuh boleh memakai tooltip/detail. Untuk OCR Shopee, tampilkan badge ringkas dan jangan tampilkan seluruh breakdown biaya di kolom tabel.
   - Style detail/receipt OCR harus page/component scoped; jangan menaruh CSS receipt dan print guard OCR kembali ke `src/App.css`.

5. **Section `Info Tambahan`**
   - Data optional, audit, kompatibilitas data lama, atau informasi teknis panjang masuk `Collapse` bila tidak perlu dibaca setiap kali.
   - Jangan memakai istilah internal sebagai label utama bila user tidak membutuhkannya.

6. **Warning penting**
   - Warning bisnis tetap memakai `Alert` dan ditempatkan dekat data yang relevan.
   - Jangan menyembunyikan warning stok, cost, HPP, payroll, reset, auth, atau shortage ke area yang sulit ditemukan.

## Standar Form Drawer dan Modal

- Form harus fokus ke input dan keputusan user.
- Helper text maksimal satu kalimat pendek per field/section.
- Jangan menaruh penjelasan fungsi menu atau flow panjang di dalam form.
- Label field harus cukup jelas tanpa paragraf tambahan.
- Validation dan error message tidak boleh dihapus.
- Disabled reason penting harus tetap terlihat atau tetap bisa dipahami dari konteks.
- Field sensitif boleh punya helper pendek, terutama untuk stok, varian, cost, payroll, HPP, reset, dan Auth UID.
- Confirmation copy untuk action destructive harus tetap jelas dan tidak dibuat terlalu santai.
- Form create/edit tidak boleh mengubah payload, callback, service call, atau mapping data hanya karena layout dirapikan.

## Standar microcopy dan info text

- Hapus teks yang hanya mengulang nama menu, nama card, atau nama tabel.
- Hapus subtitle section seperti `Daftar produk jadi` bila tabel dan title sudah cukup jelas.
- Hindari istilah internal yang tampil ke user, seperti `legacy`, `guard`, `bucket`, `source`, `read-only`, `metadata tampilan`, atau prefix `AKTIF` sebagai penjelasan.
- Jika istilah teknis masih dibutuhkan, ubah ke bahasa operasional. Contoh: `source` menjadi `asal data`, `read-only` menjadi `hanya ditampilkan`, dan `bucket varian` menjadi `stok per varian`.
- Gunakan kalimat pendek dan langsung pada kebutuhan user.
- Jangan membuat UI penuh hanya karena ingin menjelaskan semua flow. Detail flow bisnis tetap berada di docs dan checklist.
- Microcopy tidak boleh mengubah makna field bisnis, status, atau aksi.

## Standar Alert

Pertahankan `Alert` untuk:

- warning destructive;
- error;
- validation;
- stok kurang/kritis;
- cost atau HPP invalid;
- payroll belum valid;
- reset maintenance;
- auth/security;
- confirmation risk;
- disabled reason penting.

Ringkas atau hapus `Alert` untuk:

- penjelasan fungsi menu;
- info pasif yang tidak memengaruhi keputusan user;
- teks yang sudah jelas dari title, card, table, atau field label;
- copy yang berulang di banyak section.

Alert tidak boleh membuat aksi berisiko terdengar aman tanpa konsekuensi. Khusus reset, stok, payroll, HPP, dan auth, alert harus tetap tegas.

## Standar area sensitif

### Production Planning
- Planning adalah target dan monitoring sebelum Production Order.
- Planning tidak mengubah stok.
- Planning tanpa PO boleh dicancel jika status belum final.
- Planning yang sudah punya PO / linked Production Order tidak bisa dicancel langsung.
- Jangan menampilkan info yang sama berulang di banyak tempat; cukup pastikan rule utama tetap terbaca.

### Production Order
- Requirement material dan readiness harus jelas.
- Shortage warning tidak boleh dihapus.
- Status PO harus terlihat di area atas/detail.

### Work Log
- Detail cost harus compact dan tidak memakai alert besar untuk status normal seperti payroll masih draft atau estimasi step.
- Material cost, overhead cost, labor cost, total cost, dan output qty harus tetap bisa ditelusuri.
- Labor boleh menampilkan tag compact `Payroll Final`, `Draft Payroll`, atau `Estimasi Step`; draft/estimasi wajib read-only dan tidak ditulis sebagai HPP final.
- Overhead Work Log berasal dari overhead BOM untuk listrik/glue gun. Field hasil selain Good Qty adalah compatibility data lama dan tidak ditampilkan sebagai workflow aktif.

### Payroll
- Final amount, status payroll, payment status, dan include HPP harus jelas.
- Relasi `paid` ke Cash Out otomatis harus tetap bisa dipahami agar user tidak membuat pengeluaran ganda.

### HPP Analysis
- HPP invalid atau cost kosong wajib terlihat.
- Jangan menghapus warning yang membantu analisis biaya.
- HPP Final dan HPP Preview harus dibedakan jelas; draft payroll/estimasi Step tidak boleh terlihat seperti final.
- Warning penting boleh tetap terlihat, tetapi status normal draft/estimasi cukup memakai tag/helper compact, bukan alert besar.
- Output qty dan komponen biaya utama harus tetap jelas.

### Stock
- Stok total, stok tersedia, stok dipesan/reserved, minimum stock, dan warning critical harus jelas.
- Adjustment stok harus tetap punya warning dan alasan.
- Item bervarian harus tetap menampilkan varian yang relevan.

### Sales, Purchases, dan Returns
- Item, qty, harga, subtotal, total, payment/status, dan dampak stok/kas harus jelas.
- Jangan mengubah makna field lewat copy yang terlalu bebas.
- UI retur tidak boleh fallback ke Firestore/Technical ID pada kolom referensi atau tooltip; gunakan referensi bisnis readable atau fallback manusiawi.
- OCR receipt harus flat token-based, tanpa gradient dekoratif dan tanpa `font-weight: 900` hardcoded.

### Cash In dan Cash Out
- Sumber manual/otomatis harus jelas.
- Referensi transaksi, payroll, atau purchase harus jelas bila ada.
- Copy tidak boleh mendorong user membuat data manual ganda untuk sumber otomatis.

### Reset Maintenance
- Gunakan workspace berbasis tab untuk halaman maintenance yang kompleks: Ringkasan, Skenario & Audit, Repair Aman, Reset & Export, Offline DB.
- Jangan menampilkan semua panel maintenance panjang sekaligus jika bisa dipisah per area.
- Tab boleh membuat tampilan lebih ringkas, tetapi warning destructive wajib tegas.
- Preview wajib sebelum reset.
- Confirmation keyword tidak boleh disamarkan.
- Jangan membuat reset terdengar aman tanpa risiko.
- Scope reset, protected data, jumlah dokumen terdampak, status proses, dan hasil/audit harus tetap jelas.
- Mobile/tablet harus menjaga tab dapat digeser dan hero tidak overflow.
- Dark mode harus tetap aman; hindari background hardcoded yang terlalu putih/terang.

### User Management
- Role, status, email, dan Auth UID/profile binding harus jelas.
- Security warning tidak boleh dihapus.
- Copy harus membedakan profile Firestore dari akun Auth bila konteks itu relevan untuk admin.

## Standar drawer width

- Detail sederhana: `600–720px`.
- Detail dengan table/list anak: `820–920px`.
- Detail kompleks seperti PO, Work Log, HPP, atau Payroll: `920–1100px` bila source sudah memakai pola tersebut.
- Mobile harus scroll atau wrap dengan aman; jangan membuat overflow horizontal buruk.
- Drawer width tidak boleh menjadi alasan menyembunyikan warning penting.

## Checklist UI detail, drawer, form, dan panel

- Title jelas.
- Status terlihat.
- Angka utama terlihat.
- Detail anak terbaca.
- Warning penting tetap ada.
- Tidak ada paragraf panjang yang tidak perlu.
- Tidak ada istilah internal yang tampil sebagai copy utama.
- Dark mode aman.
- Mobile tidak overflow buruk.
- Action, callback, payload, data source, query, filter, dan calculation tidak berubah.

## Cleanup candidate lanjutan

- Audit warna hardcoded di halaman bisnis satu per satu, jangan dicampur dengan perubahan logic.
- Kurangi override duplikatif di `src/App.css` secara bertahap setelah ada visual regression pass.
- Jika selector top-level dikonsolidasikan, pakai nilai yang saat ini menang di cascade dan jangan campur dengan perubahan JS/logic.
- Pertahankan guard Ant Design sampai dependency modal/table/dropdown benar-benar jelas.
- Jangan hapus `!important` pada table/modal/drawer/dropdown/datepicker/popover sebelum cek light/dark dan fixed column.
- False-positive grep seperti `Message/message` bukan token warna lama dan tidak perlu diubah.

## Standar Login branding

- Halaman Login memakai logo resmi sebagai lockup brand yang clean, bukan ilustrasi besar dengan frame berat.
- Logo Login tidak boleh tertimpa orb/shape dekoratif.
- Panel brand dan form harus seimbang; pada mobile final, logo brand boleh menjadi fokus visual utama selama form tetap langsung terlihat dan mudah dipakai.
- Dekorasi background harus flat, lembut, berbasis token blue/navy + gold accent kecil, dan tidak memakai gradient baru.
- Perubahan Login harus mengutamakan CSS scoped `.ims-login-*`; `Login.jsx` hanya disentuh untuk struktur visual, bukan auth flow.
- `Login.jsx` auth flow, `handleLogin`, `profileStatus`, blocked user, dan logout blocked user adalah area **GUARDED**.

## Standar Login Mode A — Modern Bright Corporate

- Login Mode A memakai layout dua panel terang: brand hero kiri dan form card kanan.
- Logo Flanel Karawang Industries tampil bebas tanpa frame/showcase berat dan tidak boleh tertimpa orb/dekorasi.
- Brand panel boleh memakai shape/curve flat blue-gold yang halus, tetapi tidak boleh memakai gradient baru dan tidak boleh mengalahkan form login.
- Form login tetap menjadi fokus utama dengan card putih solid, shadow lembut, input jelas, dan button primary blue kuat.
- Mobile memakai prinsip brand-first single card: badge `Inventory Management System` kecil di kiri atas, logo besar tanpa frame/wrap khusus, form langsung berada di bawah logo, dan heading `Akses Internal/Masuk ke Sistem` tidak ditampilkan agar tidak ramai.
- Perubahan Login harus scoped di `.ims-login-*`; auth flow, `AuthContext`, route guard, role access, dan modul bisnis tetap **GUARDED**.

## Standar Login full-page corporate final
- Halaman Login memakai komposisi full-page, bukan wrapper/card besar yang membungkus seluruh layout.
- Brand area kiri harus terasa menyatu dengan viewport, memakai aksen geometric minimalis, bukan dekorasi bulat besar yang dominan.
- Logo Flanel Karawang Industries menjadi elemen utama brand panel: besar, presisi, center, bebas dari frame berat, dan tidak tertimpa dekorasi.
- Copy brand dibuat kecil dan ringan agar tidak mengalahkan logo dan form login.
- Note internal ditempatkan sebagai supportive footer note, bukan elemen utama; pada mobile note tampil setelah form agar tidak memecah fokus logo dan input.
- Form login tetap menjadi fokus aksi dengan card putih solid, button primary blue, input readable, dan focus state jelas.
- Logo utama Login boleh memakai asset WebP teroptimasi dengan PNG fallback agar performa lebih baik tanpa mengubah brand lockup.
- Perubahan Login tetap scoped pada `.ims-login-*`; auth flow, route guard, role access, Sidebar, Dashboard, dan modul bisnis tetap **GUARDED**.

## Standar global/auth/route loading logo
- Loading utama aplikasi memakai `LogoLoadingScreen` untuk auth/session gate, ProtectedRoute guard sebelum page tampil, dan Login auth/profile verification. Lazy route fallback di dalam layout harus non-prominent agar tidak muncul logo loading kedua setelah sidebar/layout tampil.
- Loading logo wajib full viewport, center, tanpa card/wrap kecil, dan mengikuti token theme existing untuk light/dark mode.
- Animasi default adalah Elegant micro split: logo tidak berputar, komponen kuning/biru bergerak subtle, lalu menyatu smooth.
- `LogoLoadingScreen` wajib tetap accessible dengan `role="status"`, `aria-live="polite"`, `aria-busy="true"`, serta fallback logo normal jika canvas gagal.
- Loading lokal table, submit button, modal/drawer saving, report, maintenance preview, produksi/payroll/HPP data flow, Refresh Need, dan Refresh Preview tidak otomatis diganti oleh standar global ini.
- Perubahan loading global adalah UI-only; auth flow, route guard logic, role access, service, query, transaction, schema, collection, dan business flow tetap **GUARDED**.

## Standar local data/table/card loading
- Loading hierarchy IMS:
  - Global/auth/session/login: `LogoLoadingScreen` full viewport dengan logo Flanel Karawang.
  - Lazy route di dalam layout serta table/data/card/chart/list: `DataLoadingState` skeleton/shimmer lokal tanpa logo, tanpa full-screen overlay, dan tanpa AntD spinner overlay custom.
  - Button/action/modal/process: loading lokal bawaan komponen tetap dipakai sesuai konteks aksi.
- `DataLoadingState` harus memakai class scoped `.ims-data-loading*`, mengikuti token theme IMS, support light/dark mode, mobile, dan `prefers-reduced-motion`.
- Jangan memakai `LogoLoadingScreen` untuk lazy page fallback di dalam layout, table/data/card karena akan terasa seperti loading kedua atau restart aplikasi.
- Jangan mengganti loading submit, export, maintenance repair/reset, Refresh Need, atau Refresh Preview tanpa task dan audit flow terpisah.

- Table initial loading yang sudah dipatch memakai `getDataTableEmptyText(...)` dan refresh lokal memakai `DataRefreshIndicator`; jangan kembali ke custom skeleton sebagai `Table loading` indicator karena bisa memicu overlay/double loading.

## Standar Compact Summary Dock

Summary statistik lintas halaman memakai pola compact agar tidak memakan ruang berlebihan ketika hanya menampilkan angka seperti total, varian, tanpa varian, status cek, uang masuk, uang keluar, atau nominal report.

### Varian aktif

1. **Executive Dock**
   - Default untuk halaman operasional, master data, stok, produksi umum, dan summary count.
   - Satu metric utama dibuat lebih dominan, metric lainnya menjadi mini card kanan/bawah.
   - Cocok untuk `Total`, `Aktif`, `Nonaktif`, `Perlu Dicek`, `Varian`, dan status ringkas lain.

2. **Finance Dock**
   - Dipakai untuk Cash In, Cash Out, Buku Besar Kas, laporan finance, payroll nominal, dan HPP.
   - Satu angka utama diberi ruang lebih besar agar nominal Rupiah panjang tetap terbaca.
   - Metric pendukung tampil sebagai mini card tanpa flow strip/bar bawah agar angka tidak tampil dobel.
   - Nominal uang wajib tampil penuh; bila ruang sempit, layout yang turun/wrap, bukan nominal yang dipotong.

3. **Legacy Cards**
   - `variant="cards"` boleh dipakai hanya bila ada kebutuhan khusus mempertahankan grid kartu lama.
   - Jangan jadikan default baru kecuali ada alasan layout spesifik.

### Aturan copy summary

- Label summary harus pendek dan user-facing.
- Hindari pengulangan kata seperti `Total` di semua kartu bila konteks sudah jelas dari section title.
- Subtitle/helper hanya dipakai bila menambah konteks filter/periode/status; jangan mengulang judul.
- Helper/catatan metric finance ditempatkan di bawah nominal agar tidak terlihat seperti info dobel.
- Untuk angka Rupiah panjang, gunakan Finance Dock supaya tidak memaksa table/filter turun terlalu jauh.
- Jangan memakai `truncate`, `ellipsis`, atau `nowrap` yang membuat nominal uang tidak terlihat penuh.

### Aturan teknis aman

- `SummaryStatGrid` adalah komponen presentational; perubahan layout tidak boleh mengubah perhitungan, query, service, payload, schema, route, role guard, stok, kas, payroll, HPP, atau audit log.
- `columns` tetap dipertahankan sebagai kompatibilitas untuk `variant="cards"`, tetapi layout baru dikendalikan oleh `variant` dan CSS responsive.
- `ProductionSummaryCards` memakai adapter `SummaryStatGrid` agar halaman produksi konsisten tanpa menggandakan komponen summary.
- Jika halaman finance butuh angka utama tertentu, gunakan `highlightKey` sesuai key item summary.

### Checklist visual summary

- Desktop: summary tidak terasa terlalu tinggi dan table/filter tetap cepat terlihat.
- Tablet/mobile: Executive Dock dan Finance Dock turun menjadi satu kolom tanpa overflow horizontal.
- Light/dark: border, shadow, text, dan status accent tetap readable.
- Data banyak: halaman dengan summary lebih dari empat item tetap wrap rapi.
- Finance: nominal panjang tidak terpotong, tidak ada flow strip/bar bawah yang mengulang metric, helper tampil di bawah nominal, dan surface cash summary tetap flat tanpa gradient.

### Variant stock alert display

- Variant pill dipakai untuk saldo varian, bukan untuk teks status panjang. Hindari menulis `Kosong`/`Stok Rendah` berulang di setiap pill.
- Tabel utama master inventory **tidak boleh** menampilkan caption panjang seperti `Perlu restock: Merah 0 pcs, Putih 0 pcs +2 lainnya` karena membuat UI ramai dan duplikatif. Status cukup memakai tag ringkas, sedangkan varian bermasalah cukup terlihat dari pill stok varian.
- Informasi cost/modal/HPP aktif lebih prioritas daripada caption restock berulang pada tabel utama. Caption restock detail boleh dipakai di drawer, report, audit, atau halaman analisis bila konteksnya memang troubleshooting.
- Ringkasan harus dibatasi agar aman untuk data banyak, mobile, dan table compact. Detail varian lengkap tetap berada pada daftar pill/detail drawer.

## Standar Offline Repository Status Banner

- Page master data pilot yang bisa berpindah repository (`Categories`, `Customers`) wajib menampilkan banner mode data di bawah `PageHeader`.
- Banner harus menjelaskan source aktif dengan bahasa user-facing: `Firebase Server` untuk `firebase_primary`, dan `SQLite Lokal`/`Backend Lokal` untuk `sqlite_sidecar`. Nilai legacy `offline_local` hanya alias compatibility ke `sqlite_sidecar`, bukan IndexedDB.
- Saat SQLite aktif, copy harus mengingatkan bahwa data pilot dibaca/ditulis lewat backend Node.js lokal dan file SQLite di laptop/server lokal.
- Empty state SQLite tidak boleh hanya menulis `Belum ada data`; harus menjelaskan kemungkinan backend SQLite belum jalan atau database SQLite masih kosong, serta memberi shortcut ke `SQLite Local DB Center`.
- Banner harus compact, responsive, dan tidak menggantikan table/action utama. Detail backup SQLite, migration status, dan restore plan tetap berada di `SQLite Local DB Center`.
- Perubahan banner adalah UI-only. Jangan menyisipkan write/sync otomatis, schema change, route/menu baru, atau business flow transaksi di komponen status.

## Standar Action Result Popup — Success/Error Only

- Popup hasil proses hanya dipakai untuk status sukses dan error/gagal.
- Warning/info cukup memakai toast ringan Ant Design; jangan dijadikan popup modal agar user tidak terganggu untuk preview, dry-run, filter, dan status ringan.
- Popup sukses/error harus tetap muncul setelah modal konfirmasi tertutup, terutama pada Reset Maintenance dan Offline Database Center.
- Error popup boleh menyediakan tombol salin detail, tetapi isi detail harus user-facing dan tidak boleh menampilkan Firestore technical ID, stack trace panjang, secret, credential, atau payload mentah.
- Popup tidak menggantikan confirm guard. Aksi destructive tetap wajib preview + keyword confirmation sebelum proses berjalan.

## Standar DataTableView Mobile Card

- Tabel operasional yang sering dibuka di HP harus memakai `DataTableView` dengan `mobileCardConfig`, bukan memaksa user scroll kanan-kiri untuk melihat kolom penting.
- Desktop tetap memakai AntD `Table` existing; mode kartu hanya aktif di layar mobile lewat CSS `.ims-data-table-view--mobile-card` sehingga konfigurasi kolom desktop, sort/filter/action handler, dan pagination desktop tidak berubah.
- Isi kartu mobile harus ringkas:
  - `title`: nama/kode utama yang mudah dikenali user.
  - `subtitle`: tanggal, customer/supplier/kategori, atau satuan utama.
  - `tags`: status/channel/type secukupnya.
  - `meta`: maksimal informasi kunci seperti nominal, stok, qty, role, atau status.
  - `content`: ringkasan item/stock bila memang penting.
  - `actions`: gunakan handler existing; jangan membuat handler baru di mobile card.
- Jangan menampilkan Firestore technical ID sebagai judul/subtitle kartu. Gunakan referensi bisnis manusiawi seperti kode transaksi, kode customer/supplier, atau nama item.
- Mobile card adalah presentational-only. Jangan memasukkan query, mutation, stock update, cash ledger update, purchase/sales/return commit, payroll/HPP, reset, route guard, atau role guard ke `DataTableView`.
- Area produksi yang sudah memakai mobile card UI-only: `ProductionEmployees`, `ProductionOrders`, `ProductionWorkLogs`, `ProductionBoms`, dan `SemiFinishedMaterials`. Semua action mobile harus tetap memanggil handler existing pada page, bukan membuat flow baru untuk stok/material usage/payroll/HPP.
- Jika halaman report/utility kompleks masih membutuhkan tabel scroll, boleh dibiarkan sampai ada audit mobile khusus.

### Detail drawer untuk mobile card operasional

- Kartu mobile untuk data audit/transaksi boleh memiliki tombol `Detail` / `Lihat Detail` yang membuka drawer read-only bila informasi utama tidak muat di kartu.
- Drawer detail wajib memakai data record yang sudah ada di tabel/page state; jangan membuat mutation, re-query besar, atau workflow baru dari tombol detail mobile.
- Untuk stok dan penyesuaian stok, drawer detail hanya boleh menampilkan audit read-only: tanggal, item, arah, qty, referensi, alasan, dan catatan.
- Untuk Sales/Purchases, drawer detail hanya boleh menampilkan ringkasan transaksi dan item. Jangan menambahkan cancel/delete/edit/commit baru dari drawer mobile.
- Label mode data di kartu master data harus user-facing. Hindari enum teknis seperti `SQLITE_SIDECAR` sebagai teks utama; gunakan copy seperti `Data Lokal`, `SQLite Lokal`, atau `Firebase Fallback`.

### Standar tabel detail/report setelah patch mobile detail

- Tabel detail/drawer yang sederhana boleh memakai `DataTableView + mobileCardConfig` agar data penting langsung terbaca di HP.
- Tabel report yang masih dibutuhkan penuh di desktop tetap mempertahankan `columns` existing; kartu mobile hanya ringkasan baca cepat, bukan pengganti data desktop.
- Untuk tabel utility/reset/offline yang kompleks, prioritas aman adalah scroll lokal pada wrapper tabel. Jangan ubah workflow destructive/reset, sync, atau audit hanya demi tampilan mobile.
- Konfigurasi kartu mobile wajib memanggil handler existing untuk action. Jangan membuat handler mobile baru yang melewati guard/confirm/status flow.
