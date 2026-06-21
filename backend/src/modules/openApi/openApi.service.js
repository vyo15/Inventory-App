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
          errorCode: { type: ["string", "null"] },
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
      post: { tags: ["Inventory"], summary: "Commit penyesuaian stok atomic", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Stock, read model, inventory log, dan audit tersimpan" } } },
    },
    "/api/transactions/purchases/commit": {
      post: { tags: ["Transactions"], summary: "Commit purchase atomic", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Purchase, stock, expense, ledger, dan audit tersimpan" } } },
    },
    "/api/transactions/sales/commit": {
      post: { tags: ["Transactions"], summary: "Commit sale atomic", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Sale, stock, dan audit tersimpan" } } },
    },
    "/api/transactions/returns/commit": {
      post: { tags: ["Transactions"], summary: "Commit return terkait sale", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Return dan pemulihan stok tersimpan" } } },
    },
    "/api/finance/cash-in/commit": {
      post: { tags: ["Finance"], summary: "Commit kas masuk dan ledger", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Income dan ledger tersimpan" }, 409: { description: "Referensi manual duplikat" } } },
    },
    "/api/finance/cash-out/commit": {
      post: { tags: ["Finance"], summary: "Commit kas keluar dan ledger", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Expense dan ledger tersimpan" }, 409: { description: "Referensi manual duplikat" } } },
    },
    "/api/production/orders/commit": {
      post: { tags: ["Production"], summary: "Buat Production Order dari Planning", security: [{ localSessionCookie: [] }], responses: { 200: { description: "PO dan Planning diperbarui atomic" } } },
    },
    "/api/maintenance/status": {
      get: { tags: ["Maintenance"], summary: "Status database, queue, logger, backup, dan auth compatibility", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Status maintenance" } } },
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
    "/api/maintenance/restore-plan": {
      post: { tags: ["Maintenance"], summary: "Preview restore tanpa write", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Restore plan" } } },
    },
    "/api/maintenance/restore-execute": {
      post: { tags: ["Maintenance"], summary: "Restore guarded dengan keyword dan pre-restore backup", security: [{ localSessionCookie: [] }], responses: { 200: { description: "Restore selesai atau dibatalkan aman" } } },
    },
  },
});

module.exports = { buildOpenApiDocument };
