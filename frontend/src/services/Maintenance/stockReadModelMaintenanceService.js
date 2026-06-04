export const getStockReadModelMaintenanceAudit = async () => ({ summary: { status: "sqlite_only", findings: 0 }, findings: [] });
export const rebuildStockReadModelMaintenance = async () => ({ rebuilt: 0, skipped: true });
export const backfillStockReadModelRestockMetadataMaintenance = async () => ({ updated: 0, skipped: true });
export const deleteOrphanStockReadModelsMaintenance = async () => ({ deleted: 0, skipped: true });
