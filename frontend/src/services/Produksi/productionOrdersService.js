import { normalizeTruthyText as safeTrim } from "../../utils/text/textNormalization";
import { getCurrentIsoTimestamp, getProductionActorName } from "./helpers/productionAuditMetadata";
import {
  commitProductionOrder,
  commitProductionOrderRequirementRefresh,
  generateProductionCode,
  getProductionRecordById,
  listProductionRecords,
  updateProductionRecord,
} from "../../data/adapters/sqlite/sqliteProductionAdapter";
import { getActiveProductionBoms, getProductionBomById } from "./productionBomsService";
import { getActiveSemiFinishedMaterials } from "./semiFinishedMaterialsService";
import { listenProducts } from "../MasterData/productsService";
import { listenRawMaterials } from "../MasterData/rawMaterialsService";


const onceFromListener = (listener) => new Promise((resolve, reject) => {
  let unsubscribe = null;
  unsubscribe = listener((rows) => {
    if (unsubscribe) unsubscribe();
    resolve(rows || []);
  }, reject);
});

export const getActiveProductionBomOptions = async (targetType = "product") => {
  const boms = await getActiveProductionBoms();
  return boms.filter((bom) => !targetType || bom.targetType === targetType);
};

export const getAllProductionOrders = async () => listProductionRecords("orders");
export const getProductionOrderById = async (id) => getProductionRecordById("orders", id);
export const getProductionBomByIdForOrder = (bomId) => getProductionBomById(bomId);
export const generateProductionOrderCode = async () => generateProductionCode("orders");

const normalizeSourceType = (value = "") => {
  const normalized = safeTrim(value).toLowerCase();
  if (["raw_material", "raw_materials", "material", "raw"].includes(normalized)) return "raw_material";
  if (["semi_finished", "semi_finished_material", "semi_finished_materials"].includes(normalized)) return "semi_finished";
  return "product";
};

const getInventorySnapshot = (item = {}, variantKey = "") => {
  const variants = Array.isArray(item.variants)
    ? item.variants
    : Array.isArray(item.productVariants)
      ? item.productVariants
      : Array.isArray(item.materialVariants)
        ? item.materialVariants
        : [];
  const variant = variantKey
    ? variants.find((entry) => String(entry.variantKey || entry.key || entry.id) === String(variantKey))
    : null;
  const source = variant || item;
  const currentStock = Number(source.currentStock ?? source.stock ?? 0);
  const reservedStock = Number(source.reservedStock ?? 0);
  const availableStock = Number(source.availableStock ?? Math.max(currentStock - reservedStock, 0));
  return { currentStock, reservedStock, availableStock, variant: variant || null };
};

export const buildProductionOrderRequirementLines = async ({
  bom = null,
  bomId = "",
  targetQty = 0,
  orderQty = 0,
  targetVariantKey = "",
  targetVariantLabel = "",
} = {}) => {
  const resolvedBom = bom || (bomId ? await getProductionBomById(bomId).catch(() => null) : null);
  if (!resolvedBom) {
    return {
      bom: null,
      requirementLines: [],
      reservationSummary: { totalLines: 0, sufficientLines: 0, shortageLines: 0, canReserveFully: false },
      targetStockPreview: null,
      targetHasVariants: false,
    };
  }

  const quantity = Number(orderQty || targetQty || 0);
  const lines = Array.isArray(resolvedBom.materialLines)
    ? resolvedBom.materialLines
    : Array.isArray(resolvedBom.materials)
      ? resolvedBom.materials
      : [];
  const references = await getProductionOrderReferenceData();
  const sourceRows = {
    product: references.products || [],
    raw_material: references.rawMaterials || [],
    semi_finished: references.semiFinishedMaterials || [],
  };

  const requirementLines = lines.map((line, index) => {
    const sourceType = normalizeSourceType(line.itemType || line.sourceType || "raw_material");
    const sourceId = line.itemId || line.sourceId || "";
    const requiredQty = Number(
      line.requiredQty
        ?? line.qtyRequired
        ?? line.totalRequiredQty
        ?? (Number(line.qtyPerUnit ?? line.quantityPerUnit ?? line.qtyPerBatch ?? line.qty ?? 0) * quantity),
    );
    const sourceItem = (sourceRows[sourceType] || []).find((item) => String(item.id) === String(sourceId)) || null;
    const snapshot = getInventorySnapshot(sourceItem || {}, line.variantKey || "");
    const shortageQty = Math.max(requiredQty - snapshot.availableStock, 0);
    return {
      ...line,
      id: line.id || `req-${index + 1}`,
      itemType: sourceType,
      sourceType,
      itemId: sourceId,
      sourceId,
      itemName: line.itemName || line.name || sourceItem?.name || sourceId,
      requiredQty,
      qtyRequired: requiredQty,
      totalRequiredQty: requiredQty,
      currentStockSnapshot: snapshot.currentStock,
      reservedStockSnapshot: snapshot.reservedStock,
      availableStockSnapshot: snapshot.availableStock,
      shortageQty,
      status: shortageQty > 0 ? "shortage" : "sufficient",
    };
  });

  const targetType = normalizeSourceType(resolvedBom.targetType || "product");
  const targetRows = sourceRows[targetType] || [];
  const targetItem = targetRows.find((item) => String(item.id) === String(resolvedBom.targetId || "")) || null;
  const targetSnapshot = targetItem ? getInventorySnapshot(targetItem, targetVariantKey) : null;
  const targetVariants = Array.isArray(targetItem?.variants)
    ? targetItem.variants
    : Array.isArray(targetItem?.productVariants)
      ? targetItem.productVariants
      : Array.isArray(targetItem?.materialVariants)
        ? targetItem.materialVariants
        : [];
  const sufficientLines = requirementLines.filter((line) => line.shortageQty <= 0).length;
  const shortageLines = requirementLines.length - sufficientLines;

  return {
    bom: resolvedBom,
    requirementLines,
    reservationSummary: {
      totalLines: requirementLines.length,
      sufficientLines,
      shortageLines,
      canReserveFully: requirementLines.length > 0 && shortageLines === 0,
    },
    targetStockPreview: targetItem ? {
      targetId: targetItem.id,
      targetName: targetItem.name || resolvedBom.targetName || "Target produksi",
      targetVariantKey: targetVariantKey || "",
      targetVariantLabel: targetVariantLabel || targetSnapshot?.variant?.variantLabel || "",
      currentStock: targetSnapshot?.currentStock || 0,
      reservedStock: targetSnapshot?.reservedStock || 0,
      availableStock: targetSnapshot?.availableStock || 0,
      targetHasVariants: targetVariants.length > 0,
    } : null,
    targetHasVariants: targetVariants.length > 0,
  };
};

const normalizePayload = (values = {}, currentUser = null, isEdit = false) => {
  const code = safeTrim(values.code || values.orderCode || values.referenceNumber).toUpperCase();
  const actorName = getProductionActorName(currentUser);

  return {
    ...values,
    code,
    orderCode: code,
    referenceNumber: code,
    name: values.name || values.description || code,
    status: values.status || "draft",
    orderDate: values.orderDate || values.date || getCurrentIsoTimestamp(),
    transactionDate: values.orderDate || values.date || getCurrentIsoTimestamp(),
    targetQty: Number(values.targetQty || values.quantity || 0),
    requirementLines: Array.isArray(values.requirementLines) ? values.requirementLines : [],
    updatedAt: getCurrentIsoTimestamp(),
    updatedBy: actorName,
    ...(!isEdit ? { createdAt: getCurrentIsoTimestamp(), createdBy: actorName } : {}),
  };
};

export const createProductionOrder = async (values = {}, currentUser = null) => {
  let payload = normalizePayload(values, currentUser, false);

  if (!payload.requirementLines.length && payload.bomId) {
    const bom = await getProductionBomById(payload.bomId).catch(() => null);
    if (bom) {
      payload = {
        ...payload,
        requirementLines: (await buildProductionOrderRequirementLines({
          bom,
          targetQty: payload.targetQty || payload.orderQty,
          targetVariantKey: payload.targetVariantKey || "",
          targetVariantLabel: payload.targetVariantLabel || "",
        })).requirementLines,
      };
    }
  }

  return commitProductionOrder(payload);
};

export const refreshProductionOrderRequirements = async (orderId) =>
  commitProductionOrderRequirementRefresh(orderId);

export const reserveProductionOrder = async (orderId, currentUser = null) => updateProductionRecord(
  "orders",
  orderId,
  {
    ...(await getProductionOrderById(orderId)),
    status: "reserved",
    reservedAt: getCurrentIsoTimestamp(),
    updatedBy: getProductionActorName(currentUser),
  }
);

export const releaseProductionOrderReservation = async (orderId, currentUser = null) => updateProductionRecord(
  "orders",
  orderId,
  {
    ...(await getProductionOrderById(orderId)),
    status: "draft",
    reservationReleasedAt: getCurrentIsoTimestamp(),
    updatedBy: getProductionActorName(currentUser),
  }
);

export const markProductionOrderInProduction = async (orderId, currentUser = null) => updateProductionRecord(
  "orders",
  orderId,
  {
    ...(await getProductionOrderById(orderId)),
    status: "in_production",
    startedAt: getCurrentIsoTimestamp(),
    updatedBy: getProductionActorName(currentUser),
  }
);

export const getProductionOrderTargetVariantOptions = async () => [];

export const getProductionOrderRequirementPreview = async ({
  bomId = "",
  targetQty = 0,
  targetVariantKey = "",
  targetVariantLabel = "",
} = {}) => buildProductionOrderRequirementLines({
  bomId,
  targetQty,
  targetVariantKey,
  targetVariantLabel,
});

export const getProductionOrderReferenceData = async () => ({
  boms: await getActiveProductionBoms().catch(() => []),
  products: await onceFromListener(listenProducts).catch(() => []),
  rawMaterials: await onceFromListener(listenRawMaterials).catch(() => []),
  semiFinishedMaterials: await getActiveSemiFinishedMaterials().catch(() => []),
});
