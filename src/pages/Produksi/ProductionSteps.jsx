// =====================================================
// Page: Tahapan Produksi
// Versi disederhanakan agar fokus ke daftar step,
// relasi karyawan, dan relasi BOM.
// =====================================================

import React, { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Divider,
  Card,
  Col,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  BASIS_TYPE_MAP,
  DEFAULT_PRODUCTION_STEP_FORM,
  MONITORING_MODE_MAP,
  PAYROLL_MODE_MAP,
  PAYROLL_OUTPUT_BASIS_MAP,
  PROCESS_TYPE_MAP,
  PRODUCTION_STEP_BASIS_TYPES,
  PRODUCTION_STEP_MONITORING_MODES,
  PRODUCTION_STEP_PAYROLL_MODES,
  PRODUCTION_STEP_PAYROLL_OUTPUT_BASIS,
  PRODUCTION_STEP_PROCESS_TYPES,
  formatProductionStepPayrollPreview,
} from "../../constants/productionStepOptions";
import {
  createProductionStep,
  getAllProductionSteps,
  toggleProductionStepActive,
  updateProductionStep,
} from "../../services/Produksi/productionStepsService";
import { getAllProductionEmployees } from "../../services/Produksi/productionEmployeesService";
import { getAllProductionBoms } from "../../services/Produksi/productionBomsService";

const getStepEmployeeCount = (stepId, employees = []) =>
  employees.filter((item) => Array.isArray(item.assignedStepIds) && item.assignedStepIds.includes(stepId)).length;

const getStepBomCount = (stepId, boms = []) =>
  boms.filter((item) => Array.isArray(item.stepLines) && item.stepLines.some((line) => line.stepId === stepId)).length;

const categoryTagStyle = {
  display: "inline-flex",
  whiteSpace: "normal",
  lineHeight: 1.25,
  paddingTop: 4,
  paddingBottom: 4,
  maxWidth: 170,
};

const softClampStyle = {
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  lineHeight: 1.5,
};

const ProductionSteps = () => {
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [boms, setBoms] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [processFilter, setProcessFilter] = useState("all");

  const [formVisible, setFormVisible] = useState(false);
  const [employeeDrawerVisible, setEmployeeDrawerVisible] = useState(false);
  const [bomDrawerVisible, setBomDrawerVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [editingStep, setEditingStep] = useState(null);
  const [selectedStep, setSelectedStep] = useState(null);
  const [employeeDrawerSearch, setEmployeeDrawerSearch] = useState("");
  const [bomDrawerSearch, setBomDrawerSearch] = useState("");

  const [form] = Form.useForm();

  const loadData = async () => {
    try {
      setLoading(true);

      const [stepResult, employeeResult, bomResult] = await Promise.all([
        getAllProductionSteps(),
        getAllProductionEmployees(),
        getAllProductionBoms(),
      ]);

      setSteps(stepResult);
      setEmployees(employeeResult);
      setBoms(bomResult);
    } catch (error) {
      console.error(error);
      message.error("Gagal memuat data tahapan produksi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const enrichedSteps = useMemo(() => {
    return (steps || []).map((item) => ({
      ...item,
      employeeCount: getStepEmployeeCount(item.id, employees),
      bomCount: getStepBomCount(item.id, boms),
    }));
  }, [steps, employees, boms]);

  const summary = useMemo(() => {
    const total = enrichedSteps.length;
    const active = enrichedSteps.filter((item) => item.isActive).length;
    const usedByEmployees = enrichedSteps.filter((item) => item.employeeCount > 0).length;
    const usedByBoms = enrichedSteps.filter((item) => item.bomCount > 0).length;

    return { total, active, usedByEmployees, usedByBoms };
  }, [enrichedSteps]);

  const filteredData = useMemo(() => {
    return enrichedSteps.filter((item) => {
      const searchText = search.trim().toLowerCase();
      const matchSearch =
        !searchText ||
        String(item.name || "").toLowerCase().includes(searchText) ||
        String(item.description || "").toLowerCase().includes(searchText) ||
        String(PROCESS_TYPE_MAP[item.processType] || "").toLowerCase().includes(searchText) ||
        String(BASIS_TYPE_MAP[item.basisType] || "").toLowerCase().includes(searchText) ||
        String(MONITORING_MODE_MAP[item.monitoringMode] || "").toLowerCase().includes(searchText);

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && item.isActive) ||
        (statusFilter === "inactive" && !item.isActive);

      const matchProcess = processFilter === "all" || item.processType === processFilter;

      return matchSearch && matchStatus && matchProcess;
    });
  }, [enrichedSteps, search, statusFilter, processFilter]);

  const resetFormState = () => {
    setEditingStep(null);
    form.resetFields();
    form.setFieldsValue({
      ...DEFAULT_PRODUCTION_STEP_FORM,
      isActive: true,
    });
  };

  const handleAdd = () => {
    setEditingStep(null);
    form.setFieldsValue({
      ...DEFAULT_PRODUCTION_STEP_FORM,
      isActive: true,
    });
    setFormVisible(true);
  };

  const handleEdit = (record) => {
    setEditingStep(record);
    form.setFieldsValue({
      ...DEFAULT_PRODUCTION_STEP_FORM,
      ...record,
      basisType: record.basisType || DEFAULT_PRODUCTION_STEP_FORM.basisType,
      monitoringMode: record.monitoringMode || DEFAULT_PRODUCTION_STEP_FORM.monitoringMode,
      payrollMode: record.payrollMode || DEFAULT_PRODUCTION_STEP_FORM.payrollMode,
      payrollRate: Number(record.payrollRate || 0),
      payrollQtyBase: Number(record.payrollQtyBase || 1),
      payrollOutputBasis: record.payrollOutputBasis || DEFAULT_PRODUCTION_STEP_FORM.payrollOutputBasis,
      isActive: record.isActive !== false,
    });
    setFormVisible(true);
  };

  const handleOpenEmployeeDrawer = (record) => {
    setSelectedStep(record);
    setEmployeeDrawerSearch("");
    setEmployeeDrawerVisible(true);
  };

  const handleOpenBomDrawer = (record) => {
    setSelectedStep(record);
    setBomDrawerSearch("");
    setBomDrawerVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...DEFAULT_PRODUCTION_STEP_FORM,
        ...(editingStep || {}),
        ...values,
      };

      setSubmitting(true);

      if (editingStep?.id) {
        await updateProductionStep(editingStep.id, payload, null);
        message.success("Tahapan produksi berhasil diperbarui");
      } else {
        await createProductionStep(payload, null);
        message.success("Tahapan produksi berhasil ditambahkan");
      }

      setFormVisible(false);
      resetFormState();
      await loadData();
    } catch (error) {
      if (error?.errorFields) return;

      if (error?.type === "validation" && error?.errors) {
        const fields = Object.entries(error.errors).map(([name, errors]) => ({
          name,
          errors: [errors],
        }));
        form.setFields(fields);
        return;
      }

      console.error(error);
      message.error("Gagal menyimpan data tahapan produksi");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (record) => {
    try {
      await toggleProductionStepActive(record.id, !record.isActive, null);
      message.success(
        `Tahapan berhasil ${record.isActive ? "dinonaktifkan" : "diaktifkan"}`,
      );
      await loadData();
    } catch (error) {
      console.error(error);
      message.error("Gagal mengubah status tahapan");
    }
  };

  const selectedStepEmployees = useMemo(() => {
    if (!selectedStep?.id) return [];

    const keyword = employeeDrawerSearch.trim().toLowerCase();

    return employees
      .filter(
        (item) =>
          Array.isArray(item.assignedStepIds) && item.assignedStepIds.includes(selectedStep.id),
      )
      .filter((item) => {
        if (!keyword) return true;
        return [item.name, item.role, item.employmentType]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      })
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "id-ID"));
  }, [selectedStep, employees, employeeDrawerSearch]);

  const selectedStepBoms = useMemo(() => {
    if (!selectedStep?.id) return [];

    const keyword = bomDrawerSearch.trim().toLowerCase();

    return boms
      .filter(
        (item) =>
          Array.isArray(item.stepLines) && item.stepLines.some((line) => line.stepId === selectedStep.id),
      )
      .filter((item) => {
        if (!keyword) return true;
        return [item.name, item.targetName, item.targetType]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      })
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "id-ID"));
  }, [selectedStep, boms, bomDrawerSearch]);

  const employeeColumns = [
    {
      title: "Nama Karyawan",
      dataIndex: "name",
      key: "name",
      render: (value) => <Typography.Text strong>{value || "-"}</Typography.Text>,
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      render: (value) => <Tag>{value || "-"}</Tag>,
    },
    {
      title: "Tipe Kerja",
      dataIndex: "employmentType",
      key: "employmentType",
      render: (value) => <Tag color="blue">{value || "-"}</Tag>,
    },
    {
      title: "Status",
      dataIndex: "isActive",
      key: "isActive",
      render: (value) =>
        value ? <Badge status="success" text="Aktif" /> : <Badge status="default" text="Nonaktif" />,
    },
  ];

  const bomColumns = [
    {
      title: "Nama BOM",
      dataIndex: "name",
      key: "name",
      render: (value) => <Typography.Text strong>{value || "-"}</Typography.Text>,
    },
    {
      title: "Target",
      dataIndex: "targetName",
      key: "targetName",
      render: (value) => value || "-",
    },
    {
      title: "Jenis Target",
      dataIndex: "targetType",
      key: "targetType",
      render: (value) => <Tag color="purple">{value === "product" ? "Produk Jadi" : "Semi Finished"}</Tag>,
    },
    {
      title: "Status",
      dataIndex: "isActive",
      key: "isActive",
      render: (value) =>
        value ? <Badge status="success" text="Aktif" /> : <Badge status="default" text="Nonaktif" />,
    },
  ];

  const columns = [
    {
      title: "Nama Step",
      dataIndex: "name",
      key: "name",
      width: 240,
      render: (_, record) => <Typography.Text strong>{record.name || "-"}</Typography.Text>,
    },
    {
      title: "Kategori",
      dataIndex: "processType",
      key: "processType",
      width: 190,
      render: (value) => {
        const label = PROCESS_TYPE_MAP[value] || value || "-";
        return (
          <Tooltip title={label}>
            <Tag style={categoryTagStyle}>{label}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: "Basis Kerja",
      dataIndex: "basisType",
      key: "basisType",
      width: 160,
      render: (value) => <Tag color="blue">{BASIS_TYPE_MAP[value] || "-"}</Tag>,
    },
    {
      title: "Monitoring",
      dataIndex: "monitoringMode",
      key: "monitoringMode",
      width: 170,
      render: (value) => <Tag color="gold">{MONITORING_MODE_MAP[value] || "-"}</Tag>,
    },
    {
      title: "Sistem Bayar",
      key: "payrollPreview",
      width: 220,
      render: (_, record) => (
        <Typography.Text type={record.payrollMode ? undefined : "secondary"}>
          {record.payrollMode ? formatProductionStepPayrollPreview(record) : "-"}
        </Typography.Text>
      ),
    },
    {
      title: "Fungsi",
      dataIndex: "description",
      key: "description",
      width: 300,
      render: (value) => {
        const textValue = value || "Belum ada deskripsi fungsi";
        return (
          <Tooltip title={textValue}>
            <Typography.Text type={value ? undefined : "secondary"} style={softClampStyle}>
              {textValue}
            </Typography.Text>
          </Tooltip>
        );
      },
    },
    {
      title: "Karyawan Terkait",
      key: "employeeCount",
      width: 160,
      align: "center",
      render: (_, record) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => handleOpenEmployeeDrawer(record)}>
          {record.employeeCount} karyawan
        </Button>
      ),
    },
    {
      title: "Dipakai di BOM",
      key: "bomCount",
      width: 150,
      align: "center",
      render: (_, record) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => handleOpenBomDrawer(record)}>
          {record.bomCount} BOM
        </Button>
      ),
    },
    {
      title: "Status",
      dataIndex: "isActive",
      key: "isActive",
      width: 120,
      align: "center",
      render: (value) =>
        value ? <Badge status="success" text="Aktif" /> : <Badge status="default" text="Nonaktif" />,
    },
    {
      title: "Aksi",
      key: "actions",
      width: 180,
      render: (_, record) => (
        <Space wrap>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            Edit
          </Button>
          <Popconfirm
            title={record.isActive ? "Nonaktifkan step ini?" : "Aktifkan step ini?"}
            onConfirm={() => handleToggleActive(record)}
            okText="Ya"
            cancelText="Batal"
          >
            <Button size="small">{record.isActive ? "Nonaktifkan" : "Aktifkan"}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Typography.Title level={3} style={{ margin: 0 }}>
              Tahapan Produksi
            </Typography.Title>
            <Typography.Text type="secondary">
              Master step sederhana untuk standarisasi proses, relasi karyawan, dan BOM produksi. QC tidak dijadikan step terpisah, tetapi dicek di setiap proses/work log. Untuk kebutuhan Anda saat ini, assembly adalah proses akhir dan packing bersifat opsional bila memang ada pekerjaan pengemasan terpisah.
            </Typography.Text>
          </Col>

          <Col>
            <Space wrap>
              <Button icon={<ReloadOutlined />} onClick={loadData}>
                Refresh
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                Tambah Step
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Total Step" value={summary.total} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Step Aktif" value={summary.active} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Terhubung Karyawan" value={summary.usedByEmployees} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Dipakai di BOM" value={summary.usedByBoms} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={10}>
            <Input
              placeholder="Cari nama step, kategori, atau fungsi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>

          <Col xs={24} md={7}>
            <Select
              style={{ width: "100%" }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "Semua Status" },
                { value: "active", label: "Aktif" },
                { value: "inactive", label: "Nonaktif" },
              ]}
            />
          </Col>

          <Col xs={24} md={7}>
            <Select
              style={{ width: "100%" }}
              value={processFilter}
              onChange={setProcessFilter}
              options={[
                { value: "all", label: "Semua Kategori" },
                ...PRODUCTION_STEP_PROCESS_TYPES,
              ]}
            />
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredData}
          scroll={{ x: 1600 }}
          locale={{
            emptyText: <Empty description="Belum ada data tahapan produksi" />,
          }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
          }}
        />
      </Card>

      <Drawer
        title={editingStep?.id ? "Edit Step Produksi" : "Tambah Step Produksi"}
        open={formVisible}
        onClose={() => {
          setFormVisible(false);
          resetFormState();
        }}
        width={520}
        destroyOnClose
        extra={
          <Space>
            <Button
              onClick={() => {
                setFormVisible(false);
                resetFormState();
              }}
            >
              Batal
            </Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
              Simpan
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ ...DEFAULT_PRODUCTION_STEP_FORM, isActive: true }}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
            Gunakan step untuk proses kerja nyata. QC tidak perlu dibuat sebagai step terpisah karena menempel di setiap proses. Bila assembly sudah menjadi proses akhir, Anda tidak perlu membuat step finishing tersendiri. Packing cukup dibuat bila memang ada pekerjaan pengemasan terpisah.
          </Typography.Paragraph>
          <Form.Item
            label="Nama Step"
            name="name"
            rules={[{ required: true, message: "Nama step wajib diisi" }]}
          >
            <Input placeholder="Contoh: Potong Bahan Dasar" />
          </Form.Item>

          <Form.Item
            label="Kategori"
            name="processType"
            rules={[{ required: true, message: "Kategori step wajib dipilih" }]}
          >
            <Select options={PRODUCTION_STEP_PROCESS_TYPES} placeholder="Pilih kategori step" />
          </Form.Item>

          <Form.Item label="Fungsi / Deskripsi" name="description">
            <Input.TextArea rows={4} placeholder="Jelaskan fungsi step ini secara singkat" />
          </Form.Item>

          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Basis Kerja"
                name="basisType"
                rules={[{ required: true, message: "Basis kerja wajib dipilih" }]}
              >
                <Select options={PRODUCTION_STEP_BASIS_TYPES} placeholder="Pilih basis kerja" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Monitoring"
                name="monitoringMode"
                rules={[{ required: true, message: "Mode monitoring wajib dipilih" }]}
              >
                <Select options={PRODUCTION_STEP_MONITORING_MODES} placeholder="Pilih mode monitoring" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Sistem Bayar</Divider>

          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item label="Mode Bayar" name="payrollMode">
                <Select options={PRODUCTION_STEP_PAYROLL_MODES} placeholder="Pilih mode bayar" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Tarif Default" name="payrollRate">
                <InputNumber min={0} style={{ width: "100%" }} placeholder="Contoh: 2000" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item label="Qty Dasar Bayar" name="payrollQtyBase">
                <InputNumber min={1} style={{ width: "100%" }} placeholder="Contoh: 1" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Basis Output Bayar" name="payrollOutputBasis">
                <Select options={PRODUCTION_STEP_PAYROLL_OUTPUT_BASIS} placeholder="Pilih basis output" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Status Aktif" name="isActive" valuePropName="checked">
            <Switch checkedChildren="Aktif" unCheckedChildren="Nonaktif" />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title={`Karyawan pada Step: ${selectedStep?.name || "-"}`}
        open={employeeDrawerVisible}
        onClose={() => setEmployeeDrawerVisible(false)}
        width={760}
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Input
            placeholder="Cari nama, role, atau tipe kerja..."
            value={employeeDrawerSearch}
            onChange={(e) => setEmployeeDrawerSearch(e.target.value)}
            allowClear
          />

          <Table
            rowKey="id"
            columns={employeeColumns}
            dataSource={selectedStepEmployees}
            pagination={{ pageSize: 8, showSizeChanger: true }}
            locale={{ emptyText: <Empty description="Belum ada karyawan terkait step ini" /> }}
          />
        </Space>
      </Drawer>

      <Drawer
        title={`BOM yang menggunakan Step: ${selectedStep?.name || "-"}`}
        open={bomDrawerVisible}
        onClose={() => setBomDrawerVisible(false)}
        width={860}
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Input
            placeholder="Cari nama BOM atau target..."
            value={bomDrawerSearch}
            onChange={(e) => setBomDrawerSearch(e.target.value)}
            allowClear
          />

          <Table
            rowKey="id"
            columns={bomColumns}
            dataSource={selectedStepBoms}
            pagination={{ pageSize: 8, showSizeChanger: true }}
            locale={{ emptyText: <Empty description="Step ini belum dipakai di BOM mana pun" /> }}
          />
        </Space>
      </Drawer>
    </div>
  );
};

export default ProductionSteps;
