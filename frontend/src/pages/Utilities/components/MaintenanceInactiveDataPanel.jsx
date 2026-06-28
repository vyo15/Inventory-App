import {
  useCallback,
  useEffect,
  useMemo,
  useState } from "react";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Collapse,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  DeleteOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  SafetyOutlined,
} from "@ant-design/icons";
import EmptyStateBlock from "../../../components/Layout/Feedback/EmptyStateBlock";
import StatusTag from "../../../components/Layout/Feedback/StatusTag";
import DataTableView from "../../../components/Layout/Table/DataTableView";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import { formatDateTimeId } from "../../../utils/formatters/dateId";
import {
  getSqliteInactiveData,
  purgeSqliteInactiveData,
} from "../../../services/System/sqliteBackendStatusService";

const { Text, Title } = Typography;

const formatDateTime = (value) => formatDateTimeId(value, { fallback: value || "-" });

const getCandidateTarget = (candidate) => String(
  candidate?.code || candidate?.name || candidate?.id || "",
).trim();

const MaintenanceInactiveDataPanel = () => {
  const { message: appMessage } = AntdApp.useApp();
  const [loading, setLoading] = useState(false);
  const [purging, setPurging] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [confirmKeyword, setConfirmKeyword] = useState("");
  const [confirmTarget, setConfirmTarget] = useState("");
  const [candidateFilter, setCandidateFilter] = useState("all");

  const loadPreview = useCallback(async ({ showSuccess = false } = {}) => {
    setLoading(true);
    try {
      const response = await getSqliteInactiveData();
      setPreview(response?.data || null);
      if (showSuccess) appMessage.success("Preview data nonaktif berhasil diperbarui.");
    } catch (error) {
      console.error("Gagal memuat preview data nonaktif:", error);
      appMessage.error(error?.message || "Preview data nonaktif belum bisa dimuat.");
    } finally {
      setLoading(false);
    }
  }, [appMessage]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const resetPurgeModal = () => {
    setSelectedCandidate(null);
    setConfirmKeyword("");
    setConfirmTarget("");
  };

  const closePurgeModal = () => {
    if (purging) return;
    resetPurgeModal();
  };

  const expectedKeyword = preview?.confirmKeyword || "HAPUS PERMANEN";
  const expectedTarget = getCandidateTarget(selectedCandidate);
  const purgeReady = Boolean(
    selectedCandidate?.safeToDelete
    && confirmKeyword.trim() === expectedKeyword
    && confirmTarget.trim().toLowerCase() === expectedTarget.toLowerCase(),
  );

  const executePurge = async () => {
    if (!purgeReady) return;
    setPurging(true);
    try {
      const response = await purgeSqliteInactiveData({
        entityType: selectedCandidate.entityType,
        id: selectedCandidate.id,
        confirmKeyword: confirmKeyword.trim(),
        confirmTarget: confirmTarget.trim(),
      });
      appMessage.success(
        response?.message || "Data nonaktif berhasil dihapus permanen dan snapshot audit dipertahankan.",
      );
      resetPurgeModal();
      await loadPreview();
    } catch (error) {
      console.error("Gagal menghapus permanen data nonaktif:", error);
      appMessage.error(error?.message || "Hapus permanen diblokir atau gagal dijalankan.");
    } finally {
      setPurging(false);
    }
  };

  const summary = preview?.summary || {};
  const groups = useMemo(() => {
    if (!Array.isArray(preview?.groups)) return [];
    return preview.groups
      .filter((group) => group && typeof group === "object")
      .map((group) => ({
        ...group,
        candidates: Array.isArray(group.candidates)
          ? group.candidates
            .filter((candidate) => candidate && typeof candidate === "object")
            .filter((candidate) => candidateFilter === "all"
              || (candidateFilter === "safe" && candidate.safeToDelete)
              || (candidateFilter === "blocked" && !candidate.safeToDelete))
          : [],
      }));
  }, [candidateFilter, preview?.groups]);
  const collapseItems = useMemo(() => groups.map((group) => ({
    key: group.entityType,
    label: (
      <Space size={8} wrap>
        <Text strong>{group.entityLabel}</Text>
        <Tag>{group.count || 0} nonaktif</Tag>
        <StatusTag tone="success">{group.safeCount || 0} aman</StatusTag>
        {group.blockedCount ? <Tag color="orange">{group.blockedCount} dilindungi</Tag> : null}
      </Space>
    ),
    children: group.candidates?.length ? (
      <DataTableView
        className="app-data-table"
        size="small"
        pagination={{ pageSize: 20, showSizeChanger: true, hideOnSinglePage: true }}
        rowKey={(record) => `${record.entityType}:${record.id}`}
        dataSource={group.candidates}
        locale={{ emptyText: <EmptyStateBlock compact description="Tidak ada data nonaktif" /> }}
        columns={[
          {
            title: "Data",
            key: "data",
            render: (_, record) => (
              <Space direction="vertical" size={1}>
                <Text strong>{record?.name || "-"}</Text>
                <Text type="secondary">{record?.code || `ID ${record?.id || "-"}`}</Text>
              </Space>
            ),
          },
          {
            title: "Status",
            dataIndex: "status",
            key: "status",
            width: 120,
            render: (value) => <Tag color="orange">{value || "nonaktif"}</Tag>,
          },
          {
            title: "Terakhir Diubah",
            dataIndex: "updatedAt",
            key: "updatedAt",
            width: 170,
            render: formatDateTime,
          },
          {
            title: "Dependency",
            key: "dependency",
            width: 280,
            render: (_, record) => record.safeToDelete ? (
              <StatusTag tone="success" icon={<SafetyOutlined />}>Tidak ada referensi terdeteksi</StatusTag>
            ) : (
              <Space direction="vertical" size={2}>
                <Tag color="orange">Diblokir</Tag>
                {(record.blockers || []).slice(0, 2).map((blocker) => (
                  <Text type="secondary" key={`${blocker.type}:${blocker.table || "-"}`}>
                    {blocker.message}
                  </Text>
                ))}
                {(record.blockers || []).length > 2 ? (
                  <Text type="secondary">+{record.blockers.length - 2} pemeriksaan lain</Text>
                ) : null}
              </Space>
            ),
          },
          {
            title: "Aksi",
            key: "action",
            width: 150,
            render: (_, record) => (
              <Button
                danger
                size="small"
                icon={<DeleteOutlined />}
                disabled={!record.safeToDelete}
                onClick={() => setSelectedCandidate(record)}
              >
                Hapus Permanen
              </Button>
            ),
          },
        ]}
        mobileCardConfig={{
          title: (record) => record?.name || record?.code || "Data nonaktif",
          subtitle: (record) => [record?.entityLabel, record?.code || `ID ${record?.id || "-"}`],
          tags: (record) => (
            <Space size={4} wrap>
              <Tag color="orange">{record.status || "nonaktif"}</Tag>
              <Tag color={record.safeToDelete ? "green" : "orange"}>
                {record.safeToDelete ? "Aman dipurge" : "Dilindungi"}
              </Tag>
            </Space>
          ),
          meta: [
            { label: "Terakhir diubah", value: (record) => formatDateTime(record.updatedAt) },
            {
              label: "Dependency",
              value: (record) => record.safeToDelete
                ? "Tidak ada referensi terdeteksi"
                : record.blockers?.[0]?.message || "Masih direferensikan",
            },
          ],
          actions: (record) => (
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
              disabled={!record.safeToDelete}
              onClick={() => setSelectedCandidate(record)}
            >
              Hapus Permanen
            </Button>
          ),
        }}
        scroll={{ x: 980 }}
      />
    ) : <EmptyStateBlock compact description={`Tidak ada ${group.entityLabel.toLowerCase()} nonaktif`} />,
  })), [groups]);

  return (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <ImsNotice
        variant="critical"
        compact
        title="Hapus permanen hanya untuk data nonaktif yang aman"
        description="Data yang masih dipakai transaksi atau histori tetap dilindungi. Setiap penghapusan wajib melewati pemeriksaan referensi, backup otomatis, konfirmasi ganda, dan snapshot audit."
      />

      <div className="maintenance-inactive-toolbar">
        <div>
          <Title level={5} style={{ margin: 0 }}>Data Nonaktif & Purge Guarded</Title>
          <Text type="secondary">Preview bersifat read-only. Data yang masih direferensikan tetap diblokir.</Text>
        </div>
        <Space wrap size={8} className="maintenance-inactive-toolbar-actions">
          <Select
            value={candidateFilter}
            onChange={setCandidateFilter}
            style={{ minWidth: 170 }}
            options={[
              { value: "all", label: "Semua data nonaktif" },
              { value: "safe", label: "Aman dihapus" },
              { value: "blocked", label: "Dilindungi histori" },
            ]}
          />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => loadPreview({ showSuccess: true })}>
            Refresh Preview
          </Button>
        </Space>
      </div>

      <div className="maintenance-inactive-summary">
        <Card size="small"><Text type="secondary">Total nonaktif</Text><Title level={4}>{summary.total || 0}</Title></Card>
        <Card size="small"><Text type="secondary">Aman dipurge</Text><Title level={4}>{summary.safe || 0}</Title></Card>
        <Card size="small"><Text type="secondary">Dilindungi histori</Text><Title level={4}>{summary.blocked || 0}</Title></Card>
      </div>

      {preview?.policy ? (
        <Collapse
          size="small"
          className="maintenance-inactive-policy"
          items={[{
            key: "policy",
            label: "Lihat kebijakan penghapusan IMS",
            children: (
              <Text type="secondary">
                Menu operasional hanya menonaktifkan data. Maintenance menghapus satu record per aksi hanya bila dependency check bersih. Stok, transaksi, finance, produksi, payroll, backup, restore, dan audit log tidak dapat dihapus dari panel ini.
              </Text>
            ),
          }]}
        />
      ) : null}

      <Collapse
        className="maintenance-inactive-collapse"
        items={collapseItems}
        defaultActiveKey={groups.filter((group) => group.count > 0).slice(0, 1).map((group) => group.entityType)}
      />

      <Modal
        open={Boolean(selectedCandidate)}
        title="Konfirmasi hapus permanen"
        okText="Hapus Permanen"
        okButtonProps={{ danger: true, disabled: !purgeReady, loading: purging }}
        cancelText="Batal"
        onCancel={closePurgeModal}
        onOk={executePurge}
        maskClosable={!purging}
        closable={!purging}
        destroyOnHidden
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Alert
            type="error"
            showIcon
            icon={<ExclamationCircleOutlined />}
            message="Aksi ini tidak dapat dibatalkan dari UI"
            description="Sistem membuat backup otomatis dan menyimpan snapshot record ke audit log sebelum commit. Gunakan restore backup hanya bila pemulihan benar-benar diperlukan."
          />
          <div>
            <Text type="secondary">Target</Text><br />
            <Text strong>{selectedCandidate?.entityLabel}: {selectedCandidate?.name}</Text><br />
            <Text code>{expectedTarget}</Text>
          </div>
          <div>
            <Text>Ketik keyword <Text code>{expectedKeyword}</Text></Text>
            <Input
              value={confirmKeyword}
              onChange={(event) => setConfirmKeyword(event.target.value)}
              placeholder={expectedKeyword}
              autoComplete="off"
            />
          </div>
          <div>
            <Text>Ketik target <Text code>{expectedTarget}</Text></Text>
            <Input
              value={confirmTarget}
              onChange={(event) => setConfirmTarget(event.target.value)}
              placeholder={expectedTarget}
              autoComplete="off"
            />
          </div>
        </Space>
      </Modal>
    </Space>
  );
};

export default MaintenanceInactiveDataPanel;
