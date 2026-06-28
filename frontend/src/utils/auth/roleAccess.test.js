import { describe, expect, it } from "vitest";
import {
  ROLES,
  ROUTE_ACCESS_KEYS,
  canAccessRoute,
  canEditUserProfile,
  canManageUserProfile,
  filterSidebarMenuItemsByRole,
} from "./roleAccess";

describe("roleAccess", () => {
  it("mengizinkan user operasional dan menolak route Administrator-only", () => {
    expect(canAccessRoute(ROUTE_ACCESS_KEYS.SALES, ROLES.USER)).toBe(true);
    expect(canAccessRoute(ROUTE_ACCESS_KEYS.PRODUCTION_WORK_LOGS, ROLES.USER)).toBe(true);
    expect(canAccessRoute(ROUTE_ACCESS_KEYS.CASH_IN, ROLES.USER)).toBe(false);
    expect(canAccessRoute(ROUTE_ACCESS_KEYS.RESET_MAINTENANCE, ROLES.USER)).toBe(false);
  });

  it("default deny untuk role tidak dikenal", () => {
    expect(canAccessRoute(ROUTE_ACCESS_KEYS.DASHBOARD, "legacy-admin")).toBe(false);
    expect(canAccessRoute(ROUTE_ACCESS_KEYS.DASHBOARD, "")).toBe(false);
  });

  it("administrator dapat mengedit profil sendiri tetapi tidak role/status sendiri", () => {
    expect(canEditUserProfile({
      actorRole: ROLES.ADMINISTRATOR,
      targetRole: ROLES.ADMINISTRATOR,
    })).toBe(true);

    expect(canManageUserProfile({
      actorRole: ROLES.ADMINISTRATOR,
      targetRole: ROLES.ADMINISTRATOR,
      actorUid: "admin-1",
      targetUid: "admin-1",
    })).toBe(false);

    expect(canManageUserProfile({
      actorRole: ROLES.ADMINISTRATOR,
      targetRole: ROLES.USER,
      actorUid: "admin-1",
      targetUid: "user-1",
    })).toBe(true);
  });

  it("menyembunyikan parent sidebar jika seluruh child ditolak", () => {
    const menu = [
      {
        key: "finance",
        allowedRoles: [ROLES.ADMINISTRATOR, ROLES.USER],
        children: [
          { key: "cash-in", allowedRoles: [ROLES.ADMINISTRATOR] },
        ],
      },
      { key: "sales", allowedRoles: [ROLES.ADMINISTRATOR, ROLES.USER] },
    ];

    expect(filterSidebarMenuItemsByRole(menu, ROLES.USER)).toEqual([
      { key: "sales", allowedRoles: [ROLES.ADMINISTRATOR, ROLES.USER] },
    ]);
  });
});
