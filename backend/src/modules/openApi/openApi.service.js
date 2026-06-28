const buildOpenApiDocument = ({ baseUrl = "http://localhost:3001" } = {}) => ({
  openapi: "3.1.0",
  info: {
    title: "IMS Bunga Flanel Local API",
    version: "0.1.0",
    description: "Kontrak ringkas endpoint aktif IMS SQLite lokal/LAN. Business mutation tetap wajib melalui endpoint commit resmi.",
  },
  servers: [{ url: baseUrl }],
  tags: [
    { name: "Health" },
    { name: "Auth" },
    { name: "Inventory" },
    { name: "Transactions" },
    { name: "Finance" },
    { name: "Production" },
    { name: "Maintenance" },
    { name: "Realtime" },
    { name: "Testing Lab" },
  ],
  components: {
    securitySchemes: {
      localSessionCookie: {
        type: "apiKey",
        in: "cookie",
        name: "ims_session",
        description: "Cookie session HttpOnly yang dibuat oleh endpoint login.",
      },
    },
    schemas: {
      ApiResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          message: { type: "string" },
          data: {},
          meta: { type: ["object", "null"], additionalProperties: true },
          errorCode: { type: ["string", "null"] },
          details: { type: ["object", "array", "string", "number", "boolean", "null"] },
        },
        required: ["ok", "message"],
      },
    },
  },
  paths: {
    "/health": {
      get: { tags: ["Health"], summary: "Health check minimal", responses: { 200: { description: "Layanan aktif" } } },
    },
    "/api/auth/status": {
      get: { tags: ["Auth"], summary: "Status bootstrap/login lokal", responses: { 200: { description: "Status auth" } } },
    },
    "/api/auth/login": {
      post: { tags: ["Auth"], summary: "Login dan buat cookie session HttpOnly", responses: { 200: { description: "Login berhasil" }, 401: { description: "Credential invalid" }, 429: { description: "Rate limited" } } },
    },
    "/api/stock/adjustments/commit": {
      post: { tags: ["Inventory"], summary: "Commit penyesuaian stok atomic", security: [{ localSessionCookie: [] }], responses: { 201: { description: "Stock, read model, inventory log, dan audit tersimpan" }, 400: { description: "Payload/source/qty tidak valid" }, 404: { description: "Item stok tidak ditemukan" }, 409: { description: "Referensi duplikat atau konflik stok" } } },
    },
    "/api/transactions/purchases/commit": {
      post: { tags: ["Transactions"], summary: "Commit purchase atomic", security: [{ localSessionCookie: [] }], responses: { 201: { description: "Purchase, stock, expense, ledger, dan audit tersimpan" }, 400: { description: "Payload atau verifikasi purchase tidak valid" }, 409: { description: "Referensi atau versi data konflik" } } },
    },
    "/api/transactions/sales/commit": {
      post: { tags: ["Transactions"], summary: "Commit sale atomic", security: [{ localSessionCookie: [] }], responses: { 201: { description: "Sale, stock, dan audit tersimpan" }, 400: { description: "Payload sale tidak valid" }, 409: { description: "Stok atau versi data konflik" } } },
    },
    "/api/transactions/returns/commit": {
      post: { tags: ["Transactions"], summary: "Commit return terkait sale", security: [{ localSessionCookie: [] }], responses: { 201: { description: "Return dan pemulihan stok tersimpan" }, 400: { description: "Relasi sale, item, atau qty return tidak valid" }, 409: { description: "Qty kumulatif atau stok konflik" } } },
    },
    "/api/finance/cash-in/commit": {
      post: { tags: ["Finance"], summary: "Commit kas masuk dan ledger", security: [{ localSessionCookie: [] }], responses: { 201: { description: "Income dan ledger tersimpan" }, 400: { description: "Nominal atau payload kas masuk tidak valid" }, 409: { description: "Referensi manual duplikat" } } },
    },
    "/api/finance/cash-out/commit": {
      post: { tags: ["Finance"], summary: "Commit kas keluar dan ledger", security: [{ localSessionCookie: [] }], responses: { 201: { description: "Expense dan ledger tersimpan" }, 400: { description: "Nominal atau payload kas keluar tidak valid" }, 409: { description: "Referensi manual duplikat" } } },
    },
    "/api/production/orders/commit": {
      post: { tags: ["Production"], summary: "Buat Production Order dari Planning", security: [{ localSessionCookie: [] }], responses: { 201: { description: "PO dan Planning diperbarui atomic" }, 400: { description: "Planning/BOM tidak valid" }, 409: { description: "Planning sudah terikat atau lifecycle konflik" } } },
    },
    "/api/realtime/status": {
      get: { tags: ["Realtime"], summary: "Revision realtime untuk fallback saat SSE terputus", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Status transport dan revision saat ini" } } },
    },
    "/api/realtime/events": {
      get: { tags: ["Realtime"], summary: "Stream SSE perubahan database lintas client", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Stream event connected, data_changed, database_replaced, dan heartbeat" }, 401: { description: "Session tidak valid" } } },
    },
    "/api/maintenance/status": {
      get: { tags: ["Maintenance"], summary: "Status database, queue, logger, backup, dan auth compatibility", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Status maintenance" } } },
    },
    "/api/maintenance/initial-setup-readiness": {
      get: { tags: ["Maintenance"], summary: "Checklist read-only kesiapan setup database awal", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Progress setup master, stok awal, dan backup baseline" } } },
    },
    "/api/maintenance/backups/import": {
      post: { tags: ["Maintenance"], summary: "Import dan verifikasi File Backup IMS secara atomic", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Backup terdaftar dan diaudit" }, 400: { description: "Backup invalid" } } },
    },
    "/api/maintenance/data-audit": {
      get: { tags: ["Maintenance"], summary: "Audit read-only integritas, stok, backup, dan finance", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Ringkasan audit tanpa perubahan data" } } },
    },
    "/api/maintenance/stock-read-model-audit": {
      get: { tags: ["Maintenance"], summary: "Audit data turunan stok", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Missing, stale, dan orphan projection" } } },
    },
    "/api/maintenance/stock-read-model-rebuild": {
      post: { tags: ["Maintenance"], summary: "Rebuild missing/stale stock read model dari master dengan backup", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Projection diperbarui atomic" } } },
    },
    "/api/maintenance/stock-read-model-orphan-cleanup": {
      post: { tags: ["Maintenance"], summary: "Cleanup orphan stock read model dengan keyword dan backup", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Orphan projection dibersihkan" }, 400: { description: "Keyword konfirmasi salah" } } },
    },
    "/api/maintenance/inactive-data": {
      get: { tags: ["Maintenance"], summary: "Preview kandidat data nonaktif dan dependency blocker", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Daftar kandidat purge allowlisted tanpa perubahan data" } } },
    },
    "/api/maintenance/inactive-data/purge": {
      post: { tags: ["Maintenance"], summary: "Purge permanen data nonaktif dengan backup, konfirmasi ganda, transaction, dan audit snapshot", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Satu record allowlisted dihapus permanen" }, 409: { description: "Masih memiliki dependency/histori protected" } } },
    },
    "/api/maintenance/restore-plan": {
      post: { tags: ["Maintenance"], summary: "Preview restore tanpa write", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Restore plan" } } },
    },
    "/api/maintenance/restore-execute": {
      post: { tags: ["Maintenance"], summary: "Restore guarded dengan keyword dan pre-restore backup", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Restore selesai atau dibatalkan aman" } } },
    },
    "/api/testing-lab/runtime": {
      get: { tags: ["Testing Lab"], summary: "Status ringan mode sandbox untuk badge aplikasi", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Guard sandbox dan status write lock" } } },
    },
    "/api/testing-lab/status": {
      get: { tags: ["Testing Lab"], summary: "Status baseline, sesi, snapshot, skenario, dan riwayat testing", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Status Lab Pengujian" }, 403: { description: "Administrator required" } } },
    },
    "/api/testing-lab/baseline": {
      post: { tags: ["Testing Lab"], summary: "Buat baseline verified pada sandbox terpisah", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Baseline test backup dibuat" }, 409: { description: "Sandbox guard tidak terpenuhi" } } },
    },
    "/api/testing-lab/operational-source/preview": {
      get: { tags: ["Testing Lab"], summary: "Preview read-only database operasional sebelum clone ke sandbox", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Ringkasan source, integrity, akun, dan jumlah data" }, 404: { description: "Database operasional tidak ditemukan" } } },
    },
    "/api/testing-lab/operational-source/clone": {
      post: { tags: ["Testing Lab"], summary: "Clone snapshot read-only operasional menjadi baseline sandbox dengan sanitasi session/log", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Sandbox diganti dan baseline verified aktif" }, 409: { description: "Source tidak aman, sesi aktif, atau schema tidak kompatibel" }, 423: { description: "Masih ada operasi tulis" } } },
    },
    "/api/testing-lab/reset": {
      post: { tags: ["Testing Lab"], summary: "Kembalikan sandbox ke baseline dengan pre-reset backup dan write lock", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Sandbox kembali ke baseline" }, 423: { description: "Masih ada operasi tulis atau reset lain" } } },
    },
    "/api/testing-lab/sessions": {
      post: { tags: ["Testing Lab"], summary: "Mulai sesi skenario pengujian dengan snapshot awal", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Sesi testing aktif" } } },
    },
    "/api/testing-lab/sessions/complete": {
      post: { tags: ["Testing Lab"], summary: "Selesaikan sesi, hitung diff, dan jalankan validasi", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Hasil sesi dan validasi" } } },
    },
    "/api/testing-lab/validate": {
      post: { tags: ["Testing Lab"], summary: "Validasi read-only integrity, stok, projection, admin, dan ledger sandbox", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Hasil validasi sandbox" } } },
    },
  },
});

module.exports = { buildOpenApiDocument };
