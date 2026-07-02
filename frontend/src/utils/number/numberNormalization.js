export const toFiniteNumber = (value, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

export const toRoundedInteger = (value, fallback = 0) =>
  Math.round(toFiniteNumber(value, fallback));
