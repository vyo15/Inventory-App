import { buildReferenceOptions } from "../options/referenceOptionBuilders";

export const toReferenceOptions = (items = []) => buildReferenceOptions(items || []);

export const getBomTargetOptions = (referenceData = {}, targetType = "product") => {
  if (targetType === "semi_finished_material") {
    return toReferenceOptions(referenceData.semiFinishedMaterials);
  }

  return toReferenceOptions(referenceData.products);
};

export const getBomMaterialItemOptions = (
  referenceData = {},
  targetType = "product",
  itemType = "raw_material",
) => {
  if (targetType === "product") {
    return toReferenceOptions(referenceData.semiFinishedMaterials);
  }

  if (itemType === "semi_finished_material") {
    return toReferenceOptions(referenceData.semiFinishedMaterials);
  }

  return toReferenceOptions(referenceData.rawMaterials);
};

export const getWorkLogTargetOptions = (referenceData = {}, targetType = "product") => {
  if (targetType === "semi_finished_material") {
    return toReferenceOptions(referenceData.semiFinishedMaterials);
  }

  return toReferenceOptions(referenceData.products);
};

export const getWorkLogMaterialOptions = (
  referenceData = {},
  itemType = "raw_material",
) => {
  if (itemType === "semi_finished_material") {
    return toReferenceOptions(referenceData.semiFinishedMaterials);
  }

  return toReferenceOptions(referenceData.rawMaterials);
};
