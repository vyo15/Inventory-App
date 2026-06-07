// =====================================================
// Semi Finished Material Options
// Fokus untuk komponen semi jadi produksi bunga flanel
// =====================================================

import { toOptionMap } from "../utils/options/optionMap";
import {
  COLOR_VARIANT_MAP,
  COLOR_VARIANT_OPTIONS,
  DEFAULT_COLOR_VARIANT,
  FLOWER_GROUP_MAP,
  FLOWER_GROUP_OPTIONS,
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

export const DEFAULT_SEMI_FINISHED_VARIANT = {
  ...DEFAULT_COLOR_VARIANT,
  // IMS NOTE [AKTIF | generic-variant]: default Semi Product tidak lagi memaksa
  // Merah. Hubungan flow: user boleh memakai label varian fleksibel seperti
  // Ukuran, Tipe, Motif, atau Spesifikasi; color tetap alias data historis kompatibel.
  color: '',
  name: '',
  variantLabel: '',
};

export const DEFAULT_SEMI_FINISHED_FORM = {
  code: '',
  name: '',
  description: '',
  category: 'pola',
  // IMS NOTE [AKTIF | no-silent-mawar-default]: Jenis Bunga wajib dipilih eksplisit.
  // Data baru tidak boleh otomatis masuk group Mawar karena Semi Product akan dipakai untuk jenis bunga lain.
  flowerGroup: '',
  unit: 'pcs',
  hasVariants: false,
  variantLabel: 'Varian',
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
