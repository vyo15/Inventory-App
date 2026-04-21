import React, { useEffect, useMemo, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  message,
  Popconfirm,
  Statistic,
  Row,
  Col,
  Card,
  Select,
  Tag,
} from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { db } from "../../firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  Timestamp,
  doc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import dayjs from "dayjs";

const { Option } = Select;

// SECTION: format angka Indonesia tanpa desimal
const formatNumberID = (value) => {
  return Number(value || 0).toLocaleString("id-ID", {
    maximumFractionDigits: 0,
  });
};

// SECTION: format rupiah Indonesia tanpa desimal
const formatCurrencyIDR = (value) => {
  return `Rp ${formatNumberID(value)}`;
};

// SECTION: bantu tentukan label saving di pengeluaran pembelian
const getSavingMeta = (value) => {
  const amount = Math.round(Number(value || 0));

  if (amount > 0) {
    return {
      status: "hemat",
      label: `Hemat ${formatCurrencyIDR(amount)}`,
      color: "green",
    };
  }

  if (amount < 0) {
    return {
      status: "lebih_mahal",
      label: `Lebih Mahal ${formatCurrencyIDR(Math.abs(amount))}`,
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
  // SECTION: state utama
  const [cashOuts, setCashOuts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);

  // SECTION: filter periode bulanan / tahunan
  const currentYear = dayjs().year();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState("all");

  // SECTION: ambil seluruh data pengeluaran dari firestore
  useEffect(() => {
    const expensesRef = collection(db, "expenses");
    const q = query(expensesRef, orderBy("date", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
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

  // SECTION: opsi tahun untuk dropdown
  const yearOptions = useMemo(() => {
    const years = cashOuts
      .map((item) =>
        item.date?.toDate ? dayjs(item.date.toDate()).year() : null,
      )
      .filter(Boolean);

    return [...new Set([currentYear, ...years])].sort((a, b) => b - a);
  }, [cashOuts, currentYear]);

  // SECTION: filter data berdasarkan tahun dan bulan
  const filteredCashOuts = useMemo(() => {
    return cashOuts.filter((item) => {
      if (!item.date?.toDate) return false;

      const itemDate = dayjs(item.date.toDate());
      const sameYear = itemDate.year() === selectedYear;
      const sameMonth =
        selectedMonth === "all"
          ? true
          : itemDate.month() === Number(selectedMonth);

      return sameYear && sameMonth;
    });
  }, [cashOuts, selectedYear, selectedMonth]);

  // SECTION: ringkasan kartu statistik pengeluaran sesuai filter
  const summary = useMemo(() => {
    return filteredCashOuts.reduce(
      (acc, item) => {
        const amount = Math.round(Number(item.amount || 0));
        const referenceAmount = Math.round(
          Number(item.totalReferenceAmount || 0),
        );
        const savingAmount = Math.round(Number(item.savingAmount || 0));

        acc.totalActualExpense += amount;
        acc.totalReferenceExpense += referenceAmount;
        acc.totalSaving += savingAmount;

        if (
          item.sourceModule === "purchases" ||
          item.type === "Pembelian Bahan/Barang"
        ) {
          acc.totalPurchaseExpense += amount;
        }

        return acc;
      },
      {
        totalActualExpense: 0,
        totalReferenceExpense: 0,
        totalSaving: 0,
        totalPurchaseExpense: 0,
      },
    );
  }, [filteredCashOuts]);

  // SECTION: tambah pengeluaran manual
  const handleAddTransaction = async (values) => {
    try {
      const newTransaction = {
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
      };

      await addDoc(collection(db, "expenses"), newTransaction);
      message.success("Transaksi pengeluaran berhasil ditambahkan!");
      setModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error("Gagal menambahkan transaksi kas keluar:", error);
      message.error("Gagal menambahkan transaksi kas keluar.");
    }
  };

  // SECTION: hapus pengeluaran
  const handleDeleteTransaction = async (id) => {
    try {
      await deleteDoc(doc(db, "expenses", id));
      message.success("Transaksi berhasil dihapus.");
    } catch (error) {
      console.error("Gagal menghapus transaksi:", error);
      message.error("Gagal menghapus transaksi.");
    }
  };

  // SECTION: kolom tabel pengeluaran
  const columns = [
    {
      title: "Tanggal",
      dataIndex: "date",
      render: (val) => {
        if (val && typeof val.toDate === "function") {
          return dayjs(val.toDate()).format("DD-MM-YYYY");
        }
        return "-";
      },
    },
    {
      title: "Tipe",
      dataIndex: "type",
      render: (text) => text || "-",
    },
    {
      title: "Deskripsi",
      dataIndex: "description",
      render: (text) => text || "-",
    },
    {
      title: "Aktual Keluar",
      dataIndex: "amount",
      render: (amount) => formatCurrencyIDR(amount),
    },
    {
      title: "Total Referensi",
      dataIndex: "totalReferenceAmount",
      render: (amount, record) => {
        if (record.sourceModule !== "purchases" && !amount) {
          return "-";
        }

        return formatCurrencyIDR(amount);
      },
    },
    {
      title: "Saving / Selisih",
      dataIndex: "savingAmount",
      render: (amount, record) => {
        if (record.sourceModule !== "purchases" && !record.savingLabel) {
          return "-";
        }

        const meta = getSavingMeta(amount);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: "Supplier",
      dataIndex: "supplierName",
      render: (text) => text || "-",
    },
    {
      // =========================
      // SECTION: aksi tabel
      // Fungsi:
      // - menyamakan tombol hapus transaksi dengan foundation tabel global
      // =========================
      title: "Aksi",
      key: "action",
      width: 140,
      className: "app-table-action-column",
      render: (_, record) => (
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
      ),
    },
  ];

  return (
    <div>
      <h2>Pengeluaran Kas</h2>

      {/* SECTION: filter periode bulanan / tahunan */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
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
            {Array.from({ length: 12 }).map((_, index) => (
              <Option key={index} value={index}>
                {dayjs().month(index).format("MMMM")}
              </Option>
            ))}
          </Select>
        </Col>
      </Row>

      {/* SECTION: ringkasan pengeluaran aktual dan saving pembelian */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="Total Pengeluaran Aktual"
              value={summary.totalActualExpense}
              precision={0}
              formatter={(value) => formatCurrencyIDR(value)}
            />
          </Card>
        </Col>

        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="Total Belanja Pembelian"
              value={summary.totalPurchaseExpense}
              precision={0}
              formatter={(value) => formatCurrencyIDR(value)}
            />
          </Card>
        </Col>

        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="Total Referensi Pembelian"
              value={summary.totalReferenceExpense}
              precision={0}
              formatter={(value) => formatCurrencyIDR(value)}
            />
          </Card>
        </Col>

        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="Saving Pembelian"
              value={summary.totalSaving}
              precision={0}
              formatter={(value) => {
                const amount = Math.round(Number(value || 0));
                if (amount < 0) {
                  return `- ${formatCurrencyIDR(Math.abs(amount))}`;
                }
                return formatCurrencyIDR(amount);
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* SECTION: tombol tambah pengeluaran manual */}
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => {
          setModalVisible(true);
          form.resetFields();
          form.setFieldsValue({
            type: "Biaya Lain-lain",
            date: dayjs(),
            amount: 0,
          });
        }}
        style={{ marginBottom: 16 }}
      >
        Tambah Pengeluaran
      </Button>

      {/* SECTION: tabel pengeluaran */}
      <Table
        className="app-data-table"
        dataSource={filteredCashOuts}
        columns={columns}
        rowKey="id"
        loading={loading}
      />

      {/* SECTION: modal tambah pengeluaran manual */}
      <Modal
        title="Tambah Pengeluaran"
        open={modalVisible}
        onOk={form.submit}
        onCancel={() => setModalVisible(false)}
        okText="Simpan"
        cancelText="Batal"
      >
        <Form form={form} layout="vertical" onFinish={handleAddTransaction}>
          <Form.Item
            name="type"
            label="Tipe Pengeluaran"
            rules={[
              { required: true, message: "Harap pilih tipe pengeluaran!" },
            ]}
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
              formatter={(value) => formatNumberID(value)}
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
        </Form>
      </Modal>
    </div>
  );
};

export default CashOut;
