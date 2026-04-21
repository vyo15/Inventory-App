import React from 'react';
import { Card, Row } from 'antd';

// -----------------------------------------------------------------------------
// Foundation kartu filter produksi.
// Semua halaman produksi yang memakai komponen ini akan ikut fondasi spacing batch 1
// tanpa perlu menulis ulang margin / gap di setiap page.
// -----------------------------------------------------------------------------
const ProductionFilterCard = ({ children }) => {
  return (
    <Card className="ims-section-card ims-filter-card">
      <Row className="ims-filter-row" gutter={[12, 12]}>{children}</Row>
    </Card>
  );
};

export default ProductionFilterCard;
