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
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  BASIS_TYPE_MAP,
  DEFAULT_PRODUCTION_STEP_FORM,
  PROCESS_TYPE_MAP,
  PRODUCTION_STEP_BASIS_TYPES,
  PRODUCTION_STEP_PAYROLL_MODES,
  PRODUCTION_STEP_PROCESS_TYPES,
  formatProductionStepPayrollPreview,
} from "../../constants/productionStepOptions";
import formatNumber, { parseIntegerIdInput } from "../../utils/formatters/numberId";
import {
  createProductionStep,
  getAllProductionSteps,
  toggleProductionStepActive,
  updateProductionStep,
} from "../../services/Produksi/productionStepsService";
import { getAllProductionEmployees } from "../../services/Produksi/productionEmployeesService";
import { getAllProductionBoms } from "../../services/Produksi/productionBomsService";
import ProductionFilterCard from "../../components/Produksi/shared/ProductionFilterCard";
import ProductionPageHeader from "../../components/Produksi/shared/ProductionPageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import DataTableView from "../../components/Layout/Table/DataTableView";
import MobileDetailDrawer from "../../components/Layout/Mobile/MobileDetailDrawer";
import ProductionSummaryCards from "../../components/Produksi/shared/ProductionSummaryCards";
import { getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";
import { showFormValidationFeedback } from '../../utils/forms/formValidationFeedback';

// IMS NOTE [AKTIF/GUARDED] - Standar input angka bulat
// Fungsi blok: mengarahkan InputNumber aktif ke step 1, precision 0, dan parser integer Indonesia.
// Hubungan flow: hanya membatasi input/display UI; service calculation stok, kas, HPP, payroll, dan report tidak diubah.
// Alasan logic: IMS operasional memakai angka tanpa desimal, sementara data historis decimal tidak dimigrasi otomatis.
// Behavior: input baru no-decimal; business rules dan schema/alur data utama tetap sama.

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
        String(BASIS_TYPE_MAP[item.basisType] || "").toLowerCase().includes(searchText);

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
      payrollMode:
        record.payrollMode === "per_batch"
          ? "per_batch"
          : DEFAULT_PRODUCTION_STEP_FORM.payrollMode,
      payrollRate: Number(record.payrollRate || 0),
      payrollOutputBasis: record.payrollOutputBasis || DEFAULT_PRODUCTION_STEP_FORM.payrollOutputBasis,
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

  const summaryItems = [
    { key: "steps-total", title: "Total Step", value: summary.total, subtitle: "Semua tahapan produksi yang tersimpan.", accent: "primary" },
    { key: "steps-active", title: "Step Aktif", value: summary.active, subtitle: "Masih aktif dipakai untuk produksi dan payroll.", accent: "success" },
    { key: "steps-employees", title: "Terhubung Karyawan", value: summary.usedByEmployees, subtitle: "Step yang sudah dipakai di assignment karyawan.", accent: "warning" },
    { key: "steps-boms", title: "Dipakai di BOM", value: summary.usedByBoms, subtitle: "Step yang sudah dipakai di recipe BOM aktif.", accent: "default" },
  ];

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
      if (showFormValidationFeedback(error, { form })) return;

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

  // =====================================================
  // SECTION: Main table compact columns — AKTIF
  // Fungsi:
  // - Menampilkan ringkasan step, kategori, aturan upah, dan relasi tanpa horizontal scroll besar.
  // - Menjaga detail konfigurasi lengkap tetap berada di drawer detail existing.
  //
  // Dipakai oleh:
  // - ProductionSteps main table.
  //
  // Alasan perubahan:
  // - Main table sebelumnya memakai scroll x besar dan fixed right untuk Status/Aksi, membuat master ringan terasa terlalu lebar.
  //
  // Catatan cleanup:
  // - Pola tag ringkas bisa distandarkan ke shared helper produksi pada batch cleanup UI berikutnya.
  //
  // Risiko:
  // - Mengubah source employeeCount/bomCount atau payroll preview di section ini dapat mengganggu audit relasi dan payroll rule produksi.
  // =====================================================
  const columns = [
    {
      title: "Step",
      dataIndex: "name",
      key: "stepSummary",
      width: "30%",
      render: (_, record) => {
        const categoryLabel = PROCESS_TYPE_MAP[record.processType] || record.processType || "-";

        return (
          <Space direction="vertical" size={4} style={{ width: "100%" }}>
            <Typography.Text strong ellipsis={{ tooltip: record.name || "-" }}>
              {record.name || "-"}
            </Typography.Text>
            <Space size={[4, 4]} wrap>
              <Tooltip title={categoryLabel}>
                <Tag style={categoryTagStyle}>{categoryLabel}</Tag>
              </Tooltip>
            </Space>
          </Space>
        );
      },
    },
    {
      title: "Produksi",
      key: "stepBasis",
      width: "22%",
      responsive: ["md"],
      render: (_, record) => {
        const basisLabel = BASIS_TYPE_MAP[record.basisType] || record.basisType || "-";

        return <Tag>{basisLabel}</Tag>;
      },
    },
    {
      title: "Upah",
      key: "stepPayroll",
      width: "20%",
      responsive: ["md"],
      render: (_, record) => {
        const payrollPreview = record.payrollMode
          ? formatProductionStepPayrollPreview(record)
          : "Belum ada aturan upah";

        return (
          <Tooltip title={payrollPreview}>
            <Typography.Text type={record.payrollMode ? undefined : "secondary"} ellipsis>
              {payrollPreview}
            </Typography.Text>
          </Tooltip>
        );
      },
    },
    {
      title: "Dipakai",
      key: "relations",
      width: "16%",
      responsive: ["lg"],
      render: (_, record) => (
        <Typography.Text>
          {formatNumber(record.bomCount || 0)} BOM · {formatNumber(record.employeeCount || 0)} karyawan
        </Typography.Text>
      ),
    },
    {
      title: "Status",
      dataIndex: "isActive",
      key: "isActive",
      width: 118,
      align: "center",
      className: "app-table-status-column",
      render: (value) =>
        value ? <Badge status="success" text="Aktif" /> : <Badge status="default" text="Nonaktif" />,
    },
    {
      title: "Aksi",
      key: "actions",
      width: 176,
      className: "app-table-action-column",
      render: (_, record) => (
        <Space direction="vertical" size={6} className="ims-action-group ims-action-group--vertical">
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
          <Popconfirm
            title={record.isActive ? "Nonaktifkan step ini?" : "Aktifkan step ini?"}
            onConfirm={() => handleToggleActive(record)}
            okText="Ya"
            cancelText="Batal"
          >
            <Button className="ims-action-button" size="small">
              {record.isActive ? "Nonaktifkan" : "Aktifkan"}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const stepsMobileCardConfig = {
    title: (record) => record.name || "Step produksi",
    subtitle: (record) => [
      PROCESS_TYPE_MAP[record.processType] || record.processType || "Kategori belum diisi",
      BASIS_TYPE_MAP[record.basisType] || record.basisType || "Cara kerja belum diisi",
    ],
    tags: (record) => record.isActive ? <Badge status="success" text="Aktif" /> : <Badge status="default" text="Nonaktif" />,
    meta: [
      { label: "Upah", value: (record) => record.payrollMode ? formatProductionStepPayrollPreview(record) : "Belum ada aturan upah" },
      { label: "BOM", value: (record) => formatNumber(record.bomCount || 0) },
      { label: "Karyawan", value: (record) => formatNumber(record.employeeCount || 0) },
    ],
    actions: (record) => (
      <Space wrap className="ims-action-group">
        <Button className="ims-action-button" size="small" icon={<EyeOutlined />} onClick={() => handleOpenDetailDrawer(record)}>Detail</Button>
        <Button className="ims-action-button" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>Edit</Button>
      </Space>
    ),
  };

  const stepEmployeeMobileCardConfig = {
    title: (record) => record.name || "Karyawan",
    subtitle: (record) => [record.role || "Role belum diisi", record.employmentType || "Tipe kerja belum diisi"],
    tags: (record) => record.isActive ? <Badge status="success" text="Aktif" /> : <Badge status="default" text="Nonaktif" />,
  };

  const stepBomMobileCardConfig = {
    title: (record) => record.name || "BOM",
    subtitle: (record) => record.targetName || "Target belum diisi",
    tags: (record) => [
      <Tag key="target" color="purple">{record.targetType === "product" ? "Produk Jadi" : "Semi Finished"}</Tag>,
      record.isActive ? <Badge key="active" status="success" text="Aktif" /> : <Badge key="inactive" status="default" text="Nonaktif" />,
    ],
  };

  const selectedStepPayrollPreview = selectedStep?.payrollMode
    ? formatProductionStepPayrollPreview(selectedStep)
    : "Belum ada rule payroll";

  return (
    <div className="page-container">
      {/* AKTIF / GUARDED: header shared dipakai agar pola halaman produksi konsisten, flow data step tetap existing. */}
      <ProductionPageHeader
        title="Tahapan Produksi"
        description="Master step untuk proses, BOM, dan upah produksi."
        onAdd={handleAdd}
        addLabel="Tambah Step"
      />

      {/* AKTIF / GUARDED: summary hanya migrasi layout card, perhitungan statistik tidak diubah. */}
      <ProductionSummaryCards items={summaryItems} />

      {/* AKTIF / GUARDED: filter section memakai card shared; state filter tetap mengikuti logic lama. */}
      <ProductionFilterCard>
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
      </ProductionFilterCard>

      <PageSection
        title="Daftar Tahapan Produksi"
        subtitle="Referensi step untuk karyawan, BOM, dan upah produksi."
      >
        {/* =====================================================
            SECTION: Main table render — AKTIF
            Fungsi:
            - Merender tabel utama tahapan produksi dengan kolom compact tanpa scroll x besar.

            Dipakai oleh:
            - ProductionSteps page.

            Alasan perubahan:
            - Status dan aksi tidak lagi fixed karena tabel utama sudah dipadatkan.

            Catatan cleanup:
            - belum ada.

            Risiko:
            - Menambahkan kembali fixed right tanpa scroll x dapat membuat layout action rusak di viewport kecil.
        ===================================================== */}
        <DataTableView
          loading={loading}
          showRefreshIndicator
          className="app-data-table"
          rowKey="id"
          columns={columns}
          dataSource={filteredData}
          mobileCardConfig={stepsMobileCardConfig}
          locale={{
            emptyText: getDataTableEmptyText(loading, <Empty description="Belum ada data tahapan produksi" />),
          }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
          }}
        />
      </PageSection>

      <MobileDetailDrawer
        title={`Detail Step Produksi: ${selectedStep?.name || "-"}`}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={760}
      >
        {/*
=====================================================
SECTION: Detail drawer tahapan produksi — AKTIF
Fungsi:
- Menampilkan konfigurasi step, rule payroll, dan relasi karyawan/BOM secara ringkas.

Dipakai oleh:
- Halaman ProductionSteps saat user membuka detail step produksi.

Alasan perubahan:
- Detail step dipisah menjadi metric, ringkasan, rule payroll, relasi, dan catatan agar tidak berupa satu Descriptions panjang.

Catatan cleanup:
- Belum ada; tombol relasi tetap memakai drawer existing.

Risiko:
- Jika payroll basis/rate atau relasi disembunyikan, Payroll Produksi dan BOM bisa salah dikonfigurasi.
=====================================================
*/}
        {!selectedStep ? (
          <Empty description="Tidak ada data" />
        ) : (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Row gutter={[12, 12]}>
              <Col xs={24} sm={12}>
                <Card size="small">
                  <Statistic title="Karyawan Terkait" value={formatNumber(selectedStep.employeeCount || 0)} />
                </Card>
              </Col>
              <Col xs={24} sm={12}>
                <Card size="small">
                  <Statistic title="Dipakai di BOM" value={formatNumber(selectedStep.bomCount || 0)} />
                </Card>
              </Col>
            </Row>

            <Card size="small" title="Ringkasan Step">
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Nama Step">{selectedStep.name || "-"}</Descriptions.Item>
                <Descriptions.Item label="Kategori">
                  {PROCESS_TYPE_MAP[selectedStep.processType] || selectedStep.processType || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Cara Kerja">
                  {BASIS_TYPE_MAP[selectedStep.basisType] || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  {selectedStep.isActive ? <Badge status="success" text="Aktif" /> : <Badge status="default" text="Nonaktif" />}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="Aturan Upah Produksi">
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Mode Bayar">{selectedStepPayrollPreview}</Descriptions.Item>
                <Descriptions.Item label="Dasar Hitung">
                  {selectedStep.payrollMode === "per_batch"
                    ? "Mengikuti jumlah batch produksi"
                    : "Mengikuti hasil baik pada Work Log"}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="Relasi">
              <Space size={12} wrap>
                <Button onClick={() => handleOpenEmployeeDrawer(selectedStep)}>
                  Lihat karyawan ({formatNumber(selectedStep.employeeCount || 0)})
                </Button>
                <Button onClick={() => handleOpenBomDrawer(selectedStep)}>
                  Lihat BOM ({formatNumber(selectedStep.bomCount || 0)})
                </Button>
              </Space>
            </Card>

            {selectedStep.description ? (
              <Card size="small" title="Fungsi / Deskripsi">
                <Typography.Paragraph style={{ marginBottom: 0 }}>
                  {selectedStep.description}
                </Typography.Paragraph>
              </Card>
            ) : null}
          </Space>
        )}
      </MobileDetailDrawer>

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
            Gunakan step untuk proses kerja nyata yang dipakai BOM, Work Log, dan upah produksi. Step dibuat universal agar tetap cocok untuk jenis bunga lain.
          </Typography.Paragraph>
          {/* =====================================================
          SECTION: Production Step internal code hidden from main UI — AKTIF
          Fungsi:
          - Form Production Step tidak menampilkan input kode utama agar user fokus pada nama step, kategori, deskripsi, urutan, payroll rule, dan status.

          Dipakai oleh:
          - Drawer form ProductionSteps dan productionStepsService sebagai pembuat kode internal.

          Alasan perubahan:
          - Kode STP tetap dibuat otomatis oleh service, tetapi tidak perlu menjadi input utama konfigurasi step.

          Catatan cleanup:
          - Kode internal tetap dipakai untuk relasi/audit teknis, tetapi tidak ditampilkan sebagai informasi utama UI.

          Risiko:
          - Jangan mengubah relasi employee-worklog saat menyembunyikan kode internal.
          ===================================================== */}
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

          <Form.Item
            label="Cara Kerja Step"
            name="basisType"
            rules={[{ required: true, message: "Cara kerja step wajib dipilih" }]}
          >
            <Select options={PRODUCTION_STEP_BASIS_TYPES} placeholder="Pilih cara kerja step" />
          </Form.Item>

          <Divider orientation="left">Aturan Upah Produksi</Divider>

          <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
            Atur tarif operator untuk step ini. Payroll final tetap dibuat dari Work Log yang sudah selesai.
          </Typography.Paragraph>

          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item label="Mode Bayar" name="payrollMode">
                <Select options={PRODUCTION_STEP_PAYROLL_MODES} placeholder="Pilih mode bayar" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Tarif Upah" name="payrollRate">
                <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} placeholder="Contoh: 2000" />
              </Form.Item>
            </Col>
          </Row>


          <Form.Item label="Status Aktif" name="isActive" valuePropName="checked">
            <Switch checkedChildren="Aktif" unCheckedChildren="Nonaktif" />
          </Form.Item>
        </Form>
      </Drawer>

      <MobileDetailDrawer
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

          <DataTableView
            rowKey="id"
            columns={employeeColumns}
            dataSource={selectedStepEmployees}
            pagination={{ pageSize: 8, showSizeChanger: true }}
            showRefreshIndicator={false}
            mobileCardConfig={stepEmployeeMobileCardConfig}
            locale={{ emptyText: <Empty description="Belum ada karyawan terkait step ini" /> }}
          />
        </Space>
      </MobileDetailDrawer>

      <MobileDetailDrawer
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

          <DataTableView
            rowKey="id"
            columns={bomColumns}
            dataSource={selectedStepBoms}
            pagination={{ pageSize: 8, showSizeChanger: true }}
            showRefreshIndicator={false}
            mobileCardConfig={stepBomMobileCardConfig}
            locale={{ emptyText: <Empty description="Step ini belum dipakai di BOM mana pun" /> }}
          />
        </Space>
      </MobileDetailDrawer>
    </div>
  );
};

export default ProductionSteps;
