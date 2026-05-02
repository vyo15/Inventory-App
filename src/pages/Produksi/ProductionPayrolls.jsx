// =====================================================
// Page: Payroll Produksi
// Draft payroll diambil dari work log completed
// =====================================================

import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
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
import ProductionFilterCard from "../../components/Produksi/shared/ProductionFilterCard";
import ProductionPageHeader from "../../components/Produksi/shared/ProductionPageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import ProductionSummaryCards from "../../components/Produksi/shared/ProductionSummaryCards";
import {
  DEFAULT_PRODUCTION_PAYROLL_FORM,
  PAYROLL_PAYMENT_STATUS_MAP,
  PAYROLL_STATUS_MAP,
} from "../../constants/productionPayrollOptions";
import formatNumber, { parseIntegerIdInput } from "../../utils/formatters/numberId";
import formatCurrency from "../../utils/formatters/currencyId";
import {
  buildPayrollDraftFromWorkLog,
  createProductionPayroll,
  getAllProductionPayrolls,
  getPayrollReferenceData,
  updatePayrollStatus,
  updateProductionPayroll,
} from "../../services/Produksi/productionPayrollsService";

// =====================================================
// IMS NOTE [AKTIF/GUARDED] - Formatter angka payroll
// Fungsi blok: memakai formatter global tanpa desimal untuk tampilan payroll.
// Hubungan flow: hanya display/input UI; rumus payroll dan payment to expense tetap di service.
// Alasan logic: menghapus formatter lokal agar halaman Payroll mengikuti standar angka IMS.
// Behavior: behavior-preserving untuk kalkulasi, mengubah tampilan menjadi no-decimal.
// =====================================================
// =====================================================
// ACTIVE / UI HELP TEXT
// Fungsi blok:
// - menjelaskan arti field detail payroll dengan bahasa user-friendly;
// - menjaga detail payroll tetap read-only dan tidak mengubah nominal/status.
// Alasan perubahan:
// - Task 3 hanya memperjelas UI, bukan mengubah kalkulasi atau flow payroll.
// Status:
// - aktif dipakai di drawer Detail Payroll; bukan kandidat cleanup.
// =====================================================
// IMS NOTE [AKTIF/GUARDED] - Standar input angka bulat
// Fungsi blok: mengarahkan InputNumber aktif ke step 1, precision 0, dan parser integer Indonesia.
// Hubungan flow: hanya membatasi input/display UI; service calculation stok, kas, HPP, payroll, dan report tidak diubah.
// Alasan logic: IMS operasional memakai angka tanpa desimal, sementara data lama decimal tidak dimigrasi otomatis.
// Behavior: input baru no-decimal; business rules dan schema Firestore tetap sama.

const PAYROLL_STATUS_HELP = {
  draft: "Payroll belum final dan masih perlu dicek sebelum dibayar.",
  confirmed: "Payroll sudah disetujui tetapi belum ditandai dibayar.",
  paid: "Payroll sudah ditandai dibayar dan akan membuat Cash Out otomatis bila nominal > 0.",
  cancelled: "Payroll dibatalkan dan tidak dipakai sebagai pembayaran aktif.",
};

const PAYROLL_PAYMENT_STATUS_HELP = {
  unpaid: "Belum dibayar secara internal payroll.",
  partial: "Sebagian pembayaran sudah dicatat secara internal payroll.",
  paid: "Sudah dibayar; Cash Out otomatis dibuat dengan source Payroll Produksi jika nominal > 0.",
};

const PayrollDetailValue = ({ children, help }) => (
  <Space direction="vertical" size={0}>
    <span>{children}</span>
    {help ? (
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {help}
      </Typography.Text>
    ) : null}
  </Space>
);

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

  const summaryItems = [
    {
      key: "payroll-total",
      title: "Total Payroll",
      value: summary.total,
      subtitle: "Seluruh line payroll produksi yang tercatat.",
      accent: "primary",
    },
    {
      key: "payroll-paid",
      title: "Sudah Dibayar",
      value: summary.paid,
      subtitle: "Line payroll yang sudah berstatus paid.",
      accent: "success",
    },
    {
      key: "payroll-unpaid",
      title: "Belum Dibayar",
      value: summary.unpaid,
      subtitle: "Line payroll yang masih menunggu pembayaran.",
      accent: "warning",
    },
    {
      key: "payroll-total-amount",
      title: "Total Nilai Payroll",
      value: formatCurrency(summary.totalAmount),
      subtitle: "Akumulasi nominal payroll produksi yang tercatat.",
      accent: "default",
    },
  ];

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
      // =====================================================
      // ACTIVE / GUARDED - Paid payroll otomatis membuat Cash Out
      // Fungsi blok:
      // - menandai payroll paid dan meminta service membuat expense payroll idempotent;
      // - menampilkan status sync agar user tahu Cash Out dibuat / sudah ada / dilewati.
      // Alasan blok ini dipakai:
      // - integrasi IMS final mengalirkan Payroll Produksi paid ke Kas & Biaya tanpa input ulang.
      // Status:
      // - aktif dipakai; guarded karena tidak boleh membuat double expense.
      // =====================================================
      const result = await updatePayrollStatus(record.id, "paid", "paid", {
        paidAt: new Date(),
      });

      if (result?.expenseSyncStatus === "created") {
        message.success("Payroll paid dan Cash Out otomatis dibuat.");
      } else if (result?.expenseSyncStatus === "already_exists") {
        message.info("Payroll paid. Cash Out payroll sudah ada, tidak dibuat ulang.");
      } else if (result?.expenseSyncStatus === "skipped_zero_amount") {
        message.warning("Payroll paid, tetapi Cash Out tidak dibuat karena nominal payroll 0.");
      } else {
        message.success("Payroll ditandai paid.");
      }

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
      title: "No. Line Payroll",
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
          <Tag color="blue">{PAYROLL_STATUS_MAP[record.status] || "-"}</Tag>
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
      width: 240,
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
    <div className="page-container">
      {/* AKTIF / GUARDED: migrasi header ke shared produksi; submit payroll dan integrasi cash-out tetap mengikuti flow existing. */}
      <ProductionPageHeader
        title="Payroll Produksi"
        description="Rekap line payroll produksi berbasis work log completed, tetap guarded terhadap pembuatan Cash Out otomatis."
        onRefresh={loadData}
        onAdd={handleAdd}
        addLabel="Tambah Payroll"
      />

      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message="Halaman ini menampilkan line payroll, bukan batch payroll baru. Satu line mewakili satu operator pada satu work log/tahap kerja."
        description="Saat line ditandai Paid, sistem membuat Cash Out otomatis dengan source Payroll Produksi dan guard sourceModule/sourceId agar tidak double expense."
      />

      {/* AKTIF / GUARDED: summary cards shared hanya ubah presentasi, nominal payroll tetap dari data existing. */}
      <ProductionSummaryCards items={summaryItems} />

      {/* AKTIF / GUARDED: filter card shared menjaga konsistensi layout, filter state dan query logic tidak berubah. */}
      <ProductionFilterCard>
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
      </ProductionFilterCard>

      <PageSection
        title="Daftar Payroll Produksi"
        subtitle="Tabel ini tetap menjadi rekap line payroll. Perubahan status dibaca oleh flow expense otomatis yang sudah dijaga service."
      >
        {/* ===============================================================
            Tabel payroll mengikuti helper global untuk menjaga konsistensi bentuk.
        =============================================================== */}
        <Table
          className="app-data-table"
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
      </PageSection>

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
                <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label="Payroll Qty Base" name="payrollQtyBase">
                <InputNumber min={1} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label="Output Qty Used" name="outputQtyUsed">
                <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={4}>
              <Form.Item label="Bonus" name="bonusAmount">
                <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={4}>
              <Form.Item label="Potongan" name="deductionAmount">
                <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={4}>
              <Form.Item label="Worked Qty" name="workedQty">
                <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={4}>
              <Form.Item label="Team Worker Count" name="teamWorkerCount">
                <InputNumber min={1} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
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
        width={640}
      >
        {!selectedRecord ? (
          <Empty description="Tidak ada data" />
        ) : (
          <>
            {/* =====================================================
                ACTIVE / READ-ONLY CONTEXT
                Fungsi blok:
                - memberi konteks singkat agar user memahami detail payroll sebagai
                  line pembayaran per operator dari Work Log completed.
                Alasan perubahan:
                - Task 3 meminta help text tanpa mengubah status, nominal, atau service.
                Status:
                - aktif dipakai; bukan legacy dan bukan kandidat cleanup.
            ===================================================== */}
            <Alert
              showIcon
              type="info"
              style={{ marginBottom: 16 }}
              message="Detail ini adalah line payroll per operator"
              description="Payroll final aktif berasal dari Work Log completed dan rule Tahapan Produksi. Drawer ini hanya membantu membaca arti field; nominal, status, dan payment state tidak dihitung ulang di sini."
            />

            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="No. Line Payroll">
                <PayrollDetailValue help="Nomor unik untuk satu baris payroll. Satu Work Log bisa menghasilkan beberapa line jika ada lebih dari satu operator.">
                  {selectedRecord.payrollNumber || "-"}
                </PayrollDetailValue>
              </Descriptions.Item>
              <Descriptions.Item label="Tanggal Payroll">
                <PayrollDetailValue help="Tanggal pencatatan line payroll di modul Payroll Produksi.">
                  {selectedRecord.payrollDate
                    ? dayjs(
                        selectedRecord.payrollDate?.toDate
                          ? selectedRecord.payrollDate.toDate()
                          : selectedRecord.payrollDate,
                      ).format("DD/MM/YYYY")
                    : "-"}
                </PayrollDetailValue>
              </Descriptions.Item>
              <Descriptions.Item label="Operator / Karyawan">
                <PayrollDetailValue help="Karyawan produksi yang menerima payroll dari line ini.">
                  {selectedRecord.workerName || "-"}
                </PayrollDetailValue>
              </Descriptions.Item>
              <Descriptions.Item label="Work Log Asal">
                <PayrollDetailValue help="Pekerjaan produksi yang menjadi sumber payroll. Dipakai untuk audit ke hasil produksi.">
                  {selectedRecord.workNumber || "-"}
                </PayrollDetailValue>
              </Descriptions.Item>
              <Descriptions.Item label="Target Produksi">
                <PayrollDetailValue help="Produk/semi finished yang dikerjakan pada Work Log terkait.">
                  {selectedRecord.targetName || "-"}
                </PayrollDetailValue>
              </Descriptions.Item>
              <Descriptions.Item label="Step / Tahapan">
                <PayrollDetailValue help="Tahapan produksi yang menentukan rule, mode, dan tarif payroll.">
                  {selectedRecord.stepName || "-"}
                </PayrollDetailValue>
              </Descriptions.Item>
              <Descriptions.Item label="Sistem Bayar">
                <PayrollDetailValue help="Mode payroll dari rule tahapan, misalnya per qty, per batch, atau fixed.">
                  {selectedRecord.payrollMode || "-"}
                </PayrollDetailValue>
              </Descriptions.Item>
              <Descriptions.Item label="Payroll Rate / Tarif">
                <PayrollDetailValue help="Tarif dasar dari rule Tahapan Produksi yang dipakai untuk menghitung payroll.">
                  {formatCurrency(selectedRecord.payrollRate)}
                </PayrollDetailValue>
              </Descriptions.Item>
              <Descriptions.Item label="Qty Dasar / Output Qty Used">
                <PayrollDetailValue help="Jumlah output yang dipakai sebagai dasar hitung payroll. Biasanya dari Good Qty atau basis output sesuai rule tahapan.">
                  {formatNumber(selectedRecord.outputQtyUsed)}
                </PayrollDetailValue>
              </Descriptions.Item>
              <Descriptions.Item label="Amount Calculated / Hasil Hitung Sistem">
                <PayrollDetailValue help="Nominal hasil hitung otomatis dari sistem sebelum bonus dan potongan manual.">
                  {formatCurrency(selectedRecord.amountCalculated)}
                </PayrollDetailValue>
              </Descriptions.Item>
              <Descriptions.Item label="Final Amount / Nominal Akhir">
                <PayrollDetailValue help="Nominal akhir line payroll setelah bonus dan potongan. Nilai ini yang dipakai sebagai nilai payroll final.">
                  {formatCurrency(selectedRecord.finalAmount)}
                </PayrollDetailValue>
              </Descriptions.Item>
              <Descriptions.Item label="Status Payroll">
                <PayrollDetailValue
                  help={PAYROLL_STATUS_HELP[selectedRecord.status] || "Status lifecycle payroll internal."}
                >
                  <Tag color={selectedRecord.status === "paid" ? "green" : "blue"}>
                    {PAYROLL_STATUS_MAP[selectedRecord.status] || "-"}
                  </Tag>
                </PayrollDetailValue>
              </Descriptions.Item>
              <Descriptions.Item label="Payment Status">
                <PayrollDetailValue
                  help={PAYROLL_PAYMENT_STATUS_HELP[selectedRecord.paymentStatus] || "Status pembayaran internal line payroll."}
                >
                  <Tag color={selectedRecord.paymentStatus === "paid" ? "green" : "orange"}>
                    {PAYROLL_PAYMENT_STATUS_MAP[selectedRecord.paymentStatus] || "-"}
                  </Tag>
                </PayrollDetailValue>
              </Descriptions.Item>
              <Descriptions.Item label="Calculation Notes / Catatan Sistem">
                <PayrollDetailValue help="Catatan otomatis dari sistem tentang cara payroll dihitung. Berguna untuk audit jika nominal perlu dicek ulang.">
                  {selectedRecord.calculationNotes || "-"}
                </PayrollDetailValue>
              </Descriptions.Item>
              <Descriptions.Item label="Notes / Catatan Manual">
                <PayrollDetailValue help="Catatan manual dari user/admin. Tidak mengubah nominal payroll kecuali ada penyesuaian bonus atau potongan yang disimpan di field terkait.">
                  {selectedRecord.notes || "-"}
                </PayrollDetailValue>
              </Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Drawer>
    </div>
  );
};

export default ProductionPayrolls;
