# OFFLINE DATABASE CONTRACT — IMS Bunga Flanel

Status: **AKTIF / SOURCE-VERIFIED / SQLITE-FIRST**.

Source aktual memakai backend Node.js + SQLite sebagai runtime utama. Dokumen ini adalah kontrak aktif untuk database lokal/LAN IMS.

## Prinsip utama

1. Backend adalah satu-satunya akses database.
2. Frontend hanya memanggil API HTTP backend.
3. File `.sqlite` tidak boleh dibaca/ditulis langsung dari frontend.
4. Modul guarded wajib lewat endpoint/service resmi.
5. Backup dan restore wajib lewat Database Center/backend maintenance.
6. Runtime lama tidak boleh dihidupkan kembali tanpa approval eksplisit.
7. Docs lama yang bertentangan dianggap arsip historis.

## Scope SQLite aktif

- Auth dan role guard.
- Master data.
- Stock engine dan read model.
- Purchases, sales, returns.
- Finance ledger.
- Production, payroll, HPP.
- Reports dan dashboard.
- Maintenance, backup, restore.
- Module Runtime Status.

## Runtime file dan shutdown contract

- Database aktif tetap satu database logis walaupun mode WAL dapat membuat tiga file fisik di folder `data/`: `.sqlite`, `.sqlite-wal`, dan `.sqlite-shm`.
- File WAL/SHM wajib berada di folder yang sama dengan file utama dan dikelola SQLite. User dilarang menghapus, memindahkan, atau menyalinnya secara parsial saat backend aktif.
- Backend wajib menangani `SIGINT`, `SIGTERM`, dan `SIGHUP` serta `SIGBREAK` pada Windows, berhenti menerima request baru, menunggu HTTP server close, menjalankan `PRAGMA wal_checkpoint(TRUNCATE)`, lalu menutup koneksi SQLite.
- Dev runner wajib menunggu child backend/frontend berhenti. Parent tidak boleh memotong cleanup database dengan fixed timeout sangat pendek; force-stop hanya menjadi fallback setelah timeout shutdown yang wajar.
- Setelah shutdown normal, file WAL/SHM harus dilepas. Jika proses mati paksa, sidecar dapat tertinggal dan harus dibiarkan agar SQLite melakukan recovery saat backend dibuka kembali.
- Backup portable tetap satu file `.imsbackup`; database runtime tidak boleh dijalankan langsung dari package backup.

## Guard mutation

Mutation berikut wajib atomic/guarded di backend:

- Stock adjustment.
- Purchase stock-in.
- Sales stock-out.
- Return stock restore.
- Production material usage/output.
- Payroll paid expense posting.
- Backup/restore/reset maintenance.

## Backup contract

Backup resmi harus:

- Dibuat dari backend dengan snapshot SQLite-aware, bukan copy file runtime saat aplikasi aktif.
- Berformat satu file khusus IMS `.imsbackup`.
- Menggunakan paket compact berisi `database.sqlite`, `manifest.json`, `checksum.sha256`, dan `README_RESTORE.txt` secara internal.
- Tidak membuat file `.manifest.json` baru di samping package; sidecar lama hanya dibaca untuk kompatibilitas.
- Memiliki manifest/checksum dan lolos integrity serta foreign-key check sebelum nama final dipasang secara atomik.
- Dicatat di backup logs dan audit log.
- Bisa didownload dari Database Center.
- Bisa diverifikasi sebelum restore.
- Disalin keluar laptop/server secara berkala oleh user.

Struktur folder aktif wajib sederhana:

```text
backups/sqlite/
├── daily/
├── monthly/
└── manual/
```

Kebijakan retensi:

- `daily`: maksimal satu verified per hari, simpan 60 hari.
- `monthly`: satu snapshot per bulan dari daily verified terakhir, simpan maksimal 12 bulan. Batas hari/bulan mengikuti kalender lokal komputer backend agar konsisten dengan waktu operasional IMS.
- `manual`: tidak dihapus otomatis; import, pre-update, pre-reset, pre-repair, dan pre-restore memakai storage class manual.
- Cleanup daily hanya boleh dilakukan jika monthly verified untuk bulan terkait sudah tersedia.
- Setiap promosi monthly dan penghapusan retention wajib memiliki audit log.
- Backup `pre-repair` wajib dibuat sebelum rebuild/cleanup data turunan stok dan disimpan pada storage class `manual`.
- Import backup wajib exclusive dan atomic antara file package, `backup_logs`, serta audit log. Jika DB/audit gagal, registry di-rollback dan file import dibersihkan.

Backup legacy `.imsbak.zip`, folder lama, dan sidecar manifest lama tetap boleh dibaca untuk restore agar file lama tidak terputus kompatibilitasnya, tetapi source baru tidak membuat struktur lama lagi.

## Restore contract

Restore resmi harus:

- Memakai backup yang terdaftar atau file `.imsbackup` yang diimport dan valid.
- Menampilkan preview.
- Memvalidasi integrity/checksum.
- Membuat pre-restore backup.
- Mendaftarkan ulang pre-restore backup ke database hasil restore agar file rollback tetap muncul di daftar backup setelah database aktif diganti.
- Memastikan backup sumber restore juga tercatat di database hasil restore, terutama jika sumber restore berasal dari import file luar.
- Meminta keyword confirm `RESTORE DATABASE`.
- Mencatat restore log.
- Mengganti database melalui candidate file dan swap lokal, bukan copy overwrite langsung.
- Mengembalikan database sebelum restore secara otomatis jika migrasi, post-validation, atau audit restore gagal.
- Mencatat `restore_rollback` pada database yang berhasil dipulihkan.
- Menolak restore jika backup tidak valid.
- Bersifat full restore/replace database aktif, bukan merge data.

## Export Master contract

- Export Master membaca master data SQLite dari backend secara read-only.
- Export Master boleh dipakai untuk arsip, review, atau checklist input ulang manual.
- Export Master bukan file restore penuh dan tidak boleh dipakai untuk merge transaksi/stok/finance/produksi.
- Restore penuh tetap hanya melalui File Backup IMS `.imsbackup` yang valid checksum/integrity.

## Dashboard/report contract

- Read-only.
- Boleh partial fallback bila section gagal.
- Tidak boleh white screen total karena satu data gagal.
- Tidak boleh melakukan repair/reset/mutation otomatis.
- Tidak boleh menampilkan technical ID sebagai data utama user-facing.

## Concurrent access contract

- Backend tetap memakai satu koneksi SQLite singleton, tetapi semua method database wajib melewati FIFO coordinator `backend/src/db/connection.js`.
- `runInTransaction()` adalah satu-satunya boundary `BEGIN/COMMIT/ROLLBACK` aplikasi. Service dilarang membuat transaction manual sendiri.
- Transaction memegang akses eksklusif sampai commit/rollback. Read dan write lain wajib menunggu agar tidak melihat state belum commit atau ikut masuk ke transaction request lain.
- Helper stock, finance, dan audit yang dipanggil dari transaction wajib reentrant; helper tersebut tidak boleh memasang mutex/transaction sendiri.
- WAL dan `busy_timeout` tetap dipakai sebagai locking database, tetapi bukan pengganti serialization JavaScript.
- Backup snapshot, retention lifecycle, close/reopen connection, dan restore file swap wajib berjalan di dalam serialized database operation.
- Managed business code wajib direservasi melalui `business_code_counters` di transaction create/commit. Preview code tidak menjamin nomor final; response server adalah source of truth.
- Kode historis dan custom reference tetap compatibility. Kode soft-deleted tidak boleh dipakai ulang.

## Automated regression contract

- Automated backend test wajib memakai database SQLite temporary, bukan database operasional.
- Automated frontend test wajib memakai environment DOM terisolasi dan tidak boleh memanggil database/backend operasional.
- Test runner aktif melalui `npm test` di root; backend menemukan file `*.test.js` secara otomatis dan frontend menjalankan Vitest.
- `npm run check`, `git check`, dan pre-push wajib menjalankan automated test backend + frontend; test yang gagal harus menghentikan quality gate.
- Perubahan auth, stock engine, purchase, sales, return, atau finance wajib mempertahankan regression test terkait.
- Automated coverage backend aktif melindungi auth route aktual, cookie `HttpOnly`, migrasi/disable Bearer legacy, bootstrap code guard, CORS same-host, rate limiting login, stock/transaction/finance/return, production/payroll/HPP, backup/restore guarded, dan source ZIP hygiene.
- Automated backend juga melindungi database queue diagnostics, atomic backup import, manual finance duplicate guard, maintenance data audit/rebuild/cleanup, security headers, structured logger, OpenAPI, dan password umum.
- Runtime resmi adalah Node `>=22.12.0 <23`; quality gate wajib menjalankan `npm run check:runtime`.
- Automated coverage frontend aktif melindungi auth service, Login error state/bootstrap, ProtectedRoute, role access matrix, dan Dashboard role-aware.
- Report, seluruh variasi UI transaksi/produksi, serta interaksi maintenance kompleks tetap memerlukan checklist manual sampai coverage khusus ditambahkan.
- Test tidak boleh mengubah schema, route, role guard, atau business rule hanya agar assertion lulus. Jika test menemukan bug, perbaikan business logic harus menjadi patch terpisah dan direview.

## Maintenance data integrity contract

- `GET /api/maintenance/data-audit` bersifat administrator-only dan read-only. Audit boleh membaca integrity SQLite, foreign key, invariant stok, stock read model, backup registry, dan pasangan kas-ledger.
- `GET /api/maintenance/stock-read-model-audit` wajib membedakan `missing`, `stale`, dan `orphan`.
- Rebuild hanya boleh menulis `stock_read_models` dari master Product/Raw Material/Semi Finished, setelah backup `pre-repair`, di dalam transaction, dan dengan audit log.
- Cleanup orphan wajib keyword `BERSIHKAN DATA STOK`, backup `pre-repair`, transaction, dan audit log.
- Tool ini dilarang mengubah stock master, inventory log, transaksi, finance, production, payroll, atau HPP.
- Endpoint OpenAPI ringkas tersedia administrator-only di `GET /api/openapi.json`; kontrak dokumentasi bukan pengganti backend role guard.

## Auth session dan bootstrap contract

- Session browser utama memakai cookie host-only `ims_session` dengan `HttpOnly`, `SameSite=Lax`, dan `Path=/`.
- Cookie `Secure` hanya diaktifkan untuk deployment HTTPS melalui `IMS_AUTH_COOKIE_SECURE=true`; runtime HTTP LAN harus tetap `false` agar login berfungsi.
- Frontend wajib memakai `credentials: "include"` pada seluruh request backend, termasuk download/import backup.
- Response login tidak boleh mengembalikan raw token ke JavaScript; seluruh endpoint auth wajib memakai `Cache-Control: no-store` dan server tidak mengekspos header `X-Powered-By`.
- Bearer token lama ditolak secara default. Compatibility dapat diaktifkan sementara dengan `IMS_AUTH_ALLOW_LEGACY_BEARER=true` agar `/api/auth/me` memigrasikan perangkat lama ke cookie; setelah migrasi, flag wajib dikembalikan ke `false`. Flow baru dilarang menulis token ke `localStorage`.
- CORS credentialed hanya mengizinkan hostname yang sama/loopback atau origin tambahan eksplisit dari `IMS_SQLITE_CORS_ORIGIN`; wildcard `*` tidak berlaku.
- Bootstrap administrator pertama wajib kode setup terminal minimal 8 karakter. Endpoint public tidak boleh mengirim kode setup.
- Setelah administrator aktif tersedia, endpoint bootstrap tetap terkunci oleh business guard backend.

## Test minimum

- [ ] `GET /health` sukses dan hanya menampilkan status minimal.
- [ ] `GET /api/maintenance/status` tanpa token ditolak; token administrator sukses.
- [ ] `GET /api/module-runtime-status` tanpa token ditolak; token administrator sukses.
- [ ] Login lokal sukses, mengirim cookie `HttpOnly`, dan tidak mengirim raw token di JSON.
- [ ] Bootstrap admin pertama membutuhkan kode yang tampil di terminal backend dan endpoint status tidak membocorkannya.
- [ ] CORS hanya menerima same-host/loopback atau origin tambahan yang dikonfigurasi eksplisit.
- [ ] Rate limit login menolak percobaan gagal keenam per IP dalam window default 60 detik.
- [ ] `npm test` lulus untuk backend (database temporary) dan frontend (DOM terisolasi).
- [ ] CRUD master data pilot sukses.
- [ ] Stock adjustment commit sukses dan audit log tercatat.
- [ ] Backup manual sukses dan menghasilkan `.imsbackup` compact.
- [ ] Download backup dan import `.imsbackup` sukses.
- [ ] Restore preview sukses.
- [ ] Restore execute butuh keyword confirm.
- [ ] Dashboard/report tidak white screen.
- [ ] Default `IMS_AUTH_ALLOW_LEGACY_BEARER=false` menolak Bearer lama tanpa memutus cookie session; mode `true` hanya diuji sebagai jalur migrasi sementara.

## Source/archive hygiene

- File runtime database dan backup aktual tidak boleh ikut ZIP source, patch, atau repo.
- Folder `data/` dan `backups/` hanya boleh membawa `.gitkeep` untuk struktur folder.
- File `.sqlite`, `.sqlite-wal`, `.sqlite-shm`, `.imsbackup`, `.imsbak.zip`, dan sidecar `*.manifest.json` legacy adalah artifact lokal dan harus disimpan di lokasi backup operasional, bukan di source.
- `.gitignore` dan `.gitattributes` dipakai bersama: `.gitignore` mencegah artifact baru ikut track, sedangkan `.gitattributes` mengecualikan seluruh folder runtime dari `git archive`.
- `scripts/verify-source-ready.cjs` wajib gagal bila ada file selain `.gitkeep` di `data/` atau `backups/` yang masih ter-track.
- Script clean ZIP wajib menjalankan guard sebelum `git archive`, lalu memverifikasi central directory ZIP aktual dan menolak runtime/generated output, path backslash, entry duplikat, atau struktur source yang tidak lengkap.
- Verifier archive wajib tersedia melalui mode `--archive-only` agar ZIP hasil build dapat dicek terpisah sebelum dibagikan atau di-merge.
- Guard source hanya menghapus artifact dari Git index; backup lokal yang masih dibutuhkan tidak boleh dihapus secara destructive.
