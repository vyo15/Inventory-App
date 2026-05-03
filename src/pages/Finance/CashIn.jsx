import React, { useEffect, useMemo, useState } from "react";
import {
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Table,
  Tag,
  message,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import dayjs from "dayjs";
import EmptyStateBlock from "../../components/Layout/Feedback/EmptyStateBlock";
import FilterBar from "../../components/Layout/Filters/FilterBar";
import PageFormModal from "../../components/Layout/Forms/PageFormModal";
import SummaryStatGrid from "../../components/Layout/Display/SummaryStatGrid";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import { db } from "../../firebase";
import { formatCurrencyId } from "../../utils/formatters/currencyId";
import { formatDateId } from "../../utils/formatters/dateId";
import { formatNumberId, parseIntegerIdInput } from "../../utils/formatters/numberId";


// IMS NOTE [AKTIF/GUARDED] - Standar input angka bulat
// Fungsi blok: mengarahkan InputNumber aktif ke step 1, precision 0, dan parser integer Indonesia.
// Hubungan flow: hanya membatasi input/display UI; service calculation stok, kas, HPP, payroll, dan report tidak diubah.
// Alasan logic: IMS operasional memakai angka tanpa desimal, sementara data lama decimal tidak dimigrasi otomatis.
// Behavior: input baru no-decimal; business rules dan schema Firestore tetap sama.

const { Option } = Select;

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
  // SECTION: Sinkronisasi data pemasukan
  // Catatan business rule:
  // - halaman ini tetap membaca revenues + incomes
  // - pemasukan manual tetap tersimpan ke revenues agar kompatibel dengan laporan lama
  // =========================
  useEffect(() => {
    let revenuesLoaded = false;
    let incomesLoaded = false;
    let revenuesData = [];
    let incomesData = [];

    const syncMergedData = () => {
      if (!revenuesLoaded || !incomesLoaded) return;

      const mergedData = [...revenuesData, ...incomesData].sort((left, right) => {
        const leftTime = left.date?.toDate ? left.date.toDate().getTime() : 0;
        const rightTime = right.date?.toDate ? right.date.toDate().getTime() : 0;
        return rightTime - leftTime;
      });

      setCashIns(mergedData);
      setLoading(false);
    };

    const unsubscribeRevenues = onSnapshot(
      query(collection(db, "revenues"), orderBy("date", "desc")),
      (snapshot) => {
        revenuesData = snapshot.docs.map((documentItem) => ({
          id: documentItem.id,
          sourceCollection: "revenues",
          ...documentItem.data(),
        }));
        revenuesLoaded = true;
        syncMergedData();
      },
      (error) => {
        console.error("Gagal sinkronisasi data revenues:", error);
        revenuesLoaded = true;
        syncMergedData();
      },
    );

    const unsubscribeIncomes = onSnapshot(
      query(collection(db, "incomes"), orderBy("date", "desc")),
      (snapshot) => {
        incomesData = snapshot.docs.map((documentItem) => ({
          id: documentItem.id,
          sourceCollection: "incomes",
          ...documentItem.data(),
        }));
        incomesLoaded = true;
        syncMergedData();
      },
      (error) => {
        console.error("Gagal sinkronisasi data incomes:", error);
        incomesLoaded = true;
        syncMergedData();
      },
    );

    return () => {
      unsubscribeRevenues();
      unsubscribeIncomes();
    };
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
        }

        return accumulator;
      },
      {
        totalAmount: 0,
        totalTransactions: 0,
        totalSalesIncome: 0,
      },
    );
  }, [filteredCashIns]);

  const summaryItems = useMemo(
    () => [
      {
        key: "total-cash-in",
        title: "Total Pemasukan Periode",
        value: formatCurrencyId(summary.totalAmount),
        subtitle: "Gabungan revenues dan incomes pada periode aktif.",
        accent: "primary",
      },
      {
        key: "cash-in-count",
        title: "Jumlah Transaksi",
        value: formatNumberId(summary.totalTransactions),
        subtitle: "Jumlah transaksi pemasukan pada periode aktif.",
        accent: "success",
      },
      {
        key: "sales-income",
        title: "Pemasukan dari Penjualan",
        value: formatCurrencyId(summary.totalSalesIncome),
        subtitle: "Pemasukan otomatis dari transaksi sales berstatus selesai.",
        accent: "warning",
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
      await addDoc(collection(db, "revenues"), {
        amount: Math.round(Number(values.amount || 0)),
        description: values.description,
        date: Timestamp.fromDate(values.date.toDate()),
        type: values.type,
        sourceModule: "cash_in_manual",
        createdAt: Timestamp.now(),
      });

      message.success("Transaksi pemasukan berhasil ditambahkan!");
      closeCreateModal();
    } catch (error) {
      console.error("Gagal menambahkan transaksi kas masuk:", error);
      message.error("Gagal menambahkan transaksi kas masuk.");
    }
  };



  // =========================
  // SECTION: Kolom tabel
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
        title: "Jumlah",
        dataIndex: "amount",
        key: "amount",
        render: (value) => formatCurrencyId(value),
      },
      {
        title: "Tipe",
        dataIndex: "type",
        key: "type",
        render: (value) => value || "-",
      },
      {
        title: "Sumber Data",
        dataIndex: "sourceCollection",
        key: "sourceCollection",
        render: (value) => {
          if (value === "incomes") return <Tag color="green">Auto Penjualan</Tag>;
          if (value === "revenues") return <Tag color="blue">Manual / Lama</Tag>;
          return <Tag>-</Tag>;
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
        render: (value) => value || "-",
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Pemasukan Kas"
        subtitle="Pantau pemasukan manual dari revenues dan pemasukan penjualan selesai dari incomes dalam satu halaman yang seragam."
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
        subtitle="Ringkasan mengikuti filter tahun dan bulan yang sedang aktif."
      >
        <SummaryStatGrid items={summaryItems} columns={{ xs: 24, md: 8 }} />
      </PageSection>

      <PageSection
        title="Filter Pemasukan"
        subtitle="Gunakan periode untuk membatasi data operasional yang tampil."
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
        subtitle="Tabel tetap membaca kombinasi data revenues dan incomes tanpa mengubah alur kas yang sudah aktif."
        extra={<Tag color="blue">{formatNumberId(filteredCashIns.length)} baris</Tag>}
      >
        <Table
          className="app-data-table"
          rowKey="id"
          dataSource={filteredCashIns}
          columns={columns}
          loading={loading}
          // IMS NOTE [AKTIF] - tabel ledger tetap scroll ringan tanpa kolom aksi destructive.
          scroll={{ x: 960 }}
          locale={{
            emptyText: <EmptyStateBlock description="Belum ada pemasukan pada periode ini." />,
          }}
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
