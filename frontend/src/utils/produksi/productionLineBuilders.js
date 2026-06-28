import { createClientId } from "../ids/createClientId";

import {
  hydrateBomMaterialLineWithLiveCost,
  resolveBomStepPayrollSnapshot,
} from './productionBomCostHelpers';
import {
  calculateMaterialUsageLine,
  calculateOutputLine,
} from '../../constants/productionWorkLogOptions';
import {
  inferHasVariants,
  findVariantByKey,
  buildVariantOptionsFromItem,
} from '../variants/variantStockHelpers';

export const buildBomMaterialFormLine = ({ values, selectedItem, itemType }) => {
  const materialHasVariants = inferHasVariants(selectedItem || {});
  const normalizedStrategy = materialHasVariants ? 'inherit' : 'none';
  /*
  =====================================================
  SECTION: BOM material line builder live cost — GUARDED
  Fungsi:
  - Membentuk material line BOM dari item master dengan biaya aktif terbaru.

  Dipakai oleh:
  - ProductionBoms.jsx saat tambah/edit komposisi bahan.

  Alasan perubahan:
  - Form BOM tidak boleh mempertahankan costPerUnitSnapshot lama ketika master cost sudah 0/berubah.

  Catatan cleanup:
  - Field snapshot tetap dipakai sebagai field existing sampai ada approval rename schema.

  Risiko:
  - Jangan fallback ke values.costPerUnitSnapshot karena itu menghidupkan kembali stale BOM cost.
  =====================================================
  */
  return hydrateBomMaterialLineWithLiveCost({
    itemType,
    item: selectedItem || {},
    line: {
      ...values,
      id: values.id || createClientId("material"),
      itemType,
      itemCode: selectedItem?.code || '',
      itemName: selectedItem?.name || '',
      unit: selectedItem?.unit || values.unit || 'pcs',
      wastageQty: Number(values.wastageQty || 0),
      isOptional: false,
      materialHasVariants,
      materialVariantStrategy: normalizedStrategy,
      fixedVariantKey: '',
      fixedVariantLabel: '',
    },
  });
};

export const buildBomStepFormLine = ({ values, selectedStep }) => ({
  ...values,
  ...resolveBomStepPayrollSnapshot(selectedStep || values || {}),
  id: values.id || createClientId("step"),
  stepCode: selectedStep?.code || '',
  stepName: selectedStep?.name || '',
  processType: selectedStep?.processType || '',
  basisType: selectedStep?.basisType || '',
  monitoringMetric: selectedStep?.monitoringMetric || 'none',
});

// =====================================================
// MANUAL / COMPATIBILITY EDITOR HELPER.
// Flow final PO variant tidak memakai helper ini untuk requirement PO;
// requirement PO sudah resolved di productionOrdersService lalu dikunci di
// productionWorkLogsService. Helper ini tetap untuk input manual/planned.
// =====================================================
export const buildWorkLogMaterialUsageFormLine = ({ values, selectedItem }) => {
  const materialHasVariants = inferHasVariants(selectedItem || {});
  const variantOptions = buildVariantOptionsFromItem(selectedItem || {});
  const selectedVariant = materialHasVariants
    ? findVariantByKey(selectedItem || {}, values.resolvedVariantKey || '')
    : null;
  const normalizedVariantKey = materialHasVariants
    ? selectedVariant?.variantKey || values.resolvedVariantKey || ''
    : '';
  const normalizedVariantLabel = materialHasVariants
    ? selectedVariant?.variantLabel || values.resolvedVariantLabel || ''
    : '';

  return calculateMaterialUsageLine({
    ...values,
    id: values.id || createClientId("usage"),
    itemCode: selectedItem?.code || '',
    itemName: selectedItem?.name || '',
    unit: values.unit || selectedItem?.unit || 'pcs',
    materialHasVariants,
    materialVariantStrategy: materialHasVariants
      ? values.materialVariantStrategy || (variantOptions.length > 0 ? 'fixed' : 'inherit')
      : 'none',
    resolvedVariantKey: normalizedVariantKey,
    resolvedVariantLabel: normalizedVariantLabel,
    stockSourceType: materialHasVariants && normalizedVariantKey ? 'variant' : 'master',
  });
};

// =====================================================
// MANUAL / COMPATIBILITY EDITOR HELPER.
// Flow final PO variant mengunci output dari targetVariantKey PO. Helper ini
// hanya untuk output manual/planned; jika item bervarian tetapi varian kosong,
// complete service akan memblok agar tidak masuk master/default.
// =====================================================
export const buildWorkLogOutputFormLine = ({ values, selectedOutput }) => {
  const outputHasVariants = inferHasVariants(selectedOutput || {});
  const selectedVariant = outputHasVariants
    ? findVariantByKey(selectedOutput || {}, values.outputVariantKey || '')
    : null;
  const normalizedVariantKey = outputHasVariants
    ? selectedVariant?.variantKey || values.outputVariantKey || ''
    : '';
  const normalizedVariantLabel = outputHasVariants
    ? selectedVariant?.variantLabel || values.outputVariantLabel || ''
    : '';

  return calculateOutputLine({
    ...values,
    id: values.id || createClientId("output"),
    outputCode: selectedOutput?.code || '',
    outputName: selectedOutput?.name || '',
    unit: values.unit || selectedOutput?.unit || 'pcs',
    outputHasVariants,
    outputVariantKey: normalizedVariantKey,
    outputVariantLabel: normalizedVariantLabel,
    stockSourceType: outputHasVariants && normalizedVariantKey ? 'variant' : 'master',
  });
};
