# Panduan User SQLite Local Mode IMS Bunga Flanel

Status: **AKTIF / SQLITE LOCAL PILOT / GUARDED**.

SQLite Local Mode adalah mode pilot agar IMS bisa berjalan dengan database lokal di laptop/PC utama. HP atau laptop lain satu jaringan bisa membuka frontend dan membaca database SQLite yang sama melalui backend Node.js di laptop/PC utama.

## Ringkasan cepat

Yang sudah boleh memakai SQLite local pilot:

- Login lokal SQLite.
- Categories.
- Customers.
- Backup/status/restore plan SQLite lewat SQLite Local DB Center.

Yang tetap belum boleh dipindah ke SQLite tanpa audit khusus:

- Supplier frontend operasional final.
- Products.
- Raw Materials.
- Semi Finished Materials.
- Stock mutation/adjustment.
- Purchases.
- Sales.
- Returns.
- Finance ledger/cash in/cash out.
- Dashboard/report final.
- Production planning/order/work log/BOM mutation.
- Payroll payment/final.
- HPP final.
- Reset destructive di luar guard existing.

## Cara menjalankan mode SQLite lokal

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

Contoh `frontend/.env.local`:

```env
VITE_AUTH_MODE=sqlite
# VITE_SQLITE_API_BASE_URL=http://localhost:3001
VITE_SUPPLIERS_REPOSITORY_MODE=sqlite
```

Untuk HP/laptop lain satu jaringan, set API backend ke IP laptop/PC utama jika autodetect tidak cukup:

```env
VITE_AUTH_MODE=sqlite
VITE_SQLITE_API_BASE_URL=http://IP-LAPTOP:3001
VITE_SUPPLIERS_REPOSITORY_MODE=sqlite
```

Jangan commit `.env.local`.

## Login lokal pertama

Buat administrator lokal pertama dari backend setelah backend aktif:

```bash
curl -X POST http://localhost:3001/api/auth/bootstrap-admin \
  -H "Content-Type: application/json" \
  -d '{"confirmKeyword":"CREATE LOCAL ADMIN","username":"admin","displayName":"Administrator Lokal","password":"Admin12345"}'
```

Setelah itu login dari frontend memakai username/password admin lokal.

## SQLite Local DB Center

Buka menu Reset/Maintenance, lalu tab Offline DB. UI aktif sekarang adalah SQLite Local DB Center.

Yang bisa dicek dari sana:

- status backend SQLite;
- status database lokal;
- migration status per modul;
- backup SQLite;
- restore plan/preview;
- guard modul yang belum boleh dimigrasi.

## Hal penting untuk jaringan LAN/HP

- Laptop/PC utama harus menjalankan backend dan frontend.
- HP/laptop lain harus berada di WiFi/LAN yang sama.
- Buka frontend dari HP memakai `http://IP-LAPTOP:5173/Inventory-App/`.
- Jika frontend bisa dibuka tapi data kosong/error, cek backend `http://IP-LAPTOP:3001/health`.
- File SQLite berada di laptop/PC utama, bukan di HP.

## Batasan penting

- React tidak membaca file SQLite langsung; semua akses data harus lewat backend.
- Supplier master-only memakai repository SQLite untuk pilot. Relasi purchase/raw/history tetap guarded dan belum menjadi transaksi final SQLite.
- Stock, transaksi, finance, production, payroll, dan HPP belum SQLite runtime.
- Backup SQLite tidak otomatis menggantikan backup bisnis/operasional. Simpan backup dengan hati-hati.
- Restore destructive hanya boleh dilakukan dengan admin lokal, file backup eksplisit, keyword guard, dan backup otomatis sebelum overwrite.

## Troubleshooting

### Backend tidak terhubung

Cek:

```bash
curl http://localhost:3001/health
```

Dari HP/laptop lain:

```text
http://IP-LAPTOP:3001/health
```

Jika gagal, cek IP laptop, firewall/private network, dan pastikan backend masih berjalan.

### Data di HP kosong padahal di laptop ada

Kemungkinan HP masih mengarah ke backend yang salah atau backend tidak bisa diakses dari jaringan. Set `VITE_SQLITE_API_BASE_URL=http://IP-LAPTOP:3001`, restart frontend, lalu cek ulang.

### Supplier tidak ikut SQLite

Ini sengaja. `VITE_SUPPLIERS_REPOSITORY_MODE=sqlite` harus tetap dipakai sampai audit supplier selesai.

### Ada dokumen lama menyebut Dexie/IndexedDB

Abaikan instruksi runtime Dexie/IndexedDB lama. Kontrak aktif terbaru ada di `docs/10_OFFLINE_DATABASE_CONTRACT.md` dan `docs/17_SQLITE_OFFLINE_WEB_ROADMAP.md`.
