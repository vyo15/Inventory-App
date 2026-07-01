// =====================================================
// Page: Karyawan Produksi
// Master operator/karyawan produksi
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
  DEFAULT_PRODUCTION_EMPLOYEE_FORM,
  EMPLOYEE_ROLE_MAP,
  EMPLOYEE_TYPE_MAP,
  PRODUCTION_EMPLOYEE_EMPLOYMENT_TYPES,
  PRODUCTION_EMPLOYEE_ROLES,
} from "../../constants/productionEmployeeOptions";
import {
  createProductionEmployee,
  getAllProductionEmployees,
  getNextProductionEmployeeCodePreview,
  toggleProductionEmployeeActive,
  updateProductionEmployee,
} from "../../services/Produksi/productionEmployeesService";
import StatusTag from "../../components/Layout/Feedback/StatusTag";
import { getAllProductionPayrolls } from "../../services/Produksi/productionPayrollsService";
import { getAllProductionWorkLogs } from "../../services/Produksi/productionWorkLogsService";
import { getActiveProductionSteps } from "../../services/Produksi/productionStepsService";
import formatNumber from "../../utils/formatters/numberId";
import formatCurrency from "../../utils/formatters/currencyId";
import ProductionFilterCard from "../../components/Produksi/shared/ProductionFilterCard";
import ProductionPageHeader from "../../components/Produksi/shared/ProductionPageHeader";
import PageContentCanvas from "../../components/Layout/Page/PageContentCanvas";
import PageSection from "../../components/Layout/Page/PageSection";
import ProductionSummaryCards from "../../components/Produksi/shared/ProductionSummaryCards";
import DataTableView from "../../components/Layout/Table/DataTableView";
import TableActionMenu from "../../components/Layout/Table/TableActionMenu";
import InfoPopoverButton from "../../components/Layout/Feedback/InfoPopoverButton";
import { showFormValidationFeedback } from '../../utils/forms/formValidationFeedback';
import ProductionEmployeeDetailDrawer from "./components/ProductionEmployeeDetailDrawer";
import ProductionEmployeeFormDrawer from "./components/ProductionEmployeeFormDrawer";
import { buildEmployeeActivitySummary, buildEmployeeSummaryMap } from "./helpers/productionEmployeesPageHelpers";

// =====================================================
// Formatter final lintas aplikasi
// ACTIVE / FINAL: karyawan produksi memakai helper shared untuk semua angka.
// =====================================================

// =====================================================
// Main Component
// =====================================================
// IMS NOTE [AKTIF/GUARDED] - Standar input angka bulat
// Fungsi blok: mengarahkan InputNumber aktif ke step 1, precision 0, dan parser integer Indonesia.
// Hubungan flow: hanya membatasi input/display UI; service calculation stok, kas, HPP, payroll, dan report tidak diubah.
// Alasan logic: IMS operasional memakai angka tanpa desimal, sementara data historis decimal tidak dimigrasi otomatis.
// Behavior: input baru no-decimal; business rules dan schema/alur data utama tetap sama.

const ProductionEmployees = () => {
  const { message } = AntdApp.useApp();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [stepOptions, setStepOptions] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [workLogs, setWorkLogs] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");

  const [formVisible, setFormVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [employeeCodeLoading, setEmployeeCodeLoading] = useState(false);

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);

  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // =====================================================
      // ACTIVE / FINAL - DATA UTAMA KARYAWAN
      // Fungsi blok:
      // - memuat master karyawan produksi dari collection `production_employees`;
      // - langsung mengisi state `employees` ketika berhasil.
      // Alasan blok ini dipakai:
      // - data employee adalah data utama halaman, sehingga tidak boleh ikut kosong
      //   hanya karena query pendukung steps/payroll/worklogs terkena query/index database.
      // Status:
      // - aktif dipakai; bukan data historis dan bukan kandidat cleanup.
      // =====================================================
      const employeeResult = await getAllProductionEmployees();
      setEmployees(Array.isArray(employeeResult) ? employeeResult : []);

      // =====================================================
      // ACTIVE / GUARDED - DATA PENDUKUNG HALAMAN
      // Fungsi blok:
      // - memuat tahapan, payroll, dan work log untuk filter/summary read-only;
      // - memakai Promise.allSettled agar satu query pendukung yang gagal karena
      //   composite index database tidak menjatuhkan tabel karyawan.
      // Alasan blok ini dipakai:
      // - bug lama muncul karena Promise.all membuat `setEmployees()` tidak jalan
      //   saat salah satu query pendukung reject.
      // Status:
      // - aktif dipakai sebagai guard; bukan data historis.
      // =====================================================
      const [stepResult, payrollResult, workLogResult] = await Promise.allSettled([
        getActiveProductionSteps(),
        getAllProductionPayrolls(),
        getAllProductionWorkLogs(),
      ]);

      const failedSupportingData = [];

      if (stepResult.status === "fulfilled") {
        setStepOptions(Array.isArray(stepResult.value) ? stepResult.value : []);
      } else {
        console.warn("Data tahapan produksi pendukung gagal dimuat", stepResult.reason);
        setStepOptions([]);
        failedSupportingData.push("tahapan produksi");
      }

      if (payrollResult.status === "fulfilled") {
        setPayrolls(Array.isArray(payrollResult.value) ? payrollResult.value : []);
      } else {
        console.warn("Data payroll produksi pendukung gagal dimuat", payrollResult.reason);
        setPayrolls([]);
        failedSupportingData.push("payroll produksi");
      }

      if (workLogResult.status === "fulfilled") {
        setWorkLogs(Array.isArray(workLogResult.value) ? workLogResult.value : []);
      } else {
        console.warn("Data work log produksi pendukung gagal dimuat", workLogResult.reason);
        setWorkLogs([]);
        failedSupportingData.push("work log produksi");
      }

      // =====================================================
      // ACTIVE / FINAL - WARNING PENDUKUNG
      // Fungsi blok:
      // - memberi tahu user/dev bahwa tabel karyawan tetap tampil, tetapi summary
      //   pendukung bisa belum lengkap karena query/index database.
      // Alasan blok ini dipakai:
      // - pesan error lama membuat user mengira data employee hilang, padahal hanya
      //   data pendukung yang gagal dimuat.
      // Status:
      // - aktif dipakai; kandidat cleanup hanya jika seluruh composite index sudah
      //   stabil dan halaman tidak lagi membutuhkan guard ini.
      // =====================================================
      if (failedSupportingData.length > 0) {
        message.warning(
          `Data karyawan tampil, tetapi data pendukung ${failedSupportingData.join(
            ", ",
          )} belum lengkap. Cek index database atau fallback query.`,
        );
      }
    } catch (error) {
      // =====================================================
      // ACTIVE / FINAL - ERROR FATAL DATA UTAMA
      // Fungsi blok:
      // - hanya dianggap fatal jika query utama employee gagal;
      // - data pendukung tidak boleh membuat tabel employee kosong.
      // Alasan blok ini dipakai:
      // - menjaga pesan error sesuai sumber masalah sebenarnya.
      // Status:
      // - aktif dipakai; bukan data historis.
      // =====================================================
      console.error("Gagal memuat data utama karyawan produksi", error);
      setEmployees([]);
      setStepOptions([]);
      setPayrolls([]);
      setWorkLogs([]);
      message.error("Gagal memuat data utama karyawan produksi");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summary = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((item) => item.isActive).length;
    const inactive = total - active;
    const assigned = employees.filter(
      (item) =>
        Array.isArray(item.assignedStepIds) && item.assignedStepIds.length > 0,
    ).length;

    return { total, active, inactive, assigned };
  }, [employees]);

  const filteredData = useMemo(() => {
    return employees.filter((item) => {
      const searchText = search.trim().toLowerCase();

      const matchSearch =
        !searchText ||
        String(item.code || "")
          .toLowerCase()
          .includes(searchText) ||
        String(item.name || "")
          .toLowerCase()
          .includes(searchText) ||
        String(item.phone || "")
          .toLowerCase()
          .includes(searchText);

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && item.isActive) ||
        (statusFilter === "inactive" && !item.isActive);

      const matchEmploymentType =
        employmentTypeFilter === "all" ||
        item.employmentType === employmentTypeFilter;

      const matchRole = roleFilter === "all" || item.role === roleFilter;

      const stepCount = Array.isArray(item.assignedStepIds)
        ? item.assignedStepIds.length
        : 0;

      const matchAssignment =
        assignmentFilter === "all" ||
        (assignmentFilter === "assigned" && stepCount > 0) ||
        (assignmentFilter === "unassigned" && stepCount === 0);

      return (
        matchSearch &&
        matchStatus &&
        matchEmploymentType &&
        matchRole &&
        matchAssignment
      );
    });
  }, [
    employees,
    search,
    statusFilter,
    employmentTypeFilter,
    roleFilter,
    assignmentFilter,
  ]);

  const resetFormState = () => {
    setEditingEmployee(null);
    setEmployeeCodeLoading(false);
    form.resetFields();
    form.setFieldsValue(DEFAULT_PRODUCTION_EMPLOYEE_FORM);
  };

  const handleAdd = async () => {
    // =====================================================
    // ACTIVE / FINAL
    // Saat modal tambah dibuka, kode karyawan digenerate sebagai preview
    // DDMMYYYY-XXX supaya user tidak mengetik manual. Service tetap
    // generate ulang saat submit untuk menjaga uniqueness jika ada user lain
    // menambah karyawan di waktu bersamaan.
    // =====================================================
    setEditingEmployee(null);
    form.setFieldsValue(DEFAULT_PRODUCTION_EMPLOYEE_FORM);
    setFormVisible(true);
    setEmployeeCodeLoading(true);

    try {
      const previewCode = await getNextProductionEmployeeCodePreview();
      form.setFieldsValue({ code: previewCode });
    } catch (error) {
      console.error(error);
      message.error("Gagal membuat preview kode karyawan produksi");
    } finally {
      setEmployeeCodeLoading(false);
    }
  };

  const handleEdit = (record) => {
    setEditingEmployee(record);

    form.setFieldsValue({
      ...DEFAULT_PRODUCTION_EMPLOYEE_FORM,
      ...record,
    });

    setFormVisible(true);
  };

  const handleViewDetail = (record) => {
    setSelectedEmployee(record);
    setDetailVisible(true);
  };

  const getSelectedSteps = (stepIds = []) => {
    const ids = Array.isArray(stepIds) ? stepIds : [];
    return stepOptions.filter((step) => ids.includes(step.id));
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const selectedSteps = getSelectedSteps(values.assignedStepIds);

      setSubmitting(true);

      if (editingEmployee?.id) {
        await updateProductionEmployee(
          editingEmployee.id,
          values,
          selectedSteps,
          null,
        );
        message.success("Karyawan produksi berhasil diperbarui");
      } else {
        const createdEmployee = await createProductionEmployee(
          values,
          selectedSteps,
          null,
        );
        message.success(
          `Karyawan produksi berhasil ditambahkan dengan kode ${createdEmployee.code}`,
        );
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
      message.error("Gagal menyimpan data karyawan produksi");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (record) => {
    try {
      await toggleProductionEmployeeActive(record.id, !record.isActive, null);
      message.success(
        `Karyawan berhasil ${record.isActive ? "dinonaktifkan" : "diaktifkan"}`,
      );
      await loadData();
    } catch (error) {
      console.error(error);
      message.error("Gagal mengubah status karyawan");
    }
  };



  // =====================================================
  // ACTIVE / FINAL
  // Ringkasan payroll per orang dibaca dari payroll final dan work log final.
  // Halaman karyawan tidak menjadi source of truth payroll baru.
  // =====================================================
  const employeeSummaryMap = useMemo(
    () => buildEmployeeSummaryMap({ employees, payrolls, workLogs }),
    [employees, payrolls, workLogs],
  );

  const selectedEmployeeSummary = selectedEmployee
    ? employeeSummaryMap[selectedEmployee.id] || null
    : null;

  // =====================================================
  // ACTIVE / UI DETAIL COMPACT SUMMARY
  // Fungsi blok:
  // - menyiapkan ringkasan kecil untuk drawer Detail Karyawan Produksi;
  // - hanya membaca data Work Log/Payroll yang sudah dimuat, tanpa menulis data.
  // Alasan blok ini dipakai:
  // - bug UI terjadi karena detail lama terlalu penuh dan menampilkan tabel/help text panjang.
  // Status:
  // - aktif dipakai sebagai ringkasan operasional; bukan data historis dan bukan kandidat cleanup.
  // =====================================================
  const selectedEmployeeActivitySummary = useMemo(
    () => buildEmployeeActivitySummary(selectedEmployeeSummary),
    [selectedEmployeeSummary],
  );

  // =====================================================
  // ACTIVE / UI DETAIL OPTIONAL SECTIONS
  // Fungsi blok:
  // - mendeteksi apakah info tambahan dan field arsip payroll perlu ditampilkan di Collapse;
  // - field arsip payroll tetap dibaca untuk audit, tetapi tidak ditampilkan sebagai fitur utama.
  // Alasan blok ini dipakai:
  // - payroll baru mengikuti Tahapan Produksi + Work Log completed, bukan custom payroll employee.
  // Status:
  // - aktif dipakai untuk UI detail; bagian arsip payroll adalah compatibility dan kandidat cleanup
  //   hanya jika data historis sudah diputuskan tidak dibutuhkan lagi.
  // =====================================================
  // =====================================================
  // SECTION: Main table compact columns — AKTIF
  // Fungsi:
  // - Menampilkan ringkasan karyawan, role, jenis kerja, assignment step, status, dan aksi tanpa scroll x besar.
  // - Menjaga payroll summary, work log recent, additional info, dan arsip payroll tetap di drawer detail existing.
  //
  // Dipakai oleh:
  // - ProductionEmployees main table.
  //
  // Alasan perubahan:
  // - Main table sebelumnya memakai scroll x besar untuk kolom identitas, role, assignment, status, dan aksi yang bisa digabung.
  //
  // Catatan cleanup:
  // - Pola compact assignment tag dapat distandarkan ke shared component bila dipakai ulang di halaman produksi lain.
  //
  // Risiko:
  // - Jangan mengubah employeeSummaryMap, query payroll/worklog, atau arsip payroll dari section presentasi ini.
  // =====================================================
  const columns = [
    {
      title: "Karyawan",
      dataIndex: "name",
      key: "employeeSummary",
      width: "34%",
      render: (_, record) => (
        <Space direction="vertical" size={2} style={{ width: "100%" }}>
          <Typography.Text strong ellipsis={{ tooltip: record.name || "-" }}>
            {record.name || "-"}
          </Typography.Text>
          <Typography.Text type="secondary" className="ims-cell-meta" ellipsis={{ tooltip: record.phone || "-" }}>
            {record.phone || "-"}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Role / Jenis Kerja",
      key: "roleType",
      width: "22%",
      render: (_, record) => (
        <Space size={[4, 4]} wrap>
          <Tag color="blue">{EMPLOYEE_ROLE_MAP[record.role] || "-"}</Tag>
          <Tag>{EMPLOYEE_TYPE_MAP[record.employmentType] || "-"}</Tag>
        </Space>
      ),
    },
    {
      title: "Step Assignment",
      key: "assignedSteps",
      width: "22%",
      responsive: ["md"],
      render: (_, record) => {
        const stepNames = Array.isArray(record.assignedStepNames)
          ? record.assignedStepNames
          : [];

        if (stepNames.length === 0) {
          return <Typography.Text type="secondary">Belum ada</Typography.Text>;
        }

        return (
          <Tooltip title={stepNames.join(", ")}>
            <Space size={[4, 4]} wrap>
              {stepNames.slice(0, 3).map((item) => (
                <Tag key={item}>{item}</Tag>
              ))}
              {stepNames.length > 3 && <Tag>+{stepNames.length - 3} lainnya</Tag>}
            </Space>
          </Tooltip>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "isActive",
      key: "isActive",
      width: 118,
      align: "center",
      className: "app-table-status-column",
      render: (value) =>
        value ? (
          <Badge status="success" text="Aktif" />
        ) : (
          <Badge status="default" text="Nonaktif" />
        ),
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
              onClick: () => handleViewDetail(record),
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
                title: record.isActive ? "Nonaktifkan karyawan ini?" : "Aktifkan karyawan ini?",
                description: record.isActive
                  ? "Karyawan tidak akan bisa dipilih untuk work log baru."
                  : "Karyawan akan aktif kembali untuk work log baru.",
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

  // IMS NOTE [AKTIF/GUARDED UI] - Mobile card karyawan produksi.
  // Fungsi: membuat daftar karyawan terbaca di HP tanpa tabel geser.
  // Guardrail: hanya presentasi; query payroll/worklog, rule payroll, dan status karyawan tetap memakai handler existing.
  const productionEmployeeMobileCardConfig = {
    title: (record) => record.name || "-",
    subtitle: (record) => [
      record.phone || "No HP belum tercatat",
      record.code ? `Kode: ${record.code}` : null,
    ].filter(Boolean),
    tags: (record) => [
      <Tag key="role" color="blue">{EMPLOYEE_ROLE_MAP[record.role] || "Role belum diset"}</Tag>,
      <Tag key="type">{EMPLOYEE_TYPE_MAP[record.employmentType] || "Jenis kerja belum diset"}</Tag>,
      record.isActive ? (
        <StatusTag key="status" tone="success">Aktif</StatusTag>
      ) : (
        <Tag key="status" color="default">Nonaktif</Tag>
      ),
    ],
    meta: [
      {
        label: "Step",
        value: (record) => {
          const stepNames = Array.isArray(record.assignedStepNames) ? record.assignedStepNames : [];
          return stepNames.length ? `${formatNumber(stepNames.length)} step` : "Belum ada";
        },
      },
      {
        label: "Work Log",
        value: (record) => formatNumber(employeeSummaryMap[record.id]?.totalWorkLogs || 0),
      },
      {
        label: "Payroll Paid",
        value: (record) => formatCurrency(employeeSummaryMap[record.id]?.totalPaidAmount || 0),
      },
    ],
    content: (record) => {
      const stepNames = Array.isArray(record.assignedStepNames) ? record.assignedStepNames : [];
      if (!stepNames.length) return "Belum ada assignment step.";

      return (
        <Space size={[4, 4]} wrap>
          {stepNames.slice(0, 4).map((item) => (
            <Tag key={item}>{item}</Tag>
          ))}
          {stepNames.length > 4 ? <Tag>+{formatNumber(stepNames.length - 4)} lainnya</Tag> : null}
        </Space>
      );
    },
    primaryActions: (record) => [
      {
        key: "detail",
        label: "Detail",
        icon: <EyeOutlined />,
        onClick: () => handleViewDetail(record),
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
          title: record.isActive ? "Nonaktifkan karyawan ini?" : "Aktifkan karyawan ini?",
          description: record.isActive
            ? "Karyawan tidak akan bisa dipilih untuk work log baru."
            : "Karyawan akan aktif kembali untuk work log baru.",
          okText: "Ya",
          cancelText: "Batal",
        },
        onClick: () => handleToggleActive(record),
      },
    ],
  };

  const summaryItems = [
    {
      key: "employees-total",
      title: "Total Karyawan",
      value: summary.total,
      subtitle: "Seluruh master operator produksi yang tercatat.",
      accent: "primary",
    },
    {
      key: "employees-active",
      title: "Karyawan Aktif",
      value: summary.active,
      subtitle: "Masih bisa dipilih untuk work log baru.",
      accent: "success",
    },
    {
      key: "employees-inactive",
      title: "Karyawan Nonaktif",
      value: summary.inactive,
      subtitle: "Disimpan untuk histori tetapi tidak aktif dipakai.",
      accent: "warning",
    },
    {
      key: "employees-assigned",
      title: "Sudah Assign Step",
      value: summary.assigned,
      subtitle: "Sudah punya tahapan produksi terkait.",
      accent: "default",
    },
  ];

  return (
    <div className="page-container">
      {/* AKTIF / GUARDED: header dimigrasikan ke shared produksi untuk konsistensi UX lintas halaman tanpa mengubah flow submit master karyawan. */}
      <ProductionPageHeader
        title="Karyawan Produksi"
        description="Master operator produksi."
        onAdd={handleAdd}
        addLabel="Tambah Karyawan"
      />

      <PageContentCanvas>


      {/* AKTIF / GUARDED: summary hanya ganti wrapper presentational, nilai tetap dari kalkulasi existing. */}
      <ProductionSummaryCards items={summaryItems} />

      {/* AKTIF / GUARDED: filter card shared menjaga layout seragam, state/filter logic tidak diubah. */}
      <ProductionFilterCard>
          <Col xs={24} md={6}>
            <Input
              placeholder="Cari kode, nama, no HP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>

          <Col xs={24} md={4}>
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

          <Col xs={24} md={5}>
            <Select
              style={{ width: "100%" }}
              value={employmentTypeFilter}
              onChange={setEmploymentTypeFilter}
              options={[
                { value: "all", label: "Semua Jenis Kerja" },
                ...PRODUCTION_EMPLOYEE_EMPLOYMENT_TYPES,
              ]}
            />
          </Col>

          <Col xs={24} md={4}>
            <Select
              style={{ width: "100%" }}
              value={roleFilter}
              onChange={setRoleFilter}
              options={[
                { value: "all", label: "Semua Role" },
                ...PRODUCTION_EMPLOYEE_ROLES,
              ]}
            />
          </Col>

          <Col xs={24} md={5}>
            <Select
              style={{ width: "100%" }}
              value={assignmentFilter}
              onChange={setAssignmentFilter}
              options={[
                { value: "all", label: "Semua Assignment" },
                { value: "assigned", label: "Sudah Ada Step" },
                { value: "unassigned", label: "Belum Ada Step" },
              ]}
            />
          </Col>
      </ProductionFilterCard>

      <PageSection
        title="Daftar Karyawan Produksi"
        subtitle="Master operator produksi."
        extra={(
          <InfoPopoverButton
            label="Aturan Operator"
            title="Operator produksi dan payroll"
            description="Master operator dipakai sebagai referensi produksi. Ringkasan payroll bersifat read-only dari data final."
            items={[
              { label: 'Operator', value: 'Referensi untuk Work Log dan payroll.' },
              { label: 'Payroll', value: 'Ringkasan berasal dari data final.' },
              { label: 'Histori', value: 'Data lama tetap disimpan untuk audit.' },
            ]}
          />
        )}
      >
        {/* =====================================================
            SECTION: Main table render — AKTIF
            Fungsi:
            - Merender tabel utama karyawan produksi dengan layout compact tanpa scroll x besar.

            Dipakai oleh:
            - ProductionEmployees page.

            Alasan perubahan:
            - Status dan aksi tidak lagi fixed karena kolom identitas/assignment sudah diringkas.

            Catatan cleanup:
            - belum ada.

            Risiko:
            - Mengubah query summary payroll/worklog dari area tabel dapat menggeser source of truth payroll produksi.
        ===================================================== */}
        <DataTableView
          loading={loading}
          className="app-data-table"
          rowKey="id"
          columns={columns}
          dataSource={filteredData}
          emptyState={{ description: "Belum ada data karyawan produksi" }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
          }}
          mobileCardConfig={productionEmployeeMobileCardConfig}
        />
      </PageSection>

      </PageContentCanvas>

<ProductionEmployeeFormDrawer
        editingEmployee={editingEmployee}
        employeeCodeLoading={employeeCodeLoading}
        form={form}
        formVisible={formVisible}
        handleSubmit={handleSubmit}
        resetFormState={resetFormState}
        setFormVisible={setFormVisible}
        stepOptions={stepOptions}
        submitting={submitting}
      />

<ProductionEmployeeDetailDrawer
        detailVisible={detailVisible}
        selectedEmployee={selectedEmployee}
        selectedEmployeeActivitySummary={selectedEmployeeActivitySummary}
        selectedEmployeeSummary={selectedEmployeeSummary}
        setDetailVisible={setDetailVisible}
      />
    </div>
  );
};

export default ProductionEmployees;
