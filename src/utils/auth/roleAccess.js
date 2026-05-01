// =========================
// SECTION: Auth Role Constants — AKTIF / GUARDED
// Fungsi:
// - menjadi single source of truth role aktif IMS setelah cleanup migrasi @ziyocraft.com;
// - mengunci role runtime hanya `administrator` dan `user`.
// Hubungan flow aplikasi:
// - dipakai AuthProvider, Route Guard, Sidebar/Menu Guard, dan Manajemen User.
// Status:
// - AKTIF untuk Login + Role internal IMS.
// - GUARDED: role baru tidak boleh ditambah tanpa update access matrix docs, route guard, menu guard, User Management, dan Firestore Rules.
// Legacy / cleanup:
// - compatibility role lama sudah dihapus dari role aktif; data Firestore lama wajib sudah dibersihkan sebelum patch ini dipakai.
// =========================
export const ROLES = {
  ADMINISTRATOR: "administrator",
  USER: "user",
};

export const ROLE_LABELS = {
  [ROLES.ADMINISTRATOR]: "Administrator",
  [ROLES.USER]: "User",
};

export const ACTIVE_ROLES = [ROLES.ADMINISTRATOR, ROLES.USER];
export const ALL_ROLES = ACTIVE_ROLES;

export const USER_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
};

export const USER_STATUS_LABELS = {
  [USER_STATUS.ACTIVE]: "Aktif",
  [USER_STATUS.INACTIVE]: "Nonaktif",
};

export const ALL_USER_STATUSES = [USER_STATUS.ACTIVE, USER_STATUS.INACTIVE];

// =========================
// SECTION: Route Access Keys — AKTIF / GUARDED
// Fungsi:
// - memberi key stabil untuk route access supaya AppRoutes dan sidebar tidak memakai string acak.
// Hubungan flow aplikasi:
// - route key ini mengikuti route aktif yang sudah ada; tidak mengubah path atau business page.
// Status:
// - AKTIF untuk Route Guard, Menu Guard, dan User Management.
// - GUARDED: route bisnis tidak boleh diganti di sini tanpa update AppRoutes/sidebar/docs.
// =========================
export const ROUTE_ACCESS_KEYS = {
  DASHBOARD: "dashboard",

  PRODUCTS: "products",
  RAW_MATERIALS: "raw-materials",
  CATEGORIES: "categories",
  SUPPLIERS: "suppliers",
  CUSTOMERS: "customers",
  PRICING_RULES: "pricing-rules",

  STOCK_MANAGEMENT: "stock-management",

  PRODUCTION_PLANNING: "production-planning",
  PRODUCTION_ORDERS: "production-orders",
  PRODUCTION_WORK_LOGS: "production-work-logs",
  PRODUCTION_STEPS: "production-steps",
  PRODUCTION_EMPLOYEES: "production-employees",
  PRODUCTION_PROFILES: "production-profiles",
  SEMI_FINISHED_MATERIALS: "semi-finished-materials",
  PRODUCTION_BOMS: "production-boms",
  PRODUCTION_PAYROLLS: "production-payrolls",
  PRODUCTION_HPP_ANALYSIS: "production-hpp-analysis",

  PURCHASES: "purchases",
  SALES: "sales",
  RETURNS: "returns",

  CASH_IN: "cash-in",
  CASH_OUT: "cash-out",

  STOCK_REPORT: "report-stock",
  PURCHASES_REPORT: "purchases-report",
  SALES_REPORT: "sales-report",
  PAYROLL_REPORT: "payroll-report",
  PROFIT_LOSS: "profit-loss",

  USER_MANAGEMENT: "user-management",
  RESET_MAINTENANCE: "reset-maintenance-data",
};

// =========================
// SECTION: Role Groups — AKTIF / GUARDED
// Fungsi:
// - membuat access matrix konsisten untuk dua role aktif;
// - menyediakan group Administrator-only yang dipakai route guard dan sidebar/menu guard.
// Hubungan flow aplikasi:
// - dipakai oleh route, sidebar, dan Manajemen User agar tidak ada duplikasi matrix.
// Status:
// - AKTIF untuk akses role aktif.
// - GUARDED: user biasa sengaja tidak diberi menu master setup, finance, report, sistem, pricing, dan setup produksi.
// Cleanup:
// - IMS NOTE [AKTIF / BEHAVIOR-PRESERVING]: nama alias sudah disesuaikan dengan kondisi final; value tetap hanya Administrator.
// =========================
export const ROLE_GROUPS = {
  // IMS NOTE [AKTIF / BEHAVIOR-PRESERVING]: semua user login tetap boleh mengakses route yang memang shared.
  ALL_AUTHENTICATED: ACTIVE_ROLES,
  // IMS NOTE [AKTIF / GUARDED]: menu operasional harian boleh dibuka Administrator dan User.
  OPERATIONAL_DAILY: ACTIVE_ROLES,
  // IMS NOTE [AKTIF / GUARDED]: menu konfigurasi, finance, reports, dan sistem hanya untuk Administrator.
  ADMIN_ONLY: [ROLES.ADMINISTRATOR],
};

// =========================
// SECTION: Route Access Matrix — AKTIF / GUARDED
// Fungsi:
// - menentukan route mana yang boleh dibuka role tertentu.
// Hubungan flow aplikasi:
// - dipakai ProtectedRoute untuk mencegah akses langsung lewat URL;
// - dipakai SidebarMenu untuk menyembunyikan menu yang tidak sesuai role.
// Status:
// - AKTIF untuk Route/Menu Guard dan User Management.
// - GUARDED: UI guard ini belum menggantikan Firestore Rules final.
// =========================
export const ROUTE_ROLE_ACCESS = {
  [ROUTE_ACCESS_KEYS.DASHBOARD]: ROLE_GROUPS.ALL_AUTHENTICATED,

  [ROUTE_ACCESS_KEYS.PRODUCTS]: ROLE_GROUPS.ADMIN_ONLY,
  [ROUTE_ACCESS_KEYS.RAW_MATERIALS]: ROLE_GROUPS.ADMIN_ONLY,
  [ROUTE_ACCESS_KEYS.CATEGORIES]: ROLE_GROUPS.ADMIN_ONLY,
  [ROUTE_ACCESS_KEYS.SUPPLIERS]: ROLE_GROUPS.ADMIN_ONLY,
  [ROUTE_ACCESS_KEYS.CUSTOMERS]: ROLE_GROUPS.ADMIN_ONLY,
  [ROUTE_ACCESS_KEYS.PRICING_RULES]: ROLE_GROUPS.ADMIN_ONLY,

  [ROUTE_ACCESS_KEYS.STOCK_MANAGEMENT]: ROLE_GROUPS.OPERATIONAL_DAILY,

  [ROUTE_ACCESS_KEYS.PRODUCTION_PLANNING]: ROLE_GROUPS.OPERATIONAL_DAILY,
  [ROUTE_ACCESS_KEYS.PRODUCTION_ORDERS]: ROLE_GROUPS.OPERATIONAL_DAILY,
  [ROUTE_ACCESS_KEYS.PRODUCTION_WORK_LOGS]: ROLE_GROUPS.OPERATIONAL_DAILY,
  [ROUTE_ACCESS_KEYS.PRODUCTION_STEPS]: ROLE_GROUPS.ADMIN_ONLY,
  [ROUTE_ACCESS_KEYS.PRODUCTION_EMPLOYEES]: ROLE_GROUPS.ADMIN_ONLY,
  [ROUTE_ACCESS_KEYS.PRODUCTION_PROFILES]: ROLE_GROUPS.ADMIN_ONLY,
  [ROUTE_ACCESS_KEYS.SEMI_FINISHED_MATERIALS]: ROLE_GROUPS.ADMIN_ONLY,
  [ROUTE_ACCESS_KEYS.PRODUCTION_BOMS]: ROLE_GROUPS.ADMIN_ONLY,
  [ROUTE_ACCESS_KEYS.PRODUCTION_PAYROLLS]: ROLE_GROUPS.ADMIN_ONLY,
  [ROUTE_ACCESS_KEYS.PRODUCTION_HPP_ANALYSIS]: ROLE_GROUPS.ADMIN_ONLY,

  [ROUTE_ACCESS_KEYS.PURCHASES]: ROLE_GROUPS.OPERATIONAL_DAILY,
  [ROUTE_ACCESS_KEYS.SALES]: ROLE_GROUPS.OPERATIONAL_DAILY,
  [ROUTE_ACCESS_KEYS.RETURNS]: ROLE_GROUPS.OPERATIONAL_DAILY,

  [ROUTE_ACCESS_KEYS.CASH_IN]: ROLE_GROUPS.ADMIN_ONLY,
  [ROUTE_ACCESS_KEYS.CASH_OUT]: ROLE_GROUPS.ADMIN_ONLY,

  [ROUTE_ACCESS_KEYS.STOCK_REPORT]: ROLE_GROUPS.ADMIN_ONLY,
  [ROUTE_ACCESS_KEYS.PURCHASES_REPORT]: ROLE_GROUPS.ADMIN_ONLY,
  [ROUTE_ACCESS_KEYS.SALES_REPORT]: ROLE_GROUPS.ADMIN_ONLY,
  [ROUTE_ACCESS_KEYS.PAYROLL_REPORT]: ROLE_GROUPS.ADMIN_ONLY,
  [ROUTE_ACCESS_KEYS.PROFIT_LOSS]: ROLE_GROUPS.ADMIN_ONLY,

  [ROUTE_ACCESS_KEYS.USER_MANAGEMENT]: ROLE_GROUPS.ADMIN_ONLY,
  [ROUTE_ACCESS_KEYS.RESET_MAINTENANCE]: ROLE_GROUPS.ADMIN_ONLY,
};

// =========================
// SECTION: Role Check Helpers — AKTIF / GUARDED
// Fungsi:
// - default deny untuk role tidak dikenal;
// - memastikan Reset/Maintenance dan User Management tidak terbuka ke role user biasa.
// Hubungan flow aplikasi:
// - helper ini dipakai bersama oleh ProtectedRoute, SidebarMenu, dan UserManagement.
// Status:
// - AKTIF.
// - GUARDED: jika role undefined/null atau role lama/tidak dikenal, akses harus ditolak.
// =========================
export const isKnownRole = (role) => ALL_ROLES.includes(role);

export const isActiveRole = (role) => ACTIVE_ROLES.includes(role);

export const isKnownUserStatus = (status) => ALL_USER_STATUSES.includes(status);

export const getAllowedRolesForRoute = (routeKey) => {
  return ROUTE_ROLE_ACCESS[routeKey] || [];
};

export const isRoleAllowed = (allowedRoles = [], role) => {
  if (!isKnownRole(role)) {
    return false;
  }

  return allowedRoles.includes(role);
};

export const canAccessRoute = (routeKey, role) => {
  return isRoleAllowed(getAllowedRolesForRoute(routeKey), role);
};

export const canAccessUserManagement = (role) => {
  return isRoleAllowed(ROLE_GROUPS.ADMIN_ONLY, role);
};

// =========================
// SECTION: User Management Role Rules — AKTIF / GUARDED
// Fungsi:
// - menjaga batas pengelolaan user internal di sisi UI/service;
// - role yang boleh dibuat hanya administrator dan user;
// - tidak ada role yang boleh mengubah role/status dirinya sendiri lewat halaman Manajemen User.
// Hubungan flow aplikasi:
// - dipakai UserManagement dan userService sebelum menulis `system_users`;
// - service create profile manual dan Firestore Rules wajib mengikuti aturan yang sama.
// Status:
// - AKTIF untuk penyederhanaan role 2 level.
// - GUARDED: aturan ini harus diselaraskan dengan Firestore Rules; UI guard saja tidak cukup.
// =========================
export const getAssignableRolesForActor = (actorRole) => {
  if (actorRole === ROLES.ADMINISTRATOR) {
    return ACTIVE_ROLES;
  }

  return [];
};

export const canAssignUserRole = (actorRole, targetRole) => {
  return getAssignableRolesForActor(actorRole).includes(targetRole);
};

export const canViewUserProfile = (actorRole, targetRole) => {
  return actorRole === ROLES.ADMINISTRATOR && isKnownRole(targetRole);
};

export const canManageUserProfile = ({
  actorRole,
  targetRole,
  targetUid,
  actorUid,
}) => {
  if (!canAccessUserManagement(actorRole)) {
    return false;
  }

  if (!isKnownRole(targetRole)) {
    return false;
  }

  // GUARDED: tidak ada user yang boleh mengubah role/status dirinya sendiri dari halaman Manajemen User.
  if (targetUid && actorUid && targetUid === actorUid) {
    return false;
  }

  return actorRole === ROLES.ADMINISTRATOR;
};

export const canChangeUserStatus = (params) => canManageUserProfile(params);

export const canCreateUserProfile = (actorRole, targetRole) => {
  return canAssignUserRole(actorRole, targetRole);
};

// =========================
// SECTION: Sidebar Menu Filter — AKTIF / GUARDED
// Fungsi:
// - menyaring item sidebar berdasarkan role;
// - parent menu tanpa child allowed otomatis disembunyikan;
// - role tidak dikenal default deny.
// Hubungan flow aplikasi:
// - dipakai SidebarMenu agar user tidak melihat menu yang route-nya ditolak.
// Status:
// - AKTIF.
// - GUARDED: hide menu bukan security final; route guard dan Firestore Rules tetap wajib.
// =========================
export const filterSidebarMenuItemsByRole = (menuItems = [], role) => {
  if (!isKnownRole(role)) {
    return [];
  }

  return menuItems.reduce((filteredMenu, menuItem) => {
    const allowedRoles = menuItem.allowedRoles || [];
    const isMenuAllowed = isRoleAllowed(allowedRoles, role);

    if (!isMenuAllowed) {
      return filteredMenu;
    }

    if (menuItem.children?.length) {
      const allowedChildren = filterSidebarMenuItemsByRole(
        menuItem.children,
        role,
      );

      if (allowedChildren.length === 0) {
        return filteredMenu;
      }

      filteredMenu.push({
        ...menuItem,
        children: allowedChildren,
      });

      return filteredMenu;
    }

    filteredMenu.push(menuItem);
    return filteredMenu;
  }, []);
};
