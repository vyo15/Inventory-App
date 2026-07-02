import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  App as AntdApp,
  Form,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import StatusTag from "../../components/Layout/Feedback/StatusTag";
import { formatCurrencyId } from "../../utils/formatters/currencyId";
import { formatDateId } from "../../utils/formatters/dateId";
import { formatNumberId } from "../../utils/formatters/numberId";
import { createCashInTransaction, listenCashInRecords } from "../../services/Finance/financeService";
import { compareRecordsByDateDesc, upsertRecordById } from "../../utils/state/recordCollectionState";
import CashFlowPageShell from "./components/CashFlowPageShell";
import {
  buildFinanceRecordYearOptions,
  filterFinanceRecordsByPeriod,
  getCurrentFinanceYear,
} from "./helpers/financePeriodHelpers";

// IMS NOTE [AKTIF/GUARDED] - Standar input angka bulat
// Fungsi blok: mengarahkan InputNumber aktif ke step 1, precision 0, dan parser integer Indonesia.
// Hubungan flow: hanya membatasi input/display UI; service calculation stok, kas, HPP, payroll, dan report tidak diubah.
// Alasan logic: IMS operasional memakai angka tanpa desimal, sementara data historis decimal tidak dimigrasi otomatis.
// Behavior: input baru no-decimal; business rules dan schema/alur data utama tetap sama.

const { Text } = Typography;


const CashIn = () => {
  const { message } = AntdApp.useApp();
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
  const currentYear = getCurrentFinanceYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState("all");

  // =========================
  // SECTION: Sinkronisasi data pemasukan
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
  const yearOptions = useMemo(
    () => buildFinanceRecordYearOptions(cashIns, currentYear),
    [cashIns, currentYear],
  );

  const filteredCashIns = useMemo(
    () => filterFinanceRecordsByPeriod(cashIns, {
      year: selectedYear,
      month: selectedMonth,
    }),
    [cashIns, selectedMonth, selectedYear],
  );

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
      const savedTransaction = await createCashInTransaction(values);
      setCashIns((current) => upsertRecordById(current, savedTransaction, {
        comparator: compareRecordsByDateDesc,
      }));
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
            ? <StatusTag tone="success">Penjualan Selesai</StatusTag>
            : record.sourceCollection === "revenues"
              ? <Tag color="blue">Manual / Arsip</Tag>
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
        // Hubungan flow: Auto Penjualan dari incomes dan Manual/arsip dari revenues tetap dibaca seperti sebelumnya.
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
        <StatusTag key="source" tone="success">Penjualan Selesai</StatusTag>
      ) : record.sourceCollection === 'revenues' ? (
        <Tag key="source" color="blue">Manual / Arsip</Tag>
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
    <CashFlowPageShell
      header={{
        title: "Pemasukan Kas",
        subtitle: "Pemasukan manual dan sales.",
        actionKey: "add-cash-in",
        actionLabel: "Tambah Pemasukan",
        onAdd: openCreateModal,
      }}
      summary={{
        items: summaryItems,
        columns: { xs: 24, md: 8 },
        highlightKey: "total-cash-in",
        extra: null,
      }}
      filter={{
        title: "Filter Pemasukan",
        selectedYear,
        selectedMonth,
        yearOptions,
        onYearChange: setSelectedYear,
        onMonthChange: setSelectedMonth,
      }}
      table={{
        title: "Daftar Pemasukan",
        countTagColor: "blue",
        rows: filteredCashIns,
        loading,
        columns,
        tableLayout: "fixed",
        mobileCardConfig: cashInMobileCardConfig,
        emptyText: "Belum ada pemasukan pada periode ini.",
      }}
      formModal={{
        title: "Tambah Pemasukan",
        open: modalVisible,
        onCancel: closeCreateModal,
        form,
        onFinish: handleAddTransaction,
        typeLabel: "Tipe Pemasukan",
        typeRequiredMessage: "Harap pilih tipe pemasukan!",
        typeOptions: ["Penjualan", "Pendapatan Lain-lain"],
        defaultType: "Pendapatan Lain-lain",
      }}
    />
  );

};

export default CashIn;
