const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const frontendRoot = path.join(root, "frontend", "src");
const backendRoot = path.join(root, "backend");
const envExamplePath = path.join(root, "frontend", ".env.example");

const walkFiles = (dir, matcher = () => true) => {
  if (!fs.existsSync(dir)) return [];
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkFiles(fullPath, matcher));
    } else if (matcher(fullPath)) {
      result.push(fullPath);
    }
  }
  return result;
};

const readText = (filePath) => fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";

const parseEnvExample = () => {
  const env = {};
  for (const line of readText(envExamplePath).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    env[key.trim()] = rest.join("=").trim();
  }
  return env;
};

const frontendFiles = walkFiles(frontendRoot, (file) => /\.(js|jsx|ts|tsx)$/.test(file));
const backendFiles = walkFiles(path.join(backendRoot, "src"), (file) => /\.js$/.test(file));
const firebaseFiles = frontendFiles.filter((file) => /firebase\/firestore|\.\.\/\.\.\/firebase|from ['\"]\.\.\/firebase|from ['\"]\.\.\/\.\.\/firebase|from ['\"]\.\.\/\.\.\/\.\.\/firebase/.test(readText(file)));
const dexieFiles = frontendFiles.filter((file) => /dexie|adapters\/dexie|data\/local|data\/sync/.test(readText(file)));

const requiredTables = [
  "products",
  "raw_materials",
  "semi_finished_materials",
  "stock_read_models",
  "stock_adjustments",
  "inventory_logs",
  "purchases",
  "sales",
  "returns",
  "incomes",
  "expenses",
  "money_movement_ledger",
  "production_steps",
  "production_employees",
  "production_profiles",
  "production_boms",
  "production_planning",
  "production_orders",
  "production_work_logs",
  "production_payrolls",
  "report_snapshots",
  "migration_identity_map",
];
const migrateText = readText(path.join(backendRoot, "src", "db", "migrate.js"));
const serverText = readText(path.join(backendRoot, "src", "server.js"));

const env = parseEnvExample();
const guardKeys = [
  "VITE_AUTH_MODE",
  "VITE_SUPPLIERS_REPOSITORY_MODE",
  "VITE_PRICING_RULES_REPOSITORY_MODE",
  "VITE_PRODUCTS_REPOSITORY_MODE",
  "VITE_RAW_MATERIALS_REPOSITORY_MODE",
  "VITE_STOCK_READ_MODELS_REPOSITORY_MODE",
  "VITE_SEMI_FINISHED_REPOSITORY_MODE",
  "VITE_STOCK_ADJUSTMENTS_REPOSITORY_MODE",
  "VITE_TRANSACTIONS_REPOSITORY_MODE",
  "VITE_FINANCE_REPOSITORY_MODE",
  "VITE_PRODUCTION_REPOSITORY_MODE",
  "VITE_REPORTS_REPOSITORY_MODE",
];
const envGuards = Object.fromEntries(guardKeys.map((key) => [key, env[key] || null]));
const sqliteOptInCount = Object.values(envGuards).filter((value) => String(value).toLowerCase() === "sqlite").length;
const guardedCount = Object.values(envGuards).filter((value) => String(value).toLowerCase() === "firebase_primary").length;

const result = {
  generatedAt: new Date().toISOString(),
  envGuards,
  moduleCutoverSummary: { sqliteOptInCount, guardedCount },
  frontendHasFirebase: firebaseFiles.length > 0,
  frontendHasDexie: dexieFiles.length > 0,
  firebaseRuntimeFileCount: firebaseFiles.length,
  dexieRuntimeFileCount: dexieFiles.length,
  directSqliteFrontendFileCount: frontendFiles.filter((file) => /adapters\/sqlite|requestSqliteApi/.test(readText(file))).length,
  foundationTables: requiredTables.map((table) => ({ table, ready: migrateText.includes(table) })),
  mountedRoutes: [
    "/api/products",
    "/api/raw-materials",
    "/api/semi-finished-materials",
    "/api/stock-read-models",
    "/api/stock",
    "/api/stock-adjustments",
    "/api/transactions",
    "/api/finance",
    "/api/production",
    "/api/reports",
  ].map((route) => ({ route, mounted: serverText.includes(route) })),
};

console.log(JSON.stringify(result, null, 2));

if (process.argv.includes("--strict")) {
  const blockers = [];
  if (result.frontendHasFirebase) blockers.push("Firebase/Firestore masih dipakai frontend; Firebase removal belum aman.");
  if (result.frontendHasDexie) blockers.push("Dexie legacy masih terdeteksi di runtime frontend.");
  if (result.foundationTables.some((item) => !item.ready)) blockers.push("Ada table foundation SQLite yang belum dibuat migration.");
  if (result.mountedRoutes.some((item) => !item.mounted)) blockers.push("Ada backend route foundation yang belum mounted.");
  if (blockers.length > 0) {
    console.error(`\nSTRICT BLOCKERS:\n- ${blockers.join("\n- ")}`);
    process.exit(1);
  }
}
