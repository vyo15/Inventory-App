export const getTransactionSideEffectRepairAudit = async () => ({ summary: { status: "sqlite_only", findings: 0 }, findings: [] });
export const repairTransactionSideEffects = async () => ({ repaired: 0, skipped: true });
