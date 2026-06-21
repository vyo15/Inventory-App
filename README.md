# IMS Bunga Flanel

IMS Bunga Flanel adalah aplikasi inventory dan operasional UMKM yang berjalan secara lokal/offline dengan frontend React, backend Express, dan database SQLite.

## Arsitektur runtime

- Frontend: React + Vite + Ant Design.
- Backend: Node.js + Express.
- Database: SQLite lokal.
- Akses perangkat lain: melalui jaringan LAN/Wi-Fi ke laptop yang menjalankan backend dan frontend.
- Data runtime tidak disimpan di Git: folder `data/` dan `backups/` dikecualikan dari source archive.

## Menjalankan project

Runtime resmi memakai **Node.js 22.12 sampai sebelum 23**. Versi rekomendasi project berada di `.nvmrc` dan `.node-version` (`22.16.0`).

```powershell
npm run check:runtime
npm run install:all
npm run dev
```

Alamat default:

- Frontend: `http://localhost:5173/Inventory-App/`
- Backend: `http://localhost:3001`

## Quality gate

Sebelum merge atau push:

```powershell
npm run test:scripts
npm --prefix backend run check
npm --prefix backend test
npm --prefix frontend test
npm --prefix frontend run test:coverage
npm --prefix frontend run lint
npm --prefix frontend run build
npm run check:bundle
npm run sbom
npm run verify:source
```

GitHub Actions menjalankan gate yang sama pada push ke `main` dan pull request.

## Backup dan restore

Gunakan menu **Maintenance & Backup Center**. Restore penuh hanya menerima File Backup IMS `.imsbackup` yang lolos checksum dan integrity check. Restore membuat pre-restore backup dan mengembalikan database aktif secara otomatis jika migrasi, validasi, atau pencatatan restore gagal.

Jangan menyalin file SQLite aktif secara manual saat backend berjalan.

Database runtime memakai mode WAL. Saat backend aktif, folder `data/` dapat berisi file utama `.sqlite` beserta `.sqlite-wal` dan `.sqlite-shm`; ketiganya adalah satu database logis. Hentikan layanan dengan `Ctrl+C` dan tunggu log shutdown selesai agar backend melakukan checkpoint serta menutup database. Jangan menghapus WAL/SHM secara manual. Backup portable tetap satu file `.imsbackup`.

## Source ZIP untuk review

ZIP review harus berisi source working tree terbaru, tanpa:

- `node_modules`;
- `.git`;
- `dist`, build, coverage, dan cache;
- database SQLite, WAL, atau SHM;
- file backup runtime;
- `.env` dan konfigurasi lokal.

Nama ZIP disarankan memuat timestamp, branch, commit, serta status `clean` atau `dirty`.

## Dokumentasi

Dokumentasi teknis dan business rule berada di folder [`docs/`](docs/). Bila dokumentasi bertentangan dengan source runtime, validasi source aktual wajib dilakukan terlebih dahulu.

## Lisensi

Lisensi project belum ditetapkan. Jangan mengasumsikan project ini berlisensi open-source sebelum owner menetapkan file `LICENSE` secara eksplisit. Inventaris dependency dan ketentuan pihak ketiga dijelaskan di [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md); CycloneDX SBOM dapat dibuat dengan `npm run sbom`.
