export const getPayrollSnapshotMaintenanceAudit = async () => ({ summary: { status: "sqlite_only", findings: 0 }, findings: [] });
export const repairPayrollSnapshotMaintenance = async () => ({ repaired: 0, skipped: true });
