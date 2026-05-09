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
- Muted gold/yellow dipakai hemat sebagai accent kecil: active menu marker, garis aksen kecil, ornament icon, selected/focus accent, atau badge subtle.
- Gold/yellow tidak boleh menjadi background besar, semua CTA, text panjang, atau pengganti status warning semantic.
- Warning semantic memakai amber/orange terpisah dari brand gold agar status bisnis tidak ambigu.
- Putih/neutral dipakai sebagai surface utama card, modal, drawer, table, dan form.
- Dark navy dipakai sebagai shell, card, elevated surface, drawer/modal/table dark mode.
- Standar baru: **no-gradient** untuk global/shared shell dan shared components; gunakan flat surface, border subtle, dan shadow minimal.
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

## Area guarded

- `AppLayout.jsx` theme sync untuk `app-theme-light`, `app-theme-dark`, dan `data-app-theme`.
- `App.css` guard untuk table/modal/drawer/dropdown/popover/form.
- `PageFormModal.jsx` `rootClassName="page-form-modal-root"` dan `getContainer`.
- `SidebarMenu.jsx` role-aware logic, nested accordion, `selectedKeys`, `openMenuKeys`, dan `onOpenChange`.
- `Login.jsx` auth flow, profile status, blocked user, dan logout blocked user.
- `Dashboard.jsx` query, calculation, source data, dan read-only flow.

## Smoke test theme

- Toggle light/dark, refresh browser, dan cek mode tetap tersimpan.
- Buka Dashboard, Login, Sidebar expanded/collapsed, PageFormModal, table, select dropdown, datepicker, drawer, dropdown menu, dan popover.
- Cek card/table/form tetap solid dan readable di light/dark.
- Cek role-aware menu dan active route tetap benar.
- Cek Login normal, error, loading profile, blocked user, dan logout blocked user.
- Cek Dashboard tidak membuat write flow baru dan semua action hanya navigasi.

## Standar Page Header dan action utama

- Title halaman berada di kiri dan harus menyebut konteks utama halaman.
- Subtitle bersifat opsional. Pakai subtitle singkat hanya jika menambah konteks operasional; hapus bila hanya mengulang title.
- Tombol action utama seperti `Tambah Produk`, `Tambah Planning`, `Tambah PO`, `Tambah Work Log`, atau action create lain berada di kanan header pada desktop/tablet lebar.
- Di mobile, action utama boleh wrap atau turun ke bawah selama tetap dalam container dan tidak overlap.
- Jangan meletakkan action utama di sisi kiri jika halaman sudah memakai pola title kiri + action kanan.
- Header tidak boleh dipakai untuk menjelaskan seluruh flow bisnis. Penjelasan panjang tetap di docs, bukan di UI harian.

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
- Warning cost tidak boleh dihapus.
- Warning tetap penting bila biaya material 0, biaya tenaga kerja 0, total biaya 0, atau HPP belum valid.
- Material cost, labor cost, overhead, total cost, dan output qty harus tetap bisa ditelusuri.

### Payroll
- Final amount, status payroll, payment status, dan include HPP harus jelas.
- Relasi `paid` ke Cash Out otomatis harus tetap bisa dipahami agar user tidak membuat pengeluaran ganda.

### HPP Analysis
- HPP invalid atau cost kosong wajib terlihat.
- Jangan menghapus warning yang membantu analisis biaya.
- Output qty dan komponen biaya utama harus tetap jelas.

### Stock
- Stok total, stok tersedia, stok dipesan/reserved, minimum stock, dan warning critical harus jelas.
- Adjustment stok harus tetap punya warning dan alasan.
- Item bervarian harus tetap menampilkan varian yang relevan.

### Sales, Purchases, dan Returns
- Item, qty, harga, subtotal, total, payment/status, dan dampak stok/kas harus jelas.
- Jangan mengubah makna field lewat copy yang terlalu bebas.

### Cash In dan Cash Out
- Sumber manual/otomatis harus jelas.
- Referensi transaksi, payroll, atau purchase harus jelas bila ada.
- Copy tidak boleh mendorong user membuat data manual ganda untuk sumber otomatis.

### Reset Maintenance
- Warning destructive wajib tegas.
- Preview wajib sebelum reset.
- Confirmation keyword tidak boleh disamarkan.
- Jangan membuat reset terdengar aman tanpa risiko.
- Scope reset, protected data, jumlah dokumen terdampak, status proses, dan hasil/audit harus tetap jelas.

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
- Pertahankan guard Ant Design sampai dependency modal/table/dropdown benar-benar jelas.
- Jangan hapus `!important` pada table/modal/drawer/dropdown/datepicker/popover sebelum cek light/dark dan fixed column.
- False-positive grep seperti `Message/message` bukan token warna lama dan tidak perlu diubah.

## Standar Login branding

- Halaman Login memakai logo resmi sebagai lockup brand yang clean, bukan ilustrasi besar dengan frame berat.
- Logo Login tidak boleh tertimpa orb/shape dekoratif.
- Panel brand dan form harus seimbang; form login tetap menjadi fokus utama user.
- Dekorasi background harus flat, lembut, berbasis token blue/navy + gold accent kecil, dan tidak memakai gradient baru.
- Perubahan Login harus mengutamakan CSS scoped `.ims-login-*`; `Login.jsx` hanya disentuh untuk struktur visual, bukan auth flow.
- `Login.jsx` auth flow, `handleLogin`, `profileStatus`, blocked user, dan logout blocked user adalah area **GUARDED**.

## Standar Login Mode A — Modern Bright Corporate

- Login Mode A memakai layout dua panel terang: brand hero kiri dan form card kanan.
- Logo Flanel Karawang Industries tampil bebas tanpa frame/showcase berat dan tidak boleh tertimpa orb/dekorasi.
- Brand panel boleh memakai shape/curve flat blue-gold yang halus, tetapi tidak boleh memakai gradient baru dan tidak boleh mengalahkan form login.
- Form login tetap menjadi fokus utama dengan card putih solid, shadow lembut, input jelas, dan button primary blue kuat.
- Mobile memakai prinsip form-first: form tampil terlebih dahulu, brand panel turun ke bawah agar tidak membuat scroll terlalu panjang.
- Perubahan Login harus scoped di `.ims-login-*`; auth flow, `AuthContext`, route guard, role access, dan modul bisnis tetap **GUARDED**.

## Standar Login full-page corporate final
- Halaman Login memakai komposisi full-page, bukan wrapper/card besar yang membungkus seluruh layout.
- Brand area kiri harus terasa menyatu dengan viewport, memakai aksen geometric minimalis, bukan dekorasi bulat besar yang dominan.
- Logo Flanel Karawang Industries menjadi elemen utama brand panel: besar, presisi, center, bebas dari frame berat, dan tidak tertimpa dekorasi.
- Copy brand dibuat kecil dan ringan agar tidak mengalahkan logo dan form login.
- Note internal ditempatkan sebagai supportive footer note, bukan elemen utama.
- Form login tetap menjadi fokus aksi dengan card putih solid, button primary blue, input readable, dan focus state jelas.
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
  - Table/data/card/chart/list: `DataLoadingState` skeleton/shimmer lokal tanpa logo, tanpa full-screen overlay, dan tanpa AntD spinner overlay custom.
  - Button/action/modal/process: loading lokal bawaan komponen tetap dipakai sesuai konteks aksi.
- `DataLoadingState` harus memakai class scoped `.ims-data-loading*`, mengikuti token theme IMS, support light/dark mode, mobile, dan `prefers-reduced-motion`.
- Jangan memakai `LogoLoadingScreen` untuk lazy page fallback di dalam layout, table/data/card karena akan terasa seperti loading kedua atau restart aplikasi.
- Jangan mengganti loading submit, export, maintenance repair/reset, Refresh Need, atau Refresh Preview tanpa task dan audit flow terpisah.

- Table initial loading yang sudah dipatch memakai `getDataTableEmptyText(...)` dan refresh lokal memakai `DataRefreshIndicator`; jangan kembali ke custom skeleton sebagai `Table loading` indicator karena bisa memicu overlay/double loading.
