import { ROUTE_ACCESS_KEYS } from "../utils/auth/roleAccess";

export const isGlobalRealtimeReloadEvent = (event) => (
  event?.type === "database_replaced"
  || event?.type === "session_expired"
  || (
    event?.type === "data_changed"
    && (event.scopes || []).includes("auth")
  )
);

export const realtimeEventMatchesScopes = (event, scopes = []) => {
  if (!event || ["connected", "heartbeat"].includes(event.type)) return false;
  if (isGlobalRealtimeReloadEvent(event) || event.type === "fallback_tick") return true;
  const eventScopes = new Set(event.scopes || []);
  return scopes.some((scope) => eventScopes.has(scope) || eventScopes.has("*"));
};

export const REALTIME_ROUTE_SCOPES = Object.freeze({
  [ROUTE_ACCESS_KEYS.DASHBOARD]: ["dashboard"],
  [ROUTE_ACCESS_KEYS.MASTER_DATA_HUB]: ["master_data"],
  [ROUTE_ACCESS_KEYS.INVENTORY_HUB]: ["stock"],
  [ROUTE_ACCESS_KEYS.PRODUCTION_HUB]: ["production"],
  [ROUTE_ACCESS_KEYS.TRANSACTIONS_HUB]: ["transactions"],
  [ROUTE_ACCESS_KEYS.FINANCE_HUB]: ["finance"],
  [ROUTE_ACCESS_KEYS.SYSTEM_HUB]: ["maintenance", "auth"],
  [ROUTE_ACCESS_KEYS.REPORTS_HUB]: ["reports"],

  [ROUTE_ACCESS_KEYS.PRODUCTS]: ["products", "categories", "pricing_rules", "stock"],
  [ROUTE_ACCESS_KEYS.RAW_MATERIALS]: ["raw_materials", "categories", "pricing_rules", "stock", "suppliers"],
  [ROUTE_ACCESS_KEYS.CATEGORIES]: ["categories"],
  [ROUTE_ACCESS_KEYS.SUPPLIERS]: ["suppliers", "supplier_catalog", "purchases", "products", "raw_materials"],
  [ROUTE_ACCESS_KEYS.CUSTOMERS]: ["customers"],
  [ROUTE_ACCESS_KEYS.PRICING_RULES]: ["pricing_rules", "products", "raw_materials"],

  [ROUTE_ACCESS_KEYS.STOCK_MANAGEMENT]: ["stock", "products", "raw_materials", "semi_finished_materials"],

  [ROUTE_ACCESS_KEYS.PRODUCTION_PLANNING]: ["production", "production_planning", "products", "stock"],
  [ROUTE_ACCESS_KEYS.PRODUCTION_ORDERS]: ["production", "production_orders", "stock"],
  [ROUTE_ACCESS_KEYS.PRODUCTION_WORK_LOGS]: ["production", "production_work_logs", "stock", "finance"],
  [ROUTE_ACCESS_KEYS.PRODUCTION_STEPS]: ["production_steps"],
  [ROUTE_ACCESS_KEYS.PRODUCTION_EMPLOYEES]: ["production_employees"],
  [ROUTE_ACCESS_KEYS.PRODUCTION_PROFILES]: ["production_profiles"],
  [ROUTE_ACCESS_KEYS.SEMI_FINISHED_MATERIALS]: ["semi_finished_materials", "production", "stock"],
  [ROUTE_ACCESS_KEYS.PRODUCTION_BOMS]: ["production_boms", "products", "raw_materials", "semi_finished_materials"],
  [ROUTE_ACCESS_KEYS.PRODUCTION_PAYROLLS]: ["production_payrolls", "finance"],
  [ROUTE_ACCESS_KEYS.PRODUCTION_HPP_ANALYSIS]: ["production", "finance", "stock"],

  [ROUTE_ACCESS_KEYS.PURCHASES]: ["purchases", "suppliers", "products", "raw_materials", "stock", "finance"],
  [ROUTE_ACCESS_KEYS.SALES]: ["sales", "customers", "products", "raw_materials", "stock", "finance"],
  [ROUTE_ACCESS_KEYS.RETURNS]: ["returns", "sales", "products", "raw_materials", "stock", "finance"],

  [ROUTE_ACCESS_KEYS.CASH_IN]: ["cash_in", "finance"],
  [ROUTE_ACCESS_KEYS.CASH_OUT]: ["cash_out", "finance"],
  [ROUTE_ACCESS_KEYS.MONEY_MOVEMENT_LEDGER]: ["ledger", "finance"],

  [ROUTE_ACCESS_KEYS.STOCK_REPORT]: ["reports", "stock"],
  [ROUTE_ACCESS_KEYS.PURCHASES_REPORT]: ["reports", "purchases"],
  [ROUTE_ACCESS_KEYS.SALES_REPORT]: ["reports", "sales", "returns"],
  [ROUTE_ACCESS_KEYS.PAYROLL_REPORT]: ["reports", "production_payrolls"],
  [ROUTE_ACCESS_KEYS.PROFIT_LOSS]: ["reports", "finance"],

  [ROUTE_ACCESS_KEYS.USER_MANAGEMENT]: ["user_management", "auth"],
  [ROUTE_ACCESS_KEYS.RESET_MAINTENANCE]: ["maintenance", "backup_restore", "audit", "database"],
  [ROUTE_ACCESS_KEYS.TESTING_LAB]: ["maintenance", "backup_restore", "audit", "database", "realtime"],
});
