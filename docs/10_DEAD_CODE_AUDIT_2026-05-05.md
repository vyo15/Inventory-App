# Dead Code Audit — 2026-05-05

Audit ini mengikuti aturan cleanup konservatif IMS Bunga Flanel: hapus hanya yang terbukti tidak dipakai, jangan ubah behavior, dan tandai area yang belum aman sebagai cleanup candidate.

## Sumber Audit

- Commit GitHub `main`: `380880fcb935edbacc29f7577b2a2bdeea790428`
- Snapshot kerja: `Inventory-App.zip` yang diunggah user
- Entry runtime: `src/main.jsx`
- Tooling yang dijalankan: import graph lokal, grep reference, ESLint

## Aman Dihapus / Sudah Dibersihkan

| Kandidat | Status | Bukti | Implementasi |
| --- | --- | --- | --- |
| `src/components/Dashboard/SalesChart.jsx` | aman dihapus | Tidak reachable dari `src/main.jsx`, tidak di-import oleh route/component mana pun, grep hanya menemukan definisi file sendiri. | File dihapus. |
| Dependency `@ant-design/charts` | aman dihapus | Satu-satunya pemakaian ada di `SalesChart.jsx` yang dihapus. | Dihapus dari `package.json` dan `package-lock.json`. |
| Import `calculateAvailableStock` di `productionVariantMaintenanceService.js` | aman dihapus | ESLint `no-unused-vars`; tidak dipakai dalam file. | Import dihapus. |
| Variable lokal `issues` di `productionVariantMaintenanceService.js` | aman dihapus | ESLint `no-unused-vars`; tidak dibaca setelah dibuat. | Variable dihapus. |
| Import `calculateAvailableStock` di `productionOrdersService.js` | aman dihapus | ESLint `no-unused-vars`; tidak dipakai dalam file. | Import dihapus. |
| Escape regex `\-` di `productionOrdersService.js` | aman dibersihkan | ESLint `no-useless-escape`; regex tetap sama dengan `[_-]`. | Regex dirapikan. |
| Omit `payload` audit di `inventoryMaintenanceService.js` | aman dibersihkan | Destructuring lama memicu `no-unused-vars`; logic tetap hanya menghapus field payload dari output audit. | Diganti menjadi copy + `delete auditRow.payload`. |
| `availableItems` di `StockAdjustmentPanel.jsx` | aman dibersihkan | ESLint hook warning; nilai sama, hanya distabilkan dengan `useMemo`. | Dibungkus `useMemo`. |
| `!Boolean(...)` di `productionPageHelpers.js` | aman dibersihkan | ESLint `no-extra-boolean-cast`; hasil boolean sama. | Diganti menjadi negasi langsung. |

## Cleanup Candidate — Jangan Dihapus di Patch Ini

| Kandidat | Status | Alasan ditahan |
| --- | --- | --- |
| Root `assets/index-*.js`, `assets/index-*.css`, `assets/worker-*.js` | cleanup candidate / perlu audit lanjut | Terlihat seperti build artifact dan tidak direferensikan `index.html` source, tetapi perlu konfirmasi konfigurasi hosting GitHub Pages/Firebase sebelum delete dari branch utama. |
| Banyak named export di `src/services/**`, `src/constants/**`, dan `src/utils/**` | cleanup candidate | Static import graph menunjukkan sebagian export tidak di-import langsung, tetapi service/constant production, maintenance, dan legacy compatibility bisa menjadi API internal antar batch. Jangan hapus tanpa audit per modul. |
| Helper auth/role legacy seperti role lama dan route access helper | jangan dihapus | Role legacy masih berpotensi menjaga kompatibilitas data/user lama. |
| `gh-pages` | jangan dihapus | Dipakai oleh script `deploy`. |
| `@types/react` dan `@types/react-dom` | jangan dihapus | Dev dependency untuk tooling/editor/type support, walaupun proyek dominan JavaScript. |
| `node_modules/**` dalam ZIP upload | jangan dipatch | Bukan source repo dan sudah di-ignore. Bersihkan dari arsip upload lokal bila ingin ukuran ZIP kecil, bukan dari patch source. |

## IMS NOTE

- `productionOrdersService.js` diberi komentar `IMS NOTE - CLEANUP CANDIDATE` pada export reserve/release legacy karena belum terbukti dipakai route aktif, tetapi menyentuh kompatibilitas Production Order guarded.
- `productionPageHelpers.js` diberi komentar `IMS NOTE - CLEANUP CANDIDATE` pada helper search export agar tidak dihapus hanya karena export-nya belum di-import langsung.

## Hasil Validasi

- ESLint: lolos tanpa error dan tanpa warning setelah patch.
- Build: belum berhasil divalidasi karena `node_modules` dari ZIP tidak memiliki optional dependency Rollup native `@rollup/rollup-linux-x64-gnu`. Ini masalah environment/install dependency, bukan error source cleanup yang terdeteksi ESLint.

