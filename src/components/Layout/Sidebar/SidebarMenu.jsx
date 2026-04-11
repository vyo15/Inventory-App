import React, { useEffect, useMemo, useState } from "react";
import { Menu } from "antd";
import { Link, useLocation } from "react-router-dom";
import { sidebarMenuItems } from "../../../config/sidebarMenu";
import "./SidebarMenu.css";

// =========================
// SECTION: Helper - Find open parent keys by current path
// =========================
const findOpenParentKeysByPath = (
  menuItems,
  currentPath,
  parentKeyTrail = [],
) => {
  for (const menuItem of menuItems) {
    if (menuItem.path === currentPath) {
      return parentKeyTrail;
    }

    if (menuItem.children?.length) {
      const matchedParentKeys = findOpenParentKeysByPath(
        menuItem.children,
        currentPath,
        [...parentKeyTrail, menuItem.key],
      );

      if (matchedParentKeys.length > 0) {
        return matchedParentKeys;
      }
    }
  }

  return [];
};

// =========================
// SECTION: Helper - Build Ant Design menu items
// =========================
const buildAntdMenuItems = (menuItems) => {
  return menuItems.map((menuItem) => {
    const IconComponent = menuItem.icon;

    if (menuItem.children?.length) {
      return {
        key: menuItem.key,
        icon: IconComponent ? <IconComponent /> : null,
        label: menuItem.label,
        children: buildAntdMenuItems(menuItem.children),
      };
    }

    return {
      key: menuItem.path,
      icon: IconComponent ? <IconComponent /> : null,
      label: <Link to={menuItem.path}>{menuItem.label}</Link>,
    };
  });
};

// =========================
// SECTION: Sidebar Menu
// =========================
const SidebarMenu = ({ darkTheme }) => {
  const location = useLocation();

  // =========================
  // SECTION: Derived Menu State
  // =========================
  const selectedMenuKeys = useMemo(() => {
    return [location.pathname];
  }, [location.pathname]);

  const defaultOpenParentKeys = useMemo(() => {
    return findOpenParentKeysByPath(sidebarMenuItems, location.pathname);
  }, [location.pathname]);

  const antdMenuItems = useMemo(() => {
    return buildAntdMenuItems(sidebarMenuItems);
  }, []);

  // =========================
  // SECTION: Controlled Open Keys
  // =========================
  const [openMenuKeys, setOpenMenuKeys] = useState(defaultOpenParentKeys);

  useEffect(() => {
    setOpenMenuKeys(defaultOpenParentKeys);
  }, [defaultOpenParentKeys]);

  // =========================
  // SECTION: Event Handlers
  // =========================
  const handleOpenMenuChange = (nextOpenKeys) => {
    setOpenMenuKeys(nextOpenKeys);
  };

  return (
    <div className="sidebar-menu-scroll">
      <Menu
        mode="inline"
        theme={darkTheme ? "dark" : "light"}
        className={`sidebar-menu ${darkTheme ? "dark" : "light"}`}
        selectedKeys={selectedMenuKeys}
        openKeys={openMenuKeys}
        onOpenChange={handleOpenMenuChange}
        items={antdMenuItems}
      />
    </div>
  );
};

export default SidebarMenu;
