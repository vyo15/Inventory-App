import { Button, Popconfirm, Progress, Tag, Tooltip } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import CompactCell, { CompactCellText } from "../../../components/Layout/Table/CompactCell";
import { formatCurrencyId } from "../../../utils/formatters/currencyId";
import { formatNumberId } from "../../../utils/formatters/numberId";

export const SALES_TAB_ITEMS = [
  { key: "all", label: "Semua Penjualan" },
  { key: "Diproses", label: "Diproses" },
  { key: "Dikirim", label: "Dikirim" },
  { key: "Selesai", label: "Selesai" },
];

export const getSaleDisplayReference = (sale = {}) => (
  sale.saleNumber
  || sale.code
  || sale.referenceNumber
  || sale.sourceRef
  || "Tanpa ref"
);

export const getSaleExternalReference = (sale = {}) => (
  sale.externalReferenceNumber || "-"
);

export const getSalesStatusColor = (status) => {
  const statusColors = {
    Selesai: "green",
    Dikirim: "orange",
    Diproses: "blue",
  };

  return statusColors[status] || "default";
};

export const createSalesTableColumns = ({
  isOfflineChannel,
  onUpdateStatus,
} = {}) => [
  {
    title: "Tanggal / Ref",
    key: "dateReference",
    width: 150,
    render: (_, record) => {
      const referenceText = record.saleNumber || record.code || record.referenceNumber || "Tanpa ref";
      return (
        <CompactCell>
          <CompactCellText value={record.date || "-"} strong tooltip={false} />
          <CompactCellText value={referenceText} secondary />
        </CompactCell>
      );
    },
  },
  {
    title: "Pelanggan / Channel",
    key: "customerChannel",
    width: 210,
    render: (_, record) => (
      <CompactCell>
        <CompactCellText value={record.customerName || "-"} strong />
        <Tag style={{ marginTop: 4 }}>{record.salesChannel || "-"}</Tag>
      </CompactCell>
    ),
  },
  {
    title: "Item Ringkas",
    dataIndex: "items",
    key: "items",
    width: 260,
    render: (items) => {
      const saleItems = Array.isArray(items) ? items : [];
      const primaryItem = saleItems[0];

      if (!primaryItem) return "-";

      const primaryLabel = `${primaryItem.itemName || "Item"}${primaryItem.variantLabel ? ` - ${primaryItem.variantLabel}` : ""}`;
      const tooltipContent = (
        <div style={{ maxWidth: 360 }}>
          {saleItems.map((item, index) => (
            <div
              key={`${item.itemId || item.itemName || "item"}-${index}`}
              style={{ marginBottom: index === saleItems.length - 1 ? 0 : 8 }}
            >
              <div className="ims-cell-title">
                {item.itemName || "Item"}{item.variantLabel ? ` - ${item.variantLabel}` : ""}
              </div>
              <div>
                {formatNumberId(item.quantity)} x {formatCurrencyId(item.pricePerUnit || 0)} = {formatCurrencyId(item.subtotal || 0)}
              </div>
            </div>
          ))}
        </div>
      );

      return (
        <Tooltip title={tooltipContent}>
          <CompactCell>
            <CompactCellText value={primaryLabel} strong tooltip={false} />
            <CompactCellText value={`${saleItems.length} item transaksi`} secondary tooltip={false} />
          </CompactCell>
        </Tooltip>
      );
    },
  },
  {
    title: "Total",
    dataIndex: "total",
    key: "total",
    width: 140,
    align: "right",
    render: (value) => (value != null ? <strong>{formatCurrencyId(value)}</strong> : "-"),
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    width: 120,
    render: (status) => <Tag color={getSalesStatusColor(status)}>{status}</Tag>,
  },
  {
    title: "Aksi",
    key: "action",
    width: 150,
    className: "app-table-action-column",
    render: (_, record) => {
      const canMoveToShipped = record.status === "Diproses" && !isOfflineChannel?.(record.salesChannel);
      const canComplete = record.status === "Dikirim" && !isOfflineChannel?.(record.salesChannel);

      if (!canMoveToShipped && !canComplete) return "-";

      return (
        <div className="ims-action-group ims-action-group--vertical">
          {canMoveToShipped ? (
            <Popconfirm
              title="Yakin ubah status menjadi Dikirim?"
              onConfirm={() => onUpdateStatus?.(record.id, "Dikirim")}
              okText="Ya"
              cancelText="Tidak"
            >
              <Button className="ims-action-button" size="small">Dikirim</Button>
            </Popconfirm>
          ) : null}
          {canComplete ? (
            <Popconfirm
              title="Yakin ubah status menjadi Selesai?"
              onConfirm={() => onUpdateStatus?.(record.id, "Selesai")}
              okText="Ya"
              cancelText="Tidak"
            >
              <Button className="ims-action-button" size="small">Selesai</Button>
            </Popconfirm>
          ) : null}
        </div>
      );
    },
  },
];

const getContributionPercent = (record, totalAmount) => (
  totalAmount
    ? Math.round((Number(record.totalAmount || 0) / totalAmount) * 100)
    : 0
);

export const createSalesChannelSummaryColumns = ({
  onOpenDetail,
  totalAmount,
} = {}) => [
  {
    title: "Channel",
    key: "channel",
    width: 220,
    render: (_, record) => (
      <div className="ims-cell-stack ims-cell-stack-tight">
        <div className="ims-cell-title">{record.channel}</div>
        <div className="ims-cell-meta">
          {record.groupLabel} • {formatNumberId(record.transactionCount)} transaksi
        </div>
      </div>
    ),
  },
  {
    title: "Omzet",
    key: "totalAmount",
    width: 150,
    align: "right",
    render: (_, record) => <strong>{formatCurrencyId(record.totalAmount)}</strong>,
  },
  {
    title: "Selesai",
    key: "completedAmount",
    width: 145,
    align: "right",
    render: (_, record) => (
      <div className="ims-cell-stack ims-cell-stack-tight" style={{ alignItems: "flex-end" }}>
        <strong>{formatCurrencyId(record.completedAmount)}</strong>
        <span className="ims-cell-meta">{formatNumberId(record.completedCount)} transaksi</span>
      </div>
    ),
  },
  {
    title: "Pending",
    key: "pendingAmount",
    width: 145,
    align: "right",
    render: (_, record) => (
      <div className="ims-cell-stack ims-cell-stack-tight" style={{ alignItems: "flex-end" }}>
        <strong>{formatCurrencyId(record.pendingAmount)}</strong>
        <span className="ims-cell-meta">{formatNumberId(record.pendingCount)} transaksi</span>
      </div>
    ),
  },
  {
    title: "Kontribusi",
    key: "contribution",
    width: 160,
    render: (_, record) => {
      const percent = getContributionPercent(record, totalAmount);
      return (
        <div className="ims-cell-stack ims-cell-stack-tight">
          <Progress percent={percent} size="small" showInfo={false} />
          <div className="ims-cell-meta">{formatNumberId(percent)}%</div>
        </div>
      );
    },
  },
  {
    title: "Detail",
    key: "detail",
    width: 105,
    align: "right",
    className: "app-table-action-column",
    render: (_, record) => (
      <Button
        size="small"
        icon={<EyeOutlined />}
        disabled={record.transactionCount <= 0}
        onClick={(event) => {
          event.stopPropagation();
          onOpenDetail?.(record.key);
        }}
      >
        Lihat
      </Button>
    ),
  },
];

export const createSelectedSalesChannelTransactionColumns = () => [
  {
    title: "Tanggal / Ref",
    key: "dateReference",
    width: 170,
    render: (_, record) => {
      const referenceText = getSaleDisplayReference(record);
      const externalReference = getSaleExternalReference(record);

      return (
        <div className="ims-cell-stack ims-cell-stack-tight">
          <div className="ims-cell-title">{record.date || "-"}</div>
          <Tooltip title={referenceText}>
            <div className="ims-cell-meta" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {referenceText}
            </div>
          </Tooltip>
          {externalReference !== "-" ? (
            <Tooltip title={`No. marketplace: ${externalReference}`}>
              <Tag style={{ marginTop: 2 }}>Order: {externalReference}</Tag>
            </Tooltip>
          ) : null}
        </div>
      );
    },
  },
  {
    title: "Pelanggan",
    key: "customerName",
    width: 160,
    render: (_, record) => record.customerName || "-",
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    width: 110,
    render: (status) => <Tag color={getSalesStatusColor(status)}>{status}</Tag>,
  },
  {
    title: "Total",
    dataIndex: "total",
    key: "total",
    width: 140,
    align: "right",
    render: (value) => <strong>{formatCurrencyId(value || 0)}</strong>,
  },
];

export const createSalesChannelMobileCardConfig = ({
  onOpenDetail,
  totalAmount,
} = {}) => ({
  title: (record) => record.channel || "Channel penjualan",
  subtitle: (record) => [record.groupLabel, `${formatNumberId(record.transactionCount)} transaksi`],
  meta: [
    { label: "Omzet", value: (record) => formatCurrencyId(record.totalAmount) },
    {
      label: "Selesai",
      value: (record) => `${formatCurrencyId(record.completedAmount)} / ${formatNumberId(record.completedCount)} trx`,
    },
    {
      label: "Pending",
      value: (record) => `${formatCurrencyId(record.pendingAmount)} / ${formatNumberId(record.pendingCount)} trx`,
    },
    {
      label: "Kontribusi",
      value: (record) => `${formatNumberId(getContributionPercent(record, totalAmount))}%`,
    },
  ],
  actions: (record) => (
    <Button
      size="small"
      icon={<EyeOutlined />}
      disabled={record.transactionCount <= 0}
      onClick={() => onOpenDetail?.(record.key)}
    >
      Lihat Detail
    </Button>
  ),
});

export const createSelectedSalesChannelTransactionMobileCardConfig = () => ({
  title: (record) => getSaleDisplayReference(record),
  subtitle: (record) => [record.date || "-", record.customerName || "Tanpa pelanggan"],
  tags: (record) => <Tag color={getSalesStatusColor(record.status)}>{record.status || "-"}</Tag>,
  meta: [
    { label: "Total", value: (record) => formatCurrencyId(record.total || 0) },
    { label: "Order/Resi", value: (record) => getSaleExternalReference(record) },
  ],
});

export const createSalesMobileCardConfig = ({ onOpenDetail } = {}) => ({
  density: "compact",
  title: (record) => getSaleDisplayReference(record),
  subtitle: (record) => [
    record.customerName || "Customer tidak tercatat",
    record.salesChannel || null,
  ].filter(Boolean),
  primary: (record) => formatCurrencyId(record.total || 0),
  secondary: (record) => `${formatNumberId((record.items || []).length)} item${record.date ? ` · ${record.date}` : ""}`,
  tags: (record) => [
    <Tag key="status" color={getSalesStatusColor(record.status)}>{record.status || "-"}</Tag>,
  ],
  onCardClick: (record) => onOpenDetail?.(record),
  primaryActions: [
    { key: "detail", label: "Detail", icon: <EyeOutlined />, onClick: (record) => onOpenDetail?.(record) },
  ],
});
