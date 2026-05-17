// =====================================================
// Page: Semi Finished Materials
// Master stok internal produksi
// Tidak dijual ke customer
// Revisi:
// - Master item tetap ringkas
// - Stok disimpan per varian fleksibel
// - Total master dihitung otomatis dari seluruh varian
// =====================================================

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  calculateSemiFinishedTotalsFromVariants,
  DEFAULT_SEMI_FINISHED_FORM,
  DEFAULT_SEMI_FINISHED_VARIANT,
  formatSemiFinishedStockSummary,
  normalizeSemiFinishedVariants,
  SEMI_FINISHED_CATEGORIES,
  SEMI_FINISHED_CATEGORY_MAP,
  SEMI_FINISHED_COLOR_MAP,
  SEMI_FINISHED_GROUP_OPTIONS,
  SEMI_FINISHED_GROUP_MAP,
} from "../../constants/semiFinishedMaterialOptions";
import {
  createSemiFinishedMaterial,
  getAllSemiFinishedMaterials,
  toggleSemiFinishedMaterialActive,
  updateSemiFinishedMaterial,
} from "../../services/Produksi/semiFinishedMaterialsService";
import formatNumber, { parseIntegerIdInput } from "../../utils/formatters/numberId";
import formatCurrency from "../../utils/formatters/currencyId";
import { formatStockWithUnitId } from "../../utils/formatters/stockUnit";
import ProductionFilterCard from "../../components/Produksi/shared/ProductionFilterCard";
import ProductionPageHeader from "../../components/Produksi/shared/ProductionPageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import ProductionSummaryCards from "../../components/Produksi/shared/ProductionSummaryCards";
import StockDisplayBlock from "../../components/Layout/Table/StockDisplayBlock";
import { DataRefreshIndicator, getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";
import { showFormValidationFeedback } from '../../utils/forms/formValidationFeedback';
import {
  formatAffectedVariantStockSummary,
  getVariantAwareStockStatusMeta,
} from '../../utils/stock/stockHelpers';

// =====================================================
// Formatter final lintas aplikasi
// ACTIVE / FINAL: master semi finished memakai helper shared untuk qty dan Rupiah.
// =====================================================

// IMS NOTE [AKTIF/GUARDED] - Standar input angka bulat
// Fungsi blok: mengarahkan InputNumber aktif ke step 1, precision 0, dan parser integer Indonesia.
// Hubungan flow: hanya membatasi input/display UI; service calculation stok, kas, HPP, payroll, dan report tidak diubah.
// Alasan logic: IMS operasional memakai angka tanpa desimal, sementara data lama decimal tidak dimigrasi otomatis.
// Behavior: input baru no-decimal; business rules dan schema Firestore tetap sama.

const normalizeFormVariants = (variants = [], hasVariants = true) => {
  if (!hasVariants) {
    return [];
  }

  const normalized = normalizeSemiFinishedVariants(variants);

  if (normalized.length > 0) {
    return normalized;
  }

  return [{ ...DEFAULT_SEMI_FINISHED_VARIANT }];
};

const buildFormValues = (record = {}) => {
  const hasVariants = record?.hasVariants === true || (record?.variants || []).length > 0;
  const totals = calculateSemiFinishedTotalsFromVariants(record.variants || []);

  return {
    ...DEFAULT_SEMI_FINISHED_FORM,
    ...record,
    hasVariants,
    variantLabel: record.variantLabel || 'Varian',
    variants: normalizeFormVariants(record.variants || [], hasVariants),
    currentStock: hasVariants ? totals.currentStock : Number(record.currentStock || 0),
    reservedStock: hasVariants ? totals.reservedStock : Number(record.reservedStock || 0),
    availableStock:
      hasVariants
        ? totals.availableStock
        : Math.max(
            Number(record.currentStock || 0) - Number(record.reservedStock || 0),
            0,
          ),
    minStockAlert: Number(record.minStockAlert || 0),
    averageCostPerUnit:
      hasVariants
        ? Number(totals.averageCostPerUnit || 0)
        : Number(record.averageCostPerUnit || 0),
  };
};

// -----------------------------------------------------------------------------
// Helper tampilan stok untuk form summary dan drawer detail.
// Tabel utama memakai StockDisplayBlock agar format saldo stok locked seragam.
// Implementasi memakai formatter shared agar output stok + unit konsisten lintas master data.
// -----------------------------------------------------------------------------
const formatStockWithUnit = formatStockWithUnitId;

const getVariantDisplayLabel = (variant = {}, index = 0) =>
  variant.variantLabel || variant.label || variant.name || SEMI_FINISHED_COLOR_MAP[variant.color] || variant.color || `Varian ${index + 1}`;

const FALLBACK_SEMI_FINISHED_GROUP_KEY = "__general_reusable";
const FALLBACK_SEMI_FINISHED_GROUP_LABEL = "Umum / Reusable";

const normalizeSemiFinishedGroupKey = (value = "") => String(value || "").trim();

const normalizeSemiFinishedGroupLookupKey = (value = "") =>
  normalizeSemiFinishedGroupKey(value)
    .toLowerCase()
    .replace(/[\s_-]+/g, "_");

const getKnownSemiFinishedGroupKey = (value = "") => {
  const lookupKey = normalizeSemiFinishedGroupLookupKey(value);

  if (!lookupKey) return "";

  return (
    SEMI_FINISHED_GROUP_OPTIONS.find((option) =>
      [option.value, option.label].some(
        (candidate) => normalizeSemiFinishedGroupLookupKey(candidate) === lookupKey,
      ),
    )?.value || ""
  );
};

const getSemiFinishedGroupLabel = (value = "", fallbackLabel = "-") => {
  const key = normalizeSemiFinishedGroupKey(value);
  if (!key) return fallbackLabel;

  const knownKey = getKnownSemiFinishedGroupKey(key);
  return SEMI_FINISHED_GROUP_MAP[knownKey] || key;
};

const buildSemiFinishedGroupOptions = (materials = [], { includeGeneral = false } = {}) => {
  const staticOptions = SEMI_FINISHED_GROUP_OPTIONS.map((option) => ({ ...option }));
  const knownKeys = new Set(
    staticOptions.flatMap((option) => [option.value, option.label].map(normalizeSemiFinishedGroupLookupKey)),
  );
  const dynamicOptions = [];
  const dynamicKeys = new Set();
  let hasGeneralGroup = false;

  materials.forEach((item) => {
    const key = normalizeSemiFinishedGroupKey(item?.flowerGroup);
    const lookupKey = normalizeSemiFinishedGroupLookupKey(key);

    if (!key) {
      hasGeneralGroup = true;
      return;
    }

    if (knownKeys.has(lookupKey) || dynamicKeys.has(lookupKey)) return;

    dynamicKeys.add(lookupKey);
    dynamicOptions.push({
      value: key,
      label: getSemiFinishedGroupLabel(key, key),
    });
  });

  dynamicOptions.sort((a, b) => a.label.localeCompare(b.label));

  return [
    ...(includeGeneral && hasGeneralGroup
      ? [{ value: FALLBACK_SEMI_FINISHED_GROUP_KEY, label: FALLBACK_SEMI_FINISHED_GROUP_LABEL }]
      : []),
    ...staticOptions,
    ...dynamicOptions,
  ];
};

// StockDisplayBlock dipakai untuk table utama agar format Total/Tersedia/variant pill sama dengan Products dan Stock Report.

/* =====================================================
SECTION: Semi Finished Minimum Stock Status — AKTIF
Fungsi:
- Menentukan status minimum stok Semi Finished secara read-only memakai stok tersedia lebih dulu, lalu fallback stok lama.

Dipakai oleh:
- SemiFinishedMaterials.jsx summary, filter status, table row, dan drawer detail.

Alasan perubahan:
- `minStockAlert` Semi Finished adalah threshold master item; status harus konsisten dengan Dashboard/Stock Report dan tidak boleh membaca min stock varian.

Catatan cleanup:
- `variants[].minStockAlert` tetap legacy-compat di data/helper dan tidak dipakai oleh helper status ini.

Risiko:
- Jika status kembali memakai currentStock langsung atau min alert varian, item dengan reserved stock bisa salah terlihat aman dan rule master-level menjadi tidak konsisten.
===================================================== */
const getSemiFinishedMinimumStockValue = (record = {}) => {
  const stockValue = Number(record.availableStock ?? record.currentStock ?? record.stock ?? 0);
  return Number.isFinite(stockValue) ? stockValue : 0;
};

const getStockStatusMeta = (record = {}) => {
  const comparableStock = getSemiFinishedMinimumStockValue(record);
  const minStockAlertValue = Number(record.minStockAlert || 0);
  const minStockAlert = Number.isFinite(minStockAlertValue) ? minStockAlertValue : 0;

  if (record.isActive === false) {
    return { color: "default", label: "Nonaktif", alertType: "info" };
  }

  const variantStatusMeta = getVariantAwareStockStatusMeta(record, {
    sourceType: "semi_finished",
    threshold: minStockAlert,
  });

  if (variantStatusMeta) return variantStatusMeta;

  if (comparableStock <= 0) {
    return { color: "red", label: "Kosong", alertType: "error" };
  }

  if (minStockAlert > 0 && comparableStock <= minStockAlert) {
    return { color: "orange", label: "Stok Rendah", alertType: "warning" };
  }

  return { color: "green", label: "Aman", alertType: "success" };
};

const compactCellStyles = {
  stack: { display: "flex", flexDirection: "column", gap: 2 },
  meta: { fontSize: 12, lineHeight: 1.35 },
};

const SemiFinishedMaterials = () => {
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [flowerGroupFilter, setFlowerGroupFilter] = useState("all");
  const [listViewMode, setListViewMode] = useState("grouped");

  const [formVisible, setFormVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [editingMaterial, setEditingMaterial] = useState(null);

  const [form] = Form.useForm();

  // GUARDED: mode edit master hanya boleh mengubah metadata non-stok.
  // ALASAN: stok semi finished dipakai flow produksi/Work Log, sehingga edit master tidak boleh menimpa stok tanpa audit.
  // STATUS: AKTIF untuk mengunci field stok di UI; service update tetap menjadi guard utama.
  // IMS NOTE [GUARDED | behavior-preserving]: flag edit dipakai untuk mengunci stok semi finished.
  // Hubungan flow: stok semi finished dipakai produksi, jadi edit master tidak boleh menjadi jalur mutasi.
  const isEditingMaterial = Boolean(editingMaterial?.id);
  const editingMaterialHasVariants = Boolean(editingMaterial?.hasVariants || (editingMaterial?.variants || []).length > 0);
  const canActivateVariantsForEditing = isEditingMaterial
    && !editingMaterialHasVariants
    && Number(editingMaterial?.currentStock ?? editingMaterial?.stock ?? 0) <= 0
    && Number(editingMaterial?.reservedStock || 0) <= 0
    && Number(editingMaterial?.availableStock ?? 0) <= 0;
  const hasVariantModeSwitchLocked = isEditingMaterial && !canActivateVariantsForEditing;
  const stockEditHelpText = 'Ubah stok lewat Stock Management / Stock Adjustment / transaksi resmi.';
  const flowerGroupFormOptions = useMemo(() => buildSemiFinishedGroupOptions(materials), [materials]);
  const flowerGroupFilterOptions = useMemo(
    () => buildSemiFinishedGroupOptions(materials, { includeGeneral: true }),
    [materials],
  );

  // ---------------------------------------------------------------------------
  // Loader utama halaman.
  // Semua data list di-refresh dari service yang sama agar source of truth tetap
  // satu pintu dan lebih mudah dilacak saat maintenance.
  // ---------------------------------------------------------------------------
  const loadData = async () => {
    try {
      setLoading(true);
      const result = await getAllSemiFinishedMaterials();
      setMaterials(result);
    } catch (error) {
      console.error(error);
      message.error("Gagal memuat data semi finished materials");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ---------------------------------------------------------------------------
  // Watcher form dipakai untuk membuat preview stok di drawer form tetap realtime
  // tanpa harus menunggu user menekan tombol simpan.
  // ---------------------------------------------------------------------------
  const hasVariantsValue = Form.useWatch("hasVariants", form);
  const variantLabelValue = Form.useWatch("variantLabel", form);
  const watchedVariants = Form.useWatch("variants", form);
  const watchedCurrentStock = Form.useWatch("currentStock", form) || 0;
  const watchedReservedStock = Form.useWatch("reservedStock", form) || 0;
  const watchedMinStockAlert = Form.useWatch("minStockAlert", form) || 0;
  const watchedAverageCost = Form.useWatch("averageCostPerUnit", form) || 0;

  const calculatedTotals = useMemo(() => {
    const masterMinStockAlert = Number(watchedMinStockAlert || 0);

    if (hasVariantsValue) {
      const variantTotals = calculateSemiFinishedTotalsFromVariants(watchedVariants);
      return {
        ...variantTotals,
        minStockAlert: masterMinStockAlert,
      };
    }

    return {
      currentStock: Number(watchedCurrentStock || 0),
      reservedStock: Number(watchedReservedStock || 0),
      availableStock: Math.max(Number(watchedCurrentStock || 0) - Number(watchedReservedStock || 0), 0),
      minStockAlert: masterMinStockAlert,
      averageCostPerUnit: Number(watchedAverageCost || 0),
      variantCount: 0,
      activeVariantCount: 0,
      variants: [],
    };
  }, [hasVariantsValue, watchedVariants, watchedCurrentStock, watchedReservedStock, watchedMinStockAlert, watchedAverageCost]);

  // ---------------------------------------------------------------------------
  // Ringkasan card atas halaman.
  // Fokusnya hanya metrik operasional yang paling sering dipakai user harian.
  // ---------------------------------------------------------------------------
  const summary = useMemo(() => {
    const total = materials.length;
    const active = materials.filter((item) => item.isActive !== false).length;
    const inactive = materials.filter((item) => item.isActive === false).length;

    const lowStock = materials.filter((item) => {
      const statusMeta = getStockStatusMeta(item);
      return statusMeta.label === "Kosong" || statusMeta.label === "Stok Rendah";
    }).length;

    return { total, active, inactive, lowStock };
  }, [materials]);

  const summaryItems = [
    { key: "semi-total", title: "Total Item", value: summary.total, subtitle: "Seluruh item semi finished yang tersimpan.", accent: "primary" },
    { key: "semi-active", title: "Item Aktif", value: summary.active, subtitle: "Masih aktif dipakai dalam flow produksi.", accent: "success" },
    { key: "semi-inactive", title: "Item Nonaktif", value: summary.inactive, subtitle: "Disimpan untuk histori tetapi tidak aktif dipakai.", accent: "warning" },
    { key: "semi-low", title: "Perlu Dicek", value: summary.lowStock, subtitle: "Item yang kosong atau mendekati batas minimum.", accent: "default" },
  ];

  // ---------------------------------------------------------------------------
  // Filter list utama.
  // Sorting tetap mengikuti urutan data dari service, sedangkan halaman ini hanya
  // bertugas menyaring data sesuai kebutuhan user.
  // ---------------------------------------------------------------------------
  const filteredData = useMemo(() => {
    return materials.filter((item) => {
      const searchText = search.trim().toLowerCase();
      const variantColorTexts = Array.isArray(item.variants)
        ? item.variants.map((variant, index) => getVariantDisplayLabel(variant, index))
        : [];

      const matchSearch =
        !searchText ||
        String(item.code || "").toLowerCase().includes(searchText) ||
        String(item.name || "").toLowerCase().includes(searchText) ||
        String(item.description || "").toLowerCase().includes(searchText) ||
        variantColorTexts.some((text) => String(text || "").toLowerCase().includes(searchText));

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && item.isActive !== false) ||
        (statusFilter === "inactive" && item.isActive === false);

      const matchCategory =
        categoryFilter === "all" || item.category === categoryFilter;

      const itemFlowerGroupKey = normalizeSemiFinishedGroupKey(item.flowerGroup) || FALLBACK_SEMI_FINISHED_GROUP_KEY;
      const matchFlowerGroup =
        flowerGroupFilter === "all" || itemFlowerGroupKey === flowerGroupFilter;

      return matchSearch && matchStatus && matchCategory && matchFlowerGroup;
    });
  }, [materials, search, statusFilter, categoryFilter, flowerGroupFilter]);

  /* =====================================================
  SECTION: Semi Finished grouped listing — AKTIF
  Fungsi:
  - Mengelompokkan list Semi Product secara read-only berdasarkan Product Family / Jenis Bunga lalu kategori.

  Dipakai oleh:
  - Halaman SemiFinishedMaterials untuk mode tampilan grouped tanpa mengubah service, payload, stok, atau schema Firestore.

  Alasan perubahan:
  - Daftar semi product global tetap reusable, tetapi user tidak lagi membaca satu daftar campur panjang saat data bertambah.

  Catatan cleanup:
  - Belum ada. Jika relasi pemakaian produk dibutuhkan, baca read-only dari BOM pada task terpisah.

  Risiko:
  - Jangan memakai grouping ini sebagai relasi kepemilikan produk karena stok semi product tetap global/reusable.
  ===================================================== */
  const groupedFilteredData = useMemo(() => {
    const familyMap = new Map();

    filteredData.forEach((item) => {
      const rawFamilyKey = normalizeSemiFinishedGroupKey(item.flowerGroup);
      const familyKey = rawFamilyKey || FALLBACK_SEMI_FINISHED_GROUP_KEY;
      const familyLabel = getSemiFinishedGroupLabel(rawFamilyKey, FALLBACK_SEMI_FINISHED_GROUP_LABEL);

      const rawCategoryKey = String(item.category || "").trim();
      const categoryKey = rawCategoryKey || "__uncategorized";
      const categoryLabel = rawCategoryKey
        ? SEMI_FINISHED_CATEGORY_MAP[rawCategoryKey] || rawCategoryKey
        : "Tanpa Kategori";

      if (!familyMap.has(familyKey)) {
        familyMap.set(familyKey, {
          key: familyKey,
          label: familyLabel,
          items: [],
          categoryMap: new Map(),
        });
      }

      const familyGroup = familyMap.get(familyKey);
      familyGroup.items.push(item);

      if (!familyGroup.categoryMap.has(categoryKey)) {
        familyGroup.categoryMap.set(categoryKey, {
          key: `${familyKey}::${categoryKey}`,
          label: categoryLabel,
          items: [],
        });
      }

      familyGroup.categoryMap.get(categoryKey).items.push(item);
    });

    return Array.from(familyMap.values())
      .map((familyGroup) => {
        const statusCounts = familyGroup.items.reduce(
          (acc, item) => {
            const statusMeta = getStockStatusMeta(item);
            if (item.isActive === false) acc.inactive += 1;
            if (statusMeta.label === "Kosong") acc.empty += 1;
            if (statusMeta.label === "Stok Rendah") acc.low += 1;
            if (statusMeta.label === "Aman") acc.safe += 1;
            return acc;
          },
          { safe: 0, empty: 0, low: 0, inactive: 0 },
        );

        return {
          ...familyGroup,
          statusCounts,
          categories: Array.from(familyGroup.categoryMap.values()).sort((a, b) =>
            a.label.localeCompare(b.label),
          ),
        };
      })
      .sort((a, b) => {
        if (a.key === FALLBACK_SEMI_FINISHED_GROUP_KEY) return 1;
        if (b.key === FALLBACK_SEMI_FINISHED_GROUP_KEY) return -1;
        return a.label.localeCompare(b.label);
      });
  }, [filteredData]);

  const shouldAutoOpenSemiGroups = Boolean(search.trim()) || statusFilter !== "all" || categoryFilter !== "all" || flowerGroupFilter !== "all";

  // ---------------------------------------------------------------------------
  // Helper reset form agar state create/edit tidak saling tercampur.
  // ---------------------------------------------------------------------------
  const resetFormState = () => {
    setEditingMaterial(null);
    form.resetFields();
    form.setFieldsValue(buildFormValues(DEFAULT_SEMI_FINISHED_FORM));
  };

  // ---------------------------------------------------------------------------
  // Handler drawer form.
  // Create dan edit memakai form yang sama agar maintenance lebih ringan.
  // ---------------------------------------------------------------------------
  const handleAdd = () => {
    setEditingMaterial(null);
    form.setFieldsValue({
      ...buildFormValues(DEFAULT_SEMI_FINISHED_FORM),
      code: "",
    });
    setFormVisible(true);
  };

  const handleEdit = (record) => {
    setEditingMaterial(record);
    form.setFieldsValue(buildFormValues(record));
    setFormVisible(true);
  };

  const handleViewDetail = (record) => {
    setSelectedMaterial(record);
    setDetailVisible(true);
  };

  // ---------------------------------------------------------------------------
  // Submit create / edit.
  // Payload tetap dinormalisasi di sini supaya service menerima struktur data
  // yang bersih, baik item memakai varian maupun non-varian.
  // ---------------------------------------------------------------------------
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const payload = {
        ...values,
        hasVariants: values.hasVariants === true,
        variantLabel: values.hasVariants === true ? values.variantLabel || 'Varian' : '',
        variants: normalizeFormVariants(values.variants || [], values.hasVariants === true),
        maxStockTarget:
          values.maxStockTarget === null || values.maxStockTarget === undefined
            ? null
            : Number(values.maxStockTarget || 0),
        referenceCostPerUnit: Number(values.referenceCostPerUnit || 0),
        lastProductionCostPerUnit: Number(
          values.lastProductionCostPerUnit || 0,
        ),
      };

      setSubmitting(true);

      if (editingMaterial?.id) {
        await updateSemiFinishedMaterial(editingMaterial.id, payload, [], null);
        message.success("Semi finished material berhasil diperbarui");
      } else {
        await createSemiFinishedMaterial(payload, [], null);
        message.success("Semi finished material berhasil ditambahkan");
      }

      setFormVisible(false);
      resetFormState();
      await loadData();
    } catch (error) {
      if (showFormValidationFeedback(error, { form })) return;

      if (error?.type === "validation" && error?.errors) {
        const fields = Object.entries(error.errors).map(([name, errors]) => ({
          name: name.startsWith("variants.") ? name.split(".") : name,
          errors: [errors],
        }));
        form.setFields(fields);
        return;
      }

      console.error(error);
      message.error("Gagal menyimpan semi finished material");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Toggle aktif/nonaktif master item.
  // Flow ini tetap dipakai aktif karena user perlu mengarsipkan item tanpa
  // menghapus histori stok atau varian yang sudah ada.
  // ---------------------------------------------------------------------------
  const handleToggleActive = async (record) => {
    const isCurrentlyActive = record.isActive !== false;

    try {
      await toggleSemiFinishedMaterialActive(record.id, !isCurrentlyActive, null);
      message.success(
        `Semi finished material berhasil ${
          isCurrentlyActive ? "dinonaktifkan" : "diaktifkan"
        }`,
      );
      await loadData();
    } catch (error) {
      console.error(error);
      message.error("Gagal mengubah status semi finished material");
    }
  };

  // ---------------------------------------------------------------------------
  // Definisi kolom list utama.
  // Tujuan utamanya membuat halaman lebih padat, rapi, dan mudah dibaca tanpa
  // harus membuka drawer detail untuk informasi stok yang paling penting.
  // ---------------------------------------------------------------------------
  const columns = [
    {
      title: "Semi Finished Material",
      dataIndex: "name",
      key: "name",
      width: "24%",
      render: (_, record) => (
        <div style={compactCellStyles.stack}>
          <Typography.Text strong>{record.name || "-"}</Typography.Text>
        </div>
      ),
    },
    {
      title: "Kategori",
      key: "category",
      width: "16%",
      render: (_, record) => (
        <div style={compactCellStyles.stack}>
          <Typography.Text>
            {SEMI_FINISHED_CATEGORY_MAP[record.category] || "-"}
          </Typography.Text>
          <Typography.Text type="secondary" style={compactCellStyles.meta}>
            {getSemiFinishedGroupLabel(record.flowerGroup, FALLBACK_SEMI_FINISHED_GROUP_LABEL)}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "Stok",
      key: "stock",
      width: "28%",
      // AKTIF / GUARDED: saldo stok master memakai helper presentational locked; flow stok/produksi tidak diubah.
      render: (_, record) => (
        <StockDisplayBlock
          record={record}
          unit={record.unit || "pcs"}
          getVariantLabel={getVariantDisplayLabel}
          className="ims-cell-stack ims-cell-stack-tight"
          metaClassName="ims-cell-meta"
          minStockThreshold={Number(record.minStockAlert || 0)}
        />
      ),
    },
    {
      title: "Status",
      key: "status",
      width: "16%",
      align: "left",
      // AKTIF / GUARDED: status tetap terlihat di primary table tanpa fixed/sticky agar tidak memaksa horizontal scroll.
      render: (_, record) => {
        const statusMeta = getStockStatusMeta(record);
        const affectedVariantText = formatAffectedVariantStockSummary(record, {
          sourceType: "semi_finished",
          threshold: Number(record.minStockAlert || 0),
          unit: record.unit || "pcs",
          getVariantLabel: getVariantDisplayLabel,
        });

        return (
          <div className="ims-cell-stack ims-cell-stack-tight">
            <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
            {affectedVariantText ? <Typography.Text className="ims-cell-caption">{affectedVariantText}</Typography.Text> : null}
          </div>
        );
      },
    },
    {
      title: "Aksi",
      key: "actions",
      width: "16%",
      // AKTIF / GUARDED: tombol aksi tetap di kolom kanan natural tanpa fixed/sticky agar primary table tidak memaksa horizontal scroll.
      className: "app-table-action-column",
      render: (_, record) => (
        <Space direction="vertical" size={6} className="ims-action-group ims-action-group--vertical">
          {/* AKTIF / GUARDED: action semi finished dibuat 3 baris visual-only; logic produksi, stok varian, PO, Work Log, payroll, dan HPP tidak disentuh. */}
          <Button
            className="ims-action-button ims-action-button--block"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            Detail
          </Button>

          <Button
            className="ims-action-button ims-action-button--block"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>

          <Popconfirm
            title={
              record.isActive !== false ? "Nonaktifkan item ini?" : "Aktifkan item ini?"
            }
            description={
              record.isActive !== false
                ? "Item tidak akan bisa dipilih untuk data baru."
                : "Item akan aktif kembali untuk data baru."
            }
            onConfirm={() => handleToggleActive(record)}
            okText="Ya"
            cancelText="Batal"
          >
            <Button className="ims-action-button ims-action-button--block" size="small">
              {record.isActive !== false ? "Nonaktifkan" : "Aktifkan"}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ---------------------------------------------------------------------------
  // State turunan khusus drawer detail.
  // Dipisah dari JSX agar render drawer lebih mudah dibaca dan tidak dipenuhi
  // perhitungan kecil yang berulang.
  // ---------------------------------------------------------------------------
  const selectedMaterialStatusMeta = selectedMaterial
    ? getStockStatusMeta(selectedMaterial)
    : null;
  const selectedMaterialVariants = Array.isArray(selectedMaterial?.variants)
    ? selectedMaterial.variants
    : [];
  const selectedMaterialUnit = selectedMaterial?.unit || "pcs";

  // =====================================================
  // SECTION: Detail drawer variant compact columns — AKTIF
  // Fungsi:
  // - Menampilkan rincian varian semi finished secara ringkas di drawer detail.
  //
  // Dipakai oleh:
  // - Drawer Detail Semi Finished Material pada halaman SemiFinishedMaterials.
  //
  // Alasan perubahan:
  // - Kolom stok, kode, status, dan cost dipadatkan agar drawer tidak perlu scroll horizontal besar tanpa mengaktifkan min stock per varian.
  //
  // Catatan cleanup:
  // - Bisa diekstrak menjadi komponen shared variant detail jika tabel detail varian dipakai ulang.
  //
  // Risiko:
  // - Jika angka current/reserved/available atau status varian disembunyikan, audit stok varian bisa tidak lengkap.
  // =====================================================
  const detailVariantColumns = [
    {
      title: selectedMaterial?.variantLabel || "Varian",
      key: "variant",
      width: 200,
      render: (_, variant, index) => (
        <div style={compactCellStyles.stack}>
          <Typography.Text strong>
            {getVariantDisplayLabel(variant, index)}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "Status",
      key: "skuStatus",
      width: 120,
      render: (_, variant) => (
        <Tag color={variant.isActive ? "green" : "default"}>
          {variant.isActive ? "Aktif" : "Nonaktif"}
        </Tag>
      ),
    },
    {
      title: "Stok",
      key: "stock",
      width: 220,
      render: (_, variant) => {
        const availableStock = Math.max(
          Number(variant.currentStock || 0) - Number(variant.reservedStock || 0),
          0,
        );

        return (
          <div style={compactCellStyles.stack}>
            <Typography.Text strong>
              Current: {formatStockWithUnit(variant.currentStock, selectedMaterialUnit)}
            </Typography.Text>
            <Typography.Text type="secondary" style={compactCellStyles.meta}>
              Available: {formatStockWithUnit(availableStock, selectedMaterialUnit)}
            </Typography.Text>
            <Typography.Text type="secondary" style={compactCellStyles.meta}>
              Reserved: {formatStockWithUnit(variant.reservedStock, selectedMaterialUnit)}
            </Typography.Text>
          </div>
        );
      },
    },
    {
      title: "Avg Cost",
      key: "averageCost",
      width: 140,
      render: (_, variant) => (
        <div style={compactCellStyles.stack}>
          <Typography.Text type="secondary" style={compactCellStyles.meta}>
            Avg: {formatCurrency(variant.averageCostPerUnit)}
          </Typography.Text>
        </div>
      ),
    },
  ];

  return (
    <div className="page-container">
      {/* ------------------------------------------------------------------ */}
      {/* Header halaman. Menjadi titik masuk utama user sebelum melihat list. */}
      {/* ------------------------------------------------------------------ */}
      {/* AKTIF / GUARDED: migrasi header ke shared produksi agar konsisten, tanpa ubah flow CRUD semi finished material. */}
      <ProductionPageHeader
        title="Semi Finished Materials"
        description="Master stok internal produksi dengan varian fleksibel, tidak dijual ke customer."
        onAdd={handleAdd}
        addLabel="Tambah Item"
      />

      {/* ------------------------------------------------------------------ */}
      {/* Summary cards. Tetap dipertahankan karena user produksi butuh ringkasan */}
      {/* cepat tanpa harus membaca seluruh tabel. */}
      {/* ------------------------------------------------------------------ */}
      {/* AKTIF / GUARDED: summary card shared menjaga konsistensi visual, nilai tetap dari helper existing. */}
      <ProductionSummaryCards items={summaryItems} />

      {/* ------------------------------------------------------------------ */}
      {/* Filter list. Dipisah di card sendiri agar user bisa scan filter dengan */}
      {/* cepat tanpa mengganggu area tabel utama. */}
      {/* ------------------------------------------------------------------ */}
      {/* AKTIF / GUARDED: filter card shared dipakai untuk keseragaman layout; behavior filter tidak diubah. */}
      <ProductionFilterCard>
          <Col xs={24} lg={7}>
            <Input
              placeholder="Cari kode, nama, deskripsi, varian..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>

          <Col xs={24} sm={12} lg={4}>
            <Select
              style={{ width: "100%" }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "Semua Status" },
                { value: "active", label: "Aktif" },
                { value: "inactive", label: "Nonaktif" },
              ]}
            />
          </Col>

          <Col xs={24} sm={12} lg={5}>
            <Select
              style={{ width: "100%" }}
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[
                { value: "all", label: "Semua Kategori" },
                ...SEMI_FINISHED_CATEGORIES,
              ]}
            />
          </Col>

          <Col xs={24} sm={12} lg={4}>
            <Select
              style={{ width: "100%" }}
              value={flowerGroupFilter}
              onChange={setFlowerGroupFilter}
              options={[
                { value: "all", label: "Semua Jenis Bunga" },
                ...flowerGroupFilterOptions,
              ]}
            />
          </Col>

          <Col xs={24} sm={12} lg={4}>
            <Select
              style={{ width: "100%" }}
              value={listViewMode}
              onChange={setListViewMode}
              options={[
                { value: "grouped", label: "Grouped" },
                { value: "global", label: "Semua Item" },
              ]}
            />
          </Col>
      </ProductionFilterCard>

      {/* ------------------------------------------------------------------ */}
      {/* Tabel list utama. Di-set compact agar jarak antar elemen tidak terlalu */}
      {/* tinggi dan informasi stok per varian tetap terbaca pada satu layar. */}
      {/* ------------------------------------------------------------------ */}
      <PageSection
        title="Daftar Semi Finished Materials"
        subtitle="Tabel ini merangkum stok master dan varian fleksibel untuk kebutuhan produksi internal."
      >
        <DataRefreshIndicator loading={loading} dataSource={filteredData} />
        {listViewMode === "global" ? (
          <Table
            // AKTIF / GUARDED UI: class standar hanya menyamakan surface table; flow semi finished material dan produksi tidak diubah.
            className="app-data-table"
            rowKey="id"
            size="small"
            tableLayout="fixed"
            columns={columns}
            dataSource={filteredData}
            // AKTIF / GUARDED: primary table memakai layout fixed tanpa horizontal scroll default; stok varian tetap tampil sebagai pill langsung di kolom Stok.
            locale={{
              emptyText: getDataTableEmptyText(loading, (
                <Empty description="Belum ada data semi finished materials" />
              )),
            }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} item`,
            }}
          />
        ) : filteredData.length === 0 ? (
          <Empty description={loading ? "Memuat data..." : "Belum ada data semi finished materials"} />
        ) : (
          <Collapse
            className="ims-production-group-collapse"
            bordered={false}
            defaultActiveKey={groupedFilteredData[0]?.key ? [groupedFilteredData[0].key] : []}
            activeKey={shouldAutoOpenSemiGroups ? groupedFilteredData.map((group) => group.key) : undefined}
            items={groupedFilteredData.map((familyGroup) => ({
              key: familyGroup.key,
              label: (
                <Space direction="vertical" size={2}>
                  <Typography.Text strong>
                    Product Family / Jenis Bunga: {familyGroup.label}
                  </Typography.Text>
                  <Space size={6} wrap>
                    <Tag>{formatNumber(familyGroup.items.length)} item</Tag>
                    <Tag color="green">Aman {formatNumber(familyGroup.statusCounts.safe)}</Tag>
                    <Tag color="red">Kosong {formatNumber(familyGroup.statusCounts.empty)}</Tag>
                    <Tag color="orange">Rendah {formatNumber(familyGroup.statusCounts.low)}</Tag>
                    {familyGroup.statusCounts.inactive > 0 ? (
                      <Tag color="default">Nonaktif {formatNumber(familyGroup.statusCounts.inactive)}</Tag>
                    ) : null}
                  </Space>
                </Space>
              ),
              children: (
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  {familyGroup.categories.map((categoryGroup) => (
                    <Card
                      key={categoryGroup.key}
                      size="small"
                      title={`${categoryGroup.label} (${formatNumber(categoryGroup.items.length)} item)`}
                    >
                      <Table
                        className="app-data-table"
                        rowKey="id"
                        size="small"
                        tableLayout="fixed"
                        columns={columns}
                        dataSource={categoryGroup.items}
                        pagination={false}
                        locale={{
                          emptyText: <Empty description="Tidak ada item pada kategori ini" />,
                        }}
                      />
                    </Card>
                  ))}
                </Space>
              ),
            }))}
          />
        )}
      </PageSection>

      {/* ------------------------------------------------------------------ */}
      {/* Drawer form create/edit. Tetap satu komponen agar logic form tidak */}
      {/* terpecah ke banyak tempat dan maintenance lebih ringan. */}
      {/* ------------------------------------------------------------------ */}
      <Drawer
        title={
          editingMaterial?.id
            ? "Edit Semi Finished Material"
            : "Tambah Semi Finished Material"
        }
        open={formVisible}
        onClose={() => {
          setFormVisible(false);
          resetFormState();
        }}
        width={860}
        destroyOnClose
        extra={
          <Space>
            <Button
              onClick={() => {
                setFormVisible(false);
                resetFormState();
              }}
            >
              Batal
            </Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
              Simpan
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={buildFormValues(DEFAULT_SEMI_FINISHED_FORM)}
        >
          <Divider orientation="left">Informasi Dasar</Divider>

          {/* =====================================================
          SECTION: Semi Finished internal code hidden from main UI — AKTIF
          Fungsi:
          - Menyembunyikan input kode utama Semi Finished dari form tambah/edit agar user fokus pada nama, kategori, varian, dan stok.

          Dipakai oleh:
          - Drawer form Semi Finished Materials dan semiFinishedMaterialsService sebagai pembuat kode internal.

          Alasan perubahan:
          - Kode SFP tetap dibuat otomatis oleh service, tetapi tidak perlu menjadi input atau preview utama di UI.

          Catatan cleanup:
          - Kode internal disimpan untuk relasi/audit teknis, tetapi tidak ditampilkan di UI operasional.

          Risiko:
          - Jangan menambahkan kembali input manual code karena dapat merusak immutability dan duplicate guard service.
          ===================================================== */}
          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item
                label="Nama Item"
                name="name"
                rules={[{ required: true, message: "Nama wajib diisi" }]}
              >
                <Input placeholder="Contoh: Kelopak Mawar Potong S" />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item label="Deskripsi" name="description">
                <Input.TextArea rows={2} placeholder="Deskripsi item..." />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Kategori"
                name="category"
                rules={[{ required: true, message: "Kategori wajib dipilih" }]}
              >
                <Select options={SEMI_FINISHED_CATEGORIES} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Jenis Bunga"
                name="flowerGroup"
                rules={[{ required: true, message: "Jenis bunga wajib dipilih" }]}
              >
                <AutoComplete
                  options={flowerGroupFormOptions}
                  placeholder="Pilih atau ketik jenis bunga..."
                  filterOption={(inputValue, option) =>
                    String(option?.label || option?.value || "")
                      .toLowerCase()
                      .includes(String(inputValue || "").toLowerCase())
                  }
                />
              </Form.Item>
            </Col>

          </Row>

          {/* IMS NOTE [GUARDED | behavior-preserving]: mode varian dikunci saat edit
              agar bucket stok produksi tidak berubah tanpa audit. */}
          <Form.Item
            label="Pakai Varian"
            name="hasVariants"
            valuePropName="checked"
            extra={isEditingMaterial
              ? canActivateVariantsForEditing
                ? 'Semi Product lama dengan stok 0 boleh mulai memakai varian. Semua varian baru tetap stok 0.'
                : 'Mode varian dikunci setelah item dibuat agar bucket stok produksi tidak berubah tanpa audit.'
              : undefined}
          >
            <Switch
              checkedChildren="Ya"
              unCheckedChildren="Tidak"
              disabled={hasVariantModeSwitchLocked}
              onChange={(checked) => {
                if (hasVariantModeSwitchLocked) return;
                if (checked) {
                  form.setFieldsValue({
                    variantLabel: form.getFieldValue('variantLabel') || 'Varian',
                    variants: normalizeFormVariants(form.getFieldValue('variants') || [], true),
                    currentStock: isEditingMaterial ? 0 : form.getFieldValue('currentStock'),
                    reservedStock: isEditingMaterial ? 0 : form.getFieldValue('reservedStock'),
                  });
                } else {
                  form.setFieldsValue({ variants: [], variantLabel: 'Varian' });
                }
              }}
            />
          </Form.Item>

          {hasVariantsValue ? (
            <Form.Item
              label="Label Varian"
              name="variantLabel"
              extra="AKTIF: label ini hanya metadata tampilan. Contoh: Warna, Ukuran, Tipe, Motif, Spesifikasi."
            >
              <Input placeholder="Contoh: Warna" />
            </Form.Item>
          ) : null}

          <Divider orientation="left">{hasVariantsValue ? "Varian & Stok" : "Stok Master"}</Divider>

          <Alert
            style={{ marginBottom: 16 }}
            type="info"
            showIcon
            message={isEditingMaterial
              ? canActivateVariantsForEditing
                ? 'Semi Product lama ini stoknya 0, jadi boleh mulai memakai varian. Stok tiap varian baru tetap 0 sampai diubah lewat Stock Adjustment/produksi/transaksi resmi.'
                : stockEditHelpText
              : hasVariantsValue
                ? "Gunakan 1 master item untuk 1 jenis komponen. Tambahkan nama varian sesuai label seperti Warna, Ukuran, Tipe, Motif, atau Spesifikasi. Total stok item dihitung otomatis dari semua varian."
                : "Item tanpa varian memakai stok awal langsung di master semi finished material."}
            description={isEditingMaterial && hasVariantsValue
              ? "Mengubah nama varian hanya mengganti label tampilan. Bucket stok/reference tetap dijaga melalui variantKey existing."
              : undefined}
          />

          {hasVariantsValue ? (
          <>
            {/* =====================================================
            SECTION: Semi Finished Variant Form Without Variant Min Stock — AKTIF
            Fungsi:
            - menampilkan varian sebagai bucket stok fisik sambil menjaga Min Stock Alert sebagai field master item.

            Dipakai oleh:
            - SemiFinishedMaterials.jsx create/edit drawer dan semiFinishedMaterialsService payload.

            Alasan perubahan:
            - `variants[].minStockAlert` adalah legacy-compat; minimum stock Semi Finished tidak lagi diisi per varian.

            Catatan cleanup:
            - field legacy varian dapat diaudit pada batch maintenance terpisah.

            Risiko:
            - input min stock per varian yang diaktifkan lagi akan membuat status Perlu Dicek tidak konsisten dengan source master.
            ===================================================== */}
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item label="Min Stock Alert Master" name="minStockAlert">
                  <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.List name="variants">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: "100%" }} size={12}>
                {fields.map((field, index) => (
                  <Card
                    key={field.key}
                    size="small"
                    title={`${variantLabelValue || 'Varian'} ${index + 1}`}
                    extra={
                      fields.length > 1 ? (
                        <Button
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          disabled={fields.length === 1}
                          onClick={() => remove(field.name)}
                        >
                          Hapus Varian
                        </Button>
                      ) : null
                    }
                  >
                    <Row gutter={16}>
                      {/* IMS NOTE [GUARDED | identity-safe]: hidden identity field
                          menjaga variantKey lama tetap terkirim saat nama varian diganti.
                          Hubungan flow: service memakai key ini untuk preserve bucket
                          stok/reference PO/Work Log. STATUS: AKTIF. */}
                      <Form.Item name={[field.name, "variantKey"]} hidden>
                        <Input />
                      </Form.Item>
                      <Col xs={24} md={8}>
                        <Form.Item
                          {...field}
                          label={`Nama ${variantLabelValue || 'Varian'}`}
                          name={[field.name, "color"]}
                          rules={[{ required: true, message: "Nama varian wajib diisi" }]}
                        >
                          <Input placeholder="Contoh: Merah, Ukuran S, Motif Polkadot" />
                        </Form.Item>
                      </Col>

                      <Form.Item {...field} name={[field.name, "sku"]} hidden>
                        <Input />
                      </Form.Item>

                      <Col xs={24} md={8}>
                        <Form.Item
                          {...field}
                          label="Status Varian"
                          name={[field.name, "isActive"]}
                          valuePropName="checked"
                        >
                          <Switch />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={8}>
                        <Form.Item
                          {...field}
                          label="Current Stock"
                          name={[field.name, "currentStock"]}
                          extra={isEditingMaterial ? stockEditHelpText : undefined}
                        >
                          <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} disabled={isEditingMaterial} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={8}>
                        <Form.Item
                          {...field}
                          label="Reserved Stock"
                          name={[field.name, "reservedStock"]}
                          extra={isEditingMaterial ? 'Reserved stock dikunci karena memengaruhi available stock.' : undefined}
                        >
                          <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} disabled />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={8}>
                        <Form.Item
                          {...field}
                          label="Average Cost / Unit"
                          name={[field.name, "averageCostPerUnit"]}
                        >
                          <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                ))}

                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => add({ ...DEFAULT_SEMI_FINISHED_VARIANT })}
                  block
                >
                  Tambah Varian
                </Button>
              </Space>
            )}
          </Form.List>
          </>
          ) : (
            <Row gutter={16}>
              <Col xs={24} md={6}>
                <Form.Item label="Current Stock" name="currentStock" extra={isEditingMaterial ? stockEditHelpText : undefined}>
                  <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} disabled={isEditingMaterial} />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item label="Reserved Stock" name="reservedStock" extra={isEditingMaterial ? 'Reserved stock dikunci karena memengaruhi available stock.' : undefined}>
                  <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} disabled={isEditingMaterial} />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item label="Min Stock Alert" name="minStockAlert">
                  <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item label="Average Cost / Unit" name="averageCostPerUnit">
                  <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
            </Row>
          )}

          <Divider orientation="left">Ringkasan Stok Master</Divider>

          {/* =====================================================
          SECTION: Semi Finished Master Stock Summary — AKTIF
          Fungsi:
          - menampilkan current/reserved/available total dari varian dan Min Stock Alert dari field master item.

          Dipakai oleh:
          - SemiFinishedMaterials.jsx form summary sebelum create/edit disimpan.

          Alasan perubahan:
          - ringkasan lama menyebut Min Stock Alert sebagai akumulasi varian, padahal rule final memakai master `minStockAlert`.

          Catatan cleanup:
          - belum ada.

          Risiko:
          - wording/perhitungan yang kembali ke total varian akan membingungkan validasi low stock Semi Finished.
          ===================================================== */}
          <div className="ims-readonly-panel">
            <div className="ims-readonly-panel-header">
              <div>
                <div className="ims-readonly-panel-title">
                  Ringkasan Stok Master
                </div>
                <div className="ims-readonly-panel-description">
                  {hasVariantsValue
                    ? "Current Stock, Reserved Stock, dan Available Stock adalah total varian. Min Stock Alert tetap satu angka master item."
                    : "Ringkasan di bawah ini adalah nilai stok master langsung karena item ini tidak memakai varian."}
                </div>
              </div>
              <Tag color={hasVariantsValue ? "purple" : "default"}>
                {hasVariantsValue ? "Stok Varian + Min Master" : "Master"}
              </Tag>
            </div>
          </div>

          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item label="Total Current Stock">
                <Input value={formatNumber(calculatedTotals.currentStock)} disabled />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Total Reserved Stock">
                <Input value={formatNumber(calculatedTotals.reservedStock)} disabled />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Total Available Stock">
                <Input value={formatNumber(calculatedTotals.availableStock)} disabled />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Min Stock Alert Master">
                <Input value={formatNumber(calculatedTotals.minStockAlert)} disabled />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Max Stock Target" name="maxStockTarget">
                <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Status Aktif"
                name="isActive"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Jumlah Varian Aktif">
                <Input
                  value={`${formatNumber(calculatedTotals.activeVariantCount)} dari ${formatNumber(calculatedTotals.variantCount)} varian`}
                  disabled
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Biaya Master</Divider>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="Reference Cost / Unit"
                name="referenceCostPerUnit"
              >
                <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Last Production Cost / Unit"
                name="lastProductionCostPerUnit"
              >
                <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Average Cost / Unit (Otomatis)">
                <Input value={formatCurrency(calculatedTotals.averageCostPerUnit)} disabled />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Ringkasan">
                <Card size="small">
                  <Space direction="vertical" size={0}>
                    <Typography.Text>
                      {formatSemiFinishedStockSummary(calculatedTotals)}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      Average Cost: {formatCurrency(calculatedTotals.averageCostPerUnit)}
                    </Typography.Text>
                  </Space>
                </Card>
              </Form.Item>
            </Col>
          </Row>

        </Form>
      </Drawer>

      {/* ------------------------------------------------------------------ */}
      {/* Drawer detail. Dipakai aktif untuk audit item, stok total, dan rincian */}
      {/* varian tanpa menambah kepadatan informasi pada list utama. */}
      {/* ------------------------------------------------------------------ */}
      <Drawer
        title="Detail Semi Finished Material"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={900}
      >
        {!selectedMaterial ? (
          <Empty description="Tidak ada data" />
        ) : (
          <Space direction="vertical" style={{ width: "100%" }} size={16}>
            {/*
=====================================================
SECTION: Detail drawer semi finished material — GUARDED
Fungsi:
- Menampilkan status stok, biaya per unit, varian, dan metadata item semi finished secara read-only.

Dipakai oleh:
- Halaman SemiFinishedMaterials untuk audit master stok internal produksi.

Alasan perubahan:
- Detail dipisah menjadi metric, ringkasan, stok/biaya, varian, dan info tambahan tanpa mengubah kalkulasi stok/HPP.

Catatan cleanup:
- Data optional tetap dipindah ke Collapse; mapping varian dan field biaya tidak diubah.

Risiko:
- Jika current/available/reserved stock atau average cost salah dirender, HPP produk jadi bisa salah dibaca user.
=====================================================
*/}
            <Alert
              type={selectedMaterialStatusMeta?.alertType || "info"}
              showIcon
              message={`Status item: ${selectedMaterialStatusMeta?.label || "-"}`}
              description={
                selectedMaterial.isActive !== false
                  ? `Total stok ${formatStockWithUnit(
                      selectedMaterial.currentStock,
                      selectedMaterialUnit,
                    )} dengan stok tersedia ${formatStockWithUnit(
                      selectedMaterial.availableStock,
                      selectedMaterialUnit,
                    )}.`
                  : "Item nonaktif. Histori stok dan varian tetap tersimpan."
              }
            />

            <Row gutter={[12, 12]}>
              <Col xs={24} sm={12} md={8}>
                <Card size="small">
                  <Statistic
                    title="Total Stok"
                    value={formatStockWithUnit(
                      selectedMaterial.currentStock,
                      selectedMaterialUnit,
                    )}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Card size="small">
                  <Statistic
                    title="Stok Tersedia"
                    value={formatStockWithUnit(
                      selectedMaterial.availableStock,
                      selectedMaterialUnit,
                    )}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Card size="small">
                  <Statistic
                    title="Average Cost"
                    value={formatCurrency(selectedMaterial.averageCostPerUnit)}
                  />
                </Card>
              </Col>
            </Row>

            <Card size="small" title="Ringkasan Item">
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="Nama">{selectedMaterial.name || "-"}</Descriptions.Item>
                <Descriptions.Item label="Kategori">
                  {SEMI_FINISHED_CATEGORY_MAP[selectedMaterial.category] || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Jenis Bunga">
                  {getSemiFinishedGroupLabel(selectedMaterial.flowerGroup, FALLBACK_SEMI_FINISHED_GROUP_LABEL)}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={selectedMaterialStatusMeta?.color || "default"}>
                    {selectedMaterialStatusMeta?.label || "-"}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="Stok & Biaya">
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="Reserved Stock">
                  {formatStockWithUnit(selectedMaterial.reservedStock, selectedMaterialUnit)}
                </Descriptions.Item>
                <Descriptions.Item label="Min Stock Alert">
                  {formatStockWithUnit(selectedMaterial.minStockAlert, selectedMaterialUnit)}
                </Descriptions.Item>
                <Descriptions.Item label="Reference Cost / Unit">
                  {formatCurrency(selectedMaterial.referenceCostPerUnit)}
                </Descriptions.Item>
                <Descriptions.Item label="Last Production Cost / Unit">
                  {formatCurrency(selectedMaterial.lastProductionCostPerUnit)}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="Rincian Varian Semi Finished" size="small">
              <Table
                size="small"
                rowKey={(record, index) => `${record.variantKey || record.color}-${index}`}
                pagination={false}
                dataSource={selectedMaterialVariants}
                locale={{ emptyText: "Belum ada varian" }}
                columns={detailVariantColumns}
                tableLayout="fixed"
                scroll={{ x: 720 }}
              />
            </Card>

            <Collapse
              ghost
              items={[
                {
                  key: "additional",
                  label: "Info Tambahan",
                  children: (
                    <Descriptions column={1} bordered size="small">
                      <Descriptions.Item label="Deskripsi">
                        {selectedMaterial.description || "-"}
                      </Descriptions.Item>
                      <Descriptions.Item label={selectedMaterial.variantLabel || "Varian Aktif"}>
                        {formatNumber(selectedMaterial.activeVariantCount)} / {formatNumber(
                          selectedMaterial.variantCount,
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item label="Max Stock Target">
                        {selectedMaterial.maxStockTarget === null
                          ? "-"
                          : formatStockWithUnit(
                              selectedMaterial.maxStockTarget,
                              selectedMaterialUnit,
                            )}
                      </Descriptions.Item>
                    </Descriptions>
                  ),
                },
              ]}
            />
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default SemiFinishedMaterials;
