const sourceRegistry = require("./stockSourceRegistry");
const variantDomain = require("./stockVariantDomain");
const persistence = require("./stockPersistence");
const { createInventoryMasterRouteGuards } = require("./inventoryMasterGuards");
const mutationEngine = require("./stockMutationEngine");

module.exports = {
  applyStockDeltaToPayload: mutationEngine.applyStockDeltaToPayload,
  commitStockMutation: mutationEngine.commitStockMutation,
  createInventoryMasterRouteGuards,
  insertEventRecord: persistence.insertEventRecord,
  loadSourceItem: persistence.loadSourceItem,
  normalizeInventoryMasterCreate: variantDomain.normalizeInventoryMasterCreate,
  sanitizeInventoryMasterUpdate: variantDomain.sanitizeInventoryMasterUpdate,
  upsertJsonRecord: persistence.upsertJsonRecord,
  upsertStockReadModel: persistence.upsertStockReadModel,
  toInteger: sourceRegistry.toInteger,
  nowIso: sourceRegistry.nowIso,
  getTableForSourceType: sourceRegistry.getTableForSourceType,
  matchesVariantReference: sourceRegistry.matchesVariantReference,
  resolveInventoryVariantCollection: sourceRegistry.resolveInventoryVariantCollection,
};
