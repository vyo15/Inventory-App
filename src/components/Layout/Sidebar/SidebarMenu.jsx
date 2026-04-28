import React, { useEffect, useMemo, useState } from "react";
import { Empty, Menu } from "antd";
import { Link, useLocation } from "react-router-dom";
import { sidebarMenuItems } from "../../../config/sidebarMenu";
import useAuth from "../../../hooks/useAuth";
import { filterSidebarMenuItemsByRole } from "../../../utils/auth/roleAccess";
import "./SidebarMenu.css";

// =========================
// SECTION: Helper - Find open parent keys by current path — AKTIF
// Fungsi:
// - mencari parent menu aktif berdasarkan pathname saat ini;
// - dipakai agar saat user pindah halaman, grup menu yang relevan tetap terbuka.
// Hubungan flow aplikasi:
// - bekerja pada menu yang sudah difilter role sehingga parent kosong tidak terbuka.
// Status:
// - AKTIF untuk sidebar role-aware.
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
// SECTION: Helper - Build Ant Design menu items — AKTIF / GUARDED
// Fungsi:
// - mengubah config menu yang sudah difilter menjadi format Ant Design Menu;
// - level group utama tetap memakai icon;
// - submenu sengaja tanpa icon agar sidebar lebih rapi.
// Hubungan flow aplikasi:
// - hanya item yang lolos role guard yang akan dirender.
// Status:
// - AKTIF.
// - GUARDED: jangan bypass filter role dengan langsung memakai sidebarMenuItems mentah.
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
// SECTION: Sidebar Menu — AKTIF / GUARDED
// Fungsi:
// - menampilkan menu berdasarkan role user aktif;
// - menyembunyikan parent menu jika tidak ada child yang boleh diakses;
// - menjaga route guard tetap menjadi pengaman utama untuk akses langsung lewat URL.
// Hubungan flow aplikasi:
// - role berasal dari AuthContext/profile `system_users/{uid}`;
// - matrix role berasal dari roleAccess.js dan metadata sidebarMenu.js.
// Status:
// - AKTIF untuk Fase D Sidebar/Menu Guard.
// - GUARDED: hide menu bukan security final; ProtectedRoute dan Firestore Rules tetap wajib.
// Legacy / cleanup:
// - tidak ada legacy; menu User Management belum ditambahkan karena Fase E belum dibuat.
// =========================
const SidebarMenu = ({ darkTheme }) => {
  const location = useLocation();
  const { profile } = useAuth();
  const activeRole = profile?.role;

  const roleAwareMenuItems = useMemo(() => {
    return filterSidebarMenuItemsByRole(sidebarMenuItems, activeRole);
  }, [activeRole]);

  // =========================
  // SECTION: Derived Menu State — AKTIF / GUARDED
  // Fungsi:
  // - selectedMenuKeys menjaga halaman aktif tetap tersorot;
  // - defaultOpenParentKeys membuka parent dari route yang sedang aktif;
  // - rootSubmenuKeys dipakai untuk mode accordion pada menu level utama.
  // Hubungan flow aplikasi:
  // - semua state dihitung dari menu yang sudah difilter role.
  // =========================
  const selectedMenuKeys = useMemo(() => {
    return [location.pathname];
  }, [location.pathname]);

  const defaultOpenParentKeys = useMemo(() => {
    return findOpenParentKeysByPath(roleAwareMenuItems, location.pathname);
  }, [roleAwareMenuItems, location.pathname]);

  const rootSubmenuKeys = useMemo(() => {
    return roleAwareMenuItems
      .filter((menuItem) => menuItem.children?.length)
      .map((menuItem) => menuItem.key);
  }, [roleAwareMenuItems]);

  const antdMenuItems = useMemo(() => {
    return buildAntdMenuItems(roleAwareMenuItems);
  }, [roleAwareMenuItems]);

  // =========================
  // SECTION: Controlled Open Keys — AKTIF
  // Fungsi:
  // - sidebar dibuat terkontrol agar perilaku buka/tutup konsisten;
  // - saat route atau role berubah, parent aktif otomatis ikut terbuka.
  // =========================
  const [openMenuKeys, setOpenMenuKeys] = useState(defaultOpenParentKeys);

  useEffect(() => {
    setOpenMenuKeys(defaultOpenParentKeys);
  }, [defaultOpenParentKeys]);

  // =========================
  // SECTION: Event Handlers — AKTIF
  // Fungsi:
  // - hanya satu group utama yang terbuka dalam satu waktu;
  // - saat user buka group lain, group sebelumnya otomatis tertutup.
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

  if (roleAwareMenuItems.length === 0) {
    return (
      <div className="sidebar-menu-scroll">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Tidak ada menu untuk role ini"
        />
      </div>
    );
  }

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
