import { Button, Drawer, Space, Typography } from "antd";
import "./MobileFilterDrawer.css";

const { Text } = Typography;

// =====================================================
// SECTION: MobileFilterDrawer — AKTIF / UI-ONLY
// Fungsi:
// - standar filter lanjutan mobile agar search tetap di halaman dan field lain masuk drawer/collapse.
// Guardrail:
// - presentational-only; tidak melakukan fetch/mutation dan tidak mengubah query/filter pemanggil.
// =====================================================
const MobileFilterDrawer = ({
  open,
  onClose,
  title = "Filter",
  subtitle = "Pilih filter lanjutan lalu terapkan.",
  children,
  onApply,
  onReset,
  applyText = "Terapkan",
  resetText = "Reset",
  applying = false,
}) => (
  <Drawer
    open={open}
    onClose={onClose}
    title={null}
    placement="bottom"
    height="auto"
    className="ims-mobile-filter-drawer"
    rootClassName="ims-mobile-filter-drawer-root"
    destroyOnClose={false}
  >
    <div className="ims-mobile-filter-drawer__handle" />
    <div className="ims-mobile-filter-drawer__header">
      <h2>{title}</h2>
      {subtitle ? <Text>{subtitle}</Text> : null}
    </div>
    <div className="ims-mobile-filter-drawer__body">{children}</div>
    <div className="ims-mobile-filter-drawer__footer">
      <Space.Compact block>
        {onReset ? <Button onClick={onReset}>{resetText}</Button> : null}
        <Button type="primary" loading={applying} onClick={onApply || onClose}>
          {applyText}
        </Button>
      </Space.Compact>
    </div>
  </Drawer>
);

export default MobileFilterDrawer;
