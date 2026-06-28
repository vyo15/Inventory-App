const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const frontendRoot = path.join(root, "frontend", "src");
const backendRoot = path.join(root, "backend");
const envExamplePath = path.join(root, "frontend", ".env.example");
const { TABLES } = require(path.join(backendRoot, "src", "db", "schema.js"));

const oldRemoteToken = ["fire", "base"].join("");
const oldRemoteStoreToken = ["fire", "store"].join("");
const oldBrowserDbToken = ["dex", "ie"].join("");
const oldRemoteMode = `${oldRemoteToken}_primary`;

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

const parseEnvFile = (filePath) => {
  const env = {};
  for (const line of readText(filePath).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    env[key.trim()] = rest.join("=").trim();
  }
  return env;
};

const frontendFiles = walkFiles(frontendRoot, (file) => /\.(js|jsx|ts|tsx)$/.test(file));
const backendRuntimeFiles = walkFiles(path.join(backendRoot, "src"), (file) => /\.(js|cjs|mjs)$/.test(file));
const allowedHardDeleteRuntimeFiles = new Set([
  path.join(backendRoot, "src", "modules", "maintenance", "maintenance.purge.service.js"),
  path.join(backendRoot, "src", "modules", "maintenance", "maintenance.dataQuality.service.js"),
]);
const hardDeleteRuntimeFiles = backendRuntimeFiles.filter((file) => /\bDELETE\s+FROM\b/i.test(readText(file)));
const unguardedHardDeleteRuntimeFiles = hardDeleteRuntimeFiles.filter((file) => !allowedHardDeleteRuntimeFiles.has(file));
const oldRemoteRuntimeFiles = frontendFiles.filter((file) => {
  const text = readText(file).toLowerCase();
  return text.includes(`${oldRemoteToken}/${oldRemoteStoreToken}`) ||
    text.includes("../../" + oldRemoteToken) ||
    text.includes("../" + oldRemoteToken) ||
    text.includes("../../../" + oldRemoteToken);
});
const oldBrowserDbRuntimeFiles = frontendFiles.filter((file) => {
  const text = readText(file).toLowerCase();
  return text.includes(oldBrowserDbToken) ||
    text.includes("adapters/" + oldBrowserDbToken) ||
    text.includes("data/local") ||
    text.includes("data/sync");
});

const requiredTables = Object.values(TABLES);
const migrateText = readText(path.join(backendRoot, "src", "db", "migrate.js"));
const serverText = readText(path.join(backendRoot, "src", "server.js"));

const legacyRepositoryModeKeys = [
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
const frontendEnvPaths = [
  envExamplePath,
  path.join(root, "frontend", ".env"),
  path.join(root, "frontend", ".env.local"),
  path.join(root, "frontend", ".env.development"),
  path.join(root, "frontend", ".env.production"),
].filter((filePath) => fs.existsSync(filePath));
const parsedFrontendEnvs = frontendEnvPaths.map((filePath) => ({
  file: path.relative(root, filePath),
  values: parseEnvFile(filePath),
}));
const envGuards = Object.fromEntries([
  "VITE_AUTH_MODE",
  ...legacyRepositoryModeKeys,
].map((key) => [
  key,
  parsedFrontendEnvs.map(({ file, values }) => ({ file, value: values[key] }))
    .filter((item) => item.value !== undefined),
]));
const configuredLegacyModes = parsedFrontendEnvs.flatMap(({ file, values }) => (
  legacyRepositoryModeKeys
    .filter((key) => values[key] !== undefined)
    .map((key) => ({ file, key, value: values[key] }))
));
const legacyRepositoryModeSourceFiles = frontendFiles.filter((file) => {
  const text = readText(file);
  return legacyRepositoryModeKeys.some((key) => text.includes(key));
});
const sqliteOptInCount = configuredLegacyModes.filter((item) => String(item.value).toLowerCase() === "sqlite").length;
const nonSqliteModeOverrides = configuredLegacyModes.filter((item) => {
  const value = item.value;
  const normalized = String(value || "").trim().toLowerCase();
  return normalized && normalized !== "sqlite";
});
const nonSqliteCount = nonSqliteModeOverrides.length;
const oldRemoteModeCount = configuredLegacyModes.filter((item) => String(item.value).toLowerCase() === oldRemoteMode).length;

const requiredRoutes = [
  "/api/settings",
  "/api/auth",
  "/api/customers",
  "/api/categories",
  "/api/suppliers",
  "/api/pricing-rules",
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
  "/api/maintenance",
  "/api/audit-logs",
  "/api/module-runtime-status",
  "/api/realtime",
];

const result = {
  generatedAt: new Date().toISOString(),
  envGuards,
  configuredLegacyModes,
  nonSqliteModeOverrides,
  legacyRepositoryModeSourceFileCount: legacyRepositoryModeSourceFiles.length,
  legacyRepositoryModeSourceFiles: legacyRepositoryModeSourceFiles.map((file) => path.relative(root, file)),
  moduleCutoverSummary: {
    sqliteOnlyRuntime: true,
    configuredLegacyModeCount: configuredLegacyModes.length,
    sqliteOptInCount,
    nonSqliteCount,
    oldRemoteModeCount,
  },
  frontendHasOldRemoteRuntime: oldRemoteRuntimeFiles.length > 0,
  frontendHasOldBrowserDbRuntime: oldBrowserDbRuntimeFiles.length > 0,
  oldRemoteRuntimeFileCount: oldRemoteRuntimeFiles.length,
  oldBrowserDbRuntimeFileCount: oldBrowserDbRuntimeFiles.length,
  directSqliteFrontendFileCount: frontendFiles.filter((file) => /adapters\/sqlite|requestSqliteApi/.test(readText(file))).length,
  hardDeletePolicy: {
    mode: "maintenance_only",
    detectedFiles: hardDeleteRuntimeFiles.map((file) => path.relative(root, file)),
    unguardedFiles: unguardedHardDeleteRuntimeFiles.map((file) => path.relative(root, file)),
  },
  foundationTables: requiredTables.map((table) => ({ table, ready: migrateText.includes(table) })),
  mountedRoutes: requiredRoutes.map((route) => ({ route, mounted: serverText.includes(route) })),
};

console.log(JSON.stringify(result, null, 2));

if (process.argv.includes("--strict")) {
  const blockers = [];
  if (result.frontendHasOldRemoteRuntime) blockers.push("Runtime remote lama masih terdeteksi di frontend; SQLite-only belum bersih.");
  if (result.frontendHasOldBrowserDbRuntime) blockers.push("Runtime browser DB lama masih terdeteksi di frontend.");
  if (result.legacyRepositoryModeSourceFileCount > 0) blockers.push("Source frontend masih membaca repository mode lama per modul.");
  if (result.nonSqliteModeOverrides.length > 0) blockers.push("Ada konfigurasi repository mode lama non-SQLite pada file environment frontend.");
  if (result.foundationTables.some((item) => !item.ready)) blockers.push("Ada table foundation SQLite yang belum dibuat migration.");
  if (result.mountedRoutes.some((item) => !item.mounted)) blockers.push("Ada backend route foundation yang belum mounted.");
  if (result.hardDeletePolicy.unguardedFiles.length > 0) blockers.push("Hard-delete runtime ditemukan di luar Maintenance guarded flow.");
  if (blockers.length > 0) {
    console.error(`\nSTRICT BLOCKERS:\n- ${blockers.join("\n- ")}`);
    process.exit(1);
  }
}
