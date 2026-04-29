// =========================
// SECTION: Auth Role Constants — AKTIF / GUARDED
// Fungsi:
// - menjadi single source of truth untuk nama role aplikasi;
// - menjaga hanya 2 role aktif baru: administrator dan user;
// - mempertahankan super_admin sebagai role legacy agar data lama tidak langsung terkunci.
// Hubungan flow aplikasi:
// - dipakai AuthProvider, Route Guard, Sidebar/Menu Guard, dan Manajemen User.
// Status:
// - AKTIF untuk Login + Role internal IMS.
// - GUARDED: role baru tidak boleh ditambah tanpa update access matrix docs, route guard, menu guard, User Management, Cloud Function, dan Firestore Rules.
// Legacy / cleanup:
// - ROLES.SUPER_ADMIN adalah LEGACY COMPATIBILITY untuk profile lama dan kandidat migration manual ke administrator;
// - super_admin tidak boleh menjadi pilihan role baru di UI/Cloud Function.
// =========================
export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMINISTRATOR: "administrator",
  USER: "user",
};

export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: "Super Admin (Legacy)",
  [ROLES.ADMINISTRATOR]: "Administrator",
  [ROLES.USER]: "User",
};

export const ACTIVE_ROLES = [ROLES.ADMINISTRATOR, ROLES.USER];

export const LEGACY_ROLES = [ROLES.SUPER_ADMIN];

export const ALL_ROLES = [...LEGACY_ROLES, ...ACTIVE_ROLES];

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
// - membuat deklarasi access matrix lebih mudah dibaca dan dirawat;
// - memberi Administrator akses penuh sesuai target role baru;
// - tetap memasukkan super_admin sebagai legacy alias agar akun lama tidak langsung terkunci.
// Hubungan flow aplikasi:
// - dipakai oleh route, sidebar, dan Manajemen User agar tidak ada duplikasi matrix.
// Status:
// - AKTIF.
// - GUARDED: user biasa sengaja tidak diberi menu finance/report/sistem sensitif pada fase awal.
// Legacy / cleanup:
// - ADMIN_AND_SUPER berarti akses admin penuh untuk administrator + super_admin legacy;
// - SUPER_ADMIN_ONLY dipertahankan sebagai alias legacy, jangan dipakai untuk rule baru.
// =========================
export const ROLE_GROUPS = {
  ALL_AUTHENTICATED: [ROLES.SUPER_ADMIN, ROLES.ADMINISTRATOR, ROLES.USER],
  ADMIN_AND_SUPER: [ROLES.SUPER_ADMIN, ROLES.ADMINISTRATOR],
  SUPER_ADMIN_ONLY: [ROLES.SUPER_ADMIN, ROLES.ADMINISTRATOR],
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
// Legacy / cleanup:
// - super_admin masih dipetakan ke akses Administrator sebagai compatibility sampai data lama dimigrasikan.
// =========================
export const ROUTE_ROLE_ACCESS = {
  [ROUTE_ACCESS_KEYS.DASHBOARD]: ROLE_GROUPS.ALL_AUTHENTICATED,

  [ROUTE_ACCESS_KEYS.PRODUCTS]: ROLE_GROUPS.ALL_AUTHENTICATED,
  [ROUTE_ACCESS_KEYS.RAW_MATERIALS]: ROLE_GROUPS.ALL_AUTHENTICATED,
  [ROUTE_ACCESS_KEYS.CATEGORIES]: ROLE_GROUPS.ALL_AUTHENTICATED,
  [ROUTE_ACCESS_KEYS.SUPPLIERS]: ROLE_GROUPS.ALL_AUTHENTICATED,
  [ROUTE_ACCESS_KEYS.CUSTOMERS]: ROLE_GROUPS.ALL_AUTHENTICATED,
  [ROUTE_ACCESS_KEYS.PRICING_RULES]: ROLE_GROUPS.ADMIN_AND_SUPER,

  [ROUTE_ACCESS_KEYS.STOCK_MANAGEMENT]: ROLE_GROUPS.ALL_AUTHENTICATED,

  [ROUTE_ACCESS_KEYS.PRODUCTION_PLANNING]: ROLE_GROUPS.ALL_AUTHENTICATED,
  [ROUTE_ACCESS_KEYS.PRODUCTION_ORDERS]: ROLE_GROUPS.ALL_AUTHENTICATED,
  [ROUTE_ACCESS_KEYS.PRODUCTION_WORK_LOGS]: ROLE_GROUPS.ALL_AUTHENTICATED,
  [ROUTE_ACCESS_KEYS.PRODUCTION_STEPS]: ROLE_GROUPS.ADMIN_AND_SUPER,
  [ROUTE_ACCESS_KEYS.PRODUCTION_EMPLOYEES]: ROLE_GROUPS.ADMIN_AND_SUPER,
  [ROUTE_ACCESS_KEYS.PRODUCTION_PROFILES]: ROLE_GROUPS.ADMIN_AND_SUPER,
  [ROUTE_ACCESS_KEYS.SEMI_FINISHED_MATERIALS]: ROLE_GROUPS.ADMIN_AND_SUPER,
  [ROUTE_ACCESS_KEYS.PRODUCTION_BOMS]: ROLE_GROUPS.ADMIN_AND_SUPER,
  [ROUTE_ACCESS_KEYS.PRODUCTION_PAYROLLS]: ROLE_GROUPS.ADMIN_AND_SUPER,
  [ROUTE_ACCESS_KEYS.PRODUCTION_HPP_ANALYSIS]: ROLE_GROUPS.ADMIN_AND_SUPER,

  [ROUTE_ACCESS_KEYS.PURCHASES]: ROLE_GROUPS.ALL_AUTHENTICATED,
  [ROUTE_ACCESS_KEYS.SALES]: ROLE_GROUPS.ALL_AUTHENTICATED,
  [ROUTE_ACCESS_KEYS.RETURNS]: ROLE_GROUPS.ALL_AUTHENTICATED,

  [ROUTE_ACCESS_KEYS.CASH_IN]: ROLE_GROUPS.ADMIN_AND_SUPER,
  [ROUTE_ACCESS_KEYS.CASH_OUT]: ROLE_GROUPS.ADMIN_AND_SUPER,

  [ROUTE_ACCESS_KEYS.STOCK_REPORT]: ROLE_GROUPS.ADMIN_AND_SUPER,
  [ROUTE_ACCESS_KEYS.PURCHASES_REPORT]: ROLE_GROUPS.ADMIN_AND_SUPER,
  [ROUTE_ACCESS_KEYS.SALES_REPORT]: ROLE_GROUPS.ADMIN_AND_SUPER,
  [ROUTE_ACCESS_KEYS.PAYROLL_REPORT]: ROLE_GROUPS.ADMIN_AND_SUPER,
  [ROUTE_ACCESS_KEYS.PROFIT_LOSS]: ROLE_GROUPS.ADMIN_AND_SUPER,

  [ROUTE_ACCESS_KEYS.USER_MANAGEMENT]: ROLE_GROUPS.ADMIN_AND_SUPER,
  [ROUTE_ACCESS_KEYS.RESET_MAINTENANCE]: ROLE_GROUPS.ADMIN_AND_SUPER,
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
// - GUARDED: jika role undefined/null, akses harus ditolak.
// =========================
export const isKnownRole = (role) => ALL_ROLES.includes(role);

export const isActiveRole = (role) => ACTIVE_ROLES.includes(role);

export const isLegacyRole = (role) => LEGACY_ROLES.includes(role);

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
  return isRoleAllowed(ROLE_GROUPS.ADMIN_AND_SUPER, role);
};

// =========================
// SECTION: User Management Role Rules — AKTIF / GUARDED
// Fungsi:
// - menjaga batas pengelolaan user internal di sisi UI/service;
// - role baru yang boleh dibuat hanya administrator dan user;
// - tidak ada role yang boleh mengubah role/status dirinya sendiri lewat halaman Manajemen User.
// Hubungan flow aplikasi:
// - dipakai UserManagement dan userService sebelum menulis `system_users`;
// - Cloud Function createSystemUser wajib mengikuti aturan yang sama.
// Status:
// - AKTIF untuk penyederhanaan role 2 level.
// - GUARDED: aturan ini harus diselaraskan dengan Firestore Rules; UI guard saja tidak cukup.
// Legacy / cleanup:
// - super_admin lama tetap bisa login dan punya akses admin, tetapi tidak bisa dipilih sebagai role baru.
// =========================
export const getAssignableRolesForActor = (actorRole) => {
  if (ROLE_GROUPS.ADMIN_AND_SUPER.includes(actorRole)) {
    return ACTIVE_ROLES;
  }

  return [];
};

export const canAssignUserRole = (actorRole, targetRole) => {
  return getAssignableRolesForActor(actorRole).includes(targetRole);
};

export const canViewUserProfile = (actorRole, targetRole) => {
  if (ROLE_GROUPS.ADMIN_AND_SUPER.includes(actorRole)) {
    return isKnownRole(targetRole);
  }

  return false;
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

  return ROLE_GROUPS.ADMIN_AND_SUPER.includes(actorRole);
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
// - dipakai SidebarMenu Fase D agar user tidak melihat menu yang route-nya ditolak.
// Status:
// - AKTIF.
// - GUARDED: hide menu bukan security final; route guard dan Firestore Rules tetap wajib.
// Legacy / cleanup:
// - super_admin diperlakukan seperti Administrator sampai data legacy dimigrasikan.
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
