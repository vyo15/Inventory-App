# IMS Dependency Security Audit

Tanggal audit source: 2026-07-02

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
- `dayjs@^1.11.20` dan `@ant-design/icons@^5.6.1` sekarang dideklarasikan langsung karena source mengimpornya secara langsung; project tidak lagi bergantung pada hoisting transitif dari Ant Design.
- Seluruh URL resolved lockfile memakai registry npm publik.

Residual yang belum diubah secara paksa. Patch concurrent-write/runtime-counter tidak mengubah dependency atau lockfile:

### `xlsx@0.18.5`

Package npm `xlsx` tidak menyediakan versi perbaikan pada registry npm. IMS hanya memakai library ini melalui adapter export-only untuk membentuk file XLSX dari data internal aplikasi. Tidak ada API workbook read/parse terhadap file spreadsheet dari user pada flow aktif.

Guard yang diterapkan:

- Akses package dipusatkan di `sheetJsWriteAdapter.js`.
- Adapter hanya memakai `utils.aoa_to_sheet`, `utils.book_new`, `utils.book_append_sheet`, dan `write`.
- Automated source-safety test memastikan hanya adapter tersebut yang boleh mengimpor `xlsx` dan menolak API read/parse workbook.
- Export XLSX dan CSV menetralkan prefix formula spreadsheet (`=`, `+`, `-`, `@`) sebelum data ditulis ke file.
- Import tetap dynamic agar package tidak masuk startup utama.
- Source aktual tidak menerima upload spreadsheet dan tidak memakai `read`, `readFile`, `sheet_to_json`, atau `sheet_to_csv`.

Hasil audit lockfile 2026-07-01 masih melaporkan advisory high pada `xlsx@0.18.5`; mitigasi di atas mengurangi reachability pada flow aktif, tetapi tidak boleh diklaim sebagai penghapusan vulnerability package.

Migrasi ke distribusi SheetJS resmi yang lebih baru harus menjadi patch dependency terpisah setelah package tarball resmi, checksum/provenance, lockfile, install Windows, export report, dan offline build teruji. Audit 2026-07-02 tidak mengubah dependency karena sandbox tidak dapat menyelesaikan pengambilan tarball resmi dan lockfile tidak boleh direkayasa manual.

### `esbuild@0.27.7`

Audit lockfile 2026-07-02 tetap melaporkan advisory low pada development server untuk versi `esbuild@0.27.7`. Residual ini berasal dari toolchain Vite major 7 dan bersifat development/build-time. Upgrade paksa melalui override tidak dilakukan karena dapat melanggar dependency range Vite. Upgrade Vite/esbuild harus melalui migration review, dev-server Windows test, dan full regression, bukan `audit fix --force`.


## Coverage dan SBOM evidence

- Frontend memakai `@vitest/coverage-v8` dengan threshold critical-flow pada `frontend/vite.config.js`.
- `npm --prefix frontend run test:coverage` menghasilkan text, HTML, dan `coverage-summary.json`.
- `npm run sbom` menghasilkan CycloneDX backend/frontend dari lockfile ke `.artifacts/sbom/`.
- CI mengunggah coverage summary dan SBOM sebagai artifact; `.artifacts/` tidak boleh masuk source ZIP.
- `THIRD_PARTY_NOTICES.md` menjelaskan status dependency pihak ketiga. Lisensi source IMS sendiri tetap menunggu keputusan eksplisit owner.

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

## Hardening tanpa upgrade dependency — 2026-06-21

- Runtime Node dipatok `>=22.12.0 <23` dengan rekomendasi `22.16.0`; CI membaca `.nvmrc`.
- Security headers, structured logging/rotation, OpenAPI, common-password denylist, queue telemetry, dan vendor split ditambahkan tanpa dependency runtime baru.
- Vendor split hanya memisahkan React/React Router dan Day.js untuk menghindari circular chunk Ant Design/rc-component. Chunk terbesar sekitar 706.6 KiB dan tetap di bawah budget 1074.2 KiB.
- Residual `xlsx` dan `esbuild` tetap ada; hardening di atas tidak boleh diklaim sebagai penghapusan vulnerability dependency tersebut.
