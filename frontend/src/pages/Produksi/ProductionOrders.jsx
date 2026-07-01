// =====================================================
// Page: Production Orders
// Support:
// - targetType = semi_finished_material
// - targetType = product
// Fungsi:
// - planning produksi
// - shortage check
// - flow aktif: BOM -> PO -> Mulai Produksi -> Work Log -> Complete
// - reserve/release lama dipensiunkan dari UI utama
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
} from "antd";
import { toReferenceOptions } from "../../utils/produksi/productionReferenceHelpers";
import {
  buildCountSummary,
  createKeywordMatcher,
  matchFieldValue,
} from "../../utils/produksi/productionPageHelpers";
import ProductionFilterCard from "../../components/Produksi/shared/ProductionFilterCard";
import ProductionPageHeader from "../../components/Produksi/shared/ProductionPageHeader";
import PageContentCanvas from "../../components/Layout/Page/PageContentCanvas";
import PageSection from "../../components/Layout/Page/PageSection";
import DataTableView from "../../components/Layout/Table/DataTableView";
import ProductionSummaryCards from "../../components/Produksi/shared/ProductionSummaryCards";
import formatNumber from "../../utils/formatters/numberId";
import {
  buildProductionOrderRequirementLines,
  createProductionOrder,
  generateProductionOrderCode,
  getActiveProductionBomOptions,
  getAllProductionOrders,
  getProductionOrderTargetVariantOptions,
  refreshProductionOrderRequirements,
} from "../../services/Produksi/productionOrdersService";
import { createProductionWorkLogFromOrder } from "../../services/Produksi/productionWorkLogsService";
import { getActiveBomReferenceData } from "../../services/Produksi/productionBomsService";
import useAuth from "../../hooks/useAuth";
import ProductionOrderDetailDrawer from "./components/ProductionOrderDetailDrawer";
import ProductionOrderFormDrawer from "./components/ProductionOrderFormDrawer";
import { buildDisplayReferenceSearchText } from "../../utils/references/displayReferenceResolver";
import {
  createProductionOrderColumns,
  createProductionOrderDetailRequirementColumns,
  createProductionOrderMobileCardConfig,
  getProductionTargetDisplayLabel,
  getRecipeDisplayLabel,
  PRODUCTION_ORDER_TARGET_TYPES,
  resolveSemiProductionGroupMeta,
} from "./helpers/productionOrdersPageHelpers";

// IMS NOTE [AKTIF/GUARDED] - Standar input angka bulat
// Fungsi blok: mengarahkan InputNumber aktif ke step 1, precision 0, dan parser integer Indonesia.
// Hubungan flow: hanya membatasi input/display UI; service calculation stok, kas, HPP, payroll, dan report tidak diubah.
// Alasan logic: IMS operasional memakai angka tanpa desimal, sementara data historis decimal tidak dimigrasi otomatis.
// Behavior: input baru no-decimal; business rules dan schema/alur data utama tetap sama.

const ProductionOrders = () => {
  const { message } = AntdApp.useApp();
  const { profile, authUser } = useAuth();

  // =====================================================
  // IMS NOTE [AKTIF/GUARDED] - Actor audit Start Production dari PO.
  // Fungsi blok: mengirim user login ke service pembuatan Work Log agar metadata audit tidak jatuh ke "system".
  // Hubungan flow: hanya actor metadata; tidak mengubah requirement material, posting stok, PO lifecycle, payroll, atau HPP.
  // Alasan logic: Start Production dari halaman PO adalah jalur resmi yang membuat Work Log dan memotong material.
  // =====================================================
  const currentUser = useMemo(() => ({
    email: profile?.email || authUser?.email || "",
    displayName: profile?.displayName || profile?.name || authUser?.displayName || "",
    uid: profile?.authUid || profile?.uid || profile?.id || authUser?.uid || "",
  }), [authUser, profile]);

  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [bomOptions, setBomOptions] = useState([]);
  const [semiFinishedReferences, setSemiFinishedReferences] = useState([]);
  const [selectedProductionTargetKey, setSelectedProductionTargetKey] = useState("");
  const [semiFamilyFilter, setSemiFamilyFilter] = useState("");
  const [semiCategoryFilter, setSemiCategoryFilter] = useState("all");
  const [bomLoading, setBomLoading] = useState(false);
  const [targetVariantOptions, setTargetVariantOptions] = useState([]);
  const [requirementPreview, setRequirementPreview] = useState(null);
  const [requirementPreviewLoading, setRequirementPreviewLoading] = useState(false);
  const [requirementPreviewError, setRequirementPreviewError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [targetTypeFilter, setTargetTypeFilter] = useState("all");

  const [formVisible, setFormVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [, setCodeLoading] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState(null);

  const [form] = Form.useForm();

  const targetTypeValue = Form.useWatch("targetType", form);
  const bomIdValue = Form.useWatch("bomId", form);
  const orderQtyValue = Form.useWatch("orderQty", form);
  const targetVariantKeyValue = Form.useWatch("targetVariantKey", form);
  const targetVariantLabelValue = Form.useWatch("targetVariantLabel", form);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getAllProductionOrders();
      setOrders(result);
    } catch (error) {
      console.error(error);
      message.error("Gagal memuat production orders");
    } finally {
      setLoading(false);
    }
  }, [message]);

  // =====================================================
  // Muat opsi BOM aktif untuk dropdown PO
  // Catatan maintainability:
  // - Dipanggil ulang saat buka form, ganti target type, fokus dropdown, dan buka dropdown
  // - Tujuannya agar BOM aktif terbaru selalu dipakai oleh menu PO
  // =====================================================
  const loadBomOptions = useCallback(async (targetType = "product") => {
    try {
      setBomLoading(true);
      const result = await getActiveProductionBomOptions(targetType);
      setBomOptions(toReferenceOptions(result || []));
    } catch (error) {
      console.error(error);
      setBomOptions([]);
      message.error("Gagal memuat BOM aktif");
    } finally {
      setBomLoading(false);
    }
  }, [message]);

  /* =====================================================
  SECTION: Semi Finished reference loader — GUARDED
  Fungsi:
  - Memuat referensi semi finished untuk grouping target PO tanpa mengubah flow BOM/PO.

  Dipakai oleh:
  - Drawer Buat Production Order, filter family/category, dan dropdown target semi finished.

  Alasan perubahan:
  - Stabilkan function dengan useCallback agar effect targetType tidak memakai closure lama dan tidak memicu warning dependency.

  Risiko:
  - Jangan ubah cache guard/data source di sini karena pilihan semi finished PO bergantung pada reference data BOM aktif.
  ===================================================== */
  const loadSemiFinishedReferences = useCallback(async () => {
    if (semiFinishedReferences.length > 0) return;

    try {
      const referenceData = await getActiveBomReferenceData();
      setSemiFinishedReferences(referenceData?.semiFinishedMaterials || []);
    } catch (error) {
      console.error(error);
      setSemiFinishedReferences([]);
    }
  }, [semiFinishedReferences.length]);

  const loadGeneratedCode = async (targetType = "product") => {
    try {
      setCodeLoading(true);
      const nextCode = await generateProductionOrderCode(targetType);
      form.setFieldValue("code", nextCode || "");
    } catch (error) {
      console.error(error);
      form.setFieldValue("code", "");
    } finally {
      setCodeLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (targetTypeValue) {
      loadBomOptions(targetTypeValue);
      if (targetTypeValue === "semi_finished_material") {
        loadSemiFinishedReferences();
      }
    }
  }, [loadBomOptions, loadSemiFinishedReferences, targetTypeValue]);

  useEffect(() => {
    const loadTargetVariants = async () => {
      if (!bomIdValue) {
        setTargetVariantOptions([]);
        form.setFieldsValue({
          targetVariantKey: undefined,
          targetVariantLabel: "",
        });
        return;
      }

      try {
        const result = await getProductionOrderTargetVariantOptions(bomIdValue);
        setTargetVariantOptions(result || []);

        if (!Array.isArray(result) || result.length === 0) {
          form.setFieldsValue({
            targetVariantKey: undefined,
            targetVariantLabel: "",
          });
        }
      } catch (error) {
        console.error(error);
        setTargetVariantOptions([]);
      }
    };

    loadTargetVariants();
  }, [bomIdValue, form]);

  useEffect(() => {
    let cancelled = false;

    const loadRequirementPreview = async () => {
      if (!bomIdValue || Number(orderQtyValue || 0) <= 0) {
        setRequirementPreview(null);
        setRequirementPreviewError("");
        return;
      }

      try {
        setRequirementPreviewLoading(true);
        setRequirementPreviewError("");
        const result = await buildProductionOrderRequirementLines({
          bomId: bomIdValue,
          orderQty: Number(orderQtyValue || 0),
          targetVariantKey: targetVariantKeyValue || "",
          targetVariantLabel: targetVariantLabelValue || "",
        });

        if (cancelled) return;

        const requirementLines = Array.isArray(result?.requirementLines)
          ? result.requirementLines
          : [];
        const totalRequired = requirementLines.reduce(
          (sum, line) => sum + Number(line.qtyRequired || 0),
          0,
        );
        const totalAvailable = requirementLines.reduce(
          (sum, line) => sum + Number(line.availableStockSnapshot || 0),
          0,
        );
        const totalShortage = requirementLines.reduce(
          (sum, line) => sum + Number(line.shortageQty || 0),
          0,
        );
        const topShortageLine = [...requirementLines]
          .filter((line) => Number(line.shortageQty || 0) > 0)
          .sort((left, right) => Number(right.shortageQty || 0) - Number(left.shortageQty || 0))[0];

        setRequirementPreview({
          // =====================================================
          // ACTIVE / FINAL - preview read-only Buat PO.
          // Fungsi:
          // - menyimpan line material dan snapshot stok target dari helper final;
          // - dipakai hanya untuk tampilan compact sebelum submit.
          // Alasan perubahan:
          // - kotak summary agregat terlalu penuh dan tidak memberi info stok target.
          // Status:
          // - aktif dipakai untuk drawer Buat Production Order;
          // - createProductionOrder tetap menghitung ulang requirement final saat simpan.
          // =====================================================
          requirementLines,
          targetStockPreview: result?.targetStockPreview || null,
          targetHasVariants:
            result?.targetHasVariants === true ||
            result?.targetStockPreview?.targetHasVariants === true ||
            result?.bom?.targetHasVariants === true,
          totalLines: Number(result?.reservationSummary?.totalLines || 0),
          sufficientLines: Number(result?.reservationSummary?.sufficientLines || 0),
          shortageLines: Number(result?.reservationSummary?.shortageLines || 0),
          canReserveFully: result?.reservationSummary?.canReserveFully === true,
          totalRequired,
          totalAvailable,
          totalShortage,
          topShortageLabel: topShortageLine
            ? `${topShortageLine.itemName || "Material"} kurang ${formatNumber(topShortageLine.shortageQty || 0)} ${topShortageLine.unit || ""}`
            : "",
        });
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setRequirementPreview(null);
          setRequirementPreviewError(
            error?.message || "Preview kebutuhan material gagal dimuat.",
          );
        }
      } finally {
        if (!cancelled) {
          setRequirementPreviewLoading(false);
        }
      }
    };

    loadRequirementPreview();

    return () => {
      cancelled = true;
    };
  }, [bomIdValue, orderQtyValue, targetVariantKeyValue, targetVariantLabelValue]);

  const summary = useMemo(() => {
    return buildCountSummary(orders, {
      shortage: (item) => item.status === "shortage",
      ready: (item) => item.status === "ready",
      inProduction: (item) => item.status === "in_production",
    });
  }, [orders]);

  const summaryItems = [
    {
      key: "production-orders-total",
      title: "Total Order",
      value: summary.total,
      subtitle: "Semua production order yang tersimpan.",
      accent: "primary",
    },
    {
      key: "production-orders-shortage",
      title: "Shortage",
      value: summary.shortage,
      subtitle: "Masih kurang material untuk mulai produksi.",
      accent: "warning",
    },
    {
      key: "production-orders-ready",
      title: "Ready",
      value: summary.ready,
      subtitle: "Sudah siap diproses menjadi work log produksi.",
      accent: "success",
    },
    {
      key: "production-orders-active",
      title: "In Production",
      value: summary.inProduction,
      subtitle: "Sedang berjalan di flow produksi aktif.",
      accent: "default",
    },
  ];

  const filteredData = useMemo(() => {
    return orders.filter((item) => {
      const matchSearch = createKeywordMatcher(
        {
          ...item,
          displayReference: buildDisplayReferenceSearchText(item, { fields: ["code", "productionOrderCode"] }),
        },
        ["code", "productionOrderCode", "displayReference", "targetName", "bomName"],
        search,
      );

      const matchStatus = matchFieldValue(item, statusFilter, "status");
      const matchTargetType = matchFieldValue(
        item,
        targetTypeFilter,
        "targetType",
      );

      return matchSearch && matchStatus && matchTargetType;
    });
  }, [orders, search, statusFilter, targetTypeFilter]);

  /* =====================================================
  SECTION: Guided Production Order target filters — AKTIF / GUARDED
  Fungsi:
  - Membuat pilihan PO bertahap dari BOM aktif existing tanpa menyimpan filter UI ke database.
  - Produk Jadi langsung memilih produk yang dibuat.
  - Bahan / Semi Produk memakai filter Product Family dan kategori agar tidak menjadi flat list panjang.

  Dipakai oleh:
  - Drawer Buat Production Order sebagai helper UI untuk menentukan bomId internal.

  Alasan perubahan:
  - User operasional perlu memilih target produksi secara natural, sementara source of truth submit tetap bomId.

  Catatan cleanup:
  - Belum ada. Jika nanti family/category menjadi kebutuhan produk jadi, review schema terpisah diperlukan.

  Risiko:
  - Jangan menyimpan selectedProductionTargetKey, semiFamilyFilter, atau semiCategoryFilter ke database karena semuanya hanya state UI.
  ===================================================== */
  const semiReferenceLookup = useMemo(() => {
    const lookup = new Map();

    semiFinishedReferences.forEach((item) => {
      [item.id, item.code, item.itemCode, item.name]
        .filter(Boolean)
        .forEach((value) => lookup.set(String(value).trim().toLowerCase(), item));
    });

    return lookup;
  }, [semiFinishedReferences]);

  const productionTargetGroups = useMemo(() => {
    const groupMap = new Map();

    bomOptions.forEach((option) => {
      const bom = option.raw || {};
      const targetType = bom.targetType || targetTypeValue || "product";
      const targetId = String(bom.targetId || bom.targetName || bom.id || option.value || "").trim();
      const key = `${targetType}::${targetId || "unknown"}`;
      const targetName = String(bom.targetName || bom.targetCode || "Target belum dikenal").trim();
      const targetCode = bom.targetCode || "";
      const semiReference =
        targetType === "semi_finished_material"
          ? semiReferenceLookup.get(String(bom.targetId || "").trim().toLowerCase()) ||
            semiReferenceLookup.get(String(targetCode || "").trim().toLowerCase()) ||
            semiReferenceLookup.get(String(targetName || "").trim().toLowerCase()) ||
            null
          : null;
      const semiMeta =
        targetType === "semi_finished_material"
          ? resolveSemiProductionGroupMeta({ reference: semiReference })
          : {
              familyKey: "",
              familyLabel: "",
              categoryKey: "",
              categoryLabel: "",
            };

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          key,
          targetType,
          targetName,
          targetCode,
          ...semiMeta,
          bomOptions: [],
        });
      }

      groupMap.get(key).bomOptions.push(option);
    });

    return Array.from(groupMap.values())
      .map((group) => ({
        ...group,
        label: getProductionTargetDisplayLabel(group),
      }))
      .sort((a, b) => a.targetName.localeCompare(b.targetName));
  }, [bomOptions, targetTypeValue, semiReferenceLookup]);

  const semiFamilyOptions = useMemo(() => {
    const familyMap = new Map();

    productionTargetGroups
      .filter((group) => group.targetType === "semi_finished_material")
      .forEach((group) => {
        if (!familyMap.has(group.familyKey)) {
          familyMap.set(group.familyKey, {
            value: group.familyKey,
            label: group.familyLabel,
          });
        }
      });

    return Array.from(familyMap.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [productionTargetGroups]);

  const semiCategoryOptions = useMemo(() => {
    const categoryMap = new Map();

    productionTargetGroups
      .filter((group) => group.targetType === "semi_finished_material")
      .filter((group) => !semiFamilyFilter || group.familyKey === semiFamilyFilter)
      .forEach((group) => {
        if (!categoryMap.has(group.categoryKey)) {
          categoryMap.set(group.categoryKey, {
            value: group.categoryKey,
            label: group.categoryLabel,
          });
        }
      });

    return [
      { value: "all", label: "Semua Kategori" },
      ...Array.from(categoryMap.values()).sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [productionTargetGroups, semiFamilyFilter]);

  const visibleProductionTargetGroups = useMemo(() => {
    if (targetTypeValue !== "semi_finished_material") {
      return productionTargetGroups;
    }

    if (!semiFamilyFilter) return [];

    return productionTargetGroups.filter((group) => {
      const matchFamily = group.familyKey === semiFamilyFilter;
      const matchCategory =
        semiCategoryFilter === "all" || group.categoryKey === semiCategoryFilter;
      return matchFamily && matchCategory;
    });
  }, [productionTargetGroups, targetTypeValue, semiFamilyFilter, semiCategoryFilter]);

  const selectedProductionTargetGroup = useMemo(
    () => productionTargetGroups.find((group) => group.key === selectedProductionTargetKey) || null,
    [productionTargetGroups, selectedProductionTargetKey],
  );

  const selectedTargetBomOptions = selectedProductionTargetGroup?.bomOptions || [];
  const recipeOptions = selectedTargetBomOptions.map((option) => ({
    ...option,
    label: getRecipeDisplayLabel(option),
  }));
  const shouldShowRecipeSelect = selectedTargetBomOptions.length > 1;
  const isSemiFinishedProduction = targetTypeValue === "semi_finished_material";
  const targetSelectLabel = isSemiFinishedProduction ? "Bahan yang dibuat" : "Produk yang dibuat";
  const targetSelectPlaceholder = isSemiFinishedProduction
    ? semiFamilyFilter
      ? "Pilih bahan yang dibuat..."
      : "Pilih jenis bunga dulu"
    : "Pilih produk yang dibuat...";

  useEffect(() => {
    if (
      selectedProductionTargetKey &&
      !visibleProductionTargetGroups.some((group) => group.key === selectedProductionTargetKey)
    ) {
      setSelectedProductionTargetKey("");
      setTargetVariantOptions([]);
      form.setFieldsValue({
        bomId: undefined,
        targetVariantKey: undefined,
        targetVariantLabel: "",
      });
    }
  }, [form, selectedProductionTargetKey, visibleProductionTargetGroups]);

  useEffect(() => {
    if (
      isSemiFinishedProduction &&
      semiFamilyOptions.length === 1 &&
      !semiFamilyFilter
    ) {
      setSemiFamilyFilter(semiFamilyOptions[0].value);
    }
  }, [isSemiFinishedProduction, semiFamilyFilter, semiFamilyOptions]);

  const handleSelectProductionTarget = (value) => {
    const selectedGroup = productionTargetGroups.find((group) => group.key === value);

    setSelectedProductionTargetKey(value || "");
    setTargetVariantOptions([]);

    form.setFieldsValue({
      bomId: selectedGroup?.bomOptions?.length === 1 ? selectedGroup.bomOptions[0].value : undefined,
      targetVariantKey: undefined,
      targetVariantLabel: "",
    });
  };

  const resetFormState = () => {
    form.resetFields();
    setSelectedProductionTargetKey("");
    setSemiFamilyFilter("");
    setSemiCategoryFilter("all");
    setTargetVariantOptions([]);
  };

  const closeFormDrawer = () => {
    setFormVisible(false);
    resetFormState();
  };

  const handleAdd = async () => {
    resetFormState();

    form.setFieldsValue({
      code: "",
      targetType: "product",
      bomId: undefined,
      targetVariantKey: undefined,
      targetVariantLabel: "",
      orderQty: 1,
      priority: "normal",
      notes: "",
    });

    setFormVisible(true);

    await loadBomOptions("product");
    await loadGeneratedCode("product");
  };

  const handleSubmit = async () => {
    try {
      if (!selectedProductionTargetKey) {
        message.error(isSemiFinishedProduction ? "Pilih bahan yang dibuat" : "Pilih produk yang dibuat");
        return;
      }

      if (!form.getFieldValue("bomId")) {
        message.error("Pilih resep produksi");
        return;
      }

      const values = await form.validateFields();
      const selectedVariant = targetVariantOptions.find(
        (item) => item.value === values.targetVariantKey,
      );

      setSubmitting(true);

      await createProductionOrder(
        {
          ...values,
          targetVariantLabel: selectedVariant?.label || "",
        },
        null,
      );

      message.success("Production order berhasil dibuat");

      closeFormDrawer();
      await loadData();
    } catch (error) {
      if (error?.errorFields) return;

      if (error?.type === "validation" && error?.errors) {
        const fields = Object.entries(error.errors).map(([name, errors]) => ({
          name,
          errors: [errors],
        }));
        form.setFields(fields);
        return;
      }

      console.error(error);
      message.error(error?.message || "Gagal membuat production order");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefreshRequirement = useCallback(async (record) => {
    try {
      await refreshProductionOrderRequirements(record.id, null);
      message.success("Kebutuhan material berhasil diperbarui");
      await loadData();
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal refresh kebutuhan order");
    }
  }, [loadData, message]);

  // =====================================================
  // Mulai Produksi dari PO
  // Catatan maintainability:
  // - 1 PO = 1 Work Log
  // - Saat start, stok bahan dipotong sesuai requirement PO
  // - Work Log otomatis dibuat dari snapshot BOM/PO
  // =====================================================
  const handleStartProduction = useCallback(async (record) => {
    try {
      await createProductionWorkLogFromOrder(record.id, {}, currentUser);
      message.success("Produksi dimulai. Work Log dibuat dan stok bahan dipotong.");
      await loadData();
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal memulai produksi");
    }
  }, [currentUser, loadData, message]);

  const handleOpenDetail = useCallback((record) => {
    setSelectedOrder(record);
    setDetailVisible(true);
  }, []);

  const columns = useMemo(() => createProductionOrderColumns({
    onOpenDetail: handleOpenDetail,
    onRefreshRequirement: handleRefreshRequirement,
    onStartProduction: handleStartProduction,
  }), [handleOpenDetail, handleRefreshRequirement, handleStartProduction]);

  const productionOrderMobileCardConfig = useMemo(() => createProductionOrderMobileCardConfig({
    onOpenDetail: handleOpenDetail,
    onRefreshRequirement: handleRefreshRequirement,
    onStartProduction: handleStartProduction,
  }), [handleOpenDetail, handleRefreshRequirement, handleStartProduction]);

  const detailRequirementColumns = useMemo(
    () => createProductionOrderDetailRequirementColumns(),
    [],
  );

  return (
    <div className="page-container ims-page">
      {/* AKTIF / GUARDED: header shared produksi dipakai untuk konsistensi, flow order dan status transition tetap existing. */}
      <ProductionPageHeader
        title="Production Orders"
        description="Produksi mengikuti alur BOM → PO → Work Log."
        onAdd={handleAdd}
        addLabel="Buat Order"
      />

      <PageContentCanvas>

      {/* AKTIF / GUARDED: summary hanya migrasi wrapper presentational, tanpa ubah kalkulasi readiness/shortage. */}
      <ProductionSummaryCards items={summaryItems} />

      <ProductionFilterCard>
        <Col xs={24} md={8}>
          <Input
            placeholder="Cari kode, target, BOM..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
        </Col>

        <Col xs={24} md={8}>
          <Select
            className="ims-filter-control"
            value={targetTypeFilter}
            onChange={setTargetTypeFilter}
            options={[
              { value: "all", label: "Semua Target Type" },
              ...PRODUCTION_ORDER_TARGET_TYPES,
            ]}
          />
        </Col>

        <Col xs={24} md={8}>
          <Select
            className="ims-filter-control"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: "Semua Status" },
              { value: "shortage", label: "Shortage" },
              { value: "ready", label: "Ready" },
                            { value: "in_production", label: "In Production" },
              { value: "completed", label: "Completed" },
                          ]}
          />
        </Col>
      </ProductionFilterCard>

      <PageSection
        title="Daftar Production Orders"
        subtitle="Cek shortage, readiness, dan akses Work Log."
      >
        {/* Aktif dipakai: scroll x besar dihapus agar tombol aksi terlihat pada desktop/laptop normal. */}
        <DataTableView
          loading={loading}
          className="ims-table"
          rowKey="id"
          columns={columns}
          dataSource={filteredData}
          emptyState={{ description: "Belum ada production order" }}
          mobileCardConfig={productionOrderMobileCardConfig}
        />
      </PageSection>

      </PageContentCanvas>

<ProductionOrderFormDrawer
        formState={{ form, formVisible, submitting }}
        selectionState={{
          bomIdValue,
          orderQtyValue,
          selectedProductionTargetKey,
          semiCategoryFilter,
          semiFamilyFilter,
          targetTypeValue,
          targetVariantKeyValue,
          targetVariantOptions,
        }}
        referenceData={{
          recipeOptions,
          semiCategoryOptions,
          semiFamilyOptions,
          visibleProductionTargetGroups,
        }}
        previewState={{
          requirementPreview,
          requirementPreviewError,
          requirementPreviewLoading,
        }}
        uiState={{
          bomLoading,
          isSemiFinishedProduction,
          shouldShowRecipeSelect,
          targetSelectLabel,
          targetSelectPlaceholder,
        }}
        actions={{
          closeFormDrawer,
          handleSelectProductionTarget,
          handleSubmit,
          loadBomOptions,
          loadGeneratedCode,
          loadSemiFinishedReferences,
          setSelectedProductionTargetKey,
          setSemiCategoryFilter,
          setSemiFamilyFilter,
          setTargetVariantOptions,
        }}
      />
<ProductionOrderDetailDrawer
        detailRequirementColumns={detailRequirementColumns}
        detailVisible={detailVisible}
        selectedOrder={selectedOrder}
        setDetailVisible={setDetailVisible}
      />
    </div>
  );
};

export default ProductionOrders;
