// =====================================================
// Page: Payroll Produksi
//
// ACTIVE / GUARDED
// Payroll final wajib dibuat dari Work Log completed dengan rule payroll
// per step sebagai source of truth.
//
// LEGACY / DEPRECATED
// Pemilihan payroll dari tarif custom karyawan tidak lagi menjadi jalur aktif.
// =====================================================

import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
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
  ReloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  DEFAULT_PRODUCTION_PAYROLL_FORM,
  PAYROLL_CLASSIFICATION_MAP,
  PAYROLL_MODE_MAP,
  PAYROLL_OUTPUT_BASIS_MAP,
  PAYROLL_PAYMENT_STATUS_MAP,
  PAYROLL_STATUS_MAP,
  calculatePayrollAmounts,
} from "../../constants/productionPayrollOptions";
import {
  formatPayrollRuleSourceLabel,
  getAllProductionPayrolls,
  getPayrollReferenceData,
  updatePayrollStatus,
  updateProductionPayroll,
} from "../../services/Produksi/productionPayrollsService";
import { formatPayrollEligibilityStatusLabel } from "../../utils/produksi/productionPayrollRuleHelpers";
import formatNumber from "../../utils/formatters/numberId";
import formatCurrency from "../../utils/formatters/currencyId";

// =====================================================
// Formatter final lintas aplikasi
// ACTIVE / FINAL: payroll produksi memakai helper shared agar nilai dan qty
// konsisten dengan modul produksi/laporan lain.
// =====================================================

const formatDate = (value) => {
  const date = value?.toDate ? value.toDate() : value;
  return date ? dayjs(date).format("DD/MM/YYYY") : "-";
};

const renderReasonList = (reasons = []) => {
  const normalizedReasons = Array.isArray(reasons) ? reasons.filter(Boolean) : [];
  if (normalizedReasons.length === 0) {
    return null;
  }

  return (
    <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
      {normalizedReasons.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
};

const ProductionPayrolls = () => {
  const [loading, setLoading] = useState(false);
  const [payrolls, setPayrolls] = useState([]);
  const [referenceData, setReferenceData] = useState({
    completedWorkLogs: [],
    blockedCompletedWorkLogs: [],
    payrollReadinessSummary: { eligibleCount: 0, blockedCount: 0 },
    productionSteps: [],
    autoDraftSummary: {
      affectedWorkLogCount: 0,
      createdLineCount: 0,
      blockedWorkLogCount: 0,
    },
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

      // =====================================================
      // ACTIVE / FINAL
      // Menu Payroll sekarang me-reload reference setelah auto-create draft
      // completed Work Log. Urutan load dibuat serial agar daftar payroll yang
      // ditampilkan selalu sudah termasuk draft otomatis terbaru.
      // =====================================================
      const refResult = await getPayrollReferenceData();
      const payrollResult = await getAllProductionPayrolls();

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
    const paid = payrolls.filter((item) => item.paymentStatus === "paid").length;
    const unpaid = payrolls.filter((item) => item.paymentStatus === "unpaid").length;
    const confirmed = payrolls.filter((item) => item.status === "confirmed").length;
    const totalAmount = payrolls.reduce(
      (sum, item) => sum + Number(item.finalAmount || 0),
      0,
    );

    return { total, paid, unpaid, confirmed, totalAmount };
  }, [payrolls]);

  const filteredData = useMemo(() => {
    return payrolls.filter((item) => {
      const searchText = search.trim().toLowerCase();

      const matchSearch =
        !searchText ||
        String(item.payrollNumber || "").toLowerCase().includes(searchText) ||
        String(item.workerName || "").toLowerCase().includes(searchText) ||
        String(item.workNumber || "").toLowerCase().includes(searchText) ||
        String(item.stepName || "").toLowerCase().includes(searchText);

      const matchStatus =
        statusFilter === "all" || item.status === statusFilter;

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


  const handleSubmit = async () => {
    try {
      await form.validateFields();
      const values = form.getFieldsValue(true);

      if (!editingRecord?.id) {
        throw new Error(
          "Draft payroll final sekarang dibuat otomatis saat Work Log completed. Menu Payroll hanya untuk review / edit draft yang sudah ada.",
        );
      }

      setSubmitting(true);

      const payload = {
        ...values,
        payrollDate: values.payrollDate ? values.payrollDate.toDate() : null,
      };

      await updateProductionPayroll(editingRecord.id, payload, null);
      message.success("Draft payroll produksi berhasil diperbarui");

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

  const handleConfirmPayroll = async (record) => {
    try {
      await updatePayrollStatus(record.id, "confirmed", "unpaid", {
        confirmedAt: new Date(),
      });
      message.success("Payroll dikonfirmasi");
      await loadData();
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal mengonfirmasi payroll");
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
      message.error(error?.message || "Gagal mengubah status payroll");
    }
  };

  const handleCancelPayroll = async (record) => {
    try {
      await updatePayrollStatus(record.id, "cancelled", "unpaid", {
        paidAt: null,
      });
      message.success("Payroll ditandai cancelled");
      await loadData();
    } catch (error) {
      console.error(error);
      message.error("Gagal membatalkan payroll");
    }
  };


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
      render: (value) => formatDate(value),
    },
    {
      title: "Operator / Work Log",
      key: "workerWorkLog",
      width: 280,
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
      title: "Mode",
      dataIndex: "payrollMode",
      key: "payrollMode",
      width: 120,
      render: (value) => PAYROLL_MODE_MAP[value] || "-",
    },
    {
      title: "Final Amount",
      dataIndex: "finalAmount",
      key: "finalAmount",
      width: 150,
      render: (value) => formatCurrency(value),
    },
    {
      // =====================================================
      // SECTION: status sticky
      // Fungsi:
      // - status payroll dan payment state tetap terlihat saat tabel digeser
      // =====================================================
      title: "Status",
      key: "status",
      width: 146,
      fixed: "right",
      className: "app-table-status-column app-table-fixed-secondary",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Tag
            color={
              record.status === "paid"
                ? "green"
                : record.status === "confirmed"
                  ? "gold"
                  : record.status === "cancelled"
                    ? "red"
                    : "blue"
            }
          >
            {PAYROLL_STATUS_MAP[record.status] || "-"}
          </Tag>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {PAYROLL_PAYMENT_STATUS_MAP[record.paymentStatus] || "-"}
          </Typography.Text>
        </Space>
      ),
    },
    {
      // =====================================================
      // SECTION: aksi sticky
      // =====================================================
      title: "Aksi",
      key: "actions",
      width: 280,
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
            disabled={record.status !== "draft"}
          >
            Edit
          </Button>

          {record.status === "draft" && (
            <Popconfirm
              title="Konfirmasi payroll ini?"
              description="Setelah confirmed, payroll siap ditandai paid."
              onConfirm={() => handleConfirmPayroll(record)}
              okText="Ya"
              cancelText="Batal"
            >
              <Button size="small">Confirm</Button>
            </Popconfirm>
          )}

          {record.status === "confirmed" && record.paymentStatus !== "paid" && (
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

          {["draft", "confirmed"].includes(record.status) && (
            <Popconfirm
              title="Batalkan payroll ini?"
              description="Work Log akan dibuka lagi sebagai eligible payroll."
              onConfirm={() => handleCancelPayroll(record)}
              okText="Ya"
              cancelText="Batal"
            >
              <Button size="small" danger>
                Cancel
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
        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <Statistic title="Total Payroll" value={summary.total} />
          </Col>
          <Col xs={24} md={6}>
            <Statistic title="Paid" value={summary.paid} />
          </Col>
          <Col xs={24} md={6}>
            <Statistic title="Confirmed" value={summary.confirmed} />
          </Col>
          <Col xs={24} md={6}>
            <Statistic title="Total Nilai" value={formatCurrency(summary.totalAmount)} />
          </Col>
        </Row>
      </Card>

      <Card>
        <Row justify="space-between" align="middle" gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col>
            <Typography.Title level={4} style={{ margin: 0 }}>
              Payroll Produksi
            </Typography.Title>
            <Typography.Text type="secondary">
              Payroll final mengikuti rule Tahapan Produksi yang tersimpan pada Work Log completed dan draft line dibuat otomatis saat Work Log selesai.
            </Typography.Text>
          </Col>
          <Col>
            <Space wrap>
              <Button icon={<ReloadOutlined />} onClick={loadData}>
                Reload
              </Button>
            </Space>
          </Col>
        </Row>

        {referenceData.autoDraftSummary?.createdLineCount > 0 && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={`Sistem merekonsiliasi ${formatNumber(referenceData.autoDraftSummary.createdLineCount)} draft payroll dari ${formatNumber(referenceData.autoDraftSummary.affectedWorkLogCount)} Work Log completed.`}
            description="Menu Payroll sekarang membaca draft final yang dibuat otomatis saat Work Log completed atau saat rekonsiliasi data completed lama yang belum punya draft payroll."
          />
        )}

        {referenceData.payrollReadinessSummary?.blockedCount > 0 && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message={`Ada ${referenceData.payrollReadinessSummary.blockedCount} Work Log completed yang belum eligible payroll.`}
            description={(
              <div>
                <div>Work Log yang blocked tidak akan masuk jalur payroll aktif sebelum issue source data diperbaiki.</div>
                {renderReasonList(
                  referenceData.blockedCompletedWorkLogs
                    .slice(0, 3)
                    .flatMap((item) => item.payrollEligibilityBlockingReasons || [])
                    .slice(0, 3),
                )}
              </div>
            )}
          />
        )}

        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={10}>
            <Input
              placeholder="Cari nomor payroll, operator, work log, step..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} md={6}>
            <Select
              style={{ width: "100%" }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "Semua Status Payroll" },
                { value: "draft", label: "Draft" },
                { value: "confirmed", label: "Confirmed" },
                { value: "paid", label: "Paid" },
                { value: "cancelled", label: "Cancelled" },
              ]}
            />
          </Col>
          <Col xs={24} md={8}>
            <Typography.Text type="secondary">
              Auto Draft: {formatNumber(referenceData.autoDraftSummary?.createdLineCount || 0)} line | Blocked: {referenceData.payrollReadinessSummary?.blockedCount || 0}. Completed Work Log tidak lagi digenerate manual dari halaman Payroll.
            </Typography.Text>
          </Col>
        </Row>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredData}
          scroll={{ x: 1400 }}
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: <Empty description="Belum ada payroll produksi" />,
          }}
        />
      </Card>

      <Drawer
        title={editingRecord ? "Review / Edit Draft Payroll Produksi" : "Draft Payroll Produksi"}
        open={formVisible}
        onClose={() => {
          setFormVisible(false);
          resetFormState();
        }}
        width={860}
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
          {/* =====================================================
              ACTIVE / GUARDED
              Metadata payroll v1 disimpan tersembunyi agar page tidak
              menghitung ulang bebas di layer UI. Semua angka final tetap
              berasal dari draft helper/service pusat.
             ===================================================== */}
          <Form.Item name="workNumber" hidden><Input /></Form.Item>
          <Form.Item name="bomId" hidden><Input /></Form.Item>
          <Form.Item name="bomCode" hidden><Input /></Form.Item>
          <Form.Item name="targetType" hidden><Input /></Form.Item>
          <Form.Item name="targetId" hidden><Input /></Form.Item>
          <Form.Item name="targetCode" hidden><Input /></Form.Item>
          <Form.Item name="targetName" hidden><Input /></Form.Item>
          <Form.Item name="stepId" hidden><Input /></Form.Item>
          <Form.Item name="stepCode" hidden><Input /></Form.Item>
          <Form.Item name="stepName" hidden><Input /></Form.Item>
          <Form.Item name="sequenceNo" hidden><InputNumber /></Form.Item>
          <Form.Item name="workerSourceType" hidden><Input /></Form.Item>
          <Form.Item name="workerId" hidden><Input /></Form.Item>
          <Form.Item name="payrollClassification" hidden><Input /></Form.Item>
          <Form.Item name="includePayrollInHpp" hidden><Input /></Form.Item>
          <Form.Item name="totalWorkLogOutputQty" hidden><InputNumber /></Form.Item>
          <Form.Item name="payableQtyFactor" hidden><InputNumber /></Form.Item>
          <Form.Item name="status" hidden><Input /></Form.Item>
          <Form.Item name="paymentStatus" hidden><Input /></Form.Item>
          <Form.Item name="confirmedAt" hidden><Input /></Form.Item>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="No. Payroll"
                name="payrollNumber"
                rules={[{ required: true, message: "No. payroll wajib diisi" }]}
              >
                <Input placeholder="Contoh: PAY-20260423-001" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="Tanggal Payroll"
                name="payrollDate"
                rules={[{ required: true, message: "Tanggal payroll wajib diisi" }]}
              >
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Typography.Text type="secondary">
                Draft payroll wajib diambil dari Work Log completed agar rule step tetap konsisten.
              </Typography.Text>
            </Col>
          </Row>

          <Alert
            style={{ marginBottom: 16 }}
            type="info"
            showIcon
            message="Draft payroll dibuat otomatis dari Work Log completed"
            description="Menu Payroll sekarang hanya dipakai untuk review, penyesuaian bonus/potongan, confirm, paid, atau cancel. Work Log dan operator line tidak boleh diganti manual dari sini."
          />

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Work Log" name="workLogId">
                <Input disabled placeholder="Otomatis dari Work Log completed" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Line Operator Payroll" name="workerLineKey">
                <Input disabled placeholder="Otomatis dari line operator Work Log" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Operator Payroll" name="workerName">
                <Input disabled placeholder="Otomatis dari line operator Work Log" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Kode Operator" name="workerCode">
                <Input disabled placeholder="Otomatis dari line operator Work Log" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item noStyle shouldUpdate>
            {({ getFieldValue }) => {
              const eligibilityStatus = getFieldValue("payrollEligibilityStatus");
              const blockingReasons = getFieldValue("payrollEligibilityBlockingReasons") || [];
              const warningReasons = getFieldValue("payrollEligibilityWarningReasons") || [];
              const eligibilityNotes = getFieldValue("payrollEligibilityNotes");

              if (!eligibilityStatus) {
                return null;
              }

              return (
                <Alert
                  style={{ marginBottom: 16 }}
                  showIcon
                  type={eligibilityStatus === "blocked" ? "error" : warningReasons.length > 0 ? "warning" : "info"}
                  message={`Status Draft Payroll: ${formatPayrollEligibilityStatusLabel(eligibilityStatus)}`}
                  description={(
                    <div>
                      {eligibilityNotes ? <div>{eligibilityNotes}</div> : null}
                      {renderReasonList(blockingReasons)}
                      {blockingReasons.length === 0 ? renderReasonList(warningReasons) : null}
                    </div>
                  )}
                />
              );
            }}
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item label="Payroll Mode" name="payrollMode">
                <Select
                  options={[
                    { value: "per_qty", label: "Per Qty" },
                    { value: "per_batch", label: "Per Batch" },
                    { value: "fixed", label: "Fixed" },
                  ]}
                  disabled
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label="Payroll Rate" name="payrollRate">
                <InputNumber min={0} style={{ width: "100%" }} disabled />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label="Dibayar Tiap Berapa Hasil" name="payrollQtyBase">
                <InputNumber min={1} style={{ width: "100%" }} disabled />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label="Qty Hasil yang Dipakai" name="outputQtyUsed">
                <InputNumber min={0} style={{ width: "100%" }} disabled />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item label="Qty Batch / Worked Qty" name="workedQty">
                <InputNumber min={0} style={{ width: "100%" }} disabled />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label="Jumlah Operator di Work Log" name="teamWorkerCount">
                <InputNumber min={1} style={{ width: "100%" }} disabled />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Rule Source" name="payrollRuleSource">
                <Input disabled placeholder="Otomatis dari Work Log / Step" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item shouldUpdate noStyle>
                {({ getFieldValue }) => (
                  <Form.Item label="Klasifikasi Payroll">
                    <Input
                      value={
                        PAYROLL_CLASSIFICATION_MAP[
                          getFieldValue("payrollClassification")
                        ] || "-"
                      }
                      disabled
                    />
                  </Form.Item>
                )}
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item shouldUpdate noStyle>
                {({ getFieldValue }) => (
                  <Form.Item label="Masuk ke HPP Produksi Inti">
                    <Input
                      value={getFieldValue("includePayrollInHpp") ? "Ya" : "Tidak"}
                      disabled
                    />
                  </Form.Item>
                )}
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
            <Col xs={24} md={8}>
              <Form.Item shouldUpdate noStyle>
                {({ getFieldsValue }) => {
                  const values = getFieldsValue();
                  const totals = calculatePayrollAmounts({
                    payrollMode: values.payrollMode,
                    payrollRate: values.payrollRate,
                    payrollQtyBase: values.payrollQtyBase,
                    outputQtyUsed: values.outputQtyUsed,
                    workedQty: values.workedQty,
                    bonusAmount: values.bonusAmount,
                    deductionAmount: values.deductionAmount,
                  });

                  return (
                    <Form.Item label="Preview Final Amount">
                      <Input value={formatCurrency(totals.finalAmount)} disabled />
                    </Form.Item>
                  );
                }}
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item shouldUpdate noStyle>
                {({ getFieldValue }) => {
                  const payrollRuleSource = getFieldValue("payrollRuleSource");
                  const legacyFallbackUsed = Boolean(
                    getFieldValue("legacyPayrollFallbackUsed"),
                  );

                  return (
                    <Form.Item label="Status Rule">
                      <Input
                        value={`${formatPayrollRuleSourceLabel(payrollRuleSource)}${
                          legacyFallbackUsed ? " (legacy/deprecated fallback)" : ""
                        }`}
                        disabled
                      />
                    </Form.Item>
                  );
                }}
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item label="Catatan Perhitungan" name="calculationNotes">
                <Input.TextArea rows={3} disabled />
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
        width={680}
      >
        {!selectedRecord ? (
          <Empty description="Tidak ada data" />
        ) : (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="No. Payroll">
              {selectedRecord.payrollNumber || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Tanggal">
              {formatDate(selectedRecord.payrollDate)}
            </Descriptions.Item>
            <Descriptions.Item label="Operator Payroll">
              {selectedRecord.workerCode
                ? `${selectedRecord.workerName || "-"} (${selectedRecord.workerCode})`
                : selectedRecord.workerName || "-"}
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
              {PAYROLL_MODE_MAP[selectedRecord.payrollMode] || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Rate">
              {formatCurrency(selectedRecord.payrollRate)}
            </Descriptions.Item>
            <Descriptions.Item label="Dibayar Tiap Berapa Hasil">
              {formatNumber(selectedRecord.payrollQtyBase)}
            </Descriptions.Item>
            <Descriptions.Item label="Hitung dari Hasil">
              {PAYROLL_OUTPUT_BASIS_MAP[selectedRecord.payrollOutputBasis] || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Qty Batch / Worked Qty">
              {formatNumber(selectedRecord.workedQty)}
            </Descriptions.Item>
            <Descriptions.Item label="Qty Hasil yang Dipakai">
              {formatNumber(selectedRecord.outputQtyUsed)}
            </Descriptions.Item>
            <Descriptions.Item label="Klasifikasi Payroll">
              {PAYROLL_CLASSIFICATION_MAP[selectedRecord.payrollClassification] || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Masuk ke HPP Produksi Inti">
              {selectedRecord.includePayrollInHpp === false ? "Tidak" : "Ya"}
            </Descriptions.Item>
            <Descriptions.Item label="Amount Calculated">
              {formatCurrency(selectedRecord.amountCalculated)}
            </Descriptions.Item>
            <Descriptions.Item label="Final Amount">
              {formatCurrency(selectedRecord.finalAmount)}
            </Descriptions.Item>
            <Descriptions.Item label="Rule Source">
              {`${formatPayrollRuleSourceLabel(selectedRecord.payrollRuleSource)}${
                selectedRecord.legacyPayrollFallbackUsed
                  ? " (legacy/deprecated fallback)"
                  : ""
              }`}
            </Descriptions.Item>
            <Descriptions.Item label="Eligibility Status">
              {formatPayrollEligibilityStatusLabel(
                selectedRecord.payrollEligibilityStatus || "eligible",
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Eligibility Notes">
              <div>
                <div>{selectedRecord.payrollEligibilityNotes || "-"}</div>
                {renderReasonList(selectedRecord.payrollEligibilityBlockingReasons || [])}
                {(selectedRecord.payrollEligibilityBlockingReasons || []).length === 0
                  ? renderReasonList(selectedRecord.payrollEligibilityWarningReasons || [])
                  : null}
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              {PAYROLL_STATUS_MAP[selectedRecord.status] || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Payment Status">
              {PAYROLL_PAYMENT_STATUS_MAP[selectedRecord.paymentStatus] || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Confirmed At">
              {formatDate(selectedRecord.confirmedAt)}
            </Descriptions.Item>
            <Descriptions.Item label="Catatan Perhitungan">
              {selectedRecord.calculationNotes || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Catatan Internal">
              {selectedRecord.notes || "-"}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};

export default ProductionPayrolls;
