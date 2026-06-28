import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Form,
  Input,
  message,
} from "antd";
import { EditOutlined, PlusOutlined } from "@ant-design/icons";
import PageFormModal from "../../components/Layout/Forms/PageFormModal";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import DataTableView from "../../components/Layout/Table/DataTableView";
import TableActionMenu from "../../components/Layout/Table/TableActionMenu";
import { DataRefreshIndicator, getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";
import {
  createCustomer,
  deleteCustomer,
  generateCustomerCode,
  listCustomers,
  updateCustomer,
} from "../../data/repositories/customersRepository";
import { REPOSITORY_MODES } from "../../data/repositories/repositoryMode";
import { getRepositoryModeStatus } from "../../data/repositories/repositoryModeService";
import {
  resolveCustomerDisplayCode,
  resolveCustomerFormCode,
} from "../../utils/references/customerCodeReference";

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [repositoryMode, setRepositoryMode] = useState(REPOSITORY_MODES.SQLITE_SIDECAR);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [customerCodeLoading, setCustomerCodeLoading] = useState(false);
  const [form] = Form.useForm();

  const getModeOptions = useCallback((mode = repositoryMode) => ({ mode }), [repositoryMode]);
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const modeStatus = await getRepositoryModeStatus();
      setRepositoryMode(modeStatus.mode);
      const data = await listCustomers(getModeOptions(modeStatus.mode));
      setCustomers(data);
    } catch (error) {
      console.error("Gagal ambil data customer:", error);
      message.error("Gagal mengambil data customer.");
    } finally {
      setLoading(false);
    }
  }, [getModeOptions]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const prepareCreateCustomerForm = async () => {
    setIsEditing(false);
    setCurrentId(null);
    setIsModalVisible(true);
    form.resetFields();
    setCustomerCodeLoading(true);

    try {
      const modeStatus = await getRepositoryModeStatus();
      setRepositoryMode(modeStatus.mode);
      const generatedCode = await generateCustomerCode({}, getModeOptions(modeStatus.mode));
      form.setFieldsValue({ code: generatedCode, customerCode: generatedCode });
    } catch (error) {
      console.error("Gagal membuat kode customer otomatis:", error);
      message.error(error?.message || "Gagal membuat kode customer otomatis.");
    } finally {
      setCustomerCodeLoading(false);
    }
  };

  const handleAddOrEditCustomer = async (values) => {
    try {
      if (isEditing && currentId) {
        await updateCustomer(currentId, values, getModeOptions());
        message.success("Customer berhasil diubah!");
      } else {
        await createCustomer(values, getModeOptions());
        message.success("Customer berhasil ditambahkan!");
      }
      form.resetFields();
      setIsModalVisible(false);
      setIsEditing(false);
      setCurrentId(null);
      fetchCustomers();
    } catch (error) {
      console.error("Gagal simpan customer:", error);
      if (error?.type === "validation" && error.errors) {
        form.setFields(
          Object.entries(error.errors).map(([name, errorMessage]) => ({
            name,
            errors: [errorMessage],
          })),
        );
        message.error(Object.values(error.errors)[0] || "Data customer belum valid.");
        return;
      }
      message.error(error?.message || "Gagal menyimpan customer.");
    }
  };

  const handleDeactivate = async (id) => {
    try {
      await deleteCustomer(id, getModeOptions());
      message.success("Customer berhasil dinonaktifkan.");
      fetchCustomers();
    } catch (error) {
      console.error("Gagal menonaktifkan customer:", error);
      message.error(error?.message || "Gagal menonaktifkan customer");
    }
  };

  const handleEdit = (record) => {
    setIsEditing(true);
    setIsModalVisible(true);
    setCurrentId(record.id);
    form.setFieldsValue({
      code: resolveCustomerFormCode(record),
      customerCode: resolveCustomerFormCode(record),
      name: record.name,
      contact: record.contact,
      address: record.address,
      note: record.note,
    });
  };

  const columns = [
    { title: "Kode", dataIndex: "code", key: "code", render: (_, record) => resolveCustomerDisplayCode(record) },
    { title: "Nama Customer", dataIndex: "name", key: "name" },
    { title: "Kontak", dataIndex: "contact", key: "contact" },
    { title: "Alamat", dataIndex: "address", key: "address" },
    { title: "Catatan", dataIndex: "note", key: "note" },
    {
      title: "Aksi",
      key: "actions",
      width: 126,
      className: "app-table-action-column",
      render: (_, record) => (
        <TableActionMenu
          visibleActions={[
            {
              key: "edit",
              label: "Edit",
              icon: <EditOutlined />,
              onClick: () => handleEdit(record),
            },
          ]}
          moreActions={[
            {
              key: "deactivate",
              label: "Nonaktifkan",
              danger: true,
              confirm: {
                title: "Nonaktifkan customer ini?",
                okText: "Ya",
                cancelText: "Batal",
              },
              onClick: () => handleDeactivate(record.id),
            },
          ]}
        />
      ),
    },
  ];

  const customerMobileCardConfig = {
    title: (record) => record.name || '-',
    subtitle: (record) => [resolveCustomerDisplayCode(record), record.contact || null].filter(Boolean),
    meta: [
      { label: 'Kontak', value: (record) => record.contact || '-' },
      { label: 'Kode', value: (record) => resolveCustomerDisplayCode(record) },
    ],
    content: (record) => [
      record.address ? <span key="address">Alamat: {record.address}</span> : null,
      record.note ? <span key="note">Catatan: {record.note}</span> : null,
    ].filter(Boolean),
    primaryActions: (record) => [
      {
        key: "edit",
        label: "Edit",
        icon: <EditOutlined />,
        onClick: () => handleEdit(record),
      },
    ],
    moreActions: (record) => [
      {
        key: "deactivate",
        label: "Nonaktifkan",
        danger: true,
        confirm: {
          title: "Nonaktifkan customer ini?",
          okText: "Ya",
          cancelText: "Batal",
        },
        onClick: () => handleDeactivate(record.id),
      },
    ],
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Customer"
        subtitle="Kelola data customer untuk penjualan dan riwayat transaksi."
        actions={[
          {
            key: "create-customer",
            type: "primary",
            icon: <PlusOutlined />,
            label: "Tambah Customer",
            onClick: prepareCreateCustomerForm,
          },
        ]}
      />


      <PageSection
        title="Daftar Customer"
        subtitle="Daftar customer aktif dan informasi kontak utama."
      >
        <DataRefreshIndicator loading={loading} dataSource={customers} />
        <DataTableView
          showRefreshIndicator={false}
          className="app-data-table"
          columns={columns}
          dataSource={customers}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: getDataTableEmptyText(
              loading,
              "Belum ada customer aktif. Tambahkan customer pertama dari halaman ini.",
            ),
          }}
          mobileCardConfig={customerMobileCardConfig}
        />
      </PageSection>

      <PageFormModal
        title={isEditing ? "Edit Customer" : "Tambah Customer"}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setIsEditing(false);
          setCurrentId(null);
          setCustomerCodeLoading(false);
          form.resetFields();
        }}
        okText="Simpan"
        cancelText="Batal"
        form={form}
        onFinish={handleAddOrEditCustomer}
        confirmLoading={customerCodeLoading}
      >
        <Form.Item
          name="code"
          label="Kode Customer"
          extra={isEditing ? "Kode customer tidak bisa diubah setelah dibuat agar audit tetap konsisten." : "Kode customer dibuat otomatis dengan format CUS-DDMMYYYY-001 dan dikunci untuk audit."}
        >
          <Input disabled readOnly placeholder={customerCodeLoading ? "Membuat kode otomatis..." : "Kode dibuat otomatis"} />
        </Form.Item>
        <Form.Item name="customerCode" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="name" label="Nama Customer" rules={[{ required: true, message: "Nama wajib diisi" }]}>
          <Input placeholder="Contoh: Budi Santoso" />
        </Form.Item>
        <Form.Item name="contact" label="Kontak" rules={[{ required: true, message: "Kontak wajib diisi" }]}>
          <Input placeholder="Nomor HP / kontak" />
        </Form.Item>
        <Form.Item name="address" label="Alamat">
          <Input.TextArea placeholder="Alamat customer" />
        </Form.Item>
        <Form.Item name="note" label="Catatan">
          <Input.TextArea placeholder="Catatan customer" />
        </Form.Item>
      </PageFormModal>
    </div>
  );
};

export default Customers;
