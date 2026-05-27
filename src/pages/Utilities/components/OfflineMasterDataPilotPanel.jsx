import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { DatabaseOutlined, ReloadOutlined, SaveOutlined } from "@ant-design/icons";

import { ensureLocalDbFoundationMeta } from "../../../data/local/localDbMeta";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "../../../data/repositories/categoriesRepository";
import {
  createCustomer,
  deleteCustomer,
  listCustomers,
  updateCustomer,
} from "../../../data/repositories/customersRepository";
import { REPOSITORY_MODES } from "../../../data/repositories/repositoryMode";
import { getSyncQueueSummary } from "../../../data/sync/syncQueueService";

const { Text } = Typography;

const OFFLINE_OPTIONS = Object.freeze({ mode: REPOSITORY_MODES.OFFLINE_LOCAL });

const PILOT_COLLECTIONS = Object.freeze({
  CATEGORIES: "categories",
  CUSTOMERS: "customers",
});

const createLocalCustomerCode = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `CUS-LOCAL-${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

const normalizeText = (value) => String(value || "").trim();

const getRepositoryApi = (collectionName) => {
  if (collectionName === PILOT_COLLECTIONS.CUSTOMERS) {
    return {
      list: listCustomers,
      create: createCustomer,
      update: updateCustomer,
      remove: deleteCustomer,
      idLabel: "Kode/ID Customer",
      nameLabel: "Nama Customer",
    };
  }

  return {
    list: listCategories,
    create: createCategory,
    update: updateCategory,
    remove: deleteCategory,
    idLabel: "ID Kategori (opsional)",
    nameLabel: "Nama Kategori",
  };
};

const OfflineMasterDataPilotPanel = () => {
  const [form] = Form.useForm();
  const [collectionName, setCollectionName] = useState(PILOT_COLLECTIONS.CATEGORIES);
  const [records, setRecords] = useState([]);
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [queueSummary, setQueueSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const api = useMemo(() => getRepositoryApi(collectionName), [collectionName]);

  const loadRecords = useCallback(async (showSuccessMessage = false) => {
    try {
      setLoading(true);
      await ensureLocalDbFoundationMeta();
      const [rows, queue] = await Promise.all([
        api.list(OFFLINE_OPTIONS),
        getSyncQueueSummary(),
      ]);
      setRecords(rows);
      setQueueSummary(queue);
      if (showSuccessMessage) {
        message.success("Data pilot offline berhasil dimuat.");
      }
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal memuat data pilot offline.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  const resetFormForCollection = useCallback((nextCollectionName) => {
    const isCustomer = nextCollectionName === PILOT_COLLECTIONS.CUSTOMERS;
    form.resetFields();
    form.setFieldsValue({
      id: isCustomer ? createLocalCustomerCode() : "",
      name: "",
      contact: "",
      description: "",
      address: "",
      note: "",
    });
    setSelectedRecordId("");
  }, [form]);

  const handleCollectionChange = useCallback((nextCollectionName) => {
    setCollectionName(nextCollectionName);
    resetFormForCollection(nextCollectionName);
    setRecords([]);
  }, [resetFormForCollection]);

  const handleEdit = useCallback((record) => {
    setSelectedRecordId(record.id);
    form.setFieldsValue({
      id: record.id,
      name: record.name,
      contact: record.contact || record.phone || "",
      description: record.description || record.type || "",
      address: record.address || "",
      note: record.note || "",
    });
  }, [form]);

  const buildPayload = useCallback((values) => {
    const id = normalizeText(values.id);
    const name = normalizeText(values.name);

    if (!name) {
      throw new Error("Nama wajib diisi untuk pilot offline master data.");
    }

    if (collectionName === PILOT_COLLECTIONS.CUSTOMERS && !id) {
      throw new Error("Customer offline pilot wajib memakai ID/kode agar tidak membuat data tanpa referensi.");
    }

    if (collectionName === PILOT_COLLECTIONS.CUSTOMERS) {
      return {
        id,
        code: id,
        customerCode: id,
        name,
        contact: normalizeText(values.contact),
        address: normalizeText(values.address),
        note: normalizeText(values.note),
      };
    }

    return {
      ...(id ? { id } : {}),
      name,
      description: normalizeText(values.description),
      note: normalizeText(values.note),
    };
  }, [collectionName]);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      const values = await form.validateFields();
      const payload = buildPayload(values);
      const targetId = selectedRecordId || payload.id;

      if (selectedRecordId) {
        await api.update(targetId, payload, OFFLINE_OPTIONS);
        message.success("Data pilot offline berhasil diubah dan masuk sync_queue.");
      } else {
        await api.create(payload, OFFLINE_OPTIONS);
        message.success("Data pilot offline berhasil dibuat dan masuk sync_queue.");
      }

      resetFormForCollection(collectionName);
      await loadRecords(false);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menyimpan data pilot offline.");
    } finally {
      setSaving(false);
    }
  }, [api, buildPayload, collectionName, form, loadRecords, resetFormForCollection, selectedRecordId]);

  const handleDelete = useCallback(async (record) => {
    try {
      setLoading(true);
      await api.remove(record.id, OFFLINE_OPTIONS);
      message.success("Data pilot offline ditandai delete dan masuk sync_queue.");
      await loadRecords(false);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menghapus data pilot offline.");
    } finally {
      setLoading(false);
    }
  }, [api, loadRecords]);

  const columns = [
    {
      title: "ID/Kode",
      dataIndex: "id",
      key: "id",
      width: 180,
      render: (value) => <Text code>{value}</Text>,
    },
    {
      title: "Nama",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "Status",
      dataIndex: "syncStatus",
      key: "syncStatus",
      width: 110,
      render: (value) => <Tag color={value === "synced" ? "green" : "gold"}>{value || "local"}</Tag>,
    },
    {
      title: "Aksi",
      key: "action",
      width: 170,
      render: (_, record) => (
        <Space size={6} wrap>
          <Button size="small" onClick={() => handleEdit(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Tandai delete di local DB?"
            description="Aksi ini hanya pilot local DB dan masuk sync_queue; Firebase tidak disentuh otomatis."
            onConfirm={() => handleDelete(record)}
          >
            <Button size="small" danger>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      size="small"
      title="Offline Master Data Pilot"
      extra={<Tag color="cyan">Batch 10/11/12 Guarded</Tag>}
    >
      <Space direction="vertical" size={14} style={{ width: "100%" }}>
        <Alert
          type="warning"
          showIcon
          message="Panel ini khusus pilot local DB, bukan pengganti halaman master data aktif."
          description="Data yang dibuat di sini masuk IndexedDB dan sync_queue. Manual Firebase sync tetap butuh keyword pada Offline Sync Dev Panel. Customer offline memakai kode lokal untuk testing; jangan dipakai sebagai data produksi final."
        />

        <Row gutter={[8, 8]}>
          <Col xs={24} md={8}>
            <Select
              value={collectionName}
              onChange={handleCollectionChange}
              style={{ width: "100%" }}
              options={[
                { label: "Categories", value: PILOT_COLLECTIONS.CATEGORIES },
                { label: "Customers", value: PILOT_COLLECTIONS.CUSTOMERS },
              ]}
            />
          </Col>
          <Col xs={24} md={16}>
            <Space wrap>
              <Button icon={<DatabaseOutlined />} loading={loading} onClick={() => loadRecords(true)}>
                Muat Data Local
              </Button>
              <Button onClick={() => resetFormForCollection(collectionName)}>
                Form Baru
              </Button>
              <Button icon={<ReloadOutlined />} loading={loading} onClick={() => loadRecords(false)}>
                Refresh Queue
              </Button>
            </Space>
          </Col>
        </Row>

        <Row gutter={[8, 8]}>
          <Col xs={12} md={6}>
            <Card size="small">
              <Text type="secondary">Record local</Text>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{records.length}</div>
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Text type="secondary">Queue pending</Text>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{queueSummary?.byStatus?.pending || 0}</div>
            </Card>
          </Col>
        </Row>

        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Row gutter={[8, 0]}>
            <Col xs={24} md={8}>
              <Form.Item name="id" label={api.idLabel}>
                <Input placeholder={collectionName === PILOT_COLLECTIONS.CUSTOMERS ? "CUS-LOCAL-..." : "Auto jika kosong"} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="name" label={api.nameLabel} rules={[{ required: true, message: "Nama wajib diisi" }]}>
                <Input placeholder="Nama" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="contact" label="Kontak / Phone">
                <Input placeholder="Opsional" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="description" label="Deskripsi / Tipe">
                <Input placeholder="Opsional" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="address" label="Alamat">
                <Input placeholder="Opsional" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="note" label="Catatan">
                <Input placeholder="Opsional" />
              </Form.Item>
            </Col>
          </Row>
          <Space wrap>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
              {selectedRecordId ? "Update Local" : "Create Local"}
            </Button>
            {selectedRecordId && (
              <Button onClick={() => resetFormForCollection(collectionName)}>
                Batal Edit
              </Button>
            )}
          </Space>
        </Form>

        <Table
          className="app-data-table"
          size="small"
          rowKey="id"
          loading={loading}
          dataSource={records}
          columns={columns}
          pagination={{ pageSize: 5, hideOnSinglePage: true }}
          scroll={{ x: 760 }}
        />
      </Space>
    </Card>
  );
};

export default OfflineMasterDataPilotPanel;
