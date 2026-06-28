import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import {
  AppstoreOutlined,
  DownOutlined,
  EditOutlined,
  FolderOutlined,
  PlusOutlined,
  RightOutlined,
} from "@ant-design/icons";
import PageFormModal from "../../components/Layout/Forms/PageFormModal";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import { DataRefreshIndicator } from "../../components/Layout/Feedback/DataLoadingState";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "../../data/repositories/categoriesRepository";
import {
  CATEGORY_TYPES,
  CATEGORY_TYPE_OPTIONS,
} from "../../constants/categoryOptions";
import {
  buildCategoryTree,
  filterCategoriesByType,
  getCategoryById,
  getCategorySummaryByType,
  getCategoryTypeMeta,
} from "../../utils/categories/categoryHelpers";
import "./Categories.css";

const { Text, Title } = Typography;

const recordMatchesSearch = (record = {}, search = "") => {
  const keyword = String(search || "").trim().toLowerCase();
  if (!keyword) return true;
  return [record.name, record.description, record.notes]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(keyword));
};

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState(CATEGORY_TYPES.PRODUCT_FORM);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [expandedIds, setExpandedIds] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [pendingParentId, setPendingParentId] = useState(null);
  const [form] = Form.useForm();

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listCategories();
      setCategories(list);
      setExpandedIds((current) => {
        const rootIds = list.filter((item) => !item.parentId).map((item) => String(item.id));
        return current.length > 0 ? current.filter((id) => rootIds.includes(String(id))) : rootIds;
      });
    } catch (error) {
      console.error("Gagal mengambil kategori:", error);
      message.error(error?.message || "Gagal mengambil data kategori dan kelompok.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const activeTypeMeta = getCategoryTypeMeta(activeType);
  const summaryByType = useMemo(() => getCategorySummaryByType(categories), [categories]);
  const activeTypeCategories = useMemo(
    () => filterCategoriesByType(categories, activeType),
    [categories, activeType],
  );
  const activeTree = useMemo(
    () => buildCategoryTree(categories, activeType),
    [categories, activeType],
  );
  const visibleTree = useMemo(() => activeTree
    .map((root) => {
      const rootStatusMatches = statusFilter === "all" || root.status === statusFilter;
      const rootSearchMatches = recordMatchesSearch(root, search);
      const visibleChildren = (root.children || []).filter((child) => {
        const statusMatches = statusFilter === "all" || child.status === statusFilter;
        return statusMatches && (rootSearchMatches || recordMatchesSearch(child, search));
      });
      const keepRoot = (rootStatusMatches && rootSearchMatches) || visibleChildren.length > 0;
      return keepRoot ? { ...root, children: visibleChildren } : null;
    })
    .filter(Boolean), [activeTree, search, statusFilter]);

  const selectedCategory = getCategoryById(categories, selectedId);
  const selectedParent = selectedCategory?.parentId
    ? getCategoryById(categories, selectedCategory.parentId)
    : null;
  const rootParentOptions = useMemo(
    () => filterCategoriesByType(categories, activeType, { rootsOnly: true })
      .filter((item) => item.status === "active" && String(item.id) !== String(editingRecord?.id || ""))
      .map((item) => ({ value: item.id, label: item.name })),
    [categories, activeType, editingRecord?.id],
  );

  useEffect(() => {
    if (selectedCategory && selectedCategory.type === activeType) return;
    const firstCategory = activeTypeCategories[0] || null;
    setSelectedId(firstCategory?.id || null);
  }, [activeType, activeTypeCategories, selectedCategory]);

  const closeModal = () => {
    setIsModalVisible(false);
    setEditingRecord(null);
    setPendingParentId(null);
    form.resetFields();
  };

  const openCreate = (parentId = null) => {
    setEditingRecord(null);
    setPendingParentId(parentId);
    form.setFieldsValue({
      name: "",
      parentId: parentId || null,
      description: "",
      sortOrder: 0,
    });
    setIsModalVisible(true);
  };

  const openEdit = (record) => {
    setEditingRecord(record);
    setPendingParentId(record.parentId || null);
    form.setFieldsValue({
      name: record.name,
      parentId: record.parentId || null,
      description: record.description || "",
      sortOrder: Number(record.sortOrder || 0),
    });
    setIsModalVisible(true);
  };

  const handleSave = async (values) => {
    try {
      const payload = {
        ...values,
        type: activeType,
        parentId: values.parentId || null,
        status: editingRecord?.status || "active",
      };
      const saved = editingRecord?.id
        ? await updateCategory(editingRecord.id, payload)
        : await createCategory(payload);

      message.success(editingRecord?.id ? "Kategori berhasil diperbarui." : "Kategori berhasil ditambahkan.");
      closeModal();
      await fetchCategories();
      setSelectedId(saved?.id || editingRecord?.id || null);
    } catch (error) {
      console.error("Gagal menyimpan kategori:", error);
      message.error(error?.message || "Gagal menyimpan kategori.");
    }
  };

  const handleDeactivate = async (record) => {
    try {
      await deleteCategory(record.id);
      message.success("Kategori berhasil dinonaktifkan.");
      await fetchCategories();
      setSelectedId(record.id);
    } catch (error) {
      console.error("Gagal menonaktifkan kategori:", error);
      message.error(error?.message || "Kategori belum dapat dinonaktifkan.");
    }
  };

  const handleActivate = async (record) => {
    try {
      await updateCategory(record.id, {
        ...record,
        type: activeType,
        parentId: record.parentId || null,
        status: "active",
      });
      message.success("Kategori berhasil diaktifkan kembali.");
      await fetchCategories();
      setSelectedId(record.id);
    } catch (error) {
      console.error("Gagal mengaktifkan kategori:", error);
      message.error(error?.message || "Kategori belum dapat diaktifkan.");
    }
  };

  const toggleExpanded = (id) => {
    setExpandedIds((current) => (
      current.includes(String(id))
        ? current.filter((item) => item !== String(id))
        : [...current, String(id)]
    ));
  };

  const renderCategoryRow = (record, { isChild = false, hasChildren = false } = {}) => {
    const selected = String(selectedId || "") === String(record.id);
    const expanded = expandedIds.includes(String(record.id));
    const typeMeta = getCategoryTypeMeta(record.type);

    return (
      <button
        key={record.id}
        type="button"
        className={`category-tree-row${isChild ? " category-tree-row--child" : ""}${selected ? " is-selected" : ""}${record.status === "inactive" ? " is-inactive" : ""}`}
        onClick={() => setSelectedId(record.id)}
      >
        <span className="category-tree-row__toggle">
          {hasChildren ? (
            <span
              role="button"
              tabIndex={0}
              aria-label={expanded ? "Tutup subkategori" : "Buka subkategori"}
              onClick={(event) => {
                event.stopPropagation();
                toggleExpanded(record.id);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  toggleExpanded(record.id);
                }
              }}
            >
              {expanded ? <DownOutlined /> : <RightOutlined />}
            </span>
          ) : <span className="category-tree-row__spacer" />}
        </span>
        <span className="category-tree-row__icon">
          {isChild ? <AppstoreOutlined /> : <FolderOutlined />}
        </span>
        <span className="category-tree-row__content">
          <span className="category-tree-row__name">{record.name}</span>
          <span className="category-tree-row__meta">
            {record.usageCount || 0} {typeMeta.itemLabel}
            {record.status === "inactive" ? " · Nonaktif" : ""}
          </span>
        </span>
        {record.status === "inactive" ? <Tag>Nonaktif</Tag> : null}
      </button>
    );
  };

  return (
    <div className="page-container category-workspace-page">
      <PageHeader
        title="Kategori & Kelompok"
        subtitle="Kelola bentuk produk, jenis bunga, kelompok bahan, dan kelompok komponen produksi bunga flanel."
        actions={[
          {
            key: "create-category",
            type: "primary",
            icon: <PlusOutlined />,
            label: activeTypeMeta.createLabel,
            onClick: () => openCreate(),
          },
        ]}
      />

      <div className="category-summary-strip" aria-label="Ringkasan kategori">
        {summaryByType.map((item) => (
          <div key={item.value} className="category-summary-strip__item">
            <strong>{item.count}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <PageSection
        title="Pusat Kategori"
        subtitle="Setiap tab berdiri sendiri. Satuan beli, warna, ukuran, dan jumlah tangkai tidak dimasukkan sebagai kategori."
      >
        <DataRefreshIndicator loading={loading} dataSource={categories} />

        <Segmented
          block
          className="category-scope-tabs"
          value={activeType}
          onChange={(value) => {
            setActiveType(value);
            setSearch("");
            setStatusFilter("all");
            setSelectedId(null);
          }}
          options={CATEGORY_TYPE_OPTIONS.map((item) => ({
            value: item.value,
            label: item.label,
          }))}
        />

        <div className="category-scope-description">
          <Text strong>{activeTypeMeta.label}</Text>
          <Text type="secondary">{activeTypeMeta.description}</Text>
        </div>

        <Row gutter={[12, 12]} className="category-workspace-filters">
          <Col xs={24} md={16}>
            <Input.Search
              allowClear
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Cari ${activeTypeMeta.label.toLowerCase()}...`}
            />
          </Col>
          <Col xs={24} md={8}>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "Semua Status" },
                { value: "active", label: "Aktif" },
                { value: "inactive", label: "Nonaktif" },
              ]}
            />
          </Col>
        </Row>

        <div className="category-workspace-grid">
          <Card className="category-tree-panel" size="small" title={activeTypeMeta.label}>
            {visibleTree.length > 0 ? (
              <div className="category-tree-list">
                {visibleTree.map((root) => {
                  const children = root.children || [];
                  const expanded = expandedIds.includes(String(root.id));
                  return (
                    <div key={root.id} className="category-tree-group">
                      {renderCategoryRow(root, { hasChildren: children.length > 0 })}
                      {expanded ? children.map((child) => renderCategoryRow(child, { isChild: true })) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={search || statusFilter !== "all"
                  ? "Tidak ada kategori yang sesuai filter."
                  : `Belum ada ${activeTypeMeta.label}. Contoh: ${activeTypeMeta.examples}.`}
              >
                {!search && statusFilter === "all" ? (
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate()}>
                    {activeTypeMeta.createLabel}
                  </Button>
                ) : null}
              </Empty>
            )}
          </Card>

          <Card className="category-detail-panel" size="small" title="Detail">
            {selectedCategory && selectedCategory.type === activeType ? (
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <div>
                  <Space size={8} wrap>
                    <Title level={4} style={{ margin: 0 }}>{selectedCategory.name}</Title>
                    <Tag color={selectedCategory.status === "active" ? "blue" : "default"}>
                      {selectedCategory.status === "active" ? "Aktif" : "Nonaktif"}
                    </Tag>
                  </Space>
                  <Text type="secondary">
                    {selectedParent ? `Subkategori dari ${selectedParent.name}` : "Kategori utama"}
                  </Text>
                </div>

                <div className="category-detail-metrics">
                  <div>
                    <strong>{selectedCategory.usageCount || 0}</strong>
                    <span>Digunakan</span>
                  </div>
                  <div>
                    <strong>{selectedCategory.childCount || 0}</strong>
                    <span>Subkategori</span>
                  </div>
                </div>

                <div className="category-detail-description">
                  <Text type="secondary">Keterangan</Text>
                  <Text>{selectedCategory.description || "Belum ada keterangan."}</Text>
                </div>

                <Space wrap>
                  <Button icon={<EditOutlined />} onClick={() => openEdit(selectedCategory)}>
                    Edit
                  </Button>
                  {!selectedCategory.parentId && selectedCategory.status === "active" ? (
                    <Button icon={<PlusOutlined />} onClick={() => openCreate(selectedCategory.id)}>
                      Tambah Subkategori
                    </Button>
                  ) : null}
                  {selectedCategory.status === "inactive" ? (
                    <Button type="primary" onClick={() => handleActivate(selectedCategory)}>
                      Aktifkan
                    </Button>
                  ) : (
                    <Popconfirm
                      title="Nonaktifkan kategori ini?"
                      description="Kategori yang masih digunakan atau memiliki subkategori aktif akan ditolak oleh sistem."
                      onConfirm={() => handleDeactivate(selectedCategory)}
                      okText="Nonaktifkan"
                      cancelText="Batal"
                    >
                      <Button danger>Nonaktifkan</Button>
                    </Popconfirm>
                  )}
                </Space>
              </Space>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Pilih kategori untuk melihat detail." />
            )}
          </Card>
        </div>
      </PageSection>

      <PageFormModal
        title={editingRecord
          ? `Edit ${activeTypeMeta.singularLabel}`
          : pendingParentId
            ? `Tambah Subkategori ${activeTypeMeta.singularLabel}`
            : activeTypeMeta.createLabel}
        open={isModalVisible}
        onCancel={closeModal}
        okText="Simpan"
        cancelText="Batal"
        form={form}
        onFinish={handleSave}
      >
        <Form.Item
          name="name"
          label="Nama"
          rules={[{ required: true, message: "Nama wajib diisi." }]}
        >
          <Input placeholder={`Contoh: ${activeTypeMeta.examples.split(",")[0]}`} />
        </Form.Item>
        <Form.Item
          name="parentId"
          label="Kelompok Induk"
          tooltip="Opsional. Struktur dibatasi maksimal kategori utama dan satu tingkat subkategori."
        >
          <Select
            allowClear
            placeholder="Tanpa induk / kategori utama"
            disabled={Boolean(editingRecord?.childCount)}
            options={rootParentOptions}
          />
        </Form.Item>
        <Form.Item name="description" label="Keterangan">
          <Input.TextArea rows={3} placeholder="Keterangan singkat agar kategori mudah dipahami." />
        </Form.Item>
        <Form.Item name="sortOrder" label="Urutan" tooltip="Angka lebih kecil tampil lebih dahulu.">
          <InputNumber min={0} precision={0} style={{ width: "100%" }} />
        </Form.Item>
      </PageFormModal>
    </div>
  );
};

export default Categories;
