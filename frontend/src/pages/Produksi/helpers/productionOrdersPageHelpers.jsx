import dayjs from "dayjs";
import { Badge, Button, Space, Tag, Typography } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import StatusTag from "../../../components/Layout/Feedback/StatusTag";
import { resolveDisplayReference } from "../../../utils/references/displayReferenceResolver";
import { SEMI_FINISHED_CATEGORY_MAP, SEMI_FINISHED_GROUP_MAP } from "../../../constants/semiFinishedMaterialOptions";
import formatNumber from "../../../utils/formatters/numberId";

// IMS NOTE [AKTIF/BATCH 19/GUARDED] — helper UI/read-only halaman ProductionOrders.
// Fungsi blok: memusatkan opsi, formatter, dan resolver display requirement/target PO.
// Hubungan flow: hanya presentasi/preview; tidak mengubah submit PO, refresh need, Start Production, stok, Work Log, HPP, payroll, atau data stok turunan.
// Alasan logic: halaman ProductionOrders masih besar dan sensitive, sehingga yang dipisah hanya helper pure tanpa side-effect.
export const PRODUCTION_ORDER_TARGET_TYPES = [
  {
    value: "semi_finished_material",
    label: "Bahan / Semi Produk",
  },
  {
    value: "product",
    label: "Produk Jadi",
  },
];

export const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export const ORDER_STATUS_MAP = {
  draft: { text: "Draft", status: "default" },
  shortage: { text: "Shortage", status: "error" },
  ready: { text: "Ready", status: "processing" },
  in_production: { text: "In Production", status: "processing" },
  completed: { text: "Completed", status: "success" },
  released: { text: "Released", status: "warning" },
  cancelled: { text: "Cancelled", status: "default" },
};

const PRIORITY_META_MAP = {
  low: { label: "Low", color: "default" },
  normal: { label: "Normal", color: "blue" },
  high: { label: "High", color: "orange" },
  urgent: { label: "Urgent", color: "red" },
};

export const getPriorityMeta = (value) =>
  PRIORITY_META_MAP[value] || {
    label: value ? String(value) : "-",
    color: "default",
  };

export const formatDateTimeLabel = (value) => {
  if (!value) return "-";
  const parsed = dayjs(value?.toDate?.() || value);
  return parsed.isValid() ? parsed.format("DD/MM/YYYY HH:mm") : "-";
};

export const orderUiClassNames = {
  stack: "ims-cell-stack ims-cell-stack-tight",
  meta: "ims-cell-meta",
  title: "ims-cell-title",
};

export const renderOrderCellBlock = (primary, secondaryLines = []) => (
  <div className={orderUiClassNames.stack}>
    <div className={orderUiClassNames.title}>{primary || "-"}</div>
    {secondaryLines.filter(Boolean).map((line, index) => (
      <div key={index} className={orderUiClassNames.meta}>{line}</div>
    ))}
  </div>
);

export const formatQtyWithUnit = (value, unit = "") => {
  const normalizedUnit = String(unit || "").trim();
  return `${formatNumber(Number(value || 0))}${normalizedUnit ? ` ${normalizedUnit}` : ""}`;
};

export const normalizeRequirementVariantStrategy = (line = {}) => {
  const rawStrategy = String(line.materialVariantStrategy || "none").trim().toLowerCase();
  return ["inherit", "fixed", "none"].includes(rawStrategy) ? rawStrategy : "none";
};

export const lineRequiresVariantStock = (line = {}) => {
  const strategy = normalizeRequirementVariantStrategy(line);
  return line.materialHasVariants === true && strategy !== "none";
};

const FALLBACK_SEMI_FAMILY_KEY = "__general";
const FALLBACK_SEMI_CATEGORY_KEY = "__uncategorized";

const normalizeOptionKey = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "_");

const getExactKnownOptionKey = (value = "", optionMap = {}) => {
  const normalizedValue = normalizeOptionKey(value);

  if (!normalizedValue) return "";

  return (
    Object.entries(optionMap).find(([key, label]) => {
      const normalizedKey = normalizeOptionKey(key);
      const normalizedLabel = normalizeOptionKey(label);
      return normalizedValue === normalizedKey || normalizedValue === normalizedLabel;
    })?.[0] || ""
  );
};

const resolveExplicitSemiOptionMeta = ({
  value = "",
  optionMap = {},
  fallbackKey = "",
  fallbackLabel = "",
} = {}) => {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return { key: fallbackKey, label: fallbackLabel };
  }

  const knownKey = getExactKnownOptionKey(rawValue, optionMap);

  if (knownKey) {
    return { key: knownKey, label: optionMap[knownKey] || rawValue };
  }

  return { key: rawValue, label: rawValue };
};

export const resolveSemiProductionGroupMeta = ({ reference = null } = {}) => {
  const familyMeta = resolveExplicitSemiOptionMeta({
    value: reference?.flowerGroup,
    optionMap: SEMI_FINISHED_GROUP_MAP,
    fallbackKey: FALLBACK_SEMI_FAMILY_KEY,
    fallbackLabel: "Umum / Reusable",
  });
  const categoryMeta = resolveExplicitSemiOptionMeta({
    value: reference?.category,
    optionMap: SEMI_FINISHED_CATEGORY_MAP,
    fallbackKey: FALLBACK_SEMI_CATEGORY_KEY,
    fallbackLabel: "Tanpa Kategori",
  });

  return {
    familyKey: familyMeta.key,
    familyLabel: familyMeta.label,
    categoryKey: categoryMeta.key,
    categoryLabel: categoryMeta.label,
  };
};

export const getProductionTargetDisplayLabel = (group = {}) =>
  group.targetName || "Target belum dikenal";

export const getRecipeDisplayLabel = (option = {}) => {
  const raw = option.raw || {};
  const rawName = String(raw.name || raw.bomName || option.label || "").trim();
  const cleanedName = rawName
    .replace(/^BOM\s*[-:]?\s*/i, "")
    .replace(/^([^\s]+)\s+-\s+BOM\s*/i, "")
    .trim();

  if (cleanedName) {
    return cleanedName.toLowerCase().startsWith("resep")
      ? cleanedName
      : `Resep ${cleanedName}`;
  }

  return "Resep Produksi";
};

export const getRequirementStockSourceMeta = (line = {}) => {
  const variantLabel = line.resolvedVariantLabel || line.fixedVariantLabel || "";

  if (line.stockSourceType === "variant" || line.resolvedVariantKey || variantLabel) {
    return {
      color: "purple",
      label: "Variant",
      variantLabel: variantLabel || "Varian terpilih",
    };
  }

  if (lineRequiresVariantStock(line)) {
    return {
      color: "orange",
      label: "Varian tidak ditemukan",
      variantLabel: "Refresh Need / cek BOM",
    };
  }

  return {
    color: "default",
    label: "Master",
    variantLabel: "Tanpa varian",
  };
};

export const getCompactLineStatus = (line = {}) => {
  const shortageQty = Number(line.shortageQty || 0);
  if (shortageQty > 0) {
    return {
      color: "red",
      label: `Kurang ${formatQtyWithUnit(shortageQty, line.unit)}`,
    };
  }

  return {
    color: "green",
    label: "Cukup",
  };
};


const renderProductionOrderActions = ({
  block = false,
  record,
  onOpenDetail,
  onRefreshRequirement,
  onStartProduction,
}) => {
  const buttonClassName = [
    "ims-action-button",
    block ? "ims-action-button--block" : null,
  ].filter(Boolean).join(" ");

  return (
    <Space direction="vertical" size={6} className="ims-action-group ims-action-group--vertical">
      <Button
        className={buttonClassName}
        size="small"
        icon={<EyeOutlined />}
        onClick={() => onOpenDetail?.(record)}
      >
        Detail
      </Button>
      {(record.status === "shortage" || record.status === "ready") ? (
        <Button
          className={buttonClassName}
          size="small"
          onClick={() => onRefreshRequirement?.(record)}
        >
          Refresh Need
        </Button>
      ) : null}
      {record.status === "ready" ? (
        <Button
          className={buttonClassName}
          size="small"
          type="primary"
          onClick={() => onStartProduction?.(record)}
        >
          Mulai Produksi
        </Button>
      ) : null}
    </Space>
  );
};

export const createProductionOrderColumns = ({
  onOpenDetail,
  onRefreshRequirement,
  onStartProduction,
} = {}) => [
  {
    title: "Order",
    key: "order",
    width: 170,
    render: (_, record) => renderOrderCellBlock(
      resolveDisplayReference(record, { fields: ["code", "productionOrderCode"], fallback: "-" }),
      [`Dibuat: ${formatDateTimeLabel(record.createdAt)}`],
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
        <div className={orderUiClassNames.meta}>BOM: {record.bomName || "-"}</div>
        {record.targetVariantLabel ? (
          <div className={orderUiClassNames.meta}>Varian: {record.targetVariantLabel}</div>
        ) : null}
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
    render: (_, record) => renderProductionOrderActions({
      record,
      onOpenDetail,
      onRefreshRequirement,
      onStartProduction,
    }),
  },
];

export const createProductionOrderMobileCardConfig = ({
  onOpenDetail,
  onRefreshRequirement,
  onStartProduction,
} = {}) => ({
  title: (record) => resolveDisplayReference(record, {
    fields: ["code", "productionOrderCode"],
    fallback: "-",
  }),
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
      <Tag
        key="status"
        color={statusMeta.status === "success" ? "green" : statusMeta.status === "error" ? "red" : "blue"}
      >
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
  actions: (record) => renderProductionOrderActions({
    block: true,
    record,
    onOpenDetail,
    onRefreshRequirement,
    onStartProduction,
  }),
});

export const createProductionOrderDetailRequirementColumns = () => [
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
          <Tag className="ims-status-tag" color={sourceMeta.color}>{sourceMeta.label}</Tag>
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
          {record.isSufficient ? <Badge status="success" text="Cukup" /> : <Badge status="error" text="Kurang" />}
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
];
