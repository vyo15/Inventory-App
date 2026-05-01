import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Table,
  Tag,
  message,
} from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import dayjs from "dayjs";
import SummaryStatGrid from "../../components/Layout/Display/SummaryStatGrid";
import EmptyStateBlock from "../../components/Layout/Feedback/EmptyStateBlock";
import FilterBar from "../../components/Layout/Filters/FilterBar";
import PageFormModal from "../../components/Layout/Forms/PageFormModal";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import { db } from "../../firebase";
import { formatCurrencyId } from "../../utils/formatters/currencyId";
import { formatDateId } from "../../utils/formatters/dateId";
import { formatNumberId } from "../../utils/formatters/numberId";

const { Option } = Select;

const MONTH_OPTIONS = Array.from({ length: 12 }).map((_, index) => ({
  label: dayjs().month(index).format("MMMM"),
  value: index,
}));

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

  const currentYear = dayjs().year();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState("all");

  // =========================
  // SECTION: Sinkronisasi data expense
  // Catatan business rule:
  // - halaman ini tetap membaca collection expenses
  // - purchase expense otomatis dan cash out manual tetap berada di source yang sama
  // =========================
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "expenses"), orderBy("date", "desc")),
      (snapshot) => {
        const data = snapshot.docs.map((documentItem) => ({
          id: documentItem.id,
          ...documentItem.data(),
        }));
        setCashOuts(data);
        setLoading(false);
      },
      (error) => {
        console.error("Gagal sinkronisasi data kas keluar:", error);
        message.error("Gagal memuat data kas keluar.");
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  // =========================
  // SECTION: Derived data filter & summary
  // =========================
  const yearOptions = useMemo(() => {
    const availableYears = cashOuts
      .map((item) => (item.date?.toDate ? dayjs(item.date.toDate()).year() : null))
      .filter(Boolean);

    return [...new Set([currentYear, ...availableYears])].sort((left, right) => right - left);
  }, [cashOuts, currentYear]);

  const filteredCashOuts = useMemo(() => {
    return cashOuts.filter((item) => {
      if (!item.date?.toDate) return false;

      const itemDate = dayjs(item.date.toDate());
      const matchesYear = itemDate.year() === selectedYear;
      const matchesMonth =
        selectedMonth === "all" ? true : itemDate.month() === Number(selectedMonth);

      return matchesYear && matchesMonth;
    });
  }, [cashOuts, selectedMonth, selectedYear]);

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
        title: "Total Pengeluaran Aktual",
        value: formatCurrencyId(summary.totalActualExpense),
        subtitle: "Semua expense pada periode aktif.",
        accent: "danger",
      },
      {
        key: "purchase-expense",
        title: "Total Belanja Pembelian",
        value: formatCurrencyId(summary.totalPurchaseExpense),
        subtitle: "Bagian pengeluaran yang berasal dari modul purchases.",
        accent: "warning",
      },
      {
        key: "payroll-expense",
        title: "Total Payroll Produksi",
        value: formatCurrencyId(summary.totalPayrollExpense),
        subtitle: "Cash Out otomatis dari payroll produksi yang ditandai paid.",
        accent: "primary",
      },
      {
        key: "purchase-saving",
        title: "Saving Pembelian",
        value:
          summary.totalSaving < 0
            ? `- ${formatCurrencyId(Math.abs(summary.totalSaving))}`
            : formatCurrencyId(summary.totalSaving),
        subtitle: "Saving hanya informasi efisiensi, bukan pengurang kas keluar.",
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
      await addDoc(collection(db, "expenses"), {
        amount: Math.round(Number(values.amount || 0)),
        description: values.description,
        date: Timestamp.fromDate(values.date.toDate()),
        type: values.type,
        totalReferenceAmount: 0,
        savingAmount: 0,
        savingStatus: "normal",
        savingLabel: "Sesuai Referensi",
        sourceModule: "cash_out_manual",
        createdAt: Timestamp.now(),
      });

      message.success("Transaksi pengeluaran berhasil ditambahkan!");
      closeCreateModal();
    } catch (error) {
      console.error("Gagal menambahkan transaksi kas keluar:", error);
      message.error("Gagal menambahkan transaksi kas keluar.");
    }
  };

  const handleDeleteTransaction = async (id) => {
    try {
      await deleteDoc(doc(db, "expenses", id));
      message.success("Transaksi berhasil dihapus.");
    } catch (error) {
      console.error("Gagal menghapus transaksi:", error);
      message.error("Gagal menghapus transaksi.");
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
              {record.sourceRef ? (
                <div className="ims-cell-meta" style={{ marginTop: 4 }}>
                  Ref: {record.sourceRef}
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
        title: "Aksi",
        key: "action",
        width: 140,
        className: "app-table-action-column",
        render: (_, record) => {
          const sourceMeta = resolveExpenseSourceMeta(record);

          if (!sourceMeta.deletable) {
            return <Tag color={sourceMeta.color}>Read Only</Tag>;
          }

          return (
            <Popconfirm
              title="Yakin hapus transaksi ini?"
              onConfirm={() => handleDeleteTransaction(record.id)}
              okText="Ya"
              cancelText="Tidak"
            >
              <Button danger icon={<DeleteOutlined />}>
                Hapus
              </Button>
            </Popconfirm>
          );
        },
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Pengeluaran Kas"
        subtitle="Pantau expense manual, pembelian otomatis, dan payroll produksi paid yang otomatis masuk expenses dengan source reference."
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

      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message="Payroll Produksi paid otomatis masuk Cash Out dengan guard sourceModule/sourceId."
        description="Baris sumber Payroll Produksi dibuat otomatis dari payroll paid, memakai sourceRef nomor payroll, dan read-only agar tidak double expense."
      />

      <PageSection
        title="Ringkasan Periode"
        subtitle="Kartu ringkasan mengikuti tahun dan bulan yang dipilih pada filter."
      >
        <SummaryStatGrid items={summaryItems} columns={{ xs: 24, sm: 12, md: 12, lg: 6 }} />
      </PageSection>

      <PageSection
        title="Filter Pengeluaran"
        subtitle="Gunakan periode untuk mempersempit tampilan expense tanpa mengubah data transaksi."
      >
        <FilterBar>
          <Col xs={24} md={6}>
            <Select
              value={selectedYear}
              onChange={setSelectedYear}
              style={{ width: "100%" }}
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
              style={{ width: "100%" }}
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
        subtitle="Saving pembelian tetap ditampilkan sebagai informasi efisiensi sesuai business rule aktif."
        extra={<Tag color="red">{formatNumberId(filteredCashOuts.length)} baris</Tag>}
      >
        <Table
          className="app-data-table"
          rowKey="id"
          dataSource={filteredCashOuts}
          columns={columns}
          loading={loading}
          locale={{
            emptyText: <EmptyStateBlock description="Belum ada pengeluaran pada periode ini." />,
          }}
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
          <InputNumber
            min={0}
            style={{ width: "100%" }}
            addonBefore="Rp"
            formatter={(value) => formatNumberId(value)}
            parser={(value) => value?.replace(/\./g, "") || ""}
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
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>
      </PageFormModal>
    </>
  );
};

export default CashOut;
