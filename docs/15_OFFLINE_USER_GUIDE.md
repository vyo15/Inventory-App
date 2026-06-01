# Panduan User Offline Mode IMS Bunga Flanel — Batch 52

Status: **AKTIF / USER GUIDE / GUARDED**.

Offline Mode saat ini adalah pilot terbatas. Tujuannya membantu bekerja saat koneksi tidak stabil tanpa merusak data stock, transaksi, finance, produksi, payroll, atau HPP.

## Ringkasan cepat

Yang bisa ditulis offline sekarang:

- Categories
- Customers

Yang hanya bisa dibaca sebagai snapshot offline:

- Suppliers
- Products
- Raw Materials
- Semi Finished Materials
- Stock Snapshot
- Production Snapshot
- Dashboard/Report/Finance Snapshot

Yang tetap wajib online/Firebase-primary:

- Purchase final
- Sales final
- Return
- Stock adjustment/mutation
- Inventory logs
- Finance ledger/cash in/cash out
- Dashboard/report final
- Production planning/order/work log/BOM mutation
- Payroll payment
- HPP final
- Reset destructive

## Cara memakai Offline Mode dengan aman

1. Buka `Testing & Reset Center`.
2. Masuk tab `Offline DB`.
3. Klik `Siapkan Local DB`.
4. Jalankan `Firebase → Offline` untuk Categories dan Customers agar data local tidak kosong.
5. Pull snapshot read-only yang dibutuhkan, misalnya Supplier/Product/Stock/Production/Report.
6. Aktifkan Offline Mode dengan keyword yang diminta UI.
7. Kerjakan Categories/Customers jika diperlukan.
8. Saat online kembali, buka tab Sinkronisasi.
9. Preview `Offline → Firebase`.
10. Review queue dan conflict.
11. Sync hanya jika sudah yakin.

## Batasan penting

- Local DB hanya ada di browser/perangkat yang dipakai.
- Local DB tidak otomatis pindah ke laptop/PC lain.
- Jangan uninstall browser/clear site data sebelum backup jika masih ada queue pending.
- Offline snapshot bisa ketinggalan dari data Firebase terbaru.
- Snapshot report/finance bukan laporan final untuk pembukuan.
- Stock mutation tetap tidak boleh offline karena berisiko double mutation.

## Troubleshooting

### Data offline kosong

Kemungkinan belum pull Firebase → Offline.

Solusi:

1. Buka `Offline DB`.
2. Pilih tab `Sinkronisasi`.
3. Preview Firebase → Offline.
4. Pull data yang diperlukan dengan keyword.
5. Refresh Data Local.

### Ada queue pending

Queue pending artinya ada perubahan local yang belum dikirim ke Firebase.

Solusi:

1. Buka tab `Queue`.
2. Review detail payload.
3. Buka tab `Sinkronisasi`.
4. Preview Offline → Firebase.
5. Sync hanya jika data benar.

### Ada conflict

Conflict artinya data local dan Firebase berbeda.

Solusi:

1. Buka tab `Konflik`.
2. Pilih conflict.
3. Baca diff Local vs Firebase.
4. Pilih resolusi: skip/manual review, pakai local, atau pakai Firebase.
5. Isi catatan.
6. Jalankan dengan keyword resolve.

### Backup sebelum tindakan penting

Sebelum restore, clear queue, atau berpindah device:

1. Buka tab `Backup & Restore`.
2. Export Local DB backup.
3. Simpan file JSON di tempat aman.
4. Jangan share backup jika berisi data bisnis sensitif.

### Restore backup

1. Upload/import JSON backup.
2. Preview restore.
3. Jalankan dry-run dulu.
4. Restore hanya jika preview valid.
5. Isi keyword `RESTORE LOCAL DB BACKUP`.

## Apa yang tidak boleh dilakukan

- Jangan membuat purchase final saat offline.
- Jangan membuat sales final saat offline.
- Jangan mengubah stok dari snapshot offline.
- Jangan menganggap stock snapshot sebagai stok live.
- Jangan membuat cash in/out dari data local draft.
- Jangan menghitung profit/loss final dari snapshot local.
- Jangan melakukan reset destructive tanpa preview dan backup.

## Kapan harus tetap online

Tetap online jika pekerjaan menyentuh:

- Stok masuk/keluar,
- Pembelian,
- Penjualan,
- Retur,
- Keuangan,
- Produksi,
- Payroll,
- HPP,
- Laporan final,
- Reset/maintenance destructive.

## Checklist sebelum merge/deploy offline mode

- [ ] Tidak ada queue pending penting yang belum direview.
- [ ] Tidak ada conflict unresolved penting.
- [ ] Backup local sudah diexport jika ada data offline.
- [ ] Health audit tidak menampilkan error.
- [ ] User memahami bahwa offline write hanya Categories dan Customers.
