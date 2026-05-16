// =====================================================
// Production BOM Cost Helpers
// Shared resolver untuk estimasi biaya BOM.
// =====================================================

const toNumber = (value) => {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

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
    (sum, item) => sum + toNumber(item?.totalCostSnapshot),
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
