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

const CashIn = () => {
  // SECTION: state utama
  const [cashIns, setCashIns] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);

  // SECTION: filter periode bulanan / tahunan
  const currentYear = dayjs().year();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState("all");

  // SECTION: ambil data pemasukan dari koleksi lama dan baru
  useEffect(() => {
    let revenuesLoaded = false;
    let incomesLoaded = false;
    let revenuesData = [];
    let incomesData = [];

    const syncMergedData = () => {
      if (!revenuesLoaded || !incomesLoaded) return;

      const merged = [...revenuesData, ...incomesData].sort((a, b) => {
        const aTime = a.date?.toDate ? a.date.toDate().getTime() : 0;
        const bTime = b.date?.toDate ? b.date.toDate().getTime() : 0;
        return bTime - aTime;
      });

      setCashIns(merged);
      setLoading(false);
    };

    const revenuesRef = collection(db, "revenues");
    const incomesRef = collection(db, "incomes");

    const unsubscribeRevenues = onSnapshot(
      query(revenuesRef, orderBy("date", "desc")),
      (snapshot) => {
        revenuesData = snapshot.docs.map((d) => ({
          id: d.id,
          sourceCollection: "revenues",
          ...d.data(),
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
      query(incomesRef, orderBy("date", "desc")),
      (snapshot) => {
        incomesData = snapshot.docs.map((d) => ({
          id: d.id,
          sourceCollection: "incomes",
          ...d.data(),
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

  // SECTION: opsi tahun untuk dropdown filter
  const yearOptions = useMemo(() => {
    const years = cashIns
      .map((item) =>
        item.date?.toDate ? dayjs(item.date.toDate()).year() : null,
      )
      .filter(Boolean);

    const uniqueYears = [...new Set([currentYear, ...years])].sort(
      (a, b) => b - a,
    );
    return uniqueYears;
  }, [cashIns, currentYear]);

  // SECTION: data yang ditampilkan sesuai tahun dan bulan
  const filteredCashIns = useMemo(() => {
    return cashIns.filter((item) => {
      if (!item.date?.toDate) return false;

      const itemDate = dayjs(item.date.toDate());
      const sameYear = itemDate.year() === selectedYear;
      const sameMonth =
        selectedMonth === "all"
          ? true
          : itemDate.month() === Number(selectedMonth);

      return sameYear && sameMonth;
    });
  }, [cashIns, selectedYear, selectedMonth]);

  // SECTION: ringkasan pemasukan sesuai filter periode
  const summary = useMemo(() => {
    return filteredCashIns.reduce(
      (acc, item) => {
        const amount = Math.round(Number(item.amount || 0));
        acc.totalAmount += amount;
        acc.totalTransactions += 1;

        if ((item.type || "").toLowerCase() === "penjualan") {
          acc.totalSalesIncome += amount;
        }

        return acc;
      },
      {
        totalAmount: 0,
        totalTransactions: 0,
        totalSalesIncome: 0,
      },
    );
  }, [filteredCashIns]);

  // SECTION: tambah pemasukan manual
  const handleAddTransaction = async (values) => {
    try {
      const newTransaction = {
        amount: Math.round(Number(values.amount || 0)),
        description: values.description,
        date: Timestamp.fromDate(values.date.toDate()),
        type: values.type,
        sourceModule: "cash_in_manual",
        createdAt: Timestamp.now(),
      };

      // NOTE:
      // Untuk kompatibilitas dengan laporan lama yang masih membaca revenues,
      // pemasukan manual tetap disimpan ke revenues.
      await addDoc(collection(db, "revenues"), newTransaction);

      message.success("Transaksi pemasukan berhasil ditambahkan!");
      setModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error("Gagal menambahkan transaksi kas masuk:", error);
      message.error("Gagal menambahkan transaksi kas masuk.");
    }
  };

  // SECTION: hapus pemasukan
  const handleDeleteTransaction = async (record) => {
    try {
      const targetCollection = record.sourceCollection || "revenues";
      await deleteDoc(doc(db, targetCollection, record.id));
      message.success("Transaksi berhasil dihapus.");
    } catch (error) {
      console.error("Gagal menghapus transaksi:", error);
      message.error("Gagal menghapus transaksi.");
    }
  };

  // SECTION: kolom tabel pemasukan
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
      title: "Jumlah",
      dataIndex: "amount",
      render: (amount) => formatCurrencyIDR(amount),
    },
    {
      title: "Tipe",
      dataIndex: "type",
      render: (text) => text || "-",
    },
    {
      title: "Sumber Data",
      dataIndex: "sourceCollection",
      render: (value) => {
        if (value === "incomes") return <Tag color="green">Auto Penjualan</Tag>;
        if (value === "revenues") return <Tag color="blue">Manual / Lama</Tag>;
        return <Tag>-</Tag>;
      },
    },
    {
      title: "Deskripsi",
      dataIndex: "description",
      render: (text) => text || "-",
    },
    {
      title: "Aksi",
      key: "action",
      render: (_, record) => (
        <Popconfirm
          title="Yakin hapus transaksi ini?"
          onConfirm={() => handleDeleteTransaction(record)}
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
      <h2>Pemasukan Kas</h2>

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

      {/* SECTION: ringkasan pemasukan sesuai filter */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Total Pemasukan Periode"
              value={summary.totalAmount}
              formatter={(value) => formatCurrencyIDR(value)}
            />
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Jumlah Transaksi"
              value={summary.totalTransactions}
            />
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Pemasukan dari Penjualan"
              value={summary.totalSalesIncome}
              formatter={(value) => formatCurrencyIDR(value)}
            />
          </Card>
        </Col>
      </Row>

      {/* SECTION: tombol tambah pemasukan manual */}
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => {
          setModalVisible(true);
          form.resetFields();
          form.setFieldsValue({
            type: "Pendapatan Lain-lain",
            date: dayjs(),
            amount: 0,
          });
        }}
        style={{ marginBottom: 16 }}
      >
        Tambah Pemasukan
      </Button>

      {/* SECTION: tabel pemasukan */}
      <Table
        dataSource={filteredCashIns}
        columns={columns}
        rowKey={(record) => `${record.sourceCollection}-${record.id}`}
        loading={loading}
      />

      {/* SECTION: modal tambah pemasukan manual */}
      <Modal
        title="Tambah Pemasukan"
        open={modalVisible}
        onOk={form.submit}
        onCancel={() => setModalVisible(false)}
        okText="Simpan"
        cancelText="Batal"
      >
        <Form form={form} layout="vertical" onFinish={handleAddTransaction}>
          <Form.Item
            name="type"
            label="Tipe Pemasukan"
            rules={[{ required: true, message: "Harap pilih tipe pemasukan!" }]}
            initialValue="Pendapatan Lain-lain"
          >
            <Select placeholder="Pilih Tipe">
              <Option value="Penjualan">Penjualan</Option>
              <Option value="Pendapatan Lain-lain">Pendapatan Lain-lain</Option>
              <Option value="Pinjaman">Pinjaman</Option>
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

export default CashIn;
