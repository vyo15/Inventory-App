import React, { useCallback, useEffect, useState } from "react";
import {
  Button,
  Form,
  Input,
  Popconfirm,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import { EditOutlined, PlusOutlined } from "@ant-design/icons";
import PageFormModal from "../../components/Layout/Forms/PageFormModal";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import { DataRefreshIndicator, getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "../../data/repositories/categoriesRepository";
import { REPOSITORY_MODES } from "../../data/repositories/repositoryMode";
import { getRepositoryModeStatus } from "../../data/repositories/repositoryModeService";

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [repositoryMode, setRepositoryMode] = useState(REPOSITORY_MODES.FIREBASE_PRIMARY);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [form] = Form.useForm();

  const getModeOptions = useCallback((mode = repositoryMode) => ({ mode }), [repositoryMode]);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const modeStatus = await getRepositoryModeStatus();
      setRepositoryMode(modeStatus.mode);
      const list = await listCategories(getModeOptions(modeStatus.mode));
      setCategories(list);
    } catch (error) {
      console.error("Gagal ambil data:", error);
      message.error("Gagal mengambil data kategori.");
    } finally {
      setLoading(false);
    }
  }, [getModeOptions]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleAddOrEditCategory = async (values) => {
    try {
      if (isEditing && currentId) {
        await updateCategory(currentId, values, getModeOptions());
        message.success("Kategori berhasil diubah!");
      } else {
        await createCategory(values, getModeOptions());
        message.success("Kategori berhasil ditambahkan!");
      }
      form.resetFields();
      setIsModalVisible(false);
      setIsEditing(false);
      setCurrentId(null);
      fetchCategories();
    } catch (error) {
      console.error("Gagal simpan kategori:", error);
      message.error(error?.message || "Gagal menyimpan kategori.");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteCategory(id, getModeOptions());
      message.success(repositoryMode === REPOSITORY_MODES.OFFLINE_LOCAL ? "Kategori ditandai hapus di local DB" : "Kategori dihapus");
      fetchCategories();
    } catch (error) {
      console.error("Gagal hapus kategori:", error);
      message.error(error?.message || "Gagal menghapus kategori");
    }
  };

  const handleEdit = (record) => {
    setIsEditing(true);
    setIsModalVisible(true);
    setCurrentId(record.id);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
    });
  };

  const columns = [
    {
      title: "Nama Kategori",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "Deskripsi",
      dataIndex: "description",
      key: "description",
    },
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
            title={repositoryMode === REPOSITORY_MODES.OFFLINE_LOCAL ? "Tandai hapus kategori di local DB?" : "Yakin hapus kategori ini?"}
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
        title="Kategori"
        subtitle="Master kategori. Default tetap Firebase; offline hanya aktif saat pilot dev diaktifkan."
        extra={<Tag color={repositoryMode === REPOSITORY_MODES.OFFLINE_LOCAL ? "gold" : "blue"}>DB: {repositoryMode}</Tag>}
        actions={[
          {
            key: "create-category",
            type: "primary",
            icon: <PlusOutlined />,
            label: "Tambah Kategori",
            onClick: () => {
              setIsModalVisible(true);
              setIsEditing(false);
              setCurrentId(null);
              form.resetFields();
            },
          },
        ]}
      />

      <PageSection title="Daftar Kategori" subtitle="Referensi kategori.">
        <DataRefreshIndicator loading={loading} dataSource={categories} />
        <Table
          className="app-data-table"
          columns={columns}
          dataSource={categories}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: getDataTableEmptyText(loading) }}
        />
      </PageSection>

      <PageFormModal
        title={isEditing ? "Edit Kategori" : "Tambah Kategori"}
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
        onFinish={handleAddOrEditCategory}
      >
        <Form.Item name="name" label="Nama Kategori" rules={[{ required: true, message: "Nama wajib diisi" }]}>
          <Input placeholder="Contoh: Bouquet, Aksesoris, Dekorasi" />
        </Form.Item>
        <Form.Item name="description" label="Deskripsi">
          <Input.TextArea placeholder="Catatan kategori" />
        </Form.Item>
      </PageFormModal>
    </div>
  );
};

export default Categories;
