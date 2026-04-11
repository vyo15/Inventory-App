// =====================================================
// Page: Semi Finished Materials
// Master stok internal produksi
// Tidak dijual ke customer
// Revisi:
// - Available Stock dihitung otomatis = Current Stock - Reserved Stock
// - User tidak input manual availableStock
// =====================================================

import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  DEFAULT_SEMI_FINISHED_FORM,
  formatSemiFinishedStockSummary,
  SEMI_FINISHED_CATEGORIES,
  SEMI_FINISHED_CATEGORY_MAP,
  SEMI_FINISHED_TYPES,
  SEMI_FINISHED_TYPE_MAP,
  SEMI_FINISHED_VALUATION_METHOD_MAP,
  SEMI_FINISHED_VALUATION_METHODS,
} from "../../constants/semiFinishedMaterialOptions";
import {
  createSemiFinishedMaterial,
  getAllSemiFinishedMaterials,
  toggleSemiFinishedMaterialActive,
  updateSemiFinishedMaterial,
} from "../../services/Produksi/semiFinishedMaterialsService";

// =====================================================
// Helper formatter
// =====================================================
const formatNumber = (value) =>
  new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatCurrency = (value) =>
  `Rp ${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0))}`;

// =====================================================
// Helper hitung available stock
// =====================================================
const calculateAvailableStock = (currentStock, reservedStock) => {
  const current = Number(currentStock || 0);
  const reserved = Number(reservedStock || 0);
  return Math.max(current - reserved, 0);
};

// =====================================================
// Main Component
// =====================================================
const SemiFinishedMaterials = () => {
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [formVisible, setFormVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [editingMaterial, setEditingMaterial] = useState(null);

  const [form] = Form.useForm();

  // =====================================================
  // Load data master semi finished
  // =====================================================
  const loadData = async () => {
    try {
      setLoading(true);
      const result = await getAllSemiFinishedMaterials();
      setMaterials(result);
    } catch (error) {
      console.error(error);
      message.error("Gagal memuat data semi finished materials");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // =====================================================
  // Watch current/reserved stock untuk auto-calc available stock
  // =====================================================
  const currentStockValue = Form.useWatch("currentStock", form);
  const reservedStockValue = Form.useWatch("reservedStock", form);

  const calculatedAvailableStock = useMemo(() => {
    return calculateAvailableStock(currentStockValue, reservedStockValue);
  }, [currentStockValue, reservedStockValue]);

  // =====================================================
  // Summary cards
  // =====================================================
  const summary = useMemo(() => {
    const total = materials.length;
    const active = materials.filter((item) => item.isActive).length;
    const inactive = total - active;

    const lowStock = materials.filter((item) => {
      const available = calculateAvailableStock(
        item.currentStock,
        item.reservedStock,
      );
      const min = Number(item.minStockAlert || 0);
      return available <= min;
    }).length;

    return { total, active, inactive, lowStock };
  }, [materials]);

  // =====================================================
  // Filter data tabel
  // =====================================================
  const filteredData = useMemo(() => {
    return materials.filter((item) => {
      const searchText = search.trim().toLowerCase();

      const matchSearch =
        !searchText ||
        String(item.code || "")
          .toLowerCase()
          .includes(searchText) ||
        String(item.name || "")
          .toLowerCase()
          .includes(searchText) ||
        String(item.description || "")
          .toLowerCase()
          .includes(searchText);

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && item.isActive) ||
        (statusFilter === "inactive" && !item.isActive);

      const matchCategory =
        categoryFilter === "all" || item.category === categoryFilter;

      const matchType = typeFilter === "all" || item.type === typeFilter;

      return matchSearch && matchStatus && matchCategory && matchType;
    });
  }, [materials, search, statusFilter, categoryFilter, typeFilter]);

  // =====================================================
  // Reset form state
  // =====================================================
  const resetFormState = () => {
    setEditingMaterial(null);
    form.resetFields();
    form.setFieldsValue({
      ...DEFAULT_SEMI_FINISHED_FORM,
      availableStock: calculateAvailableStock(
        DEFAULT_SEMI_FINISHED_FORM.currentStock,
        DEFAULT_SEMI_FINISHED_FORM.reservedStock,
      ),
    });
  };

  // =====================================================
  // Buka modal tambah
  // =====================================================
  const handleAdd = () => {
    setEditingMaterial(null);
    form.setFieldsValue({
      ...DEFAULT_SEMI_FINISHED_FORM,
      availableStock: calculateAvailableStock(
        DEFAULT_SEMI_FINISHED_FORM.currentStock,
        DEFAULT_SEMI_FINISHED_FORM.reservedStock,
      ),
    });
    setFormVisible(true);
  };

  // =====================================================
  // Buka modal edit
  // =====================================================
  const handleEdit = (record) => {
    setEditingMaterial(record);

    form.setFieldsValue({
      ...DEFAULT_SEMI_FINISHED_FORM,
      ...record,
      availableStock: calculateAvailableStock(
        record.currentStock,
        record.reservedStock,
      ),
    });

    setFormVisible(true);
  };

  // =====================================================
  // Buka detail
  // =====================================================
  const handleViewDetail = (record) => {
    setSelectedMaterial(record);
    setDetailVisible(true);
  };

  // =====================================================
  // Submit create / edit
  // =====================================================
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const payload = {
        ...values,
        currentStock: Number(values.currentStock || 0),
        reservedStock: Number(values.reservedStock || 0),
        availableStock: calculateAvailableStock(
          values.currentStock,
          values.reservedStock,
        ),
        minStockAlert: Number(values.minStockAlert || 0),
        maxStockTarget:
          values.maxStockTarget === null || values.maxStockTarget === undefined
            ? null
            : Number(values.maxStockTarget || 0),
        referenceCostPerUnit: Number(values.referenceCostPerUnit || 0),
        lastProductionCostPerUnit: Number(
          values.lastProductionCostPerUnit || 0,
        ),
        averageCostPerUnit: Number(values.averageCostPerUnit || 0),
      };

      setSubmitting(true);

      if (editingMaterial?.id) {
        await updateSemiFinishedMaterial(editingMaterial.id, payload, [], null);
        message.success("Semi finished material berhasil diperbarui");
      } else {
        await createSemiFinishedMaterial(payload, [], null);
        message.success("Semi finished material berhasil ditambahkan");
      }

      setFormVisible(false);
      resetFormState();
      await loadData();
    } catch (error) {
      if (error?.errorFields) return;

      if (error?.type === "validation" && error?.errors) {
        const fields = Object.entries(error.errors).map(([name, errors]) => ({
          name,
          errors: [errors],
        }));
        form.setFields(fields);
        return;
      }

      console.error(error);
      message.error("Gagal menyimpan semi finished material");
    } finally {
      setSubmitting(false);
    }
  };

  // =====================================================
  // Toggle aktif/nonaktif
  // =====================================================
  const handleToggleActive = async (record) => {
    try {
      await toggleSemiFinishedMaterialActive(record.id, !record.isActive, null);
      message.success(
        `Semi finished material berhasil ${
          record.isActive ? "dinonaktifkan" : "diaktifkan"
        }`,
      );
      await loadData();
    } catch (error) {
      console.error(error);
      message.error("Gagal mengubah status semi finished material");
    }
  };

  // =====================================================
  // Kolom tabel
  // =====================================================
  const columns = [
    {
      title: "Kode",
      dataIndex: "code",
      key: "code",
      width: 150,
      render: (value) => (
        <Typography.Text strong>{value || "-"}</Typography.Text>
      ),
    },
    {
      title: "Nama Item",
      dataIndex: "name",
      key: "name",
      width: 220,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{record.name || "-"}</div>
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>
            {record.description || "-"}
          </div>
        </div>
      ),
    },
    {
      title: "Kategori",
      dataIndex: "category",
      key: "category",
      width: 130,
      render: (value) => <Tag>{SEMI_FINISHED_CATEGORY_MAP[value] || "-"}</Tag>,
    },
    {
      title: "Tipe",
      dataIndex: "type",
      key: "type",
      width: 140,
      render: (value) => (
        <Tag color="blue">{SEMI_FINISHED_TYPE_MAP[value] || "-"}</Tag>
      ),
    },
    {
      title: "Stok",
      key: "stock",
      width: 220,
      render: (_, record) => {
        const normalizedRecord = {
          ...record,
          availableStock: calculateAvailableStock(
            record.currentStock,
            record.reservedStock,
          ),
        };

        return (
          <Space direction="vertical" size={0}>
            <Typography.Text>
              {formatSemiFinishedStockSummary(normalizedRecord)}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Min Alert: {formatNumber(record.minStockAlert)}{" "}
              {record.unit || ""}
            </Typography.Text>
          </Space>
        );
      },
    },
    {
      title: "Biaya Rata-rata",
      dataIndex: "averageCostPerUnit",
      key: "averageCostPerUnit",
      width: 150,
      render: (value) => formatCurrency(value),
    },
    {
      title: "Status",
      dataIndex: "isActive",
      key: "isActive",
      width: 110,
      align: "center",
      render: (value) =>
        value ? (
          <Badge status="success" text="Aktif" />
        ) : (
          <Badge status="default" text="Nonaktif" />
        ),
    },
    {
      title: "Aksi",
      key: "actions",
      width: 220,
      fixed: "right",
      render: (_, record) => (
        <Space wrap>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            Detail
          </Button>

          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>

          <Popconfirm
            title={
              record.isActive ? "Nonaktifkan item ini?" : "Aktifkan item ini?"
            }
            description={
              record.isActive
                ? "Item tidak akan bisa dipilih untuk data baru."
                : "Item akan aktif kembali untuk data baru."
            }
            onConfirm={() => handleToggleActive(record)}
            okText="Ya"
            cancelText="Batal"
          >
            <Button size="small">
              {record.isActive ? "Nonaktifkan" : "Aktifkan"}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Typography.Title level={3} style={{ margin: 0 }}>
              Semi Finished Materials
            </Typography.Title>
            <Typography.Text type="secondary">
              Master stok internal produksi, tidak dijual ke customer
            </Typography.Text>
          </Col>

          <Col>
            <Space wrap>
              <Button icon={<ReloadOutlined />} onClick={loadData}>
                Refresh
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
              >
                Tambah Item
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Total Item" value={summary.total} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Item Aktif" value={summary.active} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Item Nonaktif" value={summary.inactive} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Low Stock Alert" value={summary.lowStock} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={8}>
            <Input
              placeholder="Cari kode, nama, deskripsi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>

          <Col xs={24} md={5}>
            <Select
              style={{ width: "100%" }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "Semua Status" },
                { value: "active", label: "Aktif" },
                { value: "inactive", label: "Nonaktif" },
              ]}
            />
          </Col>

          <Col xs={24} md={5}>
            <Select
              style={{ width: "100%" }}
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[
                { value: "all", label: "Semua Kategori" },
                ...SEMI_FINISHED_CATEGORIES,
              ]}
            />
          </Col>

          <Col xs={24} md={6}>
            <Select
              style={{ width: "100%" }}
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: "all", label: "Semua Tipe" },
                ...SEMI_FINISHED_TYPES,
              ]}
            />
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredData}
          scroll={{ x: 1400 }}
          locale={{
            emptyText: (
              <Empty description="Belum ada data semi finished materials" />
            ),
          }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
          }}
        />
      </Card>

      <Drawer
        title={
          editingMaterial?.id
            ? "Edit Semi Finished Material"
            : "Tambah Semi Finished Material"
        }
        open={formVisible}
        onClose={() => {
          setFormVisible(false);
          resetFormState();
        }}
        width={760}
        destroyOnClose
        extra={
          <Space>
            <Button
              onClick={() => {
                setFormVisible(false);
                resetFormState();
              }}
            >
              Batal
            </Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
              Simpan
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            ...DEFAULT_SEMI_FINISHED_FORM,
            availableStock: calculateAvailableStock(
              DEFAULT_SEMI_FINISHED_FORM.currentStock,
              DEFAULT_SEMI_FINISHED_FORM.reservedStock,
            ),
          }}
        >
          <Divider orientation="left">Informasi Dasar</Divider>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="Kode Item"
                name="code"
                rules={[{ required: true, message: "Kode wajib diisi" }]}
              >
                <Input placeholder="Contoh: SFM-KELopak-POTONG" />
              </Form.Item>
            </Col>

            <Col xs={24} md={16}>
              <Form.Item
                label="Nama Item"
                name="name"
                rules={[{ required: true, message: "Nama wajib diisi" }]}
              >
                <Input placeholder="Contoh: Kelopak Mawar Potong" />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item label="Deskripsi" name="description">
                <Input.TextArea rows={2} placeholder="Deskripsi item..." />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Kategori"
                name="category"
                rules={[{ required: true, message: "Kategori wajib dipilih" }]}
              >
                <Select options={SEMI_FINISHED_CATEGORIES} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Tipe"
                name="type"
                rules={[{ required: true, message: "Tipe wajib dipilih" }]}
              >
                <Select options={SEMI_FINISHED_TYPES} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Satuan"
                name="unit"
                rules={[{ required: true, message: "Satuan wajib diisi" }]}
              >
                <Input placeholder="Contoh: pcs" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Stok</Divider>

          <Alert
            style={{ marginBottom: 16 }}
            type="info"
            showIcon
            message="Available Stock dihitung otomatis dari Current Stock dikurangi Reserved Stock. Reserved Stock dikelola dari Production Order, bukan input manual user."
          />

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item label="Current Stock" name="currentStock">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Reserved Stock" name="reservedStock">
                <InputNumber min={0} style={{ width: "100%" }} disabled />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Available Stock">
                <Input
                  value={formatNumber(calculatedAvailableStock)}
                  disabled
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Min Stock Alert" name="minStockAlert">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Max Stock Target" name="maxStockTarget">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Status Aktif"
                name="isActive"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Biaya</Divider>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="Reference Cost / Unit"
                name="referenceCostPerUnit"
              >
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Last Production Cost / Unit"
                name="lastProductionCostPerUnit"
              >
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Average Cost / Unit" name="averageCostPerUnit">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Valuation Method" name="valuationMethod">
                <Select options={SEMI_FINISHED_VALUATION_METHODS} />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item shouldUpdate noStyle>
                {({ getFieldsValue }) => {
                  const values = getFieldsValue();
                  const normalizedValues = {
                    ...values,
                    availableStock: calculateAvailableStock(
                      values.currentStock,
                      values.reservedStock,
                    ),
                  };

                  return (
                    <Form.Item label="Ringkasan">
                      <Card size="small">
                        <Space direction="vertical" size={0}>
                          <Typography.Text>
                            {formatSemiFinishedStockSummary(normalizedValues)}
                          </Typography.Text>
                          <Typography.Text type="secondary">
                            Average Cost:{" "}
                            {formatCurrency(values.averageCostPerUnit)}
                          </Typography.Text>
                        </Space>
                      </Card>
                    </Form.Item>
                  );
                }}
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Tag & Catatan</Divider>

          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item label="Tags" name="tags">
                <Select
                  mode="tags"
                  placeholder="Contoh: mawar, potong, komponen"
                  tokenSeparators={[","]}
                />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item label="Catatan Internal" name="notes">
                <Input.TextArea rows={3} placeholder="Catatan internal..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Drawer>

      <Drawer
        title="Detail Semi Finished Material"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={620}
      >
        {!selectedMaterial ? (
          <Empty description="Tidak ada data" />
        ) : (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Kode">
              {selectedMaterial.code || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Nama">
              {selectedMaterial.name || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Deskripsi">
              {selectedMaterial.description || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Kategori">
              {SEMI_FINISHED_CATEGORY_MAP[selectedMaterial.category] || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Tipe">
              {SEMI_FINISHED_TYPE_MAP[selectedMaterial.type] || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Satuan">
              {selectedMaterial.unit || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Current Stock">
              {formatNumber(selectedMaterial.currentStock)}
            </Descriptions.Item>
            <Descriptions.Item label="Reserved Stock">
              {formatNumber(selectedMaterial.reservedStock)}
            </Descriptions.Item>
            <Descriptions.Item label="Available Stock">
              {formatNumber(
                calculateAvailableStock(
                  selectedMaterial.currentStock,
                  selectedMaterial.reservedStock,
                ),
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Min Stock Alert">
              {formatNumber(selectedMaterial.minStockAlert)}
            </Descriptions.Item>
            <Descriptions.Item label="Max Stock Target">
              {selectedMaterial.maxStockTarget === null
                ? "-"
                : formatNumber(selectedMaterial.maxStockTarget)}
            </Descriptions.Item>
            <Descriptions.Item label="Reference Cost / Unit">
              {formatCurrency(selectedMaterial.referenceCostPerUnit)}
            </Descriptions.Item>
            <Descriptions.Item label="Last Production Cost / Unit">
              {formatCurrency(selectedMaterial.lastProductionCostPerUnit)}
            </Descriptions.Item>
            <Descriptions.Item label="Average Cost / Unit">
              {formatCurrency(selectedMaterial.averageCostPerUnit)}
            </Descriptions.Item>
            <Descriptions.Item label="Valuation Method">
              {SEMI_FINISHED_VALUATION_METHOD_MAP[
                selectedMaterial.valuationMethod
              ] || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Tags">
              {Array.isArray(selectedMaterial.tags) &&
              selectedMaterial.tags.length > 0 ? (
                <Space size={[4, 4]} wrap>
                  {selectedMaterial.tags.map((item) => (
                    <Tag key={item}>{item}</Tag>
                  ))}
                </Space>
              ) : (
                "-"
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Sellable">Tidak</Descriptions.Item>
            <Descriptions.Item label="Status">
              {selectedMaterial.isActive ? "Aktif" : "Nonaktif"}
            </Descriptions.Item>
            <Descriptions.Item label="Catatan Internal">
              {selectedMaterial.notes || "-"}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};

export default SemiFinishedMaterials;
