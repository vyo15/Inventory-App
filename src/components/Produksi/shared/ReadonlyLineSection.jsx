import React from 'react';
import { Divider, Table } from 'antd';

const ReadonlyLineSection = ({
  title,
  dataSource = [],
  columns = [],
  emptyText,
}) => (
  <>
    <Divider orientation="left">{title}</Divider>
    <Table
      rowKey={(record) => record.id}
      pagination={false}
      size="small"
      dataSource={dataSource}
      locale={{ emptyText }}
      columns={columns}
    />
  </>
);

export default ReadonlyLineSection;
