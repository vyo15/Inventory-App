<!--
PATCH A-B NOTE — 2026-06-02:
Dokumen ini adalah arsip historis Batch offline database browser arsip. Source aktif sekarang memakai SQLite sidecar lewat backend Node.js lokal/LAN. Jangan mengikuti instruksi runtime database browser arsip, sync queue arsip, conflict resolver, atau backup JSON storage browser arsip dari dokumen arsip ini. Kontrak terbaru ada di docs/10_OFFLINE_DATABASE_CONTRACT.md dan docs/17_SQLITE_OFFLINE_WEB_ROADMAP.md.
-->

# Offline QA Regression — Batch 51

Status: **ARSIP HISTORIS / SUPERSEDED BY SQLITE RUNTIME / JANGAN DIPAKAI SEBAGAI INSTRUKSI AKTIF**.

Dokumen ini dipakai sebelum merge/deploy patch offline besar. Jalankan di environment test terlebih dahulu, bukan di data produksi.


## 0. In-app QA execution panel

Offline Database Center sekarang memiliki tab `QA RC` untuk membantu mencatat progres manual regression.

Aturan:
- Checklist di tab `QA RC` hanya penanda manual di `localStorage` browser, bukan bukti otomatis.
- Centang hanya setelah test benar-benar dilakukan di environment test.
- Status QA tidak disimpan ke runtime arsip dan tidak mempengaruhi business data.
- Jika hasil test berbeda dengan source/docs, prioritaskan source aktual dan bugfix kecil terpisah.

## 1. Smoke test build

- [ ] `cd frontend && npm install` sukses.
- [ ] `cd frontend && npm run lint` sukses.
- [ ] `cd frontend && npm run build` sukses.
- [ ] `cd backend && npm install` sukses.
- [ ] `cd backend && npm run check` sukses.
- [ ] Aplikasi bisa dibuka dari fresh reload.
- [ ] Login/session/route guard tetap normal.
- [ ] Sidebar/menu tidak berubah.

## 2. Offline Database Center

- [ ] Buka `Testing & Reset Center` → tab `Offline DB`.
- [ ] Tab `Status` menampilkan mode aktif, Local DB, pending queue, dan conflict.
- [ ] Tombol `Siapkan Local DB` membuat foundation tanpa error.
- [ ] Offline Mode tidak bisa aktif tanpa keyword `ENABLE OFFLINE REPOSITORY PILOT`.
- [ ] Kembali ke runtime arsip Mode berjalan tanpa menghapus data local.

## 3. Master data write pilot

- [ ] runtime arsip → Offline Categories berhasil preview dan pull.
- [ ] runtime arsip → Offline Customers berhasil preview dan pull.
- [ ] Offline Mode: Categories create/edit membuat data local + queue pending.
- [ ] Offline Mode: Customers create/edit membuat data local + queue pending.
- [ ] Offline → runtime arsip hanya menampilkan pilihan Categories dan Customers.
- [ ] Delete runtime arsip dari offline queue tetap diblokir default.

## 4. Snapshot read-only

- [ ] Supplier snapshot bisa dipull dan tidak masuk queue.
- [ ] Product snapshot bisa dipull dan tidak masuk queue.
- [ ] Raw Material snapshot bisa dipull dan tidak masuk queue.
- [ ] Semi Finished snapshot bisa dipull dan tidak masuk queue.
- [ ] Stock Snapshot bisa dipull dan tidak masuk queue.
- [ ] Production Snapshot bisa dipull dan tidak masuk queue.
- [ ] Report/Finance Snapshot bisa dipull dan tidak masuk queue.
- [ ] Data Local menampilkan snapshot dengan `syncStatus=synced`.
- [ ] Tidak ada tombol edit/delete/push untuk snapshot.

## 5. Queue dan conflict

- [ ] Queue tab menampilkan pending/failed/conflict/synced tanpa auto-sync.
- [ ] Detail queue menampilkan payload/metadata untuk review manual.
- [ ] Retry failed hanya aktif dengan keyword `RETRY FAILED OFFLINE QUEUE`.
- [ ] Clear failed hanya aktif dengan keyword `CLEAR FAILED OFFLINE QUEUE`.
- [ ] Conflict tab menampilkan diff Local vs runtime arsip.
- [ ] Resolve conflict hanya aktif dengan keyword `RESOLVE MASTER DATA CONFLICT`.
- [ ] Default resolusi aman adalah skip/manual review.

## 6. Backup/restore

- [ ] Export backup menghasilkan JSON dengan app, appVersion, schemaVersion, sourceMode, exportedAt, recordCounts, dan tables.
- [ ] Preview restore menampilkan valid/error/warning dan restore plan.
- [ ] Dry-run restore tidak mengubah storage browser arsip.
- [ ] Restore hanya berjalan dengan keyword `RESTORE LOCAL DB BACKUP`.
- [ ] Restore hanya menyentuh table allowlist local.
- [ ] Backup yang mengandung field credential/secret ditolak.

## 7. Report/Finance Snapshot khusus

- [ ] Dashboard Summary snapshot berhasil preview dan pull.
- [ ] Stock Report snapshot berhasil preview dan pull.
- [ ] Sales Report snapshot berhasil preview dan pull.
- [ ] Purchases Report snapshot berhasil preview dan pull.
- [ ] Finance Summary snapshot berhasil preview dan pull.
- [ ] Semua pull memakai keyword `PULL REPORT SNAPSHOT READ ONLY`.
- [ ] Profit/Loss final tetap runtime arsip-primary dan tidak memakai local draft/queue pending.
- [ ] Tidak ada dokumen baru/ubah/hapus di `revenues`, `incomes`, atau `expenses` dari proses snapshot.

## 8. Modul bisnis guarded regression

- [ ] Purchase online tetap membuat purchase, stock in, inventory log, expense, dan history sesuai flow existing.
- [ ] Sales online tetap membuat stock out dan income sesuai status existing.
- [ ] Return online tetap mengikuti flow existing dan tidak menjadi offline mutation.
- [ ] Stock adjustment tetap online/runtime arsip-primary dan tidak bisa dilakukan dari snapshot.
- [ ] Finance Cash In/Out tetap runtime arsip-primary.
- [ ] Dashboard/Report final tetap runtime arsip-primary.
- [ ] Production Planning/Order/Work Log/BOM/Payroll/HPP tetap runtime arsip-primary.
- [ ] Reset destructive tetap butuh preview + keyword.

## 9. Keputusan QA

Patch boleh merge jika:

- Build/lint sukses.
- Tidak ada regression pada route/menu/role guard.
- Queue hanya untuk Categories/Customers.
- Snapshot read-only tidak membuat mutation.
- Finance/report snapshot tidak mengubah ledger dan tidak dianggap laporan final.
