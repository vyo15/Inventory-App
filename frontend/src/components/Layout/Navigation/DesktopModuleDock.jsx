import { useMemo } from "react";
import { Empty, Tooltip } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import sidebarRailMask from "../../../assets/layout/sidebar-rail-mask.svg";
import sidebarRailMaskDark from "../../../assets/layout/sidebar-rail-mask-dark.svg";
import { sidebarMenuItems } from "../../../config/sidebarMenu";
import useAuth from "../../../hooks/useAuth";
import { filterSidebarMenuItemsByRole } from "../../../utils/auth/roleAccess";
import {
  getTopLevelNavigationTarget,
  isPathWithinMenuItem,
} from "../../../utils/navigation/sidebarNavigation";
import "./DesktopModuleDock.css";

// =========================
// SECTION: Desktop Floating Module Dock — AKTIF / GUARDED
// Fungsi:
// - menampilkan top-level navigation IMS sebagai floating dock desktop;
// - child menu dibuka melalui Module Hub, bukan submenu pop-up.
// Guardrail:
// - sumber menu tetap sidebarMenuItems yang sudah difilter role;
// - tidak mengubah ProtectedRoute, service, stock, transaksi, produksi, payroll, atau finance.
// =========================
const DesktopModuleDock = ({ darkTheme }) => {
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const roleAwareMenuItems = useMemo(() => {
    return filterSidebarMenuItemsByRole(sidebarMenuItems, profile?.role);
  }, [profile?.role]);

  if (roleAwareMenuItems.length === 0) {
    return (
      <aside className="desktop-module-dock" aria-label="Navigasi utama IMS">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={false} />
      </aside>
    );
  }

  return (
    <aside className="desktop-module-dock" aria-label="Navigasi utama IMS">
      <img
        src={darkTheme ? sidebarRailMaskDark : sidebarRailMask}
        alt=""
        aria-hidden="true"
        className="desktop-module-dock-shape"
      />

      <nav className="desktop-module-dock-nav">
        {roleAwareMenuItems.map((menuItem) => {
          const IconComponent = menuItem.icon;
          const targetPath = getTopLevelNavigationTarget(menuItem);
          const isActive = isPathWithinMenuItem(menuItem, location.pathname);

          return (
            <Tooltip key={menuItem.key} title={menuItem.label} placement="right">
              <button
                type="button"
                className={`desktop-module-dock-button${isActive ? " is-active" : ""}`}
                onClick={() => targetPath && navigate(targetPath)}
                aria-label={`Buka ${menuItem.label}`}
                aria-current={isActive ? "page" : undefined}
              >
                {IconComponent ? <IconComponent /> : null}
              </button>
            </Tooltip>
          );
        })}
      </nav>
    </aside>
  );
};

export default DesktopModuleDock;
