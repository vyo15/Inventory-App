import React from 'react';
import { Card, Col, Row, Statistic } from 'antd';

const ProductionSummaryCards = ({ items = [], columns = { xs: 24, sm: 12, md: 6 } }) => {
  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      {items.map((item) => (
        <Col key={item.key || item.title} {...columns}>
          <Card>
            <Statistic title={item.title} value={item.value} suffix={item.suffix} />
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default ProductionSummaryCards;
