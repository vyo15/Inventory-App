import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Tag,
  message,
} from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import SummaryStatGrid from "../../components/Layout/Display/SummaryStatGrid";
import EmptyStateBlock from "../../components/Layout/Feedback/EmptyStateBlock";
import InfoPopoverButton from "../../components/Layout/Feedback/InfoPopoverButton";
import FilterBar from "../../components/Layout/Filters/FilterBar";
import PageFormModal from "../../components/Layout/Forms/PageFormModal";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import DataTableView from "../../components/Layout/Table/DataTableView";
import { formatCurrencyId } from "../../utils/formatters/currencyId";
import { formatDateId } from "../../utils/formatters/dateId";
import { formatNumberId, parseIntegerIdInput } from "../../utils/formatters/numberId";
import { createCashOutTransaction, deleteCashOutTransaction, listenCashOutRecords } from "../../services/Finance/financeService";
import { DataRefreshIndicator, getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";
import {
  buildFinanceMonthOptions,
  buildFinanceRecordYearOptions,
  filterFinanceRecordsByPeriod,
  getCurrentFinanceYear,
} from "./helpers/financePeriodHelpers";


// IMS NOTE [AKTIF/GUARDED] - Standar input angka bulat
// Fungsi blok: mengarahkan InputNumber aktif ke step 1, precision 0, dan parser integer Indonesia.
// Hubungan flow: hanya membatasi input/display UI; service calculation stok, kas, HPP, payroll, dan report tidak diubah.
// Alasan logic: IMS operasional memakai angka tanpa desimal, sementara data historis decimal tidak dimigrasi otomatis.
// Behavior: input baru no-decimal; business rules dan schema/alur data utama tetap sama.

const { Option } = Select;

const MONTH_OPTIONS = buildFinanceMonthOptions();

// =========================
// SECTION: Sumber expense
// Fungsi:
// - membedakan pengeluaran manual vs pengeluaran turunan dari modul lain
// - membantu user memahami apakah row boleh dihapus atau hanya dibaca
// Status:
// - aktif dipakai di UI Cash Out
// - kandidat cleanup hanya jika nanti ada source registry global untuk expenses
// =========================
const EXPENSE_SOURCE_META = {
  cash_out_manual: { label: "Manual", color: "default", deletable: true },
  purchases: { label: "Pembelian", color: "blue", deletable: false },
  production_payroll: { label: "Payroll Produksi", color: "purple", deletable: false },
};

const resolveExpenseSourceMeta = (record = {}) => {
  const key = String(record.sourceModule || "").trim();
  return EXPENSE_SOURCE_META[key] || {
    label: key ? key : "Manual",
    color: "default",
    deletable: key === "",
  };
};

// =========================
// SECTION: Helper meta saving pembelian
// Fungsi:
// - mempertahankan penjelasan saving pembelian sebagai info efisiensi
// - tidak mengubah nilai kas keluar aktual yang menjadi source of truth
// =========================
const getSavingMeta = (value) => {
  const amount = Math.round(Number(value || 0));

  if (amount > 0) {
    return {
      status: "hemat",
      label: `Hemat ${formatCurrencyId(amount)}`,
      color: "green",
    };
  }

  if (amount < 0) {
    return {
      status: "lebih_mahal",
      label: `Lebih Mahal ${formatCurrencyId(Math.abs(amount))}`,
      color: "red",
    };
  }

  return {
    status: "normal",
    label: "Sesuai Referensi",
    color: "default",
  };
};

const CashOut = () => {
  // =========================
  // SECTION: State utama halaman
  // =========================
  const [cashOuts, setCashOuts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form] = Form.useForm();

  const currentYear = getCurrentFinanceYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState("all");

  // =========================
  // SECTION: Sinkronisasi data pengeluaran
  // =========================
  useEffect(() => {
    setLoading(true);
    const unsubscribe = listenCashOutRecords(
      (rows) => {
        setCashOuts(rows);
        setLoading(false);
      },
      (error) => {
        console.error("Gagal sinkronisasi data kas keluar lokal:", error);
        message.error("Gagal memuat data kas keluar.");
        setCashOuts([]);
        setLoading(false);
      },
    );

    return () => unsubscribe?.();
  }, []);

  // =========================
  // SECTION: Derived data filter & summary
  // =========================
  const yearOptions = useMemo(
    () => buildFinanceRecordYearOptions(cashOuts, currentYear),
    [cashOuts, currentYear],
  );

  const filteredCashOuts = useMemo(
    () => filterFinanceRecordsByPeriod(cashOuts, {
      year: selectedYear,
      month: selectedMonth,
    }),
    [cashOuts, selectedMonth, selectedYear],
  );

  const summary = useMemo(() => {
    return filteredCashOuts.reduce(
      (accumulator, item) => {
        const amount = Math.round(Number(item.amount || 0));
        const referenceAmount = Math.round(Number(item.totalReferenceAmount || 0));
        const savingAmount = Math.round(Number(item.savingAmount || 0));

        accumulator.totalActualExpense += amount;
        accumulator.totalReferenceExpense += referenceAmount;
        accumulator.totalSaving += savingAmount;

        if (item.sourceModule === "purchases" || item.type === "Pembelian Bahan/Barang") {
          accumulator.totalPurchaseExpense += amount;
        }

        // ACTIVE / FINAL - payroll expense otomatis.
        // Fungsi blok:
        // - memisahkan pengeluaran payroll otomatis agar owner tahu Cash Out ini dari payroll paid;
        // - tidak mengubah total expense karena totalActualExpense tetap source of truth.
        // Status: aktif dipakai; guarded karena payroll tidak boleh double expense.
        if (item.sourceModule === "production_payroll") {
          accumulator.totalPayrollExpense += amount;
        }

        return accumulator;
      },
      {
        totalActualExpense: 0,
        totalReferenceExpense: 0,
        totalSaving: 0,
        totalPurchaseExpense: 0,
        totalPayrollExpense: 0,
      },
    );
  }, [filteredCashOuts]);

  const summaryItems = useMemo(
    () => [
      {
        key: "actual-expense",
        title: "Total Pengeluaran",
        value: formatCurrencyId(summary.totalActualExpense),
        subtitle: "Akumulasi cash-out periode aktif.",
        accent: "danger",
      },
      {
        key: "purchase-expense",
        title: "Pembelian",
        value: formatCurrencyId(summary.totalPurchaseExpense),
        subtitle: "Belanja bahan/barang.",
        accent: "warning",
      },
      {
        key: "payroll-expense",
        title: "Payroll Produksi",
        value: formatCurrencyId(summary.totalPayrollExpense),
        subtitle: "Payroll paid.",
        accent: "primary",
      },
      {
        key: "purchase-saving",
        title: "Saving Pembelian",
        value:
          summary.totalSaving < 0
            ? `- ${formatCurrencyId(Math.abs(summary.totalSaving))}`
            : formatCurrencyId(summary.totalSaving),
        subtitle: "Efisiensi vs referensi.",
        accent: summary.totalSaving >= 0 ? "success" : "danger",
      },
    ],
    [summary],
  );

  // =========================
  // SECTION: Handler modal form
  // =========================
  const openCreateModal = () => {
    setModalVisible(true);
    form.resetFields();
    form.setFieldsValue({
      type: "Biaya Lain-lain",
      date: dayjs(),
      amount: 0,
    });
  };

  const closeCreateModal = () => {
    setModalVisible(false);
    form.resetFields();
  };

  const handleAddTransaction = async (values) => {
    try {
      await createCashOutTransaction(values);
      message.success("Transaksi pengeluaran berhasil ditambahkan!");
      closeCreateModal();
    } catch (error) {
      console.error("Gagal menambahkan transaksi kas keluar:", error);
      message.error(error?.message || "Gagal menambahkan transaksi kas keluar.");
    }
  };

  const handleDeleteTransaction = async (id) => {
    try {
      await deleteCashOutTransaction(id);
      message.success("Transaksi berhasil dihapus.");
    } catch (error) {
      console.error("Gagal menghapus transaksi:", error);
      message.error(error?.message || "Gagal menghapus transaksi.");
    }
  };

  // =========================
  // SECTION: Cash Out Table Meta UI - AKTIF / GUARDED
  // Fungsi:
  // - menyamakan style metadata referensi sumber kas keluar dengan class token global.
  // Hubungan flow aplikasi:
  // - perubahan presentational only; tidak mengubah sourceRef, perhitungan kas, atau payload transaksi.
  // Status:
  // - AKTIF untuk konsistensi UI batch cleanup.
  // =========================
  const columns = useMemo(
    () => [
      {
        title: "Tanggal",
        dataIndex: "date",
        key: "date",
        render: (value) => formatDateId(value),
      },
      {
        title: "Sumber",
        key: "sourceModule",
        render: (_, record) => {
          const sourceMeta = resolveExpenseSourceMeta(record);
          return (
            <div>
              <Tag color={sourceMeta.color}>{sourceMeta.label}</Tag>
              {record.sourceRef || record.cashOutNumber || record.code || record.referenceNumber ? (
                <div className="ims-cell-meta" style={{ marginTop: 4 }}>
                  Ref: {record.sourceRef || record.cashOutNumber || record.code || record.referenceNumber}
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        title: "Tipe",
        dataIndex: "type",
        key: "type",
        render: (value) => value || "-",
      },
      {
        title: "Deskripsi",
        dataIndex: "description",
        key: "description",
        render: (value) => value || "-",
      },
      {
        title: "Aktual Keluar",
        dataIndex: "amount",
        key: "amount",
        render: (value) => formatCurrencyId(value),
      },
      {
        title: "Total Referensi",
        dataIndex: "totalReferenceAmount",
        key: "totalReferenceAmount",
        render: (value, record) => {
          if (record.sourceModule !== "purchases" && !value) {
            return "-";
          }

          return formatCurrencyId(value);
        },
      },
      {
        title: "Saving / Selisih",
        dataIndex: "savingAmount",
        key: "savingAmount",
        render: (value, record) => {
          if (record.sourceModule !== "purchases" && !record.savingLabel) {
            return "-";
          }

          const meta = getSavingMeta(value);
          return <Tag color={meta.color}>{meta.label}</Tag>;
        },
      },
      {
        title: "Supplier",
        dataIndex: "supplierName",
        key: "supplierName",
        render: (value) => value || "-",
      },
      {
        // IMS NOTE [AKTIF/GUARDED] - Action button ledger Cash Out.
        // Fungsi blok: menampilkan aksi hapus dalam layout vertical agar sejajar dengan tabel lain.
        // Hubungan flow: hanya UI; Popconfirm dan handler delete tetap sama.
        title: "Aksi",
        key: "action",
        width: 140,
        className: "app-table-action-column",
        render: (_, record) => {
          const sourceMeta = resolveExpenseSourceMeta(record);

          if (!sourceMeta.deletable) {
            return <Tag color={sourceMeta.color}>Otomatis</Tag>;
          }

          return (
            <Space direction="vertical" size={6} className="ims-action-group ims-action-group--vertical">
              <Popconfirm
                title="Yakin hapus transaksi ini?"
                onConfirm={() => handleDeleteTransaction(record.id)}
                okText="Ya"
                cancelText="Tidak"
              >
                <Button className="ims-action-button" danger icon={<DeleteOutlined />}>
                  Hapus
                </Button>
              </Popconfirm>
            </Space>
          );
        },
      },
    ],
    [],
  );

  const cashOutMobileCardConfig = {
    title: (record) => record.description || record.type || 'Pengeluaran',
    subtitle: (record) => [
      formatDateId(record.date),
      record.sourceRef || record.cashOutNumber || record.code || record.referenceNumber || null,
    ].filter(Boolean),
    tags: (record) => {
      const sourceMeta = resolveExpenseSourceMeta(record);
      const savingMeta = record.sourceModule === 'purchases' || record.savingLabel ? getSavingMeta(record.savingAmount) : null;
      return [
        <Tag key="source" color={sourceMeta.color}>{sourceMeta.label}</Tag>,
        savingMeta ? <Tag key="saving" color={savingMeta.color}>{savingMeta.label}</Tag> : null,
      ].filter(Boolean);
    },
    meta: [
      { label: 'Aktual Keluar', value: (record) => formatCurrencyId(record.amount || 0) },
      { label: 'Total Ref', value: (record) => {
        if (record.sourceModule !== 'purchases' && !record.totalReferenceAmount) return '-';
        return formatCurrencyId(record.totalReferenceAmount || 0);
      } },
      { label: 'Supplier', value: (record) => record.supplierName || '-' },
    ],
    actions: (record) => {
      const sourceMeta = resolveExpenseSourceMeta(record);

      if (!sourceMeta.deletable) {
        return <Tag color={sourceMeta.color}>Otomatis</Tag>;
      }

      return (
        <Space direction="vertical" size={6} className="ims-action-group ims-action-group--vertical">
          <Popconfirm
            title="Yakin hapus transaksi ini?"
            onConfirm={() => handleDeleteTransaction(record.id)}
            okText="Ya"
            cancelText="Tidak"
          >
            <Button className="ims-action-button" danger icon={<DeleteOutlined />}>
              Hapus
            </Button>
          </Popconfirm>
        </Space>
      );
    },
  };

  /* =====================================================
     SECTION: Cash Out Render Panel — GUARDED
     Fungsi:
     - Menata ringkasan, filter, tabel, dan form pengeluaran agar nominal, sumber otomatis/manual, supplier, payroll, dan selisih pembelian jelas.

     Dipakai oleh:
     - Halaman Cash Out.

     Alasan perubahan:
     - Batch 3 merapikan panel kas keluar tanpa mengubah purchase/payroll linkage, expense mapping, delete guard, atau service call.

     Catatan cleanup:
     - Detail drawer source expense bisa dibuat terpisah jika audit otomatis/manual makin kompleks.

     Risiko:
     - Jangan mengubah cash posting, paid payroll guard, purchase expense, report mapping, atau callback action dari section ini.
     ===================================================== */
  return (
    <>
      <PageHeader
        title="Pengeluaran Kas"
        subtitle="Pengeluaran manual dan otomatis."
        actions={[
          {
            key: "add-cash-out",
            type: "primary",
            icon: <PlusOutlined />,
            label: "Tambah Pengeluaran",
            onClick: openCreateModal,
          },
        ]}
      />


      <PageSection
        title="Ringkasan Periode"
        subtitle="KPI periode aktif."
        extra={(
          <InfoPopoverButton
            label="Payroll Otomatis"
            title="Payroll paid masuk Cash Out"
            description="Payroll produksi yang sudah paid akan tercatat sebagai Cash Out otomatis. Jangan input manual lagi agar tidak dobel biaya."
            items={[
              { label: 'Payroll paid', value: 'Masuk otomatis.' },
              { label: 'Manual input', value: 'Untuk biaya non-payroll.' },
              { label: 'Anti dobel', value: 'Cek referensi sebelum simpan.' },
            ]}
          />
        )}
      >
        <SummaryStatGrid
          items={summaryItems}
          columns={{ xs: 24, sm: 12, md: 12, lg: 6 }}
          variant="finance"
          highlightKey="actual-expense"
          className="cash-flow-summary"
        />
      </PageSection>

      <PageSection
        title="Filter Pengeluaran"
        subtitle="Filter periode."
      >
        <FilterBar>
          <Col xs={24} md={6}>
            <Select
              value={selectedYear}
              onChange={setSelectedYear}
              className="ims-filter-control"
              placeholder="Pilih tahun"
            >
              {yearOptions.map((year) => (
                <Option key={year} value={year}>
                  {year}
                </Option>
              ))}
            </Select>
          </Col>

          <Col xs={24} md={6}>
            <Select
              value={selectedMonth}
              onChange={setSelectedMonth}
              className="ims-filter-control"
              placeholder="Pilih bulan"
            >
              <Option value="all">Semua Bulan</Option>
              {MONTH_OPTIONS.map((monthOption) => (
                <Option key={monthOption.value} value={monthOption.value}>
                  {monthOption.label}
                </Option>
              ))}
            </Select>
          </Col>
        </FilterBar>
      </PageSection>

      <PageSection
        title="Daftar Pengeluaran"
        subtitle="Transaksi periode."
        extra={<Tag color="red">{formatNumberId(filteredCashOuts.length)} baris</Tag>}
      >
        <DataRefreshIndicator loading={loading} dataSource={filteredCashOuts} />
        <DataTableView
          showRefreshIndicator={false}
          className="app-data-table"
          rowKey="id"
          dataSource={filteredCashOuts}
          columns={columns}
          locale={{
            emptyText: getDataTableEmptyText(loading, <EmptyStateBlock description="Belum ada pengeluaran pada periode ini." />),
          }}
          mobileCardConfig={cashOutMobileCardConfig}
        />
      </PageSection>

      <PageFormModal
        title="Tambah Pengeluaran"
        open={modalVisible}
        onCancel={closeCreateModal}
        form={form}
        onFinish={handleAddTransaction}
      >
        <Form.Item
          name="type"
          label="Tipe Pengeluaran"
          rules={[{ required: true, message: "Harap pilih tipe pengeluaran!" }]}
          initialValue="Biaya Lain-lain"
        >
          <Select placeholder="Pilih Tipe">
            <Option value="Pembelian">Pembelian</Option>
            <Option value="Gaji">Gaji</Option>
            <Option value="Biaya Operasional">Biaya Operasional</Option>
            <Option value="Biaya Lain-lain">Biaya Lain-lain</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="amount"
          label="Jumlah"
          rules={[{ required: true, message: "Harap masukkan jumlah!" }]}
        >
          {/* AKTIF/GUARDED: class shared menjaga lebar field form kas keluar tetap konsisten tanpa ubah payload transaksi. */}
          <InputNumber
            min={0}
            step={1}
            precision={0}
            className="ims-filter-control"
            addonBefore="Rp"
            formatter={(value) => formatNumberId(value)}
            parser={parseIntegerIdInput}
          />
        </Form.Item>

        <Form.Item
          name="description"
          label="Deskripsi"
          rules={[{ required: true, message: "Harap masukkan deskripsi!" }]}
        >
          <Input.TextArea rows={3} />
        </Form.Item>

        <Form.Item
          name="date"
          label="Tanggal"
          rules={[{ required: true, message: "Harap pilih tanggal!" }]}
          initialValue={dayjs()}
        >
          <DatePicker className="ims-filter-control" />
        </Form.Item>
      </PageFormModal>
    </>
  );
};

export default CashOut;
