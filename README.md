# IMS Offline Web

IMS Offline Web adalah project Inventory Management System Bunga Flanel dengan struktur frontend/backend terpisah.

## Struktur folder

```text
Inventory-App/
├── frontend/      # React + Vite UI
├── backend/       # Node.js SQLite sidecar backend
├── data/          # Runtime database lokal, tidak masuk source ZIP bersih
├── backups/       # Runtime backup SQLite, tidak masuk source ZIP bersih
├── scripts/       # Helper command lokal
└── docs/          # Dokumentasi project
```

## Menjalankan frontend

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

Buka dari laptop:

```text
http://localhost:5173/Inventory-App/
```

Buka dari HP/laptop lain satu jaringan:

```text
http://IP-LAPTOP:5173/Inventory-App/
```

## Menjalankan backend SQLite

```bash
cd backend
npm install
npm run check
npm run dev
```

Cek backend:

```bash
curl http://localhost:3001/health
curl http://localhost:3001/api/maintenance/status
```

## Build dan validasi

Frontend:

```bash
cd frontend
npm install
npm run lint
npm run build
```

Backend:

```bash
cd backend
npm install
npm run check
```

## Membuat ZIP bersih

Gunakan `git archive` agar ZIP hanya berisi file yang tracked di Git dan tidak membawa runtime database, backup, `node_modules`, atau `dist`.

Git Bash:

```bash
bash scripts/create-clean-zip.sh
```

PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/create-clean-zip.ps1
```

Manual:

```bash
git archive --format=zip --prefix=Inventory-App/ --output ../Inventory-App-clean.zip HEAD
```

## Catatan runtime data

File berikut dibuat saat aplikasi berjalan dan tidak boleh ikut commit/ZIP distribusi source:

```text
data/*.sqlite
data/*.sqlite-wal
data/*.sqlite-shm
backups/sqlite/*.sqlite
frontend/node_modules/
backend/node_modules/
frontend/dist/
```

Jika database lokal perlu dipindah, lakukan backup/restore secara terpisah. Jangan menjadikan file SQLite runtime sebagai bagian dari source patch.
