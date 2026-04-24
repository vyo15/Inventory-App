// =====================================================
// Page: Karyawan Produksi
// Master operator/karyawan produksi
// =====================================================

import React, { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Col,
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
  toggleProductionEmployeeActive,
  updateProductionEmployee,
} from "../../services/Produksi/productionEmployeesService";
import { getActiveProductionSteps } from "../../services/Produksi/productionStepsService";
import formatNumber from "../../utils/formatters/numberId";
import formatCurrency from "../../utils/formatters/currencyId";

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

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");

  const [formVisible, setFormVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);

  const [form] = Form.useForm();

  const loadData = async () => {
    try {
      setLoading(true);
      const [employeeResult, stepResult] = await Promise.all([
        getAllProductionEmployees(),
        getActiveProductionSteps(),
      ]);

      setEmployees(employeeResult);
      setStepOptions(stepResult);
    } catch (error) {
      console.error(error);
      message.error("Gagal memuat data karyawan produksi");
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
    form.resetFields();
    form.setFieldsValue(DEFAULT_PRODUCTION_EMPLOYEE_FORM);
  };

  const handleAdd = () => {
    setEditingEmployee(null);
    form.setFieldsValue(DEFAULT_PRODUCTION_EMPLOYEE_FORM);
    setFormVisible(true);
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
        await createProductionEmployee(values, selectedSteps, null);
        message.success("Karyawan produksi berhasil ditambahkan");
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

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Typography.Title level={3} style={{ margin: 0 }}>
              Karyawan Produksi
            </Typography.Title>
            <Typography.Text type="secondary">
              Master operator produksi untuk work log dan payroll
            </Typography.Text>
          </Col>

          <Col>
            <Space wrap>
              <Button icon={<ReloadOutlined />} onClick={loadData}>
                Refresh
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
              >
                Tambah Karyawan
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Total Karyawan" value={summary.total} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Karyawan Aktif" value={summary.active} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Karyawan Nonaktif" value={summary.inactive} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Sudah Assign Step" value={summary.assigned} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
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
        </Row>
      </Card>

      <Card>
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
      </Card>

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
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
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
                rules={[{ required: true, message: "Kode wajib diisi" }]}
              >
                <Input placeholder="Contoh: EMP-ANI" />
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
        width={620}
      >
        {!selectedEmployee ? (
          <Empty description="Tidak ada data" />
        ) : (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Kode">
              {selectedEmployee.code || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Nama">
              {selectedEmployee.name || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Gender">
              {EMPLOYEE_GENDER_MAP[selectedEmployee.gender] || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="No. HP">
              {selectedEmployee.phone || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Alamat">
              {selectedEmployee.address || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Jenis Kerja">
              {EMPLOYEE_TYPE_MAP[selectedEmployee.employmentType] || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Role">
              {EMPLOYEE_ROLE_MAP[selectedEmployee.role] || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Tahapan Assignment">
              {Array.isArray(selectedEmployee.assignedStepNames) &&
              selectedEmployee.assignedStepNames.length > 0 ? (
                <Space size={[4, 4]} wrap>
                  {selectedEmployee.assignedStepNames.map((item) => (
                    <Tag key={item}>{item}</Tag>
                  ))}
                </Space>
              ) : (
                "-"
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Gunakan Tarif Custom (Legacy)">
              {selectedEmployee.useCustomPayrollRate ? "Ya" : "Tidak"}
            </Descriptions.Item>
            <Descriptions.Item label="Mode Payroll Custom (Legacy)">
              {EMPLOYEE_PAYROLL_MODE_MAP[selectedEmployee.customPayrollMode] ||
                "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Tarif Custom (Legacy)">
              {selectedEmployee.useCustomPayrollRate
                ? formatCurrency(selectedEmployee.customPayrollRate)
                : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Basis Qty Custom (Legacy)">
              {selectedEmployee.useCustomPayrollRate
                ? formatNumber(selectedEmployee.customPayrollQtyBase)
                : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Basis Output Payroll (Legacy)">
              {EMPLOYEE_PAYROLL_OUTPUT_BASIS_MAP[
                selectedEmployee.customPayrollOutputBasis
              ] || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Preview Payroll / Status">
              {formatEmployeePayrollPreview(selectedEmployee)}
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
            <Descriptions.Item label="Catatan Payroll">
              {selectedEmployee.payrollNotes || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Catatan Internal">
              {selectedEmployee.notes || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              {selectedEmployee.isActive ? "Aktif" : "Nonaktif"}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};

export default ProductionEmployees;
