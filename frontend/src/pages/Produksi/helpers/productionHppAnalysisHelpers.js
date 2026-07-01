const TARGET_TYPE_LABEL_MAP = {
  product: "Produk Jadi",
  semi_finished_material: "Semi Finished",
};

export const resolveTargetTypeLabel = (targetType) =>
  TARGET_TYPE_LABEL_MAP[targetType] || targetType || "-";

export const toSafeNumber = (value, fallback = 0) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
};

export const getHppCostStatusTagColor = (statusLabel) => {
  if (statusLabel === "Final") return "green";
  if (statusLabel === "Draft Payroll") return "blue";
  if (String(statusLabel || "").startsWith("Estimasi")) return "gold";
  if (statusLabel === "Tidak masuk HPP") return "orange";
  return "red";
};

export const getHppReconcileStatusLabel = (status = "") => {
  if (status === "reconciled") return "Output HPP tersinkron";
  if (status === "already_synced") return "Output HPP sudah sesuai";
  return "Perlu Reconcile HPP";
};

export const getHppReconcileStatusColor = (status = "") => {
  if (status === "reconciled" || status === "already_synced") return "green";
  return "warning";
};

export const getDerivedHppReconcileStatus = ({
  workLog = {},
  finalHppPerUnit = 0,
  isHppFinalReady = false,
} = {}) => {
  if (!isHppFinalReady) return "pending";

  const outputLines = Array.isArray(workLog.outputs) ? workLog.outputs : [];
  const postedOutputLines = outputLines.filter((line) => (
    line?.stockAdded === true && toSafeNumber(line.goodQty) > 0
  ));

  if (postedOutputLines.length === 0) return "pending";

  const isSynced = postedOutputLines.every((line) => (
    Math.abs(toSafeNumber(line.costPerUnit) - toSafeNumber(finalHppPerUnit)) <= 1
  ));

  return isSynced ? "already_synced" : "pending";
};

export const buildHppCostWarnings = ({
  materialCost,
  displayLaborCost,
  finalLaborCost,
  finalTotalCost,
  previewTotalCost,
  finalHppPerUnit,
  goodQty,
  productionCost,
  isHppFinalReady,
}) => {
  const warnings = [];

  if (toSafeNumber(materialCost) === 0) {
    warnings.push("Biaya material 0. Cek cost bahan atau snapshot material.");
  }

  if (!isHppFinalReady && toSafeNumber(displayLaborCost) <= 0 && productionCost?.source !== "step_excluded_from_hpp") {
    warnings.push("Biaya produksi belum terbaca. Cek operator, rate step produksi, atau payroll Work Log.");
  }

  if (isHppFinalReady && productionCost?.source !== "step_excluded_from_hpp" && toSafeNumber(finalLaborCost) <= 0) {
    warnings.push("Biaya produksi final 0. Cek payroll final Work Log.");
  }

  if (productionCost?.needsReview) {
    warnings.push(...productionCost.reviewReasons);
  }

  if (toSafeNumber(goodQty) <= 0) {
    warnings.push("Good qty 0. HPP/unit belum valid.");
  }

  if (isHppFinalReady && toSafeNumber(finalTotalCost) === 0) {
    warnings.push("Total biaya final 0. HPP belum valid untuk analisis final.");
  }

  if (!isHppFinalReady && toSafeNumber(previewTotalCost) === 0) {
    warnings.push("Total biaya preview 0. Cek material, overhead, dan payroll/step.");
  }

  if (isHppFinalReady && toSafeNumber(finalHppPerUnit) === 0 && toSafeNumber(goodQty) > 0) {
    warnings.push("HPP final per good unit 0 walaupun good qty ada. Cek sumber biaya Work Log.");
  }

  return [...new Set(warnings)];
};
