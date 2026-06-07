import React from 'react';
import { Card, Space, Tag, Typography } from 'antd';
import formatNumber from '../../../utils/formatters/numberId';
import { isProductionWorkLogCompleted } from '../../../utils/produksi/productionFlowGuards';

// IMS NOTE [AKTIF/GUARDED] - Helper UI Work Log Produksi.
// Fungsi: menampung formatter/tag/render read-only agar halaman utama tidak menumpuk helper presentasi.
// Batasan: helper ini tidak menulis stok, HPP, payroll, inventory log, data stok turunan, atau status Production Order.
export const safeWorkLogText = (value) => String(value || '').trim();

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
