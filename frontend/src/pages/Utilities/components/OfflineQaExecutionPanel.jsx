import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Collapse,
  Progress,
  Row,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import {
  CheckCircleOutlined,
  CopyOutlined,
  FileDoneOutlined,
  ReloadOutlined,
} from "@ant-design/icons";

const { Text, Title } = Typography;

const QA_STORAGE_KEY = "ims_offline_release_candidate_qa_v1";

const QA_GROUPS = [
  {
    key: "environment",
    title: "Environment & build",
    risk: "release",
    items: [
      { key: "npm-install", label: "npm install / npm ci selesai tanpa error blocker." },
      { key: "lint", label: "npm run lint sukses." },
      { key: "build", label: "npm run build sukses." },
      { key: "fresh-reload", label: "Aplikasi bisa dibuka dari fresh reload." },
      { key: "auth-route", label: "Login/session/protected route tetap normal." },
    ],
  },
  {
    key: "offline-master-data",
    title: "Categories & Customers offline pilot",
    risk: "pilot-write",
    items: [
      { key: "category-pull", label: "Categories berhasil preview dan pull Firebase → Offline." },
      { key: "customer-pull", label: "Customers berhasil preview dan pull Firebase → Offline." },
      { key: "offline-mode-keyword", label: "Offline Mode hanya aktif dengan keyword guarded." },
      { key: "category-local-write", label: "Create/edit Category offline membuat queue pending." },
      { key: "customer-local-write", label: "Create/edit Customer offline membuat queue pending." },
      { key: "offline-push-allowlist", label: "Offline → Firebase hanya menawarkan Categories dan Customers." },
      { key: "sales-customer-firebase", label: "Sales tetap membaca customer Firebase-primary, bukan customer local-only." },
    ],
  },
  {
    key: "snapshots",
    title: "Read-only snapshots",
    risk: "read-only",
    items: [
      { key: "supplier-snapshot", label: "Supplier snapshot bisa dipull dan tidak masuk queue." },
      { key: "product-raw-semi-snapshot", label: "Product/Raw/Semi snapshot bisa dipull dan tidak masuk queue." },
      { key: "stock-snapshot", label: "Stock snapshot bisa dipull dan tidak menyediakan edit/adjustment." },
      { key: "production-snapshot", label: "Production/Payroll/HPP snapshot bisa dipull dan read-only." },
      { key: "report-snapshot", label: "Report/Finance snapshot bisa dipull dengan keyword read-only." },
      { key: "snapshot-no-push", label: "Snapshot tidak muncul di Offline → Firebase dan tidak membuat mutation." },
    ],
  },
  {
    key: "queue-conflict",
    title: "Queue, conflict, health",
    risk: "data-integrity",
    items: [
      { key: "queue-filter", label: "Queue tab bisa filter status/collection dan melihat detail payload." },
      { key: "retry-failed", label: "Retry failed hanya mengubah failed → pending dengan keyword guarded." },
      { key: "clear-failed", label: "Clear failed hanya menghapus queue failed local dengan keyword guarded." },
      { key: "conflict-diff", label: "Conflict tab menampilkan diff Local vs Firebase." },
      { key: "resolve-guard", label: "Resolve conflict hanya aktif dengan keyword dan default aman manual review/skip." },
      { key: "health-audit", label: "Health audit tidak menampilkan error blocker sebelum merge." },
    ],
  },
  {
    key: "backup-restore",
    title: "Backup & restore",
    risk: "local-data",
    items: [
      { key: "backup-export", label: "Export backup punya metadata appVersion, schemaVersion, sourceMode, recordCounts." },
      { key: "restore-preview", label: "Preview restore menampilkan restore plan dan warning/error." },
      { key: "restore-dry-run", label: "Dry-run restore tidak mengubah IndexedDB." },
      { key: "restore-keyword", label: "Restore hanya berjalan dengan keyword guarded." },
      { key: "sensitive-field", label: "Backup/restore/queue menolak field credential/secret." },
    ],
  },
  {
    key: "guarded-modules",
    title: "Guarded business module regression",
    risk: "business-critical",
    items: [
      { key: "purchase-online", label: "Purchase final tetap Firebase-primary dan stock/expense/history normal." },
      { key: "sales-online", label: "Sales final tetap Firebase-primary dan stock out/income normal." },
      { key: "returns-online", label: "Returns tetap Firebase-primary dan tidak menjadi offline mutation." },
      { key: "finance-online", label: "Finance Cash In/Out, ledger, dan Profit/Loss tetap Firebase-primary." },
      { key: "production-online", label: "Production, Payroll, dan HPP final tetap Firebase-primary." },
      { key: "reset-guard", label: "Reset destructive tetap memakai preview dan keyword guard." },
    ],
  },
];

const getAllQaItems = () => QA_GROUPS.flatMap((group) =>
  group.items.map((item) => ({ ...item, groupKey: group.key, groupTitle: group.title }))
);

const loadSavedChecks = () => {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(QA_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn("Gagal membaca status QA offline dari localStorage:", error);
    return {};
  }
};

const saveChecks = (checks) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(QA_STORAGE_KEY, JSON.stringify({ ...checks, savedAt: new Date().toISOString() }));
};

const buildQaSummaryText = ({ checkedCount, totalCount, groupRows }) => {
  const lines = [
    "IMS Offline Release Candidate QA",
    `Progress: ${checkedCount}/${totalCount}`,
    "",
    ...groupRows.map((row) => `- ${row.title}: ${row.done}/${row.total} (${row.status})`),
  ];
  return lines.join("\n");
};

const OfflineQaExecutionPanel = () => {
  const [checkedMap, setCheckedMap] = useState({});

  const allItems = useMemo(() => getAllQaItems(), []);
  const totalCount = allItems.length;
  const checkedCount = allItems.filter((item) => checkedMap[item.key]).length;
  const progressPercent = totalCount ? Math.round((checkedCount / totalCount) * 100) : 0;

  const groupRows = useMemo(() => QA_GROUPS.map((group) => {
    const done = group.items.filter((item) => checkedMap[item.key]).length;
    const total = group.items.length;
    return {
      key: group.key,
      title: group.title,
      risk: group.risk,
      done,
      total,
      status: done === total ? "lulus" : done > 0 ? "sebagian" : "belum",
    };
  }), [checkedMap]);

  useEffect(() => {
    setCheckedMap(loadSavedChecks());
  }, []);

  useEffect(() => {
    saveChecks(checkedMap);
  }, [checkedMap]);

  const toggleItem = (itemKey, checked) => {
    setCheckedMap((current) => ({ ...current, [itemKey]: checked }));
  };

  const handleReset = () => {
    setCheckedMap({});
    if (typeof window !== "undefined") window.localStorage.removeItem(QA_STORAGE_KEY);
    message.success("Checklist QA local direset.");
  };

  const handleCopySummary = async () => {
    const summaryText = buildQaSummaryText({ checkedCount, totalCount, groupRows });
    try {
      await navigator.clipboard.writeText(summaryText);
      message.success("Ringkasan QA disalin ke clipboard.");
    } catch (error) {
      console.warn("Gagal copy ringkasan QA:", error);
      message.warning("Browser tidak mengizinkan copy otomatis. Ringkasan bisa dilihat di tabel.");
    }
  };

  const summaryColumns = [
    { title: "Area", dataIndex: "title", key: "title", ellipsis: true },
    { title: "Risk", dataIndex: "risk", key: "risk", width: 150, responsive: ["md"], render: (value) => <Tag>{value}</Tag> },
    { title: "Progress", key: "progress", width: 120, render: (_, row) => `${row.done}/${row.total}` },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (value) => <Tag color={value === "lulus" ? "green" : value === "sebagian" ? "gold" : "default"}>{value}</Tag>,
    },
  ];

  const collapseItems = QA_GROUPS.map((group) => {
    const done = group.items.filter((item) => checkedMap[item.key]).length;
    return {
      key: group.key,
      label: (
        <Space wrap>
          <span>{group.title}</span>
          <Tag color={done === group.items.length ? "green" : done ? "gold" : "default"}>{done}/{group.items.length}</Tag>
          <Tag>{group.risk}</Tag>
        </Space>
      ),
      children: (
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          {group.items.map((item) => (
            <Checkbox
              key={item.key}
              checked={Boolean(checkedMap[item.key])}
              onChange={(event) => toggleItem(item.key, event.target.checked)}
            >
              {item.label}
            </Checkbox>
          ))}
        </Space>
      ),
    };
  });

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Alert
        type={progressPercent === 100 ? "success" : "warning"}
        showIcon
        message={progressPercent === 100 ? "Release candidate QA sudah tercentang lengkap" : "Checklist ini membantu QA manual, bukan pengganti test browser/Firebase live"}
        description="Centang hanya setelah test benar-benar dilakukan di environment kamu. Status disimpan di localStorage browser ini dan tidak dikirim ke Firebase."
      />

      <Row gutter={[12, 12]}>
        <Col xs={24} md={10}>
          <Card size="small" className="offline-db-status-card">
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              <Space>
                <FileDoneOutlined />
                <Text strong>Progress QA manual</Text>
              </Space>
              <Progress percent={progressPercent} status={progressPercent === 100 ? "success" : "active"} />
              <Text type="secondary">{checkedCount} dari {totalCount} checklist sudah ditandai selesai.</Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={14}>
          <Card size="small" className="offline-db-status-card">
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              <Title level={5} style={{ margin: 0 }}>Aturan lulus release candidate</Title>
              <Text type="secondary">
                Patch boleh dianggap siap merge/deploy hanya jika build/lint sukses, tidak ada Health error blocker,
                snapshot tetap read-only, dan modul stock/purchase/sales/finance/production/payroll/HPP tetap Firebase-primary.
              </Text>
              <Space wrap>
                <Button icon={<CopyOutlined />} onClick={handleCopySummary}>Copy Ringkasan QA</Button>
                <Button icon={<ReloadOutlined />} danger onClick={handleReset}>Reset Checklist Local</Button>
              </Space>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card size="small" title="Ringkasan area QA" className="offline-db-action-card">
        <Table
          size="small"
          rowKey="key"
          columns={summaryColumns}
          dataSource={groupRows}
          pagination={false}
          scroll={{ x: 620 }}
        />
      </Card>

      <Card size="small" title="Checklist eksekusi manual" className="offline-db-action-card">
        <Collapse size="small" items={collapseItems} defaultActiveKey={["environment", "offline-master-data"]} />
      </Card>

      {progressPercent === 100 ? (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          message="Semua checklist QA manual sudah ditandai selesai"
          description="Tetap simpan bukti hasil test lokal seperti output lint/build, catatan bug, dan screenshot jika diperlukan sebelum merge final."
        />
      ) : null}
    </Space>
  );
};

export default OfflineQaExecutionPanel;
