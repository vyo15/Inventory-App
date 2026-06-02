const express = require("express");
const { createSqliteJsonRecordRouter } = require("../../shared/sqliteJsonRecordRoutes");

const router = express.Router();

const guardedNote = "Production SQLite C8 masih master/snapshot foundation; consume material, work log final, payroll paid, dan HPP final belum dimutasi dari UI.";

router.use("/steps", createSqliteJsonRecordRouter({ tableName: "production_steps", moduleKey: "production", entityType: "production_step", codePrefix: "STP", requiredName: true, protectedWriteNote: guardedNote }));
router.use("/employees", createSqliteJsonRecordRouter({ tableName: "production_employees", moduleKey: "production", entityType: "production_employee", codePrefix: "EMP", requiredName: true, protectedWriteNote: guardedNote }));
router.use("/profiles", createSqliteJsonRecordRouter({ tableName: "production_profiles", moduleKey: "production", entityType: "production_profile", codePrefix: "PRF", requiredName: true, protectedWriteNote: guardedNote }));
router.use("/boms", createSqliteJsonRecordRouter({ tableName: "production_boms", moduleKey: "production", entityType: "production_bom", codePrefix: "BOM", requiredName: false, protectedWriteNote: guardedNote }));
router.use("/planning", createSqliteJsonRecordRouter({ tableName: "production_planning", moduleKey: "production", entityType: "production_planning", codePrefix: "PLN", requiredName: false, orderBy: "transaction_date DESC, updated_at DESC", protectedWriteNote: guardedNote }));
router.use("/orders", createSqliteJsonRecordRouter({ tableName: "production_orders", moduleKey: "production", entityType: "production_order", codePrefix: "PO", requiredName: false, orderBy: "transaction_date DESC, updated_at DESC", protectedWriteNote: guardedNote }));
router.use("/work-logs", createSqliteJsonRecordRouter({ tableName: "production_work_logs", moduleKey: "production", entityType: "production_work_log", codePrefix: "JOB", requiredName: false, orderBy: "transaction_date DESC, updated_at DESC", protectedWriteNote: guardedNote }));
router.use("/payrolls", createSqliteJsonRecordRouter({ tableName: "production_payrolls", moduleKey: "production", entityType: "production_payroll", codePrefix: "PAY", requiredName: false, orderBy: "transaction_date DESC, updated_at DESC", protectedWriteNote: guardedNote }));

module.exports = router;
