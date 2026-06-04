import * as sqliteProductsAdapter from "../../data/adapters/sqlite/sqliteProductsAdapter";
import * as sqliteRawMaterialsAdapter from "../../data/adapters/sqlite/sqliteRawMaterialsAdapter";
import * as sqliteSemiFinishedMaterialsAdapter from "../../data/adapters/sqlite/sqliteSemiFinishedMaterialsAdapter";
import { buildStockReadModelRow } from "../../utils/stock/stockHelpers";
import { getStockReadModelRows } from "../Inventory/stockReadModelService";

const STOCK_REPORT_DEFAULT_PAGE_SIZE = 500;
const STOCK_REPORT_DEFAULT_EXPORT_LIMIT = 20000;

// =====================================================
// SECTION: Stock Report read service — AKTIF / READ-ONLY
// Fungsi:
// - memakai collection turunan stock_item_read_models sebagai read path utama Stock Report;
// - mendukung paging cursor dan full-export loop agar laporan tidak hanya bergantung pada rows UI yang termuat;
// - fallback ke source master hanya jika read model kosong/gagal agar data lama tidak blank sebelum rebuild maintenance.
// Hubungan flow:
// - read-only; tidak menulis stok, inventory log, transaksi, produksi, atau schema.
// Risiko:
// - stock_item_read_models tetap derived. Mutasi stok wajib tetap terjadi di master stock dan inventory_logs.
// =====================================================
const mapInventorySnapshotToReportRows = (snapshot, typeLabel) =>
  snapshot.docs.map((documentItem) => buildStockReadModelRow(documentItem.data(), {
    id: documentItem.id,
    typeLabel,
  }));

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

const readStockReportCategories = async () => ({
  categories: [],
  failedReads: [],
});

// =====================================================
// SECTION: Stock Report data loader — AKTIF / READ MODEL PRIMARY + PAGING
// Fungsi:
// - membaca stok dari stock_item_read_models dengan cursor page agar laporan tidak perlu memuat semua row sekaligus;
// - tetap mengambil categories untuk filter UI dan fallback master ketika read model belum dibackfill.
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

  const categories = Array.from(new Set([
    ...categoryResult.categories,
    ...stockRowsResult.inventory
      .map((item) => item.category || item.categoryName || "")
      .filter(Boolean),
  ]));

  return {
    inventory: stockRowsResult.inventory,
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
      return {
        ...result,
        reportMeta: buildStockReportMeta({
          ...result.reportMeta,
          dataSource: result.dataSource,
          loadedRows: result.inventory.length,
          activeRows: result.inventory.length,
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

  return {
    inventory,
    failedReads,
    dataSource: "stock_item_read_models",
    reportMeta: buildStockReportMeta({
      ...lastMeta,
      dataSource: "stock_item_read_models",
      loadedRows: inventory.length,
      activeRows: inventory.length,
      maxResults: normalizedMaxResults,
      pageSize: normalizedPageSize,
      hasMore: exportLimited || Boolean(lastMeta?.hasMore),
      isLimited: exportLimited,
      exportMode: "full_export_paged_read_model",
      exportLimit: normalizedMaxResults,
    }),
  };
};
