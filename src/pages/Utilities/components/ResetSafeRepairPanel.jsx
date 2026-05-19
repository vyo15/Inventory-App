import { FileSearchOutlined, SyncOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, Divider, Popconfirm, Row, Space, Statistic, Table, Tag, Typography } from "antd";

const { Text } = Typography;

const ResetSafeRepairPanel = ({
  loadingStockRepair,
  onRepairStockAudit,
  loadingLogSchemaRepair,
  onRepairLogSchema,
  loadingMaintenanceRepair,
  onRepairProductionMaintenance,
  loadingPayrollRepair,
  onRepairPayrollAudit,
  loadingTransactionVariantRepair,
  onRepairTransactionVariantAudit,
  loadingSync,
  onSyncStocks,
  loadingMasterCodeAudit,
  onLoadMasterCodeAudit,
  loadingMasterCodeRepair,
  onRepairMasterCodeAudit,
  masterCodeSummary,
  masterCodeAudit,
  masterCodeRows,
  renderCompactText,
  renderCompactTag,
}) => (
  <Card title="Repair Turunan Aman" size="small" extra={<Tag color="green">Tidak hapus data</Tag>}>
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Text type="secondary">
        Repair hanya menyamakan field turunan/display/snapshot. Tidak membuat transaksi baru, tidak posting stok ulang, dan tidak menghapus data utama.
      </Text>
      <Row gutter={[8, 8]}>
        <Col xs={24} md={8}><Button block icon={<SyncOutlined />} loading={loadingStockRepair} onClick={onRepairStockAudit}>Repair Stok</Button></Col>
        <Col xs={24} md={8}><Button block icon={<SyncOutlined />} loading={loadingLogSchemaRepair} onClick={onRepairLogSchema}>Repair Inventory Log</Button></Col>
        <Col xs={24} md={8}><Button block icon={<SyncOutlined />} loading={loadingMaintenanceRepair} onClick={onRepairProductionMaintenance}>Repair Produksi</Button></Col>
        <Col xs={24} md={8}><Button block icon={<SyncOutlined />} loading={loadingPayrollRepair} onClick={onRepairPayrollAudit}>Repair Payroll Snapshot</Button></Col>
        <Col xs={24} md={8}><Button block icon={<SyncOutlined />} loading={loadingTransactionVariantRepair} onClick={onRepairTransactionVariantAudit}>Repair Variant Transaksi</Button></Col>
        <Col xs={24} md={8}>
          <Popconfirm
            title="Sinkronkan semua stok turunan?"
            description="Aksi ini update field stok turunan master, bukan reset transaksi. Jalankan setelah audit jika benar-benar diperlukan."
            okText="Ya, sinkronkan"
            cancelText="Batal"
            onConfirm={onSyncStocks}
          >
            <Button block icon={<SyncOutlined />} loading={loadingSync}>Sync All Stocks</Button>
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
            description="Aksi ini hanya update field code/alias master. Document ID dan data transaksi/history tidak diubah."
            okText="Ya, normalisasi"
            cancelText="Batal"
            onConfirm={onRepairMasterCodeAudit}
          >
            <Button block icon={<SyncOutlined />} loading={loadingMasterCodeRepair} disabled={!masterCodeSummary.executablePlanCount}>Normalisasi Kode</Button>
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

export default ResetSafeRepairPanel;
