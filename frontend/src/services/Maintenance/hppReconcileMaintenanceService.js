export const getHppReconcileMaintenanceAudit = async () => ({ summary: { status: "sqlite_only", findings: 0 }, findings: [] });
export const repairHppReconcileMaintenance = async () => ({ repaired: 0, skipped: true, reason: "HPP SQLite final dihitung dari data produksi/payroll baru." });
