# Contoh `.env.local` SQLite Local IMS

File ini hanya contoh. Jangan commit `frontend/.env.local` karena file env lokal harus tetap ignored oleh Git.

Frontend tidak lagi memakai variabel `VITE_*_REPOSITORY_MODE`. Seluruh modul selalu menggunakan backend SQLite lokal/LAN.

## Laptop yang sama

```env
VITE_AUTH_MODE=sqlite
# VITE_SQLITE_API_BASE_URL=http://localhost:3001
```

Kosongkan `VITE_SQLITE_API_BASE_URL` agar frontend otomatis memakai hostname halaman saat ini dengan port backend `3001`.

## HP/laptop lain satu WiFi

Ganti `IP-LAPTOP` dengan IP komputer yang menjalankan backend:

```env
VITE_AUTH_MODE=sqlite
VITE_SQLITE_API_BASE_URL=http://IP-LAPTOP:3001
```

Production, Payroll, HPP, Stock, Purchase, Sales, Finance, dan Restore tetap guarded melalui service/backend resmi. Menghapus repository-mode switcher tidak mengubah business guard atau memberi izin direct database write dari frontend.
