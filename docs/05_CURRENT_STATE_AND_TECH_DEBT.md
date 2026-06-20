# CURRENT STATE & TECH DEBT — IMS Bunga Flanel

## Status source aktual — 2026-06-20

Status: **AKTIF / SOURCE-VERIFIED / SQLITE-FIRST**.

Source aktual `Inventory-App-clean.zip` menunjukkan IMS berjalan dengan arsitektur:

- Frontend React/Vite.
- Backend Node.js Express sebagai satu-satunya akses database.
- Database SQLite lokal/LAN di sisi backend.
- Auth lokal SQLite melalui endpoint `/api/auth/**`.
- Semua flow guarded wajib lewat endpoint/service resmi backend.

Dokumen ini menggantikan catatan lama yang masih mengarah ke runtime arsip. Jika ada arsip historis lain yang bertentangan dengan dokumen ini, gunakan source aktual dan dokumen ini sebagai acuan.

## Patch runtime status modul — digabung

Patch `ims-module-runtime-status.changed-files.zip` sudah digabung ke baseline docs cleanup ini. Scope patch tersebut:

- Backend menambah endpoint status modul melalui `/api/module-runtime-status` dan alias `/api/migration-status`.
- Backend maintenance status menampilkan jumlah row `module_migration_status`.
- UI Database Center menampilkan ringkasan status runtime modul.
- Checklist maintenance mengambil status dari backend, bukan dari asumsi docs lama.

Patch ini tidak mengubah schema guarded secara manual; tabel status modul sudah dikelola oleh migrasi SQLite yang ada di source patch.

## Modul runtime yang dianggap aktif SQLite

Berdasarkan `backend/src/db/migrate.js`, modul berikut berstatus `sqlite_active`:

- Auth & Role Guard.
- Customers.
- Categories.
- Suppliers.
- Pricing Rules.
- Products.
- Raw Materials.
- Semi Finished.
- Stock Engine.
- Purchases.
- Sales.
- Returns.
- Finance Ledger.
- Production.
- Payroll & HPP.
- Reports & Dashboard.

Konsekuensi:

- Patch baru tidak boleh mengarahkan modul di atas ke runtime arsip.
- Frontend tidak boleh membaca file `.sqlite` langsung.
- Data transaction/stock/finance/production/payroll/HPP tidak boleh ditulis lewat helper generic yang melewati service resmi.
- Status modul di Database Center adalah indikator bantu; keputusan patch tetap harus validasi source aktual.

## Area yang sudah matang

- Struktur frontend/backend sudah terpisah.
- Runner root `npm run dev` menjalankan backend dan frontend.
- Backup SQLite resmi sudah tersedia dengan checksum, manifest, dan restore guarded.
- Auth lokal sudah aktif dengan user/role/status di SQLite.
- Module Runtime Status tersedia di backend dan UI maintenance.
- Repository mode frontend diarahkan ke SQLite sidecar.
- Sales cancel/delete tetap dilarang; return menjadi jalur resmi barang kembali.
- Stock mutation utama sudah diarahkan ke stock engine/backend commit.
- Endpoint `POST /api/auth/login` dilindungi rate limit per IP: default 5 login gagal per 60 detik; login berhasil tidak menghabiskan kuota kegagalan.
- Backend memiliki automated regression test berbasis `node:test` untuk auth route aktual, cookie session, CORS, bootstrap guard, rate limit, stock engine, transaction atomicity, finance ledger, return, production, payroll/HPP, backup/restore, dan source hygiene.
- Session browser memakai cookie host-only `HttpOnly; SameSite=Lax`; response login tidak mengirim raw token ke JavaScript, endpoint auth memakai `Cache-Control: no-store`, dan header identitas Express dinonaktifkan.
- Session Bearer lama tetap diterima sementara dan dimigrasikan menjadi cookie melalui `/api/auth/me`, lalu token lama dibersihkan dari `localStorage` frontend.
- Bootstrap administrator pertama memakai kode setup acak yang hanya tampil di terminal backend; endpoint status tidak mengirim kode tersebut.
- `npm run check`, `git check`, dan pre-push menjalankan automated test backend serta frontend sebagai quality gate.
- Runner command Windows menjalankan `npm.cmd`/`npx.cmd` melalui `cmd.exe`, sehingga shortcut quality gate tidak gagal dengan `spawnSync ... EINVAL` pada Node.js Windows.
- Production P4 memusatkan create PO dari Planning, Start Production, Complete Work Log, auto payroll, Payroll Paid, finance posting, dan HPP reconcile pada transaction backend SQLite.
- Generic production CRUD tidak lagi dapat dipakai untuk melewati lifecycle sensitif Planning, Production Order, Work Log, atau Payroll.
- Automated regression aktif saat ini mencakup 63 test backend, 37 test frontend, dan 7 test tooling. Coverage backend mencakup rollback/idempotency produksi, backup/restore guarded, auth migration, serta source ZIP hygiene; coverage frontend mencakup auth, role guard, transaksi, endpoint atomic produksi, restore guarded, export XLSX, Dashboard, dan error login.

## Tech debt aktif yang masih perlu dijaga

### 1. Nama compatibility lama di source

Masih ada kemungkinan nama variable/comment lama yang tersisa untuk compatibility, misalnya nama actor/session lama. Jangan menyimpulkan runtime arsip aktif hanya dari nama variable. Audit import, package dependency, endpoint, dan service aktual terlebih dahulu.

### 2. Data historis dan referensi teknis

Data historis bisa masih membawa field/ID teknis. UI tetap wajib menampilkan referensi manusiawi:

1. Kode bisnis transaksi/master/produksi.
2. `sourceRef` / `referenceNumber` yang readable.
3. Fallback manusiawi seperti `-` atau `Referensi belum tersedia`.

Jangan menampilkan ID database teknis sebagai judul, subtitle, tooltip, drawer, report UI, export user-facing, atau audit reference utama.

### 3. Stock read model dan mutation

Read model stok boleh dipakai untuk tampilan/report. Mutation stok tetap wajib melalui endpoint/service resmi:

- Stock adjustment commit.
- Purchase stock-in.
- Sales stock-out.
- Return stock restore.
- Production material usage/output.

Jangan membuat perhitungan stok baru di UI.

### 4. Sales, purchases, dan returns

- Sales tidak boleh punya cancel/delete user-facing.
- Return adalah jalur resmi barang kembali.
- Purchase/Sales/Return wajib menjaga audit log dan finance side effect sesuai aturan backend.
- Jangan membuat direct write generic ke transaksi.

### 5. Finance ledger

- Income/expense/ledger tidak boleh dihitung ulang bebas di UI.
- Posting otomatis dari sales/purchase/payroll harus idempotent.
- Profit/Loss membaca sumber final yang sudah diposting, bukan draft/preview.

### 6. Production, payroll, dan HPP

- Target dan requirement Production Order wajib berasal dari BOM; payload client tidak boleh mengganti target BOM.
- Create PO dari Planning wajib atomic dengan update relasi/status Planning.
- Start Production wajib memotong seluruh material, membuat satu Work Log, dan mengubah PO menjadi `in_production` dalam satu transaction.
- Complete Work Log wajib memakai snapshot material dari Start, menambah output, membuat payroll draft, menghitung accrued HPP, dan menutup PO dalam satu transaction.
- Payroll final/paid tetap menjadi source final adjustment labor actual; HPP reconcile tidak boleh menambah qty output ulang.
- Payroll paid wajib atomic dengan expense/ledger dan idempotent terhadap expense current maupun compatibility legacy.
- Direct write generic ke relasi/status/flag stok/payroll/HPP yang guarded harus ditolak backend.
- Production Order, Work Log, dan Payroll tidak boleh diproses dua kali.

### 7. Backup, restore, dan reset

- Backup resmi memakai satu file compact `.imsbackup` dari backend; backup legacy `.imsbak.zip` tetap didukung untuk restore.
- Restore wajib import/daftar backup resmi, preview, validasi, pre-restore backup, keyword `RESTORE DATABASE`, dan audit log. Backup `pre-restore` dan backup sumber restore harus dipastikan tercatat ulang ke database hasil restore agar rollback serta traceability tetap terlihat di daftar backup.
- Export Master aktif membaca data master SQLite secara read-only dari backend untuk arsip/review; export ini bukan paket restore dan tidak boleh menggantikan `.imsbackup`.
- Reset testing lama tetap nonaktif/redirect lama.
- Destructive action wajib punya scope jelas, confirm guard, dan audit log.

### 8. UI/UX

- UI harus clean, compact, profesional, dan aman untuk data banyak.
- Mobile tidak boleh memaksa tabel desktop penuh bila data utama panjang.
- Empty/loading/error state wajib jelas.
- Dark mode dan light mode harus tetap terbaca.

### 9. Auth hardening dan automated test

- Cookie `HttpOnly` mengurangi risiko pencurian token melalui JavaScript, tetapi tidak membuat XSS aman sepenuhnya; dependency frontend dan sink HTML tetap harus diaudit.
- Cookie `Secure` default `false` karena runtime IMS memakai HTTP lokal/LAN. Aktifkan `IMS_AUTH_COOKIE_SECURE=true` hanya saat frontend dan backend benar-benar tersedia melalui HTTPS.
- CORS default hanya menerima origin dengan hostname yang sama seperti backend atau pasangan loopback `localhost`/`127.0.0.1`. Origin tambahan harus didaftarkan eksplisit melalui `IMS_SQLITE_CORS_ORIGIN` dipisahkan koma; wildcard tidak dipakai untuk credentialed cookie.
- Bearer fallback dipertahankan sementara untuk compatibility session lama dan dikontrol melalui `IMS_AUTH_ALLOW_LEGACY_BEARER=true`. Setelah seluruh perangkat login ulang serta checklist Database Center menyatakan aman, ubah ke `false`; flow baru dilarang menulis token ke `localStorage`.
- Login dan bootstrap rate limiting memakai in-memory store karena IMS berjalan single-process di LAN. Counter akan reset saat backend restart; gunakan store eksternal hanya jika arsitektur berubah menjadi multi-process/multi-instance.
- Automated test sudah mencakup atomic core Production, backup/restore guarded, source hygiene, auth frontend, role guard, ProtectedRoute, Dashboard, dan error login. Coverage belum mencakup seluruh variasi halaman transaksi/report/produksi dan interaksi maintenance kompleks; area tersebut tetap wajib menjalani checklist manual.
- Test runner menemukan seluruh file `*.test.js` secara otomatis. `npm run check`, `git check`, dan pre-push wajib gagal jika automated test gagal.
- Source readiness menolak file runtime di `data/` atau `backups/` yang ter-track; script clean ZIP menjalankan guard sebelum `git archive` lalu memverifikasi artifact ZIP aktual. ZIP dengan path backslash, folder runtime/generated, database, backup, atau struktur source tidak lengkap akan ditolak dan dihapus. Hapus artifact dari Git index dengan `git rm --cached` tanpa menghapus backup lokal yang masih diperlukan.

## Jangan dilakukan tanpa approval eksplisit

- Mengubah schema SQLite.
- Mengubah route/menu/role guard.
- Mengubah status flow sales/purchase/return/production/payroll.
- Mengubah stock mutation, finance ledger, HPP final, atau payroll paid flow.
- Menghidupkan runtime arsip.
- Membuat direct database access dari frontend.
- Menghapus compatibility helper sebelum audit usage.
- Membuat service/helper baru jika helper existing sudah tersedia.
- Melakukan formatting massal file tidak terkait.

## Checklist audit sebelum patch berikutnya

- [ ] Validasi ZIP/source terbaru.
- [ ] Cek file aktual yang menangani fitur.
- [ ] Cek import dan usage.
- [ ] Cek route/menu/role guard jika fitur user-facing.
- [ ] Cek service/helper existing sebelum membuat logic baru.
- [ ] Cek audit log dan histori transaksi untuk area guarded.
- [ ] Cek backup/restore/reset guard jika menyentuh maintenance.
- [ ] Cek docs terkait dan update bila source berubah.
- [ ] Pastikan docs tidak mengarahkan kembali ke runtime arsip.

## Update P8A–P12 — 2026-06-20

### P8A — evidence migrasi session legacy

- Endpoint `/api/auth/me` mencatat audit `legacy_bearer_migrated` hanya ketika session lama benar-benar datang melalui Bearer dan kemudian diberi cookie HttpOnly.
- Audit migrasi dibuat idempotent per `local_user_session`; request Bearer berulang dari session yang sama tidak menambah audit duplikat.
- Maintenance Center menampilkan jumlah migrasi, migrasi tujuh hari terakhir, dan waktu migrasi terakhir.
- Evidence tersebut tidak otomatis membuktikan semua perangkat sudah selesai. Konfirmasi manual laptop/HP tetap wajib sebelum `IMS_AUTH_ALLOW_LEGACY_BEARER=false`.
- Parser Bearer belum dihapus permanen karena cutover operasional seluruh perangkat belum dapat dibuktikan dari source.

### P9 — dependency hardening selektif

- Backend lockfile memakai `tar 7.5.16` dan `undici 6.27.0`; audit lockfile backend bersih.
- Frontend tetap pada Vite major 7 dan memakai `7.3.5`; `@babel/core` dan `js-yaml` dipin ke versi perbaikan.
- `@ant-design/charts` dihapus setelah audit usage membuktikan tidak dipakai.
- Residual `xlsx` dan `esbuild` didokumentasikan di `docs/20_DEPENDENCY_SECURITY_AUDIT.md`; tidak dilakukan major/override paksa yang belum teruji.

### P10 — frontend critical-flow regression

Automated test frontend sekarang juga menjaga:

- Purchase/Sales/Return hanya memakai commit service resmi dan memblokir input invalid sebelum request.
- Sales cancel tetap ditolak.
- Return tetap wajib terkait Sales dan qty tidak melebihi sisa.
- Production lifecycle memanggil endpoint commit atomic yang benar.
- Responsive navigation memakai canonical hub `/inventory` dan `/production`, mempertahankan `/stock` serta `/produksi` sebagai redirect role-guarded, dan menjaga active descendant route, nested parent key, serta role-aware module visibility.
- Penyelesaian Work Log mengirim Good Qty, operator, dan catatan langsung ke endpoint complete atomic tanpa direct update pendahuluan.
- Restore memakai preview/execute endpoint guarded dengan cookie credentials.
- Export XLSX tetap write-only.

### P11 — bundle budget

- Full check menjalankan budget asset JavaScript setelah build.
- Default budget per asset adalah 1.100.000 byte dan dapat diubah sementara melalui `IMS_FRONTEND_MAX_JS_BYTES` untuk investigasi, bukan untuk menyembunyikan regresi.
- Nilai override bundle budget wajib integer positif; nilai kosong, nol, pecahan, atau non-numerik ditolak agar quality gate tidak lolos secara palsu.
- Route lazy dan dynamic import tetap dipertahankan; manual chunk tidak ditambahkan secara spekulatif.

### P12 — cleanup terverifikasi

- Wrapper `productionCodeGenerator.js` dihapus setelah audit import/usage tidak menemukan pemanggil aktif.
- Export compatibility `getStoredLocalAuthToken` dihapus setelah audit usage membuktikan tidak memiliki pemanggil; pembacaan token legacy tetap terpusat internal di `sqliteBackendStatusService.js` selama P8A.
- Redirect route lama, format backup legacy, repository mode, dan Bearer compatibility tetap dipertahankan karena masih memiliki fungsi compatibility atau belum terbukti aman untuk dihapus.

### Temuan merge P4 yang dikoreksi

Test discovery otomatis menemukan bahwa empat file regression Production P4 sudah ada, tetapi implementasi atomic pada `production.service.js`, `production.controller.js`, dan validator generic route belum ikut dalam source ZIP terbaru. Kondisi tersebut sebelumnya tersembunyi karena script backend hanya menjalankan daftar test lama secara manual. Patch ini mengembalikan endpoint/service atomic P4 dan validator lifecycle; seluruh test Production kembali lulus. Ini menjadi alasan test discovery tidak boleh kembali diganti dengan daftar file manual.
