# PROMPT RULES — IMS Bunga Flanel

Status: **AKTIF / SQLITE-FIRST / SOURCE-VERIFIED**.

Gunakan file ini sebagai aturan kerja saat membantu project IMS Bunga Flanel.

## Aturan utama

1. Wajib validasi source/ZIP terbaru sebelum review atau patch.
2. Source aktual menang atas docs lama.
3. Runtime utama saat ini adalah frontend React/Vite + backend Node.js Express + SQLite lokal/LAN.
4. Backend adalah satu-satunya akses database.
5. Frontend tidak boleh membaca file SQLite langsung.
6. Jangan menghidupkan runtime arsip tanpa approval eksplisit dan validasi source baru.
7. Jangan coding sebelum review teknis dan plan disetujui, kecuali user sudah jelas meminta patch berdasarkan plan.
8. Jangan membuat logic duplikat jika helper/service existing sudah ada.
9. Jangan formatting massal file yang tidak terkait.
10. Jika perlu file tambahan di luar plan patch, berhenti dan minta approval.

## Validasi source wajib

Setiap review resmi harus mencantumkan:

- ZIP/file yang dibaca.
- File relevan yang benar-benar dicek.
- File relevan yang tidak ditemukan.
- Batasan validasi jika ada.
- Konflik docs vs source jika ditemukan.

Review resmi belum valid jika tidak menyebut path file aktual yang dicek.

## Guarded area IMS

Jangan ubah tanpa approval eksplisit:

- Schema, database, tabel, field penting.
- Route, sidebar, menu, role guard.
- Auth, login, protected route, user management.
- Stock engine, current/reserved/available stock, inventory logs, stock adjustments.
- Purchase flow dan histori pembelian.
- Sales flow, status flow, income timing, dan return relation.
- Returns, stock restore, refund/finance rule.
- Finance, income, expense, ledger, profit/loss.
- Production planning, production order, work log, payroll, HPP.
- Backup, restore, reset, maintenance logs.
- Audit log dan histori transaksi.

## Aturan SQLite runtime

- Auth aktif memakai local auth SQLite melalui `/api/auth/**`.
- Repository frontend harus memakai service/adapter backend SQLite.
- Alias repository lama hanya compatibility; jangan jadikan alasan mengaktifkan runtime arsip.
- Module Runtime Status hanya indikator bantu; keputusan patch tetap berdasarkan source aktual.
- Direct write generic ke tabel guarded dilarang.
- Semua mutation guarded harus lewat endpoint/service resmi yang menjaga audit log dan idempotency.

## Aturan UI/UX

- UI harus clean, compact, profesional, dan konsisten.
- Mobile harus nyaman untuk data banyak.
- Hindari technical ID, kode random, dan noise teknis di UI utama.
- Empty/loading/error state wajib ada.
- Light/dark mode harus terbaca.
- Tombol destructive wajib confirm.

## Aturan security

Dilarang menambahkan:

- `eval`.
- `new Function`.
- command execution dari input user.
- unsafe HTML rendering.
- secret/API key di source.
- reset testing/destructive tanpa confirm guard.
- akses database langsung dari frontend.
- perubahan access/security tanpa approval.

## Aturan patch

Patch default harus:

- Kecil dan scoped.
- Changed-files-only.
- Tidak menyertakan `node_modules`, `dist`, `.git`, cache, coverage, build output, atau generated files.
- Tidak mengubah dependency/schema/database tanpa approval.
- Tidak mengubah route/menu/role guard jika bukan scope.
- Tidak menyentuh stock/production/payroll/purchase/reset flow jika bukan scope.
- Memakai helper/service existing.

Setelah patch, selalu sertakan:

- File berubah.
- Ringkasan perubahan.
- Hal yang sengaja tidak diubah.
- Risiko tersisa.
- Checklist test manual.
- Hasil build/lint jika dijalankan.
- Apakah docs perlu update.

## Format review default

1. Ringkasan task.
2. Validasi source aktual.
3. Validasi docs vs source.
4. Area terdampak.
5. Analisis risiko.
6. Rekomendasi aman.
7. Plan file-by-file jika perlu patch.
8. Test checklist.
9. Keputusan.

## Guard cleanup architecture aktif

- Implementasi baru tidak boleh menaruh core stock, finance, atau backup engine di `backend/src/utils/`.
- Internal backend wajib memakai canonical domain path. File legacy engine hanya compatibility facade dan tidak boleh diberi logic baru.
- Password policy dan formula katalog Supplier wajib memakai canonical shared core; jangan copy-paste frontend/backend.
- Frontend tidak boleh menghitung atau meng-commit HPP sebagai authority.
- Refactor arsitektur tidak boleh sekaligus mengubah schema, route, role guard, status flow, formula stok/HPP, atau format backup.
- Komponen UI shared hanya memusatkan presentasi/state yang benar-benar identik; business page Cash In/Cash Out, Purchase/Sales/Return, dan modul guarded tetap terpisah.
- Detail lengkap struktur hasil cleanup ada di `docs/22_CLEANUP_ARCHITECTURE.md`.
