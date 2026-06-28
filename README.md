# IMS Bunga Flanel

IMS Bunga Flanel adalah aplikasi inventory dan operasional UMKM yang berjalan secara lokal/offline dengan frontend React, backend Express, dan database SQLite.

## Arsitektur runtime

- Frontend: React + Vite + Ant Design.
- Backend: Node.js + Express.
- Database: SQLite lokal.
- Akses perangkat lain: melalui jaringan LAN/Wi-Fi ke laptop yang menjalankan backend dan frontend.
- Data runtime tidak disimpan di Git: folder `data/` dan `backups/` dikecualikan dari source archive.

## Menjalankan project

Runtime resmi memakai **Node.js 22.12 sampai sebelum 23**. Versi rekomendasi project berada di `.nvmrc` dan `.node-version` (`22.16.0`). Perintah `dev`, `test`, build/lint frontend, serta check backend akan berhenti lebih awal bila versi Node di luar rentang yang didukung.

```powershell
npm run check:runtime
npm run install:all
npm run dev
```

Command runtime utama:

```text
npm run dev   -> mode operasional
npm run lab   -> mode sandbox / Lab Pengujian
npm test      -> automated test suite
```

`npm run dev` menjalankan backend dan frontend dari satu terminal. Saat dihentikan dengan `Ctrl+C`, runner meminta backend menutup HTTP dan SQLite melalui channel internal, menunggu checkpoint WAL selesai, lalu menghentikan frontend. Jangan menutup terminal sebelum log `[dev] seluruh layanan berhenti.` muncul.

`npm run lab` memakai database/backup/log sandbox terpisah dan meneruskan path database operasional sebagai **sumber clone read-only**. Dari menu Lab Pengujian, Administrator dapat memilih **Ambil Data Operasional** untuk membuat baseline sandbox tanpa menulis atau mengubah database asli. Session login, histori backup/restore operasional, dan setting Lab tidak dibawa ke baseline; setelah clone pengguna wajib login ulang.

Alamat default:

- Frontend: `http://localhost:5173/Inventory-App/`
- Backend: `http://localhost:3001`

## Quality gate

Backend test berjalan dengan database, backup, dan log temporary yang terisolasi. Mode test tidak boleh membuka, mereset, menulis, atau membersihkan runtime project. Guard `TEST_DATABASE_*`, `TEST_BACKUP_*`, `TEST_LOG_*`, `TEST_RUNTIME_*`, dan perubahan fingerprint runtime harus dianggap blocking bila muncul. Jalankan backend regression melalui `npm test`; direct `node --test` hanya boleh dipakai oleh test yang tetap mengonfigurasi seluruh path temporary resmi.

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

Gunakan menu **Maintenance & Backup Center**. Restore penuh menerima File Backup IMS `.imsbackup`, paket legacy `.imsbak.zip`, dan backup SQLite legacy yang sudah terdaftar di storage resmi, setelah lolos preview integrity/account guard. File dari media/folder luar wajib diimport melalui Maintenance Center terlebih dahulu; path lama dari registry tidak dibaca, didownload, direstore, dipromosikan, atau dihapus langsung. Nama file registry juga harus cocok dengan file fisik dan file tersebut harus benar-benar berupa paket backup IMS atau database SQLite legacy. Restore membuat pre-restore backup dan mengembalikan database aktif secara otomatis jika migrasi, validasi, atau pencatatan restore gagal.

Jangan menyalin file SQLite aktif secara manual saat backend berjalan.

Database runtime memakai mode WAL. Saat backend aktif, folder `data/` dapat berisi file utama `.sqlite` beserta `.sqlite-wal` dan `.sqlite-shm`; ketiganya adalah satu database logis. Hentikan root runner dengan `Ctrl+C` satu kali dan tunggu log `ims_local_server_shutdown_completed`, `[dev] backend menutup database dengan aman.`, serta `[dev] seluruh layanan berhenti.` Jangan menghapus WAL/SHM secara manual. Backup portable tetap satu file `.imsbackup`.

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
