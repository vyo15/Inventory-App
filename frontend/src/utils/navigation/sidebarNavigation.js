// =========================
// SECTION: Sidebar Navigation Helpers — AKTIF / GUARDED
// Fungsi:
// - menyatukan pencarian route aktif, parent top-level, dan target navigasi hub;
// - dipakai DesktopModuleDock, MobileBottomNavigation, ModuleHub, dan SidebarMenu.
// Guardrail:
// - helper hanya membaca config menu yang sudah difilter role;
// - tidak menentukan role baru, tidak mengubah route bisnis, dan tidak menjalankan mutation.
// =========================

export const MODULE_HUB_PATHS = Object.freeze({
  INVENTORY: "/inventory",
  PRODUCTION: "/production",
});

export const LEGACY_MODULE_HUB_REDIRECTS = Object.freeze({
  "/stock": MODULE_HUB_PATHS.INVENTORY,
  "/produksi": MODULE_HUB_PATHS.PRODUCTION,
});

export const getFirstLeafPath = (menuItem) => {
  if (!menuItem) {
    return "";
  }

  if (menuItem.path) {
    return menuItem.path;
  }

  for (const childItem of menuItem.children || []) {
    const childPath = getFirstLeafPath(childItem);

    if (childPath) {
      return childPath;
    }
  }

  return "";
};

export const getTopLevelNavigationTarget = (menuItem) => {
  return menuItem?.hubPath || menuItem?.path || getFirstLeafPath(menuItem);
};

export const isPathWithinMenuItem = (menuItem, currentPath) => {
  if (!menuItem || !currentPath) {
    return false;
  }

  if (menuItem.path === currentPath || menuItem.hubPath === currentPath) {
    return true;
  }

  return (menuItem.children || []).some((childItem) =>
    isPathWithinMenuItem(childItem, currentPath),
  );
};

export const findTopLevelMenuItemByPath = (menuItems = [], currentPath) => {
  return menuItems.find((menuItem) =>
    isPathWithinMenuItem(menuItem, currentPath),
  ) || null;
};

export const findMenuItemByKey = (menuItems = [], targetKey) => {
  for (const menuItem of menuItems) {
    if (menuItem.key === targetKey) {
      return menuItem;
    }

    const matchedChild = findMenuItemByKey(
      menuItem.children || [],
      targetKey,
    );

    if (matchedChild) {
      return matchedChild;
    }
  }

  return null;
};

export const findOpenParentKeysByPath = (
  menuItems = [],
  currentPath,
  parentKeyTrail = [],
) => {
  for (const menuItem of menuItems) {
    if (menuItem.path === currentPath || menuItem.hubPath === currentPath) {
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
