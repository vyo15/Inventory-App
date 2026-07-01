// =====================================================
// Page: Payroll Produksi
// Draft payroll diambil dari work log completed
// =====================================================

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  App as AntdApp,
  Button,
  Col,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Typography,
} from "antd";
import {
  EditOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import ProductionFilterCard from "../../components/Produksi/shared/ProductionFilterCard";
import ProductionPageHeader from "../../components/Produksi/shared/ProductionPageHeader";
import PageContentCanvas from "../../components/Layout/Page/PageContentCanvas";
import PageSection from "../../components/Layout/Page/PageSection";
import DataTableView from "../../components/Layout/Table/DataTableView";
import { CompactCellText } from "../../components/Layout/Table/CompactCell";
import InfoPopoverButton from "../../components/Layout/Feedback/InfoPopoverButton";
import ProductionSummaryCards from "../../components/Produksi/shared/ProductionSummaryCards";
import { DEFAULT_PRODUCTION_PAYROLL_FORM } from "../../constants/productionPayrollOptions";
import formatNumber from "../../utils/formatters/numberId";
import formatCurrency from "../../utils/formatters/currencyId";
import {
  buildPayrollDraftFromWorkLog,
  createProductionPayroll,
  getAllProductionPayrolls,
  getPayrollReferenceData,
  updatePayrollStatus,
  updateProductionPayroll,
} from "../../services/Produksi/productionPayrollsService";
import { getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";
import { resolveDisplayReference } from "../../utils/references/displayReferenceResolver";
import ProductionPayrollDetailDrawer from "./components/ProductionPayrollDetailDrawer";
import ProductionPayrollFormDrawer from "./components/ProductionPayrollFormDrawer";

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
// Alasan logic: IMS operasional memakai angka tanpa desimal, sementara data historis decimal tidak dimigrasi otomatis.
// Behavior: input baru no-decimal; business rules dan schema/alur data utama tetap sama.

import { isEditableProductionPayroll } from "./helpers/productionPayrollsPageHelpers";
import { ProductionPayrollStatusTags } from "./components/ProductionPayrollStatusTags";

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
const renderCompactText = (value, options = {}) => (
  <CompactCellText
    value={value}
    strong={options.strong}
    secondary={options.type === "secondary"}
    tooltip={options.tooltip !== false}
  />
);

const ProductionPayrolls = () => {
  const { message } = AntdApp.useApp();
  const [loading, setLoading] = useState(false);
  const [payrolls, setPayrolls] = useState([]);
  const [referenceData, setReferenceData] = useState({
    completedWorkLogs: [],
    employees: [],
    productionSteps: [],
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [formVisible, setFormVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [editingRecord, setEditingRecord] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
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
  }, [message]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    if (!isEditableProductionPayroll(record)) {
      message.warning("Payroll yang sudah paid tidak bisa diedit dari UI utama.");
      return;
    }

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

    const productionStep = (referenceData.productionSteps || []).find((item) => item.id === workLog.stepId) || null;
    const draft = buildPayrollDraftFromWorkLog(workLog, employee, productionStep);

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
    label: item.name || "-",
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
            {renderCompactText(resolveDisplayReference(record, { fields: ["payrollNumber"], fallback: "-" }), { strong: true })}
            <Typography.Text type="secondary" className="ims-cell-meta">
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
            className="ims-cell-meta"
            style={{ display: "block" }}
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
      render: (_, record) => <ProductionPayrollStatusTags record={record} />,
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

          {isEditableProductionPayroll(record) && (
            <Button
              className="ims-action-button"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              Edit
            </Button>
          )}

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

  const payrollMobileCardConfig = {
    title: (record) => resolveDisplayReference(record, { fields: ["payrollNumber"], fallback: "Payroll produksi" }),
    subtitle: (record) => [
      record.payrollDate ? dayjs(record.payrollDate?.toDate ? record.payrollDate.toDate() : record.payrollDate).format("DD/MM/YYYY") : "Tanggal belum diisi",
      record.workerName || "Karyawan belum diisi",
      record.stepName || "Step belum diisi",
    ],
    tags: (record) => <ProductionPayrollStatusTags record={record} />,
    meta: [
      { label: "Nominal", value: (record) => formatCurrency(record.finalAmount || 0) },
      { label: "Work Log", value: (record) => record.workNumber || "-" },
      { label: "Mode", value: (record) => record.payrollMode || "-" },
      { label: "Qty", value: (record) => formatNumber(record.outputQtyUsed || 0) },
    ],
    actions: (record) => (
      <Space wrap size={6} className="ims-action-group">
        <Button className="ims-action-button" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>Detail</Button>
        {isEditableProductionPayroll(record) ? (
          <Button className="ims-action-button" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>Edit</Button>
        ) : null}
      </Space>
    ),
  };

  return (
    <div className="page-container">
      {/* AKTIF / GUARDED: migrasi header ke shared produksi; submit payroll dan integrasi cash-out tetap mengikuti flow existing. */}
      <ProductionPageHeader
        title="Payroll Produksi"
        description="Rekap payroll dari Work Log completed."
        onAdd={handleAdd}
        addLabel="Tambah Payroll"
      />

      <PageContentCanvas>


      {/* AKTIF / GUARDED: summary cards shared hanya ubah presentasi, nominal payroll tetap dari data existing. */}
      <ProductionSummaryCards items={summaryItems} variant="finance" highlightKey="payroll-total-amount" />

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
        subtitle="Rekap line payroll dan status pembayaran."
        extra={(
          <InfoPopoverButton
            label="Aturan Payroll"
            title="Aturan line payroll"
            description="Satu line mewakili satu operator pada satu Work Log/tahap. Status paid menjadi dasar pencatatan ke Cash Out."
            items={[
              { label: 'Satu line', value: 'Satu operator + satu tahap.' },
              { label: 'Paid', value: 'Membuat Cash Out otomatis bila nominal > 0.' },
              { label: 'HPP', value: 'Mengikuti payroll final.' },
            ]}
          />
        )}
      >
        {/* ===============================================================
            Tabel payroll produksi compact guarded: layout utama tidak lagi
            memakai horizontal scroll besar; aksi paid tetap lewat handler lama.
        =============================================================== */}
        <DataTableView
          loading={loading}
          showRefreshIndicator
          className="app-data-table"
          rowKey="id"
          columns={columns}
          dataSource={filteredData}
          mobileCardConfig={payrollMobileCardConfig}
          locale={{
            emptyText: getDataTableEmptyText(loading, "Belum ada payroll produksi"),
          }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
          }}
        />
      </PageSection>

      </PageContentCanvas>

<ProductionPayrollFormDrawer
        editingRecord={editingRecord}
        employeeOptions={employeeOptions}
        form={form}
        formVisible={formVisible}
        handleGenerateFromWorkLog={handleGenerateFromWorkLog}
        handleSubmit={handleSubmit}
        referenceData={referenceData}
        resetFormState={resetFormState}
        setFormVisible={setFormVisible}
        submitting={submitting}
        workLogOptions={workLogOptions}
      />

<ProductionPayrollDetailDrawer
        detailVisible={detailVisible}
        selectedRecord={selectedRecord}
        setDetailVisible={setDetailVisible}
      />
    </div>
  );
};

export default ProductionPayrolls;
