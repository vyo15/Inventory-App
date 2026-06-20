import { describe, expect, it } from "vitest";
import { sidebarMenuItems } from "../../config/sidebarMenu";
import {
  ROLES,
  filterSidebarMenuItemsByRole,
} from "../auth/roleAccess";
import {
  LEGACY_MODULE_HUB_REDIRECTS,
  MODULE_HUB_PATHS,
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
      MODULE_HUB_PATHS.INVENTORY,
    );
    expect(getTopLevelNavigationTarget(production)).toBe(
      MODULE_HUB_PATHS.PRODUCTION,
    );
  });

  it("mempertahankan route hub lama sebagai redirect compatibility", () => {
    expect(LEGACY_MODULE_HUB_REDIRECTS["/stock"]).toBe(
      MODULE_HUB_PATHS.INVENTORY,
    );
    expect(LEGACY_MODULE_HUB_REDIRECTS["/produksi"]).toBe(
      MODULE_HUB_PATHS.PRODUCTION,
    );
  });

  it("menandai module aktif untuk hub dan descendant route", () => {
    const production = findMenuItemByKey(sidebarMenuItems, "productions");

    expect(isPathWithinMenuItem(production, MODULE_HUB_PATHS.PRODUCTION)).toBe(true);
    expect(
      isPathWithinMenuItem(production, "/produksi/work-log-produksi"),
    ).toBe(true);
    expect(isPathWithinMenuItem(production, "/sales")).toBe(false);
  });

  it("menghitung parent menu nested dari route aktif", () => {
    expect(
      findOpenParentKeysByPath(
        sidebarMenuItems,
        "/produksi/work-log-produksi",
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
