import { calculateBomTotals } from "../../../constants/productionBomOptions";
import { hydrateBomMaterialLinesWithLiveCost } from "../../../utils/produksi/productionBomCostHelpers";

// IMS NOTE [AKTIF/BATCH 19/GUARDED] — helper UI/read-only halaman ProductionBoms.
// Fungsi blok: memusatkan style compact dan hydrator live cost yang hanya membaca reference data.
// Hubungan flow: tidak menulis BOM, stok, HPP, payroll, purchase, atau data stok turunan.
// Alasan logic: halaman ProductionBoms tetap besar, sehingga helper pure dipisah tanpa memindahkan submit/validasi service.
export const compactTagStyle = {
  display: "inline-flex",
  whiteSpace: "normal",
  lineHeight: 1.25,
  paddingTop: 4,
  paddingBottom: 4,
  maxWidth: 180,
};

export const clampTwoLineStyle = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  lineHeight: "var(--ims-line-height-body)",
};

export const EMPTY_REFERENCE_DATA = {
  products: [],
  rawMaterials: [],
  semiFinishedMaterials: [],
  productionSteps: [],
};

// IMS NOTE [AKTIF/GUARDED]: Refresh live BOM cost snapshot untuk list/detail/edit tanpa menulis balik ke database.
export const hydrateBomRecordWithLiveCosts = (record = {}, refs = EMPTY_REFERENCE_DATA) => {
  const materialLines = hydrateBomMaterialLinesWithLiveCost({
    materialLines: record.materialLines || [],
    referenceData: refs || EMPTY_REFERENCE_DATA,
  });
  const stepLines = Array.isArray(record.stepLines) ? record.stepLines : [];
  const totals = calculateBomTotals(materialLines, stepLines, record);

  return {
    ...record,
    materialLines,
    stepLines,
    materialCostEstimate: totals.materialCostEstimate,
    laborCostEstimate: totals.laborCostEstimate,
    overheadCostEstimate: totals.overheadCostEstimate,
    totalCostEstimate: totals.totalCostEstimate,
  };
};
