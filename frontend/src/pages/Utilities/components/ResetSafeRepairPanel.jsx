import { useState } from "react";
import { DeleteOutlined, FileSearchOutlined, SyncOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, Divider, Input, Popconfirm, Row, Space, Statistic, Table, Tag, Typography } from "antd";
import { formatHppUnitCurrencyId } from "../../../utils/formatters/currencyId";
import { formatQuantityId } from "../../../utils/formatters/numberId";

const { Text } = Typography;

const STOCK_READ_MODEL_ORPHAN_CLEANUP_CONFIRM_KEYWORD = "CLEANUP READ MODEL";

const HPP_RECONCILE_CATEGORY_LABELS = {
  safe_repair: "Siap repair",
  manual: "Review manual",
};

const TRANSACTION_SIDE_EFFECT_CATEGORY_LABELS = {
  safe_repair: "Siap repair",
  manual: "Review manual",
};

const STOCK_READ_MODEL_CATEGORY_LABELS = {
  ok: "Sinkron",
  safe_repair: "Siap rebuild",
  manual: "Review manual",
};

const HPP_RECONCILE_CATEGORY_COLORS = {
  safe_repair: "blue",
  manual: "orange",
};

const TRANSACTION_SIDE_EFFECT_CATEGORY_COLORS = {
  safe_repair: "blue",
  manual: "orange",
};

const STOCK_READ_MODEL_CATEGORY_COLORS = {
  ok: "green",
  safe_repair: "blue",
  manual: "orange",
};

const formatHppReconcileCategory = (value) => HPP_RECONCILE_CATEGORY_LABELS[value] || value || "-";
const formatTransactionSideEffectCategory = (value) => TRANSACTION_SIDE_EFFECT_CATEGORY_LABELS[value] || value || "-";
const formatStockReadModelCategory = (value) => STOCK_READ_MODEL_CATEGORY_LABELS[value] || value || "-";

const toSafeNumber = (value) => {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const getCheckedRecordCount = (summary = {}) => toSafeNumber(
  summary.checkedRecords || summary.totalRecords || summary.totalChecked || summary.itemCount,
);

const getRepairPlanCount = (summary = {}) => toSafeNumber(
  summary.executablePlanCount
  || summary.safeRepairCount
  || summary.displayRepairCount
  || summary.repairableCount,
);

const hasAuditResult = (audit, summary = {}) => Boolean(audit) || getCheckedRecordCount(summary) > 0 || getRepairPlanCount(summary) > 0;

const buildGuardMessage = ({ auditReady, planCount }) => {
  if (!auditReady) return "Jalankan Cek Semua Area atau audit terkait dulu sebelum repair.";
  if (!planCount) return "Tidak ada kandidat repair dari audit terakhir.";
  return `${planCount} kandidat dari audit terakhir akan diproses.`;
};

const ResetSafeRepairPanel = ({
  loadingStockRepair,
  onRepairStockAudit,
  stockAudit,
  stockRepairSummary = {},
  loadingLogSchemaRepair,
  onRepairLogSchema,
  logSchemaAudit,
  logSchemaRepairSummary = {},
  loadingMaintenanceRepair,
  onRepairProductionMaintenance,
  maintenanceAudit,
  maintenanceRepairSummary = {},
  loadingPayrollRepair,
  onRepairPayrollAudit,
  payrollAudit,
  payrollRepairSummary = {},
  loadingTransactionVariantRepair,
  onRepairTransactionVariantAudit,
  transactionVariantAudit,
  transactionVariantRepairSummary = {},
  loadingTransactionSideEffectAudit,
  onLoadTransactionSideEffectAudit,
  loadingTransactionSideEffectRepair,
  onOpenTransactionSideEffectRepairConfirm,
  transactionSideEffectAudit,
  transactionSideEffectSummary = {},
  transactionSideEffectRows = [],
  loadingStockReadModelAudit,
  onLoadStockReadModelAudit,
  loadingStockReadModelRepair,
  onRepairStockReadModelAudit,
  loadingStockReadModelRestockBackfill,
  onBackfillStockReadModelRestockMetadata,
  loadingStockReadModelCleanup,
  onCleanupStockReadModelOrphans,
  stockReadModelAudit,
  stockReadModelSummary = {},
  stockReadModelRows = [],
  loadingHppReconcileAudit,
  onLoadHppReconcileAudit,
  loadingHppReconcileRepair,
  onRepairHppReconcileAudit,
  hppReconcileAudit,
  hppReconcileSummary = {},
  hppReconcileRows = [],
  loadingSync,
  onSyncStocks,
  loadingMasterCodeAudit,
  onLoadMasterCodeAudit,
  loadingMasterCodeRepair,
  onRepairMasterCodeAudit,
  masterCodeSummary = {},
  masterCodeAudit,
  masterCodeRows = [],
  renderCompactText,
  renderCompactTag,
}) => {
  const [stockReadModelCleanupKeyword, setStockReadModelCleanupKeyword] = useState("");
  const isStockReadModelCleanupKeywordValid = stockReadModelCleanupKeyword.trim() === STOCK_READ_MODEL_ORPHAN_CLEANUP_CONFIRM_KEYWORD;

  const renderGuardedRepairButton = ({
    label,
    title,
    description,
    loading,
    onConfirm,
    audit,
    summary,
  }) => {
    const auditReady = hasAuditResult(audit, summary);
    const planCount = getRepairPlanCount(summary);
    const disabled = !auditReady || planCount <= 0;

    return (
      <Popconfirm
        title={title}
        description={`${description} ${buildGuardMessage({ auditReady, planCount })}`}
        okText="Ya, repair"
        cancelText="Batal"
        disabled={disabled}
        onConfirm={onConfirm}
      >
        <Button block icon={<SyncOutlined />} loading={loading} disabled={disabled}>
          {label}{planCount ? ` (${planCount})` : ""}
        </Button>
      </Popconfirm>
    );
  };

  const stockAuditReady = hasAuditResult(stockAudit, stockRepairSummary);
  const stockSyncDisabled = !stockAuditReady || getRepairPlanCount(stockRepairSummary) <= 0;

  return (
    <Card title="Repair Turunan Aman" size="small" extra={<Tag color="green">Guarded</Tag>}>
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Text type="secondary">
          Repair hanya menyamakan field turunan/display/snapshot. Tidak membuat transaksi baru, tidak posting stok ulang, dan tidak menghapus data utama.
        </Text>
        <Alert
          type="info"
          showIcon
          message="Repair wajib berdasarkan hasil audit terakhir."
          description="Jalankan Cek Semua Area atau audit terkait dulu, lihat jumlah kandidat repair, lalu konfirmasi aksi. Tombol repair dikunci jika audit belum ada atau tidak ada kandidat."
        />

        <Divider orientation="left" plain>Stock Read Model Backfill</Divider>
        <Text type="secondary">
          Rebuild hanya menulis collection turunan <Text code>stock_item_read_models</Text>. Tidak mengubah master stock, inventory log, transaksi, produksi, HPP, payroll, atau finance. Cleanup orphan hanya menghapus dokumen read model turunan setelah audit terbaru menunjukkan master source sudah tidak ada.
        </Text>
        <Row gutter={[8, 8]}>
          <Col xs={24} md={6}>
            <Button block icon={<FileSearchOutlined />} loading={loadingStockReadModelAudit} onClick={onLoadStockReadModelAudit}>Cek Read Model Stok</Button>
          </Col>
          <Col xs={24} md={6}>
            {renderGuardedRepairButton({
              label: "Rebuild Read Model Stok",
              title: "Rebuild stock read model?",
              description: "Aksi ini hanya upsert read model missing/stale dari master stock aktif.",
              loading: loadingStockReadModelRepair,
              onConfirm: onRepairStockReadModelAudit,
              audit: stockReadModelAudit,
              summary: stockReadModelSummary,
            })}
          </Col>
          <Col xs={24} md={6}>
            <Popconfirm
              title="Backfill metadata restock read model?"
              description={`Aksi ini hanya menulis metadata purchase terakhir ke stock_item_read_models dari audit terbaru. ${buildGuardMessage({ auditReady: Boolean(stockReadModelAudit), planCount: stockReadModelSummary.restockMetadataRepairCount || 0 })}`}
              okText="Ya, backfill"
              cancelText="Batal"
              disabled={!stockReadModelAudit || !stockReadModelSummary.restockMetadataRepairCount}
              onConfirm={onBackfillStockReadModelRestockMetadata}
            >
              <Button
                block
                icon={<SyncOutlined />}
                loading={loadingStockReadModelRestockBackfill}
                disabled={!stockReadModelAudit || !stockReadModelSummary.restockMetadataRepairCount}
              >
                Backfill Restock{stockReadModelSummary.restockMetadataRepairCount ? ` (${stockReadModelSummary.restockMetadataRepairCount})` : ""}
              </Button>
            </Popconfirm>
          </Col>
          <Col xs={24} md={6}>
            <Popconfirm
              title="Cleanup orphan read model stok?"
              description={(
                <Space direction="vertical" size={6}>
                  <Text>
                    Aksi ini hanya menghapus dokumen turunan stock_item_read_models yang tidak punya master source pada audit terbaru. Master stock, inventory log, transaksi, produksi, HPP, payroll, dan finance tidak disentuh.
                  </Text>
                  <Text type="secondary">
                    Ketik <Text code>{STOCK_READ_MODEL_ORPHAN_CLEANUP_CONFIRM_KEYWORD}</Text> untuk konfirmasi cleanup derived collection.
                  </Text>
                  <Input
                    value={stockReadModelCleanupKeyword}
                    onChange={(event) => setStockReadModelCleanupKeyword(event.target.value)}
                    placeholder={STOCK_READ_MODEL_ORPHAN_CLEANUP_CONFIRM_KEYWORD}
                  />
                </Space>
              )}
              okText="Ya, hapus orphan"
              cancelText="Batal"
              disabled={!stockReadModelAudit || !stockReadModelSummary.orphanCount}
              okButtonProps={{ disabled: !isStockReadModelCleanupKeywordValid }}
              onOpenChange={(open) => {
                if (!open) setStockReadModelCleanupKeyword("");
              }}
              onConfirm={() => onCleanupStockReadModelOrphans({
                confirmKeyword: stockReadModelCleanupKeyword,
              })}
            >
              <Button
                block
                danger
                icon={<DeleteOutlined />}
                loading={loadingStockReadModelCleanup}
                disabled={!stockReadModelAudit || !stockReadModelSummary.orphanCount}
              >
                Cleanup Orphan{stockReadModelSummary.orphanCount ? ` (${stockReadModelSummary.orphanCount})` : ""}
              </Button>
            </Popconfirm>
          </Col>
          <Col xs={24} md={6}>
            <Statistic title="Missing/Stale" value={(stockReadModelSummary.missingCount || 0) + (stockReadModelSummary.staleCount || 0)} />
          </Col>
        </Row>
        {stockReadModelAudit && (
          <Alert
            type={stockReadModelSummary.executablePlanCount || stockReadModelSummary.manualReviewCount ? "warning" : "success"}
            showIcon
            message={stockReadModelSummary.executablePlanCount
              ? `${stockReadModelSummary.executablePlanCount} read model stok perlu rebuild.`
              : stockReadModelSummary.manualReviewCount
                ? `${stockReadModelSummary.manualReviewCount} read model orphan perlu review manual.`
                : "Stock read model sudah sinkron dengan master stock."}
            description={`Master dicek: ${stockReadModelSummary.sourceRecords || 0}. Missing: ${stockReadModelSummary.missingCount || 0}. Stale: ${stockReadModelSummary.staleCount || 0}. Metadata restock: ${stockReadModelSummary.restockMetadataRepairCount || 0}. Orphan cleanup: ${stockReadModelSummary.orphanCount || 0}.`}
          />
        )}
        {stockReadModelRows.some((record) => record.category !== "ok") && (
          <Table
            className="app-data-table"
            size="small"
            rowKey={(record) => record.key || record.readModelId || `${record.sourceCollection}-${record.sourceId}`}
            pagination={{ pageSize: 5 }}
            dataSource={stockReadModelRows.filter((record) => record.category !== "ok")}
            columns={[
              { title: "Area", dataIndex: "sourceLabel", key: "sourceLabel", width: 135, render: (value) => renderCompactText(value, 125) },
              { title: "Item", dataIndex: "itemName", key: "itemName", width: 220, render: (value) => renderCompactText(value, 200) },
              { title: "Read Model", dataIndex: "readModelId", key: "readModelId", width: 210, render: (value) => renderCompactTag(value, 190) },
              {
                title: "Status",
                dataIndex: "category",
                key: "category",
                width: 135,
                render: (value) => (
                  <Tag color={STOCK_READ_MODEL_CATEGORY_COLORS[value] || "default"}>
                    {formatStockReadModelCategory(value)}
                  </Tag>
                ),
              },
              { title: "Issue", dataIndex: "issue", key: "issue", render: (value) => renderCompactText(value, 360) },
            ]}
            scroll={{ x: 980 }}
          />
        )}
        <Divider orientation="left" plain>Reconcile HPP Output</Divider>
        <Text type="secondary">
          Khusus Work Log completed lama yang output/master HPP-nya belum sinkron dengan cost final. Repair hanya menyamakan snapshot cost dan master HPP/average cost; tidak menambah stok, tidak membuat inventory log, dan tidak mengubah payroll.
        </Text>
        <Row gutter={[8, 8]}>
          <Col xs={24} md={8}>
            <Button block icon={<FileSearchOutlined />} loading={loadingHppReconcileAudit} onClick={onLoadHppReconcileAudit}>Cek HPP Output</Button>
          </Col>
          <Col xs={24} md={8}>
            {renderGuardedRepairButton({
              label: "Repair HPP Output",
              title: "Repair HPP output lama?",
              description: "Aksi ini hanya reconcile output line dan master HPP/average cost dari Work Log completed yang aman.",
              loading: loadingHppReconcileRepair,
              onConfirm: onRepairHppReconcileAudit,
              audit: hppReconcileAudit,
              summary: hppReconcileSummary,
            })}
          </Col>
          <Col xs={24} md={8}>
            <Statistic title="Kandidat HPP" value={hppReconcileSummary.executablePlanCount || 0} />
          </Col>
        </Row>
        {hppReconcileAudit && (
          <Alert
            type={hppReconcileSummary.executablePlanCount || hppReconcileSummary.manualReviewCount ? "warning" : "success"}
            showIcon
            message={hppReconcileSummary.executablePlanCount
              ? `${hppReconcileSummary.executablePlanCount} Work Log perlu reconcile HPP output.`
              : hppReconcileSummary.manualReviewCount
                ? `${hppReconcileSummary.manualReviewCount} Work Log perlu review manual sebelum repair HPP.`
                : "HPP output lama sudah sinkron atau tidak ada kandidat aman."}
            description="Work Log dengan payroll final mismatch tetap masuk kategori manual dan tidak diproses otomatis. Jalankan audit ulang setelah repair."
          />
        )}
        {Boolean(hppReconcileRows.length) && (
          <Table
            className="app-data-table"
            size="small"
            rowKey={(record) => record.key || record.workLogId || record.workLogCode}
            pagination={{ pageSize: 5 }}
            dataSource={hppReconcileRows}
            columns={[
              { title: "Work Log", dataIndex: "workLogCode", key: "workLogCode", width: 150, render: (value) => renderCompactTag(value, 130) },
              {
                title: "Status",
                dataIndex: "category",
                key: "category",
                width: 135,
                render: (value) => (
                  <Tag color={HPP_RECONCILE_CATEGORY_COLORS[value] || "default"}>
                    {formatHppReconcileCategory(value)}
                  </Tag>
                ),
              },
              { title: "Good Qty", dataIndex: "goodQty", key: "goodQty", width: 95, render: (value) => formatQuantityId(value) },
              { title: "HPP Final", dataIndex: "expectedUnitCost", key: "expectedUnitCost", width: 140, render: (value) => formatHppUnitCurrencyId(value) },
              { title: "Issue", dataIndex: "issue", key: "issue", render: (value) => renderCompactText(value, 360) },
            ]}
            scroll={{ x: 900 }}
          />
        )}

        <Divider orientation="left" plain>Repair Side-Effect Transaksi</Divider>
        <Text type="secondary">
          Memperbaiki side-effect aktual transaksi yang hilang: income Sales selesai, expense Purchases, dan inventory log Sales/Purchases/Returns. Repair ini tidak mengubah stok master, tidak menghapus data lama, dan tidak mengubah dokumen transaksi utama.
        </Text>
        <Alert
          type="warning"
          showIcon
          message="Gunakan untuk repair data transaksi yang sudah terlanjur partial."
          description="Klik Cek Side-Effect dulu, review kandidat dan manual review, lalu repair dengan keyword konfirmasi. Data dengan konflik seperti Sales belum selesai tetapi sudah punya income tetap manual dan tidak dihapus otomatis."
        />
        <Row gutter={[8, 8]}>
          <Col xs={24} md={8}>
            <Button block icon={<FileSearchOutlined />} loading={loadingTransactionSideEffectAudit} onClick={onLoadTransactionSideEffectAudit}>Cek Side-Effect Transaksi</Button>
          </Col>
          <Col xs={24} md={8}>
            <Button
              block
              icon={<SyncOutlined />}
              loading={loadingTransactionSideEffectRepair}
              disabled={!transactionSideEffectAudit || !transactionSideEffectSummary.executablePlanCount}
              onClick={onOpenTransactionSideEffectRepairConfirm}
            >
              Repair Side-Effect{transactionSideEffectSummary.executablePlanCount ? ` (${transactionSideEffectSummary.executablePlanCount})` : ""}
            </Button>
          </Col>
          <Col xs={24} md={8}>
            <Statistic title="Manual Review" value={transactionSideEffectSummary.manualReviewCount || 0} />
          </Col>
        </Row>
        {transactionSideEffectAudit && (
          <Alert
            type={transactionSideEffectSummary.executablePlanCount || transactionSideEffectSummary.manualReviewCount ? "warning" : "success"}
            showIcon
            message={transactionSideEffectSummary.executablePlanCount
              ? `${transactionSideEffectSummary.executablePlanCount} side-effect transaksi bisa direpair aman.`
              : transactionSideEffectSummary.manualReviewCount
                ? `${transactionSideEffectSummary.manualReviewCount} side-effect transaksi perlu review manual.`
                : "Side-effect transaksi aktif sudah sinkron."}
            description="Repair hanya membuat dokumen yang hilang. Jalankan audit ulang setelah repair dan cek Cash In/Cash Out, Stock Management, Sales Report, Purchases Report, dan Profit Loss."
          />
        )}
        {Boolean(transactionSideEffectRows.length) && (
          <Table
            className="app-data-table"
            size="small"
            rowKey={(record) => record.key || `${record.sourceCollection}-${record.sourceId}-${record.sideEffect}`}
            pagination={{ pageSize: 5 }}
            dataSource={transactionSideEffectRows}
            columns={[
              { title: "Sumber", dataIndex: "sourceRef", key: "sourceRef", width: 150, render: (value) => renderCompactTag(value, 135) },
              { title: "Area", dataIndex: "area", key: "area", width: 110, render: (value) => renderCompactText(value, 100) },
              { title: "Target", dataIndex: "targetCollection", key: "targetCollection", width: 125, render: (value) => renderCompactTag(value, 115) },
              {
                title: "Status",
                dataIndex: "category",
                key: "category",
                width: 135,
                render: (value) => (
                  <Tag color={TRANSACTION_SIDE_EFFECT_CATEGORY_COLORS[value] || "default"}>
                    {formatTransactionSideEffectCategory(value)}
                  </Tag>
                ),
              },
              { title: "Issue", dataIndex: "issue", key: "issue", render: (value) => renderCompactText(value, 360) },
            ]}
            scroll={{ x: 920 }}
          />
        )}

        <Divider orientation="left" plain>Repair Turunan Umum</Divider>
        <Row gutter={[8, 8]}>
          <Col xs={24} md={8}>
            {renderGuardedRepairButton({
              label: "Repair Stok",
              title: "Repair field stok turunan?",
              description: "Aksi ini hanya update stock/currentStock/reserved/available turunan dari audit stok, tanpa membuat inventory log baru.",
              loading: loadingStockRepair,
              onConfirm: onRepairStockAudit,
              audit: stockAudit,
              summary: stockRepairSummary,
            })}
          </Col>
          <Col xs={24} md={8}>
            {renderGuardedRepairButton({
              label: "Repair Inventory Log",
              title: "Repair schema/display inventory log?",
              description: "Aksi ini hanya melengkapi field schema/display log, tanpa mengubah qty atau stok.",
              loading: loadingLogSchemaRepair,
              onConfirm: onRepairLogSchema,
              audit: logSchemaAudit,
              summary: logSchemaRepairSummary,
            })}
          </Col>
          <Col xs={24} md={8}>
            {renderGuardedRepairButton({
              label: "Repair Produksi",
              title: "Repair snapshot varian produksi?",
              description: "Aksi ini hanya memperbaiki field turunan produksi yang audit-nya aman, tanpa posting stok ulang.",
              loading: loadingMaintenanceRepair,
              onConfirm: onRepairProductionMaintenance,
              audit: maintenanceAudit,
              summary: maintenanceRepairSummary,
            })}
          </Col>
          <Col xs={24} md={8}>
            {renderGuardedRepairButton({
              label: "Repair Payroll Snapshot",
              title: "Repair payroll/work log snapshot?",
              description: "Aksi ini hanya memperbaiki snapshot payroll yang sumber Step-nya jelas dan tidak mengubah payroll final terkunci.",
              loading: loadingPayrollRepair,
              onConfirm: onRepairPayrollAudit,
              audit: payrollAudit,
              summary: payrollRepairSummary,
            })}
          </Col>
          <Col xs={24} md={8}>
            {renderGuardedRepairButton({
              label: "Repair Variant Transaksi",
              title: "Repair variant lintas transaksi?",
              description: "Aksi ini hanya mengisi snapshot variant dari sumber lama yang jelas, tanpa mengubah qty, stok, atau kas.",
              loading: loadingTransactionVariantRepair,
              onConfirm: onRepairTransactionVariantAudit,
              audit: transactionVariantAudit,
              summary: transactionVariantRepairSummary,
            })}
          </Col>
          <Col xs={24} md={8}>
            <Popconfirm
              title="Sinkronkan field stok turunan?"
              description={`Aksi ini update field stok turunan master dari audit stok terakhir, bukan reset transaksi. ${buildGuardMessage({ auditReady: stockAuditReady, planCount: getRepairPlanCount(stockRepairSummary) })}`}
              okText="Ya, sinkronkan"
              cancelText="Batal"
              disabled={stockSyncDisabled}
              onConfirm={onSyncStocks}
            >
              <Button block icon={<SyncOutlined />} loading={loadingSync} disabled={stockSyncDisabled}>Sync All Stocks</Button>
            </Popconfirm>
          </Col>
        </Row>

        <Divider orientation="left" plain>Normalisasi Kode Master</Divider>
        <Text type="secondary">
          Dipakai untuk menyamakan kode internal Product, Raw Material, Semi Finished, BOM, Step, dan Supplier ke standar aktif tanpa rename document ID dan tanpa mengubah transaksi/history.
        </Text>
        <Row gutter={[8, 8]}>
          <Col xs={24} md={8}>
            <Button block icon={<FileSearchOutlined />} loading={loadingMasterCodeAudit} onClick={onLoadMasterCodeAudit}>Cek Kode Master</Button>
          </Col>
          <Col xs={24} md={8}>
            <Popconfirm
              title="Normalisasi kode master?"
              description="Aksi ini hanya update field code/alias master. Document ID dan data transaksi/history tidak diubah. Jalankan Cek Kode Master dulu agar jumlah kandidat jelas."
              okText="Ya, normalisasi"
              cancelText="Batal"
              disabled={!masterCodeAudit || !masterCodeSummary.executablePlanCount}
              onConfirm={onRepairMasterCodeAudit}
            >
              <Button block icon={<SyncOutlined />} loading={loadingMasterCodeRepair} disabled={!masterCodeAudit || !masterCodeSummary.executablePlanCount}>Normalisasi Kode</Button>
            </Popconfirm>
          </Col>
          <Col xs={24} md={8}>
            <Statistic title="Perlu Normalisasi" value={masterCodeSummary.executablePlanCount || 0} />
          </Col>
        </Row>
        {masterCodeAudit && (
          <Alert
            type={masterCodeSummary.executablePlanCount ? "warning" : "success"}
            showIcon
            message={masterCodeSummary.executablePlanCount ? `${masterCodeSummary.executablePlanCount} kode master perlu dinormalisasi.` : "Kode master sudah sesuai standar aktif."}
            description="Field yang disentuh hanya kode internal/alias. Data history seperti purchase, stock log, work log, payroll, dan transaksi tidak ikut diubah."
          />
        )}
        {Boolean(masterCodeRows.length) && (
          <Table
            className="app-data-table"
            size="small"
            pagination={{ pageSize: 5 }}
            dataSource={masterCodeRows}
            columns={[
              { title: "Area", dataIndex: "area", key: "area", width: 150, render: (value) => renderCompactText(value, 135) },
              { title: "Item", dataIndex: "itemName", key: "itemName", width: 220, render: (value) => renderCompactText(value, 200) },
              { title: "Kode Saat Ini", dataIndex: "currentCode", key: "currentCode", width: 140, render: (value) => renderCompactTag(value, 125) },
              { title: "Kode Baru", dataIndex: "proposedCode", key: "proposedCode", width: 140, render: (value) => renderCompactTag(value, 125) },
              { title: "Catatan", dataIndex: "issue", key: "issue", render: (value) => renderCompactText(value, 320) },
            ]}
            scroll={{ x: 880 }}
          />
        )}
      </Space>
    </Card>
  );
};

export default ResetSafeRepairPanel;
