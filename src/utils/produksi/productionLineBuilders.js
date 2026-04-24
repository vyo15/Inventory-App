import { calculateBomMaterialLine } from '../../constants/productionBomOptions';
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

  return calculateBomMaterialLine({
    ...values,
    id: values.id || `material-${Date.now()}`,
    itemType,
    itemCode: selectedItem?.code || '',
    itemName: selectedItem?.name || '',
    unit: selectedItem?.unit || values.unit || 'pcs',
    costPerUnitSnapshot: Number(
      selectedItem?.averageCostPerUnit ||
        selectedItem?.referenceCostPerUnit ||
        selectedItem?.costPerUnit ||
        values.costPerUnitSnapshot ||
        0,
    ),
    wastageQty: Number(values.wastageQty || 0),
    isOptional: false,
    materialHasVariants,
    materialVariantStrategy: normalizedStrategy,
    fixedVariantKey: '',
    fixedVariantLabel: '',
  });
};

export const buildBomStepFormLine = ({ values, selectedStep }) => ({
  ...values,
  id: values.id || `step-${Date.now()}`,
  stepCode: selectedStep?.code || '',
  stepName: selectedStep?.name || '',
});

// =====================================================
// MANUAL / LEGACY EDITOR HELPER.
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
    id: values.id || `usage-${Date.now()}`,
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
// MANUAL / LEGACY EDITOR HELPER.
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
    id: values.id || `output-${Date.now()}`,
    outputCode: selectedOutput?.code || '',
    outputName: selectedOutput?.name || '',
    unit: values.unit || selectedOutput?.unit || 'pcs',
    outputHasVariants,
    outputVariantKey: normalizedVariantKey,
    outputVariantLabel: normalizedVariantLabel,
    stockSourceType: outputHasVariants && normalizedVariantKey ? 'variant' : 'master',
  });
};
