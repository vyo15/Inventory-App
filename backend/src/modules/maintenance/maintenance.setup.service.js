const { getDb } = require("../../db/connection");

const getInitialSetupReadiness = async () => {
  const db = await getDb();

  const categoryRows = await db.all(
    `
      SELECT type, COUNT(*) AS total
      FROM categories
      WHERE status = 'active'
      GROUP BY type
    `
  );
  const categoriesByType = categoryRows.reduce((result, row) => ({
    ...result,
    [String(row.type || "")]: Number(row.total || 0),
  }), {});

  const countActiveJsonRows = async (tableName) => {
    const row = await db.get(
      `SELECT COUNT(*) AS total FROM ${tableName} WHERE status != 'deleted' AND COALESCE(is_active, 1) = 1`
    );
    return Number(row?.total || 0);
  };

  const products = await countActiveJsonRows("products");
  const rawMaterials = await countActiveJsonRows("raw_materials");
  const semiFinished = await countActiveJsonRows("semi_finished_materials");
  const productionSteps = await countActiveJsonRows("production_steps");
  const productionEmployees = await countActiveJsonRows("production_employees");
  const productionBoms = await countActiveJsonRows("production_boms");

  const supplierRow = await db.get(
    "SELECT COUNT(*) AS total FROM suppliers WHERE status = 'active'"
  );
  const supplierOfferRow = await db.get(
    `
      SELECT COUNT(*) AS total
      FROM supplier_catalog_offers
      WHERE status = 'active' AND availability_status != 'unavailable'
    `
  );
  const positiveStockRow = await db.get(
    `
      SELECT SUM(total) AS total
      FROM (
        SELECT COUNT(*) AS total FROM products
          WHERE status != 'deleted' AND COALESCE(is_active, 1) = 1 AND current_stock > 0
        UNION ALL
        SELECT COUNT(*) AS total FROM raw_materials
          WHERE status != 'deleted' AND COALESCE(is_active, 1) = 1 AND current_stock > 0
        UNION ALL
        SELECT COUNT(*) AS total FROM semi_finished_materials
          WHERE status != 'deleted' AND COALESCE(is_active, 1) = 1 AND current_stock > 0
      )
    `
  );
  const inventoryLogRow = await db.get(
    "SELECT COUNT(*) AS total FROM inventory_logs WHERE status != 'deleted'"
  );
  const positiveStockWithoutHistoryRow = await db.get(
    `
      SELECT COUNT(*) AS total
      FROM (
        SELECT 'product' AS source_type, id FROM products
          WHERE status != 'deleted' AND COALESCE(is_active, 1) = 1 AND current_stock > 0
        UNION ALL
        SELECT 'raw_material' AS source_type, id FROM raw_materials
          WHERE status != 'deleted' AND COALESCE(is_active, 1) = 1 AND current_stock > 0
        UNION ALL
        SELECT 'semi_finished' AS source_type, id FROM semi_finished_materials
          WHERE status != 'deleted' AND COALESCE(is_active, 1) = 1 AND current_stock > 0
      ) AS stock_items
      WHERE NOT EXISTS (
        SELECT 1
        FROM inventory_logs
        WHERE inventory_logs.status != 'deleted'
          AND inventory_logs.source_type = stock_items.source_type
          AND inventory_logs.source_id = stock_items.id
      )
    `
  );
  const latestSetupRow = await db.get(
    `
      SELECT MAX(updated_at) AS latest_updated_at
      FROM (
        SELECT MAX(updated_at) AS updated_at FROM categories WHERE status != 'deleted'
        UNION ALL SELECT MAX(updated_at) FROM suppliers WHERE status != 'deleted'
        UNION ALL SELECT MAX(updated_at) FROM supplier_catalog_offers WHERE status != 'deleted'
        UNION ALL SELECT MAX(updated_at) FROM products WHERE status != 'deleted'
        UNION ALL SELECT MAX(updated_at) FROM raw_materials WHERE status != 'deleted'
        UNION ALL SELECT MAX(updated_at) FROM semi_finished_materials WHERE status != 'deleted'
        UNION ALL SELECT MAX(updated_at) FROM production_steps WHERE status != 'deleted'
        UNION ALL SELECT MAX(updated_at) FROM production_employees WHERE status != 'deleted'
        UNION ALL SELECT MAX(updated_at) FROM production_boms WHERE status != 'deleted'
      )
    `
  );
  const latestBackupRow = await db.get(
    `
      SELECT id, filename, status, created_at
      FROM backup_logs
      WHERE status IN ('verified', 'success')
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `
  );

  const suppliers = Number(supplierRow?.total || 0);
  const supplierOffers = Number(supplierOfferRow?.total || 0);
  const positiveStockItems = Number(positiveStockRow?.total || 0);
  const inventoryLogs = Number(inventoryLogRow?.total || 0);
  const positiveStockWithoutHistoryItems = Number(positiveStockWithoutHistoryRow?.total || 0);
  const masterItems = products + rawMaterials + semiFinished;
  const categoriesReady = Number(categoriesByType.product_form || 0) > 0
    && Number(categoriesByType.flower_type || 0) > 0
    && Number(categoriesByType.raw_material_group || 0) > 0;
  const masterItemsReady = products > 0 && rawMaterials > 0;
  const supplierCatalogReady = suppliers > 0 && supplierOffers > 0;
  const productionStepsReady = productionSteps > 0;
  const productionEmployeesReady = productionEmployees > 0;
  const productionBomsReady = productionBoms > 0;
  const openingStockReady = masterItems > 0
    && positiveStockWithoutHistoryItems === 0;
  const prerequisitesReady = [
    categoriesReady,
    masterItemsReady,
    supplierCatalogReady,
    productionStepsReady,
    productionEmployeesReady,
    productionBomsReady,
    openingStockReady,
  ].every(Boolean);
  const latestSetupUpdatedAt = latestSetupRow?.latest_updated_at || null;
  const latestVerifiedBackupAt = latestBackupRow?.created_at || null;
  const baselineBackupReady = Boolean(
    prerequisitesReady
      && latestVerifiedBackupAt
      && (!latestSetupUpdatedAt || latestVerifiedBackupAt >= latestSetupUpdatedAt)
  );
  const flags = {
    categoriesReady,
    masterItemsReady,
    supplierCatalogReady,
    productionStepsReady,
    productionEmployeesReady,
    productionBomsReady,
    openingStockReady,
    baselineBackupReady,
  };
  const completedRequiredSteps = Object.values(flags).filter(Boolean).length;
  const requiredStepCount = Object.keys(flags).length;

  return {
    generatedAt: new Date().toISOString(),
    isComplete: completedRequiredSteps === requiredStepCount,
    progress: {
      completedRequiredSteps,
      requiredStepCount,
      percent: Math.round((completedRequiredSteps / requiredStepCount) * 100),
    },
    flags,
    counts: {
      categoriesByType,
      products,
      rawMaterials,
      semiFinished,
      suppliers,
      supplierOffers,
      productionSteps,
      productionEmployees,
      productionBoms,
      positiveStockItems,
      inventoryLogs,
      positiveStockWithoutHistoryItems,
    },
    diagnostics: {
      positiveStockWithoutHistory: positiveStockWithoutHistoryItems > 0,
      positiveStockWithoutHistoryItems,
      latestSetupUpdatedAt,
      latestVerifiedBackupAt,
      latestVerifiedBackup: latestBackupRow || null,
    },
  };
};



module.exports = { getInitialSetupReadiness };
