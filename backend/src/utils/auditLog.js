const { getDb } = require("../db/connection");

async function createAuditLog({
  module,
  action,
  entityType = null,
  entityId = null,
  description = "",
  metadata = null,
  actor = "system",
}) {
  const db = await getDb();
  const metadataJson = metadata ? JSON.stringify(metadata) : null;

  const result = await db.run(
    `
      INSERT INTO audit_logs (module, action, entity_type, entity_id, description, metadata_json, actor)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [module, action, entityType, entityId ? String(entityId) : null, description, metadataJson, actor]
  );

  return result.lastID;
}

module.exports = { createAuditLog };
