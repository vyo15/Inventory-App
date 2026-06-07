// -----------------------------------------------------------------------------
// Reset Maintenance Data Config — GUARDED
//
// Behavior-preserving extraction dari resetMaintenanceDataService.js.
// File ini hanya menyimpan allowlist, mode, baseline key, dan config field cost.
// Jangan menambah collection/field destructive tanpa review schema, data integrity,
// dan approval eksplisit.
// -----------------------------------------------------------------------------

export const DEFAULT_RESET_MODULES = [
  "sales",
  "purchases",
  "returns",
  "production",
  "cash_and_expenses",
  "stock_adjustment_and_logs",
  "all_inventory_logs",
  "pricing_logs",
];

// Preset reset development paling lengkap yang tetap menjaga protected master.
// Digunakan oleh tombol Reset Semua Testing agar admin tidak perlu memilih modul satu per satu.
export const RESET_ALL_TESTING_MODULES = [
  "sales",
  "purchases",
  "returns",
  "production_planning_only",
  "production",
  "cash_and_expenses",
  "stock_adjustment_and_logs",
  "pricing_logs",
];

export const FULL_TESTING_RESET_HPP_MODE = "all_hpp_cost_sources";

export const RESET_MODE_OPTIONS = [
  {
    value: "transaction_only",
    label: "Reset Transaksi",
    description: "Hapus transaksi dan log saja. Stok master tetap seperti sekarang.",
  },
  {
    value: "reset_and_zero_stock",
    label: "Reset + Nolkan Semua Stok",
    description:
      "Hapus transaksi lalu set stok bahan baku, semi finished, dan produk jadi ke nol.",
  },
  {
    value: "reset_and_restore_baseline",
    label: "Reset + Baseline Testing",
    description:
      "Hapus transaksi lalu kembalikan stok ke baseline testing yang sudah disimpan.",
  },
];

export const BASELINE_COLLECTION = "testing_baselines";
export const BASELINE_DOC_ID = "inventory_reset_baseline";

/*
=====================================================
SECTION: HPP cost reset constants — GUARDED
Fungsi:
- Menyediakan mode reset modal/HPP yang hanya menyentuh field cost master untuk kebutuhan trial & error HPP.

Dipakai oleh:
- resetMaintenanceDataService.js dan section HPP Cost Testing / Reset Modal di ResetMaintenanceData.jsx.

Alasan perubahan:
- Menambahkan jalur maintenance terpisah untuk preview, baseline, reset, dan restore sumber cost HPP tanpa menyentuh transaksi produksi aktif.

Catatan cleanup:
- Jika nanti ada field cost resmi baru di master item, tambahkan ke config ini setelah audit schema/source.

Risiko:
- Salah menambah field di config ini dapat mereset data non-cost seperti stok, harga jual, transaksi, atau relasi produksi.
=====================================================
*/
export const HPP_COST_BASELINE_DOC_ID = "hpp_cost_testing_baseline";

export const HPP_COST_RESET_OPTIONS = [
  {
    value: "raw_actual_cost_only",
    label: "Reset Modal Aktual Bahan Baku",
    description: "Nolkan modal aktual rata-rata bahan baku tanpa mengubah stok atau transaksi.",
  },
  {
    value: "raw_reference_cost_only",
    label: "Reset Modal Referensi Rata-rata",
    description: "Nolkan referensi restock bahan baku tanpa mengubah modal aktual, stok, atau supplier.",
  },
  {
    value: "product_hpp_only",
    label: "Reset HPP Produk Jadi",
    description: "Nolkan field HPP/cost produk jadi tanpa mengubah harga jual, stok, SKU, atau pricing rules.",
  },
  {
    value: "semi_finished_average_cost_only",
    label: "Reset HPP Semi Finished",
    description: "Nolkan HPP/average cost semi finished tanpa mengubah stok, reserved, atau relasi BOM.",
  },
  {
    value: "all_hpp_cost_sources",
    label: "Reset Semua Modal & HPP",
    description: "Nolkan seluruh field modal/HPP master aktif untuk trial HPP tanpa menyentuh transaksi.",
  },
];

export const STOCK_COLLECTIONS = ["raw_materials", "semi_finished_materials", "products"];

export const HPP_COST_COLLECTION_CONFIGS = {
  raw_materials: {
    label: "Raw Materials",
    fields: ["averageActualUnitCost", "restockReferencePrice"],
    variantFields: ["averageActualUnitCost", "restockReferencePrice"],
  },
  products: {
    label: "Products",
    fields: ["hppPerUnit", "averageCostPerUnit", "costPerUnit"],
    variantFields: ["hppPerUnit", "averageCostPerUnit", "costPerUnit"],
  },
  semi_finished_materials: {
    label: "Semi Finished Materials",
    fields: ["averageCostPerUnit", "lastProductionCostPerUnit", "referenceCostPerUnit", "costPerUnit"],
    variantFields: ["averageCostPerUnit", "lastProductionCostPerUnit", "referenceCostPerUnit", "costPerUnit"],
  },
};

export const HPP_COST_VARIANT_FIELD_KEYS = new Set(
  Object.values(HPP_COST_COLLECTION_CONFIGS).flatMap((item) => item.variantFields || []),
);

export const HPP_COST_RESET_MODE_CONFIG = {
  raw_actual_cost_only: {
    collections: [{ key: "raw_materials", fields: ["averageActualUnitCost"], variantFields: ["averageActualUnitCost"] }],
  },
  raw_reference_cost_only: {
    collections: [{ key: "raw_materials", fields: ["restockReferencePrice"], variantFields: ["restockReferencePrice"] }],
  },
  product_hpp_only: {
    collections: [{ key: "products", fields: ["hppPerUnit", "averageCostPerUnit", "costPerUnit"], variantFields: ["hppPerUnit", "averageCostPerUnit", "costPerUnit"] }],
  },
  semi_finished_average_cost_only: {
    collections: [{ key: "semi_finished_materials", fields: ["averageCostPerUnit", "lastProductionCostPerUnit", "referenceCostPerUnit", "costPerUnit"], variantFields: ["averageCostPerUnit", "lastProductionCostPerUnit", "referenceCostPerUnit", "costPerUnit"] }],
  },
  all_hpp_cost_sources: {
    collections: [
      { key: "raw_materials", fields: ["averageActualUnitCost", "restockReferencePrice"], variantFields: ["averageActualUnitCost", "restockReferencePrice"] },
      { key: "products", fields: ["hppPerUnit", "averageCostPerUnit", "costPerUnit"], variantFields: ["hppPerUnit", "averageCostPerUnit", "costPerUnit"] },
      { key: "semi_finished_materials", fields: ["averageCostPerUnit", "lastProductionCostPerUnit", "referenceCostPerUnit", "costPerUnit"], variantFields: ["averageCostPerUnit", "lastProductionCostPerUnit", "referenceCostPerUnit", "costPerUnit"] },
    ],
  },
};

export const VALID_HPP_COST_RESET_MODES = new Set(HPP_COST_RESET_OPTIONS.map((item) => item.value));

// -----------------------------------------------------------------------------
// Protected master data.
// ACTIVE / GUARDED:
// - daftar ini menjadi pagar terakhir agar reset transaksi/testing tidak
//   menghapus master penting seperti Supplier secara default;
// - collection supplierPurchases adalah master Supplier/vendor restock, bukan
//   transaksi pembelian, sehingga tidak boleh ikut reset module Purchases.
// -----------------------------------------------------------------------------
export const PROTECTED_MASTER_COLLECTIONS = [
  { key: "supplierPurchases", label: "Supplier / Vendor Restock", reason: "Master Supplier dilindungi dari reset default." },
  { key: "raw_materials", label: "Raw Materials", reason: "Master stok bahan baku tidak dihapus oleh reset transaksi." },
  { key: "products", label: "Products", reason: "Master produk tidak dihapus oleh reset transaksi." },
  { key: "customers", label: "Customers", reason: "Master customer tetap dipertahankan." },
  { key: "production_steps", label: "Production Steps", reason: "Master step produksi tetap dipertahankan." },
  { key: "production_employees", label: "Production Employees", reason: "Master karyawan produksi tetap dipertahankan." },
  { key: "semi_finished_materials", label: "Semi Finished Materials", reason: "Master bahan setengah jadi tidak dihapus oleh reset transaksi." },
  { key: "production_boms", label: "Production BOMs", reason: "Master BOM/setup produksi tetap dipertahankan." },
];

export const PROTECTED_COLLECTION_KEYS = new Set(PROTECTED_MASTER_COLLECTIONS.map((item) => item.key));

// -----------------------------------------------------------------------------
// Data test marker.
// ACTIVE / DEV TOOL:
// - fitur hapus data test hanya boleh menghapus dokumen yang punya marker ini;
// - dokumen normal tanpa marker tidak boleh ikut terhapus.
// -----------------------------------------------------------------------------
export const DEV_TEST_DATA_MARKER = {
  isTestData: true,
  sourceModule: "dev_test_seed",
  createdBy: "dev_seed",
};

export const TEST_DATA_CLEANUP_COLLECTIONS = [
  "purchases",
  "sales",
  "returns",
  "expenses",
  "incomes",
  "revenues",
  "stock_adjustments",
  "inventory_logs",
  "production_orders",
  "production_work_logs",
  "production_payrolls",
  "production_plans",
  "pricing_logs",
];

export const BATCH_LIMIT = 400;
export const SAFE_CLIENT_BATCH_OPERATION_LIMIT = BATCH_LIMIT;
export const VALID_RESET_MODES = new Set(RESET_MODE_OPTIONS.map((item) => item.value));
export const STOCK_COLLECTION_KEYS = new Set(STOCK_COLLECTIONS);

/*
=====================================================
SECTION: Master data export collections — AKTIF
Fungsi:
- Menjadi allowlist read-only untuk export data pokok sebelum reset development.

Dipakai oleh:
- ResetMaintenanceData.jsx melalui getMasterDataExportPreview dan buildMasterDataExportPayload.

Alasan perubahan:
- Owner/developer membutuhkan backup/checklist master data sebelum menjalankan reset destructive.

Catatan cleanup:
- Export XLSX dan import normalized adalah task terpisah setelah approval desain.

Risiko:
- Jangan masukkan transaksi/log turunan ke daftar default ini agar data lama tidak dibawa ulang sebagai sumber kebenaran baru.
=====================================================
*/
export const MASTER_DATA_EXPORT_COLLECTIONS = [
  { key: "products", label: "Products" },
  { key: "raw_materials", label: "Raw Materials" },
  { key: "semi_finished_materials", label: "Semi Finished Materials" },
  { key: "supplierPurchases", label: "Supplier / Vendor Restock" },
  { key: "customers", label: "Customers" },
  { key: "production_steps", label: "Production Steps" },
  { key: "production_employees", label: "Production Employees" },
  { key: "production_boms", label: "Production BOMs" },
  { key: "pricing_rules", label: "Pricing Rules" },
  { key: "categories", label: "Categories" },
  { key: "production_profiles", label: "Production Profiles" },
];

export const MASTER_DATA_OPENING_STOCK_COLLECTIONS = new Set([
  "products",
  "raw_materials",
  "semi_finished_materials",
]);


// -----------------------------------------------------------------------------
// Reset target collections.
// IMS NOTE [AKTIF/GUARDED] — daftar ini dipakai sebagai kontrak lokal dengan
// Reset/maintenance staged-final. Target data baru wajib ditambahkan eksplisit
// setelah diaudit agar reset tidak menyentuh scope yang tidak dikenal.
// Behavior-preserving cleanup: hanya merapikan grouping allowlist, bukan mengubah
// target reset, role, schema, atau business rules.
// -----------------------------------------------------------------------------
export const RESET_TRANSACTION_COLLECTIONS = [
  "purchases",
  "sales",
  "returns",
  "expenses",
  "incomes",
  "revenues",
  "stock_adjustments",
  "inventory_logs",
  "production_orders",
  "production_work_logs",
  "production_payrolls",
  "production_plans",
  "pricing_logs",
];

// IMS NOTE [DATA LAMA/GUARDED] — collection produksi lama tetap diizinkan hanya
// karena reset service masih punya opsi cleanup data lama. Jangan jadikan flow aktif.
export const RESET_ARCHIVED_COLLECTIONS = ["productions"];

export const RESET_ALLOWED_DELETE_COLLECTIONS = new Set([
  ...RESET_TRANSACTION_COLLECTIONS,
  ...RESET_ARCHIVED_COLLECTIONS,
]);

