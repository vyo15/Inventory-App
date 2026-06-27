import * as sqliteProductsAdapter from "../../data/adapters/sqlite/sqliteProductsAdapter";
import * as sqliteRawMaterialsAdapter from "../../data/adapters/sqlite/sqliteRawMaterialsAdapter";
import * as sqliteSemiFinishedMaterialsAdapter from "../../data/adapters/sqlite/sqliteSemiFinishedMaterialsAdapter";
import { buildStockReadModelRow } from "../../utils/stock/stockHelpers";
import { getStockReadModelRows } from "../Inventory/stockReadModelService";
import { listCategories } from "../../data/repositories/categoriesRepository";
import { CATEGORY_TYPES } from "../../constants/categoryOptions";
import {
  filterCategoriesByType,
  resolveCategoryLabel,
} from "../../utils/categories/categoryHelpers";

const STOCK_REPORT_DEFAULT_PAGE_SIZE = 500;
const STOCK_REPORT_DEFAULT_EXPORT_LIMIT = 20000;

// =====================================================
// SECTION: Stock Report service — AKTIF / READ-ONLY
// Fungsi:
// - memakai data stok turunan sebagai sumber utama Stock Report;
// - mendukung paging cursor dan full-export loop agar laporan tidak hanya bergantung pada rows UI yang termuat;
// - fallback ke source master hanya jika data stok turunan kosong/gagal agar data historis tidak blank sebelum perbaikan maintenance.
// Hubungan flow:
// - read-only; tidak menulis stok, inventory log, transaksi, produksi, atau schema.
// Risiko:
// - data stok laporan tetap turunan. Mutasi stok wajib tetap terjadi di master stock dan inventory_logs.
// =====================================================
const readStockReportSnapshot = async (key, requestPromise) => {
  try {
    return { key, snapshot: await requestPromise, error: null };
  } catch (error) {
    console.warn(`Gagal memuat data Stock Report: ${key}`, error);
    return { key, snapshot: null, error };
  }
};

const buildStockReportMeta = ({
  dataSource = "stock_item_read_models",
  maxResults = 0,
  loadedRows = 0,
  activeRows = 0,
  hasMore = false,
  isLimited = false,
  fallbackReason = "",
  nextCursor = null,
  pageSize = 0,
  exportMode = "page",
  exportLimit = 0,
  orderBy = [],
} = {}) => ({
  dataSource,
  maxResults,
  loadedRows,
  activeRows,
  hasMore,
  isLimited,
  fallbackReason,
  nextCursor,
  pageSize,
  exportMode,
  exportLimit,
  orderBy,
});

const mergeUniqueStockRows = (currentRows = [], nextRows = []) => {
  const rowMap = new Map();

  [...currentRows, ...nextRows].forEach((item) => {
    const key = item.readModelId || `${item.sourceType || item.type || "stock"}__${item.sourceId || item.id || item.name}`;
    rowMap.set(key, item);
  });

  return Array.from(rowMap.values());
};

const readStockReportRowsFromMasterFallback = async ({ fallbackReason = "" } = {}) => {
  const stockReportReads = await Promise.all([
    readStockReportSnapshot("raw_materials_fallback", sqliteRawMaterialsAdapter.listRawMaterials({ limit: 5000 })),
    readStockReportSnapshot("products_fallback", sqliteProductsAdapter.listProducts({ limit: 5000 })),
    readStockReportSnapshot("semi_finished_materials_fallback", sqliteSemiFinishedMaterialsAdapter.listSemiFinishedMaterials({ limit: 5000 })),
  ]);

  const dataByKey = stockReportReads.reduce((accumulator, item) => {
    accumulator[item.key] = Array.isArray(item.snapshot) ? item.snapshot : [];
    return accumulator;
  }, {});

  const rawMaterialsData = dataByKey.raw_materials_fallback.map((item) => buildStockReadModelRow(item, { id: item.id, typeLabel: "Bahan Baku" }));
  const productsData = dataByKey.products_fallback.map((item) => buildStockReadModelRow(item, { id: item.id, typeLabel: "Produk Jadi" }));
  const semiFinishedData = dataByKey.semi_finished_materials_fallback.map((item) => buildStockReadModelRow(item, { id: item.id, typeLabel: "Semi Finished" }));

  const inventory = [...rawMaterialsData, ...productsData, ...semiFinishedData];

  return {
    inventory,
    failedReads: stockReportReads.filter((item) => item.error).map((item) => item.key),
    dataSource: "sqlite_master_stock_fallback",
    reportMeta: buildStockReportMeta({
      dataSource: "sqlite_master_stock_fallback",
      loadedRows: inventory.length,
      activeRows: inventory.length,
      fallbackReason,
      exportMode: "sqlite_fallback_master_rows",
    }),
  };
};

const readStockReportRows = async ({
  maxResults = STOCK_REPORT_DEFAULT_PAGE_SIZE,
  cursor = null,
  ordered = true,
} = {}) => {
  try {
    const { rows: inventory, meta } = await getStockReadModelRows({
      maxResults,
      includeMeta: true,
      cursor,
      ordered,
    });
    const activeInventory = inventory.filter((item) => item.isActive !== false);

    if (activeInventory.length > 0 || cursor) {
      return {
        inventory: activeInventory,
        failedReads: [],
        dataSource: "stock_item_read_models",
        reportMeta: buildStockReportMeta({
          ...meta,
          dataSource: "stock_item_read_models",
          activeRows: activeInventory.length,
          pageSize: maxResults,
          exportMode: "paged_read_model",
        }),
      };
    }

    const fallbackResult = await readStockReportRowsFromMasterFallback({ fallbackReason: "stock_item_read_models_empty_fallback" });
    return {
      ...fallbackResult,
      failedReads: [...fallbackResult.failedReads, "stock_item_read_models_empty_fallback"],
    };
  } catch (error) {
    console.warn("Gagal memuat stock_item_read_models Stock Report, fallback ke master stock:", error);
    const fallbackResult = await readStockReportRowsFromMasterFallback({ fallbackReason: "stock_item_read_models_fallback" });
    return {
      ...fallbackResult,
      failedReads: [...fallbackResult.failedReads, "stock_item_read_models_fallback"],
    };
  }
};

const readStockReportCategories = async () => {
  try {
    return {
      categories: await listCategories(),
      failedReads: [],
    };
  } catch (error) {
    console.warn("Gagal memuat kategori Stock Report:", error);
    return { categories: [], failedReads: ["categories"] };
  }
};

const resolveStockReportCategory = (item = {}, categories = []) => {
  const sourceType = String(item.sourceType || item.type || "").toLowerCase();
  const categoryType = sourceType.includes("raw")
    ? CATEGORY_TYPES.RAW_MATERIAL_GROUP
    : sourceType.includes("semi")
      ? CATEGORY_TYPES.SEMI_FINISHED_GROUP
      : CATEGORY_TYPES.PRODUCT_FORM;
  const scopedCategories = filterCategoriesByType(categories, categoryType);
  const fallback = sourceType.includes("semi")
    ? item.componentGroup || item.componentGroupName || item.category || item.categoryName
    : item.category || item.categoryName;

  return resolveCategoryLabel({
    categoryId: item.categoryId,
    categories: scopedCategories,
    fallback,
    emptyLabel: "Belum Dikategorikan",
  });
};

const applyStockReportCategoryLabels = (inventory = [], categories = []) => (
  (inventory || []).map((item) => ({
    ...item,
    category: resolveStockReportCategory(item, categories),
  }))
);

// =====================================================
// SECTION: Stock Report data loader — AKTIF / DATA STOK UTAMA + PAGING
// Fungsi:
// - membaca stok dari stock_item_read_models dengan cursor page agar laporan tidak perlu memuat semua row sekaligus;
// - tetap mengambil kategori untuk filter UI dan fallback master ketika data stok turunan belum lengkap.
// Risiko:
// - Paging ordered membutuhkan index sourceType + name. Jika index/rules belum siap, fallback master tetap dijaga.
// =====================================================
export const fetchStockReportData = async ({
  maxResults = STOCK_REPORT_DEFAULT_PAGE_SIZE,
  cursor = null,
  includeCategories = true,
} = {}) => {
  const [stockRowsResult, categoryResult] = await Promise.all([
    readStockReportRows({ maxResults, cursor, ordered: true }),
    includeCategories ? readStockReportCategories() : Promise.resolve({ categories: [], failedReads: [] }),
  ]);

  const inventory = applyStockReportCategoryLabels(
    stockRowsResult.inventory,
    categoryResult.categories,
  );
  const categories = Array.from(new Set(
    inventory.map((item) => item.category || "").filter(Boolean),
  ));

  return {
    inventory,
    categories,
    failedReads: [...stockRowsResult.failedReads, ...categoryResult.failedReads],
    dataSource: stockRowsResult.dataSource,
    reportMeta: stockRowsResult.reportMeta || buildStockReportMeta({
      dataSource: stockRowsResult.dataSource,
      loadedRows: stockRowsResult.inventory.length,
      activeRows: stockRowsResult.inventory.length,
      pageSize: maxResults,
    }),
  };
};

export const fetchFullStockReportExportData = async ({
  pageSize = 1000,
  maxResults = STOCK_REPORT_DEFAULT_EXPORT_LIMIT,
} = {}) => {
  const normalizedPageSize = Math.max(1, Number(pageSize || 1000));
  const normalizedMaxResults = Math.max(normalizedPageSize, Number(maxResults || STOCK_REPORT_DEFAULT_EXPORT_LIMIT));
  let cursor = null;
  let hasMore = true;
  let failedReads = [];
  let inventory = [];
  let lastMeta = null;
  const categoryResult = await readStockReportCategories();

  while (hasMore && inventory.length < normalizedMaxResults) {
    const remainingRows = normalizedMaxResults - inventory.length;
    const currentPageSize = Math.min(normalizedPageSize, remainingRows);
    const result = await readStockReportRows({
      maxResults: currentPageSize,
      cursor,
      ordered: true,
    });

    failedReads = [...failedReads, ...result.failedReads];

    if (result.dataSource !== "stock_item_read_models") {
      const fallbackInventory = applyStockReportCategoryLabels(
        result.inventory,
        categoryResult.categories,
      );
      return {
        ...result,
        inventory: fallbackInventory,
        failedReads: [...result.failedReads, ...categoryResult.failedReads],
        reportMeta: buildStockReportMeta({
          ...result.reportMeta,
          dataSource: result.dataSource,
          loadedRows: fallbackInventory.length,
          activeRows: fallbackInventory.length,
          exportMode: "fallback_master_export",
          exportLimit: normalizedMaxResults,
        }),
      };
    }

    inventory = mergeUniqueStockRows(inventory, result.inventory);
    lastMeta = result.reportMeta;
    cursor = result.reportMeta?.nextCursor || null;
    hasMore = Boolean(result.reportMeta?.hasMore && cursor);

  }

  const exportLimited = Boolean(lastMeta?.hasMore && inventory.length >= normalizedMaxResults);

  const resolvedInventory = applyStockReportCategoryLabels(
    inventory,
    categoryResult.categories,
  );

  return {
    inventory: resolvedInventory,
    failedReads: [...failedReads, ...categoryResult.failedReads],
    dataSource: "stock_item_read_models",
    reportMeta: buildStockReportMeta({
      ...lastMeta,
      dataSource: "stock_item_read_models",
      loadedRows: resolvedInventory.length,
      activeRows: resolvedInventory.length,
      maxResults: normalizedMaxResults,
      pageSize: normalizedPageSize,
      hasMore: exportLimited || Boolean(lastMeta?.hasMore),
      isLimited: exportLimited,
      exportMode: "full_export_paged_read_model",
      exportLimit: normalizedMaxResults,
    }),
  };
};
