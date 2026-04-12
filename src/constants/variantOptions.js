export const COLOR_VARIANT_OPTIONS = [
  { value: 'merah', label: 'Merah' },
  { value: 'maroon', label: 'Maroon' },
  { value: 'pink', label: 'Pink' },
  { value: 'putih', label: 'Putih' },
  { value: 'kuning', label: 'Kuning' },
  { value: 'biru', label: 'Biru' },
  { value: 'ungu', label: 'Ungu' },
  { value: 'hijau', label: 'Hijau' },
  { value: 'coklat', label: 'Coklat' },
  { value: 'hitam', label: 'Hitam' },
  { value: 'abu', label: 'Abu-Abu' },
  { value: 'mix', label: 'Mix / Campur' },
  { value: 'lainnya', label: 'Lainnya' },
];

export const FLOWER_GROUP_OPTIONS = [
  { value: 'mawar', label: 'Mawar' },
  { value: 'tulip', label: 'Tulip' },
  { value: 'lily', label: 'Lily' },
  { value: 'daisy', label: 'Daisy' },
  { value: 'universal', label: 'Universal' },
  { value: 'lainnya', label: 'Lainnya' },
];

export const toOptionMap = (options = []) =>
  options.reduce((acc, item) => {
    acc[item.value] = item.label;
    return acc;
  }, {});

export const COLOR_VARIANT_MAP = toOptionMap(COLOR_VARIANT_OPTIONS);
export const FLOWER_GROUP_MAP = toOptionMap(FLOWER_GROUP_OPTIONS);

export const DEFAULT_COLOR_VARIANT = {
  color: 'merah',
  sku: '',
  currentStock: 0,
  reservedStock: 0,
  minStockAlert: 0,
  averageCostPerUnit: 0,
  isActive: true,
};
