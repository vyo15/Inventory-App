import React from 'react';
import { Alert, Button, Divider, Space, Table, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

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
      <Space style={{ marginBottom: 12 }}>
        <Button type="dashed" icon={<PlusOutlined />} onClick={onAdd} disabled={addButtonDisabled}>
          {addButtonText}
        </Button>
      </Space>
    ) : null}

    <Table
      className="app-data-table"
      rowKey={(record) => record.id}
      pagination={false}
      size="small"
      dataSource={dataSource}
      locale={{ emptyText }}
      columns={columns}
    />
  </>
);

export default EditableLineSection;
