export const getTransactionSideEffectRepairAudit = async () => ({ summary: { status: "database_local_active", findings: 0 }, findings: [] });
export const repairTransactionSideEffects = async () => ({ repaired: 0, skipped: true });
