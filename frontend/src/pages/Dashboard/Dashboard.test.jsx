import { describe, expect, it } from "vitest";
import { ROLES, ROUTE_ACCESS_KEYS } from "../../utils/auth/roleAccess";
import { filterDashboardQuickActionsByRole } from "./helpers/dashboardPageHelpers";

const ACTIONS = [
  { key: "sales", routeKey: ROUTE_ACCESS_KEYS.SALES },
  { key: "purchases", routeKey: ROUTE_ACCESS_KEYS.PURCHASES },
  { key: "stock", routeKey: ROUTE_ACCESS_KEYS.STOCK_MANAGEMENT },
  { key: "stock-report", routeKey: ROUTE_ACCESS_KEYS.STOCK_REPORT },
  { key: "planning", routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_PLANNING },
  { key: "worklog", routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_WORK_LOGS },
  { key: "payroll", routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_PAYROLLS },
  { key: "cash-in", routeKey: ROUTE_ACCESS_KEYS.CASH_IN },
  { key: "cash-out", routeKey: ROUTE_ACCESS_KEYS.CASH_OUT },
];

const actionKeys = (role) => filterDashboardQuickActionsByRole(ACTIONS, role).map((item) => item.key);

describe("Dashboard role-aware quick actions", () => {
  it("user hanya melihat aksi operasional yang route-nya diizinkan", () => {
    expect(actionKeys(ROLES.USER)).toEqual([
      "sales",
      "purchases",
      "stock",
      "planning",
      "worklog",
    ]);
  });

  it("administrator tetap melihat aksi finance, report, dan payroll", () => {
    expect(actionKeys(ROLES.ADMINISTRATOR)).toEqual(expect.arrayContaining([
      "stock-report",
      "payroll",
      "cash-in",
      "cash-out",
    ]));
  });

  it("role tidak dikenal tidak memperoleh quick action", () => {
    expect(actionKeys("legacy-admin")).toEqual([]);
  });
});
