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

        return accumulator;
      },
      {
        totalActualExpense: 0,
        totalReferenceExpense: 0,
        totalSaving: 0,
        totalPurchaseExpense: 0,
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
        key: "reference-expense",
        title: "Total Referensi Pembelian",
        value: formatCurrencyId(summary.totalReferenceExpense),
        subtitle: "Nilai referensi pembelian untuk pembanding efisiensi.",
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

  const columns = useMemo(
    () => [
      {
        title: "Tanggal",
        dataIndex: "date",
        key: "date",
        render: (value) => formatDateId(value),
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
        // =====================================================
        // SECTION: aksi ledger page
        // Fungsi:
        // - Cash Out tetap simple action page tanpa Detail agar tidak mengubah flow kas yang sudah aktif
        // - kolom aksi diposisikan di kanan dan dibuat sticky untuk tabel expense yang relatif lebar
        // =====================================================
        title: "Aksi",
        key: "action",
        width: 140,
        fixed: "right",
        className: "app-table-action-column",
        render: (_, record) => (
          <Space wrap className="ims-action-group">
            <Popconfirm
              title="Yakin hapus transaksi ini?"
              onConfirm={() => handleDeleteTransaction(record.id)}
              okText="Ya"
              cancelText="Tidak"
            >
              <Button className="ims-action-button" size="small" danger icon={<DeleteOutlined />}>
                Hapus
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Pengeluaran Kas"
        subtitle="Pantau expense manual dan expense otomatis dari purchases dalam pola halaman yang seragam tanpa mengubah source of truth collection expenses."
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
          // Baseline final: ledger table boleh sederhana, tetapi tetap diberi scroll.x agar fixed action selalu stabil.
          scroll={{ x: 1320 }}
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
