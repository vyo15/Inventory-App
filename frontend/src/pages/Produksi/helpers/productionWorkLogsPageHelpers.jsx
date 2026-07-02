import { normalizeTruthyText as safeWorkLogText } from "../../../utils/text/textNormalization";
export { safeWorkLogText };
import { Button, Card, Space, Tag, Typography } from 'antd';
import { EditOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import formatCurrency from '../../../utils/formatters/currencyId';
import formatNumber from '../../../utils/formatters/numberId';
import { WORK_LOG_SOURCE_TYPE_MAP, WORK_LOG_STATUS_MAP } from '../../../constants/productionWorkLogOptions';
import { resolveDisplayReference } from '../../../utils/references/displayReferenceResolver';
import { isProductionWorkLogCompleted } from '../../../utils/produksi/productionFlowGuards';

// IMS NOTE [AKTIF/GUARDED] - Helper UI Work Log Produksi.
// Fungsi: menampung formatter/tag/render read-only agar halaman utama tidak menumpuk helper presentasi.
// Batasan: helper ini tidak menulis stok, HPP, payroll, inventory log, data stok turunan, atau status Production Order.

export const isEditableProductionWorkLog = (record = {}) =>
  safeWorkLogText(record.status).toLowerCase() === 'in_progress' && !isProductionWorkLogCompleted(record);

export const getWorkLogStatusTagColor = (status) => {
  switch (status) {
    case 'completed':
      return 'green';
    case 'in_progress':
      return 'blue';
    case 'cancelled':
      return 'red';
    case 'draft':
    default:
      return 'default';
  }
};

export const getWorkLogSourceTagColor = (sourceType) => (
  sourceType === 'production_order' ? 'purple' : 'blue'
);

export const workLogUiClassNames = {
  stack: 'ims-cell-stack ims-cell-stack-tight',
  meta: 'ims-cell-meta',
  title: 'ims-cell-title',
};

export const renderWorkLogCellBlock = (primary, secondaryLines = []) => (
  <div className={workLogUiClassNames.stack}>
    <div className={workLogUiClassNames.title}>{primary || '-'}</div>
    {secondaryLines.filter(Boolean).map((line, index) => (
      <div key={index} className={workLogUiClassNames.meta}>{line}</div>
    ))}
  </div>
);

// ACTIVE UI GUARD - konteks estimasi modal complete Work Log.
// Read-only preview; bukan business rule produksi dan tidak memutasi data.
export const renderCompleteWorkLogEstimateInfo = (record) => {
  if (!record) return null;

  const unitLabel = record.targetUnit || record.unit || '';
  const targetLabel = [
    record.targetName || '-',
    record.targetVariantLabel ? `Varian: ${record.targetVariantLabel}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card
      size="small"
      className="ims-readonly-panel"
      style={{ marginBottom: 16 }}
      bodyStyle={{ padding: 12 }}
    >
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Space size={6} wrap>
          <Typography.Text strong>Acuan estimasi hasil</Typography.Text>
          <Tag color="default">Read-only</Tag>
        </Space>
        <Typography.Text>{targetLabel}</Typography.Text>
        <Typography.Text type="secondary" className="ims-cell-meta">
          Tahapan: {record.stepName || '-'} · No. Order: {record.productionOrderCode || '-'}
        </Typography.Text>
        <Typography.Text type="secondary" className="ims-cell-meta">
          Qty batch: {formatNumber(record.plannedQty || 0)} · Estimasi hasil: {formatNumber(record.theoreticalOutputQty || 0)} {unitLabel}
        </Typography.Text>
      </Space>
    </Card>
  );
};

const formatWorkLogDisplayDate = (value, format = 'DD/MM/YYYY') => {
  const rawValue = value?.toDate ? value.toDate() : value;
  return rawValue ? dayjs(rawValue).format(format) : '-';
};


const renderProductionWorkLogActions = ({
  block = false,
  record,
  onComplete,
  onEdit,
  onViewDetail,
}) => {
  const buttonClassName = [
    'ims-action-button',
    block ? 'ims-action-button--block' : null,
  ].filter(Boolean).join(' ');
  const editable = isEditableProductionWorkLog(record);

  return (
    <Space direction="vertical" size={6} className="ims-action-group ims-action-group--vertical">
      <Button
        className={buttonClassName}
        size="small"
        icon={<EyeOutlined />}
        onClick={() => onViewDetail?.(record)}
      >
        Detail
      </Button>
      {editable ? (
        <Button
          className={buttonClassName}
          size="small"
          icon={<EditOutlined />}
          onClick={() => onEdit?.(record)}
        >
          Edit
        </Button>
      ) : null}
      {editable ? (
        <Button
          className={buttonClassName}
          size="small"
          type="primary"
          onClick={() => onComplete?.(record)}
        >
          Selesaikan
        </Button>
      ) : null}
    </Space>
  );
};

export const createProductionWorkLogColumns = ({
  onComplete,
  onEdit,
  onViewDetail,
} = {}) => [
  {
    title: 'No. Work Log',
    dataIndex: 'workNumber',
    key: 'workNumber',
    width: 105,
    render: (value) => (
      <Typography.Text strong>
        {resolveDisplayReference({ workNumber: value }, { fields: ['workNumber'], fallback: '-' })}
      </Typography.Text>
    ),
  },
  {
    title: 'Tanggal',
    dataIndex: 'workDate',
    key: 'workDate',
    width: 130,
    render: (value) => formatWorkLogDisplayDate(value),
  },
  {
    title: 'Target / Tahapan',
    key: 'targetStep',
    width: 240,
    render: (_, record) => renderWorkLogCellBlock(record.targetName || '-', [
      record.stepName || '-',
      record.targetVariantLabel ? `Varian: ${record.targetVariantLabel}` : null,
      `No. Order: ${record.productionOrderCode || '-'}`,
    ]),
  },
  {
    title: 'Qty',
    key: 'qty',
    width: 130,
    render: (_, record) => (
      <Space direction="vertical" size={0}>
        <Typography.Text>Batch: {formatNumber(record.plannedQty)}</Typography.Text>
        <Typography.Text type="secondary">Estimasi: {formatNumber(record.theoreticalOutputQty || 0)}</Typography.Text>
        <Typography.Text type="secondary">Hasil baik: {formatNumber(record.goodQty)}</Typography.Text>
      </Space>
    ),
  },
  {
    title: 'Biaya Aktual',
    dataIndex: 'totalCostActual',
    key: 'totalCostActual',
    width: 95,
    render: (value) => formatCurrency(value),
  },
  {
    title: 'Sumber',
    dataIndex: 'sourceType',
    key: 'sourceType',
    width: 105,
    render: (value) => (
      <Tag className="ims-status-tag" color={getWorkLogSourceTagColor(value)}>
        {WORK_LOG_SOURCE_TYPE_MAP[value] || value || '-'}
      </Tag>
    ),
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    width: 120,
    render: (value) => (
      <Tag className="ims-status-tag" color={getWorkLogStatusTagColor(value)}>
        {WORK_LOG_STATUS_MAP[value] || '-'}
      </Tag>
    ),
  },
  {
    title: 'Aksi',
    key: 'actions',
    width: 160,
    render: (_, record) => renderProductionWorkLogActions({
      record,
      onComplete,
      onEdit,
      onViewDetail,
    }),
  },
];

export const createProductionWorkLogMobileCardConfig = ({
  onComplete,
  onEdit,
  onViewDetail,
} = {}) => ({
  title: (record) => resolveDisplayReference(record, { fields: ['workNumber'], fallback: '-' }),
  subtitle: (record) => [
    formatWorkLogDisplayDate(record.workDate),
    record.targetName || 'Target belum tercatat',
    record.stepName || null,
  ].filter(Boolean),
  tags: (record) => [
    <Tag key="source" color={getWorkLogSourceTagColor(record.sourceType)}>
      {WORK_LOG_SOURCE_TYPE_MAP[record.sourceType] || record.sourceType || '-'}
    </Tag>,
    <Tag key="status" color={getWorkLogStatusTagColor(record.status)}>
      {WORK_LOG_STATUS_MAP[record.status] || '-'}
    </Tag>,
  ],
  meta: [
    { label: 'Batch', value: (record) => formatNumber(record.plannedQty) },
    { label: 'Hasil Baik', value: (record) => formatNumber(record.goodQty) },
    { label: 'Biaya Aktual', value: (record) => formatCurrency(record.totalCostActual) },
  ],
  content: (record) => [
    record.targetVariantLabel ? `Varian: ${record.targetVariantLabel}` : null,
    `No. Order: ${record.productionOrderCode || '-'}`,
    `Estimasi output: ${formatNumber(record.theoreticalOutputQty || 0)}`,
  ].filter(Boolean),
  actions: (record) => renderProductionWorkLogActions({
    block: true,
    record,
    onComplete,
    onEdit,
    onViewDetail,
  }),
});
