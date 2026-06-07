# IMS SQLite Offline Web Roadmap

Status: **AKTIF / SQLITE-FIRST / SOURCE-VERIFIED**.

Runtime utama source aktual adalah backend Node.js Express + SQLite lokal/LAN. Roadmap ini menggantikan roadmap offline lama.

## Guard sebelum merge patch berikutnya

- Tidak ada patch yang mengubah runtime kembali ke jalur lama.
- Tidak ada direct write generic ke tabel transaksi, finance ledger, atau stock adjustment.
- Sales tidak boleh memiliki cancel/delete user-facing maupun backend generic delete.
- Return tetap menjadi jalur resmi barang kembali.
- User Management memakai local auth SQLite dan role guard backend.
- Dashboard/report harus punya fallback data kosong dan tidak boleh white screen.
- Backup/restore harus guarded.
- Module Runtime Status harus tetap membaca backend, bukan hardcoded UI.
- UI Enterprise Clean tidak boleh mengembalikan wrapper card bertumpuk atau shadow global yang berlebihan.

## Status fase

1. Struktur frontend/backend: selesai.
2. SQLite sidecar backend: aktif.
3. Auth lokal: aktif.
4. Master data utama: aktif bertahap.
5. Stock engine: aktif dan guarded.
6. Purchases/Sales/Returns: aktif dan guarded.
7. Finance ledger: aktif.
8. Production/Payroll/HPP: aktif dan guarded.
9. Reports/Dashboard: aktif dengan fallback.
10. Backup/Restore: aktif dan guarded.
11. Module Runtime Status: aktif.
12. Release Candidate: menunggu regression test penuh.

## Prioritas berikutnya

- Regression test semua flow guarded dengan data nyata.
- Perbaikan UI halaman padat secara scoped.
- Audit technical ID agar tidak tampil user-facing.
- Dokumentasi user guide singkat untuk backup/restore dan pindah PC.
- Hardening LAN: IP statis, firewall allowlist, sleep off, startup script.
