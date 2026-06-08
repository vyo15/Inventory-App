const PRODUCTION_PROTECTED_WRITE_NOTE = [
  "Production database lokal final aktif untuk data runtime baru.",
  "Material usage, payroll paid, dan HPP wajib tetap lewat service/endpoint database lokal",
  "agar audit dan ledger konsisten.",
].join(" ");

const getProductionRouterDefinitions = () => [
  {
    path: "/steps",
    config: {
      tableName: "production_steps",
      moduleKey: "production",
      entityType: "production_step",
      codePrefix: "STP",
      requiredName: true,
      protectedWriteNote: PRODUCTION_PROTECTED_WRITE_NOTE,
    },
  },
  {
    path: "/employees",
    config: {
      tableName: "production_employees",
      moduleKey: "production",
      entityType: "production_employee",
      codePrefix: "EMP",
      requiredName: true,
      protectedWriteNote: PRODUCTION_PROTECTED_WRITE_NOTE,
    },
  },
  {
    path: "/profiles",
    config: {
      tableName: "production_profiles",
      moduleKey: "production",
      entityType: "production_profile",
      codePrefix: "PRF",
      requiredName: true,
      protectedWriteNote: PRODUCTION_PROTECTED_WRITE_NOTE,
    },
  },
  {
    path: "/boms",
    config: {
      tableName: "production_boms",
      moduleKey: "production",
      entityType: "production_bom",
      codePrefix: "BOM",
      requiredName: false,
      protectedWriteNote: PRODUCTION_PROTECTED_WRITE_NOTE,
    },
  },
  {
    path: "/planning",
    requiresOperationalWriteUser: true,
    config: {
      tableName: "production_planning",
      moduleKey: "production",
      entityType: "production_planning",
      codePrefix: "PLN",
      requiredName: false,
      orderBy: "transaction_date DESC, updated_at DESC",
      protectedWriteNote: PRODUCTION_PROTECTED_WRITE_NOTE,
    },
  },
  {
    path: "/orders",
    requiresOperationalWriteUser: true,
    config: {
      tableName: "production_orders",
      moduleKey: "production",
      entityType: "production_order",
      codePrefix: "PO",
      requiredName: false,
      orderBy: "transaction_date DESC, updated_at DESC",
      protectedWriteNote: PRODUCTION_PROTECTED_WRITE_NOTE,
    },
  },
  {
    path: "/work-logs",
    requiresOperationalWriteUser: true,
    config: {
      tableName: "production_work_logs",
      moduleKey: "production",
      entityType: "production_work_log",
      codePrefix: "JOB",
      requiredName: false,
      orderBy: "transaction_date DESC, updated_at DESC",
      protectedWriteNote: PRODUCTION_PROTECTED_WRITE_NOTE,
    },
  },
  {
    path: "/payrolls",
    config: {
      tableName: "production_payrolls",
      moduleKey: "production",
      entityType: "production_payroll",
      codePrefix: "PAY",
      requiredName: false,
      orderBy: "transaction_date DESC, updated_at DESC",
      protectedWriteNote: PRODUCTION_PROTECTED_WRITE_NOTE,
    },
  },
];

module.exports = {
  getProductionRouterDefinitions,
};
