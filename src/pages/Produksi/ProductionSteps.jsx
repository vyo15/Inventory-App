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
  Descriptions,
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
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  BASIS_TYPE_MAP,
  DEFAULT_PRODUCTION_STEP_FORM,
  MONITORING_MODE_MAP,
  PAYROLL_CLASSIFICATION_MAP,
  PROCESS_TYPE_MAP,
  PRODUCTION_STEP_BASIS_TYPES,
  PRODUCTION_STEP_MONITORING_MODES,
  PRODUCTION_STEP_PAYROLL_CLASSIFICATIONS,
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
import ProductionPageHeader from "../../components/Produksi/shared/ProductionPageHeader";

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


const ProductionSteps = () => {
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [boms, setBoms] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [processFilter, setProcessFilter] = useState("all");

  const [formVisible, setFormVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
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
      payrollClassification:
        record.payrollClassification || DEFAULT_PRODUCTION_STEP_FORM.payrollClassification,
      includePayrollInHpp:
        typeof record.includePayrollInHpp === "boolean"
          ? record.includePayrollInHpp
          : DEFAULT_PRODUCTION_STEP_FORM.includePayrollInHpp,
      isActive: record.isActive !== false,
    });
    setFormVisible(true);
  };

  // =========================
  // SECTION: detail drawer read-only
  // Fungsi:
  // - menjadikan Tahapan Produksi sebagai detail-capable page ringan
  // - audit konfigurasi step dipindah ke drawer agar tabel utama tetap ringkas
  // Status:
  // - aktif dipakai untuk baseline UI terbaru halaman step
  // =========================
  const handleOpenDetailDrawer = (record) => {
    setSelectedStep(record);
    setDetailDrawerVisible(true);
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

  // =========================
  // SECTION: kolom tabel utama
  // Fungsi:
  // - main table hanya menampilkan info inti agar halaman step tidak terlalu padat
  // - detail konfigurasi lengkap dipindah ke drawer Detail read-only
  // Status:
  // - aktif dipakai sebagai baseline final untuk ProductionSteps
  // =========================
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
      // =========================
      // SECTION: status sticky
      // Fungsi:
      // - menjaga kolom status tetap terlihat saat table discroll horizontal
      // - mengikuti baseline global table/action untuk table lebar
      // =========================
      title: "Status",
      dataIndex: "isActive",
      key: "isActive",
      width: 124,
      align: "center",
      fixed: "right",
      className: "app-table-status-column app-table-fixed-secondary",
      render: (value) =>
        value ? <Badge status="success" text="Aktif" /> : <Badge status="default" text="Nonaktif" />,
    },
    {
      // =========================
      // SECTION: aksi sticky
      // Fungsi:
      // - ProductionSteps sekarang diperlakukan sebagai detail-capable page ringan
      // - Detail dipakai untuk audit baca cepat, Edit tetap untuk ubah data
      // Status:
      // - aktif dipakai sebagai baseline baru halaman step
      // - menggantikan pola lama simple config tanpa Detail
      // =========================
      title: "Aksi",
      key: "actions",
      width: 170,
      fixed: "right",
      // ---------------------------------------------------------------------
      // IMS NOTE [AKTIF / GUARDED / BEHAVIOR-PRESERVING]
      // Fungsi: menyamakan visual tombol aksi Tahapan Produksi dengan baseline Raw Materials.
      // Hubungan flow: hanya layout tombol Detail/Edit/Aktifkan/Nonaktifkan; handler dan data step tidak berubah.
      // Alasan: menjaga tombol aksi tetap mudah dijangkau tanpa menyentuh rule payroll, BOM, Work Log, atau HPP.
      // ---------------------------------------------------------------------
      className: "app-table-action-column",
      render: (_, record) => (
        <div className="ims-action-group ims-action-group--vertical">
          <div className="ims-action-group ims-action-group--inline">
            <Button
              className="ims-action-button"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleOpenDetailDrawer(record)}
            >
              Detail
            </Button>
            <Button
              className="ims-action-button"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              Edit
            </Button>
          </div>
          <Popconfirm
            title={record.isActive ? "Nonaktifkan step ini?" : "Aktifkan step ini?"}
            onConfirm={() => handleToggleActive(record)}
            okText="Ya"
            cancelText="Batal"
          >
            <Button block className="ims-action-button ims-action-button--block" size="small">
              {record.isActive ? "Nonaktifkan" : "Aktifkan"}
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  const selectedStepPayrollPreview = selectedStep?.payrollMode
    ? formatProductionStepPayrollPreview(selectedStep)
    : "Belum ada rule payroll";

  return (
    <div>
      <ProductionPageHeader
        title="Tahapan Produksi"
        description="Master step sederhana untuk standarisasi proses, relasi karyawan, BOM, dan source of truth payroll produksi. QC tidak dijadikan step terpisah, tetapi dicek di setiap proses/work log. Untuk kebutuhan Anda saat ini, assembly adalah proses akhir dan packing bersifat opsional bila memang ada pekerjaan pengemasan terpisah."
        onRefresh={loadData}
        onAdd={handleAdd}
        addLabel="Tambah Step"
      />

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
        {/* =========================
            SECTION: tabel utama step
            helper global dipakai agar ukuran dan sticky action seragam.
        ========================= */}
        <Table
          className="app-data-table"
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredData}
          // =========================
          // SECTION: scroll table utama
          // Fungsi:
          // - tetap memberi ruang aman untuk sticky status + aksi
          // - ukuran diperkecil karena kolom utama sudah diringkas
          // =========================
          scroll={{ x: 980 }}
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
        title={`Detail Step Produksi: ${selectedStep?.name || "-"}`}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={720}
      >
        {/* =========================
            SECTION: drawer detail read-only
            Fungsi:
            - memindahkan informasi konfigurasi step yang berat dari tabel utama ke drawer audit
            - menjaga source data tetap dari row step yang sama tanpa mengubah business logic
            Status:
            - aktif dipakai untuk baseline UI terbaru ProductionSteps
        ========================= */}
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Descriptions bordered column={1} size="middle">
            <Descriptions.Item label="Nama Step">{selectedStep?.name || "-"}</Descriptions.Item>
            <Descriptions.Item label="Kategori">
              {PROCESS_TYPE_MAP[selectedStep?.processType] || selectedStep?.processType || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Cara Kerja Step">
              {BASIS_TYPE_MAP[selectedStep?.basisType] || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Cara Pantau Hasil">
              {MONITORING_MODE_MAP[selectedStep?.monitoringMode] || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Sistem Bayar">{selectedStepPayrollPreview}</Descriptions.Item>
            <Descriptions.Item label="Klasifikasi Payroll">
              <Space direction="vertical" size={4}>
                <Tag color={selectedStep?.includePayrollInHpp === false ? "orange" : "green"}>
                  {PAYROLL_CLASSIFICATION_MAP[selectedStep?.payrollClassification] || "-"}
                </Tag>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {selectedStep?.includePayrollInHpp === false
                    ? "Tidak masuk HPP inti"
                    : "Masuk HPP inti"}
                </Typography.Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Fungsi / Deskripsi">
              {selectedStep?.description || "Belum ada deskripsi fungsi"}
            </Descriptions.Item>
            <Descriptions.Item label="Catatan Payroll">
              {selectedStep?.payrollNotes || "Belum ada catatan payroll"}
            </Descriptions.Item>
            <Descriptions.Item label="Karyawan Terkait">
              <Space direction="vertical" size={4}>
                <Typography.Text>{selectedStep?.employeeCount || 0} karyawan</Typography.Text>
                <Button type="link" style={{ padding: 0 }} onClick={() => handleOpenEmployeeDrawer(selectedStep)}>
                  Lihat karyawan terkait
                </Button>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Dipakai di BOM">
              <Space direction="vertical" size={4}>
                <Typography.Text>{selectedStep?.bomCount || 0} BOM</Typography.Text>
                <Button type="link" style={{ padding: 0 }} onClick={() => handleOpenBomDrawer(selectedStep)}>
                  Lihat BOM terkait
                </Button>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              {selectedStep?.isActive ? <Badge status="success" text="Aktif" /> : <Badge status="default" text="Nonaktif" />}
            </Descriptions.Item>
          </Descriptions>
        </Space>
      </Drawer>

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
                label="Cara Kerja Step"
                name="basisType"
                rules={[{ required: true, message: "Cara kerja step wajib dipilih" }]}
              >
                <Select options={PRODUCTION_STEP_BASIS_TYPES} placeholder="Pilih cara kerja step" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Cara Pantau Hasil"
                name="monitoringMode"
                rules={[{ required: true, message: "Cara pantau hasil wajib dipilih" }]}
              >
                <Select options={PRODUCTION_STEP_MONITORING_MODES} placeholder="Pilih cara pantau hasil" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Sistem Bayar</Divider>

          <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
            Rule payroll di section ini adalah source of truth untuk payroll produksi baru. Work Log akan menyimpan snapshot rule ini saat diposting, lalu Payroll membaca snapshot tersebut saat draft dibuat.
          </Typography.Paragraph>

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
              <Form.Item label="Dibayar Tiap Berapa Hasil" name="payrollQtyBase">
                <InputNumber min={1} style={{ width: "100%" }} placeholder="Contoh: 1" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Hitung dari Hasil" name="payrollOutputBasis">
                <Select options={PRODUCTION_STEP_PAYROLL_OUTPUT_BASIS} placeholder="Pilih basis output" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Klasifikasi Payroll</Divider>

          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Klasifikasi Payroll"
                name="payrollClassification"
                rules={[{ required: true, message: "Klasifikasi payroll wajib dipilih" }]}
              >
                <Select
                  options={PRODUCTION_STEP_PAYROLL_CLASSIFICATIONS}
                  placeholder="Pilih klasifikasi payroll"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Masuk ke HPP Produksi Inti" name="includePayrollInHpp" valuePropName="checked">
                <Switch checkedChildren="Ya" unCheckedChildren="Tidak" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Catatan Admin</Divider>

          <Form.Item label="Catatan Payroll" name="payrollNotes">
            <Input.TextArea rows={3} placeholder="Catatan admin untuk payroll step ini" />
          </Form.Item>

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
