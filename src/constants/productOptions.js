import { COLOR_MAP, COLOR_OPTIONS, FLOWER_GROUP_MAP, FLOWER_GROUP_OPTIONS } from './variantOptions';
import { DEFAULT_COLOR_VARIANT, calculateVariantTotals, normalizeColorVariants } from '../utils/variants/variantHelpers';

export const PRODUCT_COLOR_OPTIONS = COLOR_OPTIONS;
export const PRODUCT_COLOR_MAP = COLOR_MAP;
export const PRODUCT_FLOWER_GROUP_OPTIONS = FLOWER_GROUP_OPTIONS;
export const PRODUCT_FLOWER_GROUP_MAP = FLOWER_GROUP_MAP;

export const DEFAULT_PRODUCT_VARIANT = {
  ...DEFAULT_COLOR_VARIANT,
  reservedStock: 0,
  averageCostPerUnit: 0,
};

export const DEFAULT_PRODUCT_FORM = {
  code: '',
  name: '',
  categoryId: null,
  flowerGroup: 'mawar',
  price: 0,
  hppPerUnit: 0,
  pricingMode: 'manual',
  pricingRuleId: null,
  description: '',
  variants: [{ ...DEFAULT_PRODUCT_VARIANT }],
  isActive: true,
};

export const normalizeProductVariants = (variants = []) =>
  normalizeColorVariants(variants, {
    withReserved: false,
    withMinStock: true,
    withAverageCost: false,
  }).map((item) => ({
    ...item,
    reservedStock: 0,
    averageCostPerUnit: 0,
  }));

export const calculateProductTotalsFromVariants = (variants = []) =>
  calculateVariantTotals(variants, {
    withReserved: false,
    withMinStock: true,
    withAverageCost: false,
  });
