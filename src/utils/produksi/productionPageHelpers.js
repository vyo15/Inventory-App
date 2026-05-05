// IMS NOTE - CLEANUP CANDIDATE:
// Export helper search ini saat ini banyak dipakai sebagai util internal page helper.
// Jangan hapus hanya karena named export tidak di-import langsung sebelum audit semua halaman produksi.
export const normalizeSearchText = (value) =>
  String(value || "").trim().toLowerCase();

export const includesSearchText = (value, searchText) => {
  if (!searchText) return true;
  return String(value || "").toLowerCase().includes(searchText);
};

export const matchActiveStatus = (item, statusFilter, fieldName = "isActive") => {
  if (statusFilter === "all") return true;
  if (statusFilter === "active") return Boolean(item?.[fieldName]);
  if (statusFilter === "inactive") return !item?.[fieldName];
  return String(item?.[fieldName] || "") === String(statusFilter);
};

export const matchFieldValue = (item, filterValue, fieldName) => {
  if (filterValue === "all") return true;
  return String(item?.[fieldName] || "") === String(filterValue);
};

export const buildCountSummary = (items = [], config = {}) => {
  const summary = { total: items.length };

  Object.entries(config).forEach(([key, predicate]) => {
    summary[key] = items.filter((item) => predicate(item)).length;
  });

  return summary;
};

export const createKeywordMatcher = (item, fields = [], search = "") => {
  const searchText = normalizeSearchText(search);
  if (!searchText) return true;
  return fields.some((field) => includesSearchText(item?.[field], searchText));
};
