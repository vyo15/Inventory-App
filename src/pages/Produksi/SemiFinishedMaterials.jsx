// =====================================================
// Page: Semi Finished Materials
// Master stok internal produksi
// Tidak dijual ke customer
// Revisi:
// - Master item tetap ringkas
// - Stok disimpan per varian warna
// - Total master dihitung otomatis dari seluruh varian
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
  Typography,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  calculateSemiFinishedTotalsFromVariants,
  DEFAULT_SEMI_FINISHED_FORM,
  DEFAULT_SEMI_FINISHED_VARIANT,
  formatSemiFinishedStockSummary,
  normalizeSemiFinishedVariants,
  SEMI_FINISHED_CATEGORIES,
  SEMI_FINISHED_CATEGORY_MAP,
  SEMI_FINISHED_COLOR_MAP,
  SEMI_FINISHED_COLOR_OPTIONS,
  SEMI_FINISHED_GROUP_OPTIONS,
  SEMI_FINISHED_GROUP_MAP,
} from "../../constants/semiFinishedMaterialOptions";
import {
  createSemiFinishedMaterial,
  getAllSemiFinishedMaterials,
  toggleSemiFinishedMaterialActive,
  updateSemiFinishedMaterial,
} from "../../services/Produksi/semiFinishedMaterialsService";

const formatNumber = (value) =>
  new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatCurrency = (value) =>
  `Rp ${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0))}`;

const normalizeFormVariants = (variants = []) => {
  const normalized = normalizeSemiFinishedVariants(variants);

  if (normalized.length > 0) {
    return normalized;
  }

  return [{ ...DEFAULT_SEMI_FINISHED_VARIANT }];
};

const buildFormValues = (record = {}) => {
  const totals = calculateSemiFinishedTotalsFromVariants(record.variants || []);

  return {
    ...DEFAULT_SEMI_FINISHED_FORM,
    ...record,
    variants: normalizeFormVariants(record.variants || []),
    currentStock: totals.currentStock || Number(record.currentStock || 0),
    reservedStock: totals.reservedStock || Number(record.reservedStock || 0),
    availableStock:
      totals.availableStock !== undefined
        ? totals.availableStock
        : Math.max(
            Number(record.currentStock || 0) - Number(record.reservedStock || 0),
            0,
          ),
    minStockAlert: totals.minStockAlert || Number(record.minStockAlert || 0),
    averageCostPerUnit:
      totals.variants.length > 0
        ? Number(totals.averageCostPerUnit || 0)
        : Number(record.averageCostPerUnit || 0),
  };
};

const SemiFinishedMaterials = () => {
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [flowerGroupFilter, setFlowerGroupFilter] = useState("all");

  const [formVisible, setFormVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [editingMaterial, setEditingMaterial] = useState(null);

  const [form] = Form.useForm();

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

  const watchedVariants = Form.useWatch("variants", form) || [];

  const calculatedTotals = useMemo(
    () => calculateSemiFinishedTotalsFromVariants(watchedVariants),
    [watchedVariants],
  );

  const summary = useMemo(() => {
    const total = materials.length;
    const active = materials.filter((item) => item.isActive).length;
    const inactive = total - active;

    const lowStock = materials.filter((item) => {
      const available = Number(item.availableStock || 0);
      const min = Number(item.minStockAlert || 0);
      return available <= min;
    }).length;

    return { total, active, inactive, lowStock };
  }, [materials]);

  const filteredData = useMemo(() => {
    return materials.filter((item) => {
      const searchText = search.trim().toLowerCase();
      const variantColorTexts = Array.isArray(item.variants)
        ? item.variants.map((variant) => SEMI_FINISHED_COLOR_MAP[variant.color] || variant.color)
        : [];

      const matchSearch =
        !searchText ||
        String(item.code || "").toLowerCase().includes(searchText) ||
        String(item.name || "").toLowerCase().includes(searchText) ||
        String(item.description || "").toLowerCase().includes(searchText) ||
        variantColorTexts.some((text) => String(text || "").toLowerCase().includes(searchText));

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && item.isActive) ||
        (statusFilter === "inactive" && !item.isActive);

      const matchCategory =
        categoryFilter === "all" || item.category === categoryFilter;

      const matchFlowerGroup =
        flowerGroupFilter === "all" || item.flowerGroup === flowerGroupFilter;

      return matchSearch && matchStatus && matchCategory && matchFlowerGroup;
    });
  }, [materials, search, statusFilter, categoryFilter, flowerGroupFilter]);

  const resetFormState = () => {
    setEditingMaterial(null);
    form.resetFields();
    form.setFieldsValue(buildFormValues(DEFAULT_SEMI_FINISHED_FORM));
  };

  const handleAdd = () => {
    setEditingMaterial(null);
    form.setFieldsValue(buildFormValues(DEFAULT_SEMI_FINISHED_FORM));
    setFormVisible(true);
  };

  const handleEdit = (record) => {
    setEditingMaterial(record);
    form.setFieldsValue(buildFormValues(record));
    setFormVisible(true);
  };

  const handleViewDetail = (record) => {
    setSelectedMaterial(record);
    setDetailVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const payload = {
        ...values,
        variants: normalizeFormVariants(values.variants || []),
        maxStockTarget:
          values.maxStockTarget === null || values.maxStockTarget === undefined
            ? null
            : Number(values.maxStockTarget || 0),
        referenceCostPerUnit: Number(values.referenceCostPerUnit || 0),
        lastProductionCostPerUnit: Number(
          values.lastProductionCostPerUnit || 0,
        ),
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
          name: name.startsWith("variants.") ? name.split(".") : name,
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
      render: (value) => SEMI_FINISHED_CATEGORY_MAP[value] || "-",
    },
    {
      title: "Varian Warna",
      key: "variants",
      width: 260,
      render: (_, record) => {
        const variants = Array.isArray(record.variants) ? record.variants : [];

        if (variants.length === 0) {
          return <Typography.Text type="secondary">Belum ada</Typography.Text>;
        }

        return (
          <Space size={[4, 4]} wrap>
            {variants.map((variant, index) => (
              <Tag key={`${variant.color}-${index}`} color={variant.isActive ? "blue" : "default"}>
                {(SEMI_FINISHED_COLOR_MAP[variant.color] || variant.color || "-") +
                  ` (${formatNumber(variant.currentStock)} ${record.unit || ""})`}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: "Stok Total",
      key: "stock",
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>
            {formatSemiFinishedStockSummary(record)}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Min Alert Total: {formatNumber(record.minStockAlert)} {record.unit || ""}
          </Typography.Text>
        </Space>
      ),
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
              Master stok internal produksi dengan varian warna, tidak dijual ke customer
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
              placeholder="Cari kode, nama, deskripsi, warna..."
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
              value={flowerGroupFilter}
              onChange={setFlowerGroupFilter}
              options={[
                { value: "all", label: "Semua Jenis Bunga" },
                ...SEMI_FINISHED_GROUP_OPTIONS,
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
          scroll={{ x: 1600 }}
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
        width={860}
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
          initialValues={buildFormValues(DEFAULT_SEMI_FINISHED_FORM)}
        >
          <Divider orientation="left">Informasi Dasar</Divider>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="Kode Item"
                name="code"
                rules={[{ required: true, message: "Kode wajib diisi" }]}
              >
                <Input placeholder="Contoh: SFM-KEL-MWR-S" />
              </Form.Item>
            </Col>

            <Col xs={24} md={16}>
              <Form.Item
                label="Nama Item"
                name="name"
                rules={[{ required: true, message: "Nama wajib diisi" }]}
              >
                <Input placeholder="Contoh: Kelopak Mawar Potong S" />
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
                label="Jenis Bunga"
                name="flowerGroup"
                rules={[{ required: true, message: "Jenis bunga wajib dipilih" }]}
              >
                <Select options={SEMI_FINISHED_GROUP_OPTIONS} />
              </Form.Item>
            </Col>

          </Row>

          <Divider orientation="left">Varian Warna & Stok</Divider>

          <Alert
            style={{ marginBottom: 16 }}
            type="info"
            showIcon
            message="Gunakan 1 master item untuk 1 jenis komponen. Tambahkan warna sebagai varian di bawahnya agar data tetap rapi. Total stok item akan dihitung otomatis dari semua varian warna."
          />

          <Form.List name="variants">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: "100%" }} size={12}>
                {fields.map((field, index) => (
                  <Card
                    key={field.key}
                    size="small"
                    title={`Varian ${index + 1}`}
                    extra={
                      fields.length > 1 ? (
                        <Button
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => remove(field.name)}
                        >
                          Hapus Varian
                        </Button>
                      ) : null
                    }
                  >
                    <Row gutter={16}>
                      <Col xs={24} md={8}>
                        <Form.Item
                          {...field}
                          label="Warna"
                          name={[field.name, "color"]}
                          rules={[{ required: true, message: "Warna wajib dipilih" }]}
                        >
                          <Select
                            showSearch
                            options={SEMI_FINISHED_COLOR_OPTIONS}
                            placeholder="Pilih warna"
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={8}>
                        <Form.Item
                          {...field}
                          label="Kode Variant"
                          name={[field.name, "sku"]}
                        >
                          <Input placeholder="Opsional: KEL-S-MERAH" />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={8}>
                        <Form.Item
                          {...field}
                          label="Status Varian"
                          name={[field.name, "isActive"]}
                          valuePropName="checked"
                        >
                          <Switch />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={6}>
                        <Form.Item
                          {...field}
                          label="Current Stock"
                          name={[field.name, "currentStock"]}
                        >
                          <InputNumber min={0} style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={6}>
                        <Form.Item
                          {...field}
                          label="Reserved Stock"
                          name={[field.name, "reservedStock"]}
                        >
                          <InputNumber min={0} style={{ width: "100%" }} disabled />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={6}>
                        <Form.Item
                          {...field}
                          label="Min Stock Alert"
                          name={[field.name, "minStockAlert"]}
                        >
                          <InputNumber min={0} style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={6}>
                        <Form.Item
                          {...field}
                          label="Average Cost / Unit"
                          name={[field.name, "averageCostPerUnit"]}
                        >
                          <InputNumber min={0} style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                ))}

                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => add({ ...DEFAULT_SEMI_FINISHED_VARIANT })}
                  block
                >
                  Tambah Varian Warna
                </Button>
              </Space>
            )}
          </Form.List>

          <Divider orientation="left">Ringkasan Stok Master</Divider>

          <Alert
            style={{ marginBottom: 16 }}
            type="info"
            showIcon
            message="Current Stock, Reserved Stock, Available Stock, dan Min Stock Alert total di bawah ini adalah hasil akumulasi seluruh varian warna."
          />

          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item label="Total Current Stock">
                <Input value={formatNumber(calculatedTotals.currentStock)} disabled />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Total Reserved Stock">
                <Input value={formatNumber(calculatedTotals.reservedStock)} disabled />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Total Available Stock">
                <Input value={formatNumber(calculatedTotals.availableStock)} disabled />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Total Min Stock Alert">
                <Input value={formatNumber(calculatedTotals.minStockAlert)} disabled />
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

            <Col xs={24} md={8}>
              <Form.Item label="Jumlah Varian Aktif">
                <Input
                  value={`${formatNumber(calculatedTotals.activeVariantCount)} dari ${formatNumber(calculatedTotals.variantCount)} varian`}
                  disabled
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Biaya Master</Divider>

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
              <Form.Item label="Average Cost / Unit (Otomatis)">
                <Input value={formatCurrency(calculatedTotals.averageCostPerUnit)} disabled />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Ringkasan">
                <Card size="small">
                  <Space direction="vertical" size={0}>
                    <Typography.Text>
                      {formatSemiFinishedStockSummary(calculatedTotals)}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      Average Cost: {formatCurrency(calculatedTotals.averageCostPerUnit)}
                    </Typography.Text>
                  </Space>
                </Card>
              </Form.Item>
            </Col>
          </Row>

        </Form>
      </Drawer>

      <Drawer
        title="Detail Semi Finished Material"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={760}
      >
        {!selectedMaterial ? (
          <Empty description="Tidak ada data" />
        ) : (
          <Space direction="vertical" style={{ width: "100%" }} size={16}>
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
              <Descriptions.Item label="Jenis Bunga">
                {SEMI_FINISHED_GROUP_MAP[selectedMaterial.flowerGroup] || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Varian Aktif">
                {formatNumber(selectedMaterial.activeVariantCount)} / {formatNumber(selectedMaterial.variantCount)}
              </Descriptions.Item>
              <Descriptions.Item label="Current Stock Total">
                {formatNumber(selectedMaterial.currentStock)}
              </Descriptions.Item>
              <Descriptions.Item label="Reserved Stock Total">
                {formatNumber(selectedMaterial.reservedStock)}
              </Descriptions.Item>
              <Descriptions.Item label="Available Stock Total">
                {formatNumber(selectedMaterial.availableStock)}
              </Descriptions.Item>
              <Descriptions.Item label="Min Stock Alert Total">
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
              <Descriptions.Item label="Status">
                {selectedMaterial.isActive ? "Aktif" : "Nonaktif"}
              </Descriptions.Item>
            </Descriptions>

            <Card title="Detail Varian Warna" size="small">
              <Table
                rowKey={(record, index) => `${record.color}-${index}`}
                pagination={false}
                dataSource={Array.isArray(selectedMaterial.variants) ? selectedMaterial.variants : []}
                locale={{ emptyText: "Belum ada varian" }}
                columns={[
                  {
                    title: "Warna",
                    dataIndex: "color",
                    key: "color",
                    render: (value) => SEMI_FINISHED_COLOR_MAP[value] || value || "-",
                  },
                  {
                    title: "Kode Variant",
                    dataIndex: "sku",
                    key: "sku",
                    render: (value) => value || "-",
                  },
                  {
                    title: "Current",
                    dataIndex: "currentStock",
                    key: "currentStock",
                    render: (value) => formatNumber(value),
                  },
                  {
                    title: "Reserved",
                    dataIndex: "reservedStock",
                    key: "reservedStock",
                    render: (value) => formatNumber(value),
                  },
                  {
                    title: "Available",
                    key: "available",
                    render: (_, record) =>
                      formatNumber(
                        Math.max(
                          Number(record.currentStock || 0) - Number(record.reservedStock || 0),
                          0,
                        ),
                      ),
                  },
                  {
                    title: "Min Alert",
                    dataIndex: "minStockAlert",
                    key: "minStockAlert",
                    render: (value) => formatNumber(value),
                  },
                  {
                    title: "Avg Cost",
                    dataIndex: "averageCostPerUnit",
                    key: "averageCostPerUnit",
                    render: (value) => formatCurrency(value),
                  },
                  {
                    title: "Status",
                    dataIndex: "isActive",
                    key: "isActive",
                    render: (value) => (value ? "Aktif" : "Nonaktif"),
                  },
                ]}
                scroll={{ x: 900 }}
              />
            </Card>
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default SemiFinishedMaterials;
