const normalizeText = (value) => String(value ?? "").trim();

const normalizeTruthyText = (value) => (value ? String(value).trim() : "");

const normalizeUpperText = (value) => normalizeText(value).toUpperCase();

const normalizeLowerText = (value) => normalizeText(value).toLowerCase();

const toRoundedInteger = (value = 0) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
};

module.exports = {
  normalizeLowerText,
  normalizeText,
  normalizeTruthyText,
  normalizeUpperText,
  toRoundedInteger,
};
