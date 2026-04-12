const safeTrim = (value) => String(value || '').trim();

export const buildReferenceLabel = (item = {}) => {
  const code =
    safeTrim(item.code) ||
    safeTrim(item.itemCode) ||
    safeTrim(item.productCode) ||
    safeTrim(item.sku);
  const name =
    safeTrim(item.name) ||
    safeTrim(item.itemName) ||
    safeTrim(item.productName) ||
    safeTrim(item.title);

  return code ? `${code} - ${name || '-'}` : name || '-';
};

export const buildReferenceOptions = (items = []) =>
  (items || []).map((item) => ({
    value: item.id,
    label: buildReferenceLabel(item),
    raw: item,
  }));
