// =====================================================
// Page: Payroll Produksi
// Draft payroll diambil dari work log completed
// =====================================================

import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
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
import { DataRefreshIndicator, getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";

// =====================================================
// IMS NOTE [AKTIF/GUARDED] - Formatter angka payroll
// Fungsi blok: memakai formatter global tanpa desimal untuk tampilan payroll.
// Hubungan flow: hanya display/input UI; rumus payroll dan payment to expense tetap di service.
// Alasan logic: menghapus formatter lokal agar halaman Payroll mengikuti standar angka IMS.
// Behavior: behavior-preserving untuk kalkulasi, mengubah tampilan menjadi no-decimal.
// =====================================================
// =====================================================
// IMS NOTE [AKTIF/GUARDED] - Standar input angka bulat
// Fungsi blok: mengarahkan InputNumber aktif ke step 1, precision 0, dan parser integer Indonesia.
// Hubungan flow: hanya membatasi input/display UI; service calculation stok, kas, HPP, payroll, dan report tidak diubah.
// Alasan logic: IMS operasional memakai angka tanpa desimal, sementara data lama decimal tidak dimigrasi otomatis.
// Behavior: input baru no-decimal; business rules dan schema Firestore tetap sama.


/*
=====================================================
SECTION: Detail payroll status helper — GUARDED
Fungsi:
- Menjelaskan status payroll dan status pembayaran pada drawer detail.

Dipakai oleh:
- ProductionPayrolls.jsx pada drawer Detail Payroll.

Alasan perubahan:
- Mengembalikan helper copy yang dipakai render detail agar halaman tidak whitescreen.

Catatan cleanup:
- Bisa dipindah ke constants jika status help dipakai lintas halaman.

Risiko:
- Jika helper ini dihapus tanpa mengganti pemanggilnya, halaman Payroll Produksi akan gagal render.
=====================================================
*/
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

/*
=====================================================
SECTION: Compact table text renderer — AKTIF
Fungsi:
- Memadatkan teks panjang di main table payroll produksi dengan ellipsis dan tooltip.

Dipakai oleh:
- ProductionPayrolls.jsx pada section Daftar Payroll Produksi.

Alasan perubahan:
- Main table perlu lebih ringkas agar Status dan Aksi tetap terlihat tanpa horizontal scroll besar.

Catatan cleanup:
- belum ada.

Risiko:
- Jika helper ini diubah sembarangan, identitas payroll, karyawan, work log, atau step bisa sulit diaudit dari tabel utama.
=====================================================
*/
const renderCompactText = (value, options = {}) => {
  const text = value === undefined || value === null || value === ""
    ? "-"
    : String(value);

  return (
    <Typography.Text
      strong={options.strong}
      type={options.type}
      style={{
        display: "block",
        maxWidth: "100%",
        fontSize: options.fontSize,
      }}
      ellipsis={{ tooltip: text }}
    >
      {text}
    </Typography.Text>
  );
};

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

  /*
  =====================================================
  SECTION: Main table payroll produksi compact — GUARDED
  Fungsi:
  - Menampilkan rekap utama payroll produksi dalam kolom ringkas tanpa horizontal scroll besar.
  - Menjaga nomor payroll, tanggal, karyawan, work log, step, nominal, status payroll, payment status, dan aksi tetap terlihat.

  Dipakai oleh:
  - ProductionPayrolls.jsx pada section Daftar Payroll Produksi.

  Alasan perubahan:
  - Menghapus scroll x besar dan fixed right pada Status/Aksi agar tabel utama lebih nyaman dibaca di layout normal.

  Catatan cleanup:
  - Evaluasi lagi bila nanti ada field audit tambahan yang wajib tampil di tabel utama.

  Risiko:
  - Jika logic render/action diubah sembarangan, tombol Paid yang memicu Cash Out idempotent bisa hilang atau status paid bisa salah terbaca.
  =====================================================
  */
  const columns = [
    {
      title: "Payroll / Tanggal",
      key: "payrollDateSummary",
      width: 180,
      render: (_, record) => {
        const date = record.payrollDate?.toDate
          ? record.payrollDate.toDate()
          : record.payrollDate;

        return (
          <Space direction="vertical" size={0} style={{ width: "100%" }}>
            {renderCompactText(record.payrollNumber, { strong: true })}
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {date ? dayjs(date).format("DD/MM/YYYY") : "-"}
            </Typography.Text>
          </Space>
        );
      },
    },
    {
      title: "Karyawan / Work Log",
      key: "workerWorkLog",
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={0} style={{ width: "100%" }}>
          {renderCompactText(record.workerName, { strong: true })}
          {renderCompactText(record.workNumber, {
            type: "secondary",
            fontSize: 12,
          })}
        </Space>
      ),
    },
    {
      title: "Step / Basis",
      key: "stepBasis",
      width: 190,
      render: (_, record) => (
        <Space direction="vertical" size={0} style={{ width: "100%" }}>
          {renderCompactText(record.stepName, { strong: true })}
          <Typography.Text
            type="secondary"
            style={{ display: "block", fontSize: 12 }}
            ellipsis={{ tooltip: record.payrollMode || "-" }}
          >
            {record.payrollMode || "-"}
            {record.outputQtyUsed !== undefined && record.outputQtyUsed !== null
              ? ` • Qty ${formatNumber(record.outputQtyUsed)}`
              : ""}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Nominal",
      dataIndex: "finalAmount",
      key: "finalAmount",
      width: 140,
      align: "right",
      render: (value) => (
        <Typography.Text strong>{formatCurrency(value)}</Typography.Text>
      ),
    },
    {
      title: "Status",
      key: "status",
      width: 150,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Tag color="blue">{PAYROLL_STATUS_MAP[record.status] || "-"}</Tag>
          <Tag color={record.paymentStatus === "paid" ? "green" : "orange"}>
            {PAYROLL_PAYMENT_STATUS_MAP[record.paymentStatus] || "-"}
          </Tag>
        </Space>
      ),
    },
    {
      title: "Aksi",
      key: "actions",
      width: 150,
      render: (_, record) => (
        <Space wrap size={6} className="ims-action-group">
          <Button
            className="ims-action-button"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            Detail
          </Button>

          <Button
            className="ims-action-button"
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
              <Button className="ims-action-button" size="small" type="primary">
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
            Tabel payroll produksi compact guarded: layout utama tidak lagi
            memakai horizontal scroll besar; aksi paid tetap lewat handler lama.
        =============================================================== */}
        <DataRefreshIndicator loading={loading} dataSource={filteredData} />
        <Table
          className="app-data-table"
          rowKey="id"
          columns={columns}
          dataSource={filteredData}
          locale={{
            emptyText: getDataTableEmptyText(loading, <Empty description="Belum ada payroll produksi" />),
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
        width={820}
      >
        {!selectedRecord ? (
          <Empty description="Tidak ada data" />
        ) : (
          <>
            {/*
=====================================================
SECTION: Detail drawer payroll produksi — GUARDED
Fungsi:
- Menampilkan ringkasan payroll per operator dengan status, nominal, dan referensi Work Log.

Dipakai oleh:
- Halaman ProductionPayrolls untuk audit detail payroll read-only.

Alasan perubahan:
- Detail payroll dirapikan menjadi metric, ringkasan, relasi, catatan, dan info tambahan tanpa mengubah kalkulasi/service.

Catatan cleanup:
- Field expense legacy tetap ditampilkan kondisional di Collapse agar audit Cash Out lama tidak hilang.

Risiko:
- Jika nominal/status/source disembunyikan, user bisa salah menilai payroll paid atau double input Cash Out.
=====================================================
*/}
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Row gutter={[12, 12]}>
                <Col xs={24} sm={12}>
                  <Card size="small">
                    <Statistic
                      title="Final Amount"
                      value={formatCurrency(selectedRecord.finalAmount)}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12}>
                  <Card size="small">
                    <Statistic
                      title="Qty Dasar"
                      value={formatNumber(selectedRecord.outputQtyUsed)}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12}>
                  <Card size="small">
                    <Statistic
                      title="Hasil Hitung"
                      value={formatCurrency(selectedRecord.amountCalculated)}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12}>
                  <Card size="small">
                    <Statistic
                      title="Tarif"
                      value={formatCurrency(selectedRecord.payrollRate)}
                    />
                  </Card>
                </Col>
              </Row>

              <Card size="small" title="Status Payroll">
                <Space direction="vertical" size={8} style={{ width: "100%" }}>
                  <Space wrap>
                    <Tag color={selectedRecord.status === "paid" ? "green" : "blue"}>
                      {PAYROLL_STATUS_MAP[selectedRecord.status] || "-"}
                    </Tag>
                    <Tag color={selectedRecord.paymentStatus === "paid" ? "green" : "orange"}>
                      {PAYROLL_PAYMENT_STATUS_MAP[selectedRecord.paymentStatus] || "-"}
                    </Tag>
                    <Tag color={selectedRecord.includePayrollInHpp === false ? "orange" : "green"}>
                      {selectedRecord.includePayrollInHpp === false ? "Tidak masuk HPP" : "Masuk HPP"}
                    </Tag>
                  </Space>
                  <Typography.Text type="secondary">
                    {PAYROLL_STATUS_HELP[selectedRecord.status] || "Status payroll aktif."}
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    {PAYROLL_PAYMENT_STATUS_HELP[selectedRecord.paymentStatus] || "Status pembayaran payroll."}
                  </Typography.Text>
                </Space>
              </Card>

              <Card size="small" title="Ringkasan">
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
                  <Descriptions.Item label="Operator">
                    {selectedRecord.workerName || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Step">
                    {selectedRecord.stepName || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Sistem Bayar">
                    {selectedRecord.payrollMode || "-"}
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              <Card size="small" title="Relasi Produksi">
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="Work Log">
                    {selectedRecord.workNumber || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Target Produksi">
                    {selectedRecord.targetName || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Bonus">
                    {formatCurrency(selectedRecord.bonusAmount)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Potongan">
                    {formatCurrency(selectedRecord.deductionAmount)}
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              {(selectedRecord.calculationNotes || selectedRecord.notes) && (
                <Card size="small" title="Catatan">
                  <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label="Sistem">
                      {selectedRecord.calculationNotes || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Manual">
                      {selectedRecord.notes || "-"}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              )}

              <Collapse
                ghost
                items={[
                  {
                    key: "cashout",
                    label: "Info Cash Out & Audit",
                    children: (
                      <Descriptions column={1} bordered size="small">
                        <Descriptions.Item label="Expense Sync">
                          {selectedRecord.expenseSyncStatus || "-"}
                        </Descriptions.Item>
                        <Descriptions.Item label="Cash Out ID">
                          {selectedRecord.expenseId || "-"}
                        </Descriptions.Item>
                        <Descriptions.Item label="Source Ref">
                          {selectedRecord.expenseSourceRef || selectedRecord.payrollNumber || "-"}
                        </Descriptions.Item>
                        <Descriptions.Item label="Catatan Sync">
                          {selectedRecord.expenseSyncNotes || "-"}
                        </Descriptions.Item>
                      </Descriptions>
                    ),
                  },
                ]}
              />
            </Space>
          </>
        )}
      </Drawer>
    </div>
  );
};

export default ProductionPayrolls;
