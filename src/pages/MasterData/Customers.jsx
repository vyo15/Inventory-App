import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Form,
  Input,
  Space,
  Popconfirm,
  message,
} from "antd";
import { PlusOutlined, EditOutlined } from "@ant-design/icons";
import {
  createCustomer,
  deleteCustomer,
  getCustomers,
  updateCustomer,
} from "../../services/MasterData/customersService";
import PageFormModal from "../../components/Layout/Forms/PageFormModal";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";

const Customers = () => {
  // =========================
  // SECTION: State halaman customer
  // Fungsi:
  // - menyimpan data tabel, loading, modal, mode edit, dan form
  // Hubungan flow:
  // - data dari halaman ini menjadi referensi dropdown customer di Sales
  // Status:
  // - aktif dipakai melalui route /customers
  // =========================
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [form] = Form.useForm();

  // =========================
  // SECTION: Fetch customer final
  // Fungsi:
  // - membaca semua customer lewat customersService sebagai satu pintu data
  // Hubungan flow:
  // - Master Customer dan Sales memakai helper yang sama agar tidak ada source of truth ganda
  // Status:
  // - aktif/final
  // - collection `Customers` uppercase adalah legacy/data uji dan tidak lagi dibaca
  // =========================
  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const data = await getCustomers();
      setCustomers(data);
    } catch (error) {
      console.error("Gagal ambil data customer:", error);
      message.error("Gagal mengambil data customer.");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // =========================
  // SECTION: Tambah atau update customer
  // Fungsi:
  // - menyimpan customer baru atau perubahan customer ke collection final yang sama
  // Hubungan flow:
  // - memastikan customer yang dibuat di master langsung bisa dibaca Sales
  // Status:
  // - aktif/final
  // =========================
  const handleAddOrEditCustomer = async (values) => {
    try {
      if (isEditing && currentId) {
        await updateCustomer(currentId, values);
        message.success("Customer berhasil diubah!");
      } else {
        await createCustomer(values);
        message.success("Customer berhasil ditambahkan!");
      }
      form.resetFields();
      setIsModalVisible(false);
      setIsEditing(false);
      setCurrentId(null);
      fetchCustomers();
    } catch (error) {
      console.error("Gagal simpan customer:", error);
      message.error("Gagal menyimpan customer.");
    }
  };

  // =========================
  // SECTION: Hapus customer
  // Fungsi:
  // - menghapus customer lewat customersService dari collection final `customers`
  // Hubungan flow:
  // - tidak menyentuh sales lama; sale tetap menyimpan snapshot customerName agar histori tidak rusak
  // Status:
  // - aktif dipakai
  // =========================
  const handleDelete = async (id) => {
    try {
      await deleteCustomer(id);
      message.success("Customer dihapus");
      fetchCustomers();
    } catch (error) {
      console.error("Gagal hapus customer:", error);
      message.error("Gagal menghapus customer");
    }
  };

  // =========================
  // SECTION: Masuk mode edit
  // Fungsi:
  // - mengisi form dengan data customer yang dipilih
  // Hubungan flow:
  // - hanya mengubah master customer, tidak mengubah snapshot customerName pada transaksi lama
  // Status:
  // - aktif dipakai
  // =========================
  const handleEdit = (record) => {
    setIsEditing(true);
    setIsModalVisible(true);
    setCurrentId(record.id);
    form.setFieldsValue({
      name: record.name,
      contact: record.contact,
      address: record.address,
      note: record.note,
    });
  };

  // =========================
  // SECTION: Kolom tabel customer
  // Fungsi:
  // - menampilkan data master customer dan aksi edit/hapus
  // Hubungan flow:
  // - customer adalah master referensi untuk Sales, bukan transaksi kas/stok
  // Status:
  // - aktif dipakai
  // =========================
  const columns = [
    { title: "Nama Customer", dataIndex: "name", key: "name" },
    { title: "Kontak", dataIndex: "contact", key: "contact" },
    { title: "Alamat", dataIndex: "address", key: "address" },
    { title: "Catatan", dataIndex: "note", key: "note" },
    {
      title: "Aksi",
      key: "actions",
      width: 170,
      className: "app-table-action-column",
      render: (_, record) => (
        <Space direction="vertical" size={6} className="ims-action-group ims-action-group--vertical">
          <Button
            className="ims-action-button"
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Yakin hapus customer ini?"
            onConfirm={() => handleDelete(record.id)}
            okText="Ya"
            cancelText="Batal"
          >
            <Button className="ims-action-button" danger size="small">
              Hapus
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-container">
      <PageHeader
        title="Customer"
        subtitle="Kelola master customer yang dipakai oleh modul Sales tanpa memecah source data customer aktif."
        actions={[
          {
            key: "create-customer",
            type: "primary",
            icon: <PlusOutlined />,
            label: "Tambah Customer",
            onClick: () => {
              setIsModalVisible(true);
              setIsEditing(false);
              setCurrentId(null);
              form.resetFields();
            },
          },
        ]}
      />

      <PageSection
        title="Daftar Customer"
        subtitle="Data di sini menjadi referensi dropdown customer pada flow penjualan aktif."
      >
        <Table
          className="app-data-table"
          columns={columns}
          dataSource={customers}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </PageSection>

      <PageFormModal
        title={isEditing ? "Edit Customer" : "Tambah Customer"}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setIsEditing(false);
          setCurrentId(null);
          form.resetFields();
        }}
        okText="Simpan"
        cancelText="Batal"
        form={form}
        onFinish={handleAddOrEditCustomer}
      >
        <Form.Item
          name="name"
          label="Nama Customer"
          rules={[{ required: true, message: "Nama wajib diisi" }]}
        >
          <Input placeholder="Contoh: Budi Santoso" />
        </Form.Item>
        <Form.Item
          name="contact"
          label="Kontak"
          rules={[{ required: true, message: "Kontak wajib diisi" }]}
        >
          <Input placeholder="Nomor HP / Email" />
        </Form.Item>
        <Form.Item name="address" label="Alamat">
          <Input.TextArea placeholder="Alamat lengkap" />
        </Form.Item>
        <Form.Item name="note" label="Catatan">
          <Input.TextArea placeholder="Catatan tambahan (opsional)" />
        </Form.Item>
      </PageFormModal>
    </div>
  );
};

export default Customers;
