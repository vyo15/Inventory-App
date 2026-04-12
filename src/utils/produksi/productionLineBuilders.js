import { calculateBomMaterialLine } from '../../constants/productionBomOptions';
import {
  calculateMaterialUsageLine,
  calculateOutputLine,
} from '../../constants/productionWorkLogOptions';

export const buildBomMaterialFormLine = ({ values, selectedItem, itemType }) =>
  calculateBomMaterialLine({
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
    wastageQty: 0,
    isOptional: false,
  });

export const buildBomStepFormLine = ({ values, selectedStep }) => ({
  ...values,
  id: values.id || `step-${Date.now()}`,
  stepCode: selectedStep?.code || '',
  stepName: selectedStep?.name || '',
});

export const buildWorkLogMaterialUsageFormLine = ({ values, selectedItem }) =>
  calculateMaterialUsageLine({
    ...values,
    id: values.id || `usage-${Date.now()}`,
    itemCode: selectedItem?.code || '',
    itemName: selectedItem?.name || '',
    unit: values.unit || selectedItem?.unit || 'pcs',
  });

export const buildWorkLogOutputFormLine = ({ values, selectedOutput }) =>
  calculateOutputLine({
    ...values,
    id: values.id || `output-${Date.now()}`,
    outputCode: selectedOutput?.code || '',
    outputName: selectedOutput?.name || '',
    unit: values.unit || selectedOutput?.unit || 'pcs',
  });
