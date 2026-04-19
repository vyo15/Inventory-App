import React, { useEffect, useMemo, useState } from "react";
import { Menu } from "antd";
import { Link, useLocation } from "react-router-dom";
import { sidebarMenuItems } from "../../../config/sidebarMenu";
import "./SidebarMenu.css";

// =========================
// SECTION: Helper - Find open parent keys by current path
// Fungsi:
// - mencari parent menu aktif berdasarkan pathname saat ini
// - dipakai agar saat user pindah halaman, grup menu yang relevan tetap terbuka
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
// Fungsi:
// - level group utama tetap memakai icon
// - submenu sengaja tanpa icon agar sidebar lebih rapi dan tidak terlalu ramai
// =========================
const buildAntdMenuItems = (menuItems, level = 0) => {
  return menuItems.map((menuItem) => {
    const IconComponent = menuItem.icon;

    if (menuItem.children?.length) {
      return {
        key: menuItem.key,
        icon: level === 0 && IconComponent ? <IconComponent /> : null,
        label: menuItem.label,
        children: buildAntdMenuItems(menuItem.children, level + 1),
      };
    }

    return {
      key: menuItem.path,
      icon: level === 0 && IconComponent ? <IconComponent /> : null,
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
  // Fungsi:
  // - selectedMenuKeys menjaga halaman aktif tetap tersorot
  // - defaultOpenParentKeys membuka parent dari route yang sedang aktif
  // - rootSubmenuKeys dipakai untuk mode accordion pada menu level utama
  // =========================
  const selectedMenuKeys = useMemo(() => {
    return [location.pathname];
  }, [location.pathname]);

  const defaultOpenParentKeys = useMemo(() => {
    return findOpenParentKeysByPath(sidebarMenuItems, location.pathname);
  }, [location.pathname]);

  const rootSubmenuKeys = useMemo(() => {
    return sidebarMenuItems
      .filter((menuItem) => menuItem.children?.length)
      .map((menuItem) => menuItem.key);
  }, []);

  const antdMenuItems = useMemo(() => {
    return buildAntdMenuItems(sidebarMenuItems);
  }, []);

  // =========================
  // SECTION: Controlled Open Keys
  // Fungsi:
  // - sidebar dibuat terkontrol agar perilaku buka/tutup konsisten
  // - saat route berubah, parent aktif otomatis ikut terbuka
  // =========================
  const [openMenuKeys, setOpenMenuKeys] = useState(defaultOpenParentKeys);

  useEffect(() => {
    setOpenMenuKeys(defaultOpenParentKeys);
  }, [defaultOpenParentKeys]);

  // =========================
  // SECTION: Event Handlers
  // Fungsi:
  // - hanya satu group utama yang terbuka dalam satu waktu
  // - saat user buka group lain, group sebelumnya otomatis tertutup
  // =========================
  const handleOpenMenuChange = (nextOpenKeys) => {
    const latestOpenedKey = nextOpenKeys.find(
      (menuKey) => !openMenuKeys.includes(menuKey),
    );

    if (!latestOpenedKey) {
      setOpenMenuKeys(nextOpenKeys);
      return;
    }

    if (rootSubmenuKeys.includes(latestOpenedKey)) {
      setOpenMenuKeys([latestOpenedKey]);
      return;
    }

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
