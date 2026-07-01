// =====================================================
// Page: Tahapan Produksi
// Versi disederhanakan agar fokus ke daftar step,
// relasi karyawan, dan relasi BOM.
// =====================================================

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  App as AntdApp,
  Badge,
  Col,
  Form,
  Input,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  EditOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import {
  BASIS_TYPE_MAP,
  DEFAULT_PRODUCTION_STEP_FORM,
  PROCESS_TYPE_MAP,
  PRODUCTION_STEP_PROCESS_TYPES,
  formatProductionStepPayrollPreview,
} from "../../constants/productionStepOptions";
import formatNumber from "../../utils/formatters/numberId";
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
import PageContentCanvas from "../../components/Layout/Page/PageContentCanvas";
import PageSection from "../../components/Layout/Page/PageSection";
import DataTableView from "../../components/Layout/Table/DataTableView";
import TableActionMenu from "../../components/Layout/Table/TableActionMenu";
import ProductionSummaryCards from "../../components/Produksi/shared/ProductionSummaryCards";
import { getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";
import { showFormValidationFeedback } from '../../utils/forms/formValidationFeedback';
import ProductionStepDetailDrawer from "./components/ProductionStepDetailDrawer";
import ProductionStepFormDrawer from "./components/ProductionStepFormDrawer";
import ProductionStepRelationDrawer from "./components/ProductionStepRelationDrawer";

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
  const { message } = AntdApp.useApp();
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

  const loadData = useCallback(async () => {
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
  }, [message]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      monitoringMetric: record.monitoringMetric || DEFAULT_PRODUCTION_STEP_FORM.monitoringMetric,
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
            {record.description ? (
              <Typography.Text type="secondary" className="ims-cell-meta" ellipsis={{ tooltip: record.description }}>
                {record.description}
              </Typography.Text>
            ) : null}
          </Space>
        );
      },
    },
    {
      title: "Cara Kerja",
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
      width: 132,
      className: "app-table-action-column",
      render: (_, record) => (
        <TableActionMenu
          visibleActions={[
            {
              key: "detail",
              label: "Detail",
              icon: <EyeOutlined />,
              onClick: () => handleOpenDetailDrawer(record),
            },
          ]}
          moreActions={[
            {
              key: "edit",
              label: "Edit",
              icon: <EditOutlined />,
              onClick: () => handleEdit(record),
            },
            {
              key: "toggle",
              label: record.isActive ? "Nonaktifkan" : "Aktifkan",
              danger: record.isActive,
              confirm: {
                title: record.isActive ? "Nonaktifkan step ini?" : "Aktifkan step ini?",
                okText: "Ya",
                cancelText: "Batal",
              },
              onClick: () => handleToggleActive(record),
            },
          ]}
        />
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
    primaryActions: (record) => [
      {
        key: "detail",
        label: "Detail",
        icon: <EyeOutlined />,
        onClick: () => handleOpenDetailDrawer(record),
      },
    ],
    moreActions: (record) => [
      {
        key: "edit",
        label: "Edit",
        icon: <EditOutlined />,
        onClick: () => handleEdit(record),
      },
      {
        key: "toggle",
        label: record.isActive ? "Nonaktifkan" : "Aktifkan",
        danger: record.isActive,
        confirm: {
          title: record.isActive ? "Nonaktifkan step ini?" : "Aktifkan step ini?",
          okText: "Ya",
          cancelText: "Batal",
        },
        onClick: () => handleToggleActive(record),
      },
    ],
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

      <PageContentCanvas>

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
        extra={<Typography.Text type="secondary">{formatNumber(filteredData.length)} hasil</Typography.Text>}
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
            emptyText: getDataTableEmptyText(loading, "Belum ada data tahapan produksi"),
          }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
          }}
        />
      </PageSection>

      </PageContentCanvas>

<ProductionStepDetailDrawer
        detailDrawerVisible={detailDrawerVisible}
        handleOpenBomDrawer={handleOpenBomDrawer}
        handleOpenEmployeeDrawer={handleOpenEmployeeDrawer}
        selectedStep={selectedStep}
        selectedStepPayrollPreview={selectedStepPayrollPreview}
        setDetailDrawerVisible={setDetailDrawerVisible}
      />

<ProductionStepFormDrawer
        editingStep={editingStep}
        form={form}
        formVisible={formVisible}
        handleSubmit={handleSubmit}
        resetFormState={resetFormState}
        setFormVisible={setFormVisible}
        submitting={submitting}
      />

<ProductionStepRelationDrawer
        title={`Karyawan pada Step: ${selectedStep?.name || "-"}`}
        open={employeeDrawerVisible}
        onClose={() => setEmployeeDrawerVisible(false)}
        width={760}
        searchPlaceholder="Cari nama, role, atau tipe kerja..."
        searchValue={employeeDrawerSearch}
        onSearchChange={setEmployeeDrawerSearch}
        columns={employeeColumns}
        dataSource={selectedStepEmployees}
        mobileCardConfig={stepEmployeeMobileCardConfig}
        emptyDescription="Belum ada karyawan terkait step ini"
      />

<ProductionStepRelationDrawer
        title={`BOM yang menggunakan Step: ${selectedStep?.name || "-"}`}
        open={bomDrawerVisible}
        onClose={() => setBomDrawerVisible(false)}
        width={860}
        searchPlaceholder="Cari nama BOM atau target..."
        searchValue={bomDrawerSearch}
        onSearchChange={setBomDrawerSearch}
        columns={bomColumns}
        dataSource={selectedStepBoms}
        mobileCardConfig={stepBomMobileCardConfig}
        emptyDescription="Step ini belum dipakai di BOM mana pun"
      />
    </div>
  );
};

export default ProductionSteps;
