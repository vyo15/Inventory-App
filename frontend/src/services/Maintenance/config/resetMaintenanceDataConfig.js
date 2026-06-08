// -----------------------------------------------------------------------------
// Maintenance Data Config — GUARDED
//
// File ini hanya menyimpan konfigurasi maintenance aktif: export master dan
// trial modal/HPP. Reset transaksi/testing destructive lama sudah tidak tersedia
// di UI operasional dan tidak boleh diaktifkan ulang tanpa desain guard baru.
// -----------------------------------------------------------------------------

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
    collections: [
      {
        key: "products",
        fields: ["hppPerUnit", "averageCostPerUnit", "costPerUnit"],
        variantFields: ["hppPerUnit", "averageCostPerUnit", "costPerUnit"],
      },
    ],
  },
  semi_finished_average_cost_only: {
    collections: [
      {
        key: "semi_finished_materials",
        fields: [
          "averageCostPerUnit",
          "lastProductionCostPerUnit",
          "referenceCostPerUnit",
          "costPerUnit",
        ],
        variantFields: [
          "averageCostPerUnit",
          "lastProductionCostPerUnit",
          "referenceCostPerUnit",
          "costPerUnit",
        ],
      },
    ],
  },
  all_hpp_cost_sources: {
    collections: [
      { key: "raw_materials", fields: ["averageActualUnitCost", "restockReferencePrice"], variantFields: ["averageActualUnitCost", "restockReferencePrice"] },
      { key: "products", fields: ["hppPerUnit", "averageCostPerUnit", "costPerUnit"], variantFields: ["hppPerUnit", "averageCostPerUnit", "costPerUnit"] },
      {
        key: "semi_finished_materials",
        fields: [
          "averageCostPerUnit",
          "lastProductionCostPerUnit",
          "referenceCostPerUnit",
          "costPerUnit",
        ],
        variantFields: [
          "averageCostPerUnit",
          "lastProductionCostPerUnit",
          "referenceCostPerUnit",
          "costPerUnit",
        ],
      },
    ],
  },
};

export const VALID_HPP_COST_RESET_MODES = new Set(HPP_COST_RESET_OPTIONS.map((item) => item.value));

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

export const STOCK_COLLECTION_KEYS = new Set(STOCK_COLLECTIONS);
