export const ACTIVE_STATUS_META = Object.freeze({
  active: Object.freeze({ label: "Aktif", tone: "success", color: "green" }),
  inactive: Object.freeze({ label: "Nonaktif", tone: "neutral", color: "default" }),
});

export const getActiveStatusMeta = (value, {
  activeLabel = "Aktif",
  inactiveLabel = "Nonaktif",
} = {}) => {
  const active = value === true || value === 1 || value === "active" || value === "Aktif";
  return active
    ? { ...ACTIVE_STATUS_META.active, label: activeLabel }
    : { ...ACTIVE_STATUS_META.inactive, label: inactiveLabel };
};

export const resolveStatusTone = (color = "default") => {
  const normalized = String(color || "default").toLowerCase();
  if (["green", "success"].includes(normalized)) return "success";
  if (["blue", "cyan", "info"].includes(normalized)) return "info";
  if (["orange", "yellow", "warning"].includes(normalized)) return "warning";
  if (["red", "error", "danger"].includes(normalized)) return "danger";
  if (["gold", "brand"].includes(normalized)) return "brand";
  if (["purple", "magenta", "accent"].includes(normalized)) return "accent";
  return "neutral";
};
