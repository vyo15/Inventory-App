import React from 'react';
import { Card, Col, Row, Statistic } from 'antd';

// -----------------------------------------------------------------------------
// Summary cards produksi memakai fondasi batch 1 agar tinggi, radius, dan spacing
// seragam lintas halaman produksi.
// -----------------------------------------------------------------------------
const ProductionSummaryCards = ({ items = [], columns = { xs: 24, sm: 12, md: 6 } }) => {
  return (
    <Row className="ims-summary-row" gutter={[16, 16]}>
      {items.map((item) => (
        <Col key={item.key || item.title} {...columns}>
          <Card className="ims-section-card ims-summary-card">
            <Statistic title={item.title} value={item.value} suffix={item.suffix} />
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default ProductionSummaryCards;
