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
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
} from "antd";
import { EyeOutlined } from "@ant-design/icons";
import StatusTag from "../../components/Layout/Feedback/StatusTag";
import EmptyStateBlock from "../../components/Layout/Feedback/EmptyStateBlock";
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
import MobileDetailDrawer from "../../components/Layout/Mobile/MobileDetailDrawer";
import ImsNotice from "../../components/Layout/Feedback/ImsNotice";
import ProductionSummaryCards from "../../components/Produksi/shared/ProductionSummaryCards";
import formatNumber, { parseIntegerIdInput } from "../../utils/formatters/numberId";
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
import { buildDisplayReferenceSearchText, resolveDisplayReference } from "../../utils/references/displayReferenceResolver";
import {
  formatDateTimeLabel,
  formatQtyWithUnit,
  getCompactLineStatus,
  getPriorityMeta,
  getProductionTargetDisplayLabel,
  getRecipeDisplayLabel,
  getRequirementStockSourceMeta,
  ORDER_STATUS_MAP,
  orderUiClassNames,
  PRIORITY_OPTIONS,
  PRODUCTION_ORDER_TARGET_TYPES,
  renderOrderCellBlock,
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

  Catatan cleanup:
  - Belum ada.

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

  const handleAdd = async () => {
    form.resetFields();

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

    setSelectedProductionTargetKey("");
    setSemiFamilyFilter("");
    setSemiCategoryFilter("all");
    setTargetVariantOptions([]);
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

      setFormVisible(false);
      form.resetFields();
      setSelectedProductionTargetKey("");
      setSemiFamilyFilter("");
      setSemiCategoryFilter("all");
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

  const handleRefreshRequirement = async (record) => {
    try {
      await refreshProductionOrderRequirements(record.id, null);
      message.success("Kebutuhan material berhasil diperbarui");
      await loadData();
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal refresh kebutuhan order");
    }
  };

  // =====================================================
  // Mulai Produksi dari PO
  // Catatan maintainability:
  // - 1 PO = 1 Work Log
  // - Saat start, stok bahan dipotong sesuai requirement PO
  // - Work Log otomatis dibuat dari snapshot BOM/PO
  // =====================================================
  const handleStartProduction = async (record) => {
    try {
      await createProductionWorkLogFromOrder(record.id, {}, currentUser);
      message.success("Produksi dimulai. Work Log dibuat dan stok bahan dipotong.");
      await loadData();
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal memulai produksi");
    }
  };

  // =====================================================
  // Kolom list Production Order
  // Fungsi blok:
  // - menampilkan PO aktif dalam layout tabel yang compact;
  // - menjaga tombol aksi tetap langsung terlihat tanpa scroll horizontal.
  // Alasan perubahan:
  // - regression UI sebelumnya memakai scroll x besar sehingga tombol aksi terdorong ke kanan.
  // Status:
  // - aktif dipakai; bukan kandidat cleanup karena ini tabel utama Production Orders.
  // =====================================================
  const columns = [
    {
      title: "Order",
      key: "order",
      width: 170,
      render: (_, record) => (
        renderOrderCellBlock(resolveDisplayReference(record, { fields: ["code", "productionOrderCode"], fallback: "-" }), [
          `Dibuat: ${formatDateTimeLabel(record.createdAt)}`,
        ])
      ),
    },
    {
      title: "Target",
      key: "target",
      width: 250,
      render: (_, record) => (
        <div className={orderUiClassNames.stack}>
          <Space wrap size={[8, 4]} className="ims-cell-tag-list">
            <Typography.Text strong>{record.targetName || "-"}</Typography.Text>
            <Tag className="ims-status-tag" color={record.targetType === "product" ? "blue" : "purple"}>
              {record.targetType === "product" ? "Product" : "Semi Finished"}
            </Tag>
          </Space>
          <div className={orderUiClassNames.meta}>
            BOM: {record.bomName || "-"}
          </div>
          {record.targetVariantLabel ? (
            <div className={orderUiClassNames.meta}>Varian: {record.targetVariantLabel}</div>
          ) : null}
          {/* =====================================================
              ACTIVE - referensi planning pada PO.
              Fungsi:
              - membantu user melihat PO ini berasal dari planning mana;
              - hanya info monitoring dan tidak mengubah flow stok/BOM.
          ===================================================== */}
          {record.planningCode ? (
            <div className={orderUiClassNames.meta}>
              Planning: {record.planningCode}{record.planningTitle ? ` - ${record.planningTitle}` : ""}
            </div>
          ) : null}
          <div className={orderUiClassNames.meta}>
            Estimasi Output: {formatNumber(record.expectedOutputQty || 0)} {record.targetUnit || "pcs"}
          </div>
        </div>
      ),
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      width: 92,
      render: (value) => {
        const meta = getPriorityMeta(value);
        return <Tag className="ims-status-tag" color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: "Qty Batch",
      dataIndex: "batchCount",
      key: "batchCount",
      width: 90,
      render: (_, record) => formatNumber(record.batchCount ?? record.orderQty),
    },
    {
      title: "Requirement",
      key: "requirement",
      width: 120,
      render: (_, record) => (
        <div className={orderUiClassNames.stack}>
          <Typography.Text>
            Line: {formatNumber(record.reservationSummary?.totalLines || 0)}
          </Typography.Text>
          <Typography.Text type="secondary" className={orderUiClassNames.meta}>
            Shortage: {formatNumber(record.reservationSummary?.shortageLines || 0)}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (value) => {
        const meta = ORDER_STATUS_MAP[value] || ORDER_STATUS_MAP.draft;
        return <span className="ims-badge-inline"><Badge status={meta.status} text={meta.text} /></span>;
      },
    },
    {
      title: "Aksi",
      key: "actions",
      width: 170,
      render: (_, record) => (
        // Aktif dipakai: aksi dibuat vertical compact agar Detail/Refresh/Mulai tetap terlihat tanpa scroll kanan.
        <Space direction="vertical" size={6} className="ims-action-group ims-action-group--vertical">
          <Button
            className="ims-action-button"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedOrder(record);
              setDetailVisible(true);
            }}
          >
            Detail
          </Button>

          {(record.status === "shortage" || record.status === "ready") && (
            <Button
              className="ims-action-button"
              size="small"
              onClick={() => handleRefreshRequirement(record)}
            >
              Refresh Need
            </Button>
          )}

          {record.status === "ready" && (
            <Button
              className="ims-action-button"
              size="small"
              type="primary"
              onClick={() => handleStartProduction(record)}
            >
              Mulai Produksi
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // IMS NOTE [AKTIF/GUARDED UI] - Mobile card Production Order.
  // Fungsi: menampilkan PO, target, readiness, dan aksi utama secara ringkas di HP.
  // Guardrail: hanya presentasi; refresh requirement, mulai produksi, stok consume, dan lifecycle PO tetap memakai handler/service existing.
  const productionOrderMobileCardConfig = {
    title: (record) => resolveDisplayReference(record, { fields: ["code", "productionOrderCode"], fallback: "-" }),
    subtitle: (record) => [
      `Dibuat: ${formatDateTimeLabel(record.createdAt)}`,
      record.targetName || "Target belum tercatat",
      record.planningCode ? `Planning: ${record.planningCode}` : null,
    ].filter(Boolean),
    tags: (record) => {
      const statusMeta = ORDER_STATUS_MAP[record.status] || ORDER_STATUS_MAP.draft;
      const priorityMeta = getPriorityMeta(record.priority);

      return [
        <Tag key="target-type" color={record.targetType === "product" ? "blue" : "purple"}>
          {record.targetType === "product" ? "Product" : "Semi Finished"}
        </Tag>,
        <Tag key="priority" color={priorityMeta.color}>{priorityMeta.label}</Tag>,
        <Tag key="status" color={statusMeta.status === "success" ? "green" : statusMeta.status === "error" ? "red" : "blue"}>
          {statusMeta.text}
        </Tag>,
      ];
    },
    meta: [
      { label: "Qty Batch", value: (record) => formatNumber(record.batchCount ?? record.orderQty) },
      {
        label: "Output",
        value: (record) => `${formatNumber(record.expectedOutputQty || 0)} ${record.targetUnit || "pcs"}`,
      },
      {
        label: "Shortage",
        value: (record) => formatNumber(record.reservationSummary?.shortageLines || 0),
      },
    ],
    content: (record) => [
      record.bomName ? `BOM: ${record.bomName}` : null,
      record.targetVariantLabel ? `Varian: ${record.targetVariantLabel}` : null,
      `Requirement line: ${formatNumber(record.reservationSummary?.totalLines || 0)}`,
    ].filter(Boolean),
    actions: (record) => (
      <Space direction="vertical" size={6} className="ims-action-group ims-action-group--vertical">
        <Button
          className="ims-action-button ims-action-button--block"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedOrder(record);
            setDetailVisible(true);
          }}
        >
          Detail
        </Button>
        {(record.status === "shortage" || record.status === "ready") ? (
          <Button
            className="ims-action-button ims-action-button--block"
            size="small"
            onClick={() => handleRefreshRequirement(record)}
          >
            Refresh Need
          </Button>
        ) : null}
        {record.status === "ready" ? (
          <Button
            className="ims-action-button ims-action-button--block"
            size="small"
            type="primary"
            onClick={() => handleStartProduction(record)}
          >
            Mulai Produksi
          </Button>
        ) : null}
      </Space>
    ),
  };

  // =====================================================
  // SECTION: Detail requirement drawer compact columns — AKTIF
  // Fungsi:
  // - Menampilkan requirement material PO secara ringkas di drawer detail.
  //
  // Dipakai oleh:
  // - Drawer Detail Production Order pada halaman ProductionOrders.
  //
  // Alasan perubahan:
  // - Kolom tipe, stok, shortage, dan status dipadatkan agar drawer tidak perlu scroll horizontal besar.
  //
  // Catatan cleanup:
  // - Bisa diekstrak menjadi komponen shared jika detail requirement dipakai di halaman lain.
  //
  // Risiko:
  // - Jika field stok/shortage disembunyikan atau kalkulasi disentuh, audit kesiapan PO bisa salah.
  // =====================================================
  const detailRequirementColumns = useMemo(
    () => [
      {
        title: "Material",
        key: "item",
        width: 230,
        render: (_, record) => (
          <div className={orderUiClassNames.stack}>
            <Typography.Text strong>{record.itemName || "-"}</Typography.Text>
            <Tag
              className="ims-status-tag"
              color={record.itemType === "raw_material" ? "orange" : "blue"}
            >
              {record.itemType === "raw_material" ? "Raw Material" : "Semi Finished"}
            </Tag>
          </div>
        ),
      },
      {
        title: "Varian / Sumber",
        key: "variantSource",
        width: 170,
        render: (_, record) => {
          const sourceMeta = getRequirementStockSourceMeta(record);

          return (
            <div className={orderUiClassNames.stack}>
              <Tag className="ims-status-tag" color={sourceMeta.color}>
                {sourceMeta.label}
              </Tag>
              <Typography.Text type="secondary" className={orderUiClassNames.meta}>
                {sourceMeta.variantLabel}
              </Typography.Text>
            </div>
          );
        },
      },
      {
        title: "Kebutuhan / Stok",
        key: "quantityStock",
        width: 240,
        render: (_, record) => (
          <div className={orderUiClassNames.stack}>
            <Typography.Text strong>
              Need: {formatQtyWithUnit(record.qtyRequired, record.unit)}
            </Typography.Text>
            <Typography.Text type="secondary" className={orderUiClassNames.meta}>
              Current: {formatQtyWithUnit(record.currentStockSnapshot, record.unit)}
            </Typography.Text>
            <Typography.Text type="secondary" className={orderUiClassNames.meta}>
              Tersedia: {formatQtyWithUnit(record.availableStockSnapshot, record.unit)}
            </Typography.Text>
            {Number(record.reservedStockSnapshot || 0) > 0 ? (
              <Typography.Text type="secondary" className={orderUiClassNames.meta}>
                Reserved: {formatQtyWithUnit(record.reservedStockSnapshot, record.unit)}
              </Typography.Text>
            ) : null}
          </div>
        ),
      },
      {
        title: "Status",
        key: "lineStatus",
        width: 140,
        render: (_, record) => {
          const shortageQty = Number(record.shortageQty || 0);

          return (
            <div className={orderUiClassNames.stack}>
              {record.isSufficient ? (
                <Badge status="success" text="Cukup" />
              ) : (
                <Badge status="error" text="Kurang" />
              )}
              {shortageQty > 0 ? (
                <Tag className="ims-status-tag" color="red">
                  Kurang {formatQtyWithUnit(shortageQty, record.unit)}
                </Tag>
              ) : (
                <StatusTag tone="success">Shortage 0</StatusTag>
              )}
            </div>
          );
        },
      },
    ],
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

      <Drawer
        title="Buat Production Order"
        open={formVisible}
        onClose={() => {
          setFormVisible(false);
          form.resetFields();
          setSelectedProductionTargetKey("");
          setSemiFamilyFilter("");
          setSemiCategoryFilter("all");
          setTargetVariantOptions([]);
        }}
        width={680}
        extra={
          <Space>
            <Button
              onClick={() => {
                setFormVisible(false);
                form.resetFields();
                setSelectedProductionTargetKey("");
                setSemiFamilyFilter("");
                setSemiCategoryFilter("all");
                setTargetVariantOptions([]);
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
        <Form form={form} layout="vertical">
          <Form.Item label="Kode Order" name="code">
            <Input
              placeholder="Auto generate"
              disabled
            />
          </Form.Item>

          <div style={{ margin: "16px 0 8px" }}>
            <Typography.Text strong>Target Produksi</Typography.Text>
          </div>

          <Form.Item
            label="Jenis Produksi"
            name="targetType"
            tooltip="Tentukan jenis produksi dan target yang ingin dibuat."
            rules={[{ required: true, message: "Jenis produksi wajib dipilih" }]}
          >
            <Select
              options={PRODUCTION_ORDER_TARGET_TYPES}
              onChange={async (value) => {
                form.setFieldsValue({
                  code: "",
                  bomId: undefined,
                  targetVariantKey: undefined,
                  targetVariantLabel: "",
                });
                setSelectedProductionTargetKey("");
                setSemiFamilyFilter("");
                setSemiCategoryFilter("all");
                setTargetVariantOptions([]);
                if (value === "semi_finished_material") {
                  await loadSemiFinishedReferences();
                }
                await loadBomOptions(value);
                await loadGeneratedCode(value);
              }}
            />
          </Form.Item>

          {isSemiFinishedProduction ? (
            <>
              <Form.Item label="Jenis Bunga / Product Family" required>
                <Select
                  showSearch
                  allowClear
                  optionFilterProp="label"
                  value={semiFamilyFilter || undefined}
                  options={semiFamilyOptions}
                  loading={bomLoading}
                  placeholder="Pilih jenis bunga..."
                  onFocus={loadSemiFinishedReferences}
                  onChange={(value) => {
                    setSemiFamilyFilter(value || "");
                    setSemiCategoryFilter("all");
                    setSelectedProductionTargetKey("");
                    setTargetVariantOptions([]);
                    form.setFieldsValue({
                      bomId: undefined,
                      targetVariantKey: undefined,
                      targetVariantLabel: "",
                    });
                  }}
                />
              </Form.Item>

              <Form.Item label="Kategori Bahan">
                <Select
                  optionFilterProp="label"
                  value={semiCategoryFilter}
                  options={semiCategoryOptions}
                  disabled={!semiFamilyFilter}
                  placeholder="Pilih kategori bahan..."
                  onChange={(value) => {
                    setSemiCategoryFilter(value || "all");
                    setSelectedProductionTargetKey("");
                    setTargetVariantOptions([]);
                    form.setFieldsValue({
                      bomId: undefined,
                      targetVariantKey: undefined,
                      targetVariantLabel: "",
                    });
                  }}
                />
              </Form.Item>
            </>
          ) : null}

          <Form.Item label={targetSelectLabel} required>
            <Select
              showSearch
              allowClear
              optionFilterProp="label"
              value={selectedProductionTargetKey || undefined}
              options={visibleProductionTargetGroups.map((group) => ({
                value: group.key,
                label: group.label,
              }))}
              loading={bomLoading}
              disabled={isSemiFinishedProduction && !semiFamilyFilter}
              placeholder={targetSelectPlaceholder}
              onFocus={() => {
                loadBomOptions(targetTypeValue || "product");
                if (isSemiFinishedProduction) loadSemiFinishedReferences();
              }}
              onDropdownVisibleChange={(open) => {
                if (open) {
                  loadBomOptions(targetTypeValue || "product");
                  if (isSemiFinishedProduction) loadSemiFinishedReferences();
                }
              }}
              onChange={handleSelectProductionTarget}
            />
          </Form.Item>

          <div style={{ margin: "20px 0 8px" }}>
            <Typography.Text strong>Detail Produksi</Typography.Text>
          </div>

          <Form.Item
            label="Resep Produksi"
            name="bomId"
            tooltip="Sistem memakai resep aktif sebagai acuan kebutuhan material."
            rules={[{ required: true, message: "Resep produksi wajib dipilih" }]}
            hidden={!shouldShowRecipeSelect}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={recipeOptions}
              loading={bomLoading}
              disabled={!selectedProductionTargetKey}
              placeholder={selectedProductionTargetKey ? "Pilih resep produksi..." : "Pilih target produksi dulu"}
              onFocus={() => loadBomOptions(targetTypeValue || "product")}
              onDropdownVisibleChange={(open) => {
                if (open) loadBomOptions(targetTypeValue || "product");
              }}
              onChange={() => {
                form.setFieldsValue({
                  targetVariantKey: undefined,
                  targetVariantLabel: "",
                });
              }}
            />
          </Form.Item>

          <div style={{ margin: "20px 0 8px" }}>
            <Typography.Text strong>Preview Kebutuhan</Typography.Text>
          </div>

          {targetVariantOptions.length > 0 ? (
            <Form.Item
              label="Varian Target"
              name="targetVariantKey"
              rules={[
                { required: true, message: "Varian target wajib dipilih" },
              ]}
              tooltip="Pilih varian target jika ada."
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={targetVariantOptions}
                placeholder="Pilih varian target..."
                onChange={(value) => {
                  const selectedVariant = targetVariantOptions.find(
                    (item) => item.value === value,
                  );
                  form.setFieldValue(
                    "targetVariantLabel",
                    selectedVariant?.label || "",
                  );
                }}
              />
            </Form.Item>
          ) : null}

          <Form.Item
            label="Qty Batch Produksi"
            name="orderQty"
            tooltip="Isi qty batch untuk melihat kebutuhan material dan kondisi stok."
            rules={[{ required: true, message: "Qty order wajib diisi" }]}
          >
            <InputNumber min={1} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
          </Form.Item>

          {/* =====================================================
              ACTIVE / FINAL - preview compact Buat Production Order.
              Fungsi:
              - mengganti kotak summary hijau besar dengan info target produksi
                dan kebutuhan material yang lebih berguna;
              - membaca requirementLines dan targetStockPreview dari helper final.
              Alasan perubahan:
              - drawer PO sebelumnya terlalu penuh oleh summary agregat.
              Status:
              - aktif dipakai sebagai preview read-only;
              - tidak menyimpan ke database, tidak mengubah stok, dan tidak mengubah status PO.
          ===================================================== */}
          {bomIdValue && Number(orderQtyValue || 0) > 0 ? (
            <div style={{ marginBottom: 16 }}>
              {requirementPreviewError ? (
                <ImsNotice
                  variant="critical"
                  compact
                  className="ims-mb-16"
                  title="Preview kebutuhan material tidak valid"
                  description={requirementPreviewError}
                />
              ) : requirementPreview?.targetHasVariants === true && !targetVariantKeyValue ? (
                <ImsNotice
                  variant="info"
                  compact
                  className="ims-mb-16"
                  title="Pilih varian target untuk preview kebutuhan."
                />
              ) : requirementPreview ? (
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Card size="small" title="Target Produksi">
                    {(() => {
                      const targetPreview = requirementPreview.targetStockPreview || {};
                      const targetVariantLabel = targetPreview.targetVariantLabel || "";
                      const targetName = targetPreview.targetName || "-";
                      const targetUnit = targetPreview.targetUnit || "pcs";
                      const currentStockLabel =
                        targetPreview.currentStockSnapshot === null ||
                        targetPreview.currentStockSnapshot === undefined
                          ? targetPreview.note || "Stok target belum terbaca"
                          : formatQtyWithUnit(targetPreview.currentStockSnapshot, targetUnit);

                      return (
                        <Space direction="vertical" size={2} style={{ width: "100%" }}>
                          <Typography.Text strong>
                            {targetName}
                            {targetVariantLabel ? ` · ${targetVariantLabel}` : ""}
                          </Typography.Text>
                          <Typography.Text type="secondary">
                            Stok saat ini {currentStockLabel} · Qty batch {formatNumber(orderQtyValue || 0)} · Output {formatQtyWithUnit(targetPreview.expectedOutputQty || 0, targetUnit)}
                          </Typography.Text>
                        </Space>
                      );
                    })()}
                  </Card>

                  <Card
                    size="small"
                    title="Kebutuhan Material"
                    bodyStyle={{ padding: 12 }}
                  >
                    {requirementPreviewLoading ? (
                      <Typography.Text type="secondary">
                        Memuat preview kebutuhan material...
                      </Typography.Text>
                    ) : (requirementPreview.requirementLines || []).length === 0 ? (
                      <Typography.Text type="secondary">
                        Resep produksi belum memiliki material.
                      </Typography.Text>
                    ) : (
                      <div style={{ maxHeight: 220, overflowY: "auto" }}>
                        {(requirementPreview.requirementLines || []).map((line, index) => {
                          const sourceMeta = getRequirementStockSourceMeta(line);
                          const statusMeta = getCompactLineStatus(line);

                          return (
                            <div
                              key={line.id || `${line.itemId || "material"}-${index}`}
                              style={{
                                padding: "8px 0",
                                borderBottom:
                                  index === requirementPreview.requirementLines.length - 1
                                    ? "none"
                                    : "1px solid var(--ims-border-color-soft)",
                              }}
                            >
                              <Space direction="vertical" size={2} style={{ width: "100%" }}>
                                <Typography.Text strong>
                                  {line.itemName || "Material"}
                                </Typography.Text>
                                <Space size={6} wrap>
                                  <Tag className="ims-status-tag" color={sourceMeta.color}>
                                    {sourceMeta.label}
                                  </Tag>
                                  <Typography.Text type="secondary">
                                    {sourceMeta.variantLabel}
                                  </Typography.Text>
                                  <Typography.Text type="secondary">·</Typography.Text>
                                  <Typography.Text type="secondary">
                                    Butuh {formatQtyWithUnit(line.qtyRequired, line.unit)}
                                  </Typography.Text>
                                  <Typography.Text type="secondary">·</Typography.Text>
                                  <Typography.Text type="secondary">
                                    Stok {formatQtyWithUnit(line.availableStockSnapshot, line.unit)}
                                  </Typography.Text>
                                  <Tag className="ims-status-tag" color={statusMeta.color}>
                                    {statusMeta.label}
                                  </Tag>
                                </Space>
                              </Space>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                </Space>
              ) : (
                <Typography.Text type="secondary">
                  Memuat preview kebutuhan material...
                </Typography.Text>
              )}
            </div>
          ) : null}

          <Form.Item label="Priority" name="priority">
            <Select options={PRIORITY_OPTIONS} />
          </Form.Item>

          <Form.Item label="Catatan" name="notes">
            <Input.TextArea rows={3} placeholder="Catatan order..." />
          </Form.Item>
        </Form>
      </Drawer>
      <MobileDetailDrawer
        title="Detail Production Order"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={920}
      >
        {!selectedOrder ? (
          <EmptyStateBlock compact description="Tidak ada data" />
        ) : (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Row gutter={[12, 12]}>
              <Col xs={24} sm={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="Qty Batch"
                    value={formatNumber(selectedOrder.batchCount ?? selectedOrder.orderQty)}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="Estimasi Output"
                    value={formatNumber(selectedOrder.expectedOutputQty || 0)}
                    suffix={selectedOrder.targetUnit || "pcs"}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card size="small">
                  <Typography.Text type="secondary">Priority</Typography.Text>
                  <div style={{ marginTop: 8 }}>
                    <Tag color={getPriorityMeta(selectedOrder.priority).color}>
                      {getPriorityMeta(selectedOrder.priority).label}
                    </Tag>
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card size="small">
                  <Typography.Text type="secondary">Status</Typography.Text>
                  <div style={{ marginTop: 8 }}>
                    <Badge
                      status={(ORDER_STATUS_MAP[selectedOrder.status] || ORDER_STATUS_MAP.draft).status}
                      text={(ORDER_STATUS_MAP[selectedOrder.status] || ORDER_STATUS_MAP.draft).text}
                    />
                  </div>
                </Card>
              </Col>
            </Row>

            {/* =====================================================
                Ringkasan order.
                Blok ini dipakai user operasional untuk membaca target, BOM,
                dan priority tanpa harus memindai tabel requirement. */}
            <Descriptions
              bordered
              size="small"
              column={1}
              title="Ringkasan Order"
            >
              <Descriptions.Item label="Kode">
                {resolveDisplayReference(selectedOrder, { fields: ["code", "productionOrderCode"], fallback: "-" })}
              </Descriptions.Item>
              <Descriptions.Item label="Target Type">
                {selectedOrder.targetType === "product" ? "Product" : "Semi Finished"}
              </Descriptions.Item>
              <Descriptions.Item label="Target">
                {selectedOrder.targetName || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Varian Target">
                {selectedOrder.targetVariantLabel || "-"}
              </Descriptions.Item>
              {/* =====================================================
                  ACTIVE - display planning reference.
                  Fungsi:
                  - PO manual lama tetap menampilkan tanda "-";
                  - PO dari planning punya jejak balik tanpa mengubah lifecycle PO.
              ===================================================== */}
              <Descriptions.Item label="Planning Reference">
                {selectedOrder.planningCode
                  ? `${selectedOrder.planningCode}${selectedOrder.planningTitle ? ` - ${selectedOrder.planningTitle}` : ""}`
                  : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="BOM / Step">
                {selectedOrder.bomName || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Priority">
                <Tag color={getPriorityMeta(selectedOrder.priority).color}>
                  {getPriorityMeta(selectedOrder.priority).label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Dibuat Pada">
                {formatDateTimeLabel(selectedOrder.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="Mulai Produksi">
                {formatDateTimeLabel(selectedOrder.startedAt)}
              </Descriptions.Item>
              <Descriptions.Item label="Catatan">
                {selectedOrder.notes || "-"}
              </Descriptions.Item>
            </Descriptions>

            {(selectedOrder.reservationSummary?.shortageLines || 0) > 0 ? (
              <ImsNotice
                variant="critical"
                compact
                title={`Ada ${formatNumber(
                  selectedOrder.reservationSummary?.shortageLines,
                )} item yang stoknya masih kurang.`}
                description="Cek requirement yang perlu disiapkan."
              />
            ) : (
              <ImsNotice
                variant="status"
                compact
                title="Semua kebutuhan material cukup dan siap untuk mulai produksi."
                description="PO siap masuk antrian produksi."
              />
            )}

            <Divider orientation="left">Requirement Material</Divider>

            <DataTableView
              className="ims-table"
              rowKey="id"
              pagination={false}
              showRefreshIndicator={false}
              dataSource={selectedOrder.materialRequirementLines || []}
              columns={detailRequirementColumns}
              tableLayout="fixed"
              mobileCardConfig={{
                title: (record) => record.itemName || "Material",
                tags: (record) => {
                  const sourceMeta = getRequirementStockSourceMeta(record);
                  return [
                    <Tag key="type" className="ims-status-tag" color={record.itemType === "raw_material" ? "orange" : "blue"}>
                      {record.itemType === "raw_material" ? "Raw Material" : "Semi Finished"}
                    </Tag>,
                    <Tag key="source" className="ims-status-tag" color={sourceMeta.color}>
                      {sourceMeta.label}
                    </Tag>,
                    record.isSufficient ? <Badge key="ok" status="success" text="Cukup" /> : <Badge key="short" status="error" text="Kurang" />,
                  ];
                },
                subtitle: (record) => getRequirementStockSourceMeta(record).variantLabel,
                meta: [
                  { label: "Need", value: (record) => formatQtyWithUnit(record.qtyRequired, record.unit) },
                  { label: "Current", value: (record) => formatQtyWithUnit(record.currentStockSnapshot, record.unit) },
                  { label: "Tersedia", value: (record) => formatQtyWithUnit(record.availableStockSnapshot, record.unit) },
                  { label: "Kurang", value: (record) => formatQtyWithUnit(record.shortageQty || 0, record.unit) },
                ],
              }}
            />
          </Space>
        )}
      </MobileDetailDrawer>
    </div>
  );
};

export default ProductionOrders;
