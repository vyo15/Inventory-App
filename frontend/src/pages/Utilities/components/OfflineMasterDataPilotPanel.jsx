// =====================================================
// SECTION: OfflineMasterDataPilotPanel — LEGACY-COMPAT / CLEANUP CANDIDATE / NOT MAIN UI
// Fungsi:
// - panel lama untuk development/pilot offline sebelum OfflineDatabaseCenter menjadi UI utama.
// Status:
// - tidak dihapus agar patch lama/branch paralel tidak rusak.
// - jangan jadikan entry utama baru; pakai OfflineDatabaseCenter untuk QA RC.
// Cleanup:
// - hapus hanya setelah audit import/route/manual QA memastikan tidak ada usage aktif.
// =====================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { ReloadOutlined, SaveOutlined } from "@ant-design/icons";

import {
  createCategory,
  listCategories,
} from "../../../data/repositories/categoriesRepository";
import {
  createCustomer,
  generateCustomerCode,
  listCustomers,
} from "../../../data/repositories/customersRepository";
import { REPOSITORY_MODES } from "../../../data/repositories/repositoryMode";
import { getRepositoryModeStatus } from "../../../data/repositories/repositoryModeService";

const { Text } = Typography;

const OfflineMasterDataPilotPanel = () => {
  const [categoryForm] = Form.useForm();
  const [customerForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [repositoryMode, setRepositoryMode] = useState(REPOSITORY_MODES.FIREBASE_PRIMARY);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);

  const isOfflineMode = repositoryMode === REPOSITORY_MODES.OFFLINE_LOCAL;
  const modeOptions = useMemo(() => ({ mode: repositoryMode }), [repositoryMode]);

  const loadData = useCallback(async (showSuccessMessage = false) => {
    try {
      setLoading(true);
      const modeStatus = await getRepositoryModeStatus();
      const options = { mode: modeStatus.mode };
      const [categoryRows, customerRows] = await Promise.all([
        listCategories(options),
        listCustomers(options),
      ]);
      setRepositoryMode(modeStatus.mode);
      setCategories(categoryRows);
      setCustomers(customerRows);
      if (showSuccessMessage) message.success("Data pilot offline dimuat ulang.");
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal memuat data pilot offline.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  const handleCreateCategory = async (values) => {
    if (!isOfflineMode) {
      message.warning("Aktifkan offline repository pilot dulu jika ingin test write local.");
      return;
    }

    try {
      setSavingCategory(true);
      await createCategory(values, modeOptions);
      categoryForm.resetFields();
      message.success("Kategori local dibuat dan masuk sync_queue.");
      await loadData(false);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal membuat kategori local.");
    } finally {
      setSavingCategory(false);
    }
  };

  const prepareCustomerCode = async () => {
    if (!isOfflineMode) return;
    try {
      const code = await generateCustomerCode({}, modeOptions);
      customerForm.setFieldsValue({ code, customerCode: code });
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal membuat kode customer local.");
    }
  };

  const handleCreateCustomer = async (values) => {
    if (!isOfflineMode) {
      message.warning("Aktifkan offline repository pilot dulu jika ingin test write local.");
      return;
    }

    try {
      setSavingCustomer(true);
      const code = values.code || (await generateCustomerCode({}, modeOptions));
      await createCustomer({ ...values, code, customerCode: code }, modeOptions);
      customerForm.resetFields();
      message.success("Customer local dibuat dan masuk sync_queue.");
      await loadData(false);
    } catch (error) {
      console.error(error);
      if (error?.type === "validation" && error.errors) {
        customerForm.setFields(Object.entries(error.errors).map(([name, errorMessage]) => ({ name, errors: [errorMessage] })));
        message.error(Object.values(error.errors)[0] || "Data customer belum valid.");
        return;
      }
      message.error(error?.message || "Gagal membuat customer local.");
    } finally {
      setSavingCustomer(false);
    }
  };

  return (
    <Card size="small" title="Offline Master Data Pilot" extra={<Tag color="gold">Batch 13–16 Guard</Tag>}>
      <Space direction="vertical" size={14} style={{ width: "100%" }}>
        <Alert
          type={isOfflineMode ? "warning" : "info"}
          showIcon
          message={isOfflineMode ? "Offline repository pilot aktif" : "Mode saat ini masih Firebase primary"}
          description="Panel ini hanya untuk test write Categories dan Customers. Supplier/Product/Raw Material/Semi Finished boleh dipull di Offline Database Center hanya sebagai snapshot read-only; Sales, stock, purchase, production, payroll, dan HPP tidak ikut runtime pilot ini."
        />

        <Space wrap>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => loadData(true)}>
            Refresh Data Pilot
          </Button>
          <Tag color={isOfflineMode ? "gold" : "blue"}>DB: {repositoryMode}</Tag>
        </Space>

        <Row gutter={[8, 8]}>
          <Col xs={12} md={6}>
            <Statistic title="Kategori" value={categories.length} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="Customer" value={customers.length} />
          </Col>
          <Col xs={24} md={12}>
            <Text type="secondary">Write local hanya aktif saat mode offline_local. Default aman tetap Firebase-primary.</Text>
          </Col>
        </Row>

        <Row gutter={[12, 12]}>
          <Col xs={24} lg={12}>
            <Card size="small" title="Quick create kategori local">
              <Form form={categoryForm} layout="vertical" onFinish={handleCreateCategory} disabled={!isOfflineMode}>
                <Form.Item name="name" label="Nama Kategori" rules={[{ required: true, message: "Nama kategori wajib diisi" }]}>
                  <Input placeholder="Contoh: Pilot Kategori Offline" />
                </Form.Item>
                <Form.Item name="description" label="Deskripsi">
                  <Input.TextArea rows={2} placeholder="Catatan test local" />
                </Form.Item>
                <Button htmlType="submit" icon={<SaveOutlined />} loading={savingCategory} disabled={!isOfflineMode}>
                  Simpan Kategori Local
                </Button>
              </Form>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card size="small" title="Quick create customer local">
              <Form form={customerForm} layout="vertical" onFinish={handleCreateCustomer} disabled={!isOfflineMode}>
                <Form.Item name="code" label="Kode Customer">
                  <Input disabled placeholder="Klik generate kode local" />
                </Form.Item>
                <Form.Item name="customerCode" hidden>
                  <Input />
                </Form.Item>
                <Form.Item name="name" label="Nama Customer" rules={[{ required: true, message: "Nama customer wajib diisi" }]}>
                  <Input placeholder="Contoh: Customer Pilot Offline" />
                </Form.Item>
                <Form.Item name="contact" label="Kontak" rules={[{ required: true, message: "Kontak wajib diisi" }]}>
                  <Input placeholder="0812xxxx" />
                </Form.Item>
                <Space wrap>
                  <Button onClick={prepareCustomerCode} disabled={!isOfflineMode}>
                    Generate Kode Local
                  </Button>
                  <Button htmlType="submit" icon={<SaveOutlined />} loading={savingCustomer} disabled={!isOfflineMode}>
                    Simpan Customer Local
                  </Button>
                </Space>
              </Form>
            </Card>
          </Col>
        </Row>

        <Divider style={{ margin: "4px 0" }} />
        <Table
          className="app-data-table"
          size="small"
          rowKey={(row) => `category-${row.id}`}
          title={() => "Preview kategori pilot"}
          pagination={{ pageSize: 5, hideOnSinglePage: true }}
          dataSource={categories}
          columns={[
            { title: "Nama", dataIndex: "name", key: "name" },
            { title: "Sync", dataIndex: "syncStatus", key: "syncStatus", width: 100, render: (value) => <Tag>{value || "remote"}</Tag> },
          ]}
        />
        <Table
          className="app-data-table"
          size="small"
          rowKey={(row) => `customer-${row.id}`}
          title={() => "Preview customer pilot"}
          pagination={{ pageSize: 5, hideOnSinglePage: true }}
          dataSource={customers}
          columns={[
            { title: "Kode", dataIndex: "code", key: "code", width: 160 },
            { title: "Nama", dataIndex: "name", key: "name" },
            { title: "Sync", dataIndex: "syncStatus", key: "syncStatus", width: 100, render: (value) => <Tag>{value || "remote"}</Tag> },
          ]}
        />
      </Space>
    </Card>
  );
};

export default OfflineMasterDataPilotPanel;
