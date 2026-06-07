const express = require("express");
const { createSqliteJsonRecordRouter } = require("../../shared/sqliteJsonRecordRoutes");
const { requireLocalOperationalUser } = require("../../middlewares/localAuth");

const router = express.Router();

const productionNote = "Production database lokal final aktif untuk data runtime baru. Material usage, payroll paid, dan HPP wajib tetap lewat service/endpoint database lokal agar audit dan ledger konsisten.";

router.use("/steps", createSqliteJsonRecordRouter({ tableName: "production_steps", moduleKey: "production", entityType: "production_step", codePrefix: "STP", requiredName: true, protectedWriteNote: productionNote }));
router.use("/employees", createSqliteJsonRecordRouter({ tableName: "production_employees", moduleKey: "production", entityType: "production_employee", codePrefix: "EMP", requiredName: true, protectedWriteNote: productionNote }));
router.use("/profiles", createSqliteJsonRecordRouter({ tableName: "production_profiles", moduleKey: "production", entityType: "production_profile", codePrefix: "PRF", requiredName: true, protectedWriteNote: productionNote }));
router.use("/boms", createSqliteJsonRecordRouter({ tableName: "production_boms", moduleKey: "production", entityType: "production_bom", codePrefix: "BOM", requiredName: false, protectedWriteNote: productionNote }));
router.use("/planning", createSqliteJsonRecordRouter({ tableName: "production_planning", moduleKey: "production", entityType: "production_planning", codePrefix: "PLN", requiredName: false, orderBy: "transaction_date DESC, updated_at DESC", protectedWriteNote: productionNote, writeGuard: requireLocalOperationalUser }));
router.use("/orders", createSqliteJsonRecordRouter({ tableName: "production_orders", moduleKey: "production", entityType: "production_order", codePrefix: "PO", requiredName: false, orderBy: "transaction_date DESC, updated_at DESC", protectedWriteNote: productionNote, writeGuard: requireLocalOperationalUser }));
router.use("/work-logs", createSqliteJsonRecordRouter({ tableName: "production_work_logs", moduleKey: "production", entityType: "production_work_log", codePrefix: "JOB", requiredName: false, orderBy: "transaction_date DESC, updated_at DESC", protectedWriteNote: productionNote, writeGuard: requireLocalOperationalUser }));
router.use("/payrolls", createSqliteJsonRecordRouter({ tableName: "production_payrolls", moduleKey: "production", entityType: "production_payroll", codePrefix: "PAY", requiredName: false, orderBy: "transaction_date DESC, updated_at DESC", protectedWriteNote: productionNote }));

module.exports = router;
