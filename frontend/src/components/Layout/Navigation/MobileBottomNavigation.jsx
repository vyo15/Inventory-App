import {
  useEffect,
  useMemo,
  useState } from "react";
import { Button,
  Drawer,
  Tag,
} from "antd";
import {
  AppstoreOutlined,
  CloseOutlined,
  HomeOutlined,
} from "@ant-design/icons";
import { HiOutlineMoon, HiOutlineSun } from "react-icons/hi2";
import { useLocation, useNavigate } from "react-router-dom";
import EmptyStateBlock from "../Feedback/EmptyStateBlock";
import { sidebarMenuItems } from "../../../config/sidebarMenu";
import useAuth from "../../../hooks/useAuth";
import {
  ROLE_LABELS,
  filterSidebarMenuItemsByRole,
} from "../../../utils/auth/roleAccess";
import {
  findMenuItemByKey,
  getTopLevelNavigationTarget,
  isPathWithinMenuItem,
} from "../../../utils/navigation/sidebarNavigation";
import "./MobileBottomNavigation.css";

const PRIMARY_MOBILE_MENU_KEYS = [
  "dashboard",
  "inventory",
  "transactions",
  "productions",
];

// =========================
// SECTION: Mobile Bottom Navigation — AKTIF / GUARDED
// Fungsi:
// - menampilkan empat shortcut mobile dan satu tombol Menu IMS di tengah;
// - membuka seluruh top-level module sebagai bottom sheet role-aware.
// Guardrail:
// - source menu tetap sidebarMenuItems + filterSidebarMenuItemsByRole;
// - tombol tengah hanya membuka navigasi, tidak menjalankan create/mutation/destructive action.
// =========================
const MobileBottomNavigation = ({ darkTheme, toggleTheme }) => {
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const roleAwareMenuItems = useMemo(() => {
    return filterSidebarMenuItemsByRole(sidebarMenuItems, profile?.role);
  }, [profile?.role]);

  const primaryMenuItems = useMemo(() => {
    return PRIMARY_MOBILE_MENU_KEYS
      .map((menuKey) => findMenuItemByKey(roleAwareMenuItems, menuKey))
      .filter(Boolean);
  }, [roleAwareMenuItems]);

  const sheetMenuItems = useMemo(() => {
    return roleAwareMenuItems.filter((menuItem) => menuItem.key !== "dashboard");
  }, [roleAwareMenuItems]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const handleNavigate = (menuItem) => {
    const targetPath = getTopLevelNavigationTarget(menuItem);

    if (targetPath) {
      navigate(targetPath);
    }
  };

  return (
    <>
      <div className="mobile-bottom-navigation-wrap">
        <nav className="mobile-bottom-navigation" aria-label="Navigasi utama mobile IMS">
          {primaryMenuItems.slice(0, 2).map((menuItem) => {
            const IconComponent = menuItem.icon || HomeOutlined;
            const isActive = isPathWithinMenuItem(menuItem, location.pathname);

            return (
              <button
                type="button"
                key={menuItem.key}
                className={`mobile-bottom-navigation-item${isActive ? " is-active" : ""}`}
                onClick={() => handleNavigate(menuItem)}
                aria-current={isActive ? "page" : undefined}
              >
                <IconComponent />
                <span>{menuItem.key === "inventory" ? "Stok" : menuItem.label}</span>
              </button>
            );
          })}

          <span className="mobile-bottom-navigation-center-space" aria-hidden="true" />

          {primaryMenuItems.slice(2).map((menuItem) => {
            const IconComponent = menuItem.icon || AppstoreOutlined;
            const isActive = isPathWithinMenuItem(menuItem, location.pathname);

            return (
              <button
                type="button"
                key={menuItem.key}
                className={`mobile-bottom-navigation-item${isActive ? " is-active" : ""}`}
                onClick={() => handleNavigate(menuItem)}
                aria-current={isActive ? "page" : undefined}
              >
                <IconComponent />
                <span>{menuItem.label}</span>
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          className={`mobile-bottom-navigation-trigger${isMenuOpen ? " is-open" : ""}`}
          onClick={() => setIsMenuOpen(true)}
          aria-label="Buka seluruh menu IMS"
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? <CloseOutlined /> : <AppstoreOutlined />}
        </button>
        <span className="mobile-bottom-navigation-trigger-label">Menu</span>
      </div>

      <Drawer
        open={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        placement="bottom"
        height="min(76dvh, 650px)"
        title={null}
        closable={false}
        rootClassName="mobile-module-sheet-root"
        className="mobile-module-sheet"
      >
        <div className="mobile-module-sheet-handle" aria-hidden="true" />

        <div className="mobile-module-sheet-header">
          <div>
            <h2>Menu IMS</h2>
            <p>Pilih modul yang ingin dibuka.</p>
          </div>

          <Button
            type="text"
            className="mobile-module-sheet-close"
            icon={<CloseOutlined />}
            onClick={() => setIsMenuOpen(false)}
            aria-label="Tutup menu IMS"
          />
        </div>

        <div className="mobile-module-sheet-tools">
          <Button
            className="mobile-module-sheet-tool"
            icon={darkTheme ? <HiOutlineSun size={17} /> : <HiOutlineMoon size={17} />}
            onClick={toggleTheme}
          >
            {darkTheme ? "Mode terang" : "Mode gelap"}
          </Button>

          <Tag className="mobile-module-sheet-role-tag">
            {ROLE_LABELS[profile?.role] || "User"}
          </Tag>
        </div>

        {sheetMenuItems.length > 0 ? (
          <div className="mobile-module-sheet-grid">
            {sheetMenuItems.map((menuItem) => {
              const IconComponent = menuItem.icon || AppstoreOutlined;
              const isActive = isPathWithinMenuItem(menuItem, location.pathname);

              return (
                <button
                  type="button"
                  key={menuItem.key}
                  className={`mobile-module-sheet-card${isActive ? " is-active" : ""}`}
                  onClick={() => handleNavigate(menuItem)}
                >
                  <span className="mobile-module-sheet-card-icon">
                    <IconComponent />
                  </span>
                  <strong>{menuItem.label}</strong>
                  <span>
                    {menuItem.hubDescription ||
                      menuItem.description ||
                      "Buka modul IMS."}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyStateBlock compact description="Tidak ada menu untuk role ini" />
        )}
      </Drawer>
    </>
  );
};

export default MobileBottomNavigation;
