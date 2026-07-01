// =====================================================
// Page: Semi Finished Materials
// Master stok internal produksi
// Tidak dijual ke customer
// Revisi:
// - Master item tetap ringkas
// - Stok disimpan per varian fleksibel
// - Total master dihitung otomatis dari seluruh varian
// =====================================================

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  App as AntdApp,
  Col,
  Form,
  Input,
  Select,
  Typography,
} from "antd";
import { EditOutlined, EyeOutlined } from "@ant-design/icons";
import {
  calculateSemiFinishedTotalsFromVariants,
  DEFAULT_SEMI_FINISHED_FORM,
  SEMI_FINISHED_CATEGORIES,
  SEMI_FINISHED_CATEGORY_MAP,
} from "../../constants/semiFinishedMaterialOptions";
import {
  createSemiFinishedMaterial,
  getAllSemiFinishedMaterials,
  toggleSemiFinishedMaterialActive,
  updateSemiFinishedMaterial,
} from "../../services/Produksi/semiFinishedMaterialsService";
import { formatHppUnitCurrencyId } from "../../utils/formatters/currencyId";
import ProductionFilterCard from "../../components/Produksi/shared/ProductionFilterCard";
import ProductionPageHeader from "../../components/Produksi/shared/ProductionPageHeader";
import PageContentCanvas from "../../components/Layout/Page/PageContentCanvas";
import PageSection from "../../components/Layout/Page/PageSection";
import ProductionSummaryCards from "../../components/Produksi/shared/ProductionSummaryCards";
import StockDisplayBlock from "../../components/Layout/Table/StockDisplayBlock";
import StatusTag from "../../components/Layout/Feedback/StatusTag";
import TableActionMenu from "../../components/Layout/Table/TableActionMenu";
import InfoPopoverButton from "../../components/Layout/Feedback/InfoPopoverButton";
import { listCategories } from "../../data/repositories/categoriesRepository";
import { CATEGORY_TYPES } from "../../constants/categoryOptions";
import {
  buildCategorySelectOptions,
  resolveCategoryLabel,
} from "../../utils/categories/categoryHelpers";
import SemiFinishedMaterialsListView from "./components/SemiFinishedMaterialsListView";
import SemiFinishedMaterialDetailDrawer from "./components/SemiFinishedMaterialDetailDrawer";
import SemiFinishedMaterialFormDrawer from "./components/SemiFinishedMaterialFormDrawer";
import { showFormValidationFeedback } from '../../utils/forms/formValidationFeedback';
import { isVariantStockEmpty } from '../../utils/variants/variantArchiveHelpers';
import {
  buildFormValues,
  buildSemiFinishedGroupOptions,
  compactCellStyles,
  FALLBACK_SEMI_FINISHED_GROUP_KEY,
  FALLBACK_SEMI_FINISHED_GROUP_LABEL,
  formatStockWithUnit,
  getStockStatusMeta,
  getVariantDisplayLabel,
  normalizeFormVariants,
  normalizeSemiFinishedGroupKey,
  resolveFlowerComponentRecipeMeta,
  resolveSemiFinishedActiveHppCost,
} from "./helpers/semiFinishedMaterialsPageHelpers";

// =====================================================
// Formatter final lintas aplikasi
// ACTIVE / FINAL: master semi finished memakai helper shared untuk qty dan Rupiah.
// =====================================================

// IMS NOTE [AKTIF/GUARDED] - Standar input angka bulat
// Fungsi blok: mengarahkan InputNumber aktif ke step 1, precision 0, dan parser integer Indonesia.
// Hubungan flow: hanya membatasi input/display UI; service calculation stok, kas, HPP, payroll, dan report tidak diubah.
// Alasan logic: IMS operasional memakai angka tanpa desimal, sementara data historis decimal tidak dimigrasi otomatis.
// Behavior: input baru no-decimal; business rules dan schema/alur data utama tetap sama.

const SemiFinishedMaterials = () => {
  const { message } = AntdApp.useApp();
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [flowerTypes, setFlowerTypes] = useState([]);
  const [componentGroups, setComponentGroups] = useState([]);

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
  const isGuardedVariantStock = (fieldName) => {
    if (!isEditingMaterial) return false;
    const variant = form.getFieldValue(['variants', fieldName]) || {};
    return Boolean(variant.variantKey) && !isVariantStockEmpty(variant);
  };
  const stockEditHelpText = 'Ubah stok lewat Stock Management / Stock Adjustment / transaksi resmi.';
  const flowerTypeSelectOptions = useMemo(() => {
    const masterOptions = buildCategorySelectOptions(flowerTypes, CATEGORY_TYPES.FLOWER_TYPE);
    const masterLabels = new Set(masterOptions.map((option) => String(option.label || '').toLowerCase()));
    const legacyOptions = materials
      .filter((item) => !item.flowerTypeId && item.flowerGroup)
      .map((item) => String(item.flowerGroup || '').trim())
      .filter((label, index, rows) => label && rows.indexOf(label) === index)
      .filter((label) => !masterLabels.has(label.toLowerCase()))
      .map((label) => ({ value: `legacy:${label}`, label: `${label} (data lama)` }));
    return [...masterOptions, ...legacyOptions];
  }, [flowerTypes, materials]);
  const componentGroupSelectOptions = useMemo(() => {
    const masterOptions = buildCategorySelectOptions(
      componentGroups,
      CATEGORY_TYPES.SEMI_FINISHED_GROUP,
    );
    const masterLabels = new Set(masterOptions.map((option) => String(option.label || '').toLowerCase()));
    const legacyOptions = materials
      .filter((item) => !item.categoryId && (item.componentGroup || item.componentGroupName))
      .map((item) => String(item.componentGroup || item.componentGroupName || '').trim())
      .filter((label, index, rows) => label && rows.indexOf(label) === index)
      .filter((label) => !masterLabels.has(label.toLowerCase()))
      .map((label) => ({ value: `legacy:${label}`, label: `${label} (data lama)` }));
    return [...masterOptions, ...legacyOptions];
  }, [componentGroups, materials]);
  const flowerGroupFilterOptions = useMemo(
    () => buildSemiFinishedGroupOptions(materials, { includeGeneral: true }),
    [materials],
  );
  const resolveFlowerTypeLabel = useCallback((record = {}) => resolveCategoryLabel({
    categoryId: record.flowerTypeId,
    categories: flowerTypes,
    fallback: record.flowerType || record.flowerTypeName || record.flowerGroup,
    emptyLabel: FALLBACK_SEMI_FINISHED_GROUP_LABEL,
  }), [flowerTypes]);
  const resolveComponentGroupLabel = useCallback((record = {}) => resolveCategoryLabel({
    categoryId: record.categoryId,
    categories: componentGroups,
    fallback: record.componentGroup || record.componentGroupName,
    emptyLabel: '',
  }), [componentGroups]);

  // ---------------------------------------------------------------------------
  // Loader utama halaman.
  // Semua data list di-refresh dari service yang sama agar source of truth tetap
  // satu pintu dan lebih mudah dilacak saat maintenance.
  // ---------------------------------------------------------------------------
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [result, flowerTypeRows, componentGroupRows] = await Promise.all([
        getAllSemiFinishedMaterials(),
        listCategories({ type: CATEGORY_TYPES.FLOWER_TYPE }),
        listCategories({ type: CATEGORY_TYPES.SEMI_FINISHED_GROUP }),
      ]);
      setMaterials(result);
      setFlowerTypes(flowerTypeRows);
      setComponentGroups(componentGroupRows);
    } catch (error) {
      console.error(error);
      message.error("Gagal memuat data semi finished materials");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
        resolveFlowerTypeLabel(item).toLowerCase().includes(searchText) ||
        resolveComponentGroupLabel(item).toLowerCase().includes(searchText) ||
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
  }, [materials, search, statusFilter, categoryFilter, flowerGroupFilter, resolveFlowerTypeLabel, resolveComponentGroupLabel]);

  /* =====================================================
  SECTION: Semi Finished grouped listing — AKTIF
  Fungsi:
  - Mengelompokkan list Semi Product secara read-only berdasarkan Product Family / Jenis Bunga lalu kategori.

  Dipakai oleh:
  - Halaman SemiFinishedMaterials untuk mode tampilan grouped tanpa mengubah service, payload, stok, atau schema/alur data utama.

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
      const familyLabel = resolveFlowerTypeLabel(item);

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
  }, [filteredData, resolveFlowerTypeLabel]);

  const shouldAutoOpenSemiGroups = Boolean(search.trim()) || statusFilter !== "all" || categoryFilter !== "all" || flowerGroupFilter !== "all";

  // ---------------------------------------------------------------------------
  // Helper reset form agar state create/edit tidak saling tercampur.
  // ---------------------------------------------------------------------------
  const resetFormState = () => {
    setEditingMaterial(null);
    form.resetFields();
    form.setFieldsValue(buildFormValues(DEFAULT_SEMI_FINISHED_FORM));
  };

  const closeFormDrawer = () => {
    setFormVisible(false);
    resetFormState();
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
    form.setFieldsValue({
      ...buildFormValues(record),
      flowerTypeId: record.flowerTypeId
        || (record.flowerGroup ? `legacy:${record.flowerGroup}` : ''),
      categoryId: record.categoryId
        || ((record.componentGroup || record.componentGroupName)
          ? `legacy:${record.componentGroup || record.componentGroupName}`
          : ''),
    });
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
        await updateSemiFinishedMaterial(
          editingMaterial.id,
          payload,
          flowerTypes,
          componentGroups,
          { expectedVersion: editingMaterial.versionToken || editingMaterial.updatedAt || '' },
        );
        message.success("Semi finished material berhasil diperbarui");
      } else {
        await createSemiFinishedMaterial(payload, flowerTypes, componentGroups);
        message.success("Semi finished material berhasil ditambahkan");
      }

      closeFormDrawer();
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
      message.error(error?.message || "Gagal menyimpan semi finished material");
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
      await toggleSemiFinishedMaterialActive(record.id, !isCurrentlyActive);
      message.success(
        `Semi finished material berhasil ${
          isCurrentlyActive ? "dinonaktifkan" : "diaktifkan"
        }`,
      );
      await loadData();
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal mengubah status semi finished material");
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
      width: "22%",
      render: (_, record) => (
        <div style={compactCellStyles.stack}>
          <Typography.Text strong>{record.name || "-"}</Typography.Text>
        </div>
      ),
    },
    {
      title: "Klasifikasi",
      key: "category",
      width: "14%",
      render: (_, record) => (
        <div style={compactCellStyles.stack}>
          <Typography.Text>
            {SEMI_FINISHED_CATEGORY_MAP[record.category] || "-"}
          </Typography.Text>
          <Typography.Text type="secondary" style={compactCellStyles.meta}>
            {resolveFlowerTypeLabel(record)}
          </Typography.Text>
          {resolveComponentGroupLabel(record) ? (
            <Typography.Text type="secondary" style={compactCellStyles.meta}>
              {resolveComponentGroupLabel(record)}
            </Typography.Text>
          ) : null}
        </div>
      ),
    },
    {
      title: "Stok",
      key: "stock",
      width: "26%",
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
      title: "Modal/HPP",
      key: "activeHpp",
      width: "14%",
      // ACTIVE / UI-ONLY: tampilkan cost paling penting di table utama agar tidak kalah oleh teks status berulang.
      render: (_, record) => (
        <div className="ims-cell-stack ims-cell-stack-tight">
          <Typography.Text strong>{formatHppUnitCurrencyId(resolveSemiFinishedActiveHppCost(record))}</Typography.Text>
          <Typography.Text type="secondary" className="ims-cell-meta">/{record.unit || "pcs"}</Typography.Text>
        </div>
      ),
    },
    {
      title: "Status",
      key: "status",
      width: "10%",
      align: "left",
      // AKTIF / GUARDED: tabel utama hanya menampilkan tag status ringkas; detail varian tetap ada di kolom stok/drawer.
      render: (_, record) => {
        const statusMeta = getStockStatusMeta(record);

        return (
          <div className="ims-cell-stack ims-cell-stack-tight">
            <StatusTag color={statusMeta.color}>{statusMeta.label}</StatusTag>
          </div>
        );
      },
    },
    {
      title: "Aksi",
      key: "actions",
      width: 132,
      // AKTIF / GUARDED: aksi utama tetap terlihat, aksi sekunder dipindahkan ke menu compact.
      className: "app-table-action-column",
      render: (_, record) => (
        <TableActionMenu
          visibleActions={[
            {
              key: "detail",
              label: "Detail",
              icon: <EyeOutlined />,
              onClick: () => handleViewDetail(record),
            },
          ]}
          moreActions={[
            {
              key: "edit",
              label: "Edit",
              icon: <EditOutlined />,
              onClick: () => handleEdit(record),
            },
            {
              key: "toggle",
              label: record.isActive !== false ? "Nonaktifkan" : "Aktifkan",
              danger: record.isActive !== false,
              confirm: {
                title: record.isActive !== false ? "Nonaktifkan item ini?" : "Aktifkan item ini?",
                description: record.isActive !== false
                  ? "Item tidak akan bisa dipilih untuk data baru."
                  : "Item akan aktif kembali untuk data baru.",
                okText: "Ya",
                cancelText: "Batal",
              },
              onClick: () => handleToggleActive(record),
            },
          ]}
        />
      ),
    },
  ];

  // IMS NOTE [AKTIF/GUARDED UI] - Mobile card Semi Finished Material.
  // Fungsi: membuat stok semi finished dan varian utama terbaca di HP tanpa tabel geser.
  // Guardrail: hanya presentasi; stok varian, HPP aktif, PO, Work Log, payroll, dan service produksi tidak diubah.
  const semiFinishedMobileCardConfig = {
    title: (record) => record.name || "-",
    subtitle: (record) => [
      SEMI_FINISHED_CATEGORY_MAP[record.category] || "Jenis komponen belum tercatat",
      resolveFlowerTypeLabel(record),
      resolveComponentGroupLabel(record),
    ].filter(Boolean),
    tags: (record) => {
      const statusMeta = getStockStatusMeta(record);

      return [
        <StatusTag key="status" color={statusMeta.color}>{statusMeta.label}</StatusTag>,
        record.isActive === false ? <StatusTag key="inactive" tone="neutral">Nonaktif</StatusTag> : null,
      ].filter(Boolean);
    },
    meta: [
      {
        label: "Stok",
        value: (record) => formatStockWithUnit(record.currentStock || 0, record.unit || "pcs"),
      },
      {
        label: "Available",
        value: (record) => formatStockWithUnit(record.availableStock ?? record.currentStock ?? 0, record.unit || "pcs"),
      },
      {
        label: "Modal/HPP",
        value: (record) => `${formatHppUnitCurrencyId(resolveSemiFinishedActiveHppCost(record))} / ${record.unit || "pcs"}`,
      },
    ],
    content: (record) => (
      <StockDisplayBlock
        record={record}
        unit={record.unit || "pcs"}
        getVariantLabel={getVariantDisplayLabel}
        className="ims-cell-stack ims-cell-stack-tight"
        metaClassName="ims-cell-meta"
        minStockThreshold={Number(record.minStockAlert || 0)}
      />
    ),
    primaryActions: (record) => [
      {
        key: "detail",
        label: "Detail",
        icon: <EyeOutlined />,
        onClick: () => handleViewDetail(record),
      },
    ],
    moreActions: (record) => [
      {
        key: "edit",
        label: "Edit",
        icon: <EditOutlined />,
        onClick: () => handleEdit(record),
      },
      {
        key: "toggle",
        label: record.isActive !== false ? "Nonaktifkan" : "Aktifkan",
        danger: record.isActive !== false,
        confirm: {
          title: record.isActive !== false ? "Nonaktifkan item ini?" : "Aktifkan item ini?",
          description: record.isActive !== false
            ? "Item tidak akan bisa dipilih untuk data baru."
            : "Item akan aktif kembali untuk data baru.",
          okText: "Ya",
          cancelText: "Batal",
        },
        onClick: () => handleToggleActive(record),
      },
    ],
  };

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
  const selectedMaterialHasVariants = selectedMaterial?.hasVariants === true
    || selectedMaterialVariants.length > 0;
  const selectedMaterialVariantCostTotals = selectedMaterialHasVariants
    ? calculateSemiFinishedTotalsFromVariants(selectedMaterialVariants)
    : null;
  // ACTIVE / UI READ-MODEL: detail Semi Product menampilkan modal/HPP aktif
  // yang sama dengan rule BOM: master/varian average cost dulu, lalu fallback
  // ke last production cost. Ini menghindari kasus varian kosong ikut membagi
  // cost sehingga summary terlihat Rp 3 padahal varian produksi terakhir Rp 19.
  const selectedMaterialAverageCost = selectedMaterialHasVariants
    ? Number(
        selectedMaterialVariantCostTotals?.averageCostPerUnit
        || selectedMaterial.averageCostPerUnit
        || selectedMaterial.lastProductionCostPerUnit
        || 0,
      )
    : Number(selectedMaterial?.averageCostPerUnit || selectedMaterial?.lastProductionCostPerUnit || 0);
  const selectedMaterialCostSourceLabel = selectedMaterialHasVariants
    ? Number(selectedMaterialVariantCostTotals?.averageCostPerUnit || 0) > 0
      ? "Sumber: rata-rata varian aktif"
      : Number(selectedMaterial?.lastProductionCostPerUnit || 0) > 0
        ? "Sumber: last production cost"
        : "Sumber: master cost"
    : Number(selectedMaterial?.averageCostPerUnit || 0) > 0
      ? "Sumber: master cost"
      : Number(selectedMaterial?.lastProductionCostPerUnit || 0) > 0
        ? "Sumber: last production cost"
        : "Sumber: belum ada cost";
  const selectedMaterialRecipeMeta = selectedMaterial
    ? resolveFlowerComponentRecipeMeta(selectedMaterial)
    : null;
  const selectedMaterialRecipeCost = selectedMaterialRecipeMeta
    ? selectedMaterialAverageCost * selectedMaterialRecipeMeta.qty
    : 0;

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
        <StatusTag tone={variant.isActive ? "success" : "neutral"}>
          {variant.isActive ? "Aktif" : "Nonaktif"}
        </StatusTag>
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
            Avg: {formatHppUnitCurrencyId(variant.averageCostPerUnit)}
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
        title="Komponen Produksi"
        description="Master semi finished untuk stok internal produksi, dengan jenis komponen dan kelompok yang terpisah."
        onAdd={handleAdd}
        addLabel="Tambah Item"
      />

      <PageContentCanvas>

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
                { value: "all", label: "Semua Jenis Komponen" },
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
        extra={(
          <InfoPopoverButton
            label="Aturan Stok"
            title="Aturan stok semi finished"
            description="Semi Finished adalah stok internal produksi. Stok master dapat diringkas dari varian fleksibel untuk kebutuhan produksi internal."
            items={[
              { label: 'Internal', value: 'Tidak dijual langsung ke customer.' },
              { label: 'Varian', value: 'Dipakai jika turunan stok perlu dilacak.' },
              { label: 'Produksi', value: 'Mutasi tetap lewat flow produksi/stok resmi.' },
            ]}
          />
        )}
      >
        <SemiFinishedMaterialsListView
          loading={loading}
          filteredData={filteredData}
          listViewMode={listViewMode}
          columns={columns}
          mobileCardConfig={semiFinishedMobileCardConfig}
          groupedFilteredData={groupedFilteredData}
          shouldAutoOpenSemiGroups={shouldAutoOpenSemiGroups}
        />
      </PageSection>

      {/* ------------------------------------------------------------------ */}
      {/* Drawer form create/edit. Tetap satu komponen agar logic form tidak */}
      {/* terpecah ke banyak tempat dan maintenance lebih ringan. */}
      {/* ------------------------------------------------------------------ */}
      </PageContentCanvas>

<SemiFinishedMaterialFormDrawer
        formState={{ form, formVisible, submitting }}
        entityState={{ editingMaterial, isEditingMaterial }}
        optionData={{ componentGroupSelectOptions, flowerTypeSelectOptions }}
        variantState={{
          canActivateVariantsForEditing,
          hasVariantModeSwitchLocked,
          hasVariantsValue,
          isGuardedVariantStock,
          variantLabelValue,
        }}
        summaryState={{ calculatedTotals, stockEditHelpText }}
        actions={{ closeFormDrawer, handleSubmit }}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Drawer detail. Dipakai aktif untuk audit item, stok total, dan rincian */}
      {/* varian tanpa menambah kepadatan informasi pada list utama. */}
      {/* ------------------------------------------------------------------ */}
<SemiFinishedMaterialDetailDrawer
        drawerState={{ detailVisible, selectedMaterial }}
        materialState={{
          selectedMaterialAverageCost,
          selectedMaterialCostSourceLabel,
          selectedMaterialRecipeCost,
          selectedMaterialRecipeMeta,
          selectedMaterialStatusMeta,
          selectedMaterialUnit,
          selectedMaterialVariants,
        }}
        helpers={{
          detailVariantColumns,
          resolveComponentGroupLabel,
          resolveFlowerTypeLabel,
        }}
        onClose={() => setDetailVisible(false)}
      />
    </div>
  );
};

export default SemiFinishedMaterials;
