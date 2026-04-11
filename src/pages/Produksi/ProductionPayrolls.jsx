// =====================================================
// Page: Payroll Produksi
// Draft payroll diambil dari work log completed
// =====================================================

import React, { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
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
import dayjs from "dayjs";
import {
  DEFAULT_PRODUCTION_PAYROLL_FORM,
  PAYROLL_PAYMENT_STATUS_MAP,
  PAYROLL_STATUS_MAP,
} from "../../constants/productionPayrollOptions";
import {
  buildPayrollDraftFromWorkLog,
  createProductionPayroll,
  getAllProductionPayrolls,
  getPayrollReferenceData,
  updatePayrollStatus,
  updateProductionPayroll,
} from "../../services/Produksi/productionPayrollsService";

const formatNumber = (value) =>
  new Intl.NumberFormat("id-ID").format(Number(value || 0));

const formatCurrency = (value) =>
  `Rp${new Intl.NumberFormat("id-ID").format(Number(value || 0))}`;

const ProductionPayrolls = () => {
  const [loading, setLoading] = useState(false);
  const [payrolls, setPayrolls] = useState([]);
  const [referenceData, setReferenceData] = useState({
    completedWorkLogs: [],
    employees: [],
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [formVisible, setFormVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [editingRecord, setEditingRecord] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const [form] = Form.useForm();

  const loadData = async () => {
    try {
      setLoading(true);
      const [payrollResult, refResult] = await Promise.all([
        getAllProductionPayrolls(),
        getPayrollReferenceData(),
      ]);

      setPayrolls(payrollResult);
      setReferenceData(refResult);
    } catch (error) {
      console.error(error);
      message.error("Gagal memuat payroll produksi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const summary = useMemo(() => {
    const total = payrolls.length;
    const paid = payrolls.filter(
      (item) => item.paymentStatus === "paid",
    ).length;
    const unpaid = payrolls.filter(
      (item) => item.paymentStatus === "unpaid",
    ).length;
    const totalAmount = payrolls.reduce(
      (sum, item) => sum + Number(item.finalAmount || 0),
      0,
    );

    return { total, paid, unpaid, totalAmount };
  }, [payrolls]);

  const filteredData = useMemo(() => {
    return payrolls.filter((item) => {
      const searchText = search.trim().toLowerCase();

      const matchSearch =
        !searchText ||
        String(item.payrollNumber || "")
          .toLowerCase()
          .includes(searchText) ||
        String(item.workerName || "")
          .toLowerCase()
          .includes(searchText) ||
        String(item.workNumber || "")
          .toLowerCase()
          .includes(searchText);

      const matchStatus =
        statusFilter === "all" || item.paymentStatus === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [payrolls, search, statusFilter]);

  const resetFormState = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({
      ...DEFAULT_PRODUCTION_PAYROLL_FORM,
      payrollDate: dayjs(),
    });
  };

  const handleAdd = () => {
    setEditingRecord(null);
    form.setFieldsValue({
      ...DEFAULT_PRODUCTION_PAYROLL_FORM,
      payrollDate: dayjs(),
    });
    setFormVisible(true);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...DEFAULT_PRODUCTION_PAYROLL_FORM,
      ...record,
      payrollDate: record.payrollDate
        ? dayjs(record.payrollDate?.toDate?.() || record.payrollDate)
        : null,
    });
    setFormVisible(true);
  };

  const handleViewDetail = (record) => {
    setSelectedRecord(record);
    setDetailVisible(true);
  };

  const handleGenerateFromWorkLog = (workLogId) => {
    const workLog = referenceData.completedWorkLogs.find(
      (item) => item.id === workLogId,
    );
    if (!workLog) return;

    const employee =
      referenceData.employees.find(
        (item) => item.id === workLog.workerIds?.[0],
      ) || null;

    const draft = buildPayrollDraftFromWorkLog(workLog, employee);

    form.setFieldsValue({
      ...form.getFieldsValue(),
      ...draft,
    });

    message.success("Draft payroll berhasil dibuat dari work log");
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      setSubmitting(true);

      const payload = {
        ...values,
        payrollDate: values.payrollDate ? values.payrollDate.toDate() : null,
      };

      if (editingRecord?.id) {
        await updateProductionPayroll(editingRecord.id, payload, null);
        message.success("Payroll produksi berhasil diperbarui");
      } else {
        await createProductionPayroll(payload, null);
        message.success("Payroll produksi berhasil ditambahkan");
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
      message.error("Gagal menyimpan payroll produksi");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkPaid = async (record) => {
    try {
      await updatePayrollStatus(record.id, "paid", "paid", {
        paidAt: new Date(),
      });
      message.success("Payroll ditandai paid");
      await loadData();
    } catch (error) {
      console.error(error);
      message.error("Gagal mengubah status payroll");
    }
  };

  const workLogOptions = referenceData.completedWorkLogs.map((item) => ({
    value: item.id,
    label: `${item.workNumber || "-"} - ${item.targetName || "-"} - ${item.stepName || "-"}`,
  }));

  const employeeOptions = referenceData.employees.map((item) => ({
    value: item.id,
    label: `${item.code || "-"} - ${item.name || "-"}`,
    raw: item,
  }));

  const columns = [
    {
      title: "No. Payroll",
      dataIndex: "payrollNumber",
      key: "payrollNumber",
      width: 160,
      render: (value) => (
        <Typography.Text strong>{value || "-"}</Typography.Text>
      ),
    },
    {
      title: "Tanggal",
      dataIndex: "payrollDate",
      key: "payrollDate",
      width: 130,
      render: (value) => {
        const date = value?.toDate ? value.toDate() : value;
        return date ? dayjs(date).format("DD/MM/YYYY") : "-";
      },
    },
    {
      title: "Karyawan / Work Log",
      key: "workerWorkLog",
      width: 260,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{record.workerName || "-"}</div>
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>
            {record.workNumber || "-"}
          </div>
        </div>
      ),
    },
    {
      title: "Step",
      dataIndex: "stepName",
      key: "stepName",
      width: 160,
    },
    {
      title: "Final Amount",
      dataIndex: "finalAmount",
      key: "finalAmount",
      width: 150,
      render: (value) => formatCurrency(value),
    },
    {
      title: "Status",
      key: "status",
      width: 140,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Tag color="blue">{PAYROLL_STATUS_MAP[record.status] || "-"}</Tag>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {PAYROLL_PAYMENT_STATUS_MAP[record.paymentStatus] || "-"}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Aksi",
      key: "actions",
      width: 240,
      fixed: "right",
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
            disabled={record.paymentStatus === "paid"}
          >
            Edit
          </Button>

          {record.paymentStatus !== "paid" && (
            <Popconfirm
              title="Tandai payroll ini paid?"
              onConfirm={() => handleMarkPaid(record)}
              okText="Ya"
              cancelText="Batal"
            >
              <Button size="small" type="primary">
                Paid
              </Button>
            </Popconfirm>
          )}
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
              Payroll Produksi
            </Typography.Title>
            <Typography.Text type="secondary">
              Rekap gaji produksi berbasis work log completed
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
                Tambah Payroll
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Total Payroll" value={summary.total} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Sudah Dibayar" value={summary.paid} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Belum Dibayar" value={summary.unpaid} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Nilai Payroll"
              value={summary.totalAmount}
              formatter={(value) => formatCurrency(value)}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={12}>
            <Input
              placeholder="Cari nomor payroll, karyawan, work log..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} md={12}>
            <Select
              style={{ width: "100%" }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "Semua Payment Status" },
                { value: "unpaid", label: "Unpaid" },
                { value: "partial", label: "Partial" },
                { value: "paid", label: "Paid" },
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
          scroll={{ x: 1300 }}
          locale={{
            emptyText: <Empty description="Belum ada payroll produksi" />,
          }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
          }}
        />
      </Card>

      <Drawer
        title={
          editingRecord?.id
            ? "Edit Payroll Produksi"
            : "Tambah Payroll Produksi"
        }
        open={formVisible}
        onClose={() => {
          setFormVisible(false);
          resetFormState();
        }}
        width={860}
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
          initialValues={{
            ...DEFAULT_PRODUCTION_PAYROLL_FORM,
            payrollDate: dayjs(),
          }}
        >
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="No. Payroll"
                name="payrollNumber"
                rules={[{ required: true, message: "No. payroll wajib diisi" }]}
              >
                <Input placeholder="Contoh: PAY-20260405-001" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="Tanggal Payroll"
                name="payrollDate"
                rules={[
                  { required: true, message: "Tanggal payroll wajib diisi" },
                ]}
              >
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Typography.Text type="secondary">
                Draft payroll disarankan diambil dari work log completed.
              </Typography.Text>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={16}>
              <Select
                style={{ width: "100%", marginBottom: 16 }}
                showSearch
                optionFilterProp="label"
                placeholder="Pilih work log completed untuk generate draft payroll..."
                options={workLogOptions}
                onChange={handleGenerateFromWorkLog}
              />
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Work Log"
                name="workLogId"
                rules={[{ required: true, message: "Work log wajib dipilih" }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={workLogOptions}
                  placeholder="Pilih work log..."
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Karyawan" name="workerId">
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={employeeOptions}
                  placeholder="Pilih karyawan..."
                  onChange={(value) => {
                    const employee = referenceData.employees.find(
                      (item) => item.id === value,
                    );
                    form.setFieldsValue({
                      workerCode: employee?.code || "",
                      workerName: employee?.name || "",
                    });
                  }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item label="Payroll Mode" name="payrollMode">
                <Select
                  options={[
                    { value: "per_qty", label: "Per Qty" },
                    { value: "per_batch", label: "Per Batch" },
                    { value: "fixed", label: "Fixed" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label="Payroll Rate" name="payrollRate">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label="Payroll Qty Base" name="payrollQtyBase">
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label="Output Qty Used" name="outputQtyUsed">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={4}>
              <Form.Item label="Bonus" name="bonusAmount">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={4}>
              <Form.Item label="Potongan" name="deductionAmount">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={4}>
              <Form.Item label="Worked Qty" name="workedQty">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={4}>
              <Form.Item label="Team Worker Count" name="teamWorkerCount">
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item shouldUpdate noStyle>
                {({ getFieldsValue }) => {
                  const values = getFieldsValue();
                  const rate = Number(values.payrollRate || 0);
                  const qtyBase = Number(values.payrollQtyBase || 1);
                  const outputQtyUsed = Number(values.outputQtyUsed || 0);
                  const bonus = Number(values.bonusAmount || 0);
                  const deduction = Number(values.deductionAmount || 0);

                  let amountCalculated = 0;

                  if (
                    values.payrollMode === "fixed" ||
                    values.payrollMode === "per_batch"
                  ) {
                    amountCalculated = rate;
                  } else {
                    amountCalculated =
                      qtyBase > 0 ? (outputQtyUsed / qtyBase) * rate : 0;
                  }

                  const finalAmount = amountCalculated + bonus - deduction;

                  return (
                    <Form.Item label="Preview Final Amount">
                      <Input value={formatCurrency(finalAmount)} disabled />
                    </Form.Item>
                  );
                }}
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item label="Catatan Perhitungan" name="calculationNotes">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item label="Catatan Internal" name="notes">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Drawer>

      <Drawer
        title="Detail Payroll Produksi"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={620}
      >
        {!selectedRecord ? (
          <Empty description="Tidak ada data" />
        ) : (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="No. Payroll">
              {selectedRecord.payrollNumber || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Tanggal">
              {selectedRecord.payrollDate
                ? dayjs(
                    selectedRecord.payrollDate?.toDate
                      ? selectedRecord.payrollDate.toDate()
                      : selectedRecord.payrollDate,
                  ).format("DD/MM/YYYY")
                : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Karyawan">
              {selectedRecord.workerName || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Work Log">
              {selectedRecord.workNumber || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Target">
              {selectedRecord.targetName || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Step">
              {selectedRecord.stepName || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Mode">
              {selectedRecord.payrollMode || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Rate">
              {formatCurrency(selectedRecord.payrollRate)}
            </Descriptions.Item>
            <Descriptions.Item label="Output Qty Used">
              {formatNumber(selectedRecord.outputQtyUsed)}
            </Descriptions.Item>
            <Descriptions.Item label="Amount Calculated">
              {formatCurrency(selectedRecord.amountCalculated)}
            </Descriptions.Item>
            <Descriptions.Item label="Final Amount">
              {formatCurrency(selectedRecord.finalAmount)}
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              {PAYROLL_STATUS_MAP[selectedRecord.status] || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Payment Status">
              {PAYROLL_PAYMENT_STATUS_MAP[selectedRecord.paymentStatus] || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Catatan">
              {selectedRecord.notes || "-"}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};

export default ProductionPayrolls;
