import { Children, cloneElement, isValidElement, useMemo, useState } from 'react';
import { Button, Card, Col, Row } from 'antd';
import { FilterOutlined } from '@ant-design/icons';
import MobileFilterDrawer from '../../Layout/Mobile/MobileFilterDrawer';
import './ProductionFilterCard.css';

// -----------------------------------------------------------------------------
// Foundation kartu filter produksi.
// Semua halaman produksi yang memakai komponen ini akan ikut fondasi spacing batch 1
// tanpa perlu menulis ulang margin / gap di setiap page.
// -----------------------------------------------------------------------------
const ProductionFilterCard = ({
  children,
  mobileCompact = true,
  mobilePrimaryCount = 1,
  mobileFilterTitle = 'Filter produksi',
  mobileFilterSubtitle = 'Search utama tetap terlihat. Filter tambahan dipindahkan ke panel mobile agar halaman produksi lebih ringkas.',
}) => {
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const childItems = useMemo(() => Children.toArray(children).filter(Boolean), [children]);
  const safeMobilePrimaryCount = Math.max(0, Number(mobilePrimaryCount) || 0);
  const shouldUseMobileDrawer = Boolean(mobileCompact && childItems.length > safeMobilePrimaryCount);

  const decorateChild = (child, index) => {
    if (!shouldUseMobileDrawer || !isValidElement(child)) {
      return child;
    }

    const mobileClassName = index < safeMobilePrimaryCount
      ? 'ims-production-filter-card__primary'
      : 'ims-production-filter-card__advanced';

    return cloneElement(child, {
      className: [child.props.className, mobileClassName].filter(Boolean).join(' '),
    });
  };

  return (
    <Card className="ims-section-card ims-filter-card ims-production-filter-card">
      <Row className="ims-filter-row" gutter={[12, 12]}>
        {childItems.map(decorateChild)}
        {shouldUseMobileDrawer ? (
          <Col xs={24} sm={12} className="ims-production-filter-card__trigger">
            <Button
              block
              icon={<FilterOutlined />}
              onClick={() => setMobileFilterOpen(true)}
            >
              Filter
            </Button>
          </Col>
        ) : null}
      </Row>

      {shouldUseMobileDrawer ? (
        <MobileFilterDrawer
          open={mobileFilterOpen}
          onClose={() => setMobileFilterOpen(false)}
          onApply={() => setMobileFilterOpen(false)}
          title={mobileFilterTitle}
          subtitle={mobileFilterSubtitle}
        >
          <Row gutter={[12, 12]}>{childItems.slice(safeMobilePrimaryCount)}</Row>
        </MobileFilterDrawer>
      ) : null}
    </Card>
  );
};

export default ProductionFilterCard;
