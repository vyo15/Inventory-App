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

- Dibuat dari backend.
- Berformat satu file khusus IMS `.imsbackup`.
- Menggunakan paket compact berisi `database.sqlite`, `manifest.json`, `checksum.sha256`, dan `README_RESTORE.txt`.
- Memiliki manifest/checksum.
- Dicatat di backup logs.
- Bisa didownload dari Database Center.
- Bisa diverifikasi sebelum restore.
- Disalin keluar laptop/server secara berkala oleh user.

Backup legacy `.imsbak.zip` tetap boleh dibaca untuk restore agar file lama tidak terputus kompatibilitasnya.

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

## Automated regression contract

- Automated backend test wajib memakai database SQLite temporary, bukan database operasional.
- Automated frontend test wajib memakai environment DOM terisolasi dan tidak boleh memanggil database/backend operasional.
- Test runner aktif melalui `npm test` di root; backend menemukan file `*.test.js` secara otomatis dan frontend menjalankan Vitest.
- `npm run check`, `git check`, dan pre-push wajib menjalankan automated test backend + frontend; test yang gagal harus menghentikan quality gate.
- Perubahan auth, stock engine, purchase, sales, return, atau finance wajib mempertahankan regression test terkait.
- Automated coverage backend aktif melindungi auth route aktual, cookie `HttpOnly`, migrasi/disable Bearer legacy, bootstrap code guard, CORS same-host, rate limiting login, stock/transaction/finance/return, production/payroll/HPP, backup/restore guarded, dan source ZIP hygiene.
- Automated coverage frontend aktif melindungi auth service, Login error state/bootstrap, ProtectedRoute, role access matrix, dan Dashboard role-aware.
- Report, seluruh variasi UI transaksi/produksi, serta interaksi maintenance kompleks tetap memerlukan checklist manual sampai coverage khusus ditambahkan.
- Test tidak boleh mengubah schema, route, role guard, atau business rule hanya agar assertion lulus. Jika test menemukan bug, perbaikan business logic harus menjadi patch terpisah dan direview.

## Auth session dan bootstrap contract

- Session browser utama memakai cookie host-only `ims_session` dengan `HttpOnly`, `SameSite=Lax`, dan `Path=/`.
- Cookie `Secure` hanya diaktifkan untuk deployment HTTPS melalui `IMS_AUTH_COOKIE_SECURE=true`; runtime HTTP LAN harus tetap `false` agar login berfungsi.
- Frontend wajib memakai `credentials: "include"` pada seluruh request backend, termasuk download/import backup.
- Response login tidak boleh mengembalikan raw token ke JavaScript; seluruh endpoint auth wajib memakai `Cache-Control: no-store` dan server tidak mengekspos header `X-Powered-By`.
- Bearer token lama boleh diterima sementara untuk compatibility dan dimigrasikan oleh `/api/auth/me`; flow baru dilarang menulis token ke `localStorage`. Compatibility dikontrol oleh `IMS_AUTH_ALLOW_LEGACY_BEARER` dan baru boleh diset `false` setelah seluruh perangkat login ulang serta cookie session terverifikasi.
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
- [ ] Setelah migrasi seluruh perangkat terkonfirmasi, `IMS_AUTH_ALLOW_LEGACY_BEARER=false` menolak Bearer lama tanpa memutus cookie session.

## Source/archive hygiene

- File runtime database dan backup aktual tidak boleh ikut ZIP source, patch, atau repo.
- Folder `data/` dan `backups/` hanya boleh membawa `.gitkeep` untuk struktur folder.
- File `.sqlite`, `.sqlite-wal`, `.sqlite-shm`, `.imsbackup`, `.imsbak.zip`, dan `*.manifest.json` adalah artifact lokal dan harus disimpan di lokasi backup operasional, bukan di source.
- `.gitignore` dan `.gitattributes` dipakai bersama: `.gitignore` mencegah artifact baru ikut track, sedangkan `.gitattributes` mengecualikan seluruh folder runtime dari `git archive`.
- `scripts/verify-source-ready.cjs` wajib gagal bila ada file selain `.gitkeep` di `data/` atau `backups/` yang masih ter-track. Script clean ZIP wajib menjalankan guard sebelum `git archive`, lalu memverifikasi central directory ZIP aktual dan menghapus artifact bila ditemukan runtime/generated output, path backslash, atau struktur source tidak lengkap.
- Guard source hanya menghapus artifact dari Git index; backup lokal yang masih dibutuhkan tidak boleh dihapus secara destructive.
