// =====================================================
// Production BOM Cost Helpers
// Shared resolver untuk estimasi biaya BOM.
// =====================================================

const toNumber = (value) => {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const safeTrim = (value) => String(value || '').trim();

const firstPositiveNumber = (item = {}, keys = []) => {
  for (const key of keys) {
    const value = toNumber(item?.[key]);
    if (value > 0) {
      return {
        value,
        source: key,
      };
    }
  }

  return {
    value: 0,
    source: '',
  };
};


export const BOM_COST_SOURCE_LABELS = {
  'live_master.averageActualUnitCost': 'Master: modal aktual rata-rata',
  'live_master.restockReferencePrice': 'Master: harga referensi restock',
  'live_master.averageCostPerUnit': 'Master: HPP rata-rata Semi Finished',
  'live_master.lastProductionCostPerUnit': 'Master: HPP produksi terakhir',
  'live_master.zero_cost': 'Master cost 0 / belum tersedia',
};

export const resolveBomCostSourceLabel = (source = '') => (
  BOM_COST_SOURCE_LABELS[source] || source || 'Master cost 0 / belum tersedia'
);

const getBomReferenceListByMaterialType = (referenceData = {}, itemType = '') => {
  if (itemType === 'raw_material') return referenceData.rawMaterials || [];
  if (itemType === 'semi_finished_material') return referenceData.semiFinishedMaterials || [];
  return [];
};

const findBomReferenceMaterialItem = ({ line = {}, referenceData = {} } = {}) => {
  const itemType = safeTrim(line.itemType);
  const itemId = safeTrim(line.itemId);
  if (!itemType || !itemId) return null;

  return getBomReferenceListByMaterialType(referenceData, itemType).find(
    (item) => safeTrim(item?.id) === itemId,
  ) || null;
};

export const resolveBomMaterialUnitCost = ({ itemType = '', item = {} } = {}) => {
  const normalizedType = String(itemType || '').trim();

  if (normalizedType === 'raw_material') {
    // Raw Material memakai modal aktual rata-rata dari purchase.
    // Harga referensi hanya fallback agar BOM trial tetap punya estimasi sebelum pembelian aktual lengkap.
    return firstPositiveNumber(item, [
      'averageActualUnitCost',
      'restockReferencePrice',
    ]);
  }

  if (normalizedType === 'semi_finished_material') {
    // Semi Finished harus membaca HPP hasil produksi level sebelumnya.
    // Jangan fallback ke field reference/manual agar reset HPP dan estimasi BOM tetap jujur.
    return firstPositiveNumber(item, [
      'averageCostPerUnit',
      'lastProductionCostPerUnit',
    ]);
  }

  return {
    value: 0,
    source: '',
  };
};

/*
=====================================================
SECTION: Live BOM material cost hydration — GUARDED
Fungsi:
- Menghitung ulang costPerUnitSnapshot dan totalCostSnapshot material BOM dari master cost terbaru.

Dipakai oleh:
- productionLineBuilders.js, ProductionBoms.jsx, productionBomsService.js, dan resetMaintenanceDataService.js.

Alasan perubahan:
- BOM aktif tidak boleh lagi memakai snapshot lama ketika average cost/HPP master sudah berubah atau direset ke 0.

Catatan cleanup:
- Nama field snapshot masih dipertahankan untuk compatibility data historis; rename schema perlu approval terpisah.

Risiko:
- Jika fallback snapshot lama dikembalikan, estimasi BOM dan Work Log baru bisa memakai modal stale.
=====================================================
*/
export const hydrateBomMaterialLineWithLiveCost = ({
  line = {},
  referenceData = {},
  item = null,
  itemType = '',
} = {}) => {
  const normalizedType = safeTrim(itemType || line.itemType) || 'raw_material';
  const referenceItem = item || findBomReferenceMaterialItem({
    line: { ...line, itemType: normalizedType },
    referenceData,
  }) || {};
  const resolvedUnitCost = resolveBomMaterialUnitCost({
    itemType: normalizedType,
    item: referenceItem,
  });
  const qtyPerBatch = toNumber(line.qtyPerBatch || 0);
  const wastageQty = toNumber(line.wastageQty || 0);
  const totalRequiredQty = qtyPerBatch + wastageQty;
  const costPerUnitSnapshot = toNumber(resolvedUnitCost.value || 0);
  const totalCostSnapshot = totalRequiredQty * costPerUnitSnapshot;
  const costSourceSnapshot = resolvedUnitCost.source
    ? `live_master.${resolvedUnitCost.source}`
    : 'live_master.zero_cost';

  return {
    ...line,
    itemType: normalizedType,
    itemId: line.itemId || referenceItem.id || '',
    itemCode: safeTrim(referenceItem.code) || safeTrim(line.itemCode),
    itemName: safeTrim(referenceItem.name) || safeTrim(line.itemName),
    unit: safeTrim(referenceItem.unit) || safeTrim(line.unit) || 'pcs',
    qtyPerBatch,
    wastageQty,
    totalRequiredQty,
    costPerUnitSnapshot,
    costSourceSnapshot,
    totalCostSnapshot,
  };
};

export const hydrateBomMaterialLinesWithLiveCost = ({ materialLines = [], referenceData = {} } = {}) =>
  (Array.isArray(materialLines) ? materialLines : []).map((line) =>
    hydrateBomMaterialLineWithLiveCost({ line, referenceData }),
  );

export const resolveBomStepPayrollSnapshot = (step = {}) => ({
  payrollMode: step?.payrollMode || 'per_batch',
  payrollRate: toNumber(step?.payrollRate),
  payrollQtyBase: Math.max(1, toNumber(step?.payrollQtyBase || 1)),
  payrollOutputBasis: step?.payrollOutputBasis || 'good_qty',
  payrollClassification: step?.payrollClassification || 'direct_labor',
  includePayrollInHpp: step?.includePayrollInHpp !== false,
  useStepDefaultPayroll: true,
});

export const calculateBomStepLineCost = (line = {}, header = {}) => {
  const snapshot = resolveBomStepPayrollSnapshot(line);

  if (snapshot.includePayrollInHpp === false) return 0;

  const payrollRate = toNumber(snapshot.payrollRate);
  if (payrollRate <= 0) return 0;

  if (snapshot.payrollMode === 'per_qty') {
    const outputQty = Math.max(0, toNumber(header?.batchOutputQty || 0));
    const qtyBase = Math.max(1, toNumber(snapshot.payrollQtyBase || 1));
    return Math.round((payrollRate * outputQty) / qtyBase);
  }

  return payrollRate;
};

export const calculateBomLaborCostEstimate = (stepLines = [], header = {}) =>
  (Array.isArray(stepLines) ? stepLines : []).reduce(
    (sum, item) => sum + calculateBomStepLineCost(item, header),
    0,
  );

export const calculateBomCostSummary = ({ materialLines = [], stepLines = [], header = {} } = {}) => {
  const materialCostEstimate = (Array.isArray(materialLines) ? materialLines : []).reduce(
    (sum, item) => sum + (toNumber(item?.totalRequiredQty || item?.qtyPerBatch || 0) * toNumber(item?.costPerUnitSnapshot || 0)),
    0,
  );
  const laborCostEstimate = calculateBomLaborCostEstimate(stepLines, header);
  const overheadCostEstimate = toNumber(header?.overheadCostEstimate);

  return {
    materialCostEstimate,
    laborCostEstimate,
    overheadCostEstimate,
    totalCostEstimate: materialCostEstimate + laborCostEstimate + overheadCostEstimate,
  };
};
