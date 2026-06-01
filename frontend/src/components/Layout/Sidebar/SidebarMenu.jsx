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
// SECTION: Helper - Sidebar submenu relation map — AKTIF / GUARDED
// Fungsi:
// - membuat peta relasi submenu berdasarkan parent yang sama pada semua level;
// - dipakai agar accordion tidak lagi hanya berlaku di root menu, tetapi juga nested menu seperti Produksi.
// Hubungan flow aplikasi:
// - sumber data wajib dari roleAwareMenuItems agar menu tersembunyi oleh role tidak ikut dihitung sebagai sibling;
// - hanya mengatur state openKeys Ant Design Menu, bukan route, role, label, atau business flow.
// Alasan logic dipakai:
// - Ant Design onOpenChange hanya memberi daftar key yang terbuka, sehingga kita perlu tahu sibling dan descendant mana
//   yang harus dibersihkan saat user membuka submenu lain pada parent yang sama.
// Status:
// - AKTIF untuk sidebar nested accordion.
// - GUARDED: jangan ganti input helper ini menjadi sidebarMenuItems mentah karena bisa bypass role-aware filtering.
// =========================
const collectSubmenuDescendantKeys = (menuItem) => {
  if (!menuItem.children?.length) {
    return [];
  }

  return menuItem.children.flatMap((childItem) => {
    if (!childItem.children?.length) {
      return [];
    }

    return [
      childItem.key,
      ...collectSubmenuDescendantKeys(childItem),
    ];
  });
};

const buildSubmenuRelationMap = (menuItems, relationMap = new Map()) => {
  const submenuSiblings = menuItems.filter((menuItem) => menuItem.children?.length);

  submenuSiblings.forEach((menuItem) => {
    const siblingKeys = submenuSiblings
      .filter((siblingItem) => siblingItem.key !== menuItem.key)
      .map((siblingItem) => siblingItem.key);

    const siblingDescendantKeys = submenuSiblings
      .filter((siblingItem) => siblingItem.key !== menuItem.key)
      .flatMap((siblingItem) => collectSubmenuDescendantKeys(siblingItem));

    relationMap.set(menuItem.key, {
      siblingAndDescendantKeysToClose: [
        ...siblingKeys,
        ...siblingDescendantKeys,
      ],
    });

    buildSubmenuRelationMap(menuItem.children, relationMap);
  });

  return relationMap;
};

// =========================
// SECTION: Helper - Build Ant Design menu items — AKTIF / GUARDED
// Fungsi:
// - mengubah config menu yang sudah difilter menjadi format Ant Design Menu;
// - level 0 tetap memakai icon utama;
// - level 1 yang punya child boleh memakai icon kecil dari config;
// - level 2 / leaf child tidak diberi icon agar sidebar tidak ramai.
// Hubungan flow aplikasi:
// - hanya item yang lolos role guard yang akan dirender;
// - perubahan ini visual-only dan tidak mengubah route, label, selected/open key, atau allowedRoles.
// Status:
// - AKTIF untuk rendering sidebar bertingkat.
// - GUARDED: jangan bypass filter role dengan langsung memakai sidebarMenuItems mentah.
// =========================
const shouldRenderConfiguredIcon = (menuItem, level) => {
  const hasConfiguredIcon = Boolean(menuItem.icon);

  if (!hasConfiguredIcon) {
    return false;
  }

  if (level === 0) {
    return true;
  }

  return level === 1 && Boolean(menuItem.children?.length);
};

const buildSidebarIcon = (menuItem, level) => {
  if (!shouldRenderConfiguredIcon(menuItem, level)) {
    return null;
  }

  const IconComponent = menuItem.icon;

  return (
    <IconComponent
      className={`sidebar-menu-config-icon sidebar-menu-config-icon-level-${level}`}
    />
  );
};

const buildAntdMenuItems = (menuItems, level = 0) => {
  return menuItems.map((menuItem) => {
    if (menuItem.children?.length) {
      return {
        key: menuItem.key,
        icon: buildSidebarIcon(menuItem, level),
        label: menuItem.label,
        children: buildAntdMenuItems(menuItem.children, level + 1),
      };
    }

    return {
      key: menuItem.path,
      icon: buildSidebarIcon(menuItem, level),
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
  // - submenuRelationMap mengatur accordion per sibling group pada semua level menu.
  // Hubungan flow aplikasi:
  // - semua state dihitung dari menu yang sudah difilter role agar visibility role tetap aman.
  // Status:
  // - AKTIF untuk selected/open state sidebar.
  // - GUARDED: roleAwareMenuItems tetap menjadi basis kalkulasi, bukan sidebarMenuItems mentah.
  // =========================
  const selectedMenuKeys = useMemo(() => {
    return [location.pathname];
  }, [location.pathname]);

  const defaultOpenParentKeys = useMemo(() => {
    return findOpenParentKeysByPath(roleAwareMenuItems, location.pathname);
  }, [roleAwareMenuItems, location.pathname]);

  const submenuRelationMap = useMemo(() => {
    return buildSubmenuRelationMap(roleAwareMenuItems);
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
  // SECTION: Event Handlers — AKTIF / GUARDED
  // Fungsi:
  // - menjaga root menu tetap accordion;
  // - menjaga nested submenu pada parent yang sama juga accordion;
  // - membersihkan descendant openKeys dari sibling yang ditutup agar tidak ada stale hidden openKeys saat parent dibuka lagi.
  // Hubungan flow aplikasi:
  // - handler ini hanya mengubah controlled openKeys sidebar;
  // - selected route, route config, role access, dan business flow tidak diubah.
  // Alasan logic dipakai:
  // - satu helper relasi membuat behavior root dan nested konsisten tanpa hardcode key Produksi.
  // Status:
  // - AKTIF untuk sidebar nested accordion.
  // - GUARDED: jangan tambahkan leaf click handler jika onOpenChange sudah cukup, agar navigasi route tetap natural.
  // =========================
  const handleOpenMenuChange = (nextOpenKeys) => {
    const latestOpenedKey = nextOpenKeys.find(
      (menuKey) => !openMenuKeys.includes(menuKey),
    );

    if (!latestOpenedKey) {
      setOpenMenuKeys(nextOpenKeys);
      return;
    }

    const submenuRelation = submenuRelationMap.get(latestOpenedKey);

    if (!submenuRelation) {
      setOpenMenuKeys(nextOpenKeys);
      return;
    }

    const keysToClose = new Set(submenuRelation.siblingAndDescendantKeysToClose);
    const synchronizedOpenKeys = nextOpenKeys.filter(
      (menuKey) => !keysToClose.has(menuKey),
    );

    setOpenMenuKeys(synchronizedOpenKeys);
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
