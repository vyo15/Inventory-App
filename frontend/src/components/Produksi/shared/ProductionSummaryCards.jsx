import SummaryStatGrid from '../../Layout/Display/SummaryStatGrid';

// -----------------------------------------------------------------------------
// Summary cards produksi memakai shared SummaryStatGrid agar tinggi, radius,
// spacing, light/dark mode, dan pola compact konsisten dengan halaman lain.
// Komponen ini tetap presentational dan tidak mengubah perhitungan produksi.
// -----------------------------------------------------------------------------
const ProductionSummaryCards = ({
  items = [],
  columns = { xs: 24, sm: 12, md: 6 },
  variant = 'executive',
  highlightKey = null,
}) => {
  return (
    <SummaryStatGrid
      items={items}
      columns={columns}
      variant={variant}
      highlightKey={highlightKey}
      className="ims-summary-row"
    />
  );
};

export default ProductionSummaryCards;
