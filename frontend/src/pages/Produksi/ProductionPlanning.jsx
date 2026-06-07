// =====================================================
// Page: Production Planning
// Fungsi:
// - membuat target produksi mingguan/bulanan/custom sebelum Production Order;
// - memantau progress aktual dari Work Log completed melalui PO terkait;
// - membuat PO dari planning dengan aksi user yang jelas.
// Hubungan flow aplikasi:
// - Planning -> Production Order -> Work Log -> Payroll/HPP -> Dashboard.
// Status:
// - aktif untuk monitoring target; tidak mengubah stok, payroll, expense, atau HPP.
// =====================================================

import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  EditOutlined,
  EyeOutlined,
  LinkOutlined,
  MoreOutlined,
  PlusOutlined,
  StopOutlined,
} from "@ant-design/icons";
import ProductionPageHeader from "../../components/Produksi/shared/ProductionPageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import DataTableView from "../../components/Layout/Table/DataTableView";
import ProductionSummaryCards from "../../components/Produksi/shared/ProductionSummaryCards";
import {
  cancelProductionPlan,
  createProductionOrderFromPlan,
  createProductionPlan,
  getAllProductionPlans,
  getProductionPlanCancelBlockReason,
  getProductionPlanningReferenceData,
  isProductionPlanPoAllowed,
  normalizeProductionPlanStatus,
  updateProductionPlan,
} from "../../services/Produksi/productionPlanningService";
import { buildVariantOptionsFromItem } from "../../utils/variants/variantStockHelpers";
import {
  formatNumberId,
  formatPercentId,
  formatQuantityId,
  parseIntegerIdInput,
} from "../../utils/formatters/numberId";
import { getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";
import { buildDisplayReferenceSearchText, resolveDisplayReference } from "../../utils/references/displayReferenceResolver";

// IMS NOTE [AKTIF/GUARDED] - Standar input angka bulat
// Fungsi blok: mengarahkan InputNumber aktif ke step 1, precision 0, dan parser integer Indonesia.
// Hubungan flow: hanya membatasi input/display UI; service calculation stok, kas, HPP, payroll, dan report tidak diubah.
// Alasan logic: IMS operasional memakai angka tanpa desimal, sementara data lama decimal tidak dimigrasi otomatis.
// Behavior: input baru no-decimal; business rules dan schema/database runtime tetap sama.

const { Text } = Typography;

const PERIOD_OPTIONS = [
  { value: "weekly", label: "Mingguan" },
  { value: "monthly", label: "Bulanan" },
  { value: "custom", label: "Custom" },
];

const TARGET_TYPE_OPTIONS = [
  { value: "semi_finished_material", label: "Semi Finished" },
  { value: "product", label: "Produk Jadi" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
];

const STATUS_META = {
  draft: { label: "Draft", color: "default", badge: "default" },
  active: { label: "Aktif", color: "blue", badge: "processing" },
  completed: { label: "Selesai", color: "green", badge: "success" },
  overdue: { label: "Overdue", color: "red", badge: "error" },
  cancelled: { label: "Cancelled", color: "default", badge: "default" },
};

const PRIORITY_META = {
  low: { label: "Low", color: "default" },
  normal: { label: "Normal", color: "blue" },
  high: { label: "High", color: "orange" },
};

const FILTER_PERIOD_OPTIONS = [
  { value: "all", label: "Semua Periode" },
  { value: "week", label: "Minggu Ini" },
  { value: "month", label: "Bulan Ini" },
];

const FILTER_STATUS_OPTIONS = [
  { value: "all", label: "Semua Status" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Aktif" },
  { value: "completed", label: "Selesai" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
];

// =====================================================
// ACTIVE - helper tanggal halaman planning.
// Fungsi:
// - mengubah DatePicker ke YYYY-MM-DD sebelum masuk service;
// - membuat periode default mingguan/bulanan tanpa plugin tambahan.
// Status:
// - aktif; hanya untuk UI form/filter.
// =====================================================
const formatDateValue = (value) => {
  if (!value) return "";
  const parsed = dayjs(value?.toDate?.() || value);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : "";
};

const formatDateDisplay = (value) => {
  if (!value) return "-";
  const parsed = dayjs(value?.toDate?.() || value);
  return parsed.isValid() ? parsed.format("DD/MM/YYYY") : "-";
};

const toDatePickerValue = (value) => {
  if (!value) return null;
  const parsed = dayjs(value?.toDate?.() || value);
  return parsed.isValid() ? parsed : null;
};

const getCurrentWeekRange = () => {
  const today = dayjs();
  const day = today.day();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = today.add(diffToMonday, "day");
  return {
    start: start.format("YYYY-MM-DD"),
    end: start.add(6, "day").format("YYYY-MM-DD"),
  };
};

const getCurrentMonthRange = () => {
  const today = dayjs();
  return {
    start: today.startOf("month").format("YYYY-MM-DD"),
    end: today.endOf("month").format("YYYY-MM-DD"),
  };
};

const getDefaultPeriodRange = (periodType = "weekly") => {
  if (periodType === "monthly") return getCurrentMonthRange();
  if (periodType === "custom") {
    return {
      start: dayjs().format("YYYY-MM-DD"),
      end: dayjs().format("YYYY-MM-DD"),
    };
  }
  return getCurrentWeekRange();
};

const isRangeOverlap = ({ startA, endA, startB, endB }) => {
  const aStart = dayjs(startA);
  const aEnd = dayjs(endA || startA);
  const bStart = dayjs(startB);
  const bEnd = dayjs(endB || startB);

  if (!aStart.isValid() || !bStart.isValid()) return false;
  return aStart.isBefore(bEnd.add(1, "day")) && bStart.isBefore(aEnd.add(1, "day"));
};

const getPlanStatus = (planOrStatus = "") =>
  normalizeProductionPlanStatus(
    typeof planOrStatus === "string" ? planOrStatus : planOrStatus?.status,
  );
const getStatusMeta = (status) => STATUS_META[getPlanStatus(status)] || STATUS_META.active;
const getPriorityMeta = (priority) => PRIORITY_META[priority] || PRIORITY_META.normal;
const canCreatePoFromPlan = (plan = {}) => isProductionPlanPoAllowed({ ...plan, status: getPlanStatus(plan) });
const getCancelBlockReason = (plan = {}) =>
  getProductionPlanCancelBlockReason({ ...plan, status: getPlanStatus(plan) });
const canCancelPlan = (plan = {}) => !getCancelBlockReason(plan);
const getCancelActionLabel = (plan = {}) => {
  const blockReason = getCancelBlockReason(plan);

  if (!blockReason) return "Cancel";
  if (blockReason.includes("Production Order")) return "Cancel — sudah ada PO";
  if (blockReason.includes("selesai")) return "Cancel — sudah selesai";
  if (blockReason.includes("dibatalkan")) return "Sudah cancelled";

  return "Cancel tidak tersedia";
};

// =====================================================
// SECTION: Production Planning UI guards — COMPATIBILITY
// Fungsi:
// - memakai status canonical yang sama dengan service untuk filter, label, guard Buat PO, dan guard Cancel;
// - memberi pesan error service yang lebih jelas saat cancel atau create PO gagal.
//
// Dipakai oleh:
// - tabel Production Planning, detail drawer, action Cancel, dan drawer Buat PO.
//
// Alasan perubahan:
// - status lama cancel/canceled/Cancelled tidak boleh tetap terbaca overdue atau masih bisa dibuatkan PO;
// - action Cancel harus mengikuti guard service, bukan guard Buat PO, agar Planning yang sudah punya PO tidak membuka modal cancel palsu.
//
// Catatan cleanup:
// - helper lokal bisa disederhanakan jika seluruh data lama sudah memakai status canonical.
//
// Risiko:
// - guard UI harus tetap sejalan dengan service agar tidak membuka flow PO atau cancel untuk status/relasi final.
// =====================================================
const getActionErrorMessage = (error, fallback) => {
  if (error?.type === "validation" && error?.errors) {
    return Object.values(error.errors).filter(Boolean).join("; ") || fallback;
  }

  return error?.message || fallback;
};

const normalizePlanningTargetType = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ");
  if (["semi finished", "semi finished material", "semifinished"].includes(normalized)) {
    return "semi_finished_material";
  }
  if (["product", "finished product"].includes(normalized)) return "product";
  return normalized || "product";
};

const getTargetTypeLabel = (targetType) =>
  normalizePlanningTargetType(targetType) === "product" ? "Produk Jadi" : "Semi Finished";

const getTargetOptions = ({ targetType, referenceData }) => {
  const items =
    normalizePlanningTargetType(targetType) === "product"
      ? referenceData.products || []
      : referenceData.semiFinishedMaterials || [];

  return items.map((item) => ({
    value: item.id,
    label: item.name || "Tanpa nama",
    raw: item,
  }));
};

const getTargetItemById = ({ targetType, targetItemId, referenceData }) => {
  const items =
    normalizePlanningTargetType(targetType) === "product"
      ? referenceData.products || []
      : referenceData.semiFinishedMaterials || [];

  return items.find((item) => item.id === targetItemId) || null;
};

const getMatchingBomOptions = ({ plan, referenceData }) => {
  const planTargetType = normalizePlanningTargetType(plan?.targetType);

  return (referenceData.boms || [])
    .filter((bom) => normalizePlanningTargetType(bom.targetType) === planTargetType)
    .filter((bom) => !plan?.targetItemId || bom.targetId === plan.targetItemId)
    .map((bom) => ({
      value: bom.id,
      label: `${bom.name || "BOM"}${bom.batchOutputQty ? ` · Output ${formatQuantityId(bom.batchOutputQty)} ${bom.targetUnit || "pcs"}` : ""}`,
      raw: bom,
    }));
};

// =====================================================
// ACTIVE - Production Planning page.
// Fungsi:
// - CRUD ringan untuk target produksi;
// - progress memakai field computed dari service, bukan input manual.
// Status:
// - aktif; tidak mengubah flow complete Work Log.
// =====================================================
const ProductionPlanning = () => {
  const [plans, setPlans] = useState([]);
  const [referenceData, setReferenceData] = useState({
    products: [],
    semiFinishedMaterials: [],
    boms: [],
  });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [poSubmitting, setPoSubmitting] = useState(false);

  const [formVisible, setFormVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [poDrawerVisible, setPoDrawerVisible] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedPlanForPo, setSelectedPlanForPo] = useState(null);

  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState("week");
  const [statusFilter, setStatusFilter] = useState("all");

  const [form] = Form.useForm();
  const [poForm] = Form.useForm();

  const targetTypeValue = Form.useWatch("targetType", form);
  const targetItemIdValue = Form.useWatch("targetItemId", form);

  const selectedTargetItem = useMemo(
    () =>
      getTargetItemById({
        targetType: targetTypeValue,
        targetItemId: targetItemIdValue,
        referenceData,
      }),
    [referenceData, targetItemIdValue, targetTypeValue],
  );

  const targetVariantOptions = useMemo(
    () => buildVariantOptionsFromItem(selectedTargetItem || {}),
    [selectedTargetItem],
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const [nextPlans, nextReferenceData] = await Promise.all([
        getAllProductionPlans(),
        getProductionPlanningReferenceData(),
      ]);

      setPlans(nextPlans);
      setReferenceData(nextReferenceData);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal memuat Production Planning");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const summary = useMemo(() => {
    const activePlans = plans.filter((plan) => getPlanStatus(plan) !== "cancelled");
    const targetQty = activePlans.reduce((sum, plan) => sum + Number(plan.targetQty || 0), 0);
    const completedQty = activePlans.reduce((sum, plan) => sum + Number(plan.actualCompletedQty || 0), 0);

    return {
      activeCount: activePlans.filter((plan) => ["active", "draft"].includes(getPlanStatus(plan))).length,
      completedCount: activePlans.filter((plan) => getPlanStatus(plan) === "completed").length,
      overdueCount: activePlans.filter((plan) => getPlanStatus(plan) === "overdue").length,
      targetQty,
      completedQty,
      progressPercent: targetQty > 0 ? (completedQty / targetQty) * 100 : 0,
    };
  }, [plans]);

  // =====================================================
  // ACTIVE - summary items standar IMS.
  // Fungsi:
  // - mengubah data summary planning menjadi format SummaryStatGrid;
  // - membuat card solid/konsisten tanpa mengubah perhitungan progress.
  // Status:
  // - aktif untuk UI read-only; bukan logic stok, kas, payroll, atau HPP.
  // =====================================================
  const summaryItems = useMemo(
    () => [
      {
        key: "active",
        title: "Planning Aktif",
        value: formatNumberId(summary.activeCount),
        subtitle: "Draft dan aktif yang masih dipantau",
        accent: "primary",
      },
      {
        key: "completed",
        title: "Planning Selesai",
        value: formatNumberId(summary.completedCount),
        subtitle: "Target sudah tercapai dari Work Log completed",
        accent: "success",
      },
      {
        key: "overdue",
        title: "Overdue",
        value: formatNumberId(summary.overdueCount),
        subtitle: "Lewat deadline dan belum selesai",
        accent: summary.overdueCount > 0 ? "danger" : "neutral",
      },
      {
        key: "progress",
        title: "Progress Total",
        value: formatPercentId(summary.progressPercent),
        subtitle: `${formatQuantityId(summary.completedQty)} / ${formatQuantityId(summary.targetQty)} pcs`,
        accent: "info",
      },
    ],
    [summary],
  );

  const filteredPlans = useMemo(() => {
    const weekRange = getCurrentWeekRange();
    const monthRange = getCurrentMonthRange();
    const normalizedSearch = search.trim().toLowerCase();

    return plans.filter((plan) => {
      const matchSearch = normalizedSearch
        ? [
            buildDisplayReferenceSearchText(plan, { fields: ["planCode", "code"] }),
            plan.planCode,
            plan.title,
            plan.targetItemName,
            plan.targetVariantLabel,
            plan.notes,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedSearch)
        : true;

      const matchStatus = statusFilter === "all" || getPlanStatus(plan) === statusFilter;

      const matchPeriod =
        periodFilter === "all" ||
        (periodFilter === "week" &&
          isRangeOverlap({
            startA: plan.periodStartDate,
            endA: plan.periodEndDate,
            startB: weekRange.start,
            endB: weekRange.end,
          })) ||
        (periodFilter === "month" &&
          isRangeOverlap({
            startA: plan.periodStartDate,
            endA: plan.periodEndDate,
            startB: monthRange.start,
            endB: monthRange.end,
          }));

      return matchSearch && matchStatus && matchPeriod;
    });
  }, [periodFilter, plans, search, statusFilter]);

  const handleAdd = () => {
    const range = getDefaultPeriodRange("weekly");
    setEditingPlan(null);
    form.resetFields();
    form.setFieldsValue({
      periodType: "weekly",
      periodStartDate: toDatePickerValue(range.start),
      periodEndDate: toDatePickerValue(range.end),
      dueDate: toDatePickerValue(range.end),
      targetType: "semi_finished_material",
      targetItemId: undefined,
      targetVariantKey: undefined,
      targetQty: 1,
      priority: "normal",
      notes: "",
      title: "",
    });
    setFormVisible(true);
  };

  const handleEdit = (record) => {
    setEditingPlan(record);
    form.resetFields();
    form.setFieldsValue({
      ...record,
      periodStartDate: toDatePickerValue(record.periodStartDate),
      periodEndDate: toDatePickerValue(record.periodEndDate),
      dueDate: toDatePickerValue(record.dueDate),
    });
    setFormVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const targetItem = getTargetItemById({
        targetType: values.targetType,
        targetItemId: values.targetItemId,
        referenceData,
      });
      const selectedVariant = targetVariantOptions.find(
        (item) => item.value === values.targetVariantKey,
      );

      const payload = {
        ...values,
        periodStartDate: formatDateValue(values.periodStartDate),
        periodEndDate: formatDateValue(values.periodEndDate),
        dueDate: formatDateValue(values.dueDate),
        targetItemName: targetItem?.name || "",
        targetItemCode: targetItem?.code || "",
        targetUnit: targetItem?.unit || "pcs",
        targetHasVariants: targetItem?.hasVariants === true,
        targetVariantLabel: selectedVariant?.label || "",
      };

      setSubmitting(true);

      if (editingPlan?.id) {
        await updateProductionPlan(editingPlan.id, payload, null);
        message.success("Planning berhasil diperbarui");
      } else {
        await createProductionPlan(payload, null);
        message.success("Planning berhasil dibuat");
      }

      setFormVisible(false);
      setEditingPlan(null);
      form.resetFields();
      await loadData();
    } catch (error) {
      if (error?.errorFields) return;

      if (error?.type === "validation" && error?.errors) {
        form.setFields(
          Object.entries(error.errors).map(([name, errors]) => ({
            name,
            errors: [errors],
          })),
        );
        return;
      }

      console.error(error);
      message.error(error?.message || "Gagal menyimpan planning");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelPlan = (record) => {
    const blockReason = getCancelBlockReason(record);

    if (blockReason) {
      message.warning(blockReason);
      return;
    }

    Modal.confirm({
      title: "Batalkan planning?",
      content:
        "Planning ini belum punya Production Order terkait, sehingga aman dibatalkan. Aksi ini hanya mengubah status planning menjadi cancelled dan tidak mengubah stok, PO, Work Log, Payroll, atau HPP.",
      okText: "Batalkan Planning",
      okButtonProps: { danger: true },
      cancelText: "Kembali",
      onOk: async () => {
        try {
          await cancelProductionPlan(record.id, null);
          message.success("Planning dibatalkan");
          await loadData();
        } catch (error) {
          console.error(error);
          message.error(getActionErrorMessage(error, "Gagal membatalkan planning. Cek koneksi atau permission."));
          throw error;
        }
      },
    });
  };

  const handleOpenDetail = (record) => {
    setSelectedPlan(record);
    setDetailVisible(true);
  };

  const handleOpenPoDrawer = (record) => {
    if (!canCreatePoFromPlan(record)) {
      message.warning("Planning cancelled/completed tidak bisa dibuatkan PO.");
      return;
    }

    const bomOptions = getMatchingBomOptions({ plan: record, referenceData });
    const firstBom = bomOptions[0]?.raw || null;

    if (bomOptions.length === 0) {
      message.warning("Belum ada BOM aktif yang cocok dengan target planning ini.");
    }
    const suggestedBatch = firstBom?.batchOutputQty
      ? Math.max(Math.ceil(Number(record.remainingQty || record.targetQty || 0) / Number(firstBom.batchOutputQty || 1)), 1)
      : 1;

    setSelectedPlanForPo(record);
    poForm.resetFields();
    poForm.setFieldsValue({
      bomId: firstBom?.id,
      orderQty: suggestedBatch,
      priority: record.priority || "normal",
      plannedStartDate: toDatePickerValue(record.periodStartDate),
      plannedEndDate: toDatePickerValue(record.dueDate),
      notes: `PO dari planning ${record.planCode || ""}`,
    });
    setPoDrawerVisible(true);
  };

  const handleCreatePo = async () => {
    if (!selectedPlanForPo?.id) return;

    if (!canCreatePoFromPlan(selectedPlanForPo)) {
      message.warning("Planning cancelled/completed tidak bisa dibuatkan PO.");
      return;
    }

    try {
      const values = await poForm.validateFields();
      setPoSubmitting(true);
      await createProductionOrderFromPlan(
        {
          ...values,
          planId: selectedPlanForPo.id,
          plannedStartDate: formatDateValue(values.plannedStartDate),
          plannedEndDate: formatDateValue(values.plannedEndDate),
        },
        null,
      );

      message.success("Production Order dari planning berhasil dibuat");
      setPoDrawerVisible(false);
      setSelectedPlanForPo(null);
      poForm.resetFields();
      await loadData();
    } catch (error) {
      if (error?.errorFields) return;
      console.error(error);
      message.error(getActionErrorMessage(error, "Gagal membuat PO dari planning"));
    } finally {
      setPoSubmitting(false);
    }
  };

  // =====================================================
  // ACTIVE - menu aksi compact untuk tabel planning.
  // Fungsi:
  // - menjaga aksi Detail dan Buat PO tetap terlihat tanpa horizontal scroll;
  // - memindahkan Edit/Cancel ke dropdown agar kolom aksi tidak melebar.
  // Status:
  // - aktif untuk UI; handler lama tetap dipakai dan tidak mengubah business rules.
  // =====================================================
  const getMoreActionItems = (record) => [
    {
      key: "edit",
      label: "Edit",
      icon: <EditOutlined />,
      disabled: getPlanStatus(record) === "cancelled",
    },
    {
      key: "cancel",
      label: getCancelActionLabel(record),
      icon: <StopOutlined />,
      danger: canCancelPlan(record),
      disabled: !canCancelPlan(record),
    },
  ];

  const handleMoreActionClick = ({ key }, record) => {
    if (key === "edit") {
      handleEdit(record);
      return;
    }

    if (key === "cancel") {
      handleCancelPlan(record);
    }
  };

  // =====================================================
  // ACTIVE - kolom tabel planning.
  // Fungsi:
  // - menampilkan target, progress, deadline, status, dan PO terkait;
  // - aksi create PO tetap manual agar planning tidak otomatis membuat produksi.
  // Status:
  // - aktif untuk monitoring; tidak memanggil mutasi stok.
  // =====================================================
  const columns = [
    {
      title: "Planning",
      dataIndex: "planCode",
      key: "planCode",
      render: (value, record) => {
        const linkedCodes = record.linkedProductionOrderCodes || [];
        const planReference = resolveDisplayReference(record, { fields: ["planCode", "code"], fallback: value || "-" });

        return (
          <Space direction="vertical" size={4} className="ims-cell-stack">
            <Text strong className="ims-cell-title">{planReference}</Text>
            <Text type="secondary" className="ims-cell-meta">
              {record.title || "Rencana Produksi"}
            </Text>
            <Space size={4} wrap>
              <Tag color={getPriorityMeta(record.priority).color}>
                {getPriorityMeta(record.priority).label}
              </Tag>
              {linkedCodes.length > 0 ? (
                <Tag color="blue">{linkedCodes.length} PO terkait</Tag>
              ) : (
                <Tag>Belum ada PO</Tag>
              )}
            </Space>
          </Space>
        );
      },
    },
    {
      title: "Periode",
      key: "period",
      render: (_, record) => (
        <Space direction="vertical" size={4} className="ims-cell-stack ims-cell-stack-tight">
          <Tag color="blue">
            {PERIOD_OPTIONS.find((item) => item.value === record.periodType)?.label || record.periodType}
          </Tag>
          <Text>
            {formatDateDisplay(record.periodStartDate)} - {formatDateDisplay(record.periodEndDate)}
          </Text>
          <Text type="secondary" className="ims-cell-meta">
            Deadline: {formatDateDisplay(record.dueDate)}
          </Text>
        </Space>
      ),
    },
    {
      title: "Target & Progress",
      key: "targetProgress",
      render: (_, record) => (
        <Space direction="vertical" size={6} style={{ width: "100%" }}>
          <Space direction="vertical" size={2}>
            <Text strong>{record.targetItemName || "-"}</Text>
            <Space size={4} wrap>
              <Tag color={normalizePlanningTargetType(record.targetType) === "product" ? "purple" : "cyan"}>
                {getTargetTypeLabel(record.targetType)}
              </Tag>
              {record.targetVariantLabel ? (
                <Tag color="magenta">{record.targetVariantLabel}</Tag>
              ) : null}
            </Space>
          </Space>
          <Text>
            {formatQuantityId(record.actualCompletedQty)} / {formatQuantityId(record.targetQty)} {record.targetUnit || "pcs"}
          </Text>
          <Progress
            percent={Math.min(Number(record.progressPercent || 0), 100)}
            size="small"
            format={(percent) => formatPercentId(percent)}
          />
          <Text type="secondary" className="ims-cell-meta">
            Sisa {formatQuantityId(record.remainingQty)} {record.targetUnit || "pcs"}
          </Text>
        </Space>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      className: "app-table-status-column",
      render: (value) => {
        const meta = getStatusMeta(value);
        return <Badge status={meta.badge} text={meta.label} className="ims-badge-inline" />;
      },
    },
    {
      // IMS NOTE [AKTIF/GUARDED] - Action button Production Planning.
      // Fungsi blok: menyusun Detail/Buat PO/Lainnya menjadi kolom vertical konsisten.
      // Hubungan flow: hanya layout; planning tidak mengubah stok dan handler PO existing tidak diubah.
      title: "Aksi",
      key: "action",
      className: "app-table-action-column",
      render: (_, record) => (
        <div className="ims-action-group ims-action-group--vertical">
          <Button
            size="small"
            className="ims-action-button"
            icon={<EyeOutlined />}
            onClick={() => handleOpenDetail(record)}
          >
            Detail
          </Button>
          <Button
            size="small"
            type="primary"
            className="ims-action-button"
            icon={<LinkOutlined />}
            disabled={!canCreatePoFromPlan(record)}
            onClick={() => handleOpenPoDrawer(record)}
          >
            Buat PO
          </Button>
          <Dropdown
            trigger={["click"]}
            menu={{
              items: getMoreActionItems(record),
              onClick: (info) => handleMoreActionClick(info, record),
            }}
          >
            <Button size="small" className="ims-action-button" icon={<MoreOutlined />}>
              Lainnya
            </Button>
          </Dropdown>
        </div>
      ),
    },
  ];

  const planningMobileCardConfig = {
    title: (record) => resolveDisplayReference(record, { fields: ["planCode", "code"], fallback: "Planning" }),
    subtitle: (record) => [
      record.title || "Rencana Produksi",
      `${formatDateDisplay(record.periodStartDate)} - ${formatDateDisplay(record.periodEndDate)}`,
      record.targetItemName || "Target belum diisi",
    ],
    tags: (record) => {
      const meta = getStatusMeta(record.status);
      return [
        <Badge key="status" status={meta.badge} text={meta.label} className="ims-badge-inline" />,
        <Tag key="priority" color={getPriorityMeta(record.priority).color}>{getPriorityMeta(record.priority).label}</Tag>,
      ];
    },
    meta: [
      { label: "Target", value: (record) => `${formatQuantityId(record.targetQty)} ${record.targetUnit || "pcs"}` },
      { label: "Aktual", value: (record) => `${formatQuantityId(record.actualCompletedQty)} ${record.targetUnit || "pcs"}` },
      { label: "Sisa", value: (record) => `${formatQuantityId(record.remainingQty)} ${record.targetUnit || "pcs"}` },
      { label: "Deadline", value: (record) => formatDateDisplay(record.dueDate) },
    ],
    content: (record) => (
      <Progress
        percent={Math.min(Number(record.progressPercent || 0), 100)}
        size="small"
        format={(percent) => formatPercentId(percent)}
      />
    ),
    actions: (record) => (
      <Space wrap className="ims-action-group">
        <Button size="small" className="ims-action-button" icon={<EyeOutlined />} onClick={() => handleOpenDetail(record)}>Detail</Button>
        <Button
          size="small"
          type="primary"
          className="ims-action-button"
          icon={<LinkOutlined />}
          disabled={!canCreatePoFromPlan(record)}
          onClick={() => handleOpenPoDrawer(record)}
        >
          Buat PO
        </Button>
      </Space>
    ),
  };

  return (
    <div className="ims-page">
      {/* AKTIF / GUARDED: header migrated ke shared produksi; flow planning -> order tetap sama tanpa ubah data contract. */}
      <ProductionPageHeader
        title="Production Planning"
        description="Target produksi sebelum PO."
        onAdd={handleAdd}
        addLabel="Tambah Planning"
      />

      <Alert
        type="info"
        showIcon
        className="ims-page-alert"
        message="Planning hanya target; stok berubah lewat PO/Work Log."
      />

      {/* =====================================================
          ACTIVE - summary cards planning standar IMS.
          Fungsi:
          - memberi gambaran cepat target aktif, overdue, dan progress total;
          - memakai SummaryStatGrid agar surface card solid/konsisten.
          Status:
          - aktif untuk UI read-only; tidak menggantikan detail PO atau Work Log.
      ===================================================== */}
      <ProductionSummaryCards items={summaryItems} columns={{ xs: 24, sm: 12, md: 12, lg: 6 }} />

      <PageSection
        title="Daftar Production Planning"
        subtitle="Filter target produksi."
        extra={
          <Space wrap>
            <Input.Search
              allowClear
              placeholder="Cari kode, item, varian..."
              style={{ width: 240 }}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select
              style={{ width: 160 }}
              options={FILTER_PERIOD_OPTIONS}
              value={periodFilter}
              onChange={setPeriodFilter}
            />
            <Select
              style={{ width: 160 }}
              options={FILTER_STATUS_OPTIONS}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </Space>
        }
      >
        <DataTableView
          loading={loading}
          showRefreshIndicator
          rowKey="id"
          columns={columns}
          dataSource={filteredPlans}
          className="app-data-table"
          mobileCardConfig={planningMobileCardConfig}
          locale={{
            emptyText: getDataTableEmptyText(loading, (
              <Empty description="Belum ada planning produksi untuk filter ini." />
            )),
          }}
        />
      </PageSection>

      <Drawer
        title={editingPlan ? "Edit Production Planning" : "Tambah Production Planning"}
        open={formVisible}
        onClose={() => {
          setFormVisible(false);
          setEditingPlan(null);
        }}
        width={720}
        extra={
          <Space>
            <Button onClick={() => setFormVisible(false)}>Batal</Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
              Simpan
            </Button>
          </Space>
        }
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Form ini tidak mengubah stok; progress dari Work Log completed."
        />

        {/* =====================================================
            ACTIVE - form planning.
            Fungsi:
            - menyimpan target produksi, periode, deadline, prioritas, dan varian target;
            - tidak menyimpan actual progress manual karena progress dihitung service.
        ===================================================== */}
        <Form form={form} layout="vertical">
          <Form.Item label="Judul Planning" name="title">
            <Input placeholder="Contoh: Target kelopak mawar merah minggu ini" />
          </Form.Item>

          <Row gutter={12}>
            <Col xs={24} md={8}>
              <Form.Item label="Tipe Periode" name="periodType" rules={[{ required: true, message: "Tipe periode wajib dipilih" }]}>
                <Select
                  options={PERIOD_OPTIONS}
                  onChange={(value) => {
                    const range = getDefaultPeriodRange(value);
                    form.setFieldsValue({
                      periodStartDate: toDatePickerValue(range.start),
                      periodEndDate: toDatePickerValue(range.end),
                      dueDate: toDatePickerValue(range.end),
                    });
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Mulai Periode" name="periodStartDate" rules={[{ required: true, message: "Mulai periode wajib diisi" }]}>
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Akhir Periode" name="periodEndDate" rules={[{ required: true, message: "Akhir periode wajib diisi" }]}>
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col xs={24} md={8}>
              <Form.Item label="Deadline" name="dueDate" rules={[{ required: true, message: "Deadline wajib diisi" }]}>
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Target Type" name="targetType" rules={[{ required: true, message: "Target type wajib dipilih" }]}>
                <Select
                  options={TARGET_TYPE_OPTIONS}
                  onChange={() => {
                    form.setFieldsValue({
                      targetItemId: undefined,
                      targetVariantKey: undefined,
                    });
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Prioritas" name="priority">
                <Select options={PRIORITY_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Target Item" name="targetItemId" rules={[{ required: true, message: "Target item wajib dipilih" }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Pilih produk / semi finished..."
              options={getTargetOptions({ targetType: targetTypeValue, referenceData })}
              onChange={() => {
                form.setFieldsValue({ targetVariantKey: undefined });
              }}
            />
          </Form.Item>

          {targetVariantOptions.length > 0 ? (
            <Form.Item
              label="Varian Target"
              name="targetVariantKey"
              rules={[{ required: true, message: "Varian target wajib dipilih" }]}
              extra="Progress mengikuti varian target."
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Pilih varian target..."
                options={targetVariantOptions}
              />
            </Form.Item>
          ) : null}

          <Form.Item label="Jumlah Target Produksi" name="targetQty" rules={[{ required: true, message: "Target qty wajib diisi" }]}>
            <InputNumber min={1} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} addonAfter={selectedTargetItem?.unit || "pcs"} />
          </Form.Item>

          <Form.Item label="Catatan" name="notes">
            <Input.TextArea rows={3} placeholder="Catatan rencana produksi..." />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title="Detail Production Planning"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={820}
        extra={
          selectedPlan && canCreatePoFromPlan(selectedPlan) ? (
            <Button type="primary" icon={<LinkOutlined />} onClick={() => handleOpenPoDrawer(selectedPlan)}>
              Buat PO
            </Button>
          ) : null
        }
      >
        {!selectedPlan ? (
          <Empty description="Tidak ada data planning" />
        ) : (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Kode">{resolveDisplayReference(selectedPlan, { fields: ["planCode", "code"], fallback: "-" })}</Descriptions.Item>
              <Descriptions.Item label="Judul">{selectedPlan.title || "-"}</Descriptions.Item>
              <Descriptions.Item label="Periode">
                {formatDateDisplay(selectedPlan.periodStartDate)} - {formatDateDisplay(selectedPlan.periodEndDate)}
              </Descriptions.Item>
              <Descriptions.Item label="Deadline">{formatDateDisplay(selectedPlan.dueDate)}</Descriptions.Item>
              <Descriptions.Item label="Target">
                {selectedPlan.targetItemName || "-"}
                {selectedPlan.targetVariantLabel ? ` · ${selectedPlan.targetVariantLabel}` : ""}
              </Descriptions.Item>
              <Descriptions.Item label="Progress">
                {formatQuantityId(selectedPlan.actualCompletedQty)} / {formatQuantityId(selectedPlan.targetQty)} {selectedPlan.targetUnit || "pcs"} ({formatPercentId(selectedPlan.progressPercent)})
              </Descriptions.Item>
              <Descriptions.Item label="Sisa Target">
                {formatQuantityId(selectedPlan.remainingQty)} {selectedPlan.targetUnit || "pcs"}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Badge status={getStatusMeta(selectedPlan.status).badge} text={getStatusMeta(selectedPlan.status).label} />
              </Descriptions.Item>
              <Descriptions.Item label="Production Order Terkait">
                {(selectedPlan.linkedProductionOrderCodes || []).length > 0 ? (
                  <Space wrap>
                    {(selectedPlan.linkedProductionOrderCodes || []).map((code) => (
                      <Tag key={code} color="blue">{code}</Tag>
                    ))}
                  </Space>
                ) : (
                  <Text type="secondary">Belum ada PO terkait.</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Catatan">{selectedPlan.notes || "-"}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title="Progress Target">
              <Progress percent={Math.min(Number(selectedPlan.progressPercent || 0), 100)} />
              <Text type="secondary">
                Progress hanya dihitung dari Work Log completed milik PO yang terhubung dengan planning ini.
              </Text>
            </Card>
          </Space>
        )}
      </Drawer>

      <Drawer
        title="Buat Production Order dari Planning"
        open={poDrawerVisible}
        onClose={() => setPoDrawerVisible(false)}
        width={640}
        extra={
          <Space>
            <Button onClick={() => setPoDrawerVisible(false)}>Batal</Button>
            <Button type="primary" loading={poSubmitting} onClick={handleCreatePo}>
              Buat PO
            </Button>
          </Space>
        }
      >
        {!selectedPlanForPo ? (
          <Empty description="Pilih planning lebih dulu" />
        ) : (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Alert
              type="info"
              showIcon
              message="PO tetap memakai BOM; planning hanya referensi target."
            />

            <Card size="small">
              <Space direction="vertical" size={2}>
                <Text strong>{selectedPlanForPo.planCode} · {selectedPlanForPo.targetItemName}</Text>
                <Text type="secondary">
                  Sisa target {formatQuantityId(selectedPlanForPo.remainingQty)} {selectedPlanForPo.targetUnit || "pcs"}
                  {selectedPlanForPo.targetVariantLabel ? ` · Varian ${selectedPlanForPo.targetVariantLabel}` : ""}
                </Text>
              </Space>
            </Card>

            {/* =====================================================
                ACTIVE / GUARDED - form PO dari planning.
                Fungsi:
                - user memilih BOM dan qty batch secara eksplisit;
                - create PO tetap lewat service PO existing agar requirement BOM tidak dilewati.
            ===================================================== */}
            <Form form={poForm} layout="vertical">
              <Form.Item label="BOM" name="bomId" rules={[{ required: true, message: "BOM wajib dipilih" }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Pilih BOM untuk target planning..."
                  options={getMatchingBomOptions({ plan: selectedPlanForPo, referenceData })}
                  notFoundContent="Belum ada BOM aktif yang cocok dengan target planning ini."
                />
              </Form.Item>

              <Form.Item label="Qty Batch Produksi" name="orderQty" rules={[{ required: true, message: "Qty batch wajib diisi" }]}>
                <InputNumber min={1} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
              </Form.Item>

              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item label="Rencana Mulai" name="plannedStartDate">
                    <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Rencana Selesai" name="plannedEndDate">
                    <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="Prioritas PO" name="priority">
                <Select options={PRIORITY_OPTIONS} />
              </Form.Item>

              <Form.Item label="Catatan PO" name="notes">
                <Input.TextArea rows={3} />
              </Form.Item>
            </Form>
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default ProductionPlanning;
