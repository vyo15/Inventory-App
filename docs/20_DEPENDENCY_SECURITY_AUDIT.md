# IMS Dependency Security Audit

Tanggal audit source: 2026-06-21

## Scope

Audit dilakukan terhadap lockfile aktual:

- `backend/package-lock.json`
- `frontend/package-lock.json`

Perubahan dependency harus selektif. Jangan menjalankan `npm audit fix --force` karena dapat mengubah major version, native dependency, atau build tool tanpa regression review.

## Hasil backend

Perbaikan lockfile:

- `tar` dipaksa ke `7.5.16` melalui `overrides`.
- `undici` dipaksa ke `6.27.0` melalui `overrides`.
- Backend memakai test discovery `node scripts/run-tests.cjs` agar seluruh `*.test.js` selalu dijalankan.

Hasil `npm --prefix backend audit --package-lock-only` setelah patch: 0 vulnerability.

## Hasil frontend

Perbaikan lockfile:

- Vite tetap pada major 7 dan dinaikkan ke `7.3.5`.
- `@babel/core` dipaksa ke `7.29.7`.
- `js-yaml` dipaksa ke `4.2.0`.
- Dependency `@ant-design/charts` dihapus karena audit import/usage tidak menemukan pemanggil aktif.
- Seluruh URL resolved lockfile memakai registry npm publik.

Residual yang belum diubah secara paksa. Patch concurrent-write/runtime-counter tidak mengubah dependency atau lockfile:

### `xlsx@0.18.5`

Package npm `xlsx` tidak menyediakan versi perbaikan pada registry npm. IMS hanya memakai library ini melalui adapter export-only untuk membentuk file XLSX dari data internal aplikasi. Tidak ada API workbook read/parse terhadap file spreadsheet dari user pada flow aktif.

Guard yang diterapkan:

- Akses package dipusatkan di `sheetJsWriteAdapter.js`.
- Adapter hanya memakai `utils.aoa_to_sheet`, `utils.book_new`, `utils.book_append_sheet`, dan `write`.
- Automated test menjaga jalur tersebut tetap write-only.
- Import tetap dynamic agar package tidak masuk startup utama.

Migrasi ke distribusi SheetJS resmi yang lebih baru harus menjadi patch dependency terpisah setelah package tarball, lockfile, install Windows, export report, dan offline build teruji.

### `esbuild@0.27.7`

Residual ini berasal dari toolchain Vite major 7 dan bersifat development/build-time. Upgrade paksa melalui override tidak dilakukan karena dapat melanggar dependency range Vite. Upgrade ke Vite major berikutnya harus melalui migration review dan full regression, bukan `audit fix --force`.

## Quality gate setelah perubahan dependency

Wajib dijalankan:

```bash
npm install
npm test
npm --prefix frontend run lint
npm --prefix frontend run build
npm run check:bundle
npm run git:check:full
```

## Larangan

- Jangan mengganti SQLite/native package tanpa pengujian database temporary dan database operasional backup.
- Jangan mengubah major React, Vite, Ant Design, router, atau SheetJS dalam patch cleanup biasa.
- Jangan menerima package registry internal/non-portable di lockfile.
- Jangan menandai residual sebagai selesai hanya karena dependency bersifat transitive; tetap dokumentasikan reachability dan mitigasinya.
