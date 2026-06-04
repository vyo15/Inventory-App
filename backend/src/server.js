const express = require("express");
const cors = require("cors");
const env = require("./config/env");
const { runMigrations } = require("./db/migrate");
const { getDbPath } = require("./db/connection");
const requestLogger = require("./middlewares/requestLogger");
const { errorHandler, notFoundHandler } = require("./middlewares/errorHandler");
const { success } = require("./utils/response");
const healthRoutes = require("./modules/health/health.routes");
const settingsRoutes = require("./modules/settings/settings.routes");
const authRoutes = require("./modules/auth/auth.routes");
const customersRoutes = require("./modules/customers/customers.routes");
const categoriesRoutes = require("./modules/categories/categories.routes");
const suppliersRoutes = require("./modules/suppliers/suppliers.routes");
const pricingRulesRoutes = require("./modules/pricingRules/pricingRules.routes");
const maintenanceRoutes = require("./modules/maintenance/maintenance.routes");
const auditLogsRoutes = require("./modules/auditLogs/auditLogs.routes");
const migrationStatusRoutes = require("./modules/migrationStatus/migrationStatus.routes");
const productsRoutes = require("./modules/products/products.routes");
const rawMaterialsRoutes = require("./modules/rawMaterials/rawMaterials.routes");
const semiFinishedMaterialsRoutes = require("./modules/semiFinishedMaterials/semiFinishedMaterials.routes");
const stockReadModelsRoutes = require("./modules/stockReadModels/stockReadModels.routes");
const stockRoutes = require("./modules/stock/stock.routes");
const stockAdjustmentsRoutes = require("./modules/stockAdjustments/stockAdjustments.routes");
const transactionsRoutes = require("./modules/transactions/transactions.routes");
const financeRoutes = require("./modules/finance/finance.routes");
const productionRoutes = require("./modules/production/production.routes");
const reportsRoutes = require("./modules/reports/reports.routes");

const app = express();

app.use(cors({ origin: env.corsOrigin === "*" ? true : env.corsOrigin }));
app.use(express.json({ limit: "1mb" }));
app.use(requestLogger);

app.get("/api", (req, res) => success(res, "IMS SQLite sidecar API aktif", {
  endpoints: [
    "GET /health",
    "GET /api/settings",
    "GET /api/auth/status",
    "POST /api/auth/bootstrap-admin",
    "POST /api/auth/login",
    "GET /api/auth/me",
    "POST /api/auth/logout",
    "GET /api/auth/users",
    "POST /api/auth/users",
    "PUT /api/auth/users/:id",
    "GET /api/customers",
    "GET /api/customers/generate-code",
    "GET /api/customers/:id",
    "POST /api/customers",
    "PUT /api/customers/:id",
    "DELETE /api/customers/:id",
    "GET /api/categories",
    "GET /api/categories/:id",
    "POST /api/categories",
    "PUT /api/categories/:id",
    "DELETE /api/categories/:id",
    "GET /api/suppliers",
    "GET /api/suppliers/generate-code",
    "GET /api/suppliers/:id",
    "POST /api/suppliers",
    "PUT /api/suppliers/:id",
    "DELETE /api/suppliers/:id",
    "GET /api/pricing-rules",
    "GET /api/pricing-rules/generate-code",
    "GET /api/pricing-rules/:id",
    "POST /api/pricing-rules",
    "PUT /api/pricing-rules/:id",
    "DELETE /api/pricing-rules/:id",
    "GET /api/products",
    "POST /api/products",
    "PUT /api/products/:id",
    "DELETE /api/products/:id",
    "GET /api/raw-materials",
    "POST /api/raw-materials",
    "PUT /api/raw-materials/:id",
    "DELETE /api/raw-materials/:id",
    "GET /api/semi-finished-materials",
    "GET /api/stock-read-models",
    "POST /api/stock/adjustments/commit",
    "GET /api/stock-adjustments",
    "GET /api/transactions/purchases",
    "POST /api/transactions/purchases/commit",
    "GET /api/transactions/sales",
    "POST /api/transactions/sales/commit",
    "PUT /api/transactions/sales/:id/status",
    "GET /api/transactions/returns",
    "POST /api/transactions/returns/commit",
    "GET /api/finance/incomes",
    "GET /api/production/steps",
    "GET /api/reports",
    "GET /api/maintenance/status",
    "POST /api/maintenance/backup",
    "GET /api/maintenance/backups",
    "POST /api/maintenance/restore-plan",
    "POST /api/maintenance/restore-execute",
    "GET /api/maintenance/restore-logs",
    "GET /api/migration-status",
    "GET /api/audit-logs",
  ],
  guardedReminder: "SQLite local menjadi target runtime lokal untuk modul pilot. Modul guarded tetap belum dimutasi offline.",
}));

app.use("/health", healthRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/customers", customersRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/suppliers", suppliersRoutes);
app.use("/api/pricing-rules", pricingRulesRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/raw-materials", rawMaterialsRoutes);
app.use("/api/semi-finished-materials", semiFinishedMaterialsRoutes);
app.use("/api/stock-read-models", stockReadModelsRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/stock-adjustments", stockAdjustmentsRoutes);
app.use("/api/transactions", transactionsRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/production", productionRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/audit-logs", auditLogsRoutes);
app.use("/api/migration-status", migrationStatusRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  await runMigrations();

  app.listen(env.port, env.host, () => {
    console.log(`IMS SQLite sidecar backend jalan di http://localhost:${env.port}`);
    console.log(`Database SQLite: ${getDbPath()}`);
    console.log("Mode: SQLite local primary pilot untuk master data aman. Modul guarded belum dimutasi offline.");
  });
}

startServer().catch((error) => {
  console.error("Gagal menjalankan IMS SQLite sidecar backend:", error);
  process.exit(1);
});
