import { describe, expect, it } from "vitest";
import { APP_ROUTES } from "../../config/appRoutes";
import { sidebarMenuItems } from "../../config/sidebarMenu";
import {
  ROLES,
  filterSidebarMenuItemsByRole,
} from "../auth/roleAccess";
import {
  findMenuItemByKey,
  findOpenParentKeysByPath,
  getTopLevelNavigationTarget,
  isPathWithinMenuItem,
} from "./sidebarNavigation";

const collectNavigableItems = (items = []) => {
  return items.flatMap((item) => [
    ...(item.path || item.hubPath ? [item] : []),
    ...collectNavigableItems(item.children || []),
  ]);
};

const collectWorkspaceLeafItems = (moduleItem) => {
  return (moduleItem?.children || []).flatMap((item) => {
    if (item.children?.length) {
      return collectWorkspaceLeafItems(item);
    }

    return item.path ? [item] : [];
  });
};

describe("responsive sidebar navigation", () => {
  it("memakai canonical hub route untuk navigation baru", () => {
    const inventory = findMenuItemByKey(sidebarMenuItems, "inventory");
    const production = findMenuItemByKey(sidebarMenuItems, "productions");

    expect(getTopLevelNavigationTarget(inventory)).toBe(
      APP_ROUTES.INVENTORY.HUB,
    );
    expect(getTopLevelNavigationTarget(production)).toBe(
      APP_ROUTES.PRODUCTION.HUB,
    );
  });

  it("menandai module aktif untuk canonical hub dan descendant route", () => {
    const production = findMenuItemByKey(sidebarMenuItems, "productions");

    expect(isPathWithinMenuItem(production, APP_ROUTES.PRODUCTION.HUB)).toBe(true);
    expect(
      isPathWithinMenuItem(production, APP_ROUTES.PRODUCTION.WORK_LOGS),
    ).toBe(true);
    expect(isPathWithinMenuItem(production, "/sales")).toBe(false);
  });

  it("menghitung parent menu nested dari canonical route aktif", () => {
    expect(
      findOpenParentKeysByPath(
        sidebarMenuItems,
        APP_ROUTES.PRODUCTION.WORK_LOGS,
      ),
    ).toEqual(["productions", "production-operation"]);
  });

  it("bottom sheet dan dock tetap mengikuti role filter yang sama", () => {
    const userMenu = filterSidebarMenuItemsByRole(
      sidebarMenuItems,
      ROLES.USER,
    );

    expect(findMenuItemByKey(userMenu, "inventory")).toBeTruthy();
    expect(findMenuItemByKey(userMenu, "transactions")).toBeTruthy();
    expect(findMenuItemByKey(userMenu, "productions")).toBeTruthy();
    expect(findMenuItemByKey(userMenu, "master-data")).toBeNull();
    expect(findMenuItemByKey(userMenu, "finance")).toBeNull();
    expect(findMenuItemByKey(userMenu, "reports")).toBeNull();
    expect(findMenuItemByKey(userMenu, "utilities")).toBeNull();
  });

  it("menyediakan metadata Workspace untuk seluruh modul dan halaman", () => {
    const moduleItems = sidebarMenuItems.filter((menuItem) => menuItem.hubPath);

    expect(moduleItems.length).toBeGreaterThan(0);

    moduleItems.forEach((moduleItem) => {
      expect(moduleItem.hubIcon).toBeTruthy();
      expect(moduleItem.hubEyebrow?.trim()).toBeTruthy();
      expect(moduleItem.hubDescription?.trim()).toBeTruthy();

      collectWorkspaceLeafItems(moduleItem).forEach((leafItem) => {
        expect(leafItem.hubIcon).toBeTruthy();
        expect(leafItem.hubDescription?.trim()).toBeTruthy();
      });
    });
  });

  it("metadata Workspace tidak mengubah target route existing", () => {
    const pathByKey = Object.fromEntries(
      collectNavigableItems(sidebarMenuItems).map((item) => [
        item.key,
        item.hubPath || item.path,
      ]),
    );

    expect(pathByKey).toEqual({
      dashboard: "/dashboard",
      "master-data": "/master-data",
      products: "/products",
      "raw-materials": "/raw-materials",
      categories: "/categories",
      suppliers: "/suppliers",
      customers: "/customers",
      "pricing-rules": "/pricing-rules",
      inventory: APP_ROUTES.INVENTORY.HUB,
      "stock-management": APP_ROUTES.INVENTORY.STOCK_MANAGEMENT,
      productions: APP_ROUTES.PRODUCTION.HUB,
      "production-planning": APP_ROUTES.PRODUCTION.PLANNING,
      "production-orders": APP_ROUTES.PRODUCTION.ORDERS,
      "production-work-logs": APP_ROUTES.PRODUCTION.WORK_LOGS,
      "production-steps": APP_ROUTES.PRODUCTION.STEPS,
      "production-employees": APP_ROUTES.PRODUCTION.EMPLOYEES,
      "production-profiles": APP_ROUTES.PRODUCTION.PROFILES,
      "semi-finished-materials": APP_ROUTES.PRODUCTION.SEMI_FINISHED_MATERIALS,
      "production-boms": APP_ROUTES.PRODUCTION.BOMS,
      "production-payrolls": APP_ROUTES.PRODUCTION.PAYROLLS,
      "production-hpp-analysis": APP_ROUTES.PRODUCTION.HPP_ANALYSIS,
      transactions: "/transactions",
      purchases: "/purchases",
      sales: "/sales",
      returns: "/returns",
      finance: "/finance",
      "cash-in": "/cash-in",
      "cash-out": "/cash-out",
      "money-movement-ledger": "/finance/money-movement-ledger",
      utilities: "/system",
      "user-management": "/system/user-management",
      "reset-maintenance-data": "/utilities/reset-maintenance-data",
      reports: "/reports",
      "report-stock": "/report-stock",
      "purchases-report": "/purchases-report",
      "sales-report": "/sales-report",
      "payroll-report": "/payroll-report",
      "profit-loss": "/profit-loss",
    });
  });

  it("role User hanya mendapat modul operasional dan flow produksi harian", () => {
    const userMenu = filterSidebarMenuItemsByRole(
      sidebarMenuItems,
      ROLES.USER,
    );
    const userProduction = findMenuItemByKey(userMenu, "productions");

    expect(userMenu.map((menuItem) => menuItem.key)).toEqual([
      "dashboard",
      "inventory",
      "productions",
      "transactions",
    ]);
    expect(userProduction?.children?.map((item) => item.key)).toEqual([
      "production-operation",
    ]);
    expect(
      userProduction?.children?.[0]?.children?.map((item) => item.key),
    ).toEqual([
      "production-planning",
      "production-orders",
      "production-work-logs",
    ]);
  });

  it("role Administrator tetap mendapat seluruh modul", () => {
    const adminMenu = filterSidebarMenuItemsByRole(
      sidebarMenuItems,
      ROLES.ADMINISTRATOR,
    );

    expect(adminMenu.map((menuItem) => menuItem.key)).toEqual(
      sidebarMenuItems.map((menuItem) => menuItem.key),
    );
  });
});
