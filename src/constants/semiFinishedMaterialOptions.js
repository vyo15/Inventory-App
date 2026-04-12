// =====================================================
// Semi Finished Material Options
// Fokus untuk komponen semi jadi produksi bunga flanel
// =====================================================

import {
  COLOR_VARIANT_MAP,
  COLOR_VARIANT_OPTIONS,
  DEFAULT_COLOR_VARIANT,
  FLOWER_GROUP_MAP,
  FLOWER_GROUP_OPTIONS,
  toOptionMap,
} from './variantOptions';
import {
  calculateVariantTotals,
  formatVariantSummary,
  normalizeColorVariants,
} from '../utils/variants/variantHelpers';

export const SEMI_FINISHED_CATEGORIES = [
  { value: 'pola', label: 'Pola' },
  { value: 'kelopak', label: 'Kelopak' },
  { value: 'daun', label: 'Daun' },
  { value: 'kawat', label: 'Kawat' },
  { value: 'lainnya', label: 'Lainnya' },
];

export const SEMI_FINISHED_GROUP_OPTIONS = FLOWER_GROUP_OPTIONS;

export const SEMI_FINISHED_CATEGORY_MAP = toOptionMap(SEMI_FINISHED_CATEGORIES);
export const SEMI_FINISHED_GROUP_MAP = FLOWER_GROUP_MAP;
export const SEMI_FINISHED_COLOR_OPTIONS = COLOR_VARIANT_OPTIONS;
export const SEMI_FINISHED_COLOR_MAP = COLOR_VARIANT_MAP;

export const DEFAULT_SEMI_FINISHED_VARIANT = DEFAULT_COLOR_VARIANT;

export const DEFAULT_SEMI_FINISHED_FORM = {
  code: '',
  name: '',
  description: '',
  category: 'pola',
  flowerGroup: 'mawar',
  unit: 'pcs',
  variants: [],
  currentStock: 0,
  reservedStock: 0,
  availableStock: 0,
  minStockAlert: 0,
  averageCostPerUnit: 0,
  isActive: true,
};

export const normalizeSemiFinishedVariants = normalizeColorVariants;

export const calculateSemiFinishedTotalsFromVariants = calculateVariantTotals;

export const formatSemiFinishedStockSummary = formatVariantSummary;

// Backward-compatible exports for page lama yang belum sepenuhnya dipangkas
export const SEMI_FINISHED_TYPES = SEMI_FINISHED_GROUP_OPTIONS;
export const SEMI_FINISHED_TYPE_MAP = SEMI_FINISHED_GROUP_MAP;
export const SEMI_FINISHED_VALUATION_METHODS = [{ value: "average", label: "Average Cost" }];
export const SEMI_FINISHED_VALUATION_METHOD_MAP = { average: "Average Cost" };
