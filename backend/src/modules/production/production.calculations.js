const normalizeText = (value = "") => String(value ?? "").trim();
const normalizeLower = (value = "") => normalizeText(value).toLowerCase();

const toNumber = (value = 0) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toPositiveNumber = (value = 0) => Math.max(0, toNumber(value));
const toPositiveInteger = (value = 0) => Math.max(0, Math.round(toNumber(value)));

const normalizeSourceType = (value = "") => {
  const normalized = normalizeLower(value);
  if (["raw_material", "raw_materials", "material", "raw"].includes(normalized)) return "raw_material";
  if (["semi_finished", "semi_finished_material", "semi_finished_materials"].includes(normalized)) return "semi_finished";
  if (["product", "products"].includes(normalized)) return "product";
  return normalized || "raw_material";
};

const calculateRequirementLines = (bom = {}, targetQty = 0) => {
  const lines = Array.isArray(bom.materialLines)
    ? bom.materialLines
    : Array.isArray(bom.materials)
      ? bom.materials
      : [];
  const quantity = toPositiveNumber(targetQty);

  return lines.map((line, index) => {
    const qtyPerUnit = toPositiveNumber(
      line.qtyPerUnit ?? line.quantityPerUnit ?? line.qtyPerBatch ?? line.qty ?? 0,
    );
    const requiredQty = toPositiveNumber(
      line.requiredQty ?? line.qtyRequired ?? line.totalRequiredQty ?? (qtyPerUnit * quantity),
    );
    return {
      ...line,
      id: line.id || `req-${index + 1}`,
      itemType: normalizeSourceType(line.itemType || line.sourceType || "raw_material"),
      itemId: line.itemId || line.sourceId || "",
      itemCode: line.itemCode || line.code || "",
      itemName: line.itemName || line.name || "",
      requiredQty,
      qtyRequired: requiredQty,
      totalRequiredQty: requiredQty,
      status: line.status || "ready_check_required",
    };
  });
};

const calculatePayrollLineAmounts = ({ workLog, rule } = {}) => {
  const goodQty = toPositiveNumber(workLog.goodQty);
  const actualOutputQty = toPositiveNumber(workLog.actualOutputQty || goodQty);
  const outputQtyUsed = rule.payrollOutputBasis === "actual_output_qty" ? actualOutputQty : goodQty;
  const workedQty = rule.payrollMode === "per_batch" ? toPositiveNumber(workLog.plannedQty) : outputQtyUsed;
  const payableQtyFactor = rule.payrollMode === "per_batch"
    ? workedQty
    : (rule.payrollQtyBase > 0 ? outputQtyUsed / rule.payrollQtyBase : 0);
  const amountCalculated = Math.max(0, payableQtyFactor * rule.payrollRate);

  return {
    outputQtyUsed,
    workedQty,
    payableQtyFactor,
    amountCalculated,
    finalAmount: Math.round(amountCalculated),
  };
};

const reconcileAverageUnitCost = ({
  currentStock = 0,
  currentUnitCost = 0,
  affectedQty = 0,
  previousUnitCost = 0,
  nextUnitCost = 0,
} = {}) => {
  const stock = toPositiveNumber(currentStock);
  const currentCost = toPositiveNumber(currentUnitCost);
  const qty = toPositiveNumber(affectedQty);
  const previousCost = toPositiveNumber(previousUnitCost);
  const nextCost = toPositiveNumber(nextUnitCost);
  if (nextCost <= 0) return currentCost;
  if (stock <= 0 || stock <= qty || currentCost <= 0) return nextCost;
  return Math.max(0, currentCost + ((qty * (nextCost - previousCost)) / stock));
};

const calculateWeightedVariantCost = (variants = [], field) => {
  const active = (Array.isArray(variants) ? variants : [])
    .filter((variant) => variant?.isArchived !== true && variant?.isActive !== false);
  const weighted = active.reduce((accumulator, variant) => {
    const stock = toPositiveNumber(variant.currentStock ?? variant.stock ?? 0);
    const cost = toPositiveNumber(variant[field]);
    if (stock > 0 && cost > 0) {
      accumulator.qty += stock;
      accumulator.total += stock * cost;
    }
    return accumulator;
  }, { qty: 0, total: 0 });

  return weighted.qty > 0 ? weighted.total / weighted.qty : 0;
};

const getMaterialCostTotal = (workLog = {}) => (
  Array.isArray(workLog.materialUsages) ? workLog.materialUsages : []
).reduce((sum, line) => sum + toPositiveNumber(
  line.totalCostSnapshot || (toPositiveNumber(line.actualQty) * toPositiveNumber(line.costPerUnitSnapshot)),
), 0);

const getEffectiveLaborCost = (payrolls = []) => payrolls.reduce((sum, payroll) => {
  if (payroll.includePayrollInHpp === false) return sum;
  const isFinal = ["confirmed", "paid"].includes(normalizeLower(payroll.status))
    || normalizeLower(payroll.paymentStatus) === "paid";
  const amount = isFinal
    ? toPositiveNumber(payroll.finalAmount)
    : toPositiveNumber(payroll.amountCalculated ?? payroll.finalAmount);
  return sum + amount;
}, 0);

module.exports = {
  calculatePayrollLineAmounts,
  calculateRequirementLines,
  calculateWeightedVariantCost,
  getEffectiveLaborCost,
  getMaterialCostTotal,
  normalizeSourceType,
  reconcileAverageUnitCost,
  toNumber,
  toPositiveInteger,
  toPositiveNumber,
};
