const BACKUP_TYPE_LABELS = Object.freeze({
  manual: "Manual",
  daily: "Harian",
  monthly: "Bulanan",
  "manual-import": "Import Manual",
  "pre-update": "Sebelum Update",
  "pre-restore": "Sebelum Restore",
  "pre-reset": "Sebelum Reset",
  "pre-import": "Sebelum Import",
  "pre-repair": "Sebelum Repair",
  compatibility: "Arsip Kompatibilitas",
  archived: "Arsip",
});

export const getBackupTypeLabel = (backupType) =>
  BACKUP_TYPE_LABELS[backupType] || backupType || "Backup";

export { BACKUP_TYPE_LABELS };
