import React from 'react';
import { Alert, Button, Divider, Space, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import DataTableView from '../../Layout/Table/DataTableView';

const pickLineTitle = (record = {}) => (
  record.itemName
  || record.materialName
  || record.outputName
  || record.stepName
  || record.productName
  || record.name
  || record.label
  || 'Item'
);

const buildLineMeta = (record = {}) => Object.entries(record)
  .filter(([key, value]) => !['id', 'key', 'createdAt', 'updatedAt'].includes(key) && value !== null && value !== undefined && value !== '')
  .slice(0, 4)
  .map(([key, value]) => ({
    label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase()),
    value: () => String(value),
  }));

const defaultLineMobileCardConfig = {
  title: pickLineTitle,
  subtitle: (record) => [record.code, record.type, record.category].filter(Boolean),
  meta: buildLineMeta,
};

const EditableLineSection = ({
  title,
  description,
  alert,
  addButtonText,
  onAdd,
  showAddButton = true,
  addButtonDisabled = false,
  dataSource = [],
  columns = [],
  emptyText,
  mobileCardConfig = defaultLineMobileCardConfig,
}) => (
  <>
    <Divider orientation="left">{title}</Divider>

    {description ? (
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
        {description}
      </Typography.Text>
    ) : null}

    {alert ? <Alert style={{ marginBottom: 12 }} showIcon {...alert} /> : null}

    {showAddButton && onAdd ? (
      <Space style={{ marginBottom: 12 }} className="ims-mobile-line-action">
        <Button type="dashed" icon={<PlusOutlined />} onClick={onAdd} disabled={addButtonDisabled}>
          {addButtonText}
        </Button>
      </Space>
    ) : null}

    <DataTableView
      className="app-data-table"
      rowKey={(record) => record.id}
      pagination={false}
      size="small"
      dataSource={dataSource}
      locale={{ emptyText }}
      columns={columns}
      mobileCardConfig={mobileCardConfig}
    />
  </>
);

export default EditableLineSection;
