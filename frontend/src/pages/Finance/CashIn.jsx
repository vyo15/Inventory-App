import React, { useEffect, useMemo, useState } from "react";
import {
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Tag,
  Typography,
  message,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import EmptyStateBlock from "../../components/Layout/Feedback/EmptyStateBlock";
import FilterBar from "../../components/Layout/Filters/FilterBar";
import PageFormModal from "../../components/Layout/Forms/PageFormModal";
import SummaryStatGrid from "../../components/Layout/Display/SummaryStatGrid";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import DataTableView from "../../components/Layout/Table/DataTableView";
import { formatCurrencyId } from "../../utils/formatters/currencyId";
import { formatDateId } from "../../utils/formatters/dateId";
import { formatNumberId, parseIntegerIdInput } from "../../utils/formatters/numberId";
import { createCashInTransaction, listenCashInRecords } from "../../services/Finance/financeService";
import { DataRefreshIndicator, getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";


// IMS NOTE [AKTIF/GUARDED] - Standar input angka bulat
// Fungsi blok: mengarahkan InputNumber aktif ke step 1, precision 0, dan parser integer Indonesia.
// Hubungan flow: hanya membatasi input/display UI; service calculation stok, kas, HPP, payroll, dan report tidak diubah.
// Alasan logic: IMS operasional memakai angka tanpa desimal, sementara data lama decimal tidak dimigrasi otomatis.
// Behavior: input baru no-decimal; business rules dan schema/database runtime tetap sama.

const { Option } = Select;
const { Text } = Typography;

// =========================
// SECTION: Konstanta tampilan periode
// Fungsi:
// - menjaga filter bulan dan label bulan tetap konsisten
// - menghindari penulisan ulang array bulan di beberapa halaman finance
// =========================
const MONTH_OPTIONS = Array.from({ length: 12 }).map((_, index) => ({
  label: dayjs().month(index).format("MMMM"),
  value: index,
}));

const CashIn = () => {
  // =========================
  // SECTION: State utama halaman
  // =========================
  const [cashIns, setCashIns] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form] = Form.useForm();

  // =========================
  // SECTION: Filter periode
  // =========================
  const currentYear = dayjs().year();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState("all");

  // =========================
  // SECTION: Sinkronisasi data pemasukan SQLite
  // =========================
  useEffect(() => {
    setLoading(true);
    const unsubscribe = listenCashInRecords(
      (rows) => {
        setCashIns(rows);
        setLoading(false);
      },
      (error) => {
        console.error("Gagal sinkronisasi data cash-in lokal:", error);
        setCashIns([]);
        setLoading(false);
      },
    );

    return () => unsubscribe?.();
  }, []);

  // =========================
  // SECTION: Derived data filter & summary
  // =========================
  const yearOptions = useMemo(() => {
    const availableYears = cashIns
      .map((item) => (item.date?.toDate ? dayjs(item.date.toDate()).year() : null))
      .filter(Boolean);

    return [...new Set([currentYear, ...availableYears])].sort((left, right) => right - left);
  }, [cashIns, currentYear]);

  const filteredCashIns = useMemo(() => {
    return cashIns.filter((item) => {
      if (!item.date?.toDate) return false;

      const itemDate = dayjs(item.date.toDate());
      const matchesYear = itemDate.year() === selectedYear;
      const matchesMonth =
        selectedMonth === "all" ? true : itemDate.month() === Number(selectedMonth);

      return matchesYear && matchesMonth;
    });
  }, [cashIns, selectedMonth, selectedYear]);

  const summary = useMemo(() => {
    return filteredCashIns.reduce(
      (accumulator, item) => {
        const amount = Math.round(Number(item.amount || 0));
        accumulator.totalAmount += amount;
        accumulator.totalTransactions += 1;

        if ((item.type || "").toLowerCase() === "penjualan") {
          accumulator.totalSalesIncome += amount;
        } else {
          accumulator.totalOtherIncome += amount;
        }

        return accumulator;
      },
      {
        totalAmount: 0,
        totalTransactions: 0,
        totalSalesIncome: 0,
        totalOtherIncome: 0,
      },
    );
  }, [filteredCashIns]);

  const summaryItems = useMemo(
    () => [
      {
        key: "total-cash-in",
        title: "Total Pemasukan",
        value: formatCurrencyId(summary.totalAmount),
        subtitle: "Akumulasi cash-in periode aktif.",
        accent: "primary",
      },
      {
        key: "cash-in-count",
        title: "Transaksi",
        value: formatNumberId(summary.totalTransactions),
        subtitle: "Jumlah cash-in tercatat.",
        accent: "success",
      },
      {
        key: "sales-income",
        title: "Dari Penjualan",
        value: formatCurrencyId(summary.totalSalesIncome),
        subtitle: "Sales selesai.",
        accent: "warning",
      },
      {
        key: "other-income",
        title: "Pemasukan Lain",
        value: formatCurrencyId(summary.totalOtherIncome),
        subtitle: "Selain penjualan selesai.",
        accent: "neutral",
      },
    ],
    [summary],
  );

  // =========================
  // SECTION: Handler form pemasukan manual
  // =========================
  const openCreateModal = () => {
    setModalVisible(true);
    form.resetFields();
    form.setFieldsValue({
      type: "Pendapatan Lain-lain",
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
      await createCashInTransaction(values);
      message.success("Transaksi pemasukan berhasil ditambahkan!");
      closeCreateModal();
    } catch (error) {
      console.error("Gagal menambahkan transaksi kas masuk:", error);
      message.error(error?.message || "Gagal menambahkan transaksi kas masuk.");
    }
  };




  /* =====================================================
  SECTION: Kolom tabel Cash In compact — AKTIF / GUARDED
  Fungsi:
  - Merapikan ledger pemasukan agar tidak membutuhkan horizontal scroll pada desktop normal.
  - Menggabungkan tipe + sumber data dalam satu kolom dan menjaga nominal tetap mudah discan.

  Dipakai oleh:
  - Halaman Finance / Pemasukan Kas yang membaca revenues + incomes.

  Alasan perubahan:
  - Cash In adalah ledger read page tanpa row action destructive; table tidak perlu scroll horizontal hanya untuk metadata pendek.

  Catatan cleanup:
  - Bila nanti audit detail transaksi dibuat, action Detail bisa ditambahkan sebagai drawer read-only, bukan delete/edit langsung.

  Risiko:
  - Jangan mengubah merge revenues/incomes, collection write pemasukan manual, atau status tanpa aksi delete dari section UI ini.
  ===================================================== */
  const columns = useMemo(
    () => [
      {
        title: "Tanggal",
        dataIndex: "date",
        key: "date",
        width: 132,
        render: (value) => formatDateId(value),
      },
      {
        title: "Sumber / Tipe",
        key: "sourceType",
        width: 220,
        render: (_, record) => {
          const sourceTag = record.sourceCollection === "incomes"
            ? <Tag color="green">Penjualan Selesai</Tag>
            : record.sourceCollection === "revenues"
              ? <Tag color="blue">Manual / Data Lama</Tag>
              : <Tag>-</Tag>;

          return (
            <div className="ims-cell-stack ims-cell-stack-tight">
              <div>{sourceTag}</div>
              <Text type="secondary" className="ims-cell-meta">
                {record.cashInNumber || record.code || record.sourceRef || record.referenceNumber || record.type || "-"}
              </Text>
              <Text type="secondary" className="ims-cell-meta">
                {record.type || "-"}
              </Text>
            </div>
          );
        },
      },
      {
        // IMS NOTE [AKTIF/GUARDED] - Cash In adalah ledger read page tanpa aksi delete.
        // Fungsi blok: menampilkan deskripsi transaksi dari revenues + incomes tanpa tombol destructive.
        // Hubungan flow: Auto Penjualan dari incomes dan Manual/Lama dari revenues tetap dibaca seperti sebelumnya.
        // Alasan logic: penghapusan pemasukan tidak disediakan di UI Pemasukan agar audit kas tidak mudah disalahgunakan.
        title: "Deskripsi",
        dataIndex: "description",
        key: "description",
        ellipsis: true,
        render: (value) => (
          <Text title={value || "-"} className="ims-cell-title">
            {value || "-"}
          </Text>
        ),
      },
      {
        title: "Jumlah",
        dataIndex: "amount",
        key: "amount",
        width: 180,
        align: "right",
        render: (value) => <Text strong>{formatCurrencyId(value)}</Text>,
      },
    ],
    [],
  );

  const cashInMobileCardConfig = {
    title: (record) => record.description || record.type || 'Pemasukan',
    subtitle: (record) => [
      formatDateId(record.date),
      record.cashInNumber || record.code || record.sourceRef || record.referenceNumber || null,
    ].filter(Boolean),
    tags: (record) => [
      record.sourceCollection === 'incomes' ? (
        <Tag key="source" color="green">Penjualan Selesai</Tag>
      ) : record.sourceCollection === 'revenues' ? (
        <Tag key="source" color="blue">Manual / Data Lama</Tag>
      ) : (
        <Tag key="source">-</Tag>
      ),
    ],
    meta: [
      { label: 'Jumlah', value: (record) => formatCurrencyId(record.amount || 0) },
      { label: 'Tipe', value: (record) => record.type || '-' },
    ],
  };

  /* =====================================================
     SECTION: Cash In Render Panel — GUARDED
     Fungsi:
     - Menata ringkasan, filter, tabel, dan form pemasukan agar nominal, tipe, tanggal, dan referensi sales tetap jelas.

     Dipakai oleh:
     - Halaman Cash In.

     Alasan perubahan:
     - Batch 3 merapikan panel kas masuk tanpa mengubah payload, sales linkage, report mapping, atau service call.

     Catatan cleanup:
     - Detail drawer kas masuk bisa ditambahkan jika audit source diperlukan.

     Risiko:
     - Jangan mengubah cash posting, report source, payment mapping, atau callback dari section ini.
     ===================================================== */
  return (
    <>
      <PageHeader
        title="Pemasukan Kas"
        subtitle="Pemasukan manual dan sales."
        actions={[
          {
            key: "add-cash-in",
            type: "primary",
            icon: <PlusOutlined />,
            label: "Tambah Pemasukan",
            onClick: openCreateModal,
          },
        ]}
      />

      <PageSection
        title="Ringkasan Periode"
        subtitle="KPI periode aktif."
      >
        <SummaryStatGrid
          items={summaryItems}
          columns={{ xs: 24, md: 8 }}
          variant="finance"
          highlightKey="total-cash-in"
          className="cash-flow-summary"
        />
      </PageSection>

      <PageSection
        title="Filter Pemasukan"
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
        title="Daftar Pemasukan"
        subtitle="Transaksi periode."
        extra={<Tag color="blue">{formatNumberId(filteredCashIns.length)} baris</Tag>}
      >
        <DataRefreshIndicator loading={loading} dataSource={filteredCashIns} />
        <DataTableView
          showRefreshIndicator={false}
          className="app-data-table"
          rowKey="id"
          dataSource={filteredCashIns}
          columns={columns}
          // IMS NOTE [AKTIF] - table fixed tanpa scroll horizontal; ledger tetap tanpa kolom aksi destructive.
          tableLayout="fixed"
          locale={{
            emptyText: getDataTableEmptyText(loading, <EmptyStateBlock description="Belum ada pemasukan pada periode ini." />),
          }}
          mobileCardConfig={cashInMobileCardConfig}
        />
      </PageSection>

      <PageFormModal
        title="Tambah Pemasukan"
        open={modalVisible}
        onCancel={closeCreateModal}
        form={form}
        onFinish={handleAddTransaction}
      >
        <Form.Item
          name="type"
          label="Tipe Pemasukan"
          rules={[{ required: true, message: "Harap pilih tipe pemasukan!" }]}
          initialValue="Pendapatan Lain-lain"
        >
          <Select placeholder="Pilih Tipe">
            <Option value="Penjualan">Penjualan</Option>
            <Option value="Pendapatan Lain-lain">Pendapatan Lain-lain</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="amount"
          label="Jumlah"
          rules={[{ required: true, message: "Harap masukkan jumlah!" }]}
        >
          {/* AKTIF/GUARDED: helper class shared dipakai untuk lebar kontrol form kas masuk tanpa ubah behavior transaksi. */}
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

export default CashIn;
