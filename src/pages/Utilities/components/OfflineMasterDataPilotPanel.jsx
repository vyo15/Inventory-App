import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Form, Input, Select, Space, Table, Tag, message } from "antd";

import { ensureLocalDbFoundationMeta } from "../../../data/local/localDbMeta";
import { REPOSITORY_MODES } from "../../../data/repositories/repositoryMode";
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
import { isValidCustomerCodeFormat } from "../../../services/MasterData/customersService";

const COLLECTION_OPTIONS = [
  { label: "Categories", value: "categories" },
  { label: "Customers", value: "customers" },
];

const repositoryOptions = { mode: REPOSITORY_MODES.OFFLINE_LOCAL };

const getDisplayName = (record = {}) => record.name || record.customerName || record.id || "-";

const OfflineMasterDataPilotPanel = () => {
  const [collectionName, setCollectionName] = useState("categories");
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const isCustomers = collectionName === "customers";

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      await ensureLocalDbFoundationMeta();
      const result = isCustomers
        ? await listCustomers(repositoryOptions)
        : await listCategories(repositoryOptions);
      setRows(result);
    } catch (error) {
      console.error("Gagal muat data local pilot:", error);
      message.error(error?.message || "Gagal muat data local pilot.");
    } finally {
      setLoading(false);
    }
  }, [isCustomers]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const selectedRecord = useMemo(
    () => rows.find((row) => row.id === selectedId) || null,
    [rows, selectedId]
  );

  useEffect(() => {
    if (!selectedRecord) return;

    form.setFieldsValue({
      id: selectedRecord.id,
      name: selectedRecord.name || selectedRecord.customerName || "",
      phone: selectedRecord.phone || "",
      description: selectedRecord.description || selectedRecord.notes || "",
    });
  }, [form, selectedRecord]);

  const buildPayload = async () => {
    const values = await form.validateFields();
    const name = values.name?.trim();
    const id = values.id?.trim();

    if (!name) {
      throw new Error("Nama wajib diisi.");
    }

    if (isCustomers) {
      if (!id || !isValidCustomerCodeFormat(id)) {
        throw new Error("Customer local wajib memakai kode valid CUS-DDMMYYYY-001 sebagai ID.");
      }

      return {
        id,
        code: id,
        customerCode: id,
        name,
        customerName: name,
        phone: values.phone || "",
        notes: values.description || "",
      };
    }

    return {
      ...(id ? { id } : {}),
      name,
      description: values.description || "",
    };
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const payload = await buildPayload();
      if (isCustomers) {
        await createCustomer(payload, repositoryOptions);
      } else {
        await createCategory(payload, repositoryOptions);
      }
      message.success("Record local dibuat dan masuk sync_queue pending.");
      form.resetFields();
      setSelectedId("");
      await loadRows();
    } catch (error) {
      message.error(error?.message || "Gagal membuat record local.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedId) {
      message.warning("Pilih record local terlebih dahulu.");
      return;
    }

    setLoading(true);
    try {
      const payload = await buildPayload();
      if (isCustomers) {
        await updateCustomer(selectedId, payload, repositoryOptions);
      } else {
        await updateCategory(selectedId, payload, repositoryOptions);
      }
      message.success("Record local diubah dan masuk sync_queue pending.");
      await loadRows();
    } catch (error) {
      message.error(error?.message || "Gagal mengubah record local.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) {
      message.warning("Pilih record local terlebih dahulu.");
      return;
    }

    setLoading(true);
    try {
      if (isCustomers) {
        await deleteCustomer(selectedId, repositoryOptions);
      } else {
        await deleteCategory(selectedId, repositoryOptions);
      }
      message.success("Record local ditandai tombstone dan masuk sync_queue pending.");
      form.resetFields();
      setSelectedId("");
      await loadRows();
    } catch (error) {
      message.error(error?.message || "Gagal tombstone record local.");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: "ID", dataIndex: "id", key: "id", ellipsis: true },
    { title: "Nama", key: "name", render: (_, record) => getDisplayName(record), ellipsis: true },
    {
      title: "Status",
      dataIndex: "syncStatus",
      key: "syncStatus",
      width: 110,
      render: (status) => <Tag>{status || "local"}</Tag>,
    },
    {
      title: "Aksi",
      key: "action",
      width: 80,
      render: (_, record) => <Button size="small" onClick={() => setSelectedId(record.id)}>Pilih</Button>,
    },
  ];

  return (
    <Card title="Offline Master Data Pilot" size="small">
      <Space direction="vertical" size={14} style={{ width: "100%" }}>
        <Alert
          type="warning"
          showIcon
          message="Pilot local DB ini bukan halaman master data produksi."
          description="Gunakan hanya untuk test categories/customers offline. Delete hanya tombstone local. Firebase tidak berubah sebelum manual sync guarded dijalankan."
        />

        <Space wrap>
          <Select value={collectionName} options={COLLECTION_OPTIONS} onChange={(value) => { setCollectionName(value); setSelectedId(""); form.resetFields(); }} style={{ width: 180 }} />
          <Button loading={loading} onClick={loadRows}>Muat Data Local</Button>
          <Tag>Mode: offline_local explicit</Tag>
        </Space>

        <Form form={form} layout="vertical">
          <Form.Item label={isCustomers ? "Customer ID / Code" : "ID Kategori"} name="id" extra={isCustomers ? "Wajib format CUS-DDMMYYYY-001." : "Opsional untuk categories. Jika kosong akan dibuat ID local."}>
            <Input placeholder={isCustomers ? "CUS-27052026-001" : "Kosongkan untuk auto local ID"} />
          </Form.Item>
          <Form.Item label="Nama" name="name" rules={[{ required: true, message: "Nama wajib diisi." }]}>
            <Input placeholder={isCustomers ? "Nama customer" : "Nama kategori"} />
          </Form.Item>
          {isCustomers ? (
            <Form.Item label="No. HP" name="phone">
              <Input placeholder="Nomor HP customer" />
            </Form.Item>
          ) : null}
          <Form.Item label="Catatan" name="description">
            <Input.TextArea rows={2} placeholder="Catatan local pilot" />
          </Form.Item>
          <Space wrap>
            <Button type="primary" loading={loading} onClick={handleCreate}>Create Local</Button>
            <Button loading={loading} disabled={!selectedId} onClick={handleUpdate}>Update Selected</Button>
            <Button danger loading={loading} disabled={!selectedId} onClick={handleDelete}>Tombstone Selected</Button>
          </Space>
        </Form>

        <Table
          size="small"
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          pagination={{ pageSize: 5 }}
          scroll={{ x: 620 }}
        />
      </Space>
    </Card>
  );
};

export default OfflineMasterDataPilotPanel;
