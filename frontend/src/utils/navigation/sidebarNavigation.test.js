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
});
