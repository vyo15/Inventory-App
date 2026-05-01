// =====================================================
// Page: Karyawan Produksi
// Master operator/karyawan produksi
// =====================================================

import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Divider,
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
  Typography,
} from "antd";
import {
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  DEFAULT_PRODUCTION_EMPLOYEE_FORM,
  EMPLOYEE_GENDER_MAP,
  EMPLOYEE_PAYROLL_MODE_MAP,
  EMPLOYEE_PAYROLL_OUTPUT_BASIS_MAP,
  EMPLOYEE_ROLE_MAP,
  EMPLOYEE_TYPE_MAP,
  formatEmployeePayrollPreview,
  PRODUCTION_EMPLOYEE_CUSTOM_PAYROLL_MODES,
  PRODUCTION_EMPLOYEE_EMPLOYMENT_TYPES,
  PRODUCTION_EMPLOYEE_GENDERS,
  PRODUCTION_EMPLOYEE_PAYROLL_OUTPUT_BASIS,
  PRODUCTION_EMPLOYEE_ROLES,
} from "../../constants/productionEmployeeOptions";
import {
  createProductionEmployee,
  getAllProductionEmployees,
  getNextProductionEmployeeCodePreview,
  toggleProductionEmployeeActive,
  updateProductionEmployee,
} from "../../services/Produksi/productionEmployeesService";
import { getAllProductionPayrolls } from "../../services/Produksi/productionPayrollsService";
import { getAllProductionWorkLogs } from "../../services/Produksi/productionWorkLogsService";
import { getActiveProductionSteps } from "../../services/Produksi/productionStepsService";
import formatNumber from "../../utils/formatters/numberId";
import formatCurrency from "../../utils/formatters/currencyId";
import ProductionFilterCard from "../../components/Produksi/shared/ProductionFilterCard";
import ProductionPageHeader from "../../components/Produksi/shared/ProductionPageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import ProductionSummaryCards from "../../components/Produksi/shared/ProductionSummaryCards";

// =====================================================
// Formatter final lintas aplikasi
// ACTIVE / FINAL: karyawan produksi memakai helper shared untuk semua angka.
// =====================================================

// =====================================================
// Main Component
// =====================================================
const ProductionEmployees = () => {
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

  const loadData = async () => {
    try {
      setLoading(true);

      // =====================================================
      // ACTIVE / FINAL - DATA UTAMA KARYAWAN
      // Fungsi blok:
      // - memuat master karyawan produksi dari collection `production_employees`;
      // - langsung mengisi state `employees` ketika berhasil.
      // Alasan blok ini dipakai:
      // - data employee adalah data utama halaman, sehingga tidak boleh ikut kosong
      //   hanya karena query pendukung steps/payroll/worklogs terkena index Firestore.
      // Status:
      // - aktif dipakai; bukan legacy dan bukan kandidat cleanup.
      // =====================================================
      const employeeResult = await getAllProductionEmployees();
      setEmployees(Array.isArray(employeeResult) ? employeeResult : []);

      // =====================================================
      // ACTIVE / GUARDED - DATA PENDUKUNG HALAMAN
      // Fungsi blok:
      // - memuat tahapan, payroll, dan work log untuk filter/summary read-only;
      // - memakai Promise.allSettled agar satu query pendukung yang gagal karena
      //   composite index Firestore tidak menjatuhkan tabel karyawan.
      // Alasan blok ini dipakai:
      // - bug lama muncul karena Promise.all membuat `setEmployees()` tidak jalan
      //   saat salah satu query pendukung reject.
      // Status:
      // - aktif dipakai sebagai guard; bukan legacy.
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
      //   pendukung bisa belum lengkap karena query/index Firestore.
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
          )} belum lengkap. Cek index Firestore atau fallback query.`,
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
      // - aktif dipakai; bukan legacy.
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
  };

  useEffect(() => {
    loadData();
  }, []);

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



  const matchesEmployeePayrollLine = (employee = {}, payroll = {}) => {
    const employeeId = String(employee.id || "").trim();
    const employeeCode = String(employee.code || "").trim().toLowerCase();
    const employeeName = String(employee.name || "").trim().toLowerCase();
    const workerId = String(payroll.workerId || "").trim();
    const workerCode = String(payroll.workerCode || "").trim().toLowerCase();
    const workerName = String(payroll.workerName || "").trim().toLowerCase();

    if (employeeId && workerId && employeeId === workerId) return true;
    if (employeeCode && workerCode && employeeCode === workerCode) return true;
    return Boolean(employeeName && workerName && employeeName === workerName);
  };

  const matchesEmployeeWorkLog = (employee = {}, workLog = {}) => {
    const employeeId = String(employee.id || "").trim();
    const employeeCode = String(employee.code || "").trim().toLowerCase();
    const employeeName = String(employee.name || "").trim().toLowerCase();
    const workerIds = Array.isArray(workLog.workerIds)
      ? workLog.workerIds.map((item) => String(item || "").trim())
      : [];
    const workerCodes = Array.isArray(workLog.workerCodes)
      ? workLog.workerCodes.map((item) => String(item || "").trim().toLowerCase())
      : [];
    const workerNames = Array.isArray(workLog.workerNames)
      ? workLog.workerNames.map((item) => String(item || "").trim().toLowerCase())
      : [];

    if (employeeId && workerIds.includes(employeeId)) return true;
    if (employeeCode && workerCodes.includes(employeeCode)) return true;
    return Boolean(employeeName && workerNames.includes(employeeName));
  };

  // =====================================================
  // ACTIVE / FINAL
  // Ringkasan payroll per orang dibaca dari payroll final dan work log final.
  // Halaman karyawan tidak menjadi source of truth payroll baru.
  // =====================================================
  const employeeSummaryMap = useMemo(() => {
    return employees.reduce((acc, employee) => {
      const employeePayrolls = payrolls.filter((item) => matchesEmployeePayrollLine(employee, item));
      const employeeWorkLogs = workLogs.filter((item) => matchesEmployeeWorkLog(employee, item));
      const stepCounter = {};

      employeePayrolls.forEach((item) => {
        if (item.stepName) stepCounter[item.stepName] = (stepCounter[item.stepName] || 0) + 1;
      });
      employeeWorkLogs.forEach((item) => {
        if (item.stepName) stepCounter[item.stepName] = (stepCounter[item.stepName] || 0) + 1;
      });

      const favoriteStep = Object.entries(stepCounter).sort((left, right) => right[1] - left[1])[0]?.[0] || "-";
      const recentPayrolls = [...employeePayrolls].sort((left, right) => {
        const leftTime = new Date(left.payrollDate?.toDate?.() || left.payrollDate || 0).getTime() || 0;
        const rightTime = new Date(right.payrollDate?.toDate?.() || right.payrollDate || 0).getTime() || 0;
        return rightTime - leftTime;
      }).slice(0, 3);
      const recentWorkLogs = [...employeeWorkLogs].sort((left, right) => {
        const leftTime = new Date(left.completedAt?.toDate?.() || left.completedAt || left.workDate?.toDate?.() || left.workDate || 0).getTime() || 0;
        const rightTime = new Date(right.completedAt?.toDate?.() || right.completedAt || right.workDate?.toDate?.() || right.workDate || 0).getTime() || 0;
        return rightTime - leftTime;
      }).slice(0, 3);

      acc[employee.id] = {
        totalWorkLogs: employeeWorkLogs.length,
        totalPayrollLines: employeePayrolls.length,
        totalDraft: employeePayrolls.filter((item) => item.status === "draft").length,
        totalConfirmed: employeePayrolls.filter((item) => item.status === "confirmed").length,
        totalPaid: employeePayrolls.filter((item) => item.status === "paid").length,
        totalCancelled: employeePayrolls.filter((item) => item.status === "cancelled").length,
        totalPaidAmount: employeePayrolls
          .filter((item) => item.status === "paid" && item.paymentStatus === "paid")
          .reduce((sum, item) => sum + Number(item.finalAmount || 0), 0),
        totalConfirmedAmount: employeePayrolls
          .filter((item) => item.status === "confirmed")
          .reduce((sum, item) => sum + Number(item.finalAmount || 0), 0),
        favoriteStep,
        recentPayrolls,
        recentWorkLogs,
      };

      return acc;
    }, {});
  }, [employees, payrolls, workLogs]);

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
  // - aktif dipakai sebagai ringkasan operasional; bukan legacy dan bukan kandidat cleanup.
  // =====================================================
  const selectedEmployeeActivitySummary = useMemo(() => {
    if (!selectedEmployeeSummary) {
      return {
        totalWorkLogs: 0,
        payrollPending: 0,
        totalPaid: 0,
        totalPaidAmount: 0,
        recentPayrolls: [],
        recentWorkLogs: [],
      };
    }

    return {
      totalWorkLogs: selectedEmployeeSummary.totalWorkLogs || 0,
      payrollPending:
        Number(selectedEmployeeSummary.totalDraft || 0) +
        Number(selectedEmployeeSummary.totalConfirmed || 0),
      totalPaid: selectedEmployeeSummary.totalPaid || 0,
      totalPaidAmount: selectedEmployeeSummary.totalPaidAmount || 0,
      recentPayrolls: selectedEmployeeSummary.recentPayrolls || [],
      recentWorkLogs: selectedEmployeeSummary.recentWorkLogs || [],
    };
  }, [selectedEmployeeSummary]);

  // =====================================================
  // ACTIVE / UI DETAIL OPTIONAL SECTIONS
  // Fungsi blok:
  // - mendeteksi apakah info tambahan dan field legacy perlu ditampilkan di Collapse;
  // - field legacy tetap dibaca untuk audit, tetapi tidak ditampilkan sebagai fitur utama.
  // Alasan blok ini dipakai:
  // - payroll baru mengikuti Tahapan Produksi + Work Log completed, bukan custom payroll employee.
  // Status:
  // - aktif dipakai untuk UI detail; bagian payroll legacy adalah compatibility dan kandidat cleanup
  //   hanya jika data lama sudah diputuskan tidak dibutuhkan lagi.
  // =====================================================
  const hasValue = (value) => String(value || "").trim() !== "";

  const hasAdditionalEmployeeInfo = (employee = {}) => {
    return Boolean(
      hasValue(employee.gender) ||
        hasValue(employee.phone) ||
        hasValue(employee.address) ||
        (Array.isArray(employee.skillTags) && employee.skillTags.length > 0) ||
        hasValue(employee.notes),
    );
  };

  const hasLegacyPayrollInfo = (employee = {}) => {
    const customModeActive = employee.useCustomPayrollRate && hasValue(employee.customPayrollMode);
    const customOutputActive =
      employee.useCustomPayrollRate && hasValue(employee.customPayrollOutputBasis);
    const customQtyActive =
      employee.useCustomPayrollRate && Number(employee.customPayrollQtyBase || 0) > 0;

    return Boolean(
      employee.useCustomPayrollRate ||
        customModeActive ||
        Number(employee.customPayrollRate || 0) > 0 ||
        customQtyActive ||
        customOutputActive ||
        hasValue(employee.payrollNotes),
    );
  };

  const formatShortDate = (value) => {
    const rawDate = value?.toDate?.() || value;
    if (!rawDate) return "-";

    const parsedDate = new Date(rawDate);
    if (Number.isNaN(parsedDate.getTime())) return "-";

    return parsedDate.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const renderCompactInfo = (label, value) => (
    <Space direction="vertical" size={0} style={{ width: "100%" }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Typography.Text>
      <Typography.Text strong>{value || "-"}</Typography.Text>
    </Space>
  );

  const columns = [
    {
      title: "Kode",
      dataIndex: "code",
      key: "code",
      width: 140,
      render: (value) => (
        <Typography.Text strong>{value || "-"}</Typography.Text>
      ),
    },
    {
      title: "Nama",
      dataIndex: "name",
      key: "name",
      width: 220,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{record.name || "-"}</div>
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>
            {record.phone || "-"}
          </div>
        </div>
      ),
    },
    {
      title: "Jenis Kerja",
      dataIndex: "employmentType",
      key: "employmentType",
      width: 120,
      render: (value) => <Tag>{EMPLOYEE_TYPE_MAP[value] || "-"}</Tag>,
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      width: 120,
      render: (value) => (
        <Tag color="blue">{EMPLOYEE_ROLE_MAP[value] || "-"}</Tag>
      ),
    },
    {
      title: "Step Assignment",
      key: "assignedSteps",
      width: 280,
      render: (_, record) => {
        const stepNames = Array.isArray(record.assignedStepNames)
          ? record.assignedStepNames
          : [];

        if (stepNames.length === 0) {
          return <Typography.Text type="secondary">Belum ada</Typography.Text>;
        }

        return (
          <Space size={[4, 4]} wrap>
            {stepNames.slice(0, 3).map((item) => (
              <Tag key={item}>{item}</Tag>
            ))}
            {stepNames.length > 3 && <Tag>+{stepNames.length - 3} lainnya</Tag>}
          </Space>
        );
      },
    },
    {
      // =====================================================
      // SECTION: status sticky
      // Fungsi:
      // - menjaga status karyawan tetap terbaca pada tabel produksi yang lebar
      // =====================================================
      title: "Status",
      dataIndex: "isActive",
      key: "isActive",
      width: 124,
      align: "center",
      fixed: "right",
      className: "app-table-status-column app-table-fixed-secondary",
      render: (value) =>
        value ? (
          <Badge status="success" text="Aktif" />
        ) : (
          <Badge status="default" text="Nonaktif" />
        ),
    },
    {
      // =====================================================
      // SECTION: aksi sticky
      // =====================================================
      title: "Aksi",
      key: "actions",
      width: 220,
      fixed: "right",
      className: "app-table-action-column",
      render: (_, record) => (
        <Space wrap>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            Detail
          </Button>

          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>

          <Popconfirm
            title={
              record.isActive
                ? "Nonaktifkan karyawan ini?"
                : "Aktifkan karyawan ini?"
            }
            description={
              record.isActive
                ? "Karyawan tidak akan bisa dipilih untuk work log baru."
                : "Karyawan akan aktif kembali untuk work log baru."
            }
            onConfirm={() => handleToggleActive(record)}
            okText="Ya"
            cancelText="Batal"
          >
            <Button size="small">
              {record.isActive ? "Nonaktifkan" : "Aktifkan"}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

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
        description="Kelola master operator produksi yang dipakai oleh work log dan ringkasan payroll read-only."
        onRefresh={loadData}
        onAdd={handleAdd}
        addLabel="Tambah Karyawan"
      />

      <Alert
        showIcon
        type="info"
        style={{ marginBottom: 16 }}
        message="Karyawan Produksi = master operator + summary payroll read-only"
        description="Ringkasan payroll di halaman ini dibaca dari payroll final dan work log final. Pengaturan custom payroll karyawan tetap legacy dan tidak lagi menjadi source of truth payroll."
      />

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
        subtitle="Tabel ini tetap menjadi master operator. Ringkasan payroll dan work log hanya dibaca sebagai konteks operasional."
      >
        {/* ===============================================================
            Table helper global menjaga ukuran, sticky column, dan dark mode seragam.
        =============================================================== */}
        <Table
          className="app-data-table"
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredData}
          scroll={{ x: 1300 }}
          locale={{
            emptyText: <Empty description="Belum ada data karyawan produksi" />,
          }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
          }}
        />
      </PageSection>

      <Drawer
        title={
          editingEmployee?.id
            ? "Edit Karyawan Produksi"
            : "Tambah Karyawan Produksi"
        }
        open={formVisible}
        onClose={() => {
          setFormVisible(false);
          resetFormState();
        }}
        width={760}
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
            <Button
              type="primary"
              loading={submitting}
              disabled={!editingEmployee?.id && employeeCodeLoading}
              onClick={handleSubmit}
            >
              Simpan
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={DEFAULT_PRODUCTION_EMPLOYEE_FORM}
        >
          <Divider orientation="left">Informasi Dasar</Divider>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="Kode Karyawan"
                name="code"
                extra={
                  editingEmployee?.id
                    ? "Kode lama dipertahankan saat edit agar relasi Work Log/Payroll existing tetap aman."
                    : "Kode dibuat otomatis dengan format DDMMYYYY-XXX dan dikunci ulang saat simpan."
                }
                rules={[{ required: true, message: "Kode wajib digenerate" }]}
              >
                <Input
                  disabled
                  placeholder={
                    employeeCodeLoading ? "Membuat kode otomatis..." : "Contoh: 25042026-001"
                  }
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={16}>
              <Form.Item
                label="Nama Karyawan"
                name="name"
                rules={[{ required: true, message: "Nama wajib diisi" }]}
              >
                <Input placeholder="Contoh: Ani" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Gender" name="gender">
                <Select options={PRODUCTION_EMPLOYEE_GENDERS} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="No. HP" name="phone">
                <Input placeholder="08xxxxxxxxxx" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Status Aktif"
                name="isActive"
                valuePropName="checked"
              >
                <Switch disabled />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item label="Alamat" name="address">
                <Input.TextArea rows={2} placeholder="Alamat..." />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Informasi Kerja</Divider>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Jenis Kerja"
                name="employmentType"
                rules={[
                  { required: true, message: "Jenis kerja wajib dipilih" },
                ]}
              >
                <Select options={PRODUCTION_EMPLOYEE_EMPLOYMENT_TYPES} />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Role"
                name="role"
                rules={[{ required: true, message: "Role wajib dipilih" }]}
              >
                <Select options={PRODUCTION_EMPLOYEE_ROLES} />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item label="Skill Tags" name="skillTags">
                <Select
                  mode="tags"
                  placeholder="Contoh: potong, rakit, qc, senior"
                  tokenSeparators={[","]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Assignment Tahapan Produksi</Divider>

          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item
                label="Tahapan yang Bisa Dikerjakan"
                name="assignedStepIds"
              >
                <Select
                  mode="multiple"
                  placeholder="Pilih tahapan produksi..."
                  optionFilterProp="label"
                  options={stepOptions.map((step) => ({
                    value: step.id,
                    label: `${step.code} - ${step.name}`,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Payroll Preference (Legacy / Deprecated)</Divider>

          <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
            Payroll final sekarang mengikuti rule pada menu Tahapan Produksi. Pengaturan custom payroll karyawan di bawah ini dipertahankan hanya untuk kompatibilitas data lama dan tidak lagi dipakai untuk generate payroll baru.
          </Typography.Paragraph>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Gunakan Tarif Custom"
                name="useCustomPayrollRate"
                valuePropName="checked"
              >
                <Switch disabled />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const useCustomPayrollRate = getFieldValue(
                "useCustomPayrollRate",
              );

              return (
                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <Form.Item
                      label="Mode Payroll Custom (Legacy)"
                      name="customPayrollMode"
                      rules={
                        useCustomPayrollRate
                          ? [
                              {
                                required: true,
                                message: "Mode payroll custom wajib dipilih",
                              },
                            ]
                          : []
                      }
                    >
                      <Select
                        options={PRODUCTION_EMPLOYEE_CUSTOM_PAYROLL_MODES}
                        disabled
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={8}>
                    <Form.Item label="Tarif Custom (Legacy)" name="customPayrollRate">
                      <InputNumber
                        min={0}
                        style={{ width: "100%" }}
                        disabled
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={8}>
                    <Form.Item
                      noStyle
                      shouldUpdate={(prev, next) =>
                        prev.customPayrollMode !== next.customPayrollMode ||
                        prev.useCustomPayrollRate !== next.useCustomPayrollRate
                      }
                    >
                      {({ getFieldValue }) => {
                        const customMode = getFieldValue("customPayrollMode");
                        const disabled =
                          !getFieldValue("useCustomPayrollRate") ||
                          customMode !== "per_qty";

                        return (
                          <Form.Item
                            label="Basis Qty Custom (Legacy)"
                            name="customPayrollQtyBase"
                            rules={
                              disabled
                                ? []
                                : [
                                    {
                                      required: true,
                                      message: "Basis qty custom wajib diisi",
                                    },
                                  ]
                            }
                          >
                            <InputNumber
                              min={1}
                              style={{ width: "100%" }}
                              disabled
                            />
                          </Form.Item>
                        );
                      }}
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      noStyle
                      shouldUpdate={(prev, next) =>
                        prev.customPayrollMode !== next.customPayrollMode ||
                        prev.useCustomPayrollRate !== next.useCustomPayrollRate
                      }
                    >
                      {({ getFieldValue }) => {
                        const customMode = getFieldValue("customPayrollMode");
                        const disabled =
                          !getFieldValue("useCustomPayrollRate") ||
                          customMode !== "per_qty";

                        return (
                          <Form.Item
                            label="Basis Output Payroll Custom (Legacy)"
                            name="customPayrollOutputBasis"
                            rules={
                              disabled
                                ? []
                                : [
                                    {
                                      required: true,
                                      message: "Basis output wajib dipilih",
                                    },
                                  ]
                            }
                          >
                            <Select
                              options={PRODUCTION_EMPLOYEE_PAYROLL_OUTPUT_BASIS}
                              disabled
                            />
                          </Form.Item>
                        );
                      }}
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item shouldUpdate noStyle>
                      {({ getFieldsValue }) => {
                        const values = getFieldsValue();
                        const preview = formatEmployeePayrollPreview(values);

                        return (
                          <Form.Item label="Preview Payroll">
                            <Card size="small">
                              <Typography.Text>{preview}</Typography.Text>
                            </Card>
                          </Form.Item>
                        );
                      }}
                    </Form.Item>
                  </Col>

                  <Col xs={24}>
                    <Form.Item label="Catatan Payroll (Legacy)" name="payrollNotes">
                      <Input.TextArea
                        rows={2}
                        placeholder="Catatan payroll khusus karyawan..."
                        disabled
                      />
                    </Form.Item>
                  </Col>
                </Row>
              );
            }}
          </Form.Item>

          <Divider orientation="left">Catatan Tambahan</Divider>

          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item label="Catatan Internal" name="notes">
                <Input.TextArea rows={3} placeholder="Catatan internal..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Drawer>

      <Drawer
        title="Detail Karyawan Produksi"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={760}
      >
        {!selectedEmployee ? (
          <Empty description="Tidak ada data" />
        ) : (
          <>
            {/* =====================================================
                ACTIVE / READ-ONLY COMPACT DETAIL
                Fungsi blok:
                - merapikan drawer Detail Karyawan Produksi menjadi ringkasan operasional;
                - hanya menampilkan info utama, assignment, ringkasan aktivitas, histori singkat,
                  info tambahan, dan legacy payroll dalam Collapse.
                Alasan blok ini dipakai:
                - detail lama terlalu panjang karena help text per field, tabel besar, dan payroll
                  legacy tampil terbuka seperti fitur utama.
                Status:
                - aktif dipakai untuk UI detail; tidak menulis data dan bukan refactor flow bisnis.
            ===================================================== */}
            <Alert
              showIcon
              type="info"
              style={{ marginBottom: 16 }}
              message="Karyawan Produksi dipakai sebagai operator Work Log dan referensi payroll produksi."
            />

            <Card size="small" title="Ringkasan Karyawan" style={{ marginBottom: 16 }}>
              <Row gutter={[12, 12]}>
                <Col xs={24} md={12}>
                  {renderCompactInfo("Kode", selectedEmployee.code)}
                </Col>
                <Col xs={24} md={12}>
                  {renderCompactInfo("Nama", selectedEmployee.name)}
                </Col>
                <Col xs={12} md={6}>
                  <Space direction="vertical" size={0}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Status
                    </Typography.Text>
                    <Tag color={selectedEmployee.isActive ? "green" : "default"}>
                      {selectedEmployee.isActive ? "Aktif" : "Nonaktif"}
                    </Tag>
                  </Space>
                </Col>
                <Col xs={12} md={6}>
                  {renderCompactInfo(
                    "Jenis Kerja",
                    EMPLOYEE_TYPE_MAP[selectedEmployee.employmentType],
                  )}
                </Col>
                <Col xs={12} md={6}>
                  {renderCompactInfo("Role", EMPLOYEE_ROLE_MAP[selectedEmployee.role])}
                </Col>
                {selectedEmployee.phone ? (
                  <Col xs={12} md={6}>
                    {renderCompactInfo("No. HP", selectedEmployee.phone)}
                  </Col>
                ) : null}
              </Row>
            </Card>

            {/* =====================================================
                ACTIVE / ASSIGNMENT COMPACT
                Fungsi blok:
                - menampilkan assignment tahapan sebagai tag kecil;
                - tidak mengubah assignedStepIds/Names/Codes agar relasi Work Log tetap aman.
                Alasan blok ini dipakai:
                - assignment adalah info penting produksi, tetapi detail lama terlalu ramai dengan help text.
                Status:
                - aktif dipakai; bukan legacy.
            ===================================================== */}
            <Card size="small" title="Assignment Produksi" style={{ marginBottom: 16 }}>
              {Array.isArray(selectedEmployee.assignedStepNames) &&
              selectedEmployee.assignedStepNames.length > 0 ? (
                <Space size={[4, 4]} wrap>
                  {selectedEmployee.assignedStepNames.map((item) => (
                    <Tag key={item}>{item}</Tag>
                  ))}
                </Space>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Belum ada tahapan assignment."
                />
              )}
            </Card>

            {/* =====================================================
                ACTIVE / READ-ONLY ACTIVITY SUMMARY
                Fungsi blok:
                - menampilkan ringkasan Work Log dan Payroll secara compact;
                - data dibaca dari transaksi final, tanpa kalkulasi ulang payroll.
                Alasan blok ini dipakai:
                - user butuh ringkasan cepat, bukan tabel panjang di drawer detail.
                Status:
                - aktif dipakai; bukan legacy.
            ===================================================== */}
            <Card size="small" title="Ringkasan Work Log & Payroll" style={{ marginBottom: 16 }}>
              <Row gutter={[12, 12]}>
                <Col xs={12} md={6}>
                  <Statistic
                    title="Total Work Log"
                    value={selectedEmployeeActivitySummary.totalWorkLogs}
                  />
                </Col>
                <Col xs={12} md={6}>
                  <Statistic
                    title="Payroll Pending / Draft"
                    value={selectedEmployeeActivitySummary.payrollPending}
                  />
                </Col>
                <Col xs={12} md={6}>
                  <Statistic
                    title="Paid"
                    value={selectedEmployeeActivitySummary.totalPaid}
                  />
                </Col>
                <Col xs={12} md={6}>
                  <Statistic
                    title="Total Paid"
                    value={formatCurrency(selectedEmployeeActivitySummary.totalPaidAmount)}
                  />
                </Col>
              </Row>

              {selectedEmployeeSummary?.totalPayrollLines ? null : (
                <Typography.Text type="secondary" style={{ display: "block", marginTop: 12 }}>
                  Belum ada payroll untuk operator ini.
                </Typography.Text>
              )}
            </Card>

            {/* =====================================================
                ACTIVE / COMPACT HISTORY
                Fungsi blok:
                - menampilkan maksimal 3 Work Log dan 3 Payroll terakhir;
                - mengganti tabel detail lama agar drawer tidak horizontal scroll.
                Alasan blok ini dipakai:
                - histori lengkap tetap ada di menu Work Log Produksi dan Payroll Produksi.
                Status:
                - aktif dipakai; bukan legacy.
            ===================================================== */}
            <Card size="small" title="Histori Singkat" style={{ marginBottom: 16 }}>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <Typography.Text strong>Work Log Terakhir</Typography.Text>
                  <Space direction="vertical" size={8} style={{ width: "100%", marginTop: 8 }}>
                    {selectedEmployeeActivitySummary.recentWorkLogs.length > 0 ? (
                      selectedEmployeeActivitySummary.recentWorkLogs.map((item) => (
                        <Card key={item.id} size="small" bodyStyle={{ padding: 10 }}>
                          <Space direction="vertical" size={2} style={{ width: "100%" }}>
                            <Typography.Text strong>{item.workNumber || "-"}</Typography.Text>
                            <Typography.Text type="secondary">
                              {item.stepName || "-"} · {formatShortDate(item.completedAt || item.workDate)}
                            </Typography.Text>
                            <Space size={[4, 4]} wrap>
                              <Tag>{item.status || "-"}</Tag>
                              <Tag>Good Qty: {formatNumber(item.goodQty || 0)}</Tag>
                            </Space>
                          </Space>
                        </Card>
                      ))
                    ) : (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Belum ada Work Log untuk operator ini."
                      />
                    )}
                  </Space>
                </Col>

                <Col xs={24} md={12}>
                  <Typography.Text strong>Payroll Terakhir</Typography.Text>
                  <Space direction="vertical" size={8} style={{ width: "100%", marginTop: 8 }}>
                    {selectedEmployeeActivitySummary.recentPayrolls.length > 0 ? (
                      selectedEmployeeActivitySummary.recentPayrolls.map((item) => (
                        <Card key={item.id} size="small" bodyStyle={{ padding: 10 }}>
                          <Space direction="vertical" size={2} style={{ width: "100%" }}>
                            <Typography.Text strong>{item.payrollNumber || "-"}</Typography.Text>
                            <Typography.Text type="secondary">
                              {item.stepName || "-"} · {formatShortDate(item.payrollDate)}
                            </Typography.Text>
                            <Space size={[4, 4]} wrap>
                              <Tag>{item.status || "-"}</Tag>
                              <Tag>{formatCurrency(item.finalAmount || 0)}</Tag>
                            </Space>
                          </Space>
                        </Card>
                      ))
                    ) : (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Belum ada line payroll untuk operator ini."
                      />
                    )}
                  </Space>
                </Col>
              </Row>

              <Typography.Text type="secondary" style={{ display: "block", marginTop: 12 }}>
                Untuk histori lengkap, buka menu Work Log Produksi atau Payroll Produksi.
              </Typography.Text>
            </Card>

            {hasAdditionalEmployeeInfo(selectedEmployee) ? (
              <Collapse size="small" style={{ marginBottom: 16 }}>
                <Collapse.Panel header="Info Tambahan" key="additional-info">
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Gender">
                      {EMPLOYEE_GENDER_MAP[selectedEmployee.gender] || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="No. HP">
                      {selectedEmployee.phone || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Alamat">
                      <Typography.Paragraph
                        ellipsis={{ rows: 2, expandable: true, symbol: "Lihat lengkap" }}
                        style={{ marginBottom: 0 }}
                      >
                        {selectedEmployee.address || "-"}
                      </Typography.Paragraph>
                    </Descriptions.Item>
                    <Descriptions.Item label="Skill Tags">
                      {Array.isArray(selectedEmployee.skillTags) &&
                      selectedEmployee.skillTags.length > 0 ? (
                        <Space size={[4, 4]} wrap>
                          {selectedEmployee.skillTags.map((item) => (
                            <Tag key={item}>{item}</Tag>
                          ))}
                        </Space>
                      ) : (
                        "-"
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Catatan Internal">
                      <Typography.Paragraph
                        ellipsis={{ rows: 2, expandable: true, symbol: "Lihat lengkap" }}
                        style={{ marginBottom: 0 }}
                      >
                        {selectedEmployee.notes || "-"}
                      </Typography.Paragraph>
                    </Descriptions.Item>
                  </Descriptions>
                </Collapse.Panel>
              </Collapse>
            ) : null}

            {hasLegacyPayrollInfo(selectedEmployee) ? (
              <Collapse size="small">
                <Collapse.Panel header="Data Legacy / Kompatibilitas" key="legacy-payroll">
                  {/* =====================================================
                      LEGACY / COMPATIBILITY ONLY
                      Fungsi blok:
                      - tetap menyediakan audit field payroll legacy tanpa menjadikannya fitur utama;
                      - tidak menghapus field lama dari Firestore.
                      Alasan blok ini dipakai:
                      - source payroll baru mengikuti Tahapan Produksi dan Work Log completed.
                      Status:
                      - legacy/compatibility; kandidat cleanup hanya setelah keputusan migrasi data lama.
                  ===================================================== */}
                  <Alert
                    showIcon
                    type="warning"
                    style={{ marginBottom: 12 }}
                    message="Legacy, tidak dipakai untuk payroll baru."
                    description="Data ini dipertahankan untuk kompatibilitas data lama. Payroll baru mengikuti Tahapan Produksi dan Work Log completed."
                  />
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Gunakan Tarif Custom">
                      {selectedEmployee.useCustomPayrollRate ? "Ya" : "Tidak"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Mode Payroll Custom">
                      {EMPLOYEE_PAYROLL_MODE_MAP[selectedEmployee.customPayrollMode] || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Tarif Custom">
                      {selectedEmployee.useCustomPayrollRate
                        ? formatCurrency(selectedEmployee.customPayrollRate)
                        : "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Basis Qty Custom">
                      {selectedEmployee.useCustomPayrollRate
                        ? formatNumber(selectedEmployee.customPayrollQtyBase)
                        : "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Basis Output Payroll">
                      {EMPLOYEE_PAYROLL_OUTPUT_BASIS_MAP[
                        selectedEmployee.customPayrollOutputBasis
                      ] || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Preview / Status Legacy">
                      {formatEmployeePayrollPreview(selectedEmployee)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Catatan Payroll Legacy">
                      {selectedEmployee.payrollNotes || "-"}
                    </Descriptions.Item>
                  </Descriptions>
                </Collapse.Panel>
              </Collapse>
            ) : null}
          </>
        )}
      </Drawer>
    </div>
  );
};

export default ProductionEmployees;
