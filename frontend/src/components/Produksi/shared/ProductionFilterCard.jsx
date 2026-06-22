import { Card } from 'antd';
import FilterBar from '../../Layout/Filters/FilterBar';

// Compatibility wrapper: surface Card produksi dipertahankan, sedangkan logic
// filter desktop/mobile didelegasikan ke FilterBar shared.
const ProductionFilterCard = ({
  children,
  mobileCompact = true,
  mobilePrimaryCount = 1,
  mobileFilterTitle = 'Filter produksi',
  mobileFilterSubtitle = 'Search utama tetap terlihat. Filter tambahan dipindahkan ke panel mobile agar halaman produksi lebih ringkas.',
}) => (
  <Card className="ims-section-card ims-filter-card ims-production-filter-card">
    <FilterBar
      className="ims-production-filter-card__bar"
      surface={false}
      mobileCompact={mobileCompact}
      mobilePrimaryCount={mobilePrimaryCount}
      mobileFilterTitle={mobileFilterTitle}
      mobileFilterSubtitle={mobileFilterSubtitle}
    >
      {children}
    </FilterBar>
  </Card>
);

export default ProductionFilterCard;
