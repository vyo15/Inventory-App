import { buildReferenceOptions } from '../options/referenceOptionBuilders';

export const safeTrim = (value) => String(value || '').trim();
export const toVariantKey = (value) => safeTrim(value).toLowerCase();

export const hasVariantSupport = (item = {}) => {
  if (item?.hasVariants === true || item?.hasVariantOptions === true) return true;
  if (Array.isArray(item?.variants) && item.variants.length > 0) return true;
  if (Array.isArray(item?.variantOptions) && item.variantOptions.length > 0) return true;
  return false;
};

export const getItemVariantList = (item = {}) => {
  if (Array.isArray(item?.variants) && item.variants.length > 0) return item.variants;
  if (Array.isArray(item?.variantOptions) && item.variantOptions.length > 0) return item.variantOptions;
  return [];
};

export const findMatchingVariant = (item = {}, targetVariantKey = '') => {
  const wanted = toVariantKey(targetVariantKey);
  if (!wanted) return null;

  return (
    getItemVariantList(item).find((variant) => {
      const rawKeys = [variant?.color, variant?.name, variant?.variantName, variant?.variantKey, variant?.sku, variant?.variantCode];
      return rawKeys.some((value) => toVariantKey(value) === wanted);
    }) || null
  );
};

const decorateMasterReference = (item = {}, sourceType = '') => {
  const supportsVariant = hasVariantSupport(item);
  const rawName = safeTrim(item?.name || item?.targetName || item?.productName || '');
  const variantSuffix = supportsVariant ? ' • pakai varian' : ' • tanpa varian';

  return {
    ...item,
    sourceType,
    itemSourceType: sourceType,
    hasVariants: supportsVariant,
    variantStrategy: supportsVariant ? 'inherit' : 'none',
    name: rawName,
    label: rawName ? `${rawName}${variantSuffix}` : rawName,
  };
};

const decorateMasterList = (items = [], sourceType = '') =>
  (items || []).map((item) => decorateMasterReference(item, sourceType));

export const toReferenceOptions = (items = []) => buildReferenceOptions(items || []);

export const getBomTargetOptions = (referenceData = {}, targetType = 'product') => {
  if (targetType === 'semi_finished_material') {
    return toReferenceOptions(
      decorateMasterList(referenceData.semiFinishedMaterials || [], 'semi_finished_material'),
    );
  }

  return toReferenceOptions(decorateMasterList(referenceData.products || [], 'product'));
};

export const getBomMaterialItemOptions = (
  referenceData = {},
  targetType = 'product',
  itemType = 'raw_material',
) => {
  if (targetType === 'product') {
    return toReferenceOptions(
      decorateMasterList(referenceData.semiFinishedMaterials || [], 'semi_finished_material'),
    );
  }

  if (itemType === 'semi_finished_material') {
    return toReferenceOptions(
      decorateMasterList(referenceData.semiFinishedMaterials || [], 'semi_finished_material'),
    );
  }

  return toReferenceOptions(decorateMasterList(referenceData.rawMaterials || [], 'raw_material'));
};

export const getWorkLogTargetOptions = (referenceData = {}, targetType = 'product') => {
  if (targetType === 'semi_finished_material') {
    return toReferenceOptions(
      decorateMasterList(referenceData.semiFinishedMaterials || [], 'semi_finished_material'),
    );
  }

  return toReferenceOptions(decorateMasterList(referenceData.products || [], 'product'));
};

export const getWorkLogMaterialOptions = (referenceData = {}, itemType = 'raw_material') => {
  if (itemType === 'semi_finished_material') {
    return toReferenceOptions(
      decorateMasterList(referenceData.semiFinishedMaterials || [], 'semi_finished_material'),
    );
  }

  return toReferenceOptions(decorateMasterList(referenceData.rawMaterials || [], 'raw_material'));
};

export const getWorkLogOutputOptions = (referenceData = {}, outputType = 'product') => {
  if (outputType === 'semi_finished_material') {
    return toReferenceOptions(
      decorateMasterList(referenceData.semiFinishedMaterials || [], 'semi_finished_material'),
    );
  }

  return toReferenceOptions(decorateMasterList(referenceData.products || [], 'product'));
};

export const resolveInheritedVariantReference = (item = {}, targetVariantKey = '') => {
  const normalizedKey = toVariantKey(targetVariantKey);
  const supportsVariant = hasVariantSupport(item);

  if (!supportsVariant || !normalizedKey) {
    return {
      hasVariants: supportsVariant,
      variantKey: '',
      variantName: '',
      variantCode: '',
      variantReference: '',
    };
  }

  const matched = findMatchingVariant(item, targetVariantKey);

  if (!matched) {
    return {
      hasVariants: true,
      variantKey: normalizedKey,
      variantName: safeTrim(targetVariantKey),
      variantCode: '',
      variantReference: safeTrim(targetVariantKey),
    };
  }

  const variantName =
    safeTrim(matched?.variantName) || safeTrim(matched?.name) || safeTrim(matched?.color);

  return {
    hasVariants: true,
    variantKey:
      toVariantKey(matched?.variantKey) ||
      toVariantKey(matched?.color) ||
      toVariantKey(matched?.name) ||
      toVariantKey(matched?.sku) ||
      toVariantKey(matched?.variantCode),
    variantName,
    variantCode: safeTrim(matched?.variantCode) || safeTrim(matched?.sku),
    variantReference: variantName,
  };
};
