import React, { useCallback, useEffect, useState } from "react";
import {
  Table,
  Button,
  Form,
  Input,
  Space,
  Popconfirm,
  message,
  Tag,
} from "antd";
import { PlusOutlined, EditOutlined } from "@ant-design/icons";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "../../data/repositories/categoriesRepository";
import { REPOSITORY_MODES } from "../../data/repositories/repositoryMode";
import { getRepositoryModeStatus } from "../../data/repositories/repositoryModeService";
import PageFormModal from "../../components/Layout/Forms/PageFormModal";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import { DataRefreshIndicator, getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";

const sortCategoriesByName = (items = []) =>
  [...items].sort((first, second) =>
    String(first.name || "").localeCompare(String(second.name || ""))
  );

const getDatabaseModeLabel = (mode) =>
  mode === REPOSITORY_MODES.OFFLINE_LOCAL ? "offline_local" : "firebase_primary";

const getDatabaseModeTagColor = (mode) =>
  mode === REPOSITORY_MODES.OFFLINE_LOCAL ? "warning" : "processing";

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modeLoading, setModeLoading] = useState(true);
  const [databaseMode, setDatabaseMode] = useState(REPOSITORY_MODES.FIREBASE_PRIMARY);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [form] = Form.useForm();

  const resolveRepositoryOptions = useCallback(
    (mode = databaseMode) => ({ mode }),
    [databaseMode]
  );

  const fetchCategories = useCallback(async () => {
    setLoading(true);

    try {
      const repositoryStatus = await getRepositoryModeStatus();
      const nextMode = repositoryStatus.mode || REPOSITORY_MODES.FIREBASE_PRIMARY;
      const data = await listCategories(resolveRepositoryOptions(nextMode));

      setDatabaseMode(nextMode);
      setCategories(sortCategoriesByName(data));
    } catch (error) {
      console.error("Gagal ambil data kategori:", error);
      message.error("Gagal mengambil data kategori.");
    } finally {
      setLoading(false);
      setModeLoading(false);
    }
  }, [resolveRepositoryOptions]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleAddOrEditCategory = async (values) => {
    try {
      if (isEditing && currentId) {
        await updateCategory(currentId, values, resolveRepositoryOptions());
        message.success("Kategori berhasil diubah!");
      } else {
        await createCategory(values, resolveRepositoryOptions());
        message.success("Kategori berhasil ditambahkan!");
      }

      form.resetFields();
      setIsModalVisible(false);
      setIsEditing(false);
      setCurrentId(null);
      fetchCategories();
    } catch (error) {
      console.error("Gagal simpan kategori:", error);
      message.error("Gagal menyimpan kategori.");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteCategory(id, resolveRepositoryOptions());
      message.success(
        databaseMode === REPOSITORY_MODES.OFFLINE_LOCAL
          ? "Kategori ditandai hapus di local DB"
          : "Kategori dihapus"
      );
      fetchCategories();
    } catch (error) {
      console.error("Gagal hapus kategori:", error);
      message.error("Gagal menghapus kategori");
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
      // =========================
      // SECTION: aksi tabel
      // Fungsi:
      // - Categories termasuk simple config page, jadi cukup Edit + Hapus tanpa Detail
      // - kolom aksi tetap memakai marker baseline final agar visual dan spacing konsisten lintas halaman
      // =========================
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
            title="Yakin hapus kategori ini?"
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
        subtitle="Master kategori."
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

      <PageSection
        title="Daftar Kategori"
        subtitle="Referensi kategori."
      >
        <DataRefreshIndicator loading={loading} dataSource={categories} />
        <Space size={8} wrap style={{ marginBottom: 12 }}>
          <Tag color={getDatabaseModeTagColor(databaseMode)}>
            DB: {modeLoading ? "checking..." : getDatabaseModeLabel(databaseMode)}
          </Tag>
          <Button size="small" onClick={fetchCategories} loading={loading}>
            Refresh
          </Button>
        </Space>
        <Table
          className="app-data-table"
          columns={columns}
          dataSource={categories}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: getDataTableEmptyText(loading) }}
        />
      </PageSection>

      {/* =====================================================
          SECTION: Category Form Modal — AKTIF
          Fungsi:
          - Menampilkan form kategori yang ringkas untuk nama dan deskripsi.

          Dipakai oleh:
          - Halaman Master Data / Kategori saat tambah atau edit data.

          Alasan perubahan:
          - Batch 13 mulai memakai repository pilot agar mode Firebase/local bisa diuji tanpa mengganti route.

          Catatan cleanup:
          - Belum ada.

          Risiko:
          - Jangan ubah payload kategori, validation, atau handler simpan dari section presentasi ini.
      ===================================================== */}
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
        <Form.Item
          name="name"
          label="Nama Kategori"
          rules={[{ required: true, message: "Nama wajib diisi" }]}
        >
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
