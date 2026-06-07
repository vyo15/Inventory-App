<!--
PATCH A-B NOTE — 2026-06-02:
Dokumen ini adalah arsip historis Batch offline database browser lama. Source aktif sekarang memakai SQLite sidecar lewat backend Node.js lokal/LAN. Jangan mengikuti instruksi runtime database browser lama, legacy_sync_queue, conflict resolver, atau backup JSON storage browser lama dari dokumen arsip ini. Kontrak terbaru ada di docs/10_OFFLINE_DATABASE_CONTRACT.md dan docs/17_SQLITE_OFFLINE_WEB_ROADMAP.md.
-->

# Offline Release Candidate Closure

Status: **ARSIP HISTORIS / SUPERSEDED BY SQLITE RUNTIME / JANGAN DIPAKAI SEBAGAI INSTRUKSI AKTIF**.

Dokumen ini menutup roadmap offline Batch 23–52 pada level source. Setelah dokumen ini, perubahan berikutnya sebaiknya berupa bugfix dari hasil QA atau roadmap baru, bukan perluasan silent ke transaksi guarded.

## Source state

- `src/data/local/localDbSchema.js` menggunakan `LOCAL_DB_SCHEMA_VERSION = 4`.
- Write offline pilot hanya untuk `categories` dan `customers`.
- Supplier/Product/Raw/Semi/Stock/Production/Report/Finance hanya read-only snapshot.
- `legacy_sync_queue` hanya boleh untuk `categories` dan `customers`.
- Backup/restore tetap local-only dan harus guarded.
- Queue/conflict/health/security guard sudah tersedia di Offline Database Center.
- Batch 40 Report/Finance snapshot sudah runtime read-only via `report_snapshots`, bukan ledger final.

## Release candidate checklist

- [ ] `cd frontend && npm install` atau `cd frontend && npm ci` sukses.
- [ ] `cd frontend && npm run lint` sukses.
- [ ] `cd frontend && npm run build` sukses.
- [ ] `cd backend && npm install` sukses.
- [ ] `cd backend && npm run check` sukses.
- [ ] Offline Database Center tab `QA RC` selesai dicentang setelah test manual.
- [ ] `Health` tidak memiliki error blocker.
- [ ] Queue hanya berisi Categories/Customers untuk write pilot.
- [ ] Snapshot read-only tidak pernah masuk Offline → runtime lama.
- [ ] Purchase/Sales/Returns/Finance/Production/Payroll/HPP tetap runtime lama-primary.
- [ ] Report/Finance snapshot tidak dianggap laporan final jika belum refresh dari runtime lama.
- [ ] Backup/restore sudah diuji minimal dry-run dan restore data test.

## Tidak boleh dilakukan dalam release candidate ini

- Membuat offline stock mutation.
- Membuat purchase/sales final dari storage browser lama.
- Membuat finance ledger dari local draft.
- Finalize HPP dari offline.
- Mengubah route/menu/role guard tanpa approval.
- Mengubah database lama rules aktif tanpa audit khusus.
- Mengubah dependency untuk mengejar warning audit tanpa review impact.

## Setelah QA

Jika QA menemukan bug, buat patch kecil per area:

1. Queue/conflict bugfix.
2. Backup/restore bugfix.
3. Snapshot pull/preview bugfix.
4. Health audit false positive/false negative bugfix.
5. Docs correction.

Jangan mencampur bugfix release candidate dengan fitur baru seperti offline draft purchase/sales/production.

## Batch 53 — RC Final Hardening P1-P3

Status: **AKTIF / PATCHED / MANUAL QA REQUIRED**.

Perbaikan Batch 53:

- Queue update `categories/customers` sekarang membawa `baseVersion` dan `baseRecordFingerprint`.
- Offline → runtime lama update akan masuk `sync_conflicts` jika runtime lama berubah setelah data dipull ke local, bukan overwrite otomatis.
- Health audit menandai semua snapshot table yang tidak memiliki `readOnlySnapshot=true` sebagai warning.
- Health audit juga memberi warning untuk queue update lama yang belum memiliki `baseVersion/baseRecordFingerprint`.
- Resolve conflict `local_wins` sekarang ikut menandai record local sebagai `synced`, bukan hanya queue, agar tidak meninggalkan dirty local state palsu.
- `docs/10_OFFLINE_DATABASE_CONTRACT.md` dan `docs/08_INTEGRATION_MAP.md` diselaraskan dengan source v4.
- `OfflineSyncDevPanel.jsx` dan `OfflineMasterDataPilotPanel.jsx` diberi status `LEGACY-COMPAT / CLEANUP CANDIDATE`; jangan dihapus sebelum audit usage final.

P2 yang sengaja tidak diubah runtime:

- `legacy-db.rules` masih perlu audit production rules terpisah. Jangan ubah field-level/module-level rules di batch offline closure karena bisa memutus flow transaksi.
- `src/runtime-lama.js` masih memakai public runtime lama Web config hardcoded. Ini bukan secret server, tetapi env-based config boleh menjadi cleanup terpisah setelah deployment workflow disetujui.
- `xlsx@0.18.5` masih memiliki audit risk high dan belum ada fix resmi dari `npm audit`. Jangan ganti dependency tanpa approval; batasi penggunaan file Excel dari sumber tidak dipercaya dan pertimbangkan migrasi export library di batch terpisah.

QA tambahan setelah Batch 53:

- Pull `categories/customers` dari runtime lama, edit record yang sama di runtime lama/device lain, lalu sync offline update; hasil yang benar adalah `sync_conflicts`, bukan overwrite.
- Restore/import snapshot lama yang tidak punya `readOnlySnapshot`; tab Health harus memberi warning.
- Pastikan panel legacy tidak muncul sebagai UI utama dan Offline Database Center tetap normal.

