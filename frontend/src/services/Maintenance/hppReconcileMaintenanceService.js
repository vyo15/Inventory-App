export const getHppReconcileMaintenanceAudit = async () => ({ summary: { status: "database_local_active", findings: 0 }, findings: [] });
export const repairHppReconcileMaintenance = async () => ({ repaired: 0, skipped: true, reason: "HPP database lokal final dihitung dari data produksi/payroll baru." });
