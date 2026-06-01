import { notification } from "antd";

const DEFAULT_TITLE = "Data belum lengkap";
const DEFAULT_DESCRIPTION_PREFIX = "Lengkapi";
const technicalNameToLabel = (value = "") => {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "Field wajib";

  const knownLabels = {
    id: "ID",
    name: "Nama",
    code: "Kode",
    sku: "SKU",
    date: "Tanggal",
    type: "Jenis",
    status: "Status",
    itemId: "Item",
    itemName: "Nama Item",
    productId: "Produk",
    productName: "Nama Produk",
    materialId: "Bahan Baku",
    rawMaterialId: "Bahan Baku",
    categoryId: "Kategori",
    customerId: "Customer",
    supplierId: "Supplier",
    quantity: "Jumlah",
    qty: "Jumlah",
    price: "Harga",
    sellingPrice: "Harga Jual",
    purchasePrice: "Harga Beli",
    unit: "Satuan",
    items: "Item",
    materialUsages: "Bahan Baku",
    materialLines: "Bahan Baku",
    stepLines: "Tahapan Produksi",
    outputs: "Output",
    workerIds: "Operator",
    payrollDate: "Tanggal Payroll",
    payrollAmount: "Nominal Payroll",
    finalAmount: "Nominal Final",
    targetType: "Jenis Target",
    targetItemId: "Target Produksi",
    targetId: "Target Produksi",
    plannedQty: "Qty Rencana",
    targetQty: "Qty Target",
    goodQty: "Qty Bagus",
    bomId: "BOM",
    stepId: "Tahapan Produksi",
    workLogId: "Work Log",
    productionOrderId: "Production Order",
  };

  if (knownLabels[rawValue]) return knownLabels[rawValue];

  return rawValue
    .replace(/Id$/u, "")
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .replace(/[._-]+/gu, " ")
    .trim()
    .replace(/\b\w/gu, (char) => char.toUpperCase()) || "Field wajib";
};

const toPathArray = (name = []) => (Array.isArray(name) ? name : [name]).filter((part) => part !== undefined && part !== null && part !== "");

const resolveFieldLabel = (namePath = [], labelMap = {}) => {
  const path = toPathArray(namePath);
  const pathKey = path.join(".");
  if (labelMap[pathKey]) return labelMap[pathKey];

  const hasArrayIndex = path.some((part) => typeof part === "number");
  if (hasArrayIndex) {
    const parent = path[0];
    const index = path.find((part) => typeof part === "number");
    const leaf = [...path].reverse().find((part) => typeof part !== "number" && part !== parent);
    const parentLabel = labelMap[parent] || technicalNameToLabel(parent);
    const leafKey = leaf ? `${parent}.${leaf}` : "";
    const leafLabel = labelMap[pathKey] || labelMap[leafKey] || technicalNameToLabel(leaf || parent);

    return `${parentLabel} #${Number(index) + 1} - ${leafLabel}`;
  }

  const lastPath = path[path.length - 1];
  return labelMap[pathKey] || labelMap[lastPath] || technicalNameToLabel(lastPath);
};

export const isAntdFormValidationError = (errorInfo) =>
  Array.isArray(errorInfo?.errorFields) && errorInfo.errorFields.length > 0;

export const getValidationFieldLabels = (errorInfo, labelMap = {}) => {
  if (!isAntdFormValidationError(errorInfo)) return [];

  const labels = errorInfo.errorFields
    .map((field) => resolveFieldLabel(field?.name, labelMap))
    .filter(Boolean);

  return Array.from(new Set(labels));
};

/*
=====================================================
SECTION: Shared popup validasi field wajib — AKTIF
Fungsi:
- Mengubah error AntD Form menjadi popup manusiawi berisi daftar field yang perlu dilengkapi.

Dipakai oleh:
- PageFormModal dan form/drawer custom yang memanggil form.validateFields().

Alasan perubahan:
- User perlu tahu field wajib mana yang kosong saat klik Simpan tanpa melihat error teknis mentah.

Catatan cleanup:
- Label map per halaman bisa distandarkan lagi jika nanti semua form memakai schema field yang konsisten.

Risiko:
- Jika helper ini menelan error non-validasi, submit service bisa terlihat gagal tanpa pesan teknis yang benar.
=====================================================
*/
export const showFormValidationFeedback = (errorInfo, options = {}) => {
  if (!isAntdFormValidationError(errorInfo)) return false;

  const {
    form,
    fieldLabels = {},
    title = DEFAULT_TITLE,
    descriptionPrefix = DEFAULT_DESCRIPTION_PREFIX,
    placement = "topRight",
  } = options;
  const labels = getValidationFieldLabels(errorInfo, fieldLabels);
  const description = labels.length > 0
    ? `${descriptionPrefix}: ${labels.join(", ")}.`
    : "Lengkapi field wajib yang masih kosong.";

  notification.warning({
    message: title,
    description,
    placement,
    duration: 4,
  });

  const firstErrorField = errorInfo.errorFields?.[0]?.name;
  if (form && firstErrorField && typeof form.scrollToField === "function") {
    window.setTimeout(() => {
      try {
        form.scrollToField(firstErrorField, { block: "center", behavior: "smooth" });
      } catch {
        // Scroll best-effort saja; validasi tetap sudah tampil lewat notification.
      }
    }, 0);
  }

  return true;
};
