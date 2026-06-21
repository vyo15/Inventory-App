import { Children, cloneElement, isValidElement, useMemo, useState } from "react";
import { Button, Col, Row, Space } from "antd";
import { FilterOutlined } from "@ant-design/icons";
import MobileFilterDrawer from "../Mobile/MobileFilterDrawer";
import "./FilterBar.css";

// =========================
// SECTION: Shared Filter Bar
// Fungsi:
// - menjadi fondasi area filter yang konsisten antar halaman
// - memisahkan blok filter dan blok action tanpa mengubah logic halaman
// Catatan:
// - children idealnya berupa elemen Col agar gutter tetap konsisten
// - komponen ini cukup generik untuk finance, laporan, dan inventory display
// =========================
const FilterBar = ({
  children,
  actions,
  className = "",
  surface = true,
  mobileCompact = true,
  mobilePrimaryCount = 1,
  mobileFilterTitle = "Filter lanjutan",
  mobileFilterSubtitle = "Search utama tetap di halaman. Filter tambahan dipindahkan ke panel ini agar tampilan mobile lebih ringkas.",
  mobileFilterButtonLabel = "Filter",
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
      ? "filter-bar-mobile-primary"
      : "filter-bar-mobile-advanced";

    return cloneElement(child, {
      className: [child.props.className, mobileClassName].filter(Boolean).join(" "),
    });
  };

  const primaryChildren = childItems.map(decorateChild);
  const advancedChildren = shouldUseMobileDrawer ? childItems.slice(safeMobilePrimaryCount) : [];

  const filterBarClassName = [
    "filter-bar",
    surface ? "filter-bar-surface" : "",
    shouldUseMobileDrawer ? "filter-bar--mobile-compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={filterBarClassName}>
      <Row gutter={[12, 12]} align="middle" justify="space-between">
        <Col flex="auto">
          <Row gutter={[12, 12]}>
            {primaryChildren}
            {shouldUseMobileDrawer ? (
              <Col xs={24} sm={12} className="filter-bar-mobile-trigger">
                <Button
                  block
                  icon={<FilterOutlined />}
                  onClick={() => setMobileFilterOpen(true)}
                >
                  {mobileFilterButtonLabel}
                </Button>
              </Col>
            ) : null}
          </Row>
        </Col>

        {actions ? (
          <Col>
            <Space wrap className="filter-bar-actions">
              {actions}
            </Space>
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
          <Row gutter={[12, 12]}>{advancedChildren}</Row>
        </MobileFilterDrawer>
      ) : null}
    </div>
  );
};

export default FilterBar;
