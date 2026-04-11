// src/Pages/MasterData/Products.jsx

// SECTION: import React dan hooks
import React, { useEffect, useMemo, useState } from "react";

// SECTION: import komponen Ant Design
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Space,
  Popconfirm,
  message,
  Select,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Alert,
} from "antd";

// SECTION: import icon
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";

// SECTION: import firestore helper
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";

// SECTION: import firebase db
import { db } from "../../firebase";

// SECTION: import dayjs untuk format tanggal
import dayjs from "dayjs";

// SECTION: alias Select Option
const { Option } = Select;
const { TextArea } = Input;

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

// SECTION: helper tag pricing mode
const renderPricingModeTag = (mode) => {
  if (mode === "manual") {
    return <Tag color="orange">Manual</Tag>;
  }

  return <Tag color="green">Rule</Tag>;
};

// SECTION: helper status stok
const renderStockStatusTag = (stock) => {
  const numericStock = Number(stock || 0);

  if (numericStock <= 0) {
    return <Tag color="red">Kosong</Tag>;
  }

  return <Tag color="green">Tersedia</Tag>;
};

const Products = () => {
  // SECTION: state data utama
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pricingRules, setPricingRules] = useState([]);
  const [loading, setLoading] = useState(false);

  // SECTION: state modal/form
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [currentStockValue, setCurrentStockValue] = useState(0);
  const [form] = Form.useForm();

  // SECTION: ambil semua data realtime
  useEffect(() => {
    setLoading(true);

    // SECTION: ambil data produk realtime
    const unsubProducts = onSnapshot(
      collection(db, "products"),
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        setProducts(data);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        message.error("Gagal memuat produk.");
        setLoading(false);
      },
    );

    // SECTION: ambil kategori realtime
    const unsubCategories = onSnapshot(
      collection(db, "categories"),
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        setCategories(data);
      },
      (error) => {
        console.error(error);
        message.error("Gagal memuat kategori.");
      },
    );

    // SECTION: ambil pricing rules khusus products
    const unsubPricingRules = onSnapshot(
      collection(db, "pricing_rules"),
      (snapshot) => {
        const data = snapshot.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
          }))
          .filter((item) => item?.targetType === "products");

        setPricingRules(data);
      },
      (error) => {
        console.error(error);
        message.error("Gagal memuat pricing rules.");
      },
    );

    return () => {
      unsubProducts();
      unsubCategories();
      unsubPricingRules();
    };
  }, []);

  // SECTION: watch pricing mode
  const pricingModeValue = Form.useWatch("pricingMode", form);

  // SECTION: map nama rule
  const pricingRuleMap = useMemo(() => {
    const map = {};

    (pricingRules || []).forEach((item) => {
      map[item.id] = item.name;
    });

    return map;
  }, [pricingRules]);

  // SECTION: buka modal tambah
  const openCreateModal = () => {
    setModalVisible(true);
    setIsEditing(false);
    setEditingId(null);
    setCurrentStockValue(0);
    form.resetFields();

    form.setFieldsValue({
      name: "",
      categoryId: null,
      stock: 0,
      price: 0,
      hppPerUnit: 0,
      pricingMode: "rule",
      pricingRuleId: null,
      description: "",
    });
  };

  // SECTION: tutup modal
  const closeModal = () => {
    setModalVisible(false);
    setIsEditing(false);
    setEditingId(null);
    setCurrentStockValue(0);
    form.resetFields();
  };

  // SECTION: simpan produk
  const handleSaveProduct = async (values) => {
    try {
      const selectedCategory = (categories || []).find(
        (c) => c.id === values.categoryId,
      );

      // RULE:
      // Saat edit, stok produk tidak boleh diubah dari master.
      // Stok produk berubah dari:
      // - Produksi selesai
      // - Penjualan
      // - Penyesuaian stok
      const payload = {
        name: values.name || "",
        categoryId: values.categoryId || null,
        category: selectedCategory?.name || "Produk Jadi",

        // SECTION: field produk + pricing
        price: Math.round(Number(values.price || 0)),
        hppPerUnit: Math.round(Number(values.hppPerUnit || 0)),
        pricingMode: values.pricingMode || "rule",
        pricingRuleId:
          values.pricingMode === "rule" ? values.pricingRuleId || null : null,
        description: values.description || "",

        // SECTION: update timestamp pricing manual
        lastPricingUpdatedAt:
          values.pricingMode === "manual" ? Timestamp.now() : null,
      };

      if (isEditing) {
        await updateDoc(doc(db, "products", editingId), payload);
        message.success("Produk berhasil diupdate.");
      } else {
        await addDoc(collection(db, "products"), {
          ...payload,
          stock: Math.round(Number(values.stock || 0)),
          createdAt: Timestamp.now(),
        });
        message.success("Produk berhasil ditambahkan.");
      }

      closeModal();
    } catch (error) {
      console.error(error);
      message.error("Gagal menyimpan produk.");
    }
  };

  // SECTION: edit produk
  const handleEditProduct = (record) => {
    setIsEditing(true);
    setEditingId(record.id);
    setModalVisible(true);
    setCurrentStockValue(Number(record.stock || 0));

    form.setFieldsValue({
      name: record.name || "",
      categoryId:
        record.categoryId ||
        (categories || []).find((cat) => cat.name === record.category)?.id ||
        null,
      price: Number(record.price || 0),
      hppPerUnit: Number(record.hppPerUnit || 0),
      pricingMode: record.pricingMode || "rule",
      pricingRuleId: record.pricingRuleId || null,
      description: record.description || "",
      stock: Number(record.stock || 0),
    });
  };

  // SECTION: hapus produk
  const handleDeleteProduct = async (id) => {
    try {
      await deleteDoc(doc(db, "products", id));
      message.success("Produk berhasil dihapus.");
    } catch (error) {
      console.error(error);
      message.error("Gagal menghapus produk.");
    }
  };

  // SECTION: kolom tabel
  const columns = [
    {
      title: "Nama Produk",
      dataIndex: "name",
      key: "name",
      width: 220,
    },
    {
      title: "Kategori",
      dataIndex: "category",
      key: "category",
      width: 160,
      render: (val) => val || "-",
    },
    {
      title: "Stok",
      dataIndex: "stock",
      key: "stock",
      width: 100,
      render: (val) => formatNumberID(val),
    },
    {
      title: "HPP / Unit",
      dataIndex: "hppPerUnit",
      key: "hppPerUnit",
      width: 140,
      render: (val) => (val ? formatCurrencyIDR(val) : "-"),
    },
    {
      title: "Harga Jual",
      dataIndex: "price",
      key: "price",
      width: 140,
      render: (val) => formatCurrencyIDR(val),
    },
    {
      title: "Mode Pricing",
      dataIndex: "pricingMode",
      key: "pricingMode",
      width: 130,
      render: (val) => renderPricingModeTag(val),
    },
    {
      title: "Rule Pricing",
      dataIndex: "pricingRuleId",
      key: "pricingRuleId",
      width: 190,
      render: (val) => pricingRuleMap[val] || "-",
    },
    {
      title: "Update Pricing",
      dataIndex: "lastPricingUpdatedAt",
      key: "lastPricingUpdatedAt",
      width: 170,
      render: (val) =>
        val?.toDate ? dayjs(val.toDate()).format("DD-MM-YYYY HH:mm") : "-",
    },
    {
      title: "Status Stok",
      key: "stockStatus",
      width: 120,
      render: (_, record) => renderStockStatusTag(record?.stock),
    },
    {
      title: "Aksi",
      key: "actions",
      width: 150,
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => handleEditProduct(record)}>
            Edit
          </Button>

          <Popconfirm
            title="Hapus produk?"
            description="Data yang dihapus tidak bisa dikembalikan."
            okText="Ya"
            cancelText="Batal"
            onConfirm={() => handleDeleteProduct(record.id)}
          >
            <Button danger size="small">
              Hapus
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* SECTION: header halaman */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Products</h2>
          <p style={{ margin: "8px 0 0 0", color: "#666" }}>
            Master produk jadi dengan dukungan pricing rule dan manual
          </p>
        </div>

        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreateModal}
        >
          Tambah Produk
        </Button>
      </div>

      {/* SECTION: info aturan */}
      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message="Harga jual produk bisa diatur manual atau mengikuti Pricing Rules. Stok produk tidak boleh diedit dari master saat edit, kecuali lewat produksi, penjualan, atau penyesuaian stok."
      />

      {/* SECTION: ringkasan data */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Total Produk" value={products.length} />
          </Card>
        </Col>

        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="Mode Rule"
              value={
                products.filter((item) => item?.pricingMode !== "manual").length
              }
            />
          </Card>
        </Col>

        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="Mode Manual"
              value={
                products.filter((item) => item?.pricingMode === "manual").length
              }
            />
          </Card>
        </Col>

        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="Rule Tersedia"
              value={pricingRules.filter((item) => item?.isActive).length}
            />
          </Card>
        </Col>
      </Row>

      {/* SECTION: tabel produk */}
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={products}
          columns={columns}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1550 }}
        />
      </Card>

      {/* SECTION: modal form produk */}
      <Modal
        title={isEditing ? "Edit Produk" : "Tambah Produk"}
        open={modalVisible}
        onCancel={closeModal}
        onOk={() => form.submit()}
        okText="Simpan"
        cancelText="Batal"
        width={760}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSaveProduct}>
          {/* SECTION: nama dan kategori */}
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="name"
                label="Nama Produk"
                rules={[
                  { required: true, message: "Nama produk wajib diisi." },
                ]}
              >
                <Input placeholder="Contoh: Buket bunga flanel premium" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item name="categoryId" label="Kategori">
                <Select
                  allowClear
                  placeholder="Pilih kategori"
                  showSearch
                  optionFilterProp="children"
                >
                  {(categories || []).map((category) => (
                    <Option key={category.id} value={category.id}>
                      {category.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* SECTION: stok */}
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="stock"
                label={
                  isEditing
                    ? `Stok Saat Ini (${formatNumberID(currentStockValue)})`
                    : "Stok Awal"
                }
                extra={
                  isEditing
                    ? "Saat edit, stok produk tidak boleh diubah manual dari master."
                    : "Stok awal hanya untuk setup awal produk."
                }
              >
                <InputNumber
                  disabled={isEditing}
                  style={{ width: "100%" }}
                  min={0}
                  formatter={(value) => formatNumberID(value)}
                  parser={(value) => value?.replace(/\./g, "") || ""}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="hppPerUnit"
                label="HPP per Unit"
                rules={[
                  { required: true, message: "HPP per unit wajib diisi." },
                ]}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  formatter={(value) => formatNumberID(value)}
                  parser={(value) => value?.replace(/\./g, "") || ""}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* SECTION: mode pricing dan rule */}
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="pricingMode"
                label="Mode Pricing"
                rules={[
                  { required: true, message: "Mode pricing wajib dipilih." },
                ]}
              >
                <Select
                  onChange={(value) => {
                    if (value === "manual") {
                      form.setFieldsValue({
                        pricingRuleId: null,
                      });
                    }
                  }}
                >
                  <Option value="rule">Rule</Option>
                  <Option value="manual">Manual</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="pricingRuleId"
                label="Pricing Rule"
                rules={[
                  {
                    required: pricingModeValue === "rule",
                    message: "Pricing rule wajib dipilih untuk mode rule.",
                  },
                ]}
              >
                <Select
                  allowClear
                  disabled={pricingModeValue !== "rule"}
                  placeholder="Pilih pricing rule"
                >
                  {(pricingRules || []).map((rule) => (
                    <Option key={rule.id} value={rule.id}>
                      {rule.name}
                      {rule?.isActive ? "" : " (Nonaktif)"}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* SECTION: harga jual */}
          <Form.Item
            name="price"
            label="Harga Jual"
            extra={
              pricingModeValue === "rule"
                ? "Pada mode rule, field ini tetap menjadi harga master terakhir hasil apply rule."
                : "Pada mode manual, harga ini akan menjadi harga jual aktif produk."
            }
            rules={[{ required: true, message: "Harga jual wajib diisi." }]}
          >
            <InputNumber
              style={{ width: "100%" }}
              min={0}
              formatter={(value) => formatNumberID(value)}
              parser={(value) => value?.replace(/\./g, "") || ""}
            />
          </Form.Item>

          {/* SECTION: deskripsi */}
          <Form.Item name="description" label="Deskripsi">
            <TextArea rows={3} placeholder="Catatan produk" />
          </Form.Item>

          {/* SECTION: bantuan */}
          <Alert
            type="warning"
            showIcon
            message="Kalau produk pakai mode rule, harga akan ikut Pricing Rules saat rule diterapkan. Kalau pakai mode manual, produk ini akan dilewati saat apply rule."
          />
        </Form>
      </Modal>
    </div>
  );
};

export default Products;
