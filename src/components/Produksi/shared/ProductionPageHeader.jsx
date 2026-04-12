import React from 'react';
import { Button, Card, Col, Row, Space, Typography } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';

const ProductionPageHeader = ({
  title,
  description,
  onRefresh,
  onAdd,
  addLabel = 'Tambah',
  extra,
}) => {
  return (
    <Card style={{ marginBottom: 16 }}>
      <Row justify="space-between" align="middle" gutter={[16, 16]}>
        <Col>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          {description ? (
            <Typography.Text type="secondary">{description}</Typography.Text>
          ) : null}
        </Col>

        <Col>
          <Space wrap>
            {onRefresh ? (
              <Button icon={<ReloadOutlined />} onClick={onRefresh}>
                Refresh
              </Button>
            ) : null}
            {onAdd ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
                {addLabel}
              </Button>
            ) : null}
            {extra}
          </Space>
        </Col>
      </Row>
    </Card>
  );
};

export default ProductionPageHeader;
