export const formatCurrencyId = (value, withPrefix = true) => {
  const formatted = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

  return withPrefix ? `Rp ${formatted}` : formatted;
};

export const formatCurrencyIDR = formatCurrencyId;
export default formatCurrencyId;
