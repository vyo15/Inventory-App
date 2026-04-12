import React from 'react';
import { Card, Row } from 'antd';

const ProductionFilterCard = ({ children }) => {
  return (
    <Card style={{ marginBottom: 16 }}>
      <Row gutter={[12, 12]}>{children}</Row>
    </Card>
  );
};

export default ProductionFilterCard;
