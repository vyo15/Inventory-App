// =====================================================
// Option Map Helpers
// Source of truth kecil untuk mengubah array option { value, label }
// menjadi map label tanpa menduplikasi reduce di constants.
// =====================================================

export const toOptionMap = (options = []) => {
  if (!Array.isArray(options)) return {};

  return options.reduce((acc, item) => {
    if (!item || item.value === undefined || item.value === null) return acc;
    const key = String(item.value).trim();
    if (!key) return acc;
    acc[key] = item.label ?? "";
    return acc;
  }, {});
};

export default toOptionMap;
