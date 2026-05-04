# 09 UI Theme Guide — IMS Bunga Flanel

Dokumen ini menjadi panduan praktis theme aktif IMS Bunga Flanel setelah rebrand visual mengikuti logo Flanel Karawang Industries.

## Theme aktif

Theme aktif memakai kombinasi **blue, yellow, white, dan navy** dengan arah visual minimalist modern, clean, proporsional, profesional, dan corporate.

## Palette utama

### Light theme
| Token | Value | Pemakaian |
|---|---:|---|
| Primary | `#2C6DB0` | primary action, active navigation, link, focus ring |
| Primary hover | `#245F9D` | hover action |
| Primary active | `#1B4F86` | active/pressed action |
| Primary soft | `#EAF3FC` | selected state, info soft background |
| Accent yellow | `#FEC32D` | accent kecil, badge, warning soft |
| Accent yellow soft | `#FFF4CC` | highlight lembut |
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
| Accent yellow | `#FFD56A` | accent kecil/highlight |
| Accent yellow soft | `rgba(254, 195, 45, 0.16)` | warning/highlight soft |
| Page background | `#07111F` | canvas dark navy |
| Shell background | `#0A1627` | app shell dark |
| Card background | `#101E33` | card/table/form dark |
| Card soft | `#172A45` | secondary surface dark |
| Elevated | `#1B304D` | modal/drawer/dropdown |
| Border | `rgba(147, 184, 223, 0.18)` | border dark |
| Text primary | `#EAF2FB` | text utama dark |
| Text secondary | `rgba(234, 242, 251, 0.72)` | helper/subtitle dark |

## Aturan penggunaan warna

- Biru dipakai untuk primary action, active navigation, link, selected state, dan focus ring.
- Kuning dipakai sebagai accent kecil, badge, highlight, atau warning soft.
- Putih/neutral dipakai sebagai surface utama card, modal, drawer, table, dan form.
- Dark navy dipakai sebagai shell, card, elevated surface, drawer/modal/table dark mode.
- Gradient boleh dipakai selama halus, profesional, dan berbasis blue/yellow/white/navy.
- Hindari warna decorative lama sebagai theme aktif.

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
- Dekorasi background harus lembut dan berbasis token blue/yellow/white/navy.
- Perubahan Login harus mengutamakan CSS scoped `.ims-login-*`; `Login.jsx` hanya disentuh untuk struktur visual, bukan auth flow.
- `Login.jsx` auth flow, `handleLogin`, `profileStatus`, blocked user, dan logout blocked user adalah area **GUARDED**.

## Standar Login Mode A — Modern Bright Corporate

- Login Mode A memakai layout dua panel terang: brand hero kiri dan form card kanan.
- Logo Flanel Karawang Industries tampil bebas tanpa frame/showcase berat dan tidak boleh tertimpa orb/dekorasi.
- Brand panel boleh memakai shape/curve/gradient blue-yellow yang halus, tetapi tidak boleh mengalahkan form login.
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
