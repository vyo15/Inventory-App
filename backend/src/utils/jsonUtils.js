const safeJsonParse = (value, fallback = {}) => {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
};

module.exports = {
  safeJsonParse,
};
