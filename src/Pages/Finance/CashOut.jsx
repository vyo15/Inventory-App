import React, { useState, useEffect } from "react";
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

const CashOut = () => {
  const [cashOuts, setCashOuts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [totalExpenses, setTotalExpenses] = useState(0);

  useEffect(() => {
    // --- Perbaikan: Menggunakan koleksi 'expenses'
    const expensesRef = collection(db, "expenses");
    const q = query(expensesRef, orderBy("date", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCashOuts(data);

        // --- Perbaikan: Menghitung total pengeluaran
        const total = data.reduce((sum, item) => sum + (item.amount || 0), 0);
        setTotalExpenses(total);

        setLoading(false);
      },
      (error) => {
        console.error("Gagal sinkronisasi data kas keluar:", error);
        message.error("Gagal memuat data kas keluar.");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleAddTransaction = async (values) => {
    try {
      const newTransaction = {
        amount: Number(values.amount),
        description: values.description,
        date: Timestamp.fromDate(values.date.toDate()),
        type: values.type, // Menambahkan tipe transaksi
        createdAt: Timestamp.now(),
      };
      await addDoc(collection(db, "expenses"), newTransaction); // Menambahkan ke koleksi 'expenses'
      message.success("Transaksi pengeluaran berhasil ditambahkan!");
      setModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error("Gagal menambahkan transaksi kas keluar:", error);
      message.error("Gagal menambahkan transaksi kas keluar.");
    }
  };

  const handleDeleteTransaction = async (id) => {
    try {
      await deleteDoc(doc(db, "expenses", id)); // Menghapus dari koleksi 'expenses'
      message.success("Transaksi berhasil dihapus.");
    } catch (error) {
      console.error("Gagal menghapus transaksi:", error);
      message.error("Gagal menghapus transaksi.");
    }
  };

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
      render: (amount) => `Rp ${amount?.toLocaleString() || "0"}`,
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
      title: "Aksi",
      key: "action",
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

      {/* --- Perbaikan: Menampilkan total pengeluaran */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card>
            <Statistic
              title="Total Pengeluaran Saat Ini"
              value={totalExpenses}
              precision={0}
              prefix="Rp"
            />
          </Card>
        </Col>
      </Row>

      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => {
          setModalVisible(true);
          form.resetFields();
        }}
        style={{ marginBottom: 16 }}
      >
        Tambah Pengeluaran
      </Button>
      <Table
        dataSource={cashOuts}
        columns={columns}
        rowKey="id"
        loading={loading}
      />
      <Modal
        title="Tambah Pengeluaran"
        open={modalVisible}
        onOk={form.submit}
        onCancel={() => setModalVisible(false)}
        okText="Simpan"
        cancelText="Batal"
      >
        <Form form={form} layout="vertical" onFinish={handleAddTransaction}>
          {/* --- Perbaikan: Menambahkan pilihan tipe pengeluaran */}
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
              formatter={(value) =>
                `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              }
              parser={(value) => value.replace(/Rp\s?|(,*)/g, "")}
            />
          </Form.Item>
          <Form.Item
            name="description"
            label="Deskripsi"
            rules={[{ required: true, message: "Harap masukkan deskripsi!" }]}
          >
            <Input.TextArea />
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
